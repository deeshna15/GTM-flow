import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    String,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
    JSON,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class AutomationRule(Base):
    __tablename__ = "automation_rules"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    trigger_type: Mapped[str] = mapped_column(String(50), index=True, nullable=False)
    conditions: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    actions: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
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

    executions = relationship(
        "AutomationExecution",
        back_populates="rule",
        cascade="all, delete-orphan",
        order_by="desc(AutomationExecution.executed_at)",
    )


class AutomationExecution(Base):
    __tablename__ = "automation_executions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    rule_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("automation_rules.id", ondelete="CASCADE"), nullable=False, index=True
    )
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)  # ACCOUNT, IMPORT
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False)  # SUCCESS, FAILED, SKIPPED
    execution_details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    executed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    rule = relationship("AutomationRule", back_populates="executions")
