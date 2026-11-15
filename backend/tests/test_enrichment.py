import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch
import anthropic
import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.integrations.claude_client import ClaudeClient
from app.models.account import Account, EnrichmentStatus


def _mock_anthropic_message(payload_text: str, input_tokens: int = 120, output_tokens: int = 230):
    return SimpleNamespace(
        content=[SimpleNamespace(type="text", text=payload_text)],
        usage=SimpleNamespace(input_tokens=input_tokens, output_tokens=output_tokens),
    )


VALID_CLAUDE_JSON = {
    "company_summary": "Secfix Cyber GmbH is a B2B cybersecurity software firm operating in Germany.",
    "industry_classification": "Cybersecurity",
    "target_market_fit": "high",
    "compliance_relevance": ["ISO 27001", "SOC 2", "GDPR"],
    "buying_signals": [
        {
            "signal": "EU cybersecurity market presence",
            "evidence": "Located in Germany in the Cybersecurity industry with 150 employees.",
            "confidence": "high",
        }
    ],
    "recommended_roles": ["CISO", "Head of Security"],
    "recommended_next_action": "Verify ISO 27001 certification status before contacting CISO.",
    "confidence_notes": "Requires verification of current compliance posture.",
}


@pytest.fixture
def target_account(db_session: Session) -> Account:
    acc = Account(
        company_name="Secfix Test Cyber GmbH",
        domain="secfixtest.example",
        website="https://secfixtest.example",
        industry="Technology",
        country="Germany",
        employee_count=150,
        description="B2B enterprise security software company",
        enrichment_status=EnrichmentStatus.PENDING,
    )
    db_session.add(acc)
    db_session.commit()
    db_session.refresh(acc)
    return acc


def test_claude_client_parses_markdown_json_and_tracks_tokens():
    mock_client_instance = MagicMock()
    fenced_text = f"```json\n{json.dumps(VALID_CLAUDE_JSON)}\n```"
    mock_client_instance.messages.create.return_value = _mock_anthropic_message(fenced_text)

    with patch("app.integrations.claude_client.anthropic.Anthropic", return_value=mock_client_instance):
        client = ClaudeClient(api_key="sk-ant-test-key", retry_base_delay=0.0)
        res = client.analyze_company({"company_name": "Secfix Test Cyber GmbH"})

    assert res.success is True
    assert res.provider == "CLAUDE"
    assert res.tokens_used == 350
    assert res.payload is not None
    assert res.payload.target_market_fit == "high"
    assert "ISO 27001" in res.payload.compliance_relevance
    assert res.payload.analysis_mode == "claude_live"


def test_claude_client_retries_on_rate_limit():
    mock_client_instance = MagicMock()
    req = httpx.Request("POST", "https://api.anthropic.com/v1/messages")
    resp = httpx.Response(429, request=req)
    rate_err = anthropic.RateLimitError("Rate limit exceeded", response=resp, body=None)

    mock_client_instance.messages.create.side_effect = [
        rate_err,
        _mock_anthropic_message(json.dumps(VALID_CLAUDE_JSON), 100, 150),
    ]

    with patch("app.integrations.claude_client.anthropic.Anthropic", return_value=mock_client_instance):
        client = ClaudeClient(api_key="sk-ant-test-key", max_retries=3, retry_base_delay=0.0)
        res = client.analyze_company({"company_name": "Retry Corp"})

    assert res.success is True
    assert res.tokens_used == 250
    assert mock_client_instance.messages.create.call_count == 2


def test_claude_client_fails_on_invalid_json_after_retries():
    mock_client_instance = MagicMock()
    mock_client_instance.messages.create.return_value = _mock_anthropic_message(
        "not valid json at all"
    )

    with patch("app.integrations.claude_client.anthropic.Anthropic", return_value=mock_client_instance):
        client = ClaudeClient(api_key="sk-ant-test-key", max_retries=2, retry_base_delay=0.0)
        res = client.analyze_company({"company_name": "Broken JSON Corp"})

    assert res.success is False
    assert res.payload is None
    assert res.error_message is not None
    assert mock_client_instance.messages.create.call_count == 2


def test_claude_client_offline_heuristic_when_key_missing():
    client = ClaudeClient(api_key="")
    res = client.analyze_company(
        {
            "company_name": "Nordic Security AS",
            "domain": "nordicsec.example",
            "industry": "Cybersecurity",
            "country": "Norway",
            "employee_count": 120,
            "description": "Cloud compliance platform",
        }
    )

    assert res.success is True
    assert res.provider == "HEURISTIC_FALLBACK"
    assert res.payload is not None
    assert res.payload.analysis_mode == "offline_heuristic"
    assert res.payload.target_market_fit == "high"
    assert "GDPR" in res.payload.compliance_relevance


def test_enrich_endpoints_and_review_workflow(
    client: TestClient, sales_token: str, target_account: Account, db_session: Session
):
    headers = {"Authorization": f"Bearer {sales_token}"}

    mock_client_instance = MagicMock()
    mock_client_instance.messages.create.return_value = _mock_anthropic_message(
        json.dumps(VALID_CLAUDE_JSON)
    )

    with patch("app.integrations.claude_client.anthropic.Anthropic", return_value=mock_client_instance), patch(
        "app.integrations.claude_client.get_settings"
    ) as mock_settings:
        mock_settings.return_value = SimpleNamespace(
            ANTHROPIC_API_KEY="sk-ant-test",
            ANTHROPIC_MODEL="claude-3-5-sonnet-20241022",
            ANTHROPIC_MAX_TOKENS=2000,
            ANTHROPIC_TIMEOUT_SECONDS=30,
            ANTHROPIC_MAX_RETRIES=2,
        )
        res = client.post(f"/api/v1/accounts/{target_account.id}/enrich", headers=headers)

    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "COMPLETED"
    assert data["provider"] == "CLAUDE"
    assert data["tokens_used"] == 350
    record_id = data["id"]

    # Check account detail serializes nested enrichment_records cleanly
    detail_res = client.get(f"/api/v1/accounts/{target_account.id}", headers=headers)
    assert detail_res.status_code == 200
    assert detail_res.json()["enrichment_status"] == "COMPLETED"
    assert len(detail_res.json()["enrichment_records"]) == 1

    # Check enrichment history endpoint
    hist_res = client.get(f"/api/v1/accounts/{target_account.id}/enrichment", headers=headers)
    assert hist_res.status_code == 200
    assert len(hist_res.json()) == 1

    # Approve enrichment and apply normalized industry classification
    review_res = client.post(
        f"/api/v1/enrichment/{record_id}/review",
        json={"decision": "APPROVE", "apply_industry": True, "apply_summary": False},
        headers=headers,
    )
    assert review_res.status_code == 200
    assert review_res.json()["output_data"]["review_status"] == "APPROVED"

    db_session.refresh(target_account)
    assert target_account.industry == "Cybersecurity"


def test_bulk_enrich_endpoint_and_feed(
    client: TestClient, sales_token: str, target_account: Account
):
    headers = {"Authorization": f"Bearer {sales_token}"}

    # Trigger bulk enrich (will run via offline heuristic sync fallback without Redis/API key)
    res = client.post(
        "/api/v1/accounts/bulk-enrich",
        json={"account_ids": [str(target_account.id)], "limit": 10},
        headers=headers,
    )
    assert res.status_code == 202
    body = res.json()
    assert body["queued_count"] == 1
    assert body["status"] == "COMPLETED"

    feed_res = client.get("/api/v1/enrichment", headers=headers)
    assert feed_res.status_code == 200
    assert feed_res.json()["total"] >= 1
