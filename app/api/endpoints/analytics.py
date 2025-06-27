# File: backend/app/api/endpoints/analytics.py

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from datetime import datetime, timezone, timedelta
from typing import Optional
from app.core.database import get_session
from app.models.detection_record import DetectionRecord
from app.core.config import settings
from loguru import logger

router = APIRouter(prefix="/analytics", tags=["analytics"])


def parse_date_filter(date_string: str) -> datetime:
    """
    FIXED: Robust date parsing for various input formats
    Handles ISO format, datetime-local format, and date-only format
    """
    if not date_string:
        return None

    try:
        # Handle ISO format with Z suffix (2025-01-15T10:30:00Z)
        if date_string.endswith("Z"):
            return datetime.fromisoformat(date_string.replace("Z", "+00:00"))

        # Handle ISO format with timezone info (2025-01-15T10:30:00+00:00)
        elif "+" in date_string[-6:] or date_string.endswith("00:00"):
            return datetime.fromisoformat(date_string)

        # Handle datetime-local format (2025-01-15T10:30)
        elif "T" in date_string and len(date_string) == 16:
            dt = datetime.fromisoformat(date_string)
            return dt.replace(tzinfo=timezone.utc)

        # Handle extended datetime-local format (2025-01-15T10:30:00)
        elif "T" in date_string and len(date_string) == 19:
            dt = datetime.fromisoformat(date_string)
            return dt.replace(tzinfo=timezone.utc)

        # Handle date-only format (2025-01-15)
        elif "-" in date_string and "T" not in date_string:
            dt = datetime.fromisoformat(f"{date_string}T00:00:00")
            return dt.replace(tzinfo=timezone.utc)

        # Handle other ISO formats
        else:
            dt = datetime.fromisoformat(date_string)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt

    except ValueError as e:
        logger.error(f"Invalid date format: {date_string}, error: {e}")
        raise HTTPException(
            400,
            f"Invalid date format: {date_string}. Expected formats: YYYY-MM-DD, YYYY-MM-DDTHH:mm, or ISO format",
        )


def utc_to_ist(utc_dt: datetime) -> str:
    """Convert UTC datetime to IST string"""
    ist_dt = utc_dt + timedelta(hours=5, minutes=30)
    return ist_dt.strftime("%Y-%m-%d %H:%M:%S")


