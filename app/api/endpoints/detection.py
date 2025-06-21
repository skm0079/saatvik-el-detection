from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, BackgroundTasks
from sqlmodel.ext.asyncio.session import AsyncSession
from app.services.yolo_service import YOLOService, get_yolo_service
from datetime import datetime, timezone
from app.core.database import get_session
from app.core.config import settings
from app.models.detection_record import DetectionRecord, DetectionRecordCreate
from pathlib import Path
import uuid
import time
import shutil
from loguru import logger
from sqlalchemy import text
import traceback

router = APIRouter(prefix="/detect", tags=["detection"])

@router.post("/detect-defect")
async def detect_defect(
    file: UploadFile = File(...),
    el_folder_path: str = Form(default=""),
    confidence: float = Form(default=settings.confidence_threshold),
    db: AsyncSession = Depends(get_session),
    yolo_service: YOLOService = Depends(get_yolo_service)
):
    """
    Main detection endpoint - processes EL images for defects
    Target: ~4 seconds processing time
    """
    
    # Validate file
    if not file.filename:
        raise HTTPException(400, "No filename provided")
    
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in settings.allowed_extensions:
        raise HTTPException(400, f"Invalid file type. Allowed: {settings.allowed_extensions}")
    
    # Check file size
    if file.size and file.size > settings.max_file_size:
        raise HTTPException(400, f"File too large. Max size: {settings.max_file_size} bytes")
    
    # Generate unique detection ID
    detection_id = str(uuid.uuid4())
    timestamp = time.time()
    
    try:
        logger.info(f"Starting detection for {file.filename} (ID: {detection_id})")
        
        # Save uploaded file to source directory
        source_path = settings.source_dir / f"{detection_id}_{file.filename}"
        
        with open(source_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Get file info
        file_stats = source_path.stat()
        
        # Run YOLO detection
        detection_result = await yolo_service.detect_defects_async(
            source_path, confidence
        )
        
        # Save results to processed folder
        result_paths = await yolo_service.save_results(
            detection_result, detection_id, file.filename
        )
        
        # Calculate total processing time
        total_processing_time = int((time.time() - timestamp) * 1000)
        
        # Create database record
        record_data = DetectionRecordCreate(
            original_filename=file.filename,
            el_folder_path=el_folder_path or settings.el_folder_path,
            source_file_path=f"source/{detection_id}_{file.filename}",
            total_defects=detection_result["total_defects"],
            confidence_threshold=confidence,
            processing_time_ms=total_processing_time,
            annotated_image_path=result_paths["annotated_image_path"],
            json_results_path=result_paths["json_results_path"],
            thumbnail_path=result_paths["thumbnail_path"],
            file_size_bytes=file_stats.st_size
        )
        
        # Save to database in background
        try:
            logger.info(f"💾 Attempting to save database record: {detection_id}")
            
            record = DetectionRecord(
                id=uuid.UUID(detection_id),
                **record_data.model_dump(),
                detection_details=detection_result,  # This might cause serialization error
                status="completed",
                processed_at=datetime.now(timezone.utc)
            )
            
            db.add(record)
            await db.commit()
            logger.success(f"✅ Database record saved successfully: {detection_id}")
            
        except Exception as db_error:
            logger.error(f"❌ DATABASE SAVE FAILED: {detection_id}")
            logger.error(f"Error type: {type(db_error).__name__}")
            logger.error(f"Error message: {str(db_error)}")
            logger.error(f"Full traceback: {traceback.format_exc()}")
            
            # Try to rollback
            try:
                await db.rollback()
            except:
                pass
            
            # Continue anyway - don't fail the API response
            logger.warning("Continuing without database save - check logs for DB errors")

        logger.success(f"Detection completed: {detection_id} ({total_processing_time}ms)")
        
        return {
            "detection_id": detection_id,
            "status": "completed",
            "processing_time_ms": total_processing_time,
            "total_defects": detection_result["total_defects"],
            "confidence_threshold": confidence,
            "results": {
                "annotated_image_path": result_paths["annotated_image_path"],
                "json_results_path": result_paths["json_results_path"],
                "thumbnail_path": result_paths["thumbnail_path"]
            },
            "defects": detection_result["defects"][:5],  # Return first 5 defects
            "source_file": str(source_path.relative_to(Path.cwd()))
        }
        
    except Exception as e:
        logger.error(f"Detection failed for {file.filename}: {e}")
        
        # Clean up source file on error
        if source_path.exists():
            source_path.unlink()
        
        raise HTTPException(500, f"Detection failed: {str(e)}")

async def save_detection_record(
    db: AsyncSession, 
    record_data: DetectionRecordCreate, 
    detection_result: dict,
    detection_id: str
):
    """Background task to save detection record to database"""
    try:
        record = DetectionRecord(
            id=uuid.UUID(detection_id),
            **record_data.model_dump(),
            detection_details=detection_result,
            status="completed",
            processed_at=datetime.now(timezone.utc)
        )
        
        db.add(record)
        await db.commit()
        logger.info(f"Database record saved: {detection_id}")
        
    except Exception as e:
        logger.error(f"Failed to save database record {detection_id}: {e}")
        await db.rollback()

@router.get("/status/{detection_id}")
async def get_detection_status(
    detection_id: str,
    db: AsyncSession = Depends(get_session)
):
    """Get status of a specific detection"""
    try:
        record = await db.get(DetectionRecord, uuid.UUID(detection_id))
        if not record:
            raise HTTPException(404, "Detection record not found")
        
        return {
            "detection_id": str(record.id),
            "status": record.status,
            "total_defects": record.total_defects,
            "processing_time_ms": record.processing_time_ms,
            "created_at": record.created_at,
            "processed_at": record.processed_at
        }
    except ValueError:
        raise HTTPException(400, "Invalid detection ID format")
    
@router.get("/test-db")
async def test_database(db: AsyncSession = Depends(get_session)):
    """Test database connection and create a dummy record"""
    try:
        # Test basic connection
        await db.execute(text("SELECT 1"))
        logger.info("✅ Database connection test passed")
        
        # Test table exists
        result = await db.execute(text("SELECT COUNT(*) FROM detection_records"))
        count = result.scalar()
        logger.info(f"✅ Table exists with {count} records")
        
        return {"status": "success", "message": f"Database has {count} records"}
        
    except Exception as e:
        logger.error(f"❌ Database test failed: {e}")
        logger.error(f"Full traceback: {traceback.format_exc()}")
        return {"status": "error", "message": str(e)}