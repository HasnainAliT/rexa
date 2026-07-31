"""Core REXA analysis routes: run analysis, list/get history."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import ApiHTTPException, get_current_user
from app.models import AnalysisRun, Question, Submission, User
from app.schemas import (
    AnalyzeRequest,
    AnalyzeResponseData,
    ApiResponse,
    PaginatedData,
    RexaResult,
)
from app.schemas import AnalysisRunOut
from app.services.rexa_pipeline import run_rexa_pipeline

router = APIRouter(tags=["analysis"])


def _resolve_question_context(
    db: Session,
    question_id: str | None,
    question_text: str | None,
    reference_answer: str | None,
    concepts: list[str] | None,
) -> tuple[Question | None, str, str, list[str]]:
    if question_id:
        question = db.query(Question).filter(Question.id == question_id).first()
        if not question:
            raise ApiHTTPException(status_code=404, detail="Question not found")
        return question, question.prompt, question.reference_answer, question.concepts or []

    return None, question_text or "", reference_answer or "", concepts or []


@router.post("/analyze", response_model=ApiResponse[AnalyzeResponseData])
def analyze(
    payload: AnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    question, question_text, reference_answer, concepts = _resolve_question_context(
        db, payload.question_id, payload.question_text, payload.reference_answer, payload.concepts
    )

    result_dict = run_rexa_pipeline(
        question_text=question_text,
        reference_answer=reference_answer,
        student_answer=payload.student_answer,
        concepts=concepts,
    )

    analysis_id = None
    submission_id = None

    if payload.save and question is None and question_text and reference_answer:
        # Ad-hoc question (no question_id given) - persist it so the
        # submission/analysis can be linked and shown in history.
        question = Question(
            title=question_text[:120],
            prompt=question_text,
            reference_answer=reference_answer,
            concepts=concepts,
            created_by=current_user.id,
        )
        db.add(question)
        db.flush()

    if payload.save and question is not None:
        submission = Submission(
            question_id=question.id,
            student_name=payload.student_name,
            answer_text=payload.student_answer,
            created_by=current_user.id,
        )
        db.add(submission)
        db.flush()

        analysis_run = AnalysisRun(
            submission_id=submission.id,
            question_id=question.id,
            user_id=current_user.id,
            result_json=result_dict,
            stars=result_dict["stars"],
            model_version=result_dict["model_version"],
        )
        db.add(analysis_run)
        db.commit()
        db.refresh(analysis_run)

        analysis_id = analysis_run.id
        submission_id = submission.id

    return ApiResponse(
        data=AnalyzeResponseData(
            analysis_id=analysis_id,
            submission_id=submission_id,
            question_id=question.id if question else None,
            result=RexaResult(**result_dict),
        ),
        success=True,
    )


@router.get("/analyses", response_model=ApiResponse[PaginatedData[AnalysisRunOut]])
def list_analyses(
    page: int = 1,
    pageSize: int = 20,
    question_id: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = db.query(AnalysisRun)
    if question_id:
        query = query.filter(AnalysisRun.question_id == question_id)

    total = query.count()
    page = max(page, 1)
    pageSize = max(min(pageSize, 100), 1)
    items = (
        query.order_by(AnalysisRun.created_at.desc())
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .all()
    )

    total_pages = (total + pageSize - 1) // pageSize if total else 0
    return ApiResponse(
        data=PaginatedData(
            data=[AnalysisRunOut.model_validate(a) for a in items],
            total=total,
            page=page,
            pageSize=pageSize,
            totalPages=total_pages,
        ),
        success=True,
    )


@router.get("/analyses/{analysis_id}", response_model=ApiResponse[AnalysisRunOut])
def get_analysis(analysis_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    analysis_run = db.query(AnalysisRun).filter(AnalysisRun.id == analysis_id).first()
    if not analysis_run:
        raise ApiHTTPException(status_code=404, detail="Analysis not found")
    return ApiResponse(data=AnalysisRunOut.model_validate(analysis_run), success=True)
