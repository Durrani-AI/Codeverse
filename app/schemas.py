"""
Pydantic request / response schemas.

Every schema includes:
- Proper typing with Optional where appropriate
- Field-level validation (min/max length, value ranges)
- Example values via model_config / json_schema_extra
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.models import (
    DifficultyLevel,
    InterviewType,
    QuestionType,
    SessionStatus,
)


# ══════════════════════════════════════════════════════════════════════════════
# 1. User schemas
# ══════════════════════════════════════════════════════════════════════════════
class UserCreate(BaseModel):
    """Register a new user account."""

    email: EmailStr = Field(
        ..., description="Valid email address", examples=["alice@example.com"]
    )
    username: str = Field(
        ...,
        min_length=3,
        max_length=100,
        description="Unique username (3-100 chars)",
        examples=["alice_dev"],
    )
    password: str = Field(
        ...,
        min_length=8,
        max_length=128,
        description="Strong password (8-128 chars)",
        examples=["S3cur3P@ss!"],
    )

    @field_validator("username")
    @classmethod
    def username_alphanumeric(cls, v: str) -> str:
        if not v.replace("_", "").replace("-", "").isalnum():
            raise ValueError("Username may only contain letters, digits, _ and -")
        return v

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "alice@example.com",
                "username": "alice_dev",
                "password": "S3cur3P@ss!",
            }
        }
    )


class UserLogin(BaseModel):
    """Authenticate with username + password."""

    username: str = Field(..., examples=["alice_dev"])
    password: str = Field(..., examples=["S3cur3P@ss!"])

    model_config = ConfigDict(
        json_schema_extra={
            "example": {"username": "alice_dev", "password": "S3cur3P@ss!"}
        }
    )


class UserResponse(BaseModel):
    """Public user profile returned by the API."""

    id: str = Field(..., examples=["550e8400-e29b-41d4-a716-446655440000"])
    email: str = Field(..., examples=["alice@example.com"])
    username: str = Field(..., examples=["alice_dev"])
    is_active: bool = Field(..., examples=[True])
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str = Field(..., examples=["eyJhbGciOiJIUzI1NiIs..."])
    token_type: str = Field(default="bearer", examples=["bearer"])


class TokenData(BaseModel):
    user_id: Optional[str] = None


# ══════════════════════════════════════════════════════════════════════════════
# 2. InterviewSession schemas
# ══════════════════════════════════════════════════════════════════════════════
class InterviewSessionCreate(BaseModel):
    """Create / start a new interview session."""

    interview_type: InterviewType = Field(
        ...,
        description="Type of interview: coding, behavioral, or system_design",
        examples=["coding"],
    )
    difficulty_level: DifficultyLevel = Field(
        ...,
        description="Difficulty: easy, medium, or hard",
        examples=["medium"],
    )
    topic: str = Field(
        ...,
        min_length=2,
        max_length=255,
        description="Subject area (e.g. Python, Databases, Leadership)",
        examples=["Python"],
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "interview_type": "coding",
                "difficulty_level": "medium",
                "topic": "Python",
            }
        }
    )


# Keep the old name as alias so existing route imports don't break
InterviewStartRequest = InterviewSessionCreate


class InterviewSessionResponse(BaseModel):
    """Full interview session with all fields + questions count."""

    id: str = Field(..., examples=["a1b2c3d4-e5f6-7890-abcd-ef1234567890"])
    user_id: str = Field(..., examples=["550e8400-e29b-41d4-a716-446655440000"])
    interview_type: InterviewType = Field(..., examples=["coding"])
    difficulty_level: DifficultyLevel = Field(..., examples=["medium"])
    status: SessionStatus = Field(..., examples=["in_progress"])
    topic: Optional[str] = Field(None, examples=["Python"])
    started_at: datetime
    completed_at: Optional[datetime] = None
    questions: List[QuestionResponse] = Field(default_factory=list)
    questions_count: int = Field(
        default=0,
        description="Total number of questions asked in this session",
        examples=[5],
    )

    @classmethod
    def from_orm_with_count(cls, obj: Any) -> "InterviewSessionResponse":
        """Build from ORM object, auto-computing questions_count."""
        questions = [QuestionResponse.model_validate(q) for q in (obj.questions or [])]
        return cls(
            id=obj.id,
            user_id=obj.user_id,
            interview_type=obj.interview_type,
            difficulty_level=obj.difficulty_level,
            status=obj.status,
            topic=obj.topic,
            started_at=obj.started_at,
            completed_at=obj.completed_at,
            questions=questions,
            questions_count=len(questions),
        )

    model_config = ConfigDict(from_attributes=True)


# Alias for backward compat with existing route imports
InterviewSessionOut = InterviewSessionResponse


class InterviewStartResponse(BaseModel):
    """Returned after starting a new session – includes the first question."""

    session_id: str = Field(..., examples=["a1b2c3d4-e5f6-7890-abcd-ef1234567890"])
    interview_type: InterviewType = Field(..., examples=["coding"])
    difficulty_level: DifficultyLevel = Field(..., examples=["medium"])
    topic: str = Field(..., examples=["Python"])
    status: SessionStatus = Field(..., examples=["in_progress"])
    started_at: datetime
    first_question: QuestionResponse

    model_config = ConfigDict(from_attributes=True)


# ══════════════════════════════════════════════════════════════════════════════
# 3. Question schemas
# ══════════════════════════════════════════════════════════════════════════════
class QuestionResponse(BaseModel):
    """A single interview question with metadata."""

    id: str = Field(..., examples=["f47ac10b-58cc-4372-a567-0e02b2c3d479"])
    session_id: str = Field(..., examples=["a1b2c3d4-e5f6-7890-abcd-ef1234567890"])
    question_text: str = Field(
        ...,
        description="The interview question posed to the candidate",
        examples=["Write a function that reverses a linked list in-place."],
    )
    question_type: QuestionType = Field(..., examples=["coding"])
    asked_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Alias for backward compat
QuestionOut = QuestionResponse


# ══════════════════════════════════════════════════════════════════════════════
# 4. UserResponse (candidate answer) schemas
# ══════════════════════════════════════════════════════════════════════════════
class UserResponseCreate(BaseModel):
    """Submit an answer to an interview question."""

    question_id: str = Field(
        ...,
        description="UUID of the question being answered",
        examples=["f47ac10b-58cc-4372-a567-0e02b2c3d479"],
    )
    response_text: str = Field(
        ...,
        min_length=1,
        description="Candidate's text answer",
        examples=["I would use a three-pointer approach..."],
    )
    response_code: Optional[str] = Field(
        None,
        description="Optional code block submitted alongside the explanation",
        examples=["def reverse_list(head):\n    prev = None\n    ..."],
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "question_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
                "response_text": "I would iterate through the list, reversing pointers.",
                "response_code": "def reverse(head):\n    prev = None\n    curr = head\n    while curr:\n        nxt = curr.next\n        curr.next = prev\n        prev = curr\n        curr = nxt\n    return prev",
            }
        }
    )


# Alias – routes previously imported SubmitAnswerRequest
UserResponseSubmit = UserResponseCreate
SubmitAnswerRequest = UserResponseCreate


class UserResponseOut(BaseModel):
    """Candidate's answer with optional AI feedback attached."""

    id: str = Field(..., examples=["d4e5f6a7-b8c9-0123-4567-89abcdef0123"])
    question_id: str = Field(..., examples=["f47ac10b-58cc-4372-a567-0e02b2c3d479"])
    response_text: str
    response_code: Optional[str] = None
    submitted_at: datetime
    feedback: Optional[FeedbackResponse] = None

    model_config = ConfigDict(from_attributes=True)


