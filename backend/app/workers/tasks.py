import uuid
from app.workers.celery_app import celery_app
from app.database import SessionLocal
from app.services.import_service import ImportService
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
