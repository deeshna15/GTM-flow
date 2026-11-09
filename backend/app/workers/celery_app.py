from celery import Celery
from app.config import get_settings
from app.utils.logger import logger

settings = get_settings()

celery_app = Celery(
    "gtmflow_worker",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    result_expires=86400,  # 24 hours
)


@celery_app.task(name="app.workers.celery_app.health_ping")
def health_ping() -> str:
    """Simple worker healthcheck task."""
    logger.info("Celery health ping received and processed.")
    return "pong"
