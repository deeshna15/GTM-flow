import json
import re
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
import anthropic
from pydantic import ValidationError
from app.config import get_settings
from app.schemas.enrichment import ClaudeEnrichmentPayload, BuyingSignalSchema
from app.utils.logger import logger


SYSTEM_PROMPT = """You are a B2B SaaS GTM and security compliance intelligence analyst working for a compliance automation platform (similar to Secfix: ISO 27001, SOC 2, GDPR, TISAX, NIS2).

Analyze the provided company evidence snapshot and output a single STRICT JSON object (no markdown fences, no commentary outside JSON).

CRITICAL GROUNDING RULES:
1. Base all claims strictly on the supplied evidence snapshot (company_name, domain, website, industry, country, employee_count, description, contacts, sources).
2. NEVER invent unverified facts, revenue figures, certifications, funding rounds, or employee names that are not in the evidence.
3. Where compliance requirements or buying signals are inferred from industry, country, or size rather than explicit proof, state clearly in evidence that verification is required.
4. Keep summaries concise, accurate, and actionable for a sales representative.

Required JSON schema:
{
  "company_summary": "string (2-3 factual sentences)",
  "industry_classification": "string (normalized concise sector)",
  "target_market_fit": "high" | "medium" | "low",
  "compliance_relevance": ["ISO 27001", "SOC 2", "GDPR", ...],
  "buying_signals": [
    {
      "signal": "string",
      "evidence": "string citing supplied fields",
      "confidence": "high" | "medium" | "low"
    }
  ],
  "recommended_roles": ["CISO", "Head of Security", ...],
  "recommended_next_action": "string (specific actionable outreach prep step)",
  "confidence_notes": "string highlighting what requires human verification"
}"""


@dataclass
class ClaudeAnalysisResult:
    provider: str
    model_name: str
    payload: Optional[ClaudeEnrichmentPayload]
    tokens_used: Optional[int]
    latency_ms: float
    success: bool
    error_message: Optional[str] = None


