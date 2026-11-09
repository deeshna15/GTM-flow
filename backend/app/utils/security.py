from datetime import datetime, timedelta, timezone
from typing import Any, Dict
import bcrypt
import jwt
from app.config import get_settings

settings = get_settings()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a raw plaintext password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Generate a secure bcrypt hash for a plaintext password."""
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def create_access_token(
    subject: str | Any,
    role: str,
    user_id: str,
    expires_delta: timedelta | None = None,
) -> str:
    """Create a signed JWT access token with user claims."""
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode: Dict[str, Any] = {
        "sub": str(subject),  # user email
        "user_id": str(user_id),
        "role": str(role),
        "exp": expire,
        "iat": now,
        "nbf": now,
    }

    encoded_jwt = jwt.encode(
        to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and validate a JWT access token. Raises jwt.PyJWTError on invalid/expired tokens."""
    return jwt.decode(
        token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
    )
