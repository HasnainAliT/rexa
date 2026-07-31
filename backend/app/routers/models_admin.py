"""Admin routes for managing REXA model versions."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import ApiHTTPException, get_current_user, require_admin
from app.models import ModelVersion, User
from app.schemas import ApiResponse, ModelVersionCreate, ModelVersionOut

router = APIRouter(prefix="/models", tags=["models"])


@router.get("", response_model=ApiResponse[list[ModelVersionOut]])
def list_models(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    models = db.query(ModelVersion).order_by(ModelVersion.created_at.desc()).all()
    return ApiResponse(data=[ModelVersionOut.model_validate(m) for m in models], success=True)


@router.post("", response_model=ApiResponse[ModelVersionOut], status_code=201)
def create_model(
    payload: ModelVersionCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    model = ModelVersion(
        name=payload.name,
        version=payload.version,
        description=payload.description,
        metrics_json=payload.metrics_json,
        is_active=False,
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return ApiResponse(data=ModelVersionOut.model_validate(model), success=True)


@router.post("/{model_id}/activate", response_model=ApiResponse[ModelVersionOut])
def activate_model(
    model_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    model = db.query(ModelVersion).filter(ModelVersion.id == model_id).first()
    if not model:
        raise ApiHTTPException(status_code=404, detail="Model version not found")

    db.query(ModelVersion).update({ModelVersion.is_active: False})
    model.is_active = True
    db.commit()
    db.refresh(model)

    # Switch runtime MODEL_MODE and rebuild pipeline singleton
    from app.config import settings
    from app.services.rexa_pipeline import reset_pipeline

    if "trained" in (model.version or "").lower() or (model.metrics_json or {}).get("mode") == "trained":
        settings.MODEL_MODE = "trained"
    else:
        settings.MODEL_MODE = "heuristic"
    reset_pipeline()

    return ApiResponse(data=ModelVersionOut.model_validate(model), success=True, message="Model activated")


@router.delete("/{model_id}", response_model=ApiResponse[None])
def delete_model(
    model_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    model = db.query(ModelVersion).filter(ModelVersion.id == model_id).first()
    if not model:
        raise ApiHTTPException(status_code=404, detail="Model version not found")

    db.delete(model)
    db.commit()
    return ApiResponse(data=None, success=True, message="Model version deleted")
