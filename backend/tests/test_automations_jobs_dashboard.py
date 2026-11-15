from datetime import datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.account import Account, EnrichmentStatus, PriorityLevel
from app.models.contact import Contact
from app.models.import_job import ImportJob
from app.models.job_execution import JobExecution


def test_automation_rules_seed_crud_and_execution(
    client: TestClient, admin_token: str, sales_token: str, db_session: Session, test_sales_user
):
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    sales_headers = {"Authorization": f"Bearer {sales_token}"}

    # 1. Listing rules auto-seeds defaults
    rules_res = client.get("/api/v1/automations/rules", headers=sales_headers)
    assert rules_res.status_code == 200
    rules = rules_res.json()
    assert len(rules) >= 3

    # 2. Sales cannot create rule (403)
    forb = client.post(
        "/api/v1/automations/rules",
        json={
            "name": "Unauthorized",
            "trigger_type": "MANUAL",
            "conditions": {},
            "actions": ["SCORE_ACCOUNT"],
        },
        headers=sales_headers,
    )
    assert forb.status_code == 403

    # 3. Admin creates custom rule & triggers it
    acc_match = Account(
        company_name="Munich Cloud GmbH",
        domain="munichcloud.example",
        industry="SaaS",
        country="Germany",
        employee_count=200,
        lead_score=88,
        priority=PriorityLevel.HIGH,
        enrichment_status=EnrichmentStatus.COMPLETED,
    )
    acc_skip = Account(
        company_name="Small Cafe",
        country="Spain",
        lead_score=25,
        priority=PriorityLevel.LOW,
    )
    db_session.add_all([acc_match, acc_skip])
    db_session.commit()

    create_res = client.post(
        "/api/v1/automations/rules",
        json={
            "name": "Route High Score DE Accounts",
            "description": "Assign high score unassigned accounts and create alert",
            "trigger_type": "ON_SCORE_CALCULATED",
            "conditions": {"min_score": 80, "unassigned_only": True},
            "actions": ["AUTO_ASSIGN_REP", "CREATE_ALERT"],
            "is_active": True,
        },
        headers=admin_headers,
    )
    assert create_res.status_code == 201
    rule_id = create_res.json()["id"]

    # Run rule
    run_res = client.post(f"/api/v1/automations/rules/{rule_id}/run", headers=admin_headers)
    assert run_res.status_code == 200
    run_data = run_res.json()
    assert run_data["succeeded"] == 1
    assert run_data["skipped"] == 1

    # Verify notification created for assigned sales user
    notif_res = client.get("/api/v1/notifications", headers=sales_headers)
    assert notif_res.status_code == 200
    assert notif_res.json()["unread_count"] >= 1
    notif_id = notif_res.json()["items"][0]["id"]

    # Mark notification read
    read_res = client.post(f"/api/v1/notifications/{notif_id}/read", headers=sales_headers)
    assert read_res.status_code == 200
    assert read_res.json()["is_read"] is True

    # Check executions log
    exec_res = client.get(f"/api/v1/automations/executions?rule_id={rule_id}", headers=sales_headers)
    assert exec_res.status_code == 200
    assert len(exec_res.json()) == 1
    assert exec_res.json()[0]["status"] == "SUCCESS"


def test_jobs_monitoring_and_retry_flow(
    client: TestClient, admin_token: str, db_session: Session
):
    headers = {"Authorization": f"Bearer {admin_token}"}
    acc = Account(company_name="Retry Corp", country="Germany", industry="SaaS")
    db_session.add(acc)
    db_session.commit()
    db_session.refresh(acc)

    failed_job = JobExecution(
        task_id="failed-enrich-test-1",
        job_type="ENRICH",
        status="FAILED",
        retry_count=0,
        max_retries=2,
        payload={"account_ids": [str(acc.id)]},
        error_message="Simulated transient error",
    )
    db_session.add(failed_job)
    db_session.commit()
    db_session.refresh(failed_job)

    list_res = client.get("/api/v1/jobs", headers=headers)
    assert list_res.status_code == 200
    assert list_res.json()["failed_jobs"] >= 1

    worker_res = client.get("/api/v1/jobs/worker-status", headers=headers)
    assert worker_res.status_code == 200
    assert "scheduled_jobs" in worker_res.json()

    retry_res = client.post(f"/api/v1/jobs/{failed_job.id}/retry", headers=headers)
    assert retry_res.status_code == 200
    assert retry_res.json()["retry_count"] == 1
    assert retry_res.json()["status"] == "SUCCESS"


def test_users_management_and_dashboard_overview(
    client: TestClient, admin_token: str, db_session: Session, test_admin_user
):
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Admin invites a new team member
    invite_res = client.post(
        "/api/v1/users",
        json={
            "full_name": "New Sales Rep",
            "email": "newrep@secfix.example",
            "password": "StrongPassword123!",
            "role": "SALES",
        },
        headers=headers,
    )
    assert invite_res.status_code == 201

    users_res = client.get("/api/v1/users", headers=headers)
    assert users_res.status_code == 200
    assert len(users_res.json()) >= 2

    # Populate sample records for real dashboard analytics
    a1 = Account(
        company_name="Dash Cyber GmbH",
        domain="dashcyber.example",
        industry="Cybersecurity",
        country="Germany",
        employee_count=120,
        lead_score=91,
        priority=PriorityLevel.HIGH,
        enrichment_status=EnrichmentStatus.COMPLETED,
    )
    db_session.add(a1)
    db_session.commit()
    db_session.refresh(a1)

    c1 = Contact(account_id=a1.id, first_name="Max", last_name="Mustermann", email="max@dashcyber.example")
    imp = ImportJob(
        file_name="demo.csv",
        file_size_bytes=512,
        status="COMPLETED",
        total_records=1,
        processed_records=1,
        created_by=test_admin_user.id,
        completed_at=datetime.now(timezone.utc),
    )
    db_session.add_all([c1, imp])
    db_session.commit()

    dash_res = client.get("/api/v1/dashboard/overview", headers=headers)
    assert dash_res.status_code == 200
    dash = dash_res.json()
    assert dash["total_accounts"] >= 1
    assert dash["total_contacts"] >= 1
    assert dash["high_priority_accounts"] >= 1
    assert dash["successful_jobs"] >= 1
    assert len(dash["industry_distribution"]) >= 1
    assert len(dash["country_distribution"]) >= 1


def test_seed_database_idempotent(db_session: Session):
    """Verify demo seed script runs cleanly and produces exact expected counts idempotently."""
    from sqlalchemy import func, select
    from app.models.account import Account
    from app.models.contact import Contact
    from app.models.user import User
    from app.seed import DEMO_ACCOUNTS, DEMO_USERS, seed_database

    seed_database(db=db_session)
    # Run a second time to verify idempotency
    seed_database(db=db_session)

    users_count = db_session.execute(select(func.count(User.id))).scalar()
    accounts_count = db_session.execute(select(func.count(Account.id))).scalar()
    contacts_count = db_session.execute(select(func.count(Contact.id))).scalar()

    assert users_count == len(DEMO_USERS)
    assert accounts_count == len(DEMO_ACCOUNTS)
    assert contacts_count == sum(1 for a in DEMO_ACCOUNTS if a["contact"] is not None)
