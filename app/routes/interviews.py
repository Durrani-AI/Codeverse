"""
Interview endpoints.

POST /start                       - create session + first question
GET  /{session_id}                - fetch session with all questions & responses
POST /{session_id}/answer         - submit an answer -> feedback + next question
POST /{session_id}/feedback       - holistic session-level feedback
GET  /                            - list sessions for the current user
DELETE /{session_id}              - cancel / delete an in-progress session
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models import (
    Feedback,
    InterviewSession,
    Question,
    SessionStatus,
    User,
    UserResponse as UserResponseModel,
)
from app.routes.auth import get_current_active_user
from app.schemas import (
    AnswerSubmitResponse,
    FeedbackOut,
    InterviewSessionOut,
    InterviewSessionResponse,
    InterviewStartRequest,
    InterviewStartResponse,
    QuestionFeedbackDetail,
    QuestionOut,
    SessionFeedbackResponse,
    SubmitAnswerRequest,
    UserResponseOut,
)
from app.services.ai_service import (
    evaluate_answer,
    generate_followup_question,
    generate_interview_question,
    generate_session_feedback,
)
from app.utils.helpers import clamp

router = APIRouter()
logger = logging.getLogger(__name__)


# --- Internal helpers ---

async def _get_session_or_404(
    session_id: str,
    db: AsyncSession,
    *,
    user_id: str,
    load_questions: bool = False,
    load_responses: bool = False,
) -> InterviewSession:
    """Fetch a session by ID, verify ownership, and optionally eager-load relationships."""
    stmt = select(InterviewSession).where(InterviewSession.id == session_id)
    if load_questions:
        stmt = stmt.options(selectinload(InterviewSession.questions))
    if load_responses:
        stmt = stmt.options(
            selectinload(InterviewSession.questions)
            .selectinload(Question.responses)
            .selectinload(UserResponseModel.feedback)
        )
    result = await db.execute(stmt)
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Session not found")
    if session.user_id != user_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not own this session")
    return session


async def _previous_questions_for(session_id: str, db: AsyncSession) -> list[str]:
    """Return all question texts already asked in a session (for dedup)."""
    result = await db.execute(
        select(Question.question_text)
        .where(Question.session_id == session_id)
        .order_by(Question.asked_at)
    )
    return list(result.scalars().all())


# --- POST /start ---

@router.post(
    "/start",
    response_model=InterviewStartResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Start a new interview",
)
async def start_interview(
    request: InterviewStartRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new interview session and generate the first question."""

    if request.interview_type.value == "coding" and not (request.programming_language or "").strip():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "programming_language is required for coding interviews.",
        )

    # Create the session record
    try:
        session = InterviewSession(
            user_id=current_user.id,
            interview_type=request.interview_type,
            difficulty_level=request.difficulty_level,
            status=SessionStatus.IN_PROGRESS,
            topic=request.topic,
            programming_language=request.programming_language,
        )
        db.add(session)
        await db.flush()
    except Exception as exc:
        logger.error("DB error creating session: %s", exc, exc_info=True)
        raise HTTPException(500, f"Failed to create interview session: {exc}")

    # Generate the first question via LLM
    try:
        question_text = await generate_interview_question(
            interview_type=request.interview_type.value,
            difficulty=request.difficulty_level.value,
            topic=request.topic,
            programming_language=request.programming_language,
        )
    except ConnectionError as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc))
    except (ValueError, RuntimeError) as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"AI error: {exc}")

    # Persist the question
    try:
        question = Question(
            session_id=session.id,
            question_text=question_text,
            question_type=request.interview_type.value,
        )
        db.add(question)
        await db.commit()
        await db.refresh(session)
        await db.refresh(question)
    except Exception as exc:
        await db.rollback()
        logger.error("DB error storing question: %s", exc)
        raise HTTPException(500, "Failed to store generated question.")

    return InterviewStartResponse(
        session_id=session.id,
        interview_type=session.interview_type,
        difficulty_level=session.difficulty_level,
        topic=session.topic or "",
        programming_language=session.programming_language,
        status=session.status,
        started_at=session.started_at,
        first_question=QuestionOut.model_validate(question),
    )


