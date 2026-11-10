import os
import uuid
import shutil
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import UploadFile, HTTPException, status
from sqlalchemy.orm import Session
from app.config import get_settings
from app.models.account import Account, PriorityLevel, EnrichmentStatus
from app.models.account_source import AccountSource
from app.models.import_job import ImportJob
from app.models.audit_log import AuditLog
from app.schemas.imports import ImportRowSchema
from app.utils.csv_parser import CSVParser
from app.services.normalization_service import NormalizationService
from app.services.deduplication_service import DeduplicationService
from app.services.audit_service import AuditService
from app.utils.logger import logger

settings = get_settings()


class ImportService:
    @staticmethod
    def save_uploaded_file(file: UploadFile) -> Dict[str, Any]:
        """
        Validate file extension, size, and store safely in upload directory.
        """
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

        filename = file.filename or "upload.csv"
        ext = os.path.splitext(filename)[1].lower().replace(".", "")

        if ext not in settings.ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format '{ext}'. Allowed extensions are: {', '.join(settings.ALLOWED_EXTENSIONS)}",
            )

        file_id = uuid.uuid4()
        saved_filename = f"{file_id}_{filename}"
        saved_path = os.path.join(settings.UPLOAD_DIR, saved_filename)

        # Stream file to disk to verify size
        size_bytes = 0
        max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024

        with open(saved_path, "wb") as buffer:
            while chunk := file.file.read(1024 * 64):  # 64KB chunks
                size_bytes += len(chunk)
                if size_bytes > max_bytes:
                    os.remove(saved_path)
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds maximum upload limit of {settings.MAX_UPLOAD_SIZE_MB}MB.",
                    )
                buffer.write(chunk)

        # Extract column preview
        try:
            columns, preview_rows, total_rows = CSVParser.get_preview_and_columns(saved_path)
            suggested_mapping = CSVParser.suggest_mappings(columns)
        except Exception as e:
            if os.path.exists(saved_path):
                os.remove(saved_path)
            logger.error(f"Failed to parse uploaded file: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Could not parse file structure: {str(e)}",
            )

        return {
            "file_id": file_id,
            "file_name": filename,
            "saved_path": saved_path,
            "file_size_bytes": size_bytes,
            "detected_columns": columns,
            "preview_rows": preview_rows,
            "total_rows": total_rows,
            "suggested_mapping": suggested_mapping,
        }

    @staticmethod
    def process_import(
        db: Session,
        job_id: uuid.UUID,
        file_path: str,
        field_mapping: Dict[str, str],
        conflict_policy: str = "PRESERVE_EXISTING",
        user_id: Optional[uuid.UUID] = None,
    ) -> ImportJob:
        """
        Execute robust chunked data ingestion:
        - Row-level Pydantic validation
        - Domain and string normalization
        - Deduplication check (Domain -> Name + Country -> Exact Name)
        - Provenance storage in account_sources
        - Conflict resolution policy enforcement
        - Transaction safety per batch
        """
        job = db.get(ImportJob, job_id)
        if not job:
            raise ValueError(f"Import job '{job_id}' not found.")

        job.status = "PROCESSING"
        job.field_mapping = field_mapping
        db.commit()

        processed_count = 0
        duplicate_count = 0
        failed_count = 0
        total_count = 0
        errors_list: List[Dict[str, Any]] = []

        try:
            for chunk_records in CSVParser.iterate_chunks(file_path, chunk_size=100):
                for raw_record in chunk_records:
                    total_count += 1
                    row_number = total_count

                    # Map raw CSV columns to standard GTMFlow fields
                    mapped_data: Dict[str, Any] = {}
                    for csv_col, gtm_field in field_mapping.items():
                        if csv_col in raw_record and gtm_field:
                            val = str(raw_record[csv_col]).strip()
                            if val:
                                mapped_data[gtm_field] = val

                    # 1. Validate mapped record with Pydantic
                    try:
                        validated_row = ImportRowSchema(**mapped_data)
                    except Exception as val_err:
                        failed_count += 1
                        errors_list.append({
                            "row": row_number,
                            "raw_record": raw_record,
                            "error": str(val_err),
                        })
                        continue

                    # 2. Normalization
                    norm_domain = NormalizationService.normalize_domain(
                        validated_row.domain or validated_row.website
                    )
                    norm_company = NormalizationService.normalize_company_name(
                        validated_row.company_name
                    )

                    # 3. Deduplication Check
                    existing_acc, match_rule = DeduplicationService.find_duplicate(
                        db=db,
                        company_name=norm_company,
                        domain=norm_domain,
                        country=validated_row.country,
                    )

                    if existing_acc:
                        duplicate_count += 1
                        logger.debug(
                            f"Row {row_number}: Duplicate detected for '{norm_company}' "
                            f"matched existing account '{existing_acc.company_name}' via {match_rule}"
                        )

                        # Non-destructive Conflict Policy:
                        # If existing account has missing fields, fill them. Preserve existing if populated.
                        if conflict_policy == "OVERWRITE_EMPTY" or conflict_policy == "PRESERVE_EXISTING":
                            if not existing_acc.industry and validated_row.industry:
                                existing_acc.industry = validated_row.industry.strip()
                            if not existing_acc.country and validated_row.country:
                                existing_acc.country = validated_row.country.strip()
                            if not existing_acc.employee_count and validated_row.employee_count:
                                existing_acc.employee_count = validated_row.employee_count
                            if not existing_acc.description and validated_row.description:
                                existing_acc.description = validated_row.description.strip()

                        # Always record incoming provenance in account_sources
                        source_entry = AccountSource(
                            account_id=existing_acc.id,
                            field_name="raw_import_record",
                            original_value=str(mapped_data),
                            source_name=f"CSV_IMPORT_{job.file_name}",
                            confidence=0.85,
                        )
                        db.add(source_entry)
                    else:
                        # 4. Insert new account
                        new_account = Account(
                            company_name=norm_company,
                            domain=norm_domain,
                            website=NormalizationService.normalize_website(validated_row.website or norm_domain),
                            industry=validated_row.industry.strip() if validated_row.industry else None,
                            country=validated_row.country.strip() if validated_row.country else None,
                            employee_count=validated_row.employee_count,
                            description=validated_row.description.strip() if validated_row.description else None,
                            source=f"CSV_IMPORT ({job.file_name})",
                            enrichment_status=EnrichmentStatus.PENDING,
                        )
                        db.add(new_account)
                        db.flush()  # Generate UUID without ending transaction

                        # Provenance tracking
                        source_entry = AccountSource(
                            account_id=new_account.id,
                            field_name="initial_ingestion",
                            original_value=str(mapped_data),
                            source_name=f"CSV_IMPORT_{job.file_name}",
                            confidence=1.0,
                        )
                        db.add(source_entry)
                        processed_count += 1

                # Commit chunk transaction safely
                db.commit()

            # Finalize Job Record
            job.total_records = total_count
            job.processed_records = processed_count
            job.duplicate_records = duplicate_count
            job.failed_records = failed_count
            job.error_summary = errors_list[:50]  # Store first 50 errors
            job.completed_at = datetime.now(timezone.utc)

            if failed_count == 0:
                job.status = "COMPLETED"
            elif processed_count > 0 or duplicate_count > 0:
                job.status = "PARTIAL"
            else:
                job.status = "FAILED"

            db.commit()
            logger.info(
                f"Import job {job_id} finished: status={job.status}, "
                f"total={total_count}, inserted={processed_count}, duplicates={duplicate_count}, failed={failed_count}"
            )
            return job

        except Exception as e:
            db.rollback()
            job.status = "FAILED"
            job.error_summary = [{"error": str(e)}]
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            logger.error(f"Import job {job_id} failed with unhandled exception: {e}")
            raise
