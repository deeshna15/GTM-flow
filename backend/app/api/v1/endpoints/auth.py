from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.config import get_settings
from app.models.user import User
from app.schemas.user import UserCreate, UserRead
from app.schemas.auth import LoginRequest, TokenResponse
from app.services.auth_service import AuthService
from app.utils.security import create_access_token
from app.api.deps import get_current_user, require_admin

router = APIRouter()
settings = get_settings()


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
def register(user_in: UserCreate, db: Session = Depends(get_db)) -> User:
    """Register a new user account with role-based access permissions."""
    return AuthService.register_user(db, user_in)


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Authenticate and receive JWT token",
)
def login(login_in: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """Validate user credentials and return a signed Bearer JWT token."""
    user = AuthService.authenticate(db, login_in.email, login_in.password)

    access_token = create_access_token(
        subject=user.email,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        user_id=str(user.id),
    )

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        expires_in_minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES,
        user=UserRead.model_validate(user),
    )


@router.get(
    "/me",
    response_model=UserRead,
    status_code=status.HTTP_200_OK,
    summary="Get current user profile",
)
def get_current_user_profile(current_user: User = Depends(get_current_user)) -> User:
    """Retrieve profile and authorization metadata for currently authenticated user."""
    return current_user


@router.get(
    "/admin-only",
    status_code=status.HTTP_200_OK,
    summary="Admin privileged endpoint test",
)
def admin_only_check(admin_user: User = Depends(require_admin)) -> dict:
    """Restricted endpoint demonstrating role-based access control (Admin role required)."""
    return {
        "status": "authorized",
        "message": f"Welcome, Administrator {admin_user.full_name}",
        "role": admin_user.role,
    }
