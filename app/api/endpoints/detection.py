# File: app/api/endpoints/detection.py

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, func
from app.services.yolo_service import YOLOService, get_yolo_service
from datetime import datetime, timezone
from app.core.database import get_session
from app.core.config import settings
from app.models.detection_record import (
    DetectionRecord,
    DetectionRecordCreate,
    DetectionStatus,
)
from pathlib import Path
import uuid
import time
import shutil
from loguru import logger
import traceback
from sqlalchemy import text

router = APIRouter(prefix="/detect", tags=["detection"])


@router.post("/detect-defect")
async def detect_defect(
    file: UploadFile = File(...),
    el_folder_path: str = Form(default=""),
    confidence: float = Form(default=settings.confidence_threshold),
    db: AsyncSession = Depends(get_session),
    yolo_service: YOLOService = Depends(get_yolo_service),
):
    """
    Main detection endpoint with status tracking
    Status flow: RECEIVED → PROCESSING → AI_COMPLETE → RESULTS_SAVED → COMPLETED
    """

    # Validate file
    if not file.filename:
        raise HTTPException(400, "No filename provided")

    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in settings.allowed_extensions:
        raise HTTPException(
            400, f"Invalid file type. Allowed: {settings.allowed_extensions}"
        )

    # Check file size
    if file.size and file.size > settings.max_file_size:
        raise HTTPException(
            400, f"File too large. Max size: {settings.max_file_size} bytes"
        )

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

        # Create initial database record with RECEIVED status
        record_data = DetectionRecordCreate(
            original_filename=file.filename,
            el_folder_path=el_folder_path or settings.el_folder_path,
            source_file_path=f"{detection_id}_{file.filename}",
            total_defects=0,
            confidence_threshold=confidence,
            processing_time_ms=0,
            file_size_bytes=file_stats.st_size,
        )

        # Create record with RECEIVED status
        record = DetectionRecord(
            id=uuid.UUID(detection_id),
            **record_data.model_dump(),
            status=DetectionStatus.RECEIVED,
            created_at=datetime.now(timezone.utc),
        )

        db.add(record)
        await db.commit()
        await db.refresh(record)
        logger.info(f"📝 Database record created with RECEIVED status: {detection_id}")

        # Update status to PROCESSING
        await update_detection_status(
            db,
            detection_id,
            DetectionStatus.PROCESSING,
            processing_started_at=datetime.now(timezone.utc),
        )
        logger.info(f"🤖 Status updated to PROCESSING")

        # Run YOLO detection
        logger.info(f"🤖 Running YOLO detection with confidence {confidence}")
        detection_result = await yolo_service.detect_defects_async(
            source_path, confidence
        )

        logger.info(
            f"✅ YOLO detection complete: {detection_result['total_defects']} defects found"
        )

        # Update status to AI_COMPLETE
        await update_detection_status(
            db,
            detection_id,
            DetectionStatus.AI_COMPLETE,
            ai_completed_at=datetime.now(timezone.utc),
        )
        logger.info(f"🧠 Status updated to AI_COMPLETE")

        # Save results to processed folder
        result_paths = await yolo_service.save_results(
            detection_result, detection_id, file.filename
        )
        logger.info(f"💾 Results saved to: {result_paths}")

        # Calculate total processing time
        total_processing_time = int((time.time() - timestamp) * 1000)

        # Clean detection_result for JSON serialization
        clean_detection_details = {
            "total_defects": detection_result["total_defects"],
            "processing_time_ms": detection_result["processing_time_ms"],
            "model_confidence": detection_result.get("model_confidence", confidence),
            "image_path": str(detection_result["image_path"]),
            "defects": [],
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
                    "height": float(defect["bbox"]["height"]),
                },
                "bbox_normalized": {
                    "x1": float(defect["bbox_normalized"]["x1"]),
                    "y1": float(defect["bbox_normalized"]["y1"]),
                    "x2": float(defect["bbox_normalized"]["x2"]),
                    "y2": float(defect["bbox_normalized"]["y2"]),
                },
            }
            clean_detection_details["defects"].append(clean_defect)

        # Update record with final results and RESULTS_SAVED status
        try:
            # FIXED: Use execute() + scalars() for compatibility
            stmt = select(DetectionRecord).where(
                DetectionRecord.id == uuid.UUID(detection_id)
            )
            result = await db.execute(stmt)
            record = result.scalars().first()

            if not record:
                raise Exception("Record not found after creation")

            # Update fields
            record.total_defects = detection_result["total_defects"]
            record.processing_time_ms = total_processing_time
            record.annotated_image_path = result_paths["annotated_image_path"]
            record.json_results_path = result_paths["json_results_path"]
            record.thumbnail_path = result_paths["thumbnail_path"]
            record.detection_details = clean_detection_details
            record.status = DetectionStatus.RESULTS_SAVED
            record.results_saved_at = datetime.now(timezone.utc)
            record.completed_at = datetime.now(timezone.utc)
            record.processed_at = datetime.now(timezone.utc)

            await db.commit()
            await db.refresh(record)

            logger.success(f"📊 Status updated to RESULTS_SAVED: {detection_id}")

        except Exception as db_error:
            logger.error(f"❌ DATABASE UPDATE FAILED: {detection_id}")
            logger.error(f"Error: {str(db_error)}")
            await db.rollback()
            raise HTTPException(500, f"Database error: {str(db_error)}")

        logger.success(
            f"🎯 Detection completed: {detection_id} ({total_processing_time}ms)"
        )

        return {
            "detection_id": detection_id,
            "status": DetectionStatus.RESULTS_SAVED.value,
            "processing_time_ms": total_processing_time,
            "total_defects": detection_result["total_defects"],
            "confidence_threshold": confidence,
            "results": {
                "annotated_image_path": result_paths["annotated_image_path"],
                "json_results_path": result_paths["json_results_path"],
                "thumbnail_path": result_paths["thumbnail_path"],
            },
            "defects": clean_detection_details["defects"][:5],
            "source_file": str(source_path.relative_to(Path.cwd())),
            "database_saved": True,
            "next_step": "Client notification pending",
        }

    except HTTPException:
        # Mark as failed if HTTP error
        if "detection_id" in locals():
            await update_detection_status(
                db,
                detection_id,
                DetectionStatus.FAILED,
                error_message="HTTP validation error",
            )
        raise
    except Exception as e:
        logger.error(f"❌ Detection failed for {file.filename}: {e}")
        logger.error(f"Full traceback: {traceback.format_exc()}")

        # Mark as failed
        if "detection_id" in locals():
            await update_detection_status(
                db, detection_id, DetectionStatus.FAILED, error_message=str(e)
            )

        # Clean up source file on error
        if source_path and source_path.exists():
            try:
                source_path.unlink()
                logger.info(f"🗑️  Cleaned up source file: {source_path}")
            except Exception as cleanup_error:
                logger.warning(f"Failed to cleanup source file: {cleanup_error}")

        raise HTTPException(500, f"Detection failed: {str(e)}")


