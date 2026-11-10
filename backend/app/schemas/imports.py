import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field, field_validator, ConfigDict


class ImportPreviewResponse(BaseModel):
    file_id: uuid.UUID
    file_name: str
    detected_columns: List[str]
    preview_rows: List[Dict[str, Any]]
    total_rows_detected: int
    suggested_mapping: Dict[str, str]


class ImportExecuteRequest(BaseModel):
    file_id: uuid.UUID
    field_mapping: Dict[str, str] = Field(
        ...,
        description="Map CSV columns to GTMFlow fields (company_name, domain, website, industry, country, employee_count, description)",
    )
    conflict_policy: Literal["PRESERVE_EXISTING", "OVERWRITE_EMPTY"] = "PRESERVE_EXISTING"


class ImportJobRead(BaseModel):
    id: uuid.UUID
    file_name: str
    file_size_bytes: int
    status: str  # PENDING, PROCESSING, COMPLETED, PARTIAL, FAILED
    total_records: int
    processed_records: int
    duplicate_records: int
    failed_records: int
    field_mapping: Optional[Dict[str, Any]] = None
    error_summary: Optional[List[Dict[str, Any]]] = None
    created_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ImportRowSchema(BaseModel):
    company_name: str
    domain: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    employee_count: Optional[int] = None
    description: Optional[str] = None

    @field_validator("company_name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        name = str(v).strip()
        if not name:
            raise ValueError("Company name cannot be blank or missing.")
        return name

    @field_validator("employee_count", mode="before")
    @classmethod
    def parse_employees(cls, v: Any) -> Optional[int]:
        if v is None or v == "":
            return None
        try:
            # Handle string numbers, commas, or floats
            cleaned = str(v).replace(",", "").strip()
            num = int(float(cleaned))
            if num < 0:
                raise ValueError("Employee count cannot be negative.")
            return num
        except (ValueError, TypeError):
            raise ValueError(f"Invalid employee count: '{v}'")
