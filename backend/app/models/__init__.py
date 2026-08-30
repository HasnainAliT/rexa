"""SQLAlchemy ORM models for RExA."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="viewer")
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    questions: Mapped[list["Question"]] = relationship(back_populates="creator")
    submissions: Mapped[list["Submission"]] = relationship(back_populates="creator")
    analysis_runs: Mapped[list["AnalysisRun"]] = relationship(back_populates="user")
    annotations: Mapped[list["Annotation"]] = relationship(back_populates="user")


class Question(Base):
    __tablename__ = "questions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    reference_answer: Mapped[str] = mapped_column(Text, nullable=False)
    concepts: Mapped[list] = mapped_column(JSON, default=list)
    course: Mapped[str | None] = mapped_column(String(255), nullable=True)
    difficulty: Mapped[str | None] = mapped_column(String(20), nullable=True, default="medium")
    created_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    creator: Mapped["User | None"] = relationship(back_populates="questions")
    submissions: Mapped[list["Submission"]] = relationship(back_populates="question", cascade="all, delete-orphan")
    analysis_runs: Mapped[list["AnalysisRun"]] = relationship(back_populates="question")


class Submission(Base):
    __tablename__ = "submissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    question_id: Mapped[str] = mapped_column(String(36), ForeignKey("questions.id"), nullable=False)
    student_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    student_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    answer_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_by: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    question: Mapped["Question"] = relationship(back_populates="submissions")
    creator: Mapped["User | None"] = relationship(back_populates="submissions")
    analysis_runs: Mapped[list["AnalysisRun"]] = relationship(back_populates="submission", cascade="all, delete-orphan")
    annotations: Mapped[list["Annotation"]] = relationship(back_populates="submission", cascade="all, delete-orphan")


class AnalysisRun(Base):
    __tablename__ = "analysis_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    submission_id: Mapped[str] = mapped_column(String(36), ForeignKey("submissions.id"), nullable=False)
    question_id: Mapped[str] = mapped_column(String(36), ForeignKey("questions.id"), nullable=False)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    result_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    stars: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    model_version: Mapped[str] = mapped_column(String(100), default="heuristic-v1")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    submission: Mapped["Submission"] = relationship(back_populates="analysis_runs")
    question: Mapped["Question"] = relationship(back_populates="analysis_runs")
    user: Mapped["User | None"] = relationship(back_populates="analysis_runs")


class Annotation(Base):
    __tablename__ = "annotations"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    submission_id: Mapped[str] = mapped_column(String(36), ForeignKey("submissions.id"), nullable=False)
    user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    sentence_roles: Mapped[list] = mapped_column(JSON, default=list)
    concepts_present: Mapped[list] = mapped_column(JSON, default=list)
    support_pairs: Mapped[list] = mapped_column(JSON, default=list)
    depth_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    star_label: Mapped[int | None] = mapped_column(Integer, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    submission: Mapped["Submission"] = relationship(back_populates="annotations")
    user: Mapped["User | None"] = relationship(back_populates="annotations")


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    metrics_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
