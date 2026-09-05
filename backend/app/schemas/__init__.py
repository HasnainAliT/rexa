"""Pydantic schemas for request/response validation."""
from datetime import datetime
from typing import Any, Generic, List, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

# ---------------------------------------------------------------------------
# Generic envelope - MUST match frontend's ApiResponse<T>
# ---------------------------------------------------------------------------

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    data: Optional[T] = None
    message: Optional[str] = None
    success: bool = True


class PaginatedData(BaseModel, Generic[T]):
    data: List[T]
    total: int
    page: int
    pageSize: int
    totalPages: int


# ---------------------------------------------------------------------------
# Auth / User
# ---------------------------------------------------------------------------

UserRole = str  # "admin" | "teacher" | "student"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)

    id: str
    email: str
    name: str
    avatarUrl: Optional[str] = Field(default=None, validation_alias="avatar_url")
    role: str
    rollNumber: Optional[str] = Field(default=None, validation_alias="roll_number")

    @classmethod
    def from_orm_user(cls, user: Any) -> "UserOut":
        return cls(
            id=user.id,
            email=user.email,
            name=user.name,
            avatarUrl=user.avatar_url,
            role=user.role,
            rollNumber=getattr(user, "roll_number", None),
        )


class UserListItem(BaseModel):
    id: str
    name: str
    email: str
    role: str
    rollNumber: Optional[str] = None
    createdAt: datetime

    @classmethod
    def from_user(cls, user: Any) -> "UserListItem":
        return cls(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role,
            rollNumber=getattr(user, "roll_number", None),
            createdAt=user.created_at,
        )


class UserRoleUpdate(BaseModel):
    role: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    role: str = "student"

    @model_validator(mode="after")
    def role_is_allowed(self) -> "LoginRequest":
        role = (self.role or "student").strip().lower()
        if role not in {"teacher", "student"}:
            raise ValueError("Role must be teacher or student")
        self.role = role
        return self


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    confirmPassword: Optional[str] = None
    role: str = "student"
    roll_number: Optional[str] = None
    institution_code: Optional[str] = None

    @model_validator(mode="after")
    def passwords_match(self) -> "RegisterRequest":
        if self.confirmPassword is not None and self.password != self.confirmPassword:
            raise ValueError("Passwords do not match")
        return self


class AuthData(BaseModel):
    user: UserOut
    token: str


# ---------------------------------------------------------------------------
# Questions
# ---------------------------------------------------------------------------


class QuestionBase(BaseModel):
    title: str
    prompt: str
    reference_answer: Optional[str] = Field(default="")
    concepts: List[str] = Field(default_factory=list)
    course: Optional[str] = None
    difficulty: Optional[str] = None

    @field_validator("reference_answer", mode="before")
    @classmethod
    def coerce_reference_answer(cls, value: Any) -> str:
        return value or ""


class QuestionCreate(QuestionBase):
    pass


class QuestionUpdate(BaseModel):
    title: Optional[str] = None
    prompt: Optional[str] = None
    reference_answer: Optional[str] = None
    concepts: Optional[List[str]] = None
    course: Optional[str] = None
    difficulty: Optional[str] = None


