import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    String,
    DateTime,
    ForeignKey,
    JSON,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    entity_type: Mapped[str] = mapped_column(String(50), index=True, nullable=False)  # ACCOUNT, CONTACT, SCORE, RULE
    entity_id: Mapped[uuid.UUID] = mapped_column(Uuid(as_uuid=True), index=True, nullable=False)
    action: Mapped[str] = mapped_column(String(50), index=True, nullable=False)  # CREATE, UPDATE, DELETE, ASSIGN

    old_values: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    new_values: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User", back_populates="audit_logs")
