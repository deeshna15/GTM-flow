from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_
from app.models.account import Account
from app.services.normalization_service import NormalizationService
from app.utils.logger import logger


class DeduplicationService:
    @staticmethod
    def find_duplicate(
        db: Session,
        company_name: str,
        domain: Optional[str] = None,
        country: Optional[str] = None,
    ) -> Tuple[Optional[Account], Optional[str]]:
        """
        Evaluate multi-stage deduplication hierarchy:
        Priority 1: Exact normalized domain match (highest confidence).
        Priority 2: Normalized company name + exact country match.
        Priority 3: Exact case-insensitive company name match.
        Returns: (matched_account, match_rule_name) or (None, None).
        """
        # Rule 1: Exact normalized domain match
        if domain:
            norm_domain = NormalizationService.normalize_domain(domain)
            if norm_domain:
                account = db.execute(
                    select(Account).where(Account.domain == norm_domain)
                ).scalars().first()
                if account:
                    logger.debug(f"Duplicate matched via Rule 1 (EXACT_DOMAIN): {norm_domain}")
                    return account, "EXACT_DOMAIN"

        norm_name = NormalizationService.normalize_company_name(company_name).lower()
        if not norm_name:
            return None, None

        # Rule 2: Normalized company name + Country match
        if country and country.strip():
            norm_country = country.strip().lower()
            account = db.execute(
                select(Account).where(
                    and_(
                        func.lower(Account.company_name) == norm_name,
                        func.lower(Account.country) == norm_country,
                    )
                )
            ).scalars().first()
            if account:
                logger.debug(f"Duplicate matched via Rule 2 (NAME_AND_COUNTRY): {company_name} in {country}")
                return account, "NAME_AND_COUNTRY"

        # Rule 3: Exact case-insensitive company name match
        account = db.execute(
            select(Account).where(func.lower(Account.company_name) == norm_name)
        ).scalars().first()
        if account:
            logger.debug(f"Duplicate matched via Rule 3 (EXACT_NAME): {company_name}")
            return account, "EXACT_NAME"

        return None, None
