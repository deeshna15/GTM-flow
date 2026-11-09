from app.workers.celery_app import celery_app
from app.utils.logger import logger


@celery_app.task(name="app.workers.tasks.system_heartbeat")
def system_heartbeat() -> dict:
    """Scheduled heartbeat verifying Celery worker is active."""
    logger.info("Executing Celery system heartbeat task.")
    return {"status": "alive", "worker": "gtmflow_worker"}
