# File: app/api/router.py

from fastapi import APIRouter
from app.api.endpoints import detection, health, analytics, export

api_router = APIRouter()

# Core endpoints
api_router.include_router(detection.router)
api_router.include_router(health.router)

# Analytics endpoints
api_router.include_router(analytics.router)

# Export endpoints (properly separated)
api_router.include_router(export.router)