@router.get("/dashboard")
async def get_dashboard_analytics(
    date_from: Optional[str] = Query(
        None, description="UTC date from (YYYY-MM-DD or ISO format)"
    ),
    date_to: Optional[str] = Query(
        None, description="UTC date to (YYYY-MM-DD or ISO format)"
    ),
    machine_id: Optional[str] = Query(
        None, description="Machine filter ('all' for all machines, null for current)"
    ),
    db: AsyncSession = Depends(get_session),
):
    """
    Dashboard analytics with real data only from YOLO detections
    Returns comprehensive analytics for dashboard display with proper date filtering
    """
    try:
        logger.info(
            f"Dashboard analytics request: date_from={date_from}, date_to={date_to}, machine_id={machine_id}"
        )

        # Build base query - only include completed detections
        stmt = select(DetectionRecord).where(
            DetectionRecord.status.in_(["completed", "saved", "results_saved"])
        )

        # Apply machine filter
        if machine_id and machine_id != "all":
            stmt = stmt.where(DetectionRecord.machine_id == machine_id)
            logger.info(f"Filtering by specific machine_id: {machine_id}")
        elif machine_id is None:
            # Default to current machine
            stmt = stmt.where(DetectionRecord.machine_id == settings.machine_id)
            logger.info(f"Using default machine_id: {settings.machine_id}")
        else:
            logger.info("Showing all machines")

        # Apply date filters with improved parsing
        if date_from:
            from_dt = parse_date_filter(date_from)
            if from_dt:
                stmt = stmt.where(DetectionRecord.created_at >= from_dt)
                logger.info(f"Applied date_from filter: {from_dt}")

        if date_to:
            to_dt = parse_date_filter(date_to)
            if to_dt:
                stmt = stmt.where(DetectionRecord.created_at <= to_dt)
                logger.info(f"Applied date_to filter: {to_dt}")

        # Execute query
        result = await db.execute(stmt)
        records = result.scalars().all()

        logger.info(f"Found {len(records)} records for dashboard analytics")

        # Calculate real metrics from actual data
        total_images = len(records)
        total_defects = sum(record.total_defects for record in records)
        total_processing_time = sum(record.processing_time_ms for record in records)

        # Today's data (UTC midnight to now) - will be converted to IST in frontend
        today_utc = datetime.now(timezone.utc).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        today_records = [r for r in records if r.created_at >= today_utc]

        images_today = len(today_records)
        defects_today = sum(record.total_defects for record in today_records)

        # Grid analytics from actual detection data
        all_affected_cells = {}
        defect_types = {}

        for record in records:
            # Process grid statistics
            if record.grid_statistics:
                defects_per_cell = record.grid_statistics.get("defects_per_cell", {})
                for cell, count in defects_per_cell.items():
                    all_affected_cells[cell] = all_affected_cells.get(cell, 0) + count

            # Count defect types from detection_details
            if record.detection_details and record.detection_details.get("defects"):
                for defect in record.detection_details["defects"]:
                    defect_type = defect.get("class_name", "unknown")
                    defect_types[defect_type] = defect_types.get(defect_type, 0) + 1

        # Most affected cells today
        today_cells = {}
        for record in today_records:
            if record.grid_statistics:
                defects_per_cell = record.grid_statistics.get("defects_per_cell", {})
                for cell, count in defects_per_cell.items():
                    today_cells[cell] = today_cells.get(cell, 0) + count

        most_affected_today = sorted(
            today_cells.items(), key=lambda x: x[1], reverse=True
        )[:5]

        # Machine breakdown (real data)
        machine_stats = {}
        for record in records:
            machine = record.machine_name
            if machine not in machine_stats:
                machine_stats[machine] = {"images": 0, "defects": 0}
            machine_stats[machine]["images"] += 1
            machine_stats[machine]["defects"] += record.total_defects

        # Prepare response data
        response_data = {
            "totals": {
                "images_processed": total_images,
                "total_defects_found": total_defects,
                "avg_defects_per_image": (
                    round(total_defects / total_images, 2) if total_images > 0 else 0
                ),
                "avg_processing_time_ms": (
                    round(total_processing_time / total_images)
                    if total_images > 0
                    else 0
                ),
            },
            "today": {
                "images_today": images_today,
                "defects_today": defects_today,
                "avg_defects_today": (
                    round(defects_today / images_today, 2) if images_today > 0 else 0
                ),
                "most_affected_cells_today": most_affected_today,
            },
            "grid_insights": {
                "total_unique_cells_affected": len(all_affected_cells),
                "most_affected_cells_overall": sorted(
                    all_affected_cells.items(), key=lambda x: x[1], reverse=True
                )[:10],
                "grid_config": {
                    "rows": 6,
                    "cols": 24,
                    "total_cells": 144,
                },
            },
            "defect_breakdown": {"by_type": defect_types, "by_machine": machine_stats},
            "date_range": {
                "from": date_from,
                "to": date_to,
                "timezone": "Filters in UTC, display in IST",
                "records_found": total_images,
                "query_time": datetime.now(timezone.utc).isoformat(),
            },
        }

        logger.info(
            f"Dashboard analytics response: {total_images} images, {total_defects} defects, {len(all_affected_cells)} unique cells affected"
        )
        return response_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Dashboard analytics failed: {e}")
        raise HTTPException(500, f"Analytics error: {str(e)}")


