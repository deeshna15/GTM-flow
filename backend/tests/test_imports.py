import os
import io
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.account import Account
from app.models.account_source import AccountSource
from app.models.import_job import ImportJob

SAMPLE_CSV_CONTENT = """company_name,website,industry,country,employee_count,description
Northstar Security,northstarsecurity.example,Cybersecurity,Germany,150,Security software provider
CloudBridge,cloudbridge.example,SaaS,France,300,Cloud infrastructure company
SecureStack,securestack.example,Software,Netherlands,85,Enterprise software company
DataOrbit,dataorbit.example,Technology,Germany,45,Data analytics provider
FinCore,fincore.example,Financial Services,France,220,Financial technology company
TechNova,technova.example,IT Services,India,500,IT services provider
CyberNest,cybernest.example,Cybersecurity,Austria,120,Security consulting company
Northstar Security,northstarsecurity.example,Cybersecurity,Germany,150,Duplicate test record
"""

MALFORMED_CSV_CONTENT = """company_name,website,industry,country,employee_count
Valid Security,valid.example,Cybersecurity,Germany,100
,invalid.example,Technology,France,50
Broken Size,broken.example,SaaS,Germany,not_a_number
"""


def test_upload_csv_preview_and_mapping(client: TestClient, sales_token: str):
    """Verify that uploading a CSV returns preview rows and detected column mappings."""
    file_bytes = io.BytesIO(SAMPLE_CSV_CONTENT.encode("utf-8"))
    files = {"file": ("test_accounts.csv", file_bytes, "text/csv")}

    response = client.post(
        "/api/v1/imports/upload",
        files=files,
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "file_id" in data
    assert data["file_name"] == "test_accounts.csv"
    assert "company_name" in data["detected_columns"]
    assert "website" in data["detected_columns"]
    assert len(data["preview_rows"]) == 8
    assert data["total_rows_detected"] == 8
    assert data["suggested_mapping"]["company_name"] == "company_name"


def test_import_sample_accounts_deduplication(client: TestClient, sales_token: str, db_session: Session):
    """
    Test scenario from blueprint section 15:
    Import 8 records from sample dataset.
    Expect 7 unique accounts inserted, 1 duplicate detected within file.
    """
    # 1. Upload
    file_bytes = io.BytesIO(SAMPLE_CSV_CONTENT.encode("utf-8"))
    files = {"file": ("sample_accounts.csv", file_bytes, "text/csv")}
    upload_res = client.post(
        "/api/v1/imports/upload",
        files=files,
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert upload_res.status_code == 200
    file_id = upload_res.json()["file_id"]
    mapping = upload_res.json()["suggested_mapping"]

    # 2. Execute import
    execute_res = client.post(
        "/api/v1/imports/start",
        json={
            "file_id": file_id,
            "field_mapping": mapping,
            "conflict_policy": "PRESERVE_EXISTING",
        },
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert execute_res.status_code == 202
    job_data = execute_res.json()
    assert job_data["total_records"] == 8
    assert job_data["processed_records"] == 7
    assert job_data["duplicate_records"] == 1
    assert job_data["failed_records"] == 0
    assert job_data["status"] == "COMPLETED"

    # Verify accounts in database
    accounts = db_session.execute(select(Account)).scalars().all()
    domains = [a.domain for a in accounts]
    assert "northstarsecurity.example" in domains
    assert "cloudbridge.example" in domains
    assert len(accounts) >= 7

    # 3. Import same file AGAIN -> 0 inserted, 7 duplicates detected, provenance preserved
    upload_res2 = client.post(
        "/api/v1/imports/upload",
        files={"file": ("sample_accounts_repeat.csv", io.BytesIO(SAMPLE_CSV_CONTENT.encode("utf-8")), "text/csv")},
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    file_id2 = upload_res2.json()["file_id"]
    execute_res2 = client.post(
        "/api/v1/imports/start",
        json={
            "file_id": file_id2,
            "field_mapping": mapping,
            "conflict_policy": "PRESERVE_EXISTING",
        },
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert execute_res2.status_code == 202
    repeat_data = execute_res2.json()
    assert repeat_data["processed_records"] == 0
    assert repeat_data["duplicate_records"] == 8
    assert repeat_data["failed_records"] == 0

    # Verify source provenance entries exist
    sources = db_session.execute(select(AccountSource)).scalars().all()
    assert len(sources) > 0


def test_import_malformed_csv_validation(client: TestClient, sales_token: str):
    """
    Verify that rows with missing company name or invalid numbers
    fail row validation and update error statistics without halting the batch.
    """
    file_bytes = io.BytesIO(MALFORMED_CSV_CONTENT.encode("utf-8"))
    files = {"file": ("malformed.csv", file_bytes, "text/csv")}
    upload_res = client.post(
        "/api/v1/imports/upload",
        files=files,
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    file_id = upload_res.json()["file_id"]
    mapping = upload_res.json()["suggested_mapping"]

    execute_res = client.post(
        "/api/v1/imports/start",
        json={
            "file_id": file_id,
            "field_mapping": mapping,
            "conflict_policy": "PRESERVE_EXISTING",
        },
        headers={"Authorization": f"Bearer {sales_token}"},
    )
    assert execute_res.status_code == 202
    job_data = execute_res.json()
    assert job_data["total_records"] == 3
    assert job_data["processed_records"] == 1  # only Valid Security
    assert job_data["failed_records"] == 2     # missing name, broken size
    assert job_data["status"] == "PARTIAL"
    assert len(job_data["error_summary"]) == 2