class QuestionOut(QuestionBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    created_by: Optional[str] = None
    created_at: datetime


class QuestionStudentOut(BaseModel):
    """Question payload for students — no answer key, no concept list."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    title: str
    prompt: str
    course: Optional[str] = None
    difficulty: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime


# ---------------------------------------------------------------------------
# REXA analysis
# ---------------------------------------------------------------------------


class AnalyzeRequest(BaseModel):
    question_id: Optional[str] = None
    question_text: Optional[str] = None
    reference_answer: Optional[str] = None
    concepts: Optional[List[str]] = None
    student_answer: str
    student_name: Optional[str] = None
    student_id: Optional[str] = None
    save: bool = True

    @model_validator(mode="after")
    def check_question_source(self) -> "AnalyzeRequest":
        if not self.question_id and not self.question_text:
            raise ValueError(
                "Either question_id or question_text must be provided"
            )
        return self


class SentenceHighlight(BaseModel):
    index: int
    text: str
    role: str
    start: int
    end: int
    reason: Optional[str] = None
    confidence: Optional[float] = None


class SupportPair(BaseModel):
    source_index: int
    target_index: int
    source_text: str
    target_text: str
    relation: str  # Supports | Neutral | Contradicts
    cue: Optional[str] = None


class ConceptCoverage(BaseModel):
    covered: List[str]
    missing: List[str]
    coverage_pct: float
    matches: dict[str, List[str]] = Field(default_factory=dict)


class DimensionScores(BaseModel):
    concept_coverage: float
    reasoning_depth: float
    support_quality: float
    role_structure: float


class Explanation(BaseModel):
    type: str
    message: str
    severity: str  # info | warning | success


class RexaResult(BaseModel):
    stars: float
    dimension_scores: DimensionScores
    concept_coverage: ConceptCoverage
    highlights: List[SentenceHighlight]
    support_pairs: List[SupportPair]
    reasoning_depth: float
    explanations: List[Explanation]
    model_version: str
    question_text: str
    reference_answer: Optional[str] = None
    student_answer: str


class AnalyzeResponseData(BaseModel):
    analysis_id: Optional[str] = None
    submission_id: Optional[str] = None
    question_id: Optional[str] = None
    result: RexaResult


class PdfExamItem(BaseModel):
    question_text: str
    matched_from_bank: bool = False
    note: Optional[str] = None
    analysis: AnalyzeResponseData


class PdfExamAnalyzeData(BaseModel):
    filename: str
    items: List[PdfExamItem]


class AnalysisRunOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    submission_id: str
    question_id: str
    user_id: Optional[str] = None
    result_json: dict
    stars: float
    model_version: str
    created_at: datetime
    student_name: Optional[str] = None
    student_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Annotations
# ---------------------------------------------------------------------------


class AnnotationBase(BaseModel):
    submission_id: Optional[str] = None
    analysis_id: Optional[str] = None
    sentence_roles: List[dict] = Field(default_factory=list)
    concepts_present: List[str] = Field(default_factory=list)
    support_pairs: List[dict] = Field(default_factory=list)
    depth_score: Optional[float] = None
    star_label: Optional[int] = None
    notes: Optional[str] = None


class AnnotationCreate(AnnotationBase):
    @model_validator(mode="after")
    def require_target(self) -> "AnnotationCreate":
        if not self.submission_id and not self.analysis_id:
            raise ValueError("Either submission_id or analysis_id is required")
        return self


class AnnotationUpdate(BaseModel):
    sentence_roles: Optional[List[dict]] = None
    concepts_present: Optional[List[str]] = None
    support_pairs: Optional[List[dict]] = None
    depth_score: Optional[float] = None
    star_label: Optional[int] = None
    notes: Optional[str] = None


class AnnotationOut(AnnotationBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: Optional[str] = None
    created_at: datetime


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------


class RecentAnalysisItem(BaseModel):
    id: str
    question_title: str
    student_name: Optional[str] = None
    stars: Optional[float] = None
    coverage: Optional[float] = None
    depth: Optional[float] = None
    created_at: datetime


class CoverageTrendPoint(BaseModel):
    date: str
    avg_coverage: float
    avg_stars: Optional[float] = None
    avg_depth: Optional[float] = None
    count: int = 0


class RoleDistributionItem(BaseModel):
    role: str
    count: int


class RoleSentenceItem(BaseModel):
    analysisId: str
    questionTitle: str
    studentName: Optional[str] = None
    text: str
    role: str
    confidence: Optional[float] = None
    reason: Optional[str] = None


class DashboardBand(BaseModel):
    label: str
    count: int
    percent: float


class DashboardStats(BaseModel):
    totalAnalyses: int
    avgStars: Optional[float] = None
    avgCoverage: float = 0
    avgDepth: Optional[float] = None
    totalQuestions: int
    totalSubmissions: int
    analysesThisWeek: int = 0
    starBands: Optional[List[DashboardBand]] = None
    coverageBands: Optional[List[DashboardBand]] = None
    recentAnalyses: List[RecentAnalysisItem]
    coverageTrend: List[CoverageTrendPoint]
    roleDistribution: List[RoleDistributionItem]
    roleSentences: List[RoleSentenceItem] = Field(default_factory=list)
    empty: bool = False


# ---------------------------------------------------------------------------
# Batch / Compare
# ---------------------------------------------------------------------------


class BatchAnswerItem(BaseModel):
    student_name: Optional[str] = None
    student_id: Optional[str] = None
    student_answer: str


class BatchAnalyzeRequest(BaseModel):
    question_id: Optional[str] = None
    question_text: Optional[str] = None
    reference_answer: Optional[str] = None
    concepts: Optional[List[str]] = None
    answers: List[BatchAnswerItem]
    save: bool = True

    @model_validator(mode="after")
    def check_question_source(self) -> "BatchAnalyzeRequest":
        if not self.question_id and not self.question_text:
            raise ValueError(
                "Either question_id or question_text must be provided"
            )
        return self


class CompareRequest(BaseModel):
    question_id: Optional[str] = None
    question_text: Optional[str] = None
    reference_answer: Optional[str] = None
    concepts: Optional[List[str]] = None
    answer_a: str
    answer_b: str
    student_name_a: Optional[str] = None
    student_name_b: Optional[str] = None


class CompareResponseData(BaseModel):
    result_a: RexaResult
    result_b: RexaResult
    diff_summary: List[str]


# ---------------------------------------------------------------------------
# Model versions (admin)
# ---------------------------------------------------------------------------


class ModelVersionBase(BaseModel):
    name: str
    version: str
    description: Optional[str] = None
    metrics_json: dict = Field(default_factory=dict)


class ModelVersionCreate(ModelVersionBase):
    pass


class ModelVersionOut(ModelVersionBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    is_active: bool
    created_at: datetime


# ---------------------------------------------------------------------------
# Baselines
# ---------------------------------------------------------------------------


class BaselineResult(BaseModel):
    name: str
    score: float
    predicted_stars: float
    details: dict = Field(default_factory=dict)


class BaselineEvaluationData(BaseModel):
    question_text: str
    reference_answer: Optional[str] = None
    student_answer: str
    rexa_stars: float
    baselines: List[BaselineResult]


class PdfExtractData(BaseModel):
    filename: str
    page_count: int
    text: str


class ClassReportRow(BaseModel):
    student_name: str = ""
    student_id: str = ""
    class_name: str = ""
    question: str = ""
    role_coverage: float = 0
    concept_coverage: float = 0
    depth: float = 0
    stars: float = 0
    overall: float = 0
    status: str = ""


class ClassReportExport(BaseModel):
    rows: List[ClassReportRow]
    title: str = "RExA class report"
