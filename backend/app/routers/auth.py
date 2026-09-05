"""Authentication routes: login, register, me, logout."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import ApiHTTPException, get_current_user, is_teacher
from app.models import User
from app.schemas import ApiResponse, AuthData, LoginRequest, RegisterRequest, UserOut
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=ApiResponse[AuthData])
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise ApiHTTPException(status_code=401, detail="Invalid email or password")

    wants_instructor = payload.role == "teacher"
    if wants_instructor and not is_teacher(user):
        raise ApiHTTPException(
            status_code=403,
            detail="This account is registered as a student. Sign in as Student.",
        )
    if not wants_instructor and is_teacher(user):
        raise ApiHTTPException(
            status_code=403,
            detail="This account is registered as an instructor. Sign in as Instructor.",
        )

    token = create_access_token(subject=user.id, extra_claims={"role": user.role})
    return ApiResponse(
        data=AuthData(user=UserOut.from_orm_user(user), token=token),
        success=True,
    )


@router.post("/register", response_model=ApiResponse[AuthData])
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise ApiHTTPException(status_code=409, detail="An account with this email already exists")

    role = (payload.role or "").strip().lower()
    if role not in {"student", "teacher"}:
        raise ApiHTTPException(status_code=400, detail="Role must be student or teacher")

    roll_number = None
    if role == "student":
        roll = (payload.roll_number or "").strip().upper()
        if not roll:
            raise ApiHTTPException(status_code=400, detail="Roll number is required")
        roll_number = roll
    else:
        code = (payload.institution_code or "").strip()
        if not code:
            raise ApiHTTPException(status_code=400, detail="Institution code is required")
        expected = (settings.TEACHER_SIGNUP_CODE or "").strip()
        if not expected or code != expected:
            raise ApiHTTPException(status_code=403, detail="Invalid institution code")

    user = User(
        email=payload.email.lower(),
        name=payload.name.strip(),
        hashed_password=hash_password(payload.password),
        role=role,
        roll_number=roll_number,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(subject=user.id, extra_claims={"role": user.role})
    return ApiResponse(
        data=AuthData(user=UserOut.from_orm_user(user), token=token),
        success=True,
    )


@router.get("/me", response_model=ApiResponse[UserOut])
def me(current_user: User = Depends(get_current_user)):
    return ApiResponse(data=UserOut.from_orm_user(current_user), success=True)


@router.post("/logout", response_model=ApiResponse[None])
def logout():
    return ApiResponse(data=None, success=True, message="Logged out")
