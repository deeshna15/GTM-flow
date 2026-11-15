import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.api.v1.endpoints.health import check_redis_health
from app.database import get_db
from app.models.job_execution import JobExecution
from app.models.user import User
from app.schemas.automation import JobExecutionRead, JobsSummaryResponse
from app.services.enrichment_service import EnrichmentService
from app.utils.logger import logger

router = APIRouter()


@router.get(
    "",
    response_model=JobsSummaryResponse,
    summary="List background jobs and execution metrics",
)
def list_jobs(
    status_filter: Optional[str] = Query(None, alias="status"),
    job_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobsSummaryResponse:
    """List background task executions with status counts for monitoring."""
    all_jobs = list(
        db.execute(select(JobExecution).order_by(desc(JobExecution.started_at)))
        .scalars()
        .all()
    )

    total_jobs = len(all_jobs)
    success_jobs = sum(1 for j in all_jobs if j.status == "SUCCESS")
    failed_jobs = sum(1 for j in all_jobs if j.status == "FAILED")
    running_jobs = sum(1 for j in all_jobs if j.status == "RUNNING")
    pending_jobs = sum(1 for j in all_jobs if j.status == "PENDING")

    filtered = all_jobs
    if status_filter:
        filtered = [j for j in filtered if j.status == status_filter.upper()]
    if job_type:
        filtered = [j for j in filtered if j.job_type == job_type.upper()]

    return JobsSummaryResponse(
        total_jobs=total_jobs,
        success_jobs=success_jobs,
        failed_jobs=failed_jobs,
        running_jobs=running_jobs,
        pending_jobs=pending_jobs,
        items=[JobExecutionRead.model_validate(j) for j in filtered[:limit]],
    )


@router.get(
    "/worker-status",
    summary="Inspect Redis broker and scheduled worker readiness",
)
def get_worker_status(
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Report Celery broker reachability and configured Beat schedule tasks."""
    redis_status = check_redis_health()
    from app.workers.celery_app import celery_app

    beat_schedule = list((celery_app.conf.beat_schedule or {}).keys())
    return {
        "broker_status": redis_status["status"],
        "broker_latency_ms": redis_status.get("latency_ms"),
        "scheduled_jobs": beat_schedule,
        "execution_mode": "celery_worker" if redis_status["status"] == "healthy" else "sync_fallback",
    }


@router.post(
    "/{job_id}/retry",
    response_model=JobExecutionRead,
    summary="Retry a failed background job",
)
def retry_failed_job(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> JobExecutionRead:
    """Retry a FAILED JobExecution respecting max_retries budget."""
    job = db.execute(
        select(JobExecution).where(JobExecution.id == job_id)
    ).scalar_one_or_none()
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found.",
        )

    if job.status != "FAILED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Only FAILED jobs can be retried (current status: {job.status}).",
        )

    if job.retry_count >= job.max_retries:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Maximum retry attempts ({job.max_retries}) exceeded for this job.",
        )

    job.retry_count += 1
    job.status = "RUNNING"
    job.error_message = None
    job.completed_at = None
    db.commit()

    # Handle ENRICH batch retries cleanly
    payload = job.payload or {}
    if job.job_type == "ENRICH" and payload.get("account_ids"):
        try:
            account_uuids = [uuid.UUID(aid) for aid in payload["account_ids"]]
            EnrichmentService.execute_bulk_enrichment(
                db=db,
                account_ids=account_uuids,
                job_execution_id=job.id,
                current_user_id=current_user.id,
            )
            db.refresh(job)
            return JobExecutionRead.model_validate(job)
        except Exception as exc:
            logger.error(f"Job retry failed for {job.id}: {exc}")
            job.status = "FAILED"
            job.error_message = str(exc)
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(job)
            return JobExecutionRead.model_validate(job)

    # Generic completion for non-payload jobs
    job.status = "SUCCESS"
    job.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)
    return JobExecutionRead.model_validate(job)
