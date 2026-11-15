import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.account import Account, EnrichmentStatus
from app.models.contact import Contact
from app.models.enrichment import EnrichmentRecord
from app.models.user import User, UserRole
from app.utils.security import get_password_hash


@pytest.fixture
def icp_accounts(db_session: Session):
    high_acc = Account(
        company_name="Berlin Shield GmbH",
        domain="berlinshield.example",
        industry="Cybersecurity",
        country="Germany",
        employee_count=180,
        description="ISO 27001 security compliance software",
        enrichment_status=EnrichmentStatus.COMPLETED,
    )
    low_acc = Account(
        company_name="Local Bakery",
        domain=None,
        industry="Hospitality",
        country="Brazil",
        employee_count=8,
        enrichment_status=EnrichmentStatus.PENDING,
    )
    db_session.add_all([high_acc, low_acc])
    db_session.commit()
    db_session.refresh(high_acc)
    db_session.refresh(low_acc)

    # Add contact & enrichment to high_acc for top completeness & signal points
    contact = Contact(
        account_id=high_acc.id,
        first_name="Elena",
        last_name="Fischer",
        email="elena@berlinshield.example",
        job_title="CISO",
        is_decision_maker=True,
    )
    enr = EnrichmentRecord(
        account_id=high_acc.id,
        provider="CLAUDE",
        input_snapshot={"company_name": high_acc.company_name},
        output_data={
            "target_market_fit": "high",
            "compliance_relevance": ["ISO 27001", "SOC 2", "GDPR"],
            "buying_signals": [
                {"signal": "EU enterprise growth", "evidence": "DE cyber", "confidence": "high"},
                {"signal": "Compliance demand", "evidence": "ISO 27001 mention", "confidence": "high"},
            ],
            "recommended_next_action": "Reach out to CISO regarding ISO 27001 automation.",
        },
        status="COMPLETED",
        model_name="claude-3-5-sonnet-20241022",
    )
    db_session.add_all([contact, enr])
    db_session.commit()
    return high_acc, low_acc


def test_deterministic_scoring_high_and_low_icp(
    client: TestClient, sales_token: str, icp_accounts, db_session: Session
):
    high_acc, low_acc = icp_accounts
    headers = {"Authorization": f"Bearer {sales_token}"}

    # Score high ICP account
    r1 = client.post(f"/api/v1/accounts/{high_acc.id}/score", headers=headers)
    assert r1.status_code == 200
    d1 = r1.json()
    assert d1["total_score"] >= 90
    assert d1["priority"] == "HIGH"
    assert d1["industry_score"] == 30
    assert d1["geography_score"] == 20
    assert d1["size_score"] == 20
    assert d1["data_completeness_score"] == 10
    assert len(d1["explanation"]["reasons"]) == 5

    # Score low ICP account
    r2 = client.post(f"/api/v1/accounts/{low_acc.id}/score", headers=headers)
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["total_score"] < 50
    assert d2["priority"] == "LOW"

    # Check account detail serializes lead_scores list properly
    det = client.get(f"/api/v1/accounts/{high_acc.id}", headers=headers)
    assert det.status_code == 200
    assert det.json()["lead_score"] == d1["total_score"]
    assert len(det.json()["lead_scores"]) == 1


def test_scoring_config_rbac_and_dynamic_update(
    client: TestClient, sales_token: str, admin_token: str, icp_accounts
):
    high_acc, _ = icp_accounts

    # Sales cannot edit scoring config
    forb = client.patch(
        "/api/v1/scoring/config",
        json={"name": "Unauthorized Edit"},
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert forb.status_code == 403

    # Admin updates scoring weights
    upd = client.patch(
        "/api/v1/scoring/config",
        json={
            "name": "Custom Weight ICP",
            "weights": {"industry": 40, "geography": 20, "size": 15, "signals": 15, "completeness": 10},
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert upd.status_code == 200
    assert upd.json()["weights"]["industry"] == 40

    # Re-scoring reflects new industry max weight
    scored = client.post(
        f"/api/v1/accounts/{high_acc.id}/score",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert scored.status_code == 200
    assert scored.json()["industry_score"] == 40


def test_least_loaded_sales_routing_and_notifications(
    client: TestClient, admin_token: str, icp_accounts, db_session: Session
):
    high_acc, low_acc = icp_accounts
    # Create two active SALES reps
    rep1 = User(
        full_name="Rep One",
        email="rep1@secfix.example",
        password_hash=get_password_hash("Password123!"),
        role=UserRole.SALES,
        is_active=True,
    )
    rep2 = User(
        full_name="Rep Two",
        email="rep2@secfix.example",
        password_hash=get_password_hash("Password123!"),
        role=UserRole.SALES,
        is_active=True,
    )
    db_session.add_all([rep1, rep2])
    db_session.commit()
    db_session.refresh(rep1)
    db_session.refresh(rep2)

    headers = {"Authorization": f"Bearer {admin_token}"}

    # Score accounts first
    bulk_score = client.post(
        "/api/v1/accounts/bulk-score",
        json={"rescore_all": True},
        headers=headers,
    )
    assert bulk_score.status_code == 200
    assert bulk_score.json()["scored_count"] == 2

    # Bulk assign unassigned accounts -> should distribute evenly 1 to rep1, 1 to rep2
    bulk_assign = client.post(
        "/api/v1/accounts/bulk-assign",
        json={"only_high_priority": False},
        headers=headers,
    )
    assert bulk_assign.status_code == 200
    assignments = bulk_assign.json()["assignments"]
    assert len(assignments) == 2
    assigned_reps = {a["assigned_to"] for a in assignments}
    assert assigned_reps == {str(rep1.id), str(rep2.id)}

    # Check scoring overview endpoint
    overview = client.get("/api/v1/scoring/overview", headers=headers)
    assert overview.status_code == 200
    ov = overview.json()
    assert ov["total_accounts"] == 2
    assert ov["high_count"] == 1
    assert ov["low_count"] == 1