# ══════════════════════════════════════════════════════════════════════════════
# 5. Feedback schemas
# ══════════════════════════════════════════════════════════════════════════════
class FeedbackResponse(BaseModel):
    """Detailed AI-generated feedback on a candidate's answer."""

    id: str = Field(..., examples=["c3d4e5f6-a7b8-9012-3456-789abcdef012"])
    response_id: str = Field(..., examples=["d4e5f6a7-b8c9-0123-4567-89abcdef0123"])
    ai_feedback_text: str = Field(
        ...,
        description="Detailed prose feedback from the AI evaluator",
        examples=[
            "Good approach using iteration. Consider edge cases like empty lists."
        ],
    )
    score: int = Field(
        ...,
        ge=1,
        le=10,
        description="Overall quality score from 1 (poor) to 10 (excellent)",
        examples=[7],
    )
    strengths: Optional[List[str]] = Field(
        None,
        description="Things the candidate did well",
        examples=[["Clear explanation", "Correct time complexity"]],
    )
    improvements: Optional[List[str]] = Field(
        None,
        description="Suggested areas for improvement",
        examples=[["Handle edge case of empty input", "Discuss space complexity"]],
    )
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Alias for backward compat
FeedbackOut = FeedbackResponse


# ══════════════════════════════════════════════════════════════════════════════
# 6. Answer-submission response (includes next question or completion)
# ══════════════════════════════════════════════════════════════════════════════
class AnswerSubmitResponse(BaseModel):
    """Returned after submitting an answer – feedback + what comes next."""

    response: UserResponseOut = Field(
        ..., description="Saved answer with AI feedback"
    )
    is_complete: bool = Field(
        ...,
        description="True when the session has ended (no more questions)",
        examples=[False],
    )
    next_question: Optional[QuestionResponse] = None
    questions_remaining: Optional[int] = Field(
        None,
        description="Approximate number of questions left (null if unknown)",
        examples=[3],
    )

    model_config = ConfigDict(from_attributes=True)


