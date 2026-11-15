from celery.schedules import crontab
from app.workers.celery_app import celery_app

celery_app.conf.beat_schedule = {
    "system-heartbeat-every-5-minutes": {
        "task": "app.workers.tasks.system_heartbeat",
        "schedule": 300.0,
    },
    "enrich-pending-accounts-every-15-minutes": {
        "task": "app.workers.tasks.periodic_enrich_pending_accounts",
        "schedule": 900.0,
        "args": (10,),
    },
    "score-unscored-accounts-hourly": {
        "task": "app.workers.tasks.periodic_score_unscored_accounts",
        "schedule": crontab(minute=0),
        "args": (50,),
    },
}
