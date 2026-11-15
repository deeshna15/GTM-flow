import uuid
from datetime import datetime, timezone
from typing import List
from sqlalchemy import select
from app.workers.celery_app import celery_app
from app.database import SessionLocal
from app.models.account import Account, EnrichmentStatus
from app.models.job_execution import JobExecution
from app.services.import_service import ImportService
from app.services.enrichment_service import EnrichmentService
from app.services.scoring_service import ScoringService
from app.utils.logger import logger


@celery_app.task(name="app.workers.tasks.system_heartbeat")
def system_heartbeat() -> dict:
    """Scheduled heartbeat verifying Celery worker is active."""
    logger.info("Executing Celery system heartbeat task.")
    return {"status": "alive", "worker": "gtmflow_worker"}


@celery_app.task(bind=True, name="app.workers.tasks.process_csv_import")
def process_csv_import_task(
    self,
    job_id_str: str,
    file_path: str,
    field_mapping: dict,
    conflict_policy: str = "PRESERVE_EXISTING",
    user_id_str: str = None,
) -> dict:
    """Asynchronous background worker executing chunked CSV ingestion."""
    job_id = uuid.UUID(job_id_str)
    user_id = uuid.UUID(user_id_str) if user_id_str else None

    logger.info(f"Celery task started: process_csv_import for Job ID {job_id}")

    db = SessionLocal()
    try:
        job = ImportService.process_import(
            db=db,
            job_id=job_id,
            file_path=file_path,
            field_mapping=field_mapping,
            conflict_policy=conflict_policy,
            user_id=user_id,
        )
        return {
            "job_id": str(job.id),
            "status": job.status,
            "total": job.total_records,
            "inserted": job.processed_records,
            "duplicates": job.duplicate_records,
            "failed": job.failed_records,
        }
    except Exception as exc:
        logger.error(f"Celery import task failed: {exc}")
        raise
    finally:
        db.close()


@celery_app.task(
    bind=True,
    name="app.workers.tasks.bulk_enrich_accounts",
    autoretry_for=(Exception,),
    retry_backoff=True,
    max_retries=3,
)
def bulk_enrich_accounts_task(
    self,
    account_ids: List[str],
    job_execution_id_str: str = None,
    user_id_str: str = None,
) -> dict:
    """Background worker executing Claude AI enrichment across a batch of accounts."""
    parsed_ids = [uuid.UUID(aid) for aid in account_ids]
    job_exec_id = uuid.UUID(job_execution_id_str) if job_execution_id_str else None
    user_id = uuid.UUID(user_id_str) if user_id_str else None

    db = SessionLocal()
    try:
        result = EnrichmentService.execute_bulk_enrichment(
            db=db,
            account_ids=parsed_ids,
            job_execution_id=job_exec_id,
            current_user_id=user_id,
        )
        return result
    except Exception as exc:
        logger.error(f"Bulk enrich task error: {exc}")
        if job_exec_id:
            job = db.execute(
                select(JobExecution).where(JobExecution.id == job_exec_id)
            ).scalar_one_or_none()
            if job:
                job.status = "FAILED"
                job.error_message = str(exc)
                job.retry_count = self.request.retries
                job.completed_at = datetime.now(timezone.utc)
                db.commit()
        raise
    finally:
        db.close()


@celery_app.task(name="app.workers.tasks.periodic_enrich_pending_accounts")
def periodic_enrich_pending_accounts(limit: int = 10) -> dict:
    """Celery Beat periodic job: enrich pending accounts automatically."""
    db = SessionLocal()
    try:
        pending_ids = list(
            db.execute(
                select(Account.id)
                .where(Account.enrichment_status == EnrichmentStatus.PENDING)
                .limit(limit)
            )
            .scalars()
            .all()
        )
        if not pending_ids:
            return {"status": "idle", "processed": 0}

        job = JobExecution(
            task_id=f"beat-enrich-{uuid.uuid4()}",
            job_type="ENRICH",
            status="RUNNING",
            payload={"account_ids": [str(aid) for aid in pending_ids], "scheduled": True},
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        res = EnrichmentService.execute_bulk_enrichment(
            db=db,
            account_ids=pending_ids,
            job_execution_id=job.id,
        )
        return {"status": "completed", **res}
    finally:
        db.close()


@celery_app.task(name="app.workers.tasks.periodic_score_unscored_accounts")
def periodic_score_unscored_accounts(limit: int = 50) -> dict:
    """Celery Beat periodic job: deterministically score unscored accounts."""
    db = SessionLocal()
    try:
        res = ScoringService.bulk_score_accounts(db=db, rescore_all=False, limit=limit)
        if res["scored_count"] > 0:
            job = JobExecution(
                task_id=f"beat-score-{uuid.uuid4()}",
                job_type="SCORE",
                status="SUCCESS",
                payload={"scheduled": True, **res},
                completed_at=datetime.now(timezone.utc),
            )
            db.add(job)
            db.commit()
        return res
    finally:
        db.close()
