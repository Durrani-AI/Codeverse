"""
Analytics endpoints - overview stats, performance breakdowns, and trends.
"""

import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

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
from app.schemas import AnalyticsResponse, PerformanceByType, RecentSession

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/overview", response_model=AnalyticsResponse)
async def overview(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Aggregated statistics for the current user."""

    user_id = current_user.id

    total = (
        await db.execute(
            select(func.count(InterviewSession.id)).where(
                InterviewSession.user_id == user_id
            )
        )
    ).scalar() or 0

    completed = (
        await db.execute(
            select(func.count(InterviewSession.id)).where(
                and_(
                    InterviewSession.user_id == user_id,
                    InterviewSession.status == SessionStatus.COMPLETED,
                )
            )
        )
    ).scalar() or 0

    total_questions = (
        await db.execute(
            select(func.count(Question.id))
            .join(InterviewSession)
            .where(InterviewSession.user_id == user_id)
        )
    ).scalar() or 0

    # Performance by type
    type_result = await db.execute(
        select(
            InterviewSession.interview_type,
            func.count(Feedback.id).label("feedbacks"),
            func.avg(Feedback.score).label("avg_score"),
        )
        .join(Question, Question.session_id == InterviewSession.id)
        .join(UserResponseModel, UserResponseModel.question_id == Question.id)
        .join(Feedback, Feedback.response_id == UserResponseModel.id)
        .where(InterviewSession.user_id == user_id)
        .group_by(InterviewSession.interview_type)
    )

    by_type = [
        PerformanceByType(
            interview_type=row.interview_type.value if row.interview_type else "unknown",
            total_feedbacks=row.feedbacks,
            average_score=round(float(row.avg_score), 2) if row.avg_score else 0,
        )
        for row in type_result
    ]

    # Average score across all feedbacks
    avg_score_result = await db.execute(
        select(func.avg(Feedback.score))
        .join(UserResponseModel, UserResponseModel.id == Feedback.response_id)
        .join(Question, Question.id == UserResponseModel.question_id)
        .join(InterviewSession, InterviewSession.id == Question.session_id)
        .where(InterviewSession.user_id == user_id)
    )
    avg_score = avg_score_result.scalar() or 0.0

    # Improvement trend: compare first-half vs second-half of scores
    scores_result = await db.execute(
        select(Feedback.score)
        .join(UserResponseModel, UserResponseModel.id == Feedback.response_id)
        .join(Question, Question.id == UserResponseModel.question_id)
        .join(InterviewSession, InterviewSession.id == Question.session_id)
        .where(InterviewSession.user_id == user_id)
        .order_by(Feedback.created_at)
    )
    scores = [row[0] for row in scores_result if row[0] is not None]

    if len(scores) >= 4:
        mid = len(scores) // 2
        first_avg = sum(scores[:mid]) / mid
        second_avg = sum(scores[mid:]) / (len(scores) - mid)
        if second_avg > first_avg + 0.3:
            trend = "improving"
        elif second_avg < first_avg - 0.3:
            trend = "declining"
        else:
            trend = "stable"
    else:
        trend = "insufficient_data"

    return AnalyticsResponse(
        sessions_count=total,
        completed_sessions=completed,
        in_progress_sessions=total - completed,
        total_questions_asked=total_questions,
        average_score=round(float(avg_score), 2),
        improvement_trend=trend,
        by_type=by_type,
    )


@router.get("/recent-activity", response_model=list[RecentSession])
async def recent_activity(
    days: int = 30,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Sessions from the last N days as structured RecentSession objects."""

    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    result = await db.execute(
        select(InterviewSession)
        .where(
            and_(
                InterviewSession.user_id == current_user.id,
                InterviewSession.started_at >= cutoff,
            )
        )
        .order_by(InterviewSession.started_at.desc())
    )
    sessions = result.scalars().all()

    return [
        RecentSession(
            id=s.id,
            interview_type=s.interview_type.value,
            difficulty=s.difficulty_level.value,
            status=s.status.value,
            started_at=s.started_at.isoformat() if s.started_at else None,
        )
        for s in sessions
    ]
