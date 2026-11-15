import uuid
from typing import Any, Dict, List, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session, selectinload
from app.models.account import Account, PriorityLevel
from app.models.lead_score import LeadScore, ScoringConfig
from app.models.user import User, UserRole
from app.schemas.scoring import ScoringConfigUpdate
from app.services.audit_service import AuditService
from app.utils.logger import logger

COUNTRY_ALIASES = {
    "de": "germany",
    "deutschland": "germany",
    "uk": "united kingdom",
    "gb": "united kingdom",
    "great britain": "united kingdom",
    "fr": "france",
    "nl": "netherlands",
    "the netherlands": "netherlands",
    "at": "austria",
    "ch": "switzerland",
    "se": "sweden",
    "dk": "denmark",
    "no": "norway",
}

COMPLIANCE_KEYWORDS = (
    "iso",
    "27001",
    "soc 2",
    "soc2",
    "gdpr",
    "security",
    "compliance",
    "audit",
    "nis2",
    "tisax",
    "privacy",
)


class ScoringService:
    @staticmethod
    def get_or_create_active_config(
        db: Session, created_by: Optional[uuid.UUID] = None
    ) -> ScoringConfig:
        """Fetch active ScoringConfig or seed the default Secfix GTM ICP configuration."""
        stmt = (
            select(ScoringConfig)
            .where(ScoringConfig.is_active == True)
            .order_by(desc(ScoringConfig.updated_at))
        )
        config = db.execute(stmt).scalars().first()
        if not config:
            config = ScoringConfig(
                name="Default Secfix European Compliance ICP",
                created_by=created_by,
                is_active=True,
            )
            db.add(config)
            db.commit()
            db.refresh(config)
        return config

    @staticmethod
    def update_config(
        db: Session,
        update_in: ScoringConfigUpdate,
        current_user_id: Optional[uuid.UUID] = None,
    ) -> ScoringConfig:
        """Update active scoring configuration weights and target criteria."""
        config = ScoringService.get_or_create_active_config(db, created_by=current_user_id)
        old_values = {
            "weights": dict(config.weights),
            "target_industries": dict(config.target_industries),
            "target_geographies": dict(config.target_geographies),
            "target_employee_ranges": dict(config.target_employee_ranges),
        }

        if update_in.name is not None:
            config.name = update_in.name
        if update_in.weights is not None:
            total_w = sum(update_in.weights.values())
            if total_w <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Total scoring weights must be positive.",
                )
            config.weights = update_in.weights
        if update_in.target_industries is not None:
            config.target_industries = update_in.target_industries
        if update_in.target_geographies is not None:
            config.target_geographies = update_in.target_geographies
        if update_in.target_employee_ranges is not None:
            config.target_employee_ranges = update_in.target_employee_ranges

        db.commit()
        db.refresh(config)

        AuditService.log_event(
            db=db,
            action="SCORING_CONFIG_UPDATE",
            entity_type="SCORING_CONFIG",
            entity_id=config.id,
            user_id=current_user_id,
            old_values=old_values,
            new_values={
                "weights": config.weights,
                "target_industries": config.target_industries,
                "target_geographies": config.target_geographies,
            },
        )
        db.commit()
        return config

    @staticmethod
    def _score_industry(
        industry: Optional[str], config: ScoringConfig
    ) -> Tuple[int, int, str]:
        max_w = int(config.weights.get("industry", 30))
        if not industry or not industry.strip():
            return 0, max_w, "Industry metadata missing (0 pts)."

        ind_clean = industry.strip()
        ind_lower = ind_clean.lower()
        targets = config.target_industries or {}

        matched_raw: Optional[int] = None
        matched_key: Optional[str] = None
        for key, pts in targets.items():
            if key.lower() == ind_lower:
                matched_raw = int(pts)
                matched_key = key
                break
        if matched_raw is None:
            for key, pts in targets.items():
                if key.lower() in ind_lower or ind_lower in key.lower():
                    matched_raw = int(pts)
                    matched_key = key
                    break

        if matched_raw is not None:
            scaled = min(max_w, round((matched_raw / 30.0) * max_w))
            return scaled, max_w, f"Matches target industry '{matched_key}' ({ind_clean})."

        baseline = min(max_w, max(1, round(max_w * 0.27)))
        return baseline, max_w, f"Non-core industry '{ind_clean}' assigned baseline weight."

    @staticmethod
    def _score_geography(
        country: Optional[str], config: ScoringConfig
    ) -> Tuple[int, int, str]:
        max_w = int(config.weights.get("geography", 20))
        if not country or not country.strip():
            return 0, max_w, "Country/location missing (0 pts)."

        c_clean = country.strip()
        c_lower = COUNTRY_ALIASES.get(c_clean.lower(), c_clean.lower())
        targets = config.target_geographies or {}

        for key, pts in targets.items():
            if key.lower() == c_lower or key.lower() == c_clean.lower():
                scaled = min(max_w, round((int(pts) / 20.0) * max_w))
                return scaled, max_w, f"Located in target region ({c_clean})."

        baseline = min(max_w, max(1, round(max_w * 0.30)))
        return baseline, max_w, f"Outside primary regional focus ({c_clean})."

    @staticmethod
    def _score_size(
        employee_count: Optional[int], config: ScoringConfig
    ) -> Tuple[int, int, str]:
        max_w = int(config.weights.get("size", 20))
        if employee_count is None or employee_count <= 0:
            return 0, max_w, "Employee headcount missing (0 pts)."

        ranges = config.target_employee_ranges or {}
        raw_pts: Optional[int] = None
        matched_range: str = "default"

        for key, pts in ranges.items():
            if "-" in key:
                try:
                    low_s, high_s = key.split("-", 1)
                    if int(low_s.strip()) <= employee_count <= int(high_s.strip()):
                        raw_pts = int(pts)
                        matched_range = key
                        break
                except ValueError:
                    continue

        if raw_pts is None:
            raw_pts = int(ranges.get("default", 5))

        scaled = min(max_w, round((raw_pts / 20.0) * max_w))
        return scaled, max_w, f"Employee count ({employee_count}) matches segment '{matched_range}'."

    @staticmethod
    def _score_signals(
        account: Account, config: ScoringConfig
    ) -> Tuple[int, int, str]:
        max_w = int(config.weights.get("signals", 20))
        latest_enrichment = next(
            (r for r in (account.enrichment_records or []) if r.status == "COMPLETED" and r.output_data),
            None,
        )

        raw_pts = 0
        rationale_parts: List[str] = []

        if latest_enrichment and latest_enrichment.output_data:
            data = latest_enrichment.output_data
            fit = str(data.get("target_market_fit", "low")).lower()
            if fit == "high":
                raw_pts += 10
                rationale_parts.append("High AI target-market fit")
            elif fit == "medium":
                raw_pts += 6
                rationale_parts.append("Medium AI target-market fit")
            else:
                raw_pts += 2

            compliance = data.get("compliance_relevance") or []
            if compliance:
                raw_pts += min(4, len(compliance) * 2)
                rationale_parts.append(f"Compliance relevance ({', '.join(compliance[:3])})")

            signals = data.get("buying_signals") or []
            if signals:
                sig_pts = sum(
                    3 if str(s.get("confidence", "")).lower() == "high" else 2
                    for s in signals
                )
                raw_pts += min(6, sig_pts)
                rationale_parts.append(f"{len(signals)} observed buying signals")
        else:
            desc_lower = (account.description or "").lower()
            hits = [kw for kw in COMPLIANCE_KEYWORDS if kw in desc_lower]
            if hits:
                raw_pts += min(8, len(hits) * 3)
                rationale_parts.append(
                    f"Pre-enrichment keyword signals in description ({', '.join(hits[:3])})"
                )
            else:
                rationale_parts.append("Pending AI enrichment; no buying signals extracted yet")

        scaled = min(max_w, round((min(20, raw_pts) / 20.0) * max_w))
        return scaled, max_w, "; ".join(rationale_parts) + "."

    @staticmethod
    def _score_completeness(
        account: Account, config: ScoringConfig
    ) -> Tuple[int, int, str]:
        max_w = int(config.weights.get("completeness", 10))
        raw = 0
        present: List[str] = []

        if account.domain:
            raw += 2
            present.append("domain")
        if account.industry:
            raw += 2
            present.append("industry")
        if account.country:
            raw += 2
            present.append("country")
        if account.employee_count:
            raw += 2
            present.append("headcount")
        if account.contacts and len(account.contacts) > 0:
            raw += 2
            present.append(f"{len(account.contacts)} contact(s)")
        elif account.description:
            raw += 1
            present.append("description")

        scaled = min(max_w, round((min(10, raw) / 10.0) * max_w))
        reason = (
            f"Verified attributes: {', '.join(present)}."
            if present
            else "Minimal company profile metadata available."
        )
        return scaled, max_w, reason

    @staticmethod
    def calculate_and_save_score(
        db: Session,
        account_id: uuid.UUID,
        current_user_id: Optional[uuid.UUID] = None,
    ) -> LeadScore:
        """Compute deterministic 100-point ICP lead score, persist history, and update Account."""
        stmt = (
            select(Account)
            .where(Account.id == account_id)
            .options(
                selectinload(Account.contacts),
                selectinload(Account.enrichment_records),
            )
        )
        account = db.execute(stmt).scalar_one_or_none()
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Account '{account_id}' not found.",
            )

        config = ScoringService.get_or_create_active_config(db, created_by=current_user_id)

        ind_s, ind_m, ind_r = ScoringService._score_industry(account.industry, config)
        geo_s, geo_m, geo_r = ScoringService._score_geography(account.country, config)
        size_s, size_m, size_r = ScoringService._score_size(account.employee_count, config)
        sig_s, sig_m, sig_r = ScoringService._score_signals(account, config)
        comp_s, comp_m, comp_r = ScoringService._score_completeness(account, config)

        total = min(100, max(0, ind_s + geo_s + size_s + sig_s + comp_s))
        if total >= 80:
            priority = PriorityLevel.HIGH
        elif total >= 50:
            priority = PriorityLevel.MEDIUM
        else:
            priority = PriorityLevel.LOW

        reasons = [ind_r, geo_r, size_r, sig_r, comp_r]
        latest_enrichment = next(
            (r for r in (account.enrichment_records or []) if r.status == "COMPLETED" and r.output_data),
            None,
        )
        next_action = (
            latest_enrichment.output_data.get("recommended_next_action")
            if latest_enrichment and latest_enrichment.output_data
            else None
        )
        if not next_action:
            if priority == PriorityLevel.HIGH:
                next_action = (
                    f"Prioritize outreach for {account.company_name}; map CISO/Security stakeholders and verify compliance requirements."
                )
            elif priority == PriorityLevel.MEDIUM:
                next_action = (
                    f"Run Claude AI enrichment and verify {account.company_name}'s security compliance posture before sequence enrollment."
                )
            else:
                next_action = (
                    "Enrich missing firmographic fields or monitor for new compliance buying signals."
                )

        explanation = {
            "breakdown": {
                "industry": {"score": ind_s, "max": ind_m, "reason": ind_r},
                "geography": {"score": geo_s, "max": geo_m, "reason": geo_r},
                "size": {"score": size_s, "max": size_m, "reason": size_r},
                "signals": {"score": sig_s, "max": sig_m, "reason": sig_r},
                "completeness": {"score": comp_s, "max": comp_m, "reason": comp_r},
            },
            "reasons": reasons,
            "recommended_next_action": next_action,
            "config_name": config.name,
        }

        lead_score = LeadScore(
            account_id=account.id,
            total_score=total,
            industry_score=ind_s,
            geography_score=geo_s,
            size_score=size_s,
            signal_score=sig_s,
            data_completeness_score=comp_s,
            priority=priority.value,
            explanation=explanation,
            scoring_version="1.0",
        )
        db.add(lead_score)

        account.lead_score = total
        account.priority = priority

        db.commit()
        db.refresh(lead_score)

        AuditService.log_event(
            db=db,
            action="SCORE",
            entity_type="ACCOUNT",
            entity_id=account.id,
            user_id=current_user_id,
            new_values={
                "total_score": total,
                "priority": priority.value,
                "breakdown": {
                    "industry": ind_s,
                    "geography": geo_s,
                    "size": size_s,
                    "signals": sig_s,
                    "completeness": comp_s,
                },
            },
        )
        db.commit()

        logger.info(
            f"Scored account '{account.company_name}' ({account.id}): {total}/100 ({priority.value})"
        )
        return lead_score

    @staticmethod
    def bulk_score_accounts(
        db: Session,
        account_ids: Optional[List[uuid.UUID]] = None,
        rescore_all: bool = False,
        limit: int = 100,
        current_user_id: Optional[uuid.UUID] = None,
    ) -> Dict[str, int]:
        """Score multiple accounts in batch and summarize priority tiers."""
        if account_ids:
            target_ids = account_ids[:limit]
        else:
            stmt = select(Account.id)
            if not rescore_all:
                stmt = stmt.where(Account.lead_score == None)  # noqa: E711
            target_ids = list(db.execute(stmt.limit(limit)).scalars().all())

        high_c = 0
        med_c = 0
        low_c = 0

        for acc_id in target_ids:
            ls = ScoringService.calculate_and_save_score(
                db=db, account_id=acc_id, current_user_id=current_user_id
            )
            if ls.priority == "HIGH":
                high_c += 1
            elif ls.priority == "MEDIUM":
                med_c += 1
            else:
                low_c += 1

        return {
            "scored_count": len(target_ids),
            "high_priority_count": high_c,
            "medium_priority_count": med_c,
            "low_priority_count": low_c,
        }

    @staticmethod
    def get_account_scores(db: Session, account_id: uuid.UUID) -> List[LeadScore]:
        """Return scoring calculation history for an account."""
        exists = db.execute(select(Account.id).where(Account.id == account_id)).scalar_one_or_none()
        if not exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Account '{account_id}' not found.",
            )
        stmt = (
            select(LeadScore)
            .where(LeadScore.account_id == account_id)
            .order_by(desc(LeadScore.created_at))
        )
        return list(db.execute(stmt).scalars().all())

    @staticmethod
    def get_scoring_overview(db: Session) -> Dict[str, Any]:
        """Compute aggregate scoring distribution, top accounts, and rep workload breakdown."""
        accounts = list(
            db.execute(
                select(Account)
                .options(selectinload(Account.assigned_user))
                .order_by(desc(Account.lead_score).nulls_last(), desc(Account.created_at))
            )
            .scalars()
            .all()
        )

        total_accounts = len(accounts)
        scored = [a for a in accounts if a.lead_score is not None]
        avg_score = round(sum(a.lead_score for a in scored) / len(scored), 1) if scored else 0.0

        high_c = sum(1 for a in accounts if a.priority == PriorityLevel.HIGH)
        med_c = sum(1 for a in accounts if a.priority == PriorityLevel.MEDIUM)
        low_c = sum(1 for a in accounts if a.priority == PriorityLevel.LOW)
        unscored_c = sum(1 for a in accounts if a.lead_score is None)

        top_accounts = [
            {
                "id": a.id,
                "company_name": a.company_name,
                "domain": a.domain,
                "industry": a.industry,
                "country": a.country,
                "employee_count": a.employee_count,
                "lead_score": a.lead_score,
                "priority": a.priority,
                "enrichment_status": a.enrichment_status.value if a.enrichment_status else "PENDING",
                "assigned_to": a.assigned_to,
                "assigned_user_name": a.assigned_user.full_name if a.assigned_user else None,
            }
            for a in accounts[:25]
        ]

        # Rep workload stats
        users = list(
            db.execute(select(User).where(User.is_active == True)).scalars().all()
        )
        rep_workloads = []
        for u in users:
            u_accounts = [a for a in accounts if a.assigned_to == u.id]
            u_high = sum(1 for a in u_accounts if a.priority == PriorityLevel.HIGH)
            rep_workloads.append(
                {
                    "user_id": u.id,
                    "full_name": u.full_name,
                    "email": u.email,
                    "role": u.role.value,
                    "total_assigned": len(u_accounts),
                    "high_priority_assigned": u_high,
                }
            )
        rep_workloads.sort(key=lambda r: (r["role"] != "SALES", -r["total_assigned"]))

        return {
            "total_accounts": total_accounts,
            "scored_accounts": len(scored),
            "average_score": avg_score,
            "high_count": high_c,
            "medium_count": med_c,
            "low_count": low_c,
            "unscored_count": unscored_c,
            "top_accounts": top_accounts,
            "rep_workloads": rep_workloads,
        }
