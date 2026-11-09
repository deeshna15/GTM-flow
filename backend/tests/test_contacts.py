import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.account import Account


@pytest.fixture
def test_company_account(db_session: Session) -> Account:
    account = Account(
        company_name="Enterprise Security GmbH",
        domain="entsec.de",
        country="Germany",
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    return account


def test_contact_create_and_buying_committee(
    client: TestClient, sales_token: str, test_company_account: Account
):
    """Verify creating a contact with buying committee flags."""
    payload = {
        "account_id": str(test_company_account.id),
        "first_name": "Hans",
        "last_name": "Gruber",
        "email": "hans.gruber@entsec.de",
        "job_title": "Head of IT Security",
        "department": "Security",
        "seniority": "Head",
        "is_decision_maker": True,
        "buying_role": "DECISION_MAKER",
    }
    response = client.post(
        "/api/v1/contacts",
        json=payload,
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["first_name"] == "Hans"
    assert data["last_name"] == "Gruber"
    assert data["email"] == "hans.gruber@entsec.de"
    assert data["is_decision_maker"] is True
    assert data["buying_role"] == "DECISION_MAKER"


def test_contact_duplicate_email_conflict(
    client: TestClient, sales_token: str, test_company_account: Account
):
    """Verify duplicate email for same account returns 409 Conflict."""
    payload = {
        "account_id": str(test_company_account.id),
        "first_name": "Anna",
        "last_name": "Schmidt",
        "email": "anna@entsec.de",
    }
    res1 = client.post(
        "/api/v1/contacts",
        json=payload,
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert res1.status_code == 201

    # Duplicate attempt
    res2 = client.post(
        "/api/v1/contacts",
        json=payload,
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"]


def test_contact_list_filtering(
    client: TestClient, sales_token: str, test_company_account: Account
):
    """Verify filtering contacts by account_id and decision maker status."""
    response = client.get(
        f"/api/v1/contacts?account_id={test_company_account.id}",
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data


def test_contact_update_and_delete(
    client: TestClient, sales_token: str, test_company_account: Account
):
    """Verify updating and deleting a contact."""
    create_res = client.post(
        "/api/v1/contacts",
        json={
            "account_id": str(test_company_account.id),
            "first_name": "Stefan",
            "last_name": "Zweig",
            "email": "stefan@entsec.de",
        },
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    contact_id = create_res.json()["id"]

    # Update
    update_res = client.patch(
        f"/api/v1/contacts/{contact_id}",
        json={"job_title": "VP of Technology", "is_decision_maker": True},
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["job_title"] == "VP of Technology"
    assert update_res.json()["is_decision_maker"] is True

    # Delete
    delete_res = client.delete(
        f"/api/v1/contacts/{contact_id}",
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert delete_res.status_code == 204
