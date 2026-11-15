import uuid
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, ConfigDict
from app.models.account import PriorityLevel


class ScoreDimensionExplanation(BaseModel):
    score: int
    max_score: int
    reason: str


class LeadScoreRead(BaseModel):
    id: uuid.UUID
    account_id: uuid.UUID
    total_score: int
    industry_score: int
    geography_score: int
    size_score: int
    signal_score: int
    data_completeness_score: int
    priority: str
    explanation: Dict[str, Any]
    scoring_version: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ScoringConfigRead(BaseModel):
    id: uuid.UUID
    name: str
    weights: Dict[str, int]
    target_industries: Dict[str, int]
    target_geographies: Dict[str, int]
    target_employee_ranges: Dict[str, int]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ScoringConfigUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    weights: Optional[Dict[str, int]] = None
    target_industries: Optional[Dict[str, int]] = None
    target_geographies: Optional[Dict[str, int]] = None
    target_employee_ranges: Optional[Dict[str, int]] = None


class BulkScoreRequest(BaseModel):
    account_ids: Optional[List[uuid.UUID]] = None
    rescore_all: bool = False
    limit: int = Field(default=100, ge=1, le=500)


class BulkScoreResponse(BaseModel):
    scored_count: int
    high_priority_count: int
    medium_priority_count: int
    low_priority_count: int
    message: str


class AssignAccountRequest(BaseModel):
    user_id: Optional[uuid.UUID] = None  # If omitted, auto-routes to least-loaded sales rep


class AssignAccountResponse(BaseModel):
    account_id: uuid.UUID
    company_name: str
    assigned_to: uuid.UUID
    assigned_user_name: str
    assigned_user_email: str
    strategy: Literal["MANUAL", "LEAST_LOADED_AUTO"]
    active_account_load: int


class BulkAssignRequest(BaseModel):
    account_ids: Optional[List[uuid.UUID]] = None
    only_high_priority: bool = False
    limit: int = Field(default=100, ge=1, le=500)


class BulkAssignResponse(BaseModel):
    assigned_count: int
    assignments: List[AssignAccountResponse]
    message: str


class RepWorkloadSummary(BaseModel):
    user_id: uuid.UUID
    full_name: str
    email: str
    role: str
    total_assigned: int
    high_priority_assigned: int


class LeaderboardAccountItem(BaseModel):
    id: uuid.UUID
    company_name: str
    domain: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    employee_count: Optional[int] = None
    lead_score: Optional[int] = None
    priority: Optional[PriorityLevel] = None
    enrichment_status: str
    assigned_to: Optional[uuid.UUID] = None
    assigned_user_name: Optional[str] = None


class ScoringOverviewResponse(BaseModel):
    total_accounts: int
    scored_accounts: int
    average_score: float
    high_count: int
    medium_count: int
    low_count: int
    unscored_count: int
    top_accounts: List[LeaderboardAccountItem]
    rep_workloads: List[RepWorkloadSummary]
