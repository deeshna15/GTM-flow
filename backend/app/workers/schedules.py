from celery.schedules import crontab
from app.workers.celery_app import celery_app

celery_app.conf.beat_schedule = {
    "system-heartbeat-every-5-minutes": {
        "task": "app.workers.tasks.system_heartbeat",
        "schedule": 300.0,
    },
}