# ══════════════════════════════════════════════════════════════════════════════
# 7. Session-level feedback
# ══════════════════════════════════════════════════════════════════════════════
class SessionFeedbackResponse(BaseModel):
    """Holistic AI-generated feedback for an entire interview session."""

    session_id: str = Field(
        ..., examples=["a1b2c3d4-e5f6-7890-abcd-ef1234567890"]
    )
    overall_score: Optional[float] = Field(
        None, ge=1, le=10, examples=[7.5]
    )
    summary: str = Field(
        ...,
        description="3-4 sentence overall assessment",
        examples=["Strong problem-solving skills with room for improvement in edge cases."],
    )
    key_strengths: List[str] = Field(
        default_factory=list,
        examples=[["Clear communication", "Correct approach"]],
    )
    areas_for_improvement: List[str] = Field(
        default_factory=list,
        examples=[["Edge case handling", "Time complexity analysis"]],
    )
    recommendations: List[str] = Field(
        default_factory=list,
        examples=[["Practice dynamic programming", "Review system design patterns"]],
    )
    questions_answered: int = Field(..., examples=[5])
    individual_scores: List[Optional[int]] = Field(
        default_factory=list,
        description="Per-question scores in order they were asked",
        examples=[[7, 8, 6, 9, 7]],
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "session_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                "overall_score": 7.5,
                "summary": "Solid performance with strong coding fundamentals.",
                "key_strengths": ["Clear communication", "Efficient solutions"],
                "areas_for_improvement": ["Edge case handling"],
                "recommendations": ["Practice DP problems", "Review Big-O notation"],
                "questions_answered": 5,
                "individual_scores": [7, 8, 6, 9, 7],
            }
        }
    )


# ══════════════════════════════════════════════════════════════════════════════
# 8. Analytics schemas
# ══════════════════════════════════════════════════════════════════════════════
class PerformanceByType(BaseModel):
    """Score breakdown for one interview type."""

    interview_type: str = Field(..., examples=["coding"])
    total_feedbacks: int = Field(..., examples=[12])
    average_score: float = Field(..., examples=[7.5])


class RecentSession(BaseModel):
    """Lightweight session summary for the activity feed."""

    id: str
    interview_type: str
    difficulty: str
    status: str
    started_at: Optional[str] = None


class AnalyticsResponse(BaseModel):
    """Aggregated statistics for the current user."""

    sessions_count: int = Field(
        ..., description="Total number of interview sessions", examples=[25]
    )
    completed_sessions: int = Field(..., examples=[20])
    in_progress_sessions: int = Field(..., examples=[5])
    total_questions_asked: int = Field(..., examples=[100])
    average_score: float = Field(
        ...,
        description="Mean feedback score across all evaluated answers (1-10)",
        examples=[7.2],
    )
    improvement_trend: str = Field(
        ...,
        description="improving, stable, or declining based on recent vs older scores",
        examples=["improving"],
    )
    by_type: List[PerformanceByType] = Field(default_factory=list)

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "sessions_count": 25,
                "completed_sessions": 20,
                "in_progress_sessions": 5,
                "total_questions_asked": 100,
                "average_score": 7.2,
                "improvement_trend": "improving",
                "by_type": [
                    {
                        "interview_type": "coding",
                        "total_feedbacks": 12,
                        "average_score": 7.5,
                    },
                    {
                        "interview_type": "behavioral",
                        "total_feedbacks": 8,
                        "average_score": 6.9,
                    },
                ],
            }
        }
    )


# ── Forward-reference rebuilds (Pydantic v2) ────────────────────────────────
InterviewSessionResponse.model_rebuild()
InterviewStartResponse.model_rebuild()
UserResponseOut.model_rebuild()
AnswerSubmitResponse.model_rebuild()
SessionFeedbackResponse.model_rebuild()
