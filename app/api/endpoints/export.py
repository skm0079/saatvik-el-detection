# File: app/api/endpoints/export.py

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlmodel import select
from datetime import datetime, timedelta
from typing import Optional
from io import BytesIO
import pandas as pd
from app.core.config import Settings
from app.core.database import get_session
from app.models.detection_record import DetectionRecord
from app.services.pdf_service import PDFService
from app.services.excel_service import ExcelService
from loguru import logger

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/pdf/{detection_id}")
async def export_detection_pdf(
    detection_id: str, db: AsyncSession = Depends(get_session)
):
    """Export single detection as PDF"""
    try:
        record = await db.get(DetectionRecord, detection_id)
        if not record:
            raise HTTPException(404, "Detection not found")

        pdf_buffer = PDFService.generate_detection_report(record)

        # Clean filename from original filename
        safe_filename = record.original_filename.replace(" ", "_").replace("/", "_")
        filename = f"detection_{safe_filename}_{detection_id[:8]}.pdf"

        return StreamingResponse(
            BytesIO(pdf_buffer.read()),
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"PDF export failed for {detection_id}: {e}")
        raise HTTPException(500, f"PDF export failed: {str(e)}")


@router.get("/excel/bulk")
async def export_bulk_excel(
    date_from: Optional[str] = Query(None, description="UTC date from"),
    date_to: Optional[str] = Query(None, description="UTC date to"),
    machine_id: Optional[str] = Query(None, description="Machine filter"),
    limit: int = Query(1000, description="Max records to export"),
    db: AsyncSession = Depends(get_session),
):
    """Export multiple detections as Excel with date filtering"""
    try:
        settings = Settings()
        # Build query
        stmt = (
            select(DetectionRecord)
            .where(DetectionRecord.status.in_(["completed", "saved", "results_saved"]))
            .order_by(DetectionRecord.created_at.desc())
            .limit(limit)
        )

        # Apply machine filter
        if machine_id and machine_id != "all":
            stmt = stmt.where(DetectionRecord.machine_id == machine_id)
        elif machine_id is None:
            # Default to current machine if no machine_id specified
            stmt = stmt.where(DetectionRecord.machine_id == settings.machine_id)

        # Apply date filters
        if date_from:
            try:
                from_dt = datetime.fromisoformat(date_from.replace("Z", "+00:00"))
                stmt = stmt.where(DetectionRecord.created_at >= from_dt)
                logger.info(f"Applied date_from filter: {from_dt}")
            except ValueError:
                logger.warning(f"Invalid date_from: {date_from}")
                raise HTTPException(400, f"Invalid date_from format: {date_from}")

        if date_to:
            try:
                to_dt = datetime.fromisoformat(date_to.replace("Z", "+00:00"))
                stmt = stmt.where(DetectionRecord.created_at <= to_dt)
                logger.info(f"Applied date_to filter: {to_dt}")
            except ValueError:
                logger.warning(f"Invalid date_to: {date_to}")
                raise HTTPException(400, f"Invalid date_to format: {date_to}")

        # Execute query
        result = await db.execute(stmt)
        records = result.scalars().all()

        if not records:
            raise HTTPException(404, "No detections found with given filters")

        logger.info(f"📊 Generating bulk Excel export for {len(records)} records")

        # Create Excel export data (similar to your /recent endpoint logic)
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
                    defect_parts.append(f"{defect_type} ({count}x, avg {avg_conf:.1%})")

                defect_summary = "; ".join(defect_parts)
                affected_cells = ", ".join(sorted(grid_cells)) if grid_cells else "None"

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

        # Create Excel file using pandas (replace ExcelService call)
        df = pd.DataFrame(export_data)

        # Generate filename
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

        return StreamingResponse(
            BytesIO(buffer.read()),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bulk Excel export failed: {e}")
        raise HTTPException(500, f"Excel export failed: {str(e)}")


@router.get("/excel/{detection_id}")
async def export_detection_excel(
    detection_id: str, db: AsyncSession = Depends(get_session)
):
    """Export single detection as Excel"""
    try:
        record = await db.get(DetectionRecord, detection_id)
        if not record:
            raise HTTPException(404, "Detection not found")

        excel_buffer = ExcelService.export_single_detection(record)

        # Clean filename
        safe_filename = record.original_filename.replace(" ", "_").replace("/", "_")
        filename = f"detection_{safe_filename}_{detection_id[:8]}.xlsx"

        return StreamingResponse(
            BytesIO(excel_buffer.read()),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Excel export failed for {detection_id}: {e}")
        raise HTTPException(500, f"Excel export failed: {str(e)}")
