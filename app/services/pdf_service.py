# File: app/services/pdf_service.py

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image,
)
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.colors import black, gray
from reportlab.lib.units import inch
from io import BytesIO
from datetime import datetime, timedelta
from pathlib import Path
from loguru import logger
from app.models.detection_record import DetectionRecord


class PDFService:
    """PDF generation service for detection reports"""

    @staticmethod
    def utc_to_ist(utc_dt: datetime) -> str:
        """Convert UTC datetime to IST string"""
        ist_dt = utc_dt + timedelta(hours=5, minutes=30)
        return ist_dt.strftime("%Y-%m-%d %H:%M:%S IST")

    @staticmethod
    def generate_detection_report(record: DetectionRecord) -> BytesIO:
        """Generate PDF report for detection with real data only"""
        try:
            buffer = BytesIO()
            doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.5 * inch)
            story = []
            styles = getSampleStyleSheet()

            # Header
            story.append(Paragraph("Saatvik EL Detection Report", styles["Title"]))
            story.append(Spacer(1, 0.2 * inch))

            # Detection Information
            detection_data = [
                ["Original Filename", record.original_filename],
                ["Machine Name", record.machine_name],
                ["Processed At (IST)", PDFService.utc_to_ist(record.created_at)],
                ["Total Defects", str(record.total_defects)],
                ["Processing Time", f"{record.processing_time_ms} ms"],
                ["Confidence", f"{record.confidence_threshold:.1%}"],
            ]

            detection_table = Table(detection_data, colWidths=[2 * inch, 4 * inch])
            detection_table.setStyle(
                TableStyle(
                    [
                        ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                        ("FONTSIZE", (0, 0), (-1, -1), 10),
                        ("GRID", (0, 0), (-1, -1), 1, black),
                    ]
                )
            )

            story.append(detection_table)
            story.append(Spacer(1, 0.3 * inch))

            # Grid Analysis
            if record.grid_statistics:
                story.append(Paragraph("Grid Analysis", styles["Heading2"]))

                grid_stats = record.grid_statistics
                cells_affected = grid_stats.get("cells_with_defects", 0)

                if cells_affected > 0:
                    story.append(
                        Paragraph(
                            f"Cells with defects: {cells_affected}", styles["Normal"]
                        )
                    )

                    # Most affected cells
                    most_affected = grid_stats.get("most_affected_cells", [])
                    if most_affected:
                        cell_data = [["Grid Cell", "Defect Count"]]
                        for cell, count in most_affected[:10]:
                            cell_data.append([cell, str(count)])

                        cell_table = Table(
                            cell_data, colWidths=[1.5 * inch, 1.5 * inch]
                        )
                        cell_table.setStyle(
                            TableStyle(
                                [
                                    ("BACKGROUND", (0, 0), (-1, 0), gray),
                                    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                                    ("GRID", (0, 0), (-1, -1), 1, black),
                                ]
                            )
                        )

                        story.append(cell_table)

                story.append(Spacer(1, 0.3 * inch))

            # Defect Details
            if record.detection_details and record.detection_details.get("defects"):
                story.append(Paragraph("Defect Details", styles["Heading2"]))

                defect_data = [["Grid Cell", "Type", "Confidence", "X", "Y"]]

                for defect in record.detection_details["defects"]:
                    center = defect.get("center_coordinates", {})
                    defect_data.append(
                        [
                            defect.get("grid_cell", "Unknown"),
                            defect.get("class_name", "Unknown"),
                            f"{defect.get('confidence', 0):.3f}",
                            str(int(center.get("x", 0))),
                            str(int(center.get("y", 0))),
                        ]
                    )

                defect_table = Table(defect_data)
                defect_table.setStyle(
                    TableStyle(
                        [
                            ("BACKGROUND", (0, 0), (-1, 0), gray),
                            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                            ("FONTSIZE", (0, 0), (-1, -1), 8),
                            ("GRID", (0, 0), (-1, -1), 1, black),
                        ]
                    )
                )

                story.append(defect_table)

            # Footer
            story.append(Spacer(1, 0.5 * inch))
            footer = f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S IST')}"
            story.append(Paragraph(footer, styles["Normal"]))

            doc.build(story)
            buffer.seek(0)

            logger.info(f"PDF generated for {record.original_filename}")
            return buffer

        except Exception as e:
            logger.error(f"PDF generation failed: {e}")
            raise
