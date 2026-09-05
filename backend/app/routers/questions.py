"""Question bank CRUD routes."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import ApiHTTPException, get_current_user, is_student, require_teacher_or_admin
from app.models import Question, User
from app.schemas import (
    ApiResponse,
    PaginatedData,
    QuestionCreate,
    QuestionOut,
    QuestionStudentOut,
    QuestionUpdate,
)

router = APIRouter(prefix="/questions", tags=["questions"])


def _serialize_question(question: Question, user: User):
    if is_student(user):
        return QuestionStudentOut.model_validate(question)
    return QuestionOut.model_validate(question)


@router.get("")
def list_questions(
    page: int = 1,
    pageSize: int = 20,
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Question)
    if search:
        like = f"%{search}%"
        query = query.filter(Question.title.ilike(like))

    total = query.count()
    page = max(page, 1)
    pageSize = max(min(pageSize, 100), 1)
    items = (
        query.order_by(Question.created_at.desc())
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .all()
    )

    total_pages = (total + pageSize - 1) // pageSize if total else 0
    return ApiResponse(
        data=PaginatedData(
            data=[_serialize_question(q, current_user) for q in items],
            total=total,
            page=page,
            pageSize=pageSize,
            totalPages=total_pages,
        ),
        success=True,
    )


@router.post("", response_model=ApiResponse[QuestionOut], status_code=201)
def create_question(
    payload: QuestionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher_or_admin),
):
    question = Question(
        title=payload.title,
        prompt=payload.prompt,
        reference_answer=payload.reference_answer or "",
        concepts=payload.concepts,
        course=payload.course,
        difficulty=payload.difficulty or "medium",
        created_by=current_user.id,
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return ApiResponse(data=QuestionOut.model_validate(question), success=True)


@router.get("/{question_id}")
def get_question(
    question_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise ApiHTTPException(status_code=404, detail="Question not found")
    return ApiResponse(data=_serialize_question(question, current_user), success=True)


@router.put("/{question_id}", response_model=ApiResponse[QuestionOut])
def update_question(
    question_id: str,
    payload: QuestionUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin),
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise ApiHTTPException(status_code=404, detail="Question not found")

    update_data = payload.model_dump(exclude_unset=True)
    if "reference_answer" in update_data:
        update_data["reference_answer"] = update_data["reference_answer"] or ""
    for field, value in update_data.items():
        setattr(question, field, value)

    db.commit()
    db.refresh(question)
    return ApiResponse(data=QuestionOut.model_validate(question), success=True)


@router.delete("/{question_id}", response_model=ApiResponse[None])
def delete_question(
    question_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin),
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise ApiHTTPException(status_code=404, detail="Question not found")

    db.delete(question)
    db.commit()
    return ApiResponse(data=None, success=True, message="Question deleted")
