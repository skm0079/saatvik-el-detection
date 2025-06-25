# File: app/api/endpoints/detection.py
from io import BytesIO
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, func
from app.services.yolo_service import YOLOService, get_yolo_service
from datetime import datetime, timezone
from app.core.database import get_session
from app.core.config import (
    get_current_machine_config,
    settings,
    get_all_machines_in_current_mode,
)
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
from typing import Optional
import pandas as pd

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
    Main detection endpoint with status tracking and machine context
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
        logger.info(f"🤖 Machine: {settings.machine_name} ({settings.machine_id})")

        # Save uploaded file to source directory
        source_path = settings.source_dir / f"{detection_id}_{file.filename}"

        with open(source_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        current_machine_config = get_current_machine_config()
        # Get file info
        file_stats = source_path.stat()
        logger.info(f"📁 File saved: {source_path} ({file_stats.st_size} bytes)")

        # Create initial database record with RECEIVED status + MACHINE CONTEXT + PATHS
        record_data = DetectionRecordCreate(
            original_filename=file.filename,
            el_folder_path=el_folder_path or settings.el_folder_path,
            source_file_path=f"{detection_id}_{file.filename}",
            machine_id=settings.machine_id,
            machine_name=settings.machine_name,
            # NEW: Store paths at creation time (for historical accuracy)
            source_path_at_creation=current_machine_config["smb_source_path"],
            watch_path_at_creation=current_machine_config["smb_watch_path"],
            processed_path_at_creation=current_machine_config["smb_processed_path"],
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
        logger.info(f"🏭 Record assigned to machine: {settings.machine_name}")
        logger.info(f"📁 Paths stored: {current_machine_config['smb_watch_path']}")
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
            "machine_id": settings.machine_id,
            "machine_name": settings.machine_name,
            # Include stored paths in response
            "paths_at_creation": {
                "source": current_machine_config["smb_source_path"],
                "watch": current_machine_config["smb_watch_path"],
                "processed": current_machine_config["smb_processed_path"],
            },
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
    """ENHANCED: Get detailed status + historical paths for specific detection"""
    try:
        record = await db.get(DetectionRecord, uuid.UUID(detection_id))
        if not record:
            raise HTTPException(404, "Detection record not found")

        return {
            "detection_id": str(record.id),
            "status": record.status.value,
            "original_filename": record.original_filename,
            "machine_id": record.machine_id,
            "machine_name": record.machine_name,
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
            # Historical paths (when this detection was created)
            "paths_at_creation": (
                {
                    "source": record.source_path_at_creation,
                    "watch": record.watch_path_at_creation,
                    "processed": record.processed_path_at_creation,
                    "context": "historical_at_creation",
                }
                if record.source_path_at_creation
                else None
            ),
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
    machine_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    format: str = Query("json", description="Response format: json or xlsx"),
    db: AsyncSession = Depends(get_session),
):
    """
    ENHANCED: Get recent detection records with smart path handling + XLSX export
    - Returns historical paths (when detection was created) for data integrity
    - Also includes current paths for operational context
    - Supports XLSX export with clean data format
    """
    try:
        # Build query
        stmt = select(DetectionRecord).order_by(DetectionRecord.created_at.desc())

        # Machine filtering logic
        if machine_id is None:
            stmt = stmt.where(DetectionRecord.machine_id == settings.machine_id)
            logger.info(f"🔍 Filtering by current machine: {settings.machine_id}")
        elif machine_id == "all":
            logger.info("🔍 Showing all machines in current environment")
        else:
            stmt = stmt.where(DetectionRecord.machine_id == machine_id)
            logger.info(f"🔍 Filtering by specific machine: {machine_id}")

        # Status filter
        if status:
            stmt = stmt.where(DetectionRecord.status == status)

        # Search filter
        if search:
            stmt = stmt.where(DetectionRecord.original_filename.ilike(f"%{search}%"))

        # Date filtering
        if date_from:
            try:
                from_datetime = datetime.fromisoformat(date_from.replace("Z", "+00:00"))
                stmt = stmt.where(DetectionRecord.created_at >= from_datetime)
                logger.info(f"📅 Filtering from: {from_datetime}")
            except ValueError as e:
                logger.warning(f"Invalid date_from format: {date_from}, error: {e}")

        if date_to:
            try:
                to_datetime = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
                stmt = stmt.where(DetectionRecord.created_at <= to_datetime)
                logger.info(f"📅 Filtering to: {to_datetime}")
            except ValueError as e:
                logger.warning(f"Invalid date_to format: {date_to}, error: {e}")

        # Execute query
        if format.lower() == "xlsx":
            # For XLSX, get more records (ignore pagination for export)
            export_stmt = stmt.limit(10000)  # Reasonable limit for Excel
            result = await db.execute(export_stmt)
            records = result.scalars().all()
        else:
            # Regular JSON pagination
            stmt = stmt.offset(offset).limit(limit)
            result = await db.execute(stmt)
            records = result.scalars().all()

        # Get current machine paths for operational context
        try:
            current_machine_config = get_current_machine_config()
            current_paths = {
                "source": current_machine_config["smb_source_path"],
                "watch": current_machine_config["smb_watch_path"],
                "processed": current_machine_config["smb_processed_path"],
            }
        except Exception as e:
            logger.warning(f"Could not get current machine paths: {e}")
            current_paths = None

        # XLSX Export Logic
        if format.lower() == "xlsx":
            logger.info(f"📊 Generating XLSX export for {len(records)} records")

            # Clean data format - NO BOUNDING BOX JARGON
            export_data = []
            for record in records:
                # Parse defect details cleanly
                defect_summary = "No defects found"
                if record.detection_details and record.detection_details.get("defects"):
                    defects = record.detection_details["defects"]
                    defect_types = {}

                    # Group defects by type and collect confidences
                    for defect in defects:
                        class_name = defect.get("class_name", "Unknown")
                        confidence = defect.get("confidence", 0)
                        if class_name in defect_types:
                            defect_types[class_name].append(confidence)
                        else:
                            defect_types[class_name] = [confidence]

                    # Format as readable text
                    defect_parts = []
                    for defect_type, confidences in defect_types.items():
                        avg_confidence = sum(confidences) / len(confidences)
                        count = len(confidences)
                        defect_parts.append(
                            f"{defect_type} ({count}x, avg {avg_confidence:.1%})"
                        )

                    defect_summary = "; ".join(defect_parts)

                export_data.append(
                    {
                        "Machine ID": record.machine_id,
                        "Machine Name": record.machine_name,
                        "Filename": record.original_filename,
                        "Total Defects": record.total_defects,
                        "Confidence Threshold": f"{record.confidence_threshold:.1%}",
                        "Processing Time (ms)": record.processing_time_ms,
                        "Defect Details": defect_summary,
                        "Status": record.status.value.upper(),
                        "Processed At": (
                            record.completed_at.strftime("%Y-%m-%d %H:%M:%S UTC")
                            if record.completed_at
                            else "Not completed"
                        ),
                        "Created At": record.created_at.strftime(
                            "%Y-%m-%d %H:%M:%S UTC"
                        ),
                        "Folder Path": record.el_folder_path,
                        # Historical paths (when detection was created)
                        "Source Path (At Creation)": record.source_path_at_creation
                        or "Not recorded",
                        "Watch Path (At Creation)": record.watch_path_at_creation
                        or "Not recorded",
                        "Processed Path (At Creation)": record.processed_path_at_creation
                        or "Not recorded",
                    }
                )

            # Create Excel file
            df = pd.DataFrame(export_data)

            # Generate filename with filters
            filename = f"saatvik_detections_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            if machine_id and machine_id != "all":
                filename += f"_{machine_id.replace(' ', '_')}"
            if date_from:
                filename += f"_from_{date_from[:10]}"
            if date_to:
                filename += f"_to_{date_to[:10]}"
            filename += ".xlsx"

            # Create Excel buffer
            buffer = BytesIO()
            with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
                df.to_excel(writer, index=False, sheet_name="Detections")

                # Auto-adjust column widths
                worksheet = writer.sheets["Detections"]
                for column in worksheet.columns:
                    max_length = 0
                    column_letter = column[0].column_letter
                    for cell in column:
                        try:
                            if len(str(cell.value)) > max_length:
                                max_length = len(str(cell.value))
                        except:
                            pass
                    adjusted_width = min(max_length + 2, 50)
                    worksheet.column_dimensions[column_letter].width = adjusted_width

            buffer.seek(0)

            logger.success(f"📊 XLSX export ready: {filename}")

            return StreamingResponse(
                BytesIO(buffer.read()),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment; filename={filename}"},
            )

        # Regular JSON Response
        # Get total count with same filters
        count_stmt = select(func.count(DetectionRecord.id))

        # Apply same filters to count
        if machine_id is None:
            count_stmt = count_stmt.where(
                DetectionRecord.machine_id == settings.machine_id
            )
        elif machine_id != "all":
            count_stmt = count_stmt.where(DetectionRecord.machine_id == machine_id)

        if status:
            count_stmt = count_stmt.where(DetectionRecord.status == status)
        if search:
            count_stmt = count_stmt.where(
                DetectionRecord.original_filename.ilike(f"%{search}%")
            )

        # Apply date filters to count as well
        if date_from:
            try:
                from_datetime = datetime.fromisoformat(date_from.replace("Z", "+00:00"))
                count_stmt = count_stmt.where(
                    DetectionRecord.created_at >= from_datetime
                )
            except ValueError:
                pass

        if date_to:
            try:
                to_datetime = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
                count_stmt = count_stmt.where(DetectionRecord.created_at <= to_datetime)
            except ValueError:
                pass

        count_result = await db.execute(count_stmt)
        total = count_result.scalar()

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "machine_filter": machine_id or settings.machine_id,
            "date_filters": {
                "date_from": date_from,
                "date_to": date_to,
            },
            # Current operational paths (for live operations)
            "current_machine_paths": current_paths,
            "paths_context": "current_operational",
            "detections": [
                {
                    "detection_id": str(record.id),
                    "original_filename": record.original_filename,
                    "machine_id": record.machine_id,
                    "machine_name": record.machine_name,
                    "total_defects": record.total_defects,
                    "status": record.status.value,
                    "created_at": record.created_at.isoformat(),
                    "processing_time_ms": record.processing_time_ms,
                    "confidence_threshold": record.confidence_threshold,
                    "annotated_image_path": record.annotated_image_path,
                    "thumbnail_path": record.thumbnail_path,
                    "el_folder_path": record.el_folder_path,
                    "error_message": record.error_message,
                    # Historical paths (when this detection was created)
                    "paths_at_creation": (
                        {
                            "source": record.source_path_at_creation,
                            "watch": record.watch_path_at_creation,
                            "processed": record.processed_path_at_creation,
                        }
                        if record.source_path_at_creation
                        else None
                    ),
                }
                for record in records
            ],
        }

    except Exception as e:
        logger.error(f"Failed to get recent detections: {e}")
        raise HTTPException(500, f"Database error: {str(e)}")


@router.get("/machines")
async def get_available_machines():
    """ENHANCED: Get machines + CURRENT operational paths (for live operations)"""
    try:
        machines = get_all_machines_in_current_mode()
        current_machine_config = get_current_machine_config()

        return {
            "current_machine": settings.machine_id,
            "current_mode": settings.current_mode,
            "available_machines": machines,
            "machine_names": {machine: machine for machine in machines},
            # CURRENT operational paths (changes with shifts)
            "current_machine_paths": {
                "source": current_machine_config["smb_source_path"],
                "watch": current_machine_config["smb_watch_path"],
                "processed": current_machine_config["smb_processed_path"],
            },
            # Metadata
            "paths_context": "current_operational",
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"Failed to get machines: {e}")
        raise HTTPException(500, f"Failed to get machines: {str(e)}")


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

        # Test machine filtering
        machine_count_stmt = select(func.count(DetectionRecord.id)).where(
            DetectionRecord.machine_id == settings.machine_id
        )
        machine_count_result = await db.execute(machine_count_stmt)
        machine_count = machine_count_result.scalar()

        return {
            "status": "success",
            "message": f"Database operational with {count} total records",
            "total_records": count,
            "current_machine": settings.machine_id,
            "current_machine_records": machine_count,
        }

    except Exception as e:
        logger.error(f"❌ Database test failed: {e}")
        return {"status": "error", "message": str(e)}
