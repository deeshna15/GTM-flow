import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.account import Account, PriorityLevel, EnrichmentStatus


@pytest.fixture
def sample_accounts(db_session: Session):
    accounts = [
        Account(
            company_name="Alpha Cyber",
            domain="alphacyber.de",
            industry="Cybersecurity",
            country="Germany",
            employee_count=150,
            lead_score=90,
            priority=PriorityLevel.HIGH,
            enrichment_status=EnrichmentStatus.COMPLETED,
        ),
        Account(
            company_name="Beta Cloud",
            domain="betacloud.fr",
            industry="SaaS",
            country="France",
            employee_count=300,
            lead_score=60,
            priority=PriorityLevel.MEDIUM,
            enrichment_status=EnrichmentStatus.PENDING,
        ),
        Account(
            company_name="Gamma Data",
            domain="gammadata.nl",
            industry="Technology",
            country="Netherlands",
            employee_count=45,
            lead_score=35,
            priority=PriorityLevel.LOW,
            enrichment_status=EnrichmentStatus.PENDING,
        ),
    ]
    db_session.add_all(accounts)
    db_session.commit()
    return accounts


def test_list_accounts_unauthenticated(client: TestClient):
    """Verify that account listing requires authentication."""
    response = client.get("/api/v1/accounts")
    assert response.status_code == 401


def test_list_accounts_pagination_and_total(client: TestClient, sales_token: str, sample_accounts):
    """Verify paginated accounts response."""
    response = client.get(
        "/api/v1/accounts?page=1&size=2",
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3
    assert len(data["items"]) == 2
    assert data["pages"] == 2


def test_list_accounts_search(client: TestClient, sales_token: str, sample_accounts):
    """Verify searching accounts by company name and domain."""
    response = client.get(
        "/api/v1/accounts?search=alpha",
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["company_name"] == "Alpha Cyber"

    # Search by domain
    res2 = client.get(
        "/api/v1/accounts?search=betacloud.fr",
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert res2.status_code == 200
    assert res2.json()["total"] == 1


def test_list_accounts_filter_by_priority(client: TestClient, sales_token: str, sample_accounts):
    """Verify filtering accounts by priority level."""
    response = client.get(
        "/api/v1/accounts?priority=HIGH",
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["priority"] == "HIGH"


def test_list_accounts_sorting(client: TestClient, sales_token: str, sample_accounts):
    """Verify sorting accounts by lead_score descending."""
    response = client.get(
        "/api/v1/accounts?sort_by=lead_score&sort_order=desc",
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert response.status_code == 200
    items = response.json()["items"]
    assert items[0]["lead_score"] == 90
    assert items[-1]["lead_score"] == 35


def test_create_account_success(client: TestClient, sales_token: str):
    """Verify creating an account with domain normalization."""
    payload = {
        "company_name": "  SecFix GmbH  ",
        "website": "https://www.SecFix.com/about?ref=gtm",
        "industry": "Cybersecurity",
        "country": "Germany",
        "employee_count": 80,
    }
    response = client.post(
        "/api/v1/accounts",
        json=payload,
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["company_name"] == "SecFix GmbH"
    assert data["domain"] == "secfix.com"
    assert data["website"] == "https://secfix.com"
    assert data["enrichment_status"] == "PENDING"


def test_create_account_duplicate_domain_conflict(client: TestClient, sales_token: str, sample_accounts):
    """Verify that creating an account with an existing domain returns 409 Conflict."""
    payload = {
        "company_name": "Alpha Cyber Clone",
        "website": "http://www.alphacyber.de",
    }
    response = client.post(
        "/api/v1/accounts",
        json=payload,
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


def test_account_detail_and_activity(client: TestClient, sales_token: str, sample_accounts):
    """Verify account detail and activity audit trail endpoints."""
    account_id = str(sample_accounts[0].id)

    # 1. Update account
    update_res = client.patch(
        f"/api/v1/accounts/{account_id}",
        json={"lead_score": 95, "priority": "HIGH"},
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["lead_score"] == 95

    # 2. Get account detail
    detail_res = client.get(
        f"/api/v1/accounts/{account_id}",
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert detail_res.status_code == 200
    assert detail_res.json()["company_name"] == "Alpha Cyber"

    # 3. Get activity log
    activity_res = client.get(
        f"/api/v1/accounts/{account_id}/activity",
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert activity_res.status_code == 200
    activity_data = activity_res.json()
    assert activity_data["total"] >= 1
    actions = [item["action"] for item in activity_data["items"]]
    assert "UPDATE" in actions


def test_delete_account(client: TestClient, sales_token: str, sample_accounts):
    """Verify deleting an account."""
    account_id = str(sample_accounts[2].id)
    response = client.delete(
        f"/api/v1/accounts/{account_id}",
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert response.status_code == 204

    # Verify not found
    get_res = client.get(
        f"/api/v1/accounts/{account_id}",
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert get_res.status_code == 404
