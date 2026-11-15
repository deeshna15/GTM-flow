"""Idempotent portfolio seed script populating demo users, accounts, contacts, enrichments, scores, and automation rules."""

from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.account import Account
from app.models.contact import Contact
from app.models.import_job import ImportJob
from app.models.job_execution import JobExecution
from app.models.user import User, UserRole
from app.services.automation_service import AutomationService
from app.services.enrichment_service import EnrichmentService
from app.services.routing_service import RoutingService
from app.services.scoring_service import ScoringService
from app.utils.logger import logger
from app.utils.security import get_password_hash


DEMO_USERS = [
    ("Alex Weber (Admin)", "admin@secfix-gtm.example", "AdminPass123!", UserRole.ADMIN),
    ("Lena Fischer", "lena@secfix-gtm.example", "SalesPass123!", UserRole.SALES),
    ("Marcus Van Der Berg", "marcus@secfix-gtm.example", "SalesPass123!", UserRole.SALES),
]

DEMO_ACCOUNTS = [
    {
        "company_name": "Northstar Security GmbH",
        "domain": "northstarsecurity.example",
        "website": "https://northstarsecurity.example",
        "industry": "Cybersecurity",
        "country": "Germany",
        "employee_count": 150,
        "description": "B2B cloud workload security and ISO 27001 readiness provider in Munich.",
        "contact": ("Hannah", "Becker", "hannah.becker@northstarsecurity.example", "Chief Information Security Officer", "Security"),
    },
    {
        "company_name": "CloudBridge SAS",
        "domain": "cloudbridge.example",
        "website": "https://cloudbridge.example",
        "industry": "SaaS",
        "country": "France",
        "employee_count": 300,
        "description": "Enterprise data infrastructure platform serving regulated EU banks.",
        "contact": ("Lucas", "Moreau", "l.moreau@cloudbridge.example", "VP of Engineering", "Engineering"),
    },
    {
        "company_name": "FinCore Pay NV",
        "domain": "fincore.example",
        "website": "https://fincore.example",
        "industry": "Fintech",
        "country": "Netherlands",
        "employee_count": 220,
        "description": "Cross-border B2B treasury payments requiring DORA and SOC 2 compliance.",
        "contact": ("Sophie", "Jansen", "sophie@fincore.example", "Head of Compliance", "Legal & Compliance"),
    },
    {
        "company_name": "CyberNest Austria",
        "domain": "cybernest.example",
        "website": "https://cybernest.example",
        "industry": "Cybersecurity",
        "country": "Austria",
        "employee_count": 120,
        "description": "Zero-trust identity management for mid-market industrial enterprises.",
        "contact": ("Tobias", "Gruber", "t.gruber@cybernest.example", "CTO", "Engineering"),
    },
    {
        "company_name": "Alpine HealthTech AG",
        "domain": "alpinehealth.example",
        "website": "https://alpinehealth.example",
        "industry": "Software",
        "country": "Switzerland",
        "employee_count": 95,
        "description": "GDPR-compliant patient diagnostics cloud software.",
        "contact": ("Clara", "Keller", "clara@alpinehealth.example", "Data Protection Officer", "Compliance"),
    },
    {
        "company_name": "Nordic Ledger AB",
        "domain": "nordicledger.example",
        "website": "https://nordicledger.example",
        "industry": "Financial Services",
        "country": "Sweden",
        "employee_count": 410,
        "description": "Automated accounting and audit platform for Nordic SMEs.",
        "contact": ("Erik", "Lindqvist", "erik@nordicledger.example", "VP Security", "Security"),
    },
    {
        "company_name": "TechNova Global",
        "domain": "technova.example",
        "website": "https://technova.example",
        "industry": "IT Services",
        "country": "India",
        "employee_count": 650,
        "description": "Outsourced application support and cloud migration consultancy.",
        "contact": ("Rohan", "Mehta", "rohan@technova.example", "Director of Delivery", "Operations"),
    },
    {
        "company_name": "DataOrbit Labs",
        "domain": "dataorbit.example",
        "website": "https://dataorbit.example",
        "industry": "Technology",
        "country": "Germany",
        "employee_count": 45,
        "description": "Real-time telemetry analytics startup scaling enterprise pipeline.",
        "contact": None,
    },
]


