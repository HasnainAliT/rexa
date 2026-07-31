"""Question bank CRUD routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import ApiHTTPException, get_current_user, require_admin_or_analyst
from app.models import Question, User
from app.schemas import ApiResponse, PaginatedData, QuestionCreate, QuestionOut, QuestionUpdate

router = APIRouter(prefix="/questions", tags=["questions"])


@router.get("", response_model=ApiResponse[PaginatedData[QuestionOut]])
def list_questions(
    page: int = 1,
    pageSize: int = 20,
    search: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
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
            data=[QuestionOut.model_validate(q) for q in items],
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
    current_user: User = Depends(require_admin_or_analyst),
):
    question = Question(
        title=payload.title,
        prompt=payload.prompt,
        reference_answer=payload.reference_answer,
        concepts=payload.concepts,
        course=payload.course,
        created_by=current_user.id,
    )
    db.add(question)
    db.commit()
    db.refresh(question)
    return ApiResponse(data=QuestionOut.model_validate(question), success=True)


@router.get("/{question_id}", response_model=ApiResponse[QuestionOut])
def get_question(question_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise ApiHTTPException(status_code=404, detail="Question not found")
    return ApiResponse(data=QuestionOut.model_validate(question), success=True)


@router.put("/{question_id}", response_model=ApiResponse[QuestionOut])
def update_question(
    question_id: str,
    payload: QuestionUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_analyst),
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise ApiHTTPException(status_code=404, detail="Question not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(question, field, value)

    db.commit()
    db.refresh(question)
    return ApiResponse(data=QuestionOut.model_validate(question), success=True)


@router.delete("/{question_id}", response_model=ApiResponse[None])
def delete_question(
    question_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin_or_analyst),
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise ApiHTTPException(status_code=404, detail="Question not found")

    db.delete(question)
    db.commit()
    return ApiResponse(data=None, success=True, message="Question deleted")
