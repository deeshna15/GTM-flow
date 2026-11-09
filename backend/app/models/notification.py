import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    String,
    Boolean,
    Text,
    DateTime,
    ForeignKey,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[str] = mapped_column(String(50), default="INFO", nullable=False)  # INFO, ALERT, SUCCESS, WARNING
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)  # ACCOUNT, IMPORT, JOB
    entity_id: Mapped[uuid.UUID | None] = mapped_column(Uuid(as_uuid=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    user = relationship("User", back_populates="notifications")
