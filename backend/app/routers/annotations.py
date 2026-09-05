"""Annotation Lab routes: human-labeled ground truth for submissions."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import ApiHTTPException, require_teacher_or_admin
from app.models import AnalysisRun, Annotation, Submission, User
from app.schemas import AnnotationCreate, AnnotationOut, AnnotationUpdate, ApiResponse, PaginatedData

router = APIRouter(prefix="/annotations", tags=["annotations"])


@router.get("", response_model=ApiResponse[PaginatedData[AnnotationOut]])
def list_annotations(
    page: int = 1,
    pageSize: int = 20,
    submission_id: str | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin),
):
    query = db.query(Annotation)
    if submission_id:
        query = query.filter(Annotation.submission_id == submission_id)

    total = query.count()
    page = max(page, 1)
    pageSize = max(min(pageSize, 100), 1)
    items = (
        query.order_by(Annotation.created_at.desc())
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .all()
    )

    total_pages = (total + pageSize - 1) // pageSize if total else 0
    return ApiResponse(
        data=PaginatedData(
            data=[AnnotationOut.model_validate(a) for a in items],
            total=total,
            page=page,
            pageSize=pageSize,
            totalPages=total_pages,
        ),
        success=True,
    )


@router.post("", response_model=ApiResponse[AnnotationOut], status_code=201)
def create_annotation(
    payload: AnnotationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_teacher_or_admin),
):
    submission_id = payload.submission_id
    if not submission_id and payload.analysis_id:
        analysis = db.query(AnalysisRun).filter(AnalysisRun.id == payload.analysis_id).first()
        if not analysis:
            raise ApiHTTPException(status_code=404, detail="Analysis not found")
        submission_id = analysis.submission_id

    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise ApiHTTPException(status_code=404, detail="Submission not found")

    annotation = Annotation(
        submission_id=submission_id,
        user_id=current_user.id,
        sentence_roles=payload.sentence_roles,
        concepts_present=payload.concepts_present,
        support_pairs=payload.support_pairs,
        depth_score=payload.depth_score,
        star_label=payload.star_label,
        notes=payload.notes,
    )
    db.add(annotation)
    db.commit()
    db.refresh(annotation)
    return ApiResponse(data=AnnotationOut.model_validate(annotation), success=True)


@router.get("/{annotation_id}", response_model=ApiResponse[AnnotationOut])
def get_annotation(
    annotation_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin),
):
    annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not annotation:
        raise ApiHTTPException(status_code=404, detail="Annotation not found")
    return ApiResponse(data=AnnotationOut.model_validate(annotation), success=True)


@router.put("/{annotation_id}", response_model=ApiResponse[AnnotationOut])
def update_annotation(
    annotation_id: str,
    payload: AnnotationUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin),
):
    annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not annotation:
        raise ApiHTTPException(status_code=404, detail="Annotation not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(annotation, field, value)

    db.commit()
    db.refresh(annotation)
    return ApiResponse(data=AnnotationOut.model_validate(annotation), success=True)


@router.delete("/{annotation_id}", response_model=ApiResponse[None])
def delete_annotation(
    annotation_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_teacher_or_admin),
):
    annotation = db.query(Annotation).filter(Annotation.id == annotation_id).first()
    if not annotation:
        raise ApiHTTPException(status_code=404, detail="Annotation not found")

    db.delete(annotation)
    db.commit()
    return ApiResponse(data=None, success=True, message="Annotation deleted")
