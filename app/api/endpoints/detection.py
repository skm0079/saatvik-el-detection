# File: app/api/endpoints/detection.py

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, func
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
    source_path = None
    
    try:
        logger.info(f"🔍 Starting detection for {file.filename} (ID: {detection_id})")
        
        # Save uploaded file to source directory
        source_path = settings.source_dir / f"{detection_id}_{file.filename}"
        
        with open(source_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Get file info
        file_stats = source_path.stat()
        logger.info(f"📁 File saved: {source_path} ({file_stats.st_size} bytes)")
        
        # Run YOLO detection
        logger.info(f"🤖 Running YOLO detection with confidence {confidence}")
        detection_result = await yolo_service.detect_defects_async(
            source_path, confidence
        )
        
        logger.info(f"✅ YOLO detection complete: {detection_result['total_defects']} defects found")
        
        # Save results to processed folder
        result_paths = await yolo_service.save_results(
            detection_result, detection_id, file.filename
        )
        logger.info(f"💾 Results saved to: {result_paths}")
        
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
        
        # Clean detection_result for JSON serialization
        logger.info(f"💾 Preparing database record: {detection_id}")
        
        clean_detection_details = {
            "total_defects": detection_result["total_defects"],
            "processing_time_ms": detection_result["processing_time_ms"],
            "model_confidence": detection_result.get("model_confidence", confidence),
            "image_path": str(detection_result["image_path"]),
            "defects": []
        }
        
        # Clean defects list (remove numpy types)
        for defect in detection_result.get("defects", []):
            clean_defect = {
                "class_name": str(defect["class_name"]),
                "confidence": float(defect["confidence"]),
                "bbox": {
                    "x": float(defect["bbox"]["x"]),
                    "y": float(defect["bbox"]["y"]),
                    "width": float(defect["bbox"]["width"]),
                    "height": float(defect["bbox"]["height"])
                },
                "bbox_normalized": {
                    "x1": float(defect["bbox_normalized"]["x1"]),
                    "y1": float(defect["bbox_normalized"]["y1"]),
                    "x2": float(defect["bbox_normalized"]["x2"]),
                    "y2": float(defect["bbox_normalized"]["y2"])
                }
            }
            clean_detection_details["defects"].append(clean_defect)
        
        # Create database record with cleaned data - FIXED: No deprecated methods
        try:
            record = DetectionRecord(
                id=uuid.UUID(detection_id),
                original_filename=record_data.original_filename,
                el_folder_path=record_data.el_folder_path,
                source_file_path=record_data.source_file_path,
                total_defects=record_data.total_defects,
                confidence_threshold=record_data.confidence_threshold,
                processing_time_ms=record_data.processing_time_ms,
                annotated_image_path=record_data.annotated_image_path,
                json_results_path=record_data.json_results_path,
                thumbnail_path=record_data.thumbnail_path,
                file_size_bytes=record_data.file_size_bytes,
                detection_details=clean_detection_details,
                status="completed",
                created_at=datetime.now(timezone.utc),
                processed_at=datetime.now(timezone.utc)
            )
                    
            db.add(record)
            await db.commit()
            await db.refresh(record)
            
            logger.success(f"✅ Database record saved successfully: {detection_id}")
            
        except Exception as db_error:
            logger.error(f"❌ DATABASE SAVE FAILED: {detection_id}")
            logger.error(f"Error: {str(db_error)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            await db.rollback()
            
            # Clean up source file on database error
            if source_path and source_path.exists():
                try:
                    source_path.unlink()
                    logger.info(f"🗑️  Cleaned up source file: {source_path}")
                except Exception:
                    pass
            
            raise HTTPException(500, f"Database error: {str(db_error)}")
        
        logger.success(f"🎯 Detection completed: {detection_id} ({total_processing_time}ms)")
        
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
            "defects": clean_detection_details["defects"][:5],  # Return first 5 defects
            "source_file": str(source_path.relative_to(Path.cwd())),
            "database_saved": True
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"❌ Detection failed for {file.filename}: {e}")
        logger.error(f"Full traceback: {traceback.format_exc()}")
        
        # Clean up source file on error
        if source_path and source_path.exists():
            try:
                source_path.unlink()
                logger.info(f"🗑️  Cleaned up source file: {source_path}")
            except Exception as cleanup_error:
                logger.warning(f"Failed to cleanup source file: {cleanup_error}")
        
        # Rollback database transaction
        try:
            await db.rollback()
        except Exception as rollback_error:
            logger.warning(f"Failed to rollback database: {rollback_error}")
        
        raise HTTPException(500, f"Detection failed: {str(e)}")

@router.get("/status/{detection_id}")
async def get_detection_status(
    detection_id: str,
    db: AsyncSession = Depends(get_session)
):
    """Get status of a specific detection"""
    try:
        # FIXED: Use db.get() instead of deprecated methods
        record = await db.get(DetectionRecord, uuid.UUID(detection_id))
        if not record:
            raise HTTPException(404, "Detection record not found")
        
        return {
            "detection_id": str(record.id),
            "status": record.status,
            "original_filename": record.original_filename,
            "total_defects": record.total_defects,
            "processing_time_ms": record.processing_time_ms,
            "confidence_threshold": record.confidence_threshold,
            "created_at": record.created_at,
            "processed_at": record.processed_at,
            "file_size_bytes": record.file_size_bytes
        }
    except ValueError:
        raise HTTPException(400, "Invalid detection ID format")
    except Exception as e:
        logger.error(f"Failed to get detection status: {e}")
        raise HTTPException(500, f"Database error: {str(e)}")

@router.get("/recent")
async def get_recent_detections(
    limit: int = 10,
    offset: int = 0,
    status: str = None,
    db: AsyncSession = Depends(get_session)
):
    """Get recent detection records for frontend"""
    try:
        # FIXED: Use db.exec() instead of deprecated db.execute()
        # Build query
        stmt = select(DetectionRecord).order_by(DetectionRecord.created_at.desc())
        
        # Add status filter if provided
        if status:
            stmt = stmt.where(DetectionRecord.status == status)
        
        # Add pagination
        stmt = stmt.offset(offset).limit(limit)
        
        # FIXED: Use exec() instead of execute()
        result = await db.exec(stmt)
        records = result.all()
        
        # Get total count - FIXED: Use exec() instead of execute()
        count_stmt = select(func.count(DetectionRecord.id))
        if status:
            count_stmt = count_stmt.where(DetectionRecord.status == status)
        count_result = await db.exec(count_stmt)
        total = count_result.one()
        
        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "detections": [
                {
                    "detection_id": str(record.id),
                    "original_filename": record.original_filename,
                    "total_defects": record.total_defects,
                    "status": record.status,
                    "created_at": record.created_at.isoformat(),
                    "processing_time_ms": record.processing_time_ms,
                    "confidence_threshold": record.confidence_threshold,
                    "annotated_image_path": record.annotated_image_path,
                    "thumbnail_path": record.thumbnail_path,
                    "el_folder_path": record.el_folder_path
                }
                for record in records
            ]
        }
    except Exception as e:
        logger.error(f"Failed to get recent detections: {e}")
        raise HTTPException(500, f"Database error: {str(e)}")

@router.get("/test-db")
async def test_database(db: AsyncSession = Depends(get_session)):
    """Test database connection and operations"""
    try:
        # FIXED: Use db.exec() with text() for raw SQL
        from sqlalchemy import text
        
        # Test basic connection
        logger.info("🔍 Testing database connection...")
        result = await db.exec(text("SELECT 1"))
        result.one()
        logger.info("✅ Database connection test passed")
        
        # Test table count - FIXED: Use exec() instead of execute()
        count_stmt = select(func.count(DetectionRecord.id))
        count_result = await db.exec(count_stmt)
        count = count_result.one()
        logger.info(f"✅ Table exists with {count} records")
        
        # Test table structure
        table_info_result = await db.exec(text("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'detection_records'
            ORDER BY ordinal_position
        """))
        columns = table_info_result.all()
        
        return {
            "status": "success",
            "message": f"Database operational with {count} records",
            "table_columns": [{"name": col[0], "type": col[1]} for col in columns],
            "record_count": count
        }
        
    except Exception as e:
        logger.error(f"❌ Database test failed: {e}")
        logger.error(f"Full traceback: {traceback.format_exc()}")
        return {
            "status": "error", 
            "message": str(e),
            "traceback": traceback.format_exc()
        }