async def update_detection_status(
    db: AsyncSession,
    detection_id: str,
    status: DetectionStatus,
    error_message: str = None,
    **timestamp_kwargs,
):
    """Helper function to update detection status and timestamps"""
    try:
        # FIXED: Use execute() + scalars() for compatibility
        stmt = select(DetectionRecord).where(
            DetectionRecord.id == uuid.UUID(detection_id)
        )
        result = await db.execute(stmt)
        record = result.scalars().first()

        if record:
            record.status = status
            if error_message:
                record.error_message = error_message

            # Update timestamp fields
            for field, value in timestamp_kwargs.items():
                if hasattr(record, field):
                    setattr(record, field, value)

            await db.commit()
            logger.info(f"📊 Status updated to {status.value}: {detection_id}")

    except Exception as e:
        logger.error(f"Failed to update status for {detection_id}: {e}")
        await db.rollback()


@router.get("/status/{detection_id}")
async def get_detection_status(
    detection_id: str, db: AsyncSession = Depends(get_session)
):
    """Get detailed status of a specific detection"""
    try:
        record = await db.get(DetectionRecord, uuid.UUID(detection_id))
        if not record:
            raise HTTPException(404, "Detection record not found")

        return {
            "detection_id": str(record.id),
            "status": record.status.value,
            "original_filename": record.original_filename,
            "total_defects": record.total_defects,
            "processing_time_ms": record.processing_time_ms,
            "confidence_threshold": record.confidence_threshold,
            "created_at": record.created_at.isoformat(),
            "processing_started_at": (
                record.processing_started_at.isoformat()
                if record.processing_started_at
                else None
            ),
            "ai_completed_at": (
                record.ai_completed_at.isoformat() if record.ai_completed_at else None
            ),
            "results_saved_at": (
                record.results_saved_at.isoformat() if record.results_saved_at else None
            ),
            "client_notified_at": (
                record.client_notified_at.isoformat()
                if record.client_notified_at
                else None
            ),
            "completed_at": (
                record.completed_at.isoformat() if record.completed_at else None
            ),
            "file_size_bytes": record.file_size_bytes,
            "error_message": record.error_message,
            "annotated_image_path": record.annotated_image_path,
            "thumbnail_path": record.thumbnail_path,
            "el_folder_path": record.el_folder_path,
        }
    except ValueError:
        raise HTTPException(400, "Invalid detection ID format")
    except Exception as e:
        logger.error(f"Failed to get detection status: {e}")
        raise HTTPException(500, f"Database error: {str(e)}")


