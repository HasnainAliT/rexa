"""Password hashing and JWT token helpers.

Password hashing uses the `bcrypt` library directly (rather than going
through passlib's `CryptContext`) because passlib's bcrypt backend probes
`bcrypt.__about__.__version__`, an attribute removed in bcrypt>=4.1, which
raises errors on modern bcrypt releases. Calling bcrypt directly avoids
that unmaintained-passlib incompatibility while keeping the same bcrypt
hashing scheme requested.
"""
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import bcrypt
from jose import JWTError, jwt

from app.config import settings

_BCRYPT_MAX_BYTES = 72


def hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        password_bytes = plain_password.encode("utf-8")[:_BCRYPT_MAX_BYTES]
        return bcrypt.checkpw(password_bytes, hashed_password.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(subject: str, extra_claims: Optional[dict[str, Any]] = None) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode: dict[str, Any] = {"sub": subject, "exp": expire}
    if extra_claims:
        to_encode.update(extra_claims)
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict[str, Any]]:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None
