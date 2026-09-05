"""Batch analysis, answer comparison, and baseline evaluation routes."""
from fastapi import APIRouter, Depends, File, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import ApiHTTPException, require_teacher
from app.models import AnalysisRun, Question, Submission, User
from app.schemas import (
    ApiResponse,
    BaselineEvaluationData,
    BaselineResult,
    BatchAnalyzeRequest,
    CompareRequest,
    CompareResponseData,
    RexaResult,
)
from app.services.baselines import run_all_baselines
from app.services.rexa_pipeline import run_rexa_pipeline
from app.services.spreadsheet_parse import parse_tabular_bytes

router = APIRouter(tags=["batch"])


@router.post("/batch/parse-upload")
async def parse_batch_upload(
    file: UploadFile = File(...),
    _: User = Depends(require_teacher),
):
    filename = file.filename or "roster.csv"
    lowered = filename.lower()
    if not lowered.endswith((".csv", ".txt", ".xlsx", ".xlsm", ".xls")):
        raise ApiHTTPException(
            status_code=400,
            detail="Upload a CSV or Excel (.xlsx) file exported from your online test.",
        )
    data = await file.read()
    try:
        parsed = parse_tabular_bytes(data, filename)
    except ValueError as exc:
        raise ApiHTTPException(status_code=400, detail=str(exc)) from exc
    return ApiResponse(data=parsed, success=True)


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


@router.post("/batch/analyze", response_model=ApiResponse[list[dict]])
def batch_analyze(
    payload: BatchAnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    question, question_text, reference_answer, concepts = _resolve_question_context(
        db, payload.question_id, payload.question_text, payload.reference_answer, payload.concepts
    )

    if payload.save and question is None and question_text:
        question = Question(
            title=question_text[:120],
            prompt=question_text,
            reference_answer=reference_answer or "",
            concepts=concepts,
            created_by=current_user.id,
        )
        db.add(question)
        db.flush()

    results = []
    for item in payload.answers:
        try:
            result_dict = run_rexa_pipeline(
                question_text=question_text,
                reference_answer=reference_answer,
                student_answer=item.student_answer,
                concepts=concepts,
            )
        except Exception as exc:  # noqa: BLE001 — isolate one student failure
            results.append(
                {
                    "analysis_id": None,
                    "submission_id": None,
                    "question_id": question.id if question else None,
                    "student_name": item.student_name,
                    "student_id": item.student_id,
                    "error": str(exc),
                    "result": None,
                }
            )
            continue

        analysis_id = None
        submission_id = None

        if payload.save and question is not None:
            submission = Submission(
                question_id=question.id,
                student_name=item.student_name,
                student_id=getattr(item, "student_id", None),
                answer_text=item.student_answer,
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
            db.flush()

            analysis_id = analysis_run.id
            submission_id = submission.id

        results.append(
            {
                "analysis_id": analysis_id,
                "submission_id": submission_id,
                "question_id": question.id if question else None,
                "student_name": item.student_name,
                "student_id": item.student_id,
                "result": result_dict,
            }
        )

    if payload.save:
        db.commit()

    return ApiResponse(data=results, success=True)


@router.post("/compare", response_model=ApiResponse[CompareResponseData])
def compare_answers(
    payload: CompareRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher),
):
    question, question_text, reference_answer, concepts = _resolve_question_context(
        db, payload.question_id, payload.question_text, payload.reference_answer, payload.concepts
    )

    result_a = run_rexa_pipeline(question_text, reference_answer, payload.answer_a, concepts)
    result_b = run_rexa_pipeline(question_text, reference_answer, payload.answer_b, concepts)

    diff_summary: list[str] = []
    star_diff = round(result_a["stars"] - result_b["stars"], 2)
    if star_diff > 0:
        diff_summary.append(f"Answer A scores {star_diff} stars higher than Answer B.")
    elif star_diff < 0:
        diff_summary.append(f"Answer B scores {abs(star_diff)} stars higher than Answer A.")
    else:
        diff_summary.append("Both answers received the same star rating.")

    cov_a = result_a["concept_coverage"]["coverage_pct"]
    cov_b = result_b["concept_coverage"]["coverage_pct"]
    if cov_a != cov_b:
        better = "A" if cov_a > cov_b else "B"
        diff_summary.append(f"Answer {better} has higher concept coverage ({max(cov_a, cov_b)}% vs {min(cov_a, cov_b)}%).")

    depth_a = result_a["reasoning_depth"]
    depth_b = result_b["reasoning_depth"]
    if depth_a != depth_b:
        better = "A" if depth_a > depth_b else "B"
        diff_summary.append(f"Answer {better} demonstrates deeper reasoning.")

    return ApiResponse(
        data=CompareResponseData(
            result_a=RexaResult(**result_a),
            result_b=RexaResult(**result_b),
            diff_summary=diff_summary,
        ),
        success=True,
    )


@router.get("/baselines/evaluate", response_model=ApiResponse[BaselineEvaluationData])
def evaluate_baselines(
    question_id: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher),
):
    """Runs classical baseline scoring methods against a sample question and
    the reference answer of the most recent submission (or the reference
    answer itself if no submissions exist), for comparison against REXA.
    """
    question = None
    if question_id:
        question = db.query(Question).filter(Question.id == question_id).first()
        if not question:
            raise ApiHTTPException(status_code=404, detail="Question not found")
    else:
        question = db.query(Question).order_by(Question.created_at.desc()).first()

    if not question:
        raise ApiHTTPException(
            status_code=404,
            detail="No questions available to evaluate. Create a question first.",
        )

    submission = (
        db.query(Submission)
        .filter(Submission.question_id == question.id)
        .order_by(Submission.created_at.desc())
        .first()
    )
    student_answer = submission.answer_text if submission else (question.reference_answer or "")

    rexa_result = run_rexa_pipeline(
        question_text=question.prompt,
        reference_answer=question.reference_answer or "",
        student_answer=student_answer or "",
        concepts=question.concepts or [],
    )

    reference = (question.reference_answer or "").strip()
    baseline_dicts = (
        run_all_baselines(question.reference_answer, student_answer)
        if reference
        else []
    )

    return ApiResponse(
        data=BaselineEvaluationData(
            question_text=question.prompt,
            reference_answer=question.reference_answer or "",
            student_answer=student_answer,
            rexa_stars=rexa_result["stars"],
            baselines=[BaselineResult(**b) for b in baseline_dicts],
        ),
        success=True,
    )
