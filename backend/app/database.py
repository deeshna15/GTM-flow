import time
from typing import Generator, Dict, Any
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase, Session
from app.config import get_settings
from app.utils.logger import logger

settings = get_settings()


class Base(DeclarativeBase):
    """Base model class for all SQLAlchemy entities."""
    pass


def get_engine_args():
    """Build engine connection arguments based on database URL dialect."""
    url = settings.DATABASE_URL
    if "sqlite" in url:
        return {"connect_args": {"check_same_thread": False}}
    return {
        "pool_size": settings.DATABASE_POOL_SIZE,
        "max_overflow": settings.DATABASE_MAX_OVERFLOW,
        "pool_timeout": settings.DATABASE_POOL_TIMEOUT,
        "pool_pre_ping": settings.DATABASE_POOL_PRE_PING,
        "connect_args": {"connect_timeout": 2},
    }


engine = create_engine(settings.DATABASE_URL, **get_engine_args())

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency yielding a SQLAlchemy session.
    Automatically handles session closing and rollback on unhandled exceptions.
    """
    db = SessionLocal()
    try:
        yield db
    except Exception as exc:
        db.rollback()
        logger.error(f"Database session rollback due to exception: {exc}")
        raise
    finally:
        db.close()


def check_db_health() -> Dict[str, Any]:
    """Execute a simple query to verify database connectivity and measure latency."""
    start_time = time.time()
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        latency_ms = round((time.time() - start_time) * 1000, 2)
        return {
            "status": "healthy",
            "latency_ms": latency_ms,
            "database_url": settings.DATABASE_URL.split("@")[-1] if "@" in settings.DATABASE_URL else "local",
        }
    except Exception as err:
        latency_ms = round((time.time() - start_time) * 1000, 2)
        logger.warning(f"Database health check failed: {err}")
        return {
            "status": "unhealthy",
            "error": str(err),
            "latency_ms": latency_ms,
        }