class ClaudeClient:
    """Wrapper around the Anthropic SDK with structured validation, token tracking, and retries."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        timeout_seconds: Optional[int] = None,
        max_retries: Optional[int] = None,
        retry_base_delay: float = 1.0,
    ):
        settings = get_settings()
        raw_key = (api_key if api_key is not None else settings.ANTHROPIC_API_KEY).strip()
        if raw_key.lower() in {"your_anthropic_api_key_here", "changeme", "none", "null"}:
            raw_key = ""
        self.api_key = raw_key
        self.model = model or settings.ANTHROPIC_MODEL
        self.max_tokens = max_tokens or settings.ANTHROPIC_MAX_TOKENS
        self.timeout_seconds = timeout_seconds or settings.ANTHROPIC_TIMEOUT_SECONDS
        self.max_retries = max_retries if max_retries is not None else settings.ANTHROPIC_MAX_RETRIES
        self.retry_base_delay = retry_base_delay

    @staticmethod
    def _extract_json_text(raw_text: str) -> str:
        """Extract clean JSON object string even if wrapped in markdown code blocks."""
        text = raw_text.strip()
        fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text, re.IGNORECASE)
        if fence_match:
            text = fence_match.group(1).strip()

        # Fallback: locate outer braces if prose precedes/follows JSON
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            text = text[start : end + 1]
        return text

    @staticmethod
    def _build_user_prompt(snapshot: Dict[str, Any]) -> str:
        return (
            "Analyze the following account evidence snapshot and return the structured GTM intelligence JSON:\n\n"
            + json.dumps(snapshot, indent=2, default=str)
        )

    @staticmethod
    def _heuristic_analyze(snapshot: Dict[str, Any]) -> ClaudeEnrichmentPayload:
        """
        Deterministic offline evidence extractor used when ANTHROPIC_API_KEY is not configured.
        Strictly derives insights from supplied company attributes without external claims.
        """
        name = snapshot.get("company_name") or "Unknown Company"
        country = snapshot.get("country") or "Unspecified Region"
        industry = snapshot.get("industry") or "Technology / Software"
        employees = snapshot.get("employee_count")
        description = snapshot.get("description") or ""
        domain = snapshot.get("domain") or "domain unverified"

        eu_targets = {
            "germany", "france", "united kingdom", "uk", "netherlands",
            "austria", "switzerland", "sweden", "denmark", "norway",
            "spain", "italy", "belgium", "ireland", "finland", "poland",
        }
        high_fit_industries = {
            "cybersecurity", "saas", "software", "technology", "fintech",
            "financial services", "healthtech", "cloud", "ai",
        }

        is_eu = country.strip().lower() in eu_targets
        is_target_industry = any(k in industry.lower() for k in high_fit_industries)
        is_target_size = employees is not None and 20 <= int(employees) <= 1000

        if is_eu and is_target_industry and (employees is None or is_target_size):
            fit = "high"
        elif is_target_industry or is_eu:
            fit = "medium"
        else:
            fit = "low"

        compliance: List[str] = []
        if is_eu:
            compliance.append("GDPR")
            compliance.append("ISO 27001")
        if any(k in industry.lower() for k in ("saas", "software", "cloud", "cyber", "tech")):
            if "ISO 27001" not in compliance:
                compliance.append("ISO 27001")
            compliance.append("SOC 2")
        if any(k in industry.lower() for k in ("fin", "bank", "pay", "insur")):
            compliance.extend(["DORA", "PCI DSS"])
        if not compliance:
            compliance = ["ISO 27001", "GDPR"]
        # Deduplicate preserving order
        compliance = list(dict.fromkeys(compliance))

        signals: List[BuyingSignalSchema] = []
        if is_target_industry:
            signals.append(
                BuyingSignalSchema(
                    signal="Compliance-sensitive operating sector",
                    evidence=f"Industry attribute recorded as '{industry}'. Enterprise buyers typically require ISO 27001 or SOC 2 assurance.",
                    confidence="high" if "cyber" in industry.lower() or "fin" in industry.lower() else "medium",
                )
            )
        if is_eu:
            signals.append(
                BuyingSignalSchema(
                    signal="Target European regulatory jurisdiction",
                    evidence=f"Country recorded as '{country}', indicating GDPR and regional enterprise procurement expectations.",
                    confidence="high",
                )
            )
        if employees is not None:
            signals.append(
                BuyingSignalSchema(
                    signal="Mid-market headcount scaling profile",
                    evidence=f"Reported headcount of {employees} employees; audit automation readiness typically increases between 50–500 staff.",
                    confidence="medium",
                )
            )
        if description:
            desc_lower = description.lower()
            if any(w in desc_lower for w in ("security", "cloud", "enterprise", "compliance", "data", "platform")):
                signals.append(
                    BuyingSignalSchema(
                        signal="Enterprise / security keyword match in profile",
                        evidence=f"Company description ('{description[:120]}') references B2B infrastructure, security, or data workflows.",
                        confidence="medium",
                    )
                )
        if not signals:
            signals.append(
                BuyingSignalSchema(
                    signal="Limited company metadata available",
                    evidence="Available attributes do not yet confirm active compliance initiatives; manual verification recommended.",
                    confidence="low",
                )
            )

        emp_text = f" with approximately {employees} employees" if employees else ""
        summary_parts = [
            f"{name} ({domain}) operates in the {industry} sector based in {country}{emp_text}."
        ]
        if description:
            summary_parts.append(f"Profile evidence notes: {description.strip().rstrip('.')}.")
        summary_parts.append(
            f"Based on available regional and sector evidence, relevant frameworks to verify include {', '.join(compliance[:3])}."
        )

        recommended_roles = ["CISO / Head of Security", "VP of Engineering", "Head of Legal & Compliance"]
        if employees and employees < 80:
            recommended_roles = ["CTO / Co-Founder", "VP of Engineering", "Operations Lead"]

        return ClaudeEnrichmentPayload(
            company_summary=" ".join(summary_parts),
            industry_classification=industry,
            target_market_fit=fit,
            compliance_relevance=compliance,
            buying_signals=signals,
            recommended_roles=recommended_roles,
            recommended_next_action=(
                f"Verify whether {name} already holds ISO 27001 or SOC 2 attestation on its trust center or website before outreach to {recommended_roles[0]}."
            ),
            confidence_notes=(
                "Generated via offline evidence-based heuristic analyzer (ANTHROPIC_API_KEY not configured). "
                "Verify active compliance certifications directly before outreach."
            ),
            analysis_mode="offline_heuristic",
            review_status="PENDING_REVIEW",
        )

    def analyze_company(
        self,
        snapshot: Dict[str, Any],
        require_api_key: bool = False,
    ) -> ClaudeAnalysisResult:
        """
        Execute company intelligence extraction via Anthropic Claude API with retries,
        strict Pydantic validation, token accounting, and transparent offline fallback.
        """
        start_time = time.time()

        if not self.api_key:
            if require_api_key:
                return ClaudeAnalysisResult(
                    provider="CLAUDE",
                    model_name=self.model,
                    payload=None,
                    tokens_used=0,
                    latency_ms=round((time.time() - start_time) * 1000, 2),
                    success=False,
                    error_message="ANTHROPIC_API_KEY is not configured.",
                )

            logger.info(
                f"ANTHROPIC_API_KEY not set; executing offline evidence heuristic for '{snapshot.get('company_name')}'."
            )
            heuristic_payload = self._heuristic_analyze(snapshot)
            return ClaudeAnalysisResult(
                provider="HEURISTIC_FALLBACK",
                model_name="evidence-heuristic-v1",
                payload=heuristic_payload,
                tokens_used=0,
                latency_ms=round((time.time() - start_time) * 1000, 2),
                success=True,
                error_message=None,
            )

        client = anthropic.Anthropic(api_key=self.api_key, timeout=self.timeout_seconds)
        user_prompt = self._build_user_prompt(snapshot)
        last_error: Optional[str] = None
        total_attempts = max(1, self.max_retries)

        for attempt in range(1, total_attempts + 1):
            try:
                response = client.messages.create(
                    model=self.model,
                    max_tokens=self.max_tokens,
                    temperature=0.1,
                    system=SYSTEM_PROMPT,
                    messages=[{"role": "user", "content": user_prompt}],
                )

                raw_text = ""
                if response.content:
                    for block in response.content:
                        if getattr(block, "type", None) == "text" or hasattr(block, "text"):
                            raw_text += block.text

                json_str = self._extract_json_text(raw_text)
                parsed_dict = json.loads(json_str)
                payload = ClaudeEnrichmentPayload.model_validate(parsed_dict)
                payload.analysis_mode = "claude_live"
                payload.review_status = "PENDING_REVIEW"

                usage = getattr(response, "usage", None)
                tokens_used = None
                if usage is not None:
                    tokens_used = (getattr(usage, "input_tokens", 0) or 0) + (
                        getattr(usage, "output_tokens", 0) or 0
                    )

                latency_ms = round((time.time() - start_time) * 1000, 2)
                return ClaudeAnalysisResult(
                    provider="CLAUDE",
                    model_name=self.model,
                    payload=payload,
                    tokens_used=tokens_used,
                    latency_ms=latency_ms,
                    success=True,
                    error_message=None,
                )

            except (
                anthropic.RateLimitError,
                anthropic.APIConnectionError,
                anthropic.InternalServerError,
                anthropic.APITimeoutError,
            ) as api_err:
                last_error = f"Anthropic transient error on attempt {attempt}/{total_attempts}: {api_err}"
                logger.warning(last_error)
            except (json.JSONDecodeError, ValidationError, ValueError) as parse_err:
                last_error = f"Structured output validation error on attempt {attempt}/{total_attempts}: {parse_err}"
                logger.warning(last_error)
            except anthropic.APIError as fatal_err:
                last_error = f"Anthropic API error: {fatal_err}"
                logger.error(last_error)
                break
            except Exception as exc:
                last_error = f"Unexpected Claude client failure: {exc}"
                logger.error(last_error)
                break

            if attempt < total_attempts and self.retry_base_delay > 0:
                delay = self.retry_base_delay * (2 ** (attempt - 1))
                time.sleep(delay)

        latency_ms = round((time.time() - start_time) * 1000, 2)
        return ClaudeAnalysisResult(
            provider="CLAUDE",
            model_name=self.model,
            payload=None,
            tokens_used=0,
            latency_ms=latency_ms,
            success=False,
            error_message=last_error or "Enrichment failed after retries.",
        )
