import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    String,
    Integer,
    Text,
    DateTime,
    JSON,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class JobExecution(Base):
    __tablename__ = "job_executions"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    task_id: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    job_type: Mapped[str] = mapped_column(String(50), index=True, nullable=False)  # IMPORT, ENRICH, SCORE, ROUTING
    status: Mapped[str] = mapped_column(
        String(50), default="PENDING", index=True, nullable=False
    )  # PENDING, RUNNING, SUCCESS, FAILED

    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    max_retries: Mapped[int] = mapped_column(Integer, default=3, nullable=False)
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