def seed_database(db: Optional[Session] = None) -> None:
    owns_session = db is None
    if db is None:
        db = SessionLocal()
    try:
        # 1. Seed Users
        user_map = {}
        for full_name, email, password, role in DEMO_USERS:
            existing = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
            if not existing:
                u = User(
                    full_name=full_name,
                    email=email,
                    password_hash=get_password_hash(password),
                    role=role,
                    is_active=True,
                )
                db.add(u)
                db.commit()
                db.refresh(u)
                user_map[email] = u
                logger.info(f"Seeded user: {email} ({role.value})")
            else:
                user_map[email] = existing

        admin_user = user_map["admin@secfix-gtm.example"]

        # 2. Seed Scoring Config & Automation Rules
        ScoringService.get_or_create_active_config(db, created_by=admin_user.id)
        AutomationService.ensure_default_rules(db)

        # 3. Seed Accounts, Contacts, Enrichments, Scores & Assignments
        for idx, item in enumerate(DEMO_ACCOUNTS):
            existing_acc = db.execute(
                select(Account).where(Account.domain == item["domain"])
            ).scalar_one_or_none()
            if existing_acc:
                continue

            acc = Account(
                company_name=item["company_name"],
                domain=item["domain"],
                website=item["website"],
                industry=item["industry"],
                country=item["country"],
                employee_count=item["employee_count"],
                description=item["description"],
                source="SEED_DEMO",
            )
            db.add(acc)
            db.commit()
            db.refresh(acc)

            if item["contact"]:
                fn, ln, em, title, dept = item["contact"]
                db.add(
                    Contact(
                        account_id=acc.id,
                        first_name=fn,
                        last_name=ln,
                        email=em,
                        job_title=title,
                        department=dept,
                        is_decision_maker=True,
                        buying_role="DECISION_MAKER",
                        source="SEED_DEMO",
                    )
                )
                db.commit()

            # Leave last 2 accounts pending enrichment/scoring to demo pipeline actions in UI
            if idx < len(DEMO_ACCOUNTS) - 2:
                EnrichmentService.enrich_account(
                    db=db, account_id=acc.id, current_user_id=admin_user.id
                )
                ls = ScoringService.calculate_and_save_score(
                    db=db, account_id=acc.id, current_user_id=admin_user.id
                )
                if ls.total_score >= 70:
                    RoutingService.assign_account(
                        db=db, account_id=acc.id, current_user_id=admin_user.id
                    )

        # 4. Seed sample completed ImportJob and JobExecution for dashboard/monitoring telemetry
        sample_import = db.execute(
            select(ImportJob).where(ImportJob.file_name == "secfix_eu_compliance_targets_q4.csv")
        ).scalar_one_or_none()
        if not sample_import:
            now_utc = datetime.now(timezone.utc)
            db.add(
                ImportJob(
                    file_name="secfix_eu_compliance_targets_q4.csv",
                    file_size_bytes=4820,
                    status="COMPLETED",
                    total_records=8,
                    processed_records=6,
                    duplicate_records=2,
                    failed_records=0,
                    field_mapping={
                        "Company": "company_name",
                        "Domain": "domain",
                        "Industry": "industry",
                        "Country": "country",
                        "Employees": "employee_count",
                    },
                    created_by=admin_user.id,
                    created_at=now_utc,
                    completed_at=now_utc,
                )
            )
            db.commit()

        sample_job = db.execute(
            select(JobExecution).where(JobExecution.task_id == "seed-initial-pipeline-batch")
        ).scalar_one_or_none()
        if not sample_job:
            now_utc = datetime.now(timezone.utc)
            db.add(
                JobExecution(
                    task_id="seed-initial-pipeline-batch",
                    job_type="ENRICH",
                    status="SUCCESS",
                    retry_count=0,
                    max_retries=3,
                    payload={"source": "seed", "succeeded": 6, "failed": 0},
                    started_at=now_utc,
                    completed_at=now_utc,
                )
            )
            db.commit()

        logger.info("GTMFlow database seeding completed successfully.")
    finally:
        if owns_session:
            db.close()


if __name__ == "__main__":
    seed_database()
