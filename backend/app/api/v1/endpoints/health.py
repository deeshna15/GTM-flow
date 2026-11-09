import time
from datetime import datetime, timezone
from typing import Dict, Any
from fastapi import APIRouter, status
from fastapi.responses import JSONResponse
import redis
from app.config import get_settings
from app.database import check_db_health
from app.utils.logger import logger

router = APIRouter()
settings = get_settings()


def check_redis_health() -> Dict[str, Any]:
    """Test Redis broker connectivity and measure round-trip ping time."""
    start_time = time.time()
    try:
        r = redis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        r.ping()
        latency_ms = round((time.time() - start_time) * 1000, 2)
        return {
            "status": "healthy",
            "latency_ms": latency_ms,
        }
    except Exception as err:
        latency_ms = round((time.time() - start_time) * 1000, 2)
        logger.warning(f"Redis health check failed: {err}")
        return {
            "status": "unhealthy",
            "error": str(err),
            "latency_ms": latency_ms,
        }


@router.get("/health", status_code=status.HTTP_200_OK, tags=["Health"])
def health_check() -> Dict[str, Any]:
    """
    Liveness probe.
    Returns 200 OK immediately if the FastAPI process is responsive.
    """
    return {
        "status": "online",
        "service": settings.APP_NAME,
        "environment": settings.APP_ENV,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0",
    }


@router.get("/ready", tags=["Health"])
def readiness_check() -> JSONResponse:
    """
    Readiness probe.
    Validates core infrastructure dependencies (PostgreSQL and Redis).
    Returns 200 OK if all critical services are reachable; 503 Service Unavailable otherwise.
    """
    db_health = check_db_health()
    redis_health = check_redis_health()

    is_ready = db_health["status"] == "healthy" and redis_health["status"] == "healthy"
    status_code = status.HTTP_200_OK if is_ready else status.HTTP_503_SERVICE_UNAVAILABLE

    payload = {
        "ready": is_ready,
        "status": "ready" if is_ready else "degraded",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "dependencies": {
            "database": db_health,
            "redis": redis_health,
        },
    }

    return JSONResponse(status_code=status_code, content=payload)
