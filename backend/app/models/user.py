import uuid
from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import String, Boolean, DateTime, Enum as SQLEnum, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class UserRole(str, Enum):
    ADMIN = "ADMIN"
    SALES = "SALES"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        SQLEnum(UserRole, name="user_roles", native_enum=False),
        default=UserRole.SALES,
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    assigned_accounts = relationship(
        "Account", back_populates="assigned_user", foreign_keys="Account.assigned_to"
    )
    created_imports = relationship("ImportJob", back_populates="creator")
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user")
