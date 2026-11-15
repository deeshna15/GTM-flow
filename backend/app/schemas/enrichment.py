import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, ConfigDict


class BuyingSignalSchema(BaseModel):
    signal: str = Field(..., min_length=1)
    evidence: str = Field(..., min_length=1)
    confidence: Literal["high", "medium", "low"]


class ClaudeEnrichmentPayload(BaseModel):
    """Structured intelligence schema returned by Claude AI or evidence analyzer."""
    company_summary: str = Field(..., min_length=1)
    industry_classification: str = Field(..., min_length=1)
    target_market_fit: Literal["high", "medium", "low"]
    compliance_relevance: List[str] = Field(default_factory=list)
    buying_signals: List[BuyingSignalSchema] = Field(default_factory=list)
    recommended_roles: List[str] = Field(default_factory=list)
    recommended_next_action: str = Field(..., min_length=1)
    confidence_notes: Optional[str] = None
    analysis_mode: Optional[str] = None
    review_status: Optional[str] = None  # PENDING_REVIEW, APPROVED, REJECTED


class EnrichmentRecordRead(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    provider: str
    input_snapshot: Dict[str, Any]
    output_data: Optional[Dict[str, Any]] = None
    status: str
    model_name: str
    tokens_used: Optional[int] = None
    latency_ms: Optional[float] = None
    error_message: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class EnrichmentAccountSummary(BaseModel):
    id: uuid.UUID
    company_name: str
    domain: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    employee_count: Optional[int] = None
    lead_score: Optional[int] = None
    priority: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class EnrichmentFeedItem(EnrichmentRecordRead):
    account: Optional[EnrichmentAccountSummary] = None


class EnrichmentFeedPagination(BaseModel):
    items: List[EnrichmentFeedItem]
    total: int
    page: int
    size: int
    pages: int


class EnrichAccountRequest(BaseModel):
    force_refresh: bool = False
    async_mode: bool = False


class BulkEnrichRequest(BaseModel):
    account_ids: Optional[List[uuid.UUID]] = None
    limit: int = Field(default=20, ge=1, le=100)


class BulkEnrichResponse(BaseModel):
    job_id: uuid.UUID
    queued_count: int
    status: str
    mode: str  # CELERY_ASYNC or SYNC_FALLBACK
    message: str


class EnrichmentReviewRequest(BaseModel):
    decision: Literal["APPROVE", "REJECT"]
    apply_industry: bool = True
    apply_summary: bool = False
