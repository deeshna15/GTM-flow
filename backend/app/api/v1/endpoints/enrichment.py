import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.api.deps import get_current_user
from app.api.v1.endpoints.health import check_redis_health
from app.database import get_db
from app.models.account import Account, EnrichmentStatus
from app.models.job_execution import JobExecution
from app.models.user import User
from app.schemas.enrichment import (
    BulkEnrichRequest,
    BulkEnrichResponse,
    EnrichAccountRequest,
    EnrichmentFeedPagination,
    EnrichmentRecordRead,
    EnrichmentReviewRequest,
)
from app.services.enrichment_service import EnrichmentService
from app.utils.logger import logger

# Router mounted under /accounts (MUST be registered BEFORE accounts.router so /bulk-enrich precedes /{id})
accounts_enrichment_router = APIRouter()

# Router mounted under /enrichment
router = APIRouter()


@accounts_enrichment_router.post(
    "/bulk-enrich",
    response_model=BulkEnrichResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Bulk trigger AI enrichment for multiple or pending accounts",
)
def bulk_enrich_accounts(
    payload: BulkEnrichRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BulkEnrichResponse:
    """Queue or execute batch AI company intelligence enrichment."""
    if payload.account_ids:
        target_ids = payload.account_ids[: payload.limit]
    else:
        stmt = (
            select(Account.id)
            .where(Account.enrichment_status != EnrichmentStatus.COMPLETED)
            .limit(payload.limit)
        )
        target_ids = list(db.execute(stmt).scalars().all())

    job = JobExecution(
        task_id=f"enrich-batch-{uuid.uuid4()}",
        job_type="ENRICH",
        status="RUNNING",
        payload={
            "account_ids": [str(aid) for aid in target_ids],
            "count": len(target_ids),
            "triggered_by": str(current_user.id),
        },
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    if not target_ids:
        job.status = "SUCCESS"
        job.completed_at = datetime.now(timezone.utc)
        db.commit()
        return BulkEnrichResponse(
            job_id=job.id,
            queued_count=0,
            status="COMPLETED",
            mode="SYNC_FALLBACK",
            message="No pending accounts require enrichment.",
        )

    dispatched = False
    try:
        if check_redis_health().get("status") == "healthy":
            from app.workers.tasks import bulk_enrich_accounts_task

            task = bulk_enrich_accounts_task.delay(
                account_ids=[str(aid) for aid in target_ids],
                job_execution_id_str=str(job.id),
                user_id_str=str(current_user.id),
            )
            job.task_id = task.id
            job.status = "PENDING"
            db.commit()
            dispatched = True
    except Exception as exc:
        logger.warning(f"Celery dispatch skipped for bulk-enrich; running synchronously: {exc}")

    if not dispatched:
        result = EnrichmentService.execute_bulk_enrichment(
            db=db,
            account_ids=target_ids,
            job_execution_id=job.id,
            current_user_id=current_user.id,
        )
        return BulkEnrichResponse(
            job_id=job.id,
            queued_count=len(target_ids),
            status="COMPLETED",
            mode="SYNC_FALLBACK",
            message=f"Enriched {result['succeeded']} accounts ({result['failed']} failed).",
        )

    return BulkEnrichResponse(
        job_id=job.id,
        queued_count=len(target_ids),
        status="PENDING",
        mode="CELERY_ASYNC",
        message=f"Dispatched {len(target_ids)} accounts to Celery worker queue.",
    )


@accounts_enrichment_router.post(
    "/{account_id}/enrich",
    response_model=EnrichmentRecordRead,
    status_code=status.HTTP_200_OK,
    summary="Enrich a single account using Claude AI",
)
def enrich_single_account(
    account_id: uuid.UUID,
    payload: Optional[EnrichAccountRequest] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EnrichmentRecordRead:
    """Trigger structured company enrichment for an account and store provenance."""
    record = EnrichmentService.enrich_account(
        db=db,
        account_id=account_id,
        current_user_id=current_user.id,
    )
    return EnrichmentRecordRead.model_validate(record)


@accounts_enrichment_router.get(
    "/{account_id}/enrichment",
    response_model=List[EnrichmentRecordRead],
    summary="Get enrichment history for an account",
)
def get_account_enrichment_history(
    account_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[EnrichmentRecordRead]:
    """List structured AI enrichment records for an account (newest first)."""
    records = EnrichmentService.get_account_enrichments(db=db, account_id=account_id)
    return [EnrichmentRecordRead.model_validate(r) for r in records]


@router.get(
    "",
    response_model=EnrichmentFeedPagination,
    summary="List recent AI enrichment records across accounts",
)
def list_enrichments(
    status_filter: Optional[str] = Query(None, alias="status"),
    review_status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EnrichmentFeedPagination:
    """Retrieve global AI intelligence feed with optional execution or review filters."""
    result = EnrichmentService.list_enrichment_feed(
        db=db,
        status_filter=status_filter,
        review_status=review_status,
        page=page,
        size=size,
    )
    return EnrichmentFeedPagination(**result)


@router.post(
    "/{record_id}/review",
    response_model=EnrichmentRecordRead,
    summary="Approve or reject AI enrichment suggestions",
)
def review_enrichment_record(
    record_id: uuid.UUID,
    review_in: EnrichmentReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> EnrichmentRecordRead:
    """Approve/reject structured intelligence and optionally apply normalized attributes to the Account."""
    record = EnrichmentService.review_enrichment(
        db=db,
        record_id=record_id,
        decision=review_in.decision,
        apply_industry=review_in.apply_industry,
        apply_summary=review_in.apply_summary,
        current_user_id=current_user.id,
    )
    return EnrichmentRecordRead.model_validate(record)
