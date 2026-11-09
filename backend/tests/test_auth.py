import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.services.auth_service import AuthService
from app.utils.security import verify_password


def test_user_registration_success(client: TestClient, db_session: Session):
    """Verify that a user can register successfully with secure password hashing."""
    payload = {
        "full_name": "Jane GTM Engineer",
        "email": "jane@example.com",
        "password": "SecurePassword123!",
        "role": "SALES",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "jane@example.com"
    assert data["full_name"] == "Jane GTM Engineer"
    assert data["role"] == "SALES"
    assert data["is_active"] is True
    assert "id" in data
    assert "password" not in data
    assert "password_hash" not in data

    # Verify password was hashed in database
    db_user = AuthService.get_by_email(db_session, "jane@example.com")
    assert db_user is not None
    assert db_user.password_hash != "SecurePassword123!"
    assert verify_password("SecurePassword123!", db_user.password_hash) is True


def test_user_registration_duplicate_email(client: TestClient):
    """Verify that registering an existing email address is rejected with 409 Conflict."""
    payload = {
        "full_name": "First User",
        "email": "duplicate@example.com",
        "password": "Password123!",
        "role": "SALES",
    }
    res1 = client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == 201

    # Second registration with same email
    res2 = client.post("/api/v1/auth/register", json=payload)
    assert res2.status_code == 409
    assert "already exists" in res2.json()["detail"]


def test_user_login_success(client: TestClient, test_sales_user: User):
    """Verify that valid login credentials return a signed JWT access token and user metadata."""
    payload = {
        "email": test_sales_user.email,
        "password": "SalesPassword123!",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == test_sales_user.email
    assert data["user"]["role"] == "SALES"


def test_user_login_invalid_password(client: TestClient, test_sales_user: User):
    """Verify that incorrect password returns 401 Unauthorized."""
    payload = {
        "email": test_sales_user.email,
        "password": "WrongPassword123!",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401
    assert "Incorrect email or password" in response.json()["detail"]


def test_user_login_nonexistent_email(client: TestClient):
    """Verify that non-existent email returns 401 Unauthorized."""
    payload = {
        "email": "nobody@example.com",
        "password": "AnyPassword123!",
    }
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 401


def test_get_current_user_profile(client: TestClient, sales_token: str, test_sales_user: User):
    """Verify that authenticated user can retrieve own profile with Bearer token."""
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == str(test_sales_user.id)
    assert data["email"] == test_sales_user.email
    assert data["role"] == "SALES"


def test_get_current_user_missing_token(client: TestClient):
    """Verify that missing Authorization header returns 401 Unauthorized."""
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    assert "Authentication token is missing" in response.json()["detail"]


def test_get_current_user_invalid_token(client: TestClient):
    """Verify that invalid token returns 401 Unauthorized."""
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid.jwt.token"},
    )
    assert response.status_code == 401


def test_rbac_admin_endpoint_as_admin(client: TestClient, admin_token: str, test_admin_user: User):
    """Verify that admin user can access admin-protected endpoint."""
    response = client.get(
        "/api/v1/auth/admin-only",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "authorized"
    assert test_admin_user.full_name in data["message"]


def test_rbac_admin_endpoint_as_sales_forbidden(client: TestClient, sales_token: str):
    """Verify that sales representative is denied access to admin-only endpoint with 403 Forbidden."""
    response = client.get(
        "/api/v1/auth/admin-only",
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert response.status_code == 403
    assert "do not have sufficient permissions" in response.json()["detail"]
