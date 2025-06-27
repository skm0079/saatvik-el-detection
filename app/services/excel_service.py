# File: app/services/excel_service.py

import pandas as pd
from io import BytesIO
from datetime import datetime, timedelta
from typing import List, Optional
from loguru import logger
from app.models.detection_record import DetectionRecord


class ExcelService:
    """Excel export service for detection data"""

    @staticmethod
    def utc_to_ist(utc_dt: datetime) -> str:
        """Convert UTC datetime to IST string"""
        ist_dt = utc_dt + timedelta(hours=5, minutes=30)
        return ist_dt.strftime("%Y-%m-%d %H:%M:%S IST")

    @staticmethod
    def export_single_detection(record: DetectionRecord) -> BytesIO:
        """Export single detection to Excel"""
        try:
            # Prepare data for single detection
            data = {
                "Original Filename": record.original_filename,
                "Machine Name": record.machine_name,
                "Machine ID": record.machine_id,
                "Total Defects": record.total_defects,
                "Processing Time (ms)": record.processing_time_ms,
                "Confidence Threshold": f"{record.confidence_threshold:.1%}",
                "Status": record.status.value.upper(),
                "Created At (IST)": ExcelService.utc_to_ist(record.created_at),
                "Folder Path": record.el_folder_path,
            }

            # Add grid data if available
            if record.grid_statistics:
                grid_stats = record.grid_statistics
                affected_cells = list(grid_stats.get("defects_per_cell", {}).keys())
                data["Affected Cells"] = (
                    ", ".join(affected_cells) if affected_cells else "None"
                )
                data["Cells with Defects"] = grid_stats.get("cells_with_defects", 0)

            # Add paths if available
            if record.source_path_at_creation:
                data["Source Path"] = record.source_path_at_creation
                data["Watch Path"] = record.watch_path_at_creation or "Not recorded"
                data["Processed Path"] = (
                    record.processed_path_at_creation or "Not recorded"
                )

            # Create DataFrame
            df = pd.DataFrame([data])

            # Create Excel buffer
            buffer = BytesIO()
            with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
                df.to_excel(writer, index=False, sheet_name="Detection")

                # Add defect details if available
                if record.detection_details and record.detection_details.get("defects"):
                    defect_data = []
                    for i, defect in enumerate(record.detection_details["defects"], 1):
                        center = defect.get("center_coordinates", {})
                        defect_data.append(
                            {
                                "Defect #": i,
                                "Grid Cell": defect.get("grid_cell", "Unknown"),
                                "Type": defect.get("class_name", "Unknown"),
                                "Confidence": f"{defect.get('confidence', 0):.3f}",
                                "Center X": int(center.get("x", 0)),
                                "Center Y": int(center.get("y", 0)),
                            }
                        )

                    defect_df = pd.DataFrame(defect_data)
                    defect_df.to_excel(writer, index=False, sheet_name="Defects")

            buffer.seek(0)
            logger.info(
                f"Single detection Excel generated for {record.original_filename}"
            )
            return buffer

        except Exception as e:
            logger.error(f"Single detection Excel export failed: {e}")
            raise

    @staticmethod
    def export_multiple_detections(
        records: List[DetectionRecord], filename_prefix: str = "detections"
    ) -> BytesIO:
        """Export multiple detections to Excel"""
        try:
            export_data = []

            for record in records:
                # Basic info
                row = {
                    "Original Filename": record.original_filename,
                    "Machine Name": record.machine_name,
                    "Total Defects": record.total_defects,
                    "Processing Time (ms)": record.processing_time_ms,
                    "Confidence": f"{record.confidence_threshold:.1%}",
                    "Status": record.status.value.upper(),
                    "Created At (IST)": ExcelService.utc_to_ist(record.created_at),
                }

                # Grid data
                if record.grid_statistics:
                    grid_stats = record.grid_statistics
                    affected_cells = list(grid_stats.get("defects_per_cell", {}).keys())
                    row["Affected Cells"] = (
                        ", ".join(affected_cells) if affected_cells else "None"
                    )
                    row["Cells with Defects"] = grid_stats.get("cells_with_defects", 0)
                else:
                    row["Affected Cells"] = "No grid data"
                    row["Cells with Defects"] = 0

                # Defect summary
                defect_summary = "No defects"
                if record.detection_details and record.detection_details.get("defects"):
                    defect_types = {}
                    for defect in record.detection_details["defects"]:
                        defect_type = defect.get("class_name", "Unknown")
                        defect_types[defect_type] = defect_types.get(defect_type, 0) + 1

                    parts = [
                        f"{dtype}({count})" for dtype, count in defect_types.items()
                    ]
                    defect_summary = ", ".join(parts)

                row["Defect Summary"] = defect_summary
                row["Folder Path"] = record.el_folder_path

                export_data.append(row)

            # Create DataFrame
            df = pd.DataFrame(export_data)

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
            logger.info(f"Multiple detections Excel generated: {len(records)} records")
            return buffer

        except Exception as e:
            logger.error(f"Multiple detections Excel export failed: {e}")
            raise

    @staticmethod
    def export_with_date_filter(
        records: List[DetectionRecord],
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        machine_id: Optional[str] = None,
    ) -> BytesIO:
        """Export with date filtering info in filename and metadata"""
        try:
            # Use the multiple export method
            buffer = ExcelService.export_multiple_detections(
                records, "filtered_detections"
            )

            logger.info(f"Date-filtered Excel generated: {len(records)} records")
            return buffer

        except Exception as e:
            logger.error(f"Date-filtered Excel export failed: {e}")
            raise
