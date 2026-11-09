import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    String,
    Integer,
    Float,
    Text,
    DateTime,
    ForeignKey,
    JSON,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class EnrichmentRecord(Base):
    __tablename__ = "enrichment_records"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    account_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    provider: Mapped[str] = mapped_column(String(50), default="CLAUDE", nullable=False)
    input_snapshot: Mapped[dict] = mapped_column(JSON, nullable=False)
    output_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(
        String(50), default="PENDING", index=True, nullable=False
    )
    model_name: Mapped[str] = mapped_column(String(100), nullable=False)
    tokens_used: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latency_ms: Mapped[float | None] = mapped_column(Float, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    account = relationship("Account", back_populates="enrichment_records")
