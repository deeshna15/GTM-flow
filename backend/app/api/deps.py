import uuid
from typing import Generator, List
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import get_settings
from app.models.user import User, UserRole
from app.utils.security import decode_access_token
from app.services.auth_service import AuthService
from app.utils.logger import logger

settings = get_settings()
security_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security_bearer),
    db: Session = Depends(get_db),
) -> User:
    """Validate Bearer JWT access token and return authenticated User."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        payload = decode_access_token(token)
        user_id_str: str | None = payload.get("user_id")
        if not user_id_str:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        user_id = uuid.UUID(user_id_str)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except (jwt.PyJWTError, ValueError) as err:
        logger.warning(f"JWT validation failed: {err}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = AuthService.get_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User associated with this token was not found.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account.",
        )

    return user


class RoleChecker:
    """Dependency for enforcing role-based access control (RBAC)."""

    def __init__(self, allowed_roles: List[UserRole]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in self.allowed_roles:
            logger.warning(
                f"Unauthorized access attempt by {current_user.email} (Role: {current_user.role}) "
                f"to endpoint requiring roles: {[r.value for r in self.allowed_roles]}"
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have sufficient permissions to perform this action.",
            )
        return current_user


require_admin = RoleChecker([UserRole.ADMIN])
require_sales_or_admin = RoleChecker([UserRole.ADMIN, UserRole.SALES])
