from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, accounts, contacts

api_router = APIRouter()

# Health and readiness probes
api_router.include_router(health.router, prefix="", tags=["Health"])

# Authentication & identity
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])

# Core GTM entities
api_router.include_router(accounts.router, prefix="/accounts", tags=["Accounts"])
api_router.include_router(contacts.router, prefix="/contacts", tags=["Contacts"])
