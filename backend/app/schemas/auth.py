import uuid
from pydantic import BaseModel, EmailStr, Field
from app.schemas.user import UserRead


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int
    user: UserRead


class TokenPayload(BaseModel):
    sub: str  # email
    user_id: uuid.UUID
    role: str
    exp: int
