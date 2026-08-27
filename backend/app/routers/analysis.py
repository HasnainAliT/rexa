"""Core REXA analysis routes: run analysis, list/get history."""
from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import ApiHTTPException, get_current_user
from app.models import AnalysisRun, Question, Submission, User
from app.schemas import (
    AnalyzeRequest,
    AnalyzeResponseData,
    ApiResponse,
    PaginatedData,
    PdfExtractData,
    PdfExamAnalyzeData,
    PdfExamItem,
    RexaResult,
)
from app.schemas import AnalysisRunOut
from app.services.pdf_exam_parser import fallback_single_answer, match_bank_question, parse_exam_text
from app.services.pdf_extract import extract_pdf_text
from app.services.rexa_pipeline import run_rexa_pipeline

router = APIRouter(tags=["analysis"])


def _analysis_run_out(db: Session, run: AnalysisRun) -> AnalysisRunOut:
    out = AnalysisRunOut.model_validate(run)
    submission = db.query(Submission).filter(Submission.id == run.submission_id).first()
    if submission:
        out.student_name = getattr(submission, "student_name", None)
        out.student_id = getattr(submission, "student_id", None)
    return out


@router.post("/extract-pdf", response_model=ApiResponse[PdfExtractData])
async def extract_pdf(
    file: UploadFile = File(...),
    _: User = Depends(get_current_user),
):
    filename = file.filename or "answer.pdf"
    if not filename.lower().endswith(".pdf"):
        raise ApiHTTPException(status_code=400, detail="Please upload a PDF file.")

    data = await file.read()
    try:
        text, page_count = extract_pdf_text(data, filename)
    except ValueError as exc:
        raise ApiHTTPException(status_code=400, detail=str(exc)) from exc

    return ApiResponse(
        data=PdfExtractData(filename=filename, page_count=page_count, text=text),
        success=True,
    )


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


def _run_and_save(
    db: Session,
    current_user: User,
    question: Question | None,
    question_text: str,
    reference_answer: str,
    concepts: list[str],
    student_answer: str,
    student_name: str | None = None,
    student_id: str | None = None,
    save: bool = True,
) -> AnalyzeResponseData:
    result_dict = run_rexa_pipeline(
        question_text=question_text,
        reference_answer=reference_answer,
        student_answer=student_answer,
        concepts=concepts,
    )

    analysis_id = None
    submission_id = None

    if save and question is None and question_text and (reference_answer or student_answer):
        question = Question(
            title=question_text[:120],
            prompt=question_text,
            reference_answer=reference_answer or student_answer[:400],
            concepts=concepts,
            created_by=current_user.id,
        )
        db.add(question)
        db.flush()

    if save and question is not None:
        submission = Submission(
            question_id=question.id,
            student_name=student_name,
            student_id=student_id,
            answer_text=student_answer,
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

    return AnalyzeResponseData(
        analysis_id=analysis_id,
        submission_id=submission_id,
        question_id=question.id if question else None,
        result=RexaResult(**result_dict),
    )


@router.post("/analyze-pdf", response_model=ApiResponse[PdfExamAnalyzeData])
async def analyze_pdf(
    file: UploadFile = File(...),
    question_id: str | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    filename = file.filename or "exam.pdf"
    if not filename.lower().endswith(".pdf"):
        raise ApiHTTPException(status_code=400, detail="Please upload a PDF file.")

    data = await file.read()
    try:
        text, _page_count = extract_pdf_text(data, filename)
    except ValueError as exc:
        raise ApiHTTPException(status_code=400, detail=str(exc)) from exc

    bank_rows = db.query(Question).all()
    bank = [
        (q.id, q.prompt, q.reference_answer, q.concepts or [])
        for q in bank_rows
    ]

    pairs = parse_exam_text(text)
    if not pairs:
        pairs = [fallback_single_answer(text)]

    items: list[PdfExamItem] = []
    selected = None
    if question_id:
        selected = db.query(Question).filter(Question.id == question_id).first()
        if selected is None:
            raise ApiHTTPException(status_code=404, detail="Question not found")

    for pair in pairs:
        question: Question | None = None
        q_text = pair.question_text.strip()
        answer = pair.student_answer.strip()
        reference = pair.reference_answer.strip()
        concepts = list(pair.concepts)
        matched = False
        note = None

        if selected is not None and not q_text:
            question = selected
            q_text = selected.prompt
            reference = selected.reference_answer
            concepts = selected.concepts or []
            matched = True
            note = "Used the question you selected; the PDF was treated as the student answer."
        elif q_text:
            hit = match_bank_question(q_text, bank)
            if hit:
                qid, prompt, ref, cons = hit
                question = db.query(Question).filter(Question.id == qid).first()
                q_text = prompt
                if not reference:
                    reference = ref
                if not concepts:
                    concepts = cons
                matched = True
                note = "Matched a question from your question bank."
            elif not reference:
                note = "Read the question and answer from the PDF."
        elif selected is None:
            raise ApiHTTPException(
                status_code=400,
                detail=(
                    "Could not find a question in this PDF. Add headings like "
                    "'Question:' and 'Answer:', or pick a question from the bank first."
                ),
            )

        if not answer:
            continue

        analysis = _run_and_save(
            db,
            current_user,
            question,
            q_text,
            reference,
            concepts,
            answer,
            student_name=filename,
            save=True,
        )
        items.append(
            PdfExamItem(
                question_text=q_text,
                matched_from_bank=matched,
                note=note,
                analysis=analysis,
            )
        )

    if not items:
        raise ApiHTTPException(status_code=400, detail="No student answer text was found in this PDF.")

    return ApiResponse(
        data=PdfExamAnalyzeData(filename=filename, items=items),
        success=True,
    )


@router.post("/analyze", response_model=ApiResponse[AnalyzeResponseData])
def analyze(
    payload: AnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    question, question_text, reference_answer, concepts = _resolve_question_context(
        db, payload.question_id, payload.question_text, payload.reference_answer, payload.concepts
    )
    data = _run_and_save(
        db,
        current_user,
        question,
        question_text,
        reference_answer,
        concepts,
        payload.student_answer,
        student_name=payload.student_name,
        student_id=payload.student_id,
        save=payload.save,
    )
    return ApiResponse(data=data, success=True)


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
            data=[_analysis_run_out(db, a) for a in items],
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
    return ApiResponse(data=_analysis_run_out(db, analysis_run), success=True)
