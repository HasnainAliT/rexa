"""Reusable FastAPI dependencies: DB session, current user, role guards."""
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


class ApiHTTPException(HTTPException):
    """HTTPException whose detail is a plain message string.

    Handled by the exception handler in main.py to produce
    { message, success: false } bodies as expected by the frontend.
    """


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise ApiHTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = decode_access_token(credentials.credentials)
    if payload is None or "sub" not in payload:
        raise ApiHTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user = db.query(User).filter(User.id == payload["sub"]).first()
    if user is None:
        raise ApiHTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return user


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> Optional[User]:
    if credentials is None:
        return None
    payload = decode_access_token(credentials.credentials)
    if payload is None or "sub" not in payload:
        return None
    return db.query(User).filter(User.id == payload["sub"]).first()


def require_roles(*roles: str):
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise ApiHTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission to perform this action",
            )
        return user

    return dependency


require_admin = require_roles("admin")
require_admin_or_analyst = require_roles("admin", "analyst")
