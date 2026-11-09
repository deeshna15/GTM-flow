import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Uuid,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Contact(Base):
    __tablename__ = "contacts"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    job_title: Mapped[str | None] = mapped_column(String(150), nullable=True)
    department: Mapped[str | None] = mapped_column(String(100), nullable=True)
    seniority: Mapped[str | None] = mapped_column(String(50), nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    source: Mapped[str] = mapped_column(String(50), default="MANUAL", nullable=False)

    verification_status: Mapped[str] = mapped_column(
        String(50), default="UNVERIFIED", nullable=False
    )
    is_decision_maker: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    buying_role: Mapped[str | None] = mapped_column(String(50), nullable=True)

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

    __table_args__ = (
        UniqueConstraint("account_id", "email", name="uq_account_contact_email"),
    )

    # Relationship
    account = relationship("Account", back_populates="contacts")
