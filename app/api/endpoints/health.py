# File: app/api/endpoints/health.py

from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from app.core.database import get_session
from app.core.config import settings, get_all_machines_in_current_mode
from app.services.yolo_service import get_yolo_service
import psutil
import time

router = APIRouter(prefix="/health", tags=["health"])


# TODO: Change to actual Machine Id & Name
@router.get("")
async def health_check():
    """Basic health check with machine context"""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "service": "Saatvik EL Defect Detection API",
        "machine_id": settings.machine_id,  # 🆕 NEW: Machine context
        "machine_name": settings.machine_name,  # 🆕 NEW: Machine context
        "environment": settings.current_mode,  # 🆕 NEW: Environment context
    }


@router.get("/detailed")
async def detailed_health_check(db: AsyncSession = Depends(get_session)):
    """Detailed health check with system info and machine context"""

    # Check YOLO model
    try:
        yolo_service = get_yolo_service()
        model_status = "loaded" if yolo_service.model else "not_loaded"
    except:
        model_status = "error"

    # Database check with version compatibility
    try:
        from sqlalchemy import text

        # Try new method first, fallback to old method
        try:
            # New SQLModel versions
            await db.exec(text("SELECT 1"))
            db_status = "connected"
        except AttributeError:
            # Old SQLModel versions
            await db.execute(text("SELECT 1"))
            db_status = "connected"

    except Exception as e:
        print(f"Database error details: {e}")
        print(f"Database URL: {settings.database_url}")
        db_status = f"disconnected: {str(e)}"

    # Check SMB mount
    smb_status = "mounted" if settings.smb_mount_path.exists() else "not_mounted"

    # System resources
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")

    # 🆕 NEW: Get machine context
    try:
        available_machines = get_all_machines_in_current_mode()
    except Exception as e:
        available_machines = [settings.machine_id]

    return {
        "status": "healthy",
        "timestamp": time.time(),
        "components": {
            "yolo_model": model_status,
            "database": db_status,
            "smb_mount": smb_status,
        },
        "system": {
            "memory_usage_percent": memory.percent,
            "disk_usage_percent": disk.percent,
            "cpu_count": psutil.cpu_count(),
        },
        "config": {
            "el_folder_path": settings.el_folder_path,
            "confidence_threshold": settings.confidence_threshold,
            "model_path": str(settings.model_path),
        },
        # 🆕 NEW: Machine and environment context
        "machine_context": {
            "current_machine": settings.machine_id,
            "machine_name": settings.machine_name,
            "environment": settings.current_mode,
            "available_machines": available_machines,
            "smb_paths": {
                "source": str(settings.smb_mount_path),
                "watch": str(settings.smb_watch_path),
                "processed": str(settings.smb_processed_path),
            },
        },
    }
