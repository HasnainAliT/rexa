"""Admin user-management routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import ApiHTTPException, require_admin
from app.models import User
from app.schemas import ApiResponse, PaginatedData, UserListItem, UserRoleUpdate

router = APIRouter(prefix="/users", tags=["users"])

ALLOWED_ROLES = {"student", "teacher", "admin"}


@router.get("", response_model=ApiResponse[PaginatedData[UserListItem]])
def list_users(
    page: int = 1,
    pageSize: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    query = db.query(User).order_by(User.created_at.desc())
    total = query.count()
    page = max(page, 1)
    pageSize = max(min(pageSize, 100), 1)
    items = query.offset((page - 1) * pageSize).limit(pageSize).all()
    total_pages = (total + pageSize - 1) // pageSize if total else 0
    return ApiResponse(
        data=PaginatedData(
            data=[UserListItem.from_user(u) for u in items],
            total=total,
            page=page,
            pageSize=pageSize,
            totalPages=total_pages,
        ),
        success=True,
    )


@router.patch("/{user_id}/role", response_model=ApiResponse[UserListItem])
def update_user_role(
    user_id: str,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    new_role = (payload.role or "").strip().lower()
    if new_role not in ALLOWED_ROLES:
        raise ApiHTTPException(status_code=400, detail="Role must be student, teacher, or admin")

    if user_id == current_user.id:
        raise ApiHTTPException(status_code=400, detail="You cannot change your own role")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ApiHTTPException(status_code=404, detail="User not found")

    if user.role == "admin" and new_role != "admin":
        admin_count = db.query(User).filter(User.role == "admin").count()
        if admin_count <= 1:
            raise ApiHTTPException(
                status_code=400,
                detail="Cannot demote the last remaining admin",
            )

    user.role = new_role
    db.commit()
    db.refresh(user)
    return ApiResponse(data=UserListItem.from_user(user), success=True)
