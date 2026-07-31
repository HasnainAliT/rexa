"""Authentication routes: login, register, me, logout."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import ApiHTTPException, get_current_user
from app.models import User
from app.schemas import ApiResponse, AuthData, LoginRequest, RegisterRequest, UserOut
from app.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=ApiResponse[AuthData])
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise ApiHTTPException(status_code=401, detail="Invalid email or password")

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

    user = User(
        email=payload.email.lower(),
        name=payload.name,
        hashed_password=hash_password(payload.password),
        role="viewer",
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
    # Stateless JWT: logout is handled client-side by discarding the token.
    return ApiResponse(data=None, success=True, message="Logged out")
