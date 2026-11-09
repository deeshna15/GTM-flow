import uuid
from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi import HTTPException, status
from app.models.user import User, UserRole
from app.schemas.user import UserCreate
from app.utils.security import get_password_hash, verify_password
from app.utils.logger import logger


class AuthService:
    @staticmethod
    def get_by_email(db: Session, email: str) -> User | None:
        """Fetch user by email case-insensitively."""
        stmt = select(User).where(User.email.ilike(email.strip()))
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def get_by_id(db: Session, user_id: uuid.UUID) -> User | None:
        """Fetch user by UUID primary key."""
        stmt = select(User).where(User.id == user_id)
        return db.execute(stmt).scalar_one_or_none()

    @staticmethod
    def register_user(db: Session, user_in: UserCreate) -> User:
        """Register a new user with hashed password and duplicate email prevention."""
        normalized_email = user_in.email.strip().lower()

        existing = AuthService.get_by_email(db, normalized_email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A user with email '{user_in.email}' already exists.",
            )

        hashed_password = get_password_hash(user_in.password)
        db_user = User(
            full_name=user_in.full_name.strip(),
            email=normalized_email,
            password_hash=hashed_password,
            role=user_in.role or UserRole.SALES,
            is_active=True,
        )

        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        logger.info(f"User registered successfully: {db_user.email} (Role: {db_user.role})")
        return db_user

    @staticmethod
    def authenticate(db: Session, email: str, password: str) -> User:
        """Validate user credentials and return active User instance."""
        user = AuthService.get_by_email(db, email)
        if not user or not verify_password(password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="This user account has been deactivated.",
            )

        return user
