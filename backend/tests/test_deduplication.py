import pytest
from sqlalchemy.orm import Session
from app.models.account import Account
from app.services.deduplication_service import DeduplicationService
from app.services.normalization_service import NormalizationService


def test_normalization_service_domain_extraction():
    """Verify URL scheme, query param, and www prefix stripping."""
    assert NormalizationService.normalize_domain("https://www.Secfix.com/careers?utm_source=gtm") == "secfix.com"
    assert NormalizationService.normalize_domain("HTTP://SUB.EXAMPLE.CO.UK/") == "sub.example.co.uk"
    assert NormalizationService.normalize_domain("cloudbridge.example") == "cloudbridge.example"
    assert NormalizationService.normalize_domain("") is None
    assert NormalizationService.normalize_domain(None) is None


def test_deduplication_rule1_exact_domain(db_session: Session):
    """Verify priority 1: exact normalized domain match."""
    acc = Account(
        company_name="Original Security",
        domain="secfix.com",
        country="Germany",
    )
    db_session.add(acc)
    db_session.commit()

    # Incoming with different name format and URL variation
    match, rule = DeduplicationService.find_duplicate(
        db=db_session,
        company_name="ORIGINAL SECURITY GMBH",
        domain="https://www.secfix.com/about",
        country="Germany",
    )
    assert match is not None
    assert match.id == acc.id
    assert rule == "EXACT_DOMAIN"


def test_deduplication_rule2_name_and_country(db_session: Session):
    """Verify priority 2: normalized name and country when domain is absent."""
    acc = Account(
        company_name="Bavaria Systems",
        domain=None,
        country="Germany",
    )
    db_session.add(acc)
    db_session.commit()

    match, rule = DeduplicationService.find_duplicate(
        db=db_session,
        company_name="  bavaria systems  ",
        domain=None,
        country="Germany",
    )
    assert match is not None
    assert match.id == acc.id
    assert rule == "NAME_AND_COUNTRY"


def test_deduplication_no_false_positives(db_session: Session):
    """Verify different companies do not falsely trigger deduplication."""
    acc = Account(
        company_name="FinCore Solutions",
        domain="fincore.example",
        country="France",
    )
    db_session.add(acc)
    db_session.commit()

    match, rule = DeduplicationService.find_duplicate(
        db=db_session,
        company_name="FinCore UK",
        domain="fincore-uk.example",
        country="United Kingdom",
    )
    assert match is None
    assert rule is None
