from fastapi import APIRouter, Depends
from sqlmodel.ext.asyncio.session import AsyncSession
from app.core.database import get_session
from app.core.config import settings
from app.services.yolo_service import get_yolo_service
import psutil
import time

router = APIRouter(prefix="/health", tags=["health"])

@router.get("/")
async def health_check():
    """Basic health check"""
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "service": "Saatvik EL Defect Detection API"
    }

@router.get("/detailed")
async def detailed_health_check(
    db: AsyncSession = Depends(get_session)
):
    """Detailed health check with system info"""
    
    # Check YOLO model
    try:
        yolo_service = get_yolo_service()
        model_status = "loaded" if yolo_service.model else "not_loaded"
    except:
        model_status = "error"
    
    try:
        from sqlalchemy import text
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
    disk = psutil.disk_usage('/')
    
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "components": {
            "yolo_model": model_status,
            "database": db_status,
            "smb_mount": smb_status
        },
        "system": {
            "memory_usage_percent": memory.percent,
            "disk_usage_percent": disk.percent,
            "cpu_count": psutil.cpu_count()
        },
        "config": {
            "el_folder_path": settings.el_folder_path,
            "confidence_threshold": settings.confidence_threshold,
            "model_path": str(settings.model_path)
        }
    }