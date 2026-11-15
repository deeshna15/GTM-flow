import math
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.orm.attributes import flag_modified
from app.integrations.claude_client import ClaudeClient
from app.models.account import Account, EnrichmentStatus
from app.models.enrichment import EnrichmentRecord
from app.models.job_execution import JobExecution
from app.services.audit_service import AuditService
from app.utils.logger import logger


class EnrichmentService:
    @staticmethod
    def build_input_snapshot(account: Account) -> Dict[str, Any]:
        """Assemble grounded company evidence from database records."""
        contacts_evidence = [
            {
                "job_title": c.job_title,
                "department": c.department,
                "seniority": c.seniority,
                "buying_role": c.buying_role,
                "is_decision_maker": c.is_decision_maker,
            }
            for c in (account.contacts or [])[:10]
            if c.job_title or c.department
        ]

        source_names = sorted(
            list({s.source_name for s in (account.sources or []) if s.source_name})
        )

        return {
            "account_id": str(account.id),
            "company_name": account.company_name,
            "domain": account.domain,
            "website": account.website,
            "industry": account.industry,
            "country": account.country,
            "employee_count": account.employee_count,
            "description": account.description,
            "primary_source": account.source,
            "provenance_sources": source_names,
            "known_contact_roles": contacts_evidence,
        }

    @staticmethod
    def enrich_account(
        db: Session,
        account_id: uuid.UUID,
        current_user_id: Optional[uuid.UUID] = None,
        claude_client: Optional[ClaudeClient] = None,
    ) -> EnrichmentRecord:
        """Run AI company enrichment for a single account and persist the structured result."""
        stmt = (
            select(Account)
            .where(Account.id == account_id)
            .options(selectinload(Account.contacts), selectinload(Account.sources))
        )
        account = db.execute(stmt).scalar_one_or_none()
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Account '{account_id}' not found.",
            )

        snapshot = EnrichmentService.build_input_snapshot(account)
        client = claude_client or ClaudeClient()
        result = client.analyze_company(snapshot)

        record = EnrichmentRecord(
            account_id=account.id,
            provider=result.provider,
            input_snapshot=snapshot,
            output_data=result.payload.model_dump() if result.payload else None,
            status="COMPLETED" if result.success else "FAILED",
            model_name=result.model_name,
            tokens_used=result.tokens_used,
            latency_ms=result.latency_ms,
            error_message=result.error_message,
        )
        db.add(record)

        account.enrichment_status = (
            EnrichmentStatus.COMPLETED if result.success else EnrichmentStatus.FAILED
        )

        db.commit()
        db.refresh(record)

        AuditService.log_event(
            db=db,
            action="ENRICH",
            entity_type="ACCOUNT",
            entity_id=account.id,
            user_id=current_user_id,
            new_values={
                "enrichment_id": str(record.id),
                "status": record.status,
                "provider": record.provider,
                "model_name": record.model_name,
                "tokens_used": record.tokens_used,
                "target_market_fit": (
                    result.payload.target_market_fit if result.payload else None
                ),
            },
        )
        db.commit()

        logger.info(
            f"Enriched account '{account.company_name}' ({account.id}): "
            f"status={record.status}, provider={record.provider}, tokens={record.tokens_used}"
        )
        return record

    @staticmethod
    def get_account_enrichments(
        db: Session, account_id: uuid.UUID
    ) -> List[EnrichmentRecord]:
        """Fetch enrichment history for a specific account."""
        account_exists = db.execute(
            select(Account.id).where(Account.id == account_id)
        ).scalar_one_or_none()
        if not account_exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Account '{account_id}' not found.",
            )

        stmt = (
            select(EnrichmentRecord)
            .where(EnrichmentRecord.account_id == account_id)
            .order_by(desc(EnrichmentRecord.created_at))
        )
        return list(db.execute(stmt).scalars().all())

    @staticmethod
    def list_enrichment_feed(
        db: Session,
        status_filter: Optional[str] = None,
        review_status: Optional[str] = None,
        page: int = 1,
        size: int = 20,
    ) -> Dict[str, Any]:
        """Return paginated enrichment records across all accounts."""
        page = max(1, page)
        size = min(max(1, size), 100)

        query = select(EnrichmentRecord).options(selectinload(EnrichmentRecord.account))
        if status_filter:
            query = query.where(EnrichmentRecord.status == status_filter.upper())

        query = query.order_by(desc(EnrichmentRecord.created_at))
        all_records = list(db.execute(query).scalars().all())

        if review_status:
            target = review_status.upper()
            all_records = [
                r
                for r in all_records
                if (r.output_data or {}).get("review_status", "PENDING_REVIEW") == target
            ]

        total = len(all_records)
        pages = math.ceil(total / size) if total > 0 else 1
        start = (page - 1) * size
        items = all_records[start : start + size]

        return {
            "items": items,
            "total": total,
            "page": page,
            "size": size,
            "pages": pages,
        }

    @staticmethod
    def review_enrichment(
        db: Session,
        record_id: uuid.UUID,
        decision: str,
        apply_industry: bool = True,
        apply_summary: bool = False,
        current_user_id: Optional[uuid.UUID] = None,
    ) -> EnrichmentRecord:
        """Approve or reject AI enrichment suggestions and optionally apply to Account."""
        stmt = (
            select(EnrichmentRecord)
            .where(EnrichmentRecord.id == record_id)
            .options(selectinload(EnrichmentRecord.account))
        )
        record = db.execute(stmt).scalar_one_or_none()
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Enrichment record '{record_id}' not found.",
            )

        if record.status != "COMPLETED" or not record.output_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only completed enrichment records with output data can be reviewed.",
            )

        new_review_status = "APPROVED" if decision == "APPROVE" else "REJECTED"
        updated_output = dict(record.output_data)
        updated_output["review_status"] = new_review_status
        updated_output["reviewed_at"] = datetime.now(timezone.utc).isoformat()
        if current_user_id:
            updated_output["reviewed_by"] = str(current_user_id)

        record.output_data = updated_output
        flag_modified(record, "output_data")

        applied_fields: Dict[str, Any] = {}
        account = record.account
        if decision == "APPROVE" and account:
            if apply_industry and updated_output.get("industry_classification"):
                account.industry = updated_output["industry_classification"]
                applied_fields["industry"] = account.industry
            if apply_summary and updated_output.get("company_summary"):
                account.description = updated_output["company_summary"]
                applied_fields["description"] = account.description

        db.commit()
        db.refresh(record)

        if account:
            AuditService.log_event(
                db=db,
                action="ENRICHMENT_REVIEW",
                entity_type="ACCOUNT",
                entity_id=account.id,
                user_id=current_user_id,
                new_values={
                    "enrichment_id": str(record.id),
                    "decision": new_review_status,
                    "applied_fields": applied_fields,
                },
            )
            db.commit()

        return record

    @staticmethod
    def execute_bulk_enrichment(
        db: Session,
        account_ids: List[uuid.UUID],
        job_execution_id: Optional[uuid.UUID] = None,
        current_user_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, int]:
        """Synchronously process a batch of account enrichments and update JobExecution."""
        succeeded = 0
        failed = 0

        for acc_id in account_ids:
            try:
                rec = EnrichmentService.enrich_account(
                    db=db,
                    account_id=acc_id,
                    current_user_id=current_user_id,
                )
                if rec.status == "COMPLETED":
                    succeeded += 1
                else:
                    failed += 1
            except Exception as exc:
                logger.error(f"Bulk enrichment failed for account {acc_id}: {exc}")
                failed += 1

        if job_execution_id:
            job = db.execute(
                select(JobExecution).where(JobExecution.id == job_execution_id)
            ).scalar_one_or_none()
            if job:
                job.status = "SUCCESS" if failed == 0 or succeeded > 0 else "FAILED"
                job.completed_at = datetime.now(timezone.utc)
                job.payload = {
                    **(job.payload or {}),
                    "succeeded": succeeded,
                    "failed": failed,
                }
                if failed > 0 and succeeded == 0:
                    job.error_message = f"All {failed} enrichment tasks failed."
                db.commit()

        return {"succeeded": succeeded, "failed": failed}
