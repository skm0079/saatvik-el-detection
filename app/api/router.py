# File: app/api/router.py

from fastapi import APIRouter
from app.api.endpoints import detection, health

api_router = APIRouter()

api_router.include_router(detection.router)
api_router.include_router(health.router)