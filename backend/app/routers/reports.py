"""Report generation routes: PDF and Markdown exports for an analysis run."""
from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import ApiHTTPException, get_current_user, is_teacher, normalized_roll, require_teacher_or_admin
from app.models import AnalysisRun, Question, Submission, User
from app.schemas import ClassReportExport
from app.services.class_export import generate_class_pdf, generate_class_xlsx
from app.services.reports import generate_markdown_report, generate_pdf_report

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("/class/xlsx")
def download_class_xlsx(
    payload: ClassReportExport,
    _: User = Depends(require_teacher_or_admin),
):
    content = generate_class_xlsx(
        [row.model_dump() for row in payload.rows],
        title=payload.title,
    )
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="rexa-class-report.xlsx"'},
    )


@router.post("/class/pdf")
def download_class_pdf(
    payload: ClassReportExport,
    _: User = Depends(require_teacher_or_admin),
):
    content = generate_class_pdf(
        [row.model_dump() for row in payload.rows],
        title=payload.title,
    )
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="rexa-class-report.pdf"'},
    )


def _load_report_context(db: Session, analysis_id: str, user: User):
    analysis_run = db.query(AnalysisRun).filter(AnalysisRun.id == analysis_id).first()
    if not analysis_run:
        raise ApiHTTPException(status_code=404, detail="Analysis not found")
    if not is_teacher(user):
        owns = analysis_run.user_id == user.id
        roll = normalized_roll(user)
        if not owns and roll:
            submission = db.query(Submission).filter(Submission.id == analysis_run.submission_id).first()
            owns = bool(submission and (submission.student_id or "").strip().upper() == roll)
        if not owns:
            raise ApiHTTPException(status_code=404, detail="Analysis not found")

    question = db.query(Question).filter(Question.id == analysis_run.question_id).first()
    submission = db.query(Submission).filter(Submission.id == analysis_run.submission_id).first()

    question_title = question.title if question else "Untitled Question"
    student_name = submission.student_name if submission else None

    return analysis_run, question_title, student_name


@router.post("/{analysis_id}/pdf")
def download_pdf_report(
    analysis_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    analysis_run, question_title, student_name = _load_report_context(
        db, analysis_id, current_user
    )

    pdf_bytes = generate_pdf_report(
        analysis_id=analysis_run.id,
        question_title=question_title,
        student_name=student_name,
        result=analysis_run.result_json,
        created_at=analysis_run.created_at,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="earas-report-{analysis_id}.pdf"'},
    )


@router.get("/{analysis_id}/markdown")
def download_markdown_report(
    analysis_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    analysis_run, question_title, student_name = _load_report_context(
        db, analysis_id, current_user
    )

    markdown_text = generate_markdown_report(
        analysis_id=analysis_run.id,
        question_title=question_title,
        student_name=student_name,
        result=analysis_run.result_json,
        created_at=analysis_run.created_at,
    )

    return Response(
        content=markdown_text,
        media_type="text/markdown",
        headers={"Content-Disposition": f'attachment; filename="earas-report-{analysis_id}.md"'},
    )