# --- POST /{session_id}/answer ---

@router.post(
    "/{session_id}/answer",
    response_model=AnswerSubmitResponse,
    summary="Submit an answer and get feedback + next question",
)
async def submit_answer(
    session_id: str,
    body: SubmitAnswerRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Submit a candidate answer, receive feedback, and proceed to the next question.

    The LLM evaluates the answer and either generates the next question or
    marks the session as complete once the configured question limit is reached.
    """

    session = await _get_session_or_404(session_id, db, user_id=current_user.id, load_questions=True)

    if session.status == SessionStatus.COMPLETED:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This session is already completed.",
        )

    # Validate the question belongs to this session
    result = await db.execute(
        select(Question).where(
            Question.id == body.question_id,
            Question.session_id == session_id,
        )
    )
    question = result.scalar_one_or_none()
    if question is None:
        raise HTTPException(
            status.HTTP_404_NOT_FOUND,
            "Question not found in this session.",
        )

    # Save the candidate response
    user_resp = UserResponseModel(
        question_id=question.id,
        response_text=body.response_text,
        response_code=body.response_code,
    )
    db.add(user_resp)
    await db.flush()

    # Score logic: if skipped or empty, score=0, else call LLM
    answer_text = (body.response_text or "").strip().lower()
    if not answer_text or answer_text in {"(skipped)", "skipped"}:
        eval_data = {
            "score": 0,
            "feedback": "No answer submitted.",
            "strengths": [],
            "improvements": [],
        }
    else:
        eval_data = await evaluate_answer(
            question=question.question_text,
            user_answer=body.response_text,
            interview_type=session.interview_type.value,
            difficulty=session.difficulty_level.value,
            programming_language=session.programming_language,
        )

    fb = Feedback(
        response_id=user_resp.id,
        ai_feedback_text=eval_data.get("feedback", ""),
        score=int(clamp(eval_data.get("score") if eval_data.get("score") is not None else 0, 0, 10)),
        strengths=eval_data.get("strengths", []),
        improvements=eval_data.get("improvements", []),
    )
    db.add(fb)
    await db.flush()
    await db.refresh(user_resp)
    await db.refresh(fb)

    # Decide: generate next question or complete the session
    questions_asked = len(session.questions)
    is_complete = questions_asked >= settings.DEFAULT_QUESTIONS_COUNT
    next_question_out = None

    if not is_complete:
        try:
            next_q_text = await generate_followup_question(
                original_question=question.question_text,
                candidate_answer=body.response_text,
                interview_type=session.interview_type.value,
                difficulty=session.difficulty_level.value,
                topic=session.topic or "General",
                programming_language=session.programming_language,
            )
            next_q = Question(
                session_id=session.id,
                question_text=next_q_text,
                question_type=session.interview_type.value,
            )
            db.add(next_q)
            await db.flush()
            await db.refresh(next_q)
            next_question_out = QuestionOut.model_validate(next_q)
        except Exception as exc:
            logger.warning("Follow-up question generation failed: %s - completing session", exc)
            is_complete = True

    if is_complete:
        session.status = SessionStatus.COMPLETED
        session.completed_at = datetime.now(timezone.utc)

    await db.commit()

    return AnswerSubmitResponse(
        response=UserResponseOut(
            id=user_resp.id,
            question_id=user_resp.question_id,
            response_text=user_resp.response_text,
            response_code=user_resp.response_code,
            submitted_at=user_resp.submitted_at,
            feedback=FeedbackOut.model_validate(fb),
        ),
        is_complete=is_complete,
        next_question=next_question_out,
        questions_remaining=(
            settings.DEFAULT_QUESTIONS_COUNT - (questions_asked + (0 if is_complete else 1))
            if not is_complete else 0
        ),
    )


# --- POST /{session_id}/feedback ---

@router.post(
    "/{session_id}/feedback",
    response_model=SessionFeedbackResponse,
    summary="Get holistic feedback for the entire session",
)
async def session_feedback(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a comprehensive debrief covering all Q&A in a session.

    The session does NOT need to be marked complete - partial feedback is fine.
    """

    session = await _get_session_or_404(
        session_id, db, user_id=current_user.id, load_responses=True,
    )

    # Build Q&A pairs for the LLM
    qa_pairs: list[dict[str, str]] = []
    individual_scores: list[int | None] = []
    question_feedbacks: list[QuestionFeedbackDetail] = []

    for q in sorted(session.questions, key=lambda q: q.asked_at):
        answer_text = ""
        score = None
        fb_text = None
        fb_strengths = None
        fb_improvements = None
        for resp in (q.responses or []):
            answer_text = resp.response_text
            if resp.feedback:
                score = resp.feedback.score
                fb_text = resp.feedback.ai_feedback_text
                fb_strengths = resp.feedback.strengths
                fb_improvements = resp.feedback.improvements
        qa_pairs.append({
            "question": q.question_text,
            "answer": answer_text or "(no answer)",
            **({"score": str(score)} if score else {}),
        })
        individual_scores.append(score)
        question_feedbacks.append(QuestionFeedbackDetail(
            question_text=q.question_text,
            question_type=q.question_type.value if hasattr(q.question_type, 'value') else q.question_type,
            score=score,
            ai_feedback_text=fb_text,
            strengths=fb_strengths,
            improvements=fb_improvements,
        ))

    if not qa_pairs:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "No questions in this session yet.",
        )

    # Generate holistic feedback via LLM
    try:
        ai_result = await generate_session_feedback(
            interview_type=session.interview_type.value,
            difficulty=session.difficulty_level.value,
            topic=session.topic or "General",
            qa_pairs=qa_pairs,
            programming_language=session.programming_language,
        )
    except (ConnectionError, RuntimeError) as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"Feedback generation failed: {exc}",
        )

    return SessionFeedbackResponse(
        session_id=session.id,
        overall_score=ai_result.get("overall_score"),
        summary=ai_result.get("summary", ""),
        key_strengths=ai_result.get("key_strengths", []),
        areas_for_improvement=ai_result.get("areas_for_improvement", []),
        recommendations=ai_result.get("recommendations", []),
        questions_answered=len(qa_pairs),
        individual_scores=individual_scores,
        question_feedbacks=question_feedbacks,
    )


