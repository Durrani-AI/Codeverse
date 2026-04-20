"""
SQLAlchemy ORM models.

Models:
    User             - registered platform users
    InterviewSession - a single interview attempt
    Question         - a question posed during a session
    UserResponse     - candidate's answer to a question
    Feedback         - evaluation feedback on a response
"""

import enum
import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SQLEnum,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.database import Base


def generate_uuid() -> str:
    """Return a new UUID-4 as a string (portable across all DB backends)."""
    return str(uuid.uuid4())


# --- Enum types ---

class InterviewType(str, enum.Enum):
    CODING = "coding"
    BEHAVIORAL = "behavioral"
    SYSTEM_DESIGN = "system_design"


class DifficultyLevel(str, enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class SessionStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"


class QuestionType(str, enum.Enum):
    CODING = "coding"
    BEHAVIORAL = "behavioral"
    SYSTEM_DESIGN = "system_design"
    MULTIPLE_CHOICE = "multiple_choice"
    FREE_RESPONSE = "free_response"


# --- Models ---

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    profile_picture = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    sessions = relationship(
        "InterviewSession", back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User id={self.id!r} username={self.username!r}>"


class InterviewSession(Base):
    __tablename__ = "interview_sessions"
    __table_args__ = (
        Index("ix_session_user_status", "user_id", "status"),
        Index("ix_session_started", "started_at"),
    )

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    interview_type = Column(
        SQLEnum(InterviewType), default=InterviewType.CODING, nullable=False
    )
    difficulty_level = Column(
        SQLEnum(DifficultyLevel), default=DifficultyLevel.MEDIUM, nullable=False
    )
    status = Column(
        SQLEnum(SessionStatus), default=SessionStatus.IN_PROGRESS, nullable=False
    )
    topic = Column(String(255), nullable=True)
    programming_language = Column(String(50), nullable=True)
    started_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="sessions")
    questions = relationship(
        "Question", back_populates="session", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<InterviewSession id={self.id!r} status={self.status!r}>"


class Question(Base):
    __tablename__ = "questions"
    __table_args__ = (
        Index("ix_question_session", "session_id"),
    )

    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(
        String(36),
        ForeignKey("interview_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    question_text = Column(Text, nullable=False)
    question_type = Column(
        SQLEnum(QuestionType), default=QuestionType.CODING, nullable=False
    )
    asked_at = Column(DateTime, default=func.now(), nullable=False)

    session = relationship("InterviewSession", back_populates="questions")
    responses = relationship(
        "UserResponse", back_populates="question", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Question id={self.id!r} type={self.question_type!r}>"


class UserResponse(Base):
    __tablename__ = "user_responses"
    __table_args__ = (
        Index("ix_response_question", "question_id"),
    )

    id = Column(String(36), primary_key=True, default=generate_uuid)
    question_id = Column(
        String(36),
        ForeignKey("questions.id", ondelete="CASCADE"),
        nullable=False,
    )
    response_text = Column(Text, nullable=False)
    response_code = Column(Text, nullable=True)
    submitted_at = Column(DateTime, default=func.now(), nullable=False)

    question = relationship("Question", back_populates="responses")
    feedback = relationship(
        "Feedback", back_populates="response", uselist=False, cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<UserResponse id={self.id!r}>"


class Feedback(Base):
    __tablename__ = "feedbacks"
    __table_args__ = (
        Index("ix_feedback_response", "response_id"),
    )

    id = Column(String(36), primary_key=True, default=generate_uuid)
    response_id = Column(
        String(36),
        ForeignKey("user_responses.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    ai_feedback_text = Column(Text, nullable=False)
    score = Column(Integer, nullable=False)
    strengths = Column(JSON, nullable=True)
    improvements = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=func.now(), nullable=False)

    response = relationship("UserResponse", back_populates="feedback")

    def __repr__(self) -> str:
        return f"<Feedback id={self.id!r} score={self.score}>"
