import time
import uuid
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import get_settings
from app.utils.logger import setup_logging, logger
from app.api.v1.router import api_router
from app.api.v1.endpoints.health import health_check, readiness_check

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifecycle management for startup and graceful shutdown."""
    setup_logging(log_level=settings.LOG_LEVEL, log_format=settings.LOG_FORMAT)
    logger.info(
        f"Starting {settings.APP_NAME} in '{settings.APP_ENV}' mode on port {settings.APP_PORT}..."
    )
    yield
    logger.info(f"Shutting down {settings.APP_NAME}...")


app = FastAPI(
    title="GTMFlow API",
    description=(
        "AI-Powered Lead Intelligence, Account Scoring & Sales Automation Platform. "
        "Centralized GTM infrastructure backend for Secfix GTM Engineering."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_process_time_and_request_id(request: Request, call_next):
    """Attach correlation request ID and response timing header for observability."""
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    start_time = time.time()

    response = await call_next(request)

    process_time = round((time.time() - start_time) * 1000, 2)
    response.headers["X-Process-Time-Ms"] = str(process_time)
    response.headers["X-Request-ID"] = request_id
    return response


# Top-level health and readiness routes for convenience / cloud healthchecks
app.add_api_route("/health", health_check, methods=["GET"], tags=["Root Health"])
app.add_api_route("/ready", readiness_check, methods=["GET"], tags=["Root Health"])

# Mount API v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Root"])
def root():
    """Welcome endpoint with API documentation and metadata links."""
    return {
        "name": settings.APP_NAME,
        "version": "1.0.0",
        "status": "operational",
        "documentation": "/docs",
        "api_v1": f"{settings.API_V1_STR}",
        "endpoints": {
            "health": "/health",
            "ready": "/ready",
        },
    }
