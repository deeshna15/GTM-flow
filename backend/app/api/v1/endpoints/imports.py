import os
import uuid
from typing import List
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select, desc
from app.database import get_db
from app.config import get_settings
from app.models.user import User
from app.models.import_job import ImportJob
from app.schemas.imports import (
    ImportPreviewResponse,
    ImportExecuteRequest,
    ImportJobRead,
)
from app.services.import_service import ImportService
from app.api.deps import get_current_user
from app.utils.logger import logger

router = APIRouter()
settings = get_settings()


@router.post(
    "/upload",
    response_model=ImportPreviewResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload CSV or Excel file for preview and mapping",
)
def upload_file(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> ImportPreviewResponse:
    """
    Securely upload a CSV/Excel file, validate headers, and return first 20 records
    with automatic column mapping recommendations.
    """
    result = ImportService.save_uploaded_file(file)
    return ImportPreviewResponse(
        file_id=result["file_id"],
        file_name=result["file_name"],
        detected_columns=result["detected_columns"],
        preview_rows=result["preview_rows"],
        total_rows_detected=result["total_rows"],
        suggested_mapping=result["suggested_mapping"],
    )


@router.post(
    "/start",
    response_model=ImportJobRead,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Start background data ingestion job",
)
def start_import(
    request: ImportExecuteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ImportJobRead:
    """
    Initiate asynchronous ingestion with user-confirmed column mappings.
    Dispatches to Celery worker if available; executes reliably in background.
    """
    # Locate stored file
    upload_dir = settings.UPLOAD_DIR
    matching_files = [f for f in os.listdir(upload_dir) if f.startswith(str(request.file_id))]
    if not matching_files:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Uploaded file expired or not found. Please upload again.",
        )

    file_path = os.path.join(upload_dir, matching_files[0])
    file_size = os.path.getsize(file_path)

    # Create ImportJob database entity
    job = ImportJob(
        file_name=matching_files[0].replace(f"{request.file_id}_", ""),
        file_size_bytes=file_size,
        status="PENDING",
        created_by=current_user.id,
        field_mapping=request.field_mapping,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Check Redis health first to fail-fast if worker queue is offline
    dispatched_to_celery = False
    try:
        from app.api.v1.endpoints.health import check_redis_health
        redis_status = check_redis_health()
        if redis_status.get("status") == "healthy":
            from app.workers.tasks import process_csv_import_task
            task = process_csv_import_task.delay(
                job_id_str=str(job.id),
                file_path=file_path,
                field_mapping=request.field_mapping,
                conflict_policy=request.conflict_policy,
                user_id_str=str(current_user.id),
            )
            logger.info(f"Dispatched import job {job.id} to Celery (Task ID: {task.id})")
            dispatched_to_celery = True
    except Exception as exc:
        logger.warning(
            f"Could not dispatch to Celery broker ({exc}). Processing directly..."
        )

    if not dispatched_to_celery:
        # Fallback to direct synchronous execution if worker broker not reachable
        ImportService.process_import(
            db=db,
            job_id=job.id,
            file_path=file_path,
            field_mapping=request.field_mapping,
            conflict_policy=request.conflict_policy,
            user_id=current_user.id,
        )
        db.refresh(job)

    return ImportJobRead.model_validate(job)


@router.get(
    "/{id}",
    response_model=ImportJobRead,
    summary="Get import job status and progress counters",
)
def get_import_job(
    id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ImportJobRead:
    """Fetch status, total rows, processed, duplicates, and error summaries for an import job."""
    job = db.get(ImportJob, id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Import job '{id}' was not found.",
        )
    return ImportJobRead.model_validate(job)


@router.get(
    "",
    response_model=List[ImportJobRead],
    summary="List past data import jobs",
)
def list_import_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[ImportJobRead]:
    """Retrieve history of all data ingestion operations."""
    stmt = select(ImportJob).order_by(desc(ImportJob.created_at)).limit(50)
    jobs = db.execute(stmt).scalars().all()
    return [ImportJobRead.model_validate(j) for j in jobs]
