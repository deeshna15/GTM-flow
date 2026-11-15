from collections import Counter
from typing import Any, Dict
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, selectinload
from app.models.account import Account, EnrichmentStatus, PriorityLevel
from app.models.audit_log import AuditLog
from app.models.contact import Contact
from app.models.import_job import ImportJob
from app.models.job_execution import JobExecution


class DashboardService:
    @staticmethod
    def get_overview(db: Session) -> Dict[str, Any]:
        """Compute real-time analytics directly from PostgreSQL tables."""
        accounts = list(
            db.execute(
                select(Account)
                .options(selectinload(Account.assigned_user))
                .order_by(desc(Account.lead_score).nulls_last(), desc(Account.created_at))
            )
            .scalars()
            .all()
        )
        total_accounts = len(accounts)
        total_contacts = db.execute(select(func.count(Contact.id))).scalar() or 0

        high_c = sum(1 for a in accounts if a.priority == PriorityLevel.HIGH)
        med_c = sum(1 for a in accounts if a.priority == PriorityLevel.MEDIUM)
        low_c = sum(1 for a in accounts if a.priority == PriorityLevel.LOW)
        pending_enrich = sum(
            1 for a in accounts if a.enrichment_status != EnrichmentStatus.COMPLETED
        )
        enriched_c = sum(
            1 for a in accounts if a.enrichment_status == EnrichmentStatus.COMPLETED
        )

        scored = [a.lead_score for a in accounts if a.lead_score is not None]
        avg_score = round(sum(scored) / len(scored), 1) if scored else 0.0

        # Background jobs status across ImportJob & JobExecution
        import_jobs = list(
            db.execute(select(ImportJob).order_by(desc(ImportJob.created_at)))
            .scalars()
            .all()
        )
        job_execs = list(db.execute(select(JobExecution)).scalars().all())

        successful_jobs = sum(
            1 for j in import_jobs if j.status in ("COMPLETED", "PARTIAL")
        ) + sum(1 for j in job_execs if j.status == "SUCCESS")

        failed_jobs = sum(1 for j in import_jobs if j.status == "FAILED") + sum(
            1 for j in job_execs if j.status == "FAILED"
        )

        pending_jobs = sum(
            1 for j in import_jobs if j.status in ("PENDING", "PROCESSING")
        ) + sum(1 for j in job_execs if j.status in ("PENDING", "RUNNING"))

        # Industry & Country distributions
        industry_counts = Counter(
            (a.industry.strip() if a.industry and a.industry.strip() else "Unclassified")
            for a in accounts
        )
        country_counts = Counter(
            (a.country.strip() if a.country and a.country.strip() else "Unspecified")
            for a in accounts
        )

        industry_distribution = [
            {"name": name, "count": cnt}
            for name, cnt in industry_counts.most_common(8)
        ]
        country_distribution = [
            {"name": name, "count": cnt}
            for name, cnt in country_counts.most_common(8)
        ]
        unscored_c = sum(1 for a in accounts if a.priority is None)
        priority_distribution = [
            {"name": "High", "count": high_c},
            {"name": "Medium", "count": med_c},
            {"name": "Low", "count": low_c},
            {"name": "Unscored", "count": unscored_c},
        ]

        recent_imports = [
            {
                "id": j.id,
                "file_name": j.file_name,
                "status": j.status,
                "total_records": j.total_records,
                "processed_records": j.processed_records,
                "duplicate_records": j.duplicate_records,
                "failed_records": j.failed_records,
                "created_at": j.created_at,
            }
            for j in import_jobs[:5]
        ]

        audits = list(
            db.execute(select(AuditLog).order_by(desc(AuditLog.created_at)).limit(10))
            .scalars()
            .all()
        )
        recent_activities = [
            {
                "id": act.id,
                "action": act.action,
                "entity_type": act.entity_type,
                "entity_id": act.entity_id,
                "new_values": act.new_values,
                "created_at": act.created_at,
            }
            for act in audits
        ]

        top_priority_accounts = [
            {
                "id": a.id,
                "company_name": a.company_name,
                "domain": a.domain,
                "industry": a.industry,
                "country": a.country,
                "employee_count": a.employee_count,
                "lead_score": a.lead_score,
                "priority": a.priority.value if a.priority else None,
                "enrichment_status": a.enrichment_status.value if a.enrichment_status else "PENDING",
                "assigned_user_name": a.assigned_user.full_name if a.assigned_user else None,
            }
            for a in accounts[:6]
        ]

        return {
            "total_accounts": total_accounts,
            "total_contacts": total_contacts,
            "high_priority_accounts": high_c,
            "medium_priority_accounts": med_c,
            "low_priority_accounts": low_c,
            "accounts_awaiting_enrichment": pending_enrich,
            "enriched_accounts": enriched_c,
            "average_lead_score": avg_score,
            "successful_jobs": successful_jobs,
            "failed_jobs": failed_jobs,
            "pending_jobs": pending_jobs,
            "industry_distribution": industry_distribution,
            "country_distribution": country_distribution,
            "priority_distribution": priority_distribution,
            "recent_imports": recent_imports,
            "recent_activities": recent_activities,
            "top_priority_accounts": top_priority_accounts,
        }
