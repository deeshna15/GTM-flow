import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    String,
    Integer,
    DateTime,
    ForeignKey,
    JSON,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class ImportJob(Base):
    __tablename__ = "import_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), default="PENDING", index=True, nullable=False
    )  # PENDING, PROCESSING, COMPLETED, PARTIAL, FAILED

    total_records: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    processed_records: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    duplicate_records: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_records: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    field_mapping: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error_summary: Mapped[list | None] = mapped_column(JSON, nullable=True)

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        Uuid(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    creator = relationship("User", back_populates="created_imports")
