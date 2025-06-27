# File: backend/app/api/endpoints/detection.py

from io import BytesIO
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select, func, text
from app.services.yolo_service import YOLOService, get_yolo_service
from datetime import datetime, timedelta, timezone
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
from typing import Optional
import pandas as pd

# Import the parse_date_filter function from analytics
from .analytics import parse_date_filter

router = APIRouter(prefix="/detect", tags=["detection"])


@router.post("/detect-defect")
async def detect_defect(
    file: UploadFile = File(...),
    el_folder_path: str = Form(default=""),
    confidence: float = Form(default=settings.confidence_threshold),
    machine_name: str = Form(default=""),
    # Grid configuration parameters
    enable_grid: bool = Form(default=True, description="Enable grid cell mapping"),
    grid_rows: int = Form(default=6, description="Number of grid rows"),
    grid_cols: int = Form(default=24, description="Number of grid columns"),
    db: AsyncSession = Depends(get_session),
    yolo_service: YOLOService = Depends(get_yolo_service),
):
    """
    ENHANCED: Main detection endpoint with grid cell mapping support
    """

    # Validate file
    if not file.filename:
        raise HTTPException(400, "No filename provided")

    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in settings.allowed_extensions:
        raise HTTPException(
            400, f"Invalid file type. Allowed: {settings.allowed_extensions}"
        )

    if file.size and file.size > settings.max_file_size:
        raise HTTPException(
            400, f"File too large. Max size: {settings.max_file_size} bytes"
        )

    detection_id = str(uuid.uuid4())
    # Include machine in the saved filename for processed watcher
    actual_machine_name = machine_name or settings.machine_name
    machine_safe_name = actual_machine_name.replace(" ", "_").replace("/", "_")

    timestamp = time.time()
    source_path = None

    try:
        logger.info(f"🔍 Starting detection for {file.filename}")
        logger.info(f"📐 Grid: {grid_rows}x{grid_cols}, enabled: {enable_grid}")

        # Save uploaded file
        source_path = (
            settings.source_dir / f"{detection_id}_{machine_safe_name}_{file.filename}"
        )
        with open(source_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        current_machine_config = get_current_machine_config()
        file_stats = source_path.stat()

        # Get actual machine_id from config
        actual_machine_id = actual_machine_name
        try:
            from app.core.config import get_shared_config

            shared_config = get_shared_config()
            current_mode = shared_config.get("current_mode", "dev")
            machines = shared_config["modes"][current_mode]["machines"]

            # Find the actual machine_id from config
            for machine_key, machine_config in machines.items():
                if (
                    machine_config["machine_name"] == actual_machine_name
                    or machine_key == actual_machine_name
                ):
                    actual_machine_id = machine_config["machine_id"]
                    break
        except Exception as e:
            logger.warning(f"Could not lookup machine_id: {e}")
            actual_machine_id = actual_machine_name

        # Configure grid settings for YOLO service
        grid_config = {
            "num_rows": grid_rows,
            "num_cols": grid_cols,
            "row_labels": ["A", "B", "C", "D", "E", "F"][:grid_rows],
            "enable_grid_mapping": enable_grid,
        }

        # Update YOLO service with grid configuration
        yolo_service.update_grid_config(grid_config)

        # Create database record
        record_data = DetectionRecordCreate(
            original_filename=file.filename,
            el_folder_path=el_folder_path or settings.el_folder_path,
            source_file_path=f"{detection_id}_{machine_safe_name}_{file.filename}",
            machine_id=actual_machine_id,
            machine_name=actual_machine_name,
            source_path_at_creation=current_machine_config["smb_source_path"],
            watch_path_at_creation=current_machine_config["smb_watch_path"],
            processed_path_at_creation=current_machine_config["smb_processed_path"],
            total_defects=0,
            confidence_threshold=confidence,
            processing_time_ms=0,
            file_size_bytes=file_stats.st_size,
            grid_config=grid_config,
        )

        record = DetectionRecord(
            id=uuid.UUID(detection_id),
            **record_data.model_dump(),
            status=DetectionStatus.RECEIVED,
            created_at=datetime.now(timezone.utc),
        )

        db.add(record)
        await db.commit()
        await db.refresh(record)

        # Update to PROCESSING
        await update_detection_status(
            db,
            detection_id,
            DetectionStatus.PROCESSING,
            processing_started_at=datetime.now(timezone.utc),
        )

        # Run YOLO detection with grid mapping
        detection_result = await yolo_service.detect_defects_async(
            source_path, confidence
        )

        logger.info(
            f"✅ Detection complete: {detection_result['total_defects']} defects"
        )

        # Log grid insights if available
        grid_stats = detection_result.get("grid_statistics", {})
        if grid_stats.get("cells_with_defects"):
            logger.info(f"📊 Grid: {grid_stats['cells_with_defects']} cells affected")

        # Update to AI_COMPLETE
        await update_detection_status(
            db,
            detection_id,
            DetectionStatus.AI_COMPLETE,
            ai_completed_at=datetime.now(timezone.utc),
        )

        # Save results
        result_paths = await yolo_service.save_results(
            detection_result, detection_id, file.filename
        )
        total_processing_time = int((time.time() - timestamp) * 1000)

        # Clean detection data for JSON storage
        clean_detection_details = {
            "total_defects": detection_result["total_defects"],
            "processing_time_ms": detection_result["processing_time_ms"],
            "model_confidence": detection_result.get("model_confidence", confidence),
            "image_path": str(detection_result["image_path"]),
            "defects": [],
            "image_dimensions": detection_result.get("image_dimensions", {}),
        }

        # Clean defects with grid information
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
                # Grid cell information from YOLO service
                "grid_cell": defect.get("grid_cell", ""),
                "center_coordinates": defect.get("center_coordinates", {}),
                "image_dimensions": defect.get("image_dimensions", {}),
            }
            clean_detection_details["defects"].append(clean_defect)

        # Update record with final results
        stmt = select(DetectionRecord).where(
            DetectionRecord.id == uuid.UUID(detection_id)
        )
        result = await db.execute(stmt)
        record = result.scalars().first()

        if record:
            record.total_defects = detection_result["total_defects"]
            record.processing_time_ms = total_processing_time
            record.annotated_image_path = result_paths["annotated_image_path"]
            record.json_results_path = result_paths["json_results_path"]
            record.thumbnail_path = result_paths["thumbnail_path"]
            record.grid_report_path = result_paths.get("grid_report_path")
            record.detection_details = clean_detection_details
            record.grid_statistics = detection_result.get("grid_statistics", {})
            record.status = DetectionStatus.RESULTS_SAVED
            record.results_saved_at = datetime.now(timezone.utc)
            record.completed_at = datetime.now(timezone.utc)

            await db.commit()
            await db.refresh(record)

        logger.success(f"🎯 Detection completed: {detection_id}")

        # Extract affected cells for response
        affected_cells = []
        if detection_result.get("grid_statistics", {}).get("defects_per_cell"):
            affected_cells = list(
                detection_result["grid_statistics"]["defects_per_cell"].keys()
            )

        # Return response with real grid data
        return {
            "detection_id": detection_id,
            "original_filename": file.filename,
            "total_defects": detection_result["total_defects"],
            "processing_time_ms": total_processing_time,
            "confidence_threshold": confidence,
            "status": DetectionStatus.RESULTS_SAVED.value,
            # Machine context
            "machine_id": actual_machine_id,
            "machine_name": actual_machine_name,
            # Grid analysis (real data from YOLO)
            "grid_analysis": {
                "affected_cells": affected_cells,
                "cells_with_defects": grid_stats.get("cells_with_defects", 0),
                "defects_per_cell": grid_stats.get("defects_per_cell", {}),
                "grid_config_used": grid_config,
            },
            # File paths
            "results": {
                "annotated_image_path": result_paths["annotated_image_path"],
                "json_results_path": result_paths["json_results_path"],
                "thumbnail_path": result_paths["thumbnail_path"],
                "grid_report_path": result_paths.get("grid_report_path"),
            },
            # Sample defects (first 5 with grid cells)
            "sample_defects": [
                {
                    "type": defect["class_name"],
                    "confidence": round(defect["confidence"], 3),
                    "grid_cell": defect.get("grid_cell", ""),
                    "coordinates": defect.get("center_coordinates", {}),
                }
                for defect in clean_detection_details["defects"][:5]
            ],
            # Historical paths
            "paths_at_creation": {
                "source": current_machine_config["smb_source_path"],
                "watch": current_machine_config["smb_watch_path"],
                "processed": current_machine_config["smb_processed_path"],
            },
            "database_saved": True,
            "next_step": "Available for viewing and analysis",
        }

    except HTTPException:
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

        if "detection_id" in locals():
            await update_detection_status(
                db, detection_id, DetectionStatus.FAILED, error_message=str(e)
            )

        # Clean up source file on error
        if source_path and source_path.exists():
            try:
                source_path.unlink()
                logger.info(f"🗑️ Cleaned up source file: {source_path}")
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


