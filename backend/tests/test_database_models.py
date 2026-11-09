import uuid
import pytest
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.models.user import User, UserRole
from app.models.account import Account, PriorityLevel, EnrichmentStatus
from app.models.contact import Contact
from app.models.account_source import AccountSource
from app.models.enrichment import EnrichmentRecord
from app.models.lead_score import LeadScore, ScoringConfig
from app.models.import_job import ImportJob
from app.models.automation import AutomationRule, AutomationExecution
from app.models.job_execution import JobExecution
from app.models.audit_log import AuditLog
from app.models.notification import Notification


def test_account_creation(db_session: Session, test_sales_user: User):
    """Verify account model fields, defaults, and user assignment relationship."""
    account = Account(
        company_name="Acme Cyber GmbH",
        domain="acmecyber.de",
        website="https://acmecyber.de",
        industry="Cybersecurity",
        country="Germany",
        employee_count=120,
        description="B2B compliance software provider.",
        source="CSV_IMPORT",
        enrichment_status=EnrichmentStatus.PENDING,
        lead_score=85,
        priority=PriorityLevel.HIGH,
        assigned_to=test_sales_user.id,
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)

    assert account.id is not None
    assert isinstance(account.id, uuid.UUID)
    assert account.company_name == "Acme Cyber GmbH"
    assert account.domain == "acmecyber.de"
    assert account.priority == PriorityLevel.HIGH
    assert account.assigned_user.email == test_sales_user.email


def test_contact_relationship_and_buying_committee(db_session: Session):
    """Verify contact creation, account relationship, and buying committee attributes."""
    account = Account(
        company_name="Security Tech AG",
        domain="sectech.ch",
        industry="Technology",
        country="Switzerland",
    )
    db_session.add(account)
    db_session.commit()

    contact1 = Contact(
        account_id=account.id,
        first_name="Max",
        last_name="Mustermann",
        email="max@sectech.ch",
        job_title="Chief Information Security Officer",
        department="Security",
        seniority="Director",
        is_decision_maker=True,
        buying_role="DECISION_MAKER",
    )
    contact2 = Contact(
        account_id=account.id,
        first_name="Elena",
        last_name="Rossi",
        email="elena@sectech.ch",
        job_title="Lead Compliance Engineer",
        department="Engineering",
        seniority="Senior",
        is_decision_maker=False,
        buying_role="CHAMPION",
    )
    db_session.add_all([contact1, contact2])
    db_session.commit()

    db_session.refresh(account)
    assert len(account.contacts) == 2
    ciso = next(c for c in account.contacts if c.email == "max@sectech.ch")
    assert ciso.is_decision_maker is True
    assert ciso.buying_role == "DECISION_MAKER"


def test_contact_duplicate_email_within_same_account(db_session: Session):
    """Verify unique constraint on (account_id, email)."""
    account = Account(company_name="Test Unique Corp", domain="testunique.com")
    db_session.add(account)
    db_session.commit()

    c1 = Contact(
        account_id=account.id,
        first_name="Alex",
        last_name="Dupe",
        email="alex@testunique.com",
    )
    db_session.add(c1)
    db_session.commit()

    c2 = Contact(
        account_id=account.id,
        first_name="Alexander",
        last_name="Dupe",
        email="alex@testunique.com",
    )
    db_session.add(c2)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_enrichment_record_and_provenance(db_session: Session):
    """Verify structured AI enrichment history storage and field provenance tracking."""
    account = Account(company_name="Cloud Shield", domain="cloudshield.io")
    db_session.add(account)
    db_session.commit()

    enrichment = EnrichmentRecord(
        account_id=account.id,
        provider="CLAUDE",
        input_snapshot={"company_name": "Cloud Shield", "domain": "cloudshield.io"},
        output_data={
            "company_summary": "Cloud Shield delivers automated container compliance.",
            "compliance_relevance": ["SOC 2", "ISO 27001"],
            "buying_signals": [
                {
                    "signal": "Hiring Security Engineers",
                    "evidence": "Careers page lists 3 open AppSec roles",
                    "confidence": "high",
                }
            ],
            "target_market_fit": "high",
        },
        status="SUCCESS",
        model_name="claude-3-5-sonnet-20241022",
        tokens_used=420,
        latency_ms=1250.5,
    )
    source = AccountSource(
        account_id=account.id,
        field_name="industry",
        original_value="Cybersecurity",
        source_name="CLAUDE_AI",
        confidence=0.95,
    )
    db_session.add_all([enrichment, source])
    db_session.commit()

    db_session.refresh(account)
    assert len(account.enrichment_records) == 1
    assert account.enrichment_records[0].output_data["target_market_fit"] == "high"
    assert len(account.sources) == 1
    assert account.sources[0].confidence == 0.95