@router.get("/image/{detection_id}")
async def get_image_analysis(
    detection_id: str, db: AsyncSession = Depends(get_session)
):
    """
    Individual image analysis with real YOLO data only
    Returns detailed defect analysis for a specific detection
    """
    try:
        # Get detection record
        record = await db.get(DetectionRecord, detection_id)
        if not record:
            raise HTTPException(404, f"Detection with ID {detection_id} not found")

        logger.info(f"Retrieving image analysis for detection: {detection_id}")

        # Extract real defect data from detection_details
        defects_by_cell = {}
        defect_coordinates = []

        if record.detection_details and record.detection_details.get("defects"):
            for defect in record.detection_details["defects"]:
                cell = defect.get("grid_cell", "Unknown")
                defect_info = {
                    "type": defect.get("class_name", "unknown"),
                    "confidence": round(defect.get("confidence", 0), 3),
                    "coordinates": defect.get("center_coordinates", {}),
                    "bbox": defect.get("bbox", {}),
                }

                # Group defects by cell
                if cell not in defects_by_cell:
                    defects_by_cell[cell] = []
                defects_by_cell[cell].append(defect_info)

                # Add to coordinates list
                defect_coordinates.append(
                    {
                        "grid_cell": cell,
                        "center_x": defect.get("center_coordinates", {}).get("x", 0),
                        "center_y": defect.get("center_coordinates", {}).get("y", 0),
                        "defect_type": defect.get("class_name", "unknown"),
                        "confidence": defect.get("confidence", 0),
                    }
                )

        # Image dimensions from detection
        image_dims = {}
        if record.detection_details and record.detection_details.get(
            "image_dimensions"
        ):
            image_dims = record.detection_details["image_dimensions"]

        response_data = {
            "image_info": {
                "detection_id": str(record.id),
                "original_filename": record.original_filename,
                "processed_at_ist": utc_to_ist(record.created_at),
                "machine_name": record.machine_name,
                "machine_id": record.machine_id,
                "processing_time_ms": record.processing_time_ms,
                "confidence_threshold": record.confidence_threshold,
                "file_size_bytes": record.file_size_bytes,
                "status": record.status.value,
            },
            "defect_analysis": {
                "total_defects": record.total_defects,
                "defects_by_cell": defects_by_cell,
                "affected_cells": list(defects_by_cell.keys()),
                "defect_coordinates": defect_coordinates,
            },
            "grid_data": {
                "grid_config": record.grid_config or {"rows": 6, "cols": 24},
                "grid_statistics": record.grid_statistics or {},
                "image_dimensions": image_dims,
            },
            "file_paths": {
                "annotated_image": record.annotated_image_path,
                "thumbnail": record.thumbnail_path,
                "grid_report": record.grid_report_path,
                "json_results": record.json_results_path,
            },
            "historical_context": (
                {
                    "source_path": record.source_path_at_creation,
                    "watch_path": record.watch_path_at_creation,
                    "processed_path": record.processed_path_at_creation,
                }
                if record.source_path_at_creation
                else None
            ),
        }

        logger.info(
            f"Image analysis completed for {detection_id}: {record.total_defects} defects, {len(defects_by_cell)} cells affected"
        )
        return response_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Image analysis failed for {detection_id}: {e}")
        raise HTTPException(500, f"Analysis error: {str(e)}")


