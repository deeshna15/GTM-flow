import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    String,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    JSON,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class LeadScore(Base):
    __tablename__ = "lead_scores"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    total_score: Mapped[int] = mapped_column(Integer, nullable=False)
    industry_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    geography_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    size_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    signal_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    data_completeness_score: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    priority: Mapped[str] = mapped_column(String(20), nullable=False)  # HIGH, MEDIUM, LOW
    explanation: Mapped[dict] = mapped_column(JSON, nullable=False)
    scoring_version: Mapped[str] = mapped_column(String(50), default="1.0", nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    account = relationship("Account", back_populates="lead_scores")


class ScoringConfig(Base):
    """Dynamic configuration for deterministic lead qualification weights and rules."""
    __tablename__ = "scoring_configs"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    weights: Mapped[dict] = mapped_column(
        JSON,
        default=lambda: {
            "industry": 30,
            "geography": 20,
            "size": 20,
            "signals": 20,
            "completeness": 10,
        },
        nullable=False,
    )
    target_industries: Mapped[dict] = mapped_column(
        JSON,
        default=lambda: {
            "Cybersecurity": 30,
            "SaaS": 25,
            "Technology": 25,
            "Software": 25,
            "Financial Services": 20,
            "Fintech": 20,
        },
        nullable=False,
    )
    target_geographies: Mapped[dict] = mapped_column(
        JSON,
        default=lambda: {
            "Germany": 20,
            "France": 20,
            "United Kingdom": 20,
            "Netherlands": 20,
            "Austria": 20,
            "Switzerland": 20,
            "Sweden": 20,
            "Denmark": 20,
            "Norway": 20,
        },
        nullable=False,
    )
    target_employee_ranges: Mapped[dict] = mapped_column(
        JSON,
        default=lambda: {
            "50-500": 20,
            "20-49": 12,
            "501-1000": 12,
            "default": 5,
        },
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
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
