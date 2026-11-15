import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel


class DistributionItem(BaseModel):
    name: str
    count: int


class DashboardRecentImport(BaseModel):
    id: uuid.UUID
    file_name: str
    status: str
    total_records: int
    processed_records: int
    duplicate_records: int
    failed_records: int
    created_at: datetime


class DashboardRecentActivity(BaseModel):
    id: uuid.UUID
    action: str
    entity_type: str
    entity_id: uuid.UUID
    new_values: Optional[Dict[str, Any]] = None
    created_at: datetime


class DashboardTopAccount(BaseModel):
    id: uuid.UUID
    company_name: str
    domain: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    employee_count: Optional[int] = None
    lead_score: Optional[int] = None
    priority: Optional[str] = None
    enrichment_status: str
    assigned_user_name: Optional[str] = None


class DashboardOverviewResponse(BaseModel):
    total_accounts: int
    total_contacts: int
    high_priority_accounts: int
    medium_priority_accounts: int
    low_priority_accounts: int
    accounts_awaiting_enrichment: int
    enriched_accounts: int
    average_lead_score: float
    successful_jobs: int
    failed_jobs: int
    pending_jobs: int
    industry_distribution: List[DistributionItem]
    country_distribution: List[DistributionItem]
    priority_distribution: List[DistributionItem]
    recent_imports: List[DashboardRecentImport]
    recent_activities: List[DashboardRecentActivity]
    top_priority_accounts: List[DashboardTopAccount]
