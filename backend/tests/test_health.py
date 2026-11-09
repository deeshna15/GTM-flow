import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_root_endpoint():
    """Verify root endpoint returns operational metadata and doc links."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "GTMFlow"
    assert data["status"] == "operational"
    assert "documentation" in data


def test_health_check_liveness():
    """Verify /health returns 200 OK with service details."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["service"] == "GTMFlow"
    assert "timestamp" in data
    assert "version" in data


def test_api_v1_health_check():
    """Verify /api/v1/health route is mapped and returns 200 OK."""
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"


def test_ready_check():
    """
    Verify /ready endpoint returns dependency health status structure.
    Even if external services are not connected, the response format must be valid JSON with dependencies checked.
    """
    response = client.get("/ready")
    assert response.status_code in [200, 503]
    data = response.json()
    assert "status" in data
    assert "dependencies" in data
    assert "database" in data["dependencies"]
    assert "redis" in data["dependencies"]


def test_response_headers():
    """Verify performance and correlation tracking headers are injected by middleware."""
    response = client.get("/health")
    assert response.status_code == 200
    assert "x-process-time-ms" in response.headers
    assert "x-request-id" in response.headers