@router.put("/status/{detection_id}")
async def update_detection_status_endpoint(
    detection_id: str, status: str, db: AsyncSession = Depends(get_session)
):
    """Update detection status via PUT request"""
    try:
        record = await db.get(DetectionRecord, uuid.UUID(detection_id))
        if not record:
            raise HTTPException(404, "Detection record not found")

        # Convert string to enum
        status_enum = DetectionStatus(status)
        record.status = status_enum

        if status == "saved":
            record.completed_at = datetime.now(timezone.utc)
            record.client_notified_at = datetime.now(timezone.utc)

        await db.commit()
        return {"status": "success", "detection_id": detection_id}

    except Exception as e:
        logger.error(f"Failed to update status: {e}")
        raise HTTPException(500, f"Update failed: {str(e)}")


@router.get("/recent")
async def get_recent_detections(
    limit: int = 10,
    offset: int = 0,
    status: DetectionStatus = None,
    search: str = None,
    db: AsyncSession = Depends(get_session),
):
    """Get recent detection records for frontend"""
    try:
        # Build query
        stmt = select(DetectionRecord).order_by(DetectionRecord.created_at.desc())

        # Add status filter
        if status:
            stmt = stmt.where(DetectionRecord.status == status)

        # Add search filter  ← ADD THIS
        if search:
            stmt = stmt.where(DetectionRecord.original_filename.ilike(f"%{search}%"))

        # Pagination
        stmt = stmt.offset(offset).limit(limit)
        result = await db.execute(stmt)
        records = result.scalars().all()

        # Get total count with same filters
        count_stmt = select(func.count(DetectionRecord.id))
        if status:
            count_stmt = count_stmt.where(DetectionRecord.status == status)
        if search:  # ← ADD THIS
            count_stmt = count_stmt.where(
                DetectionRecord.original_filename.ilike(f"%{search}%")
            )

        count_result = await db.execute(count_stmt)
        total = count_result.scalar()

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "detections": [
                {
                    "detection_id": str(record.id),
                    "original_filename": record.original_filename,
                    "total_defects": record.total_defects,
                    "status": record.status.value,
                    "created_at": record.created_at.isoformat(),
                    "processing_time_ms": record.processing_time_ms,
                    "confidence_threshold": record.confidence_threshold,
                    "annotated_image_path": record.annotated_image_path,
                    "thumbnail_path": record.thumbnail_path,
                    "el_folder_path": record.el_folder_path,
                    "error_message": record.error_message,
                }
                for record in records
            ],
        }
    except Exception as e:
        logger.error(f"Failed to get recent detections: {e}")
        raise HTTPException(500, f"Database error: {str(e)}")


@router.get("/test-db")
async def test_database(db: AsyncSession = Depends(get_session)):
    """Test database connection and operations"""
    try:
        # Test basic connection
        logger.info("🔍 Testing database connection...")
        result = await db.execute(text("SELECT 1"))
        result.scalar()
        logger.info("✅ Database connection test passed")

        # Test table count
        count_stmt = select(func.count(DetectionRecord.id))
        count_result = await db.execute(count_stmt)
        count = count_result.scalar()
        logger.info(f"✅ Table exists with {count} records")

        return {
            "status": "success",
            "message": f"Database operational with {count} records",
            "record_count": count,
        }

    except Exception as e:
        logger.error(f"❌ Database test failed: {e}")
        return {"status": "error", "message": str(e)}