@router.get("/grid-summary")
async def get_grid_summary(
    date_from: Optional[str] = Query(None, description="UTC date from"),
    date_to: Optional[str] = Query(None, description="UTC date to"),
    machine_id: Optional[str] = Query(None, description="Machine filter"),
    db: AsyncSession = Depends(get_session),
):
    """
    Grid-focused analytics from real detection data
    Returns comprehensive grid analysis with cell-level statistics
    """
    try:
        logger.info(
            f"Grid summary request: date_from={date_from}, date_to={date_to}, machine_id={machine_id}"
        )

        # Build query (same filtering logic as dashboard)
        stmt = select(DetectionRecord).where(
            DetectionRecord.status.in_(["completed", "saved", "results_saved"])
        )

        # Apply filters
        if machine_id and machine_id != "all":
            stmt = stmt.where(DetectionRecord.machine_id == machine_id)
        elif machine_id is None:
            stmt = stmt.where(DetectionRecord.machine_id == settings.machine_id)

        if date_from:
            from_dt = parse_date_filter(date_from)
            if from_dt:
                stmt = stmt.where(DetectionRecord.created_at >= from_dt)

        if date_to:
            to_dt = parse_date_filter(date_to)
            if to_dt:
                stmt = stmt.where(DetectionRecord.created_at <= to_dt)

        result = await db.execute(stmt)
        records = result.scalars().all()

        logger.info(f"Analyzing grid data from {len(records)} records")

        # Analyze grid data from actual detections
        cell_analysis = {}
        defect_type_by_cell = {}

        for record in records:
            if record.detection_details and record.detection_details.get("defects"):
                for defect in record.detection_details["defects"]:
                    cell = defect.get("grid_cell")
                    if not cell:
                        continue

                    defect_type = defect.get("class_name", "unknown")
                    confidence = defect.get("confidence", 0)

                    # Initialize cell analysis
                    if cell not in cell_analysis:
                        cell_analysis[cell] = {
                            "total_defects": 0,
                            "detection_count": 0,
                            "avg_confidence": 0,
                            "defect_types": set(),
                            "images_affected": set(),
                        }

                    cell_analysis[cell]["total_defects"] += 1
                    cell_analysis[cell]["defect_types"].add(defect_type)
                    cell_analysis[cell]["images_affected"].add(str(record.id))

                    # Track confidence for averaging
                    if cell not in defect_type_by_cell:
                        defect_type_by_cell[cell] = []
                    defect_type_by_cell[cell].append(
                        {
                            "type": defect_type,
                            "confidence": confidence,
                            "detection_id": str(record.id),
                        }
                    )

        # Calculate averages and finalize data
        for cell in cell_analysis:
            confidences = [d["confidence"] for d in defect_type_by_cell.get(cell, [])]
            cell_analysis[cell]["avg_confidence"] = (
                round(sum(confidences) / len(confidences), 3) if confidences else 0
            )
            cell_analysis[cell]["defect_types"] = list(
                cell_analysis[cell]["defect_types"]
            )
            cell_analysis[cell]["images_affected"] = len(
                cell_analysis[cell]["images_affected"]
            )

        # Sort cells by defect count
        sorted_cells = sorted(
            cell_analysis.items(), key=lambda x: x[1]["total_defects"], reverse=True
        )

        response_data = {
            "summary": {
                "total_images_analyzed": len(records),
                "total_cells_with_defects": len(cell_analysis),
                "total_defects_found": sum(record.total_defects for record in records),
                "grid_configuration": {
                    "rows": 6,
                    "cols": 24,
                    "total_possible_cells": 144,
                    "coverage_percentage": round((len(cell_analysis) / 144) * 100, 2),
                },
            },
            "cell_analysis": {
                "most_problematic_cells": sorted_cells[:20],  # Top 20 worst cells
                "cells_by_defect_count": dict(sorted_cells),
                "unique_cells_affected": len(cell_analysis),
            },
            "defect_patterns": {
                "cells_with_multiple_defects": {
                    cell: data
                    for cell, data in cell_analysis.items()
                    if data["total_defects"] > 1
                },
                "cells_by_defect_type": defect_type_by_cell,
                "high_confidence_cells": {
                    cell: data
                    for cell, data in cell_analysis.items()
                    if data["avg_confidence"] > 0.8
                },
            },
            "date_range": {
                "from": date_from,
                "to": date_to,
                "records_analyzed": len(records),
            },
        }

        logger.info(
            f"Grid summary completed: {len(cell_analysis)} cells with defects analyzed"
        )
        return response_data

    except Exception as e:
        logger.error(f"Grid summary failed: {e}")
        raise HTTPException(500, f"Grid analysis error: {str(e)}")
