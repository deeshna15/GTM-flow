import uuid
from datetime import datetime, timezone
from enum import Enum
from sqlalchemy import (
    String,
    Integer,
    Text,
    DateTime,
    ForeignKey,
    Enum as SQLEnum,
    Uuid,
    Index,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class PriorityLevel(str, Enum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class EnrichmentStatus(str, Enum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    company_name: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    domain: Mapped[str | None] = mapped_column(
        String(255), index=True, nullable=True
    )
    website: Mapped[str | None] = mapped_column(String(512), nullable=True)
    industry: Mapped[str | None] = mapped_column(String(100), index=True, nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), index=True, nullable=True)
    employee_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    source: Mapped[str] = mapped_column(String(50), default="MANUAL", nullable=False)
    enrichment_status: Mapped[EnrichmentStatus] = mapped_column(
        SQLEnum(EnrichmentStatus, name="enrichment_status_types", native_enum=False),
        default=EnrichmentStatus.PENDING,
        index=True,
        nullable=False,
    )

    lead_score: Mapped[int | None] = mapped_column(Integer, index=True, nullable=True)
    priority: Mapped[PriorityLevel | None] = mapped_column(
        SQLEnum(PriorityLevel, name="priority_levels", native_enum=False),
        index=True,
        nullable=True,
    )

    assigned_to: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

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

    # Indexes
    __table_args__ = (
        Index("ix_accounts_domain_unique", "domain", unique=True, postgresql_where=(domain != None)),
    )

    # Relationships
    assigned_user = relationship(
        "User", back_populates="assigned_accounts", foreign_keys=[assigned_to]
    )
    contacts = relationship(
        "Contact", back_populates="account", cascade="all, delete-orphan"
    )
    enrichment_records = relationship(
        "EnrichmentRecord",
        back_populates="account",
        cascade="all, delete-orphan",
        order_by="desc(EnrichmentRecord.created_at)",
    )
    lead_scores = relationship(
        "LeadScore",
        back_populates="account",
        cascade="all, delete-orphan",
        order_by="desc(LeadScore.created_at)",
    )
    sources = relationship(
        "AccountSource", back_populates="account", cascade="all, delete-orphan"
    )