# --- GET / ---

@router.get(
    "/",
    response_model=list[InterviewSessionOut],
    summary="List interview sessions",
)
async def list_sessions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(InterviewSession)
        .options(selectinload(InterviewSession.questions))
        .where(InterviewSession.user_id == current_user.id)
        .order_by(InterviewSession.started_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return [
        InterviewSessionResponse.from_orm_with_count(s)
        for s in result.scalars().all()
    ]


# --- GET /{session_id} ---

@router.get(
    "/{session_id}",
    response_model=InterviewSessionOut,
    summary="Get interview session details",
)
async def get_session(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    session = await _get_session_or_404(
        session_id, db, user_id=current_user.id, load_questions=True,
    )
    return InterviewSessionResponse.from_orm_with_count(session)


# --- DELETE /{session_id} ---

@router.delete(
    "/{session_id}",
    status_code=status.HTTP_200_OK,
    summary="Cancel or delete an interview session",
)
async def cancel_session(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel an in-progress session.

    In-progress sessions are marked as completed with ``completed_at`` set.
    The session record is preserved for analytics.
    """
    session = await _get_session_or_404(
        session_id, db, user_id=current_user.id,
    )

    if session.status == SessionStatus.COMPLETED:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Session is already completed.",
        )

    session.status = SessionStatus.COMPLETED
    session.completed_at = datetime.now(timezone.utc)
    await db.commit()
    logger.info("Session %s cancelled by user %s", session_id, current_user.id)

    return {"message": "Session cancelled", "session_id": session_id}