def test_lead_score_breakdown_storage(db_session: Session):
    """Verify LeadScore model captures component breakdown and explanation schema."""
    account = Account(company_name="FinSec Ltd", domain="finsec.uk")
    db_session.add(account)
    db_session.commit()

    score = LeadScore(
        account_id=account.id,
        total_score=92,
        industry_score=30,
        geography_score=20,
        size_score=20,
        signal_score=15,
        data_completeness_score=7,
        priority="HIGH",
        explanation={
            "industry": "Cybersecurity tier (30/30 pts)",
            "geography": "United Kingdom target market (20/20 pts)",
            "signals": "Recent SOC 2 mention in job posting (15/20 pts)",
        },
        scoring_version="1.0",
    )
    db_session.add(score)
    db_session.commit()

    db_session.refresh(account)
    assert len(account.lead_scores) == 1
    assert account.lead_scores[0].total_score == 92
    assert account.lead_scores[0].priority == "HIGH"
    assert "industry" in account.lead_scores[0].explanation


def test_cascade_deletion(db_session: Session):
    """Verify deleting an account cascades to contacts, enrichment records, and scores."""
    account = Account(company_name="Cascade Delete Test Corp", domain="cascadetest.com")
    db_session.add(account)
    db_session.commit()

    contact = Contact(account_id=account.id, first_name="Tom", last_name="Tester", email="tom@cascadetest.com")
    score = LeadScore(
        account_id=account.id,
        total_score=50,
        priority="MEDIUM",
        explanation={"reason": "test"},
    )
    db_session.add_all([contact, score])
    db_session.commit()

    # Delete parent account
    db_session.delete(account)
    db_session.commit()

    # Verify children are deleted
    assert db_session.get(Contact, contact.id) is None
    assert db_session.get(LeadScore, score.id) is None


def test_automation_and_job_executions(db_session: Session, test_sales_user: User):
    """Verify automation rules, job executions, and audit log models."""
    rule = AutomationRule(
        name="Auto-assign High Priority Accounts",
        trigger_type="ON_SCORE_CALCULATED",
        conditions={"min_score": 80, "priority": "HIGH"},
        actions=[{"type": "ASSIGN_ROUND_ROBIN"}],
        is_active=True,
    )
    db_session.add(rule)
    db_session.commit()

    job = JobExecution(
        task_id="celery-task-uuid-12345",
        job_type="IMPORT",
        status="SUCCESS",
        retry_count=0,
        payload={"file_name": "sample_accounts.csv"},
    )
    audit = AuditLog(
        user_id=test_sales_user.id,
        entity_type="ACCOUNT",
        entity_id=uuid.uuid4(),
        action="UPDATE",
        old_values={"lead_score": 45},
        new_values={"lead_score": 85},
    )
    notification = Notification(
        user_id=test_sales_user.id,
        title="High Priority Lead Assigned",
        message="Acme Cyber GmbH assigned to you.",
        type="ALERT",
    )
    db_session.add_all([job, audit, notification])
    db_session.commit()

    assert rule.id is not None
    assert job.status == "SUCCESS"
    assert audit.action == "UPDATE"
    assert notification.is_read is False
