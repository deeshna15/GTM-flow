import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, Float, DateTime, ForeignKey, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class AccountSource(Base):
    """Provenance tracking for individual company attributes."""
    __tablename__ = "account_sources"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    field_name: Mapped[str] = mapped_column(String(100), nullable=False)
    original_value: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_name: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., CSV_IMPORT, CLAUDE_AI
    confidence: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    account = relationship("Account", back_populates="sources")