@router.get("/recent")
async def get_recent_detections(
    limit: int = 10,
    offset: int = 0,
    status: DetectionStatus = None,
    search: str = None,
    machine_id: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    grid_cell: Optional[str] = Query(
        None, description="Filter by grid cell (e.g., A15, C22)"
    ),
    format: str = Query("json", description="Response format: json or xlsx"),
    db: AsyncSession = Depends(get_session),
):
    """
    ENHANCED: Recent detections with grid data and grid cell filtering
    """
    try:
        logger.info(
            f"Recent detections request: limit={limit}, offset={offset}, grid_cell={grid_cell}"
        )

        # Build base query
        stmt = select(DetectionRecord).order_by(DetectionRecord.created_at.desc())

        # Apply machine filtering - NEVER use global settings.machine_id
        if machine_id == "all":
            logger.info("🔍 Showing all machines")
            # No filtering - show all machines
        elif machine_id:
            stmt = stmt.where(DetectionRecord.machine_id == machine_id)
            logger.info(f"🔍 Filtering by machine: {machine_id}")
        else:
            # If no machine specified, return empty result or error
            logger.warning("⚠️ No machine_id specified and no default behavior")
            # Option 1: Return empty results
            stmt = stmt.where(DetectionRecord.machine_id == "NO_MACHINE")
            # Option 2: Or you could show all machines by default
            # No additional filtering needed

        # Apply status filter
        if status:
            stmt = stmt.where(DetectionRecord.status == status)

        # Apply search filter
        if search:
            stmt = stmt.where(DetectionRecord.original_filename.ilike(f"%{search}%"))

        # Apply date filtering using the fixed parse_date_filter function
        if date_from:
            from_datetime = parse_date_filter(date_from)
            if from_datetime:
                stmt = stmt.where(DetectionRecord.created_at >= from_datetime)
                logger.info(f"Applied date_from filter: {from_datetime}")

        if date_to:
            to_datetime = parse_date_filter(date_to)
            if to_datetime:
                stmt = stmt.where(DetectionRecord.created_at <= to_datetime)
                logger.info(f"Applied date_to filter: {to_datetime}")

        # NEW: Grid cell filtering - Apply to main query
        if grid_cell:
            grid_cell_clean = grid_cell.strip().upper()
            grid_filter_json = f'[{{"grid_cell": "{grid_cell_clean}"}}]'
            stmt = stmt.where(
                text(
                    "CAST(detection_details->'defects' AS jsonb) @> CAST(:grid_cell_filter AS jsonb)"
                )
            ).params(grid_cell_filter=grid_filter_json)

        # Execute query for Excel export or regular pagination
        if format.lower() == "xlsx":
            export_stmt = stmt.limit(10000)  # Limit for export
            result = await db.execute(export_stmt)
            records = result.scalars().all()
        else:
            stmt = stmt.offset(offset).limit(limit)
            result = await db.execute(stmt)
            records = result.scalars().all()

        logger.info(f"Found {len(records)} records matching filters")

        # ENHANCED: XLSX Export with Grid Data
        if format.lower() == "xlsx":
            logger.info(f"📊 Generating XLSX export for {len(records)} records")

            export_data = []
            for record in records:
                # Real defect analysis with grid data
                defect_summary = "No defects found"
                grid_summary = "No grid data"
                affected_cells = "None"

                if record.detection_details and record.detection_details.get("defects"):
                    defects = record.detection_details["defects"]

                    # Group by defect type and grid cells
                    defect_types = {}
                    grid_cells = set()

                    for defect in defects:
                        defect_type = defect.get("class_name", "Unknown")
                        confidence = defect.get("confidence", 0)
                        grid_cell_val = defect.get("grid_cell", "")

                        if defect_type in defect_types:
                            defect_types[defect_type].append(confidence)
                        else:
                            defect_types[defect_type] = [confidence]

                        if grid_cell_val:
                            grid_cells.add(grid_cell_val)

                    # Format defect summary
                    defect_parts = []
                    for defect_type, confidences in defect_types.items():
                        avg_conf = sum(confidences) / len(confidences)
                        count = len(confidences)
                        defect_parts.append(
                            f"{defect_type} ({count}x, avg {avg_conf:.1%})"
                        )

                    defect_summary = "; ".join(defect_parts)
                    affected_cells = (
                        ", ".join(sorted(grid_cells)) if grid_cells else "None"
                    )

                # Grid statistics
                grid_stats = record.grid_statistics or {}
                cells_with_defects = grid_stats.get("cells_with_defects", 0)

                if cells_with_defects > 0:
                    grid_summary = f"{cells_with_defects} cells affected"

                # UTC to IST conversion
                processed_at_ist = "Not completed"
                if record.completed_at:
                    ist_time = record.completed_at + timedelta(hours=5, minutes=30)
                    processed_at_ist = ist_time.strftime("%Y-%m-%d %H:%M:%S IST")

                created_at_ist = record.created_at + timedelta(hours=5, minutes=30)

                export_data.append(
                    {
                        "Original Filename": record.original_filename,
                        "Machine Name": record.machine_name,
                        "Total Defects": record.total_defects,
                        "Affected Grid Cells": affected_cells,
                        "Grid Analysis": grid_summary,
                        "Defect Details": defect_summary,
                        "Confidence Threshold": f"{record.confidence_threshold:.1%}",
                        "Processing Time (ms)": record.processing_time_ms,
                        "Status": record.status.value.upper(),
                        "Created At (IST)": created_at_ist.strftime(
                            "%Y-%m-%d %H:%M:%S IST"
                        ),
                        "Processed At (IST)": processed_at_ist,
                        "Folder Path": record.el_folder_path,
                        "Machine ID": record.machine_id,
                        "Detection ID": str(record.id),
                        "Source Path": record.source_path_at_creation or "Not recorded",
                        "Watch Path": record.watch_path_at_creation or "Not recorded",
                        "Processed Path": record.processed_path_at_creation
                        or "Not recorded",
                    }
                )

            # Create Excel file
            df = pd.DataFrame(export_data)

            # Generate filename
            filename = f"saatvik_detections_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            if machine_id and machine_id != "all":
                filename += f"_{machine_id.replace(' ', '_')}"
            if grid_cell:
                filename += f"_cell_{grid_cell.replace(' ', '_')}"
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

            return StreamingResponse(
                BytesIO(buffer.read()),
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers={"Content-Disposition": f"attachment; filename={filename}"},
            )

        # Regular JSON Response - Build count query with same filters
        count_stmt = select(func.count(DetectionRecord.id))

        # Apply same filters to count
        if machine_id is None:
            logger.warning("⚠️ No machine_id specified in detection request")
            stmt = stmt.where(
                DetectionRecord.machine_id == "NO_MACHINE"
            )  # Return empty

        elif machine_id != "all":
            count_stmt = count_stmt.where(DetectionRecord.machine_id == machine_id)

        if status:
            count_stmt = count_stmt.where(DetectionRecord.status == status)
        if search:
            count_stmt = count_stmt.where(
                DetectionRecord.original_filename.ilike(f"%{search}%")
            )

        # Apply date filters to count
        if date_from:
            from_datetime = parse_date_filter(date_from)
            if from_datetime:
                count_stmt = count_stmt.where(
                    DetectionRecord.created_at >= from_datetime
                )

        if date_to:
            to_datetime = parse_date_filter(date_to)
            if to_datetime:
                count_stmt = count_stmt.where(DetectionRecord.created_at <= to_datetime)

        # Apply grid cell filter to count (MOVED HERE after count_stmt is defined)
        if grid_cell:
            grid_cell_clean = grid_cell.strip().upper()
            grid_filter_json = f'[{{"grid_cell": "{grid_cell_clean}"}}]'
            count_stmt = count_stmt.where(
                text(
                    "CAST(detection_details->'defects' AS jsonb) @> CAST(:grid_cell_filter AS jsonb)"
                )
            ).params(grid_cell_filter=grid_filter_json)

        count_result = await db.execute(count_stmt)
        total = count_result.scalar()

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "machine_filter": machine_id or settings.machine_id,
            "grid_cell_filter": grid_cell,
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
                    "grid_report_path": record.grid_report_path,
                    "el_folder_path": record.el_folder_path,
                    "error_message": record.error_message,
                    # Grid information summary
                    "affected_cells": (
                        list(record.grid_statistics.get("defects_per_cell", {}).keys())
                        if record.grid_statistics
                        else []
                    ),
                    "cells_with_defects": (
                        record.grid_statistics.get("cells_with_defects", 0)
                        if record.grid_statistics
                        else 0
                    ),
                    "grid_summary": (
                        f"{record.grid_statistics.get('cells_with_defects', 0)} cells affected"
                        if record.grid_statistics
                        else "No grid data"
                    ),
                    # Historical paths
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


@router.get("/status/{detection_id}")
async def get_detection_status(
    detection_id: str, db: AsyncSession = Depends(get_session)
):
    """Get detailed status + historical paths for specific detection"""
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


@router.get("/machines")
async def get_available_machines():
    """Get machines + CURRENT operational paths (for live operations)"""
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
