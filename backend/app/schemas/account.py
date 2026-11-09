import uuid
from datetime import datetime
from typing import List, Optional, Any
from pydantic import BaseModel, Field, ConfigDict
from app.models.account import PriorityLevel, EnrichmentStatus


class AccountBase(BaseModel):
    company_name: str = Field(..., min_length=1, max_length=255)
    domain: Optional[str] = Field(None, max_length=255)
    website: Optional[str] = Field(None, max_length=512)
    industry: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    employee_count: Optional[int] = Field(None, ge=1)
    description: Optional[str] = None


class AccountCreate(AccountBase):
    source: str = "MANUAL"
    assigned_to: Optional[uuid.UUID] = None


class AccountUpdate(BaseModel):
    company_name: Optional[str] = Field(None, min_length=1, max_length=255)
    domain: Optional[str] = Field(None, max_length=255)
    website: Optional[str] = Field(None, max_length=512)
    industry: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    employee_count: Optional[int] = Field(None, ge=1)
    description: Optional[str] = None
    priority: Optional[PriorityLevel] = None
    lead_score: Optional[int] = Field(None, ge=0, le=100)
    enrichment_status: Optional[EnrichmentStatus] = None
    assigned_to: Optional[uuid.UUID] = None


class AssignedUserSummary(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str

    model_config = ConfigDict(from_attributes=True)


class AccountRead(AccountBase):
    id: uuid.UUID
    source: str
    enrichment_status: EnrichmentStatus
    lead_score: Optional[int] = None
    priority: Optional[PriorityLevel] = None
    assigned_to: Optional[uuid.UUID] = None
    assigned_user: Optional[AssignedUserSummary] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AccountPagination(BaseModel):
    items: List[AccountRead]
    total: int
    page: int
    size: int
    pages: int


class AccountDetail(AccountRead):
    contacts: List[Any] = []
    enrichment_records: List[Any] = []
    lead_scores: List[Any] = []
    sources: List[Any] = []

    model_config = ConfigDict(from_attributes=True)
