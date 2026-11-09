import uuid
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field, ConfigDict


class ContactBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    job_title: Optional[str] = Field(None, max_length=150)
    department: Optional[str] = Field(None, max_length=100)
    seniority: Optional[str] = Field(None, max_length=50)
    linkedin_url: Optional[str] = Field(None, max_length=512)
    is_decision_maker: bool = False
    buying_role: Optional[str] = Field(None, max_length=50)


class ContactCreate(ContactBase):
    account_id: uuid.UUID
    source: str = "MANUAL"


class ContactUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    job_title: Optional[str] = Field(None, max_length=150)
    department: Optional[str] = Field(None, max_length=100)
    seniority: Optional[str] = Field(None, max_length=50)
    linkedin_url: Optional[str] = Field(None, max_length=512)
    is_decision_maker: Optional[bool] = None
    buying_role: Optional[str] = Field(None, max_length=50)
    verification_status: Optional[str] = None


class AccountSummary(BaseModel):
    id: uuid.UUID
    company_name: str
    domain: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ContactRead(ContactBase):
    id: uuid.UUID
    account_id: uuid.UUID
    source: str
    verification_status: str
    created_at: datetime
    updated_at: datetime
    account: Optional[AccountSummary] = None

    model_config = ConfigDict(from_attributes=True)


class ContactPagination(BaseModel):
    items: List[ContactRead]
    total: int
    page: int
    size: int
    pages: int
