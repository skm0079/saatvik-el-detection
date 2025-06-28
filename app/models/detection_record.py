# File: app/models/detection_record.py

from sqlmodel import SQLModel, Field, Column, JSON
from sqlalchemy import DateTime, Enum as SQLEnum
from uuid import UUID, uuid4
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from enum import Enum


class DetectionStatus(str, Enum):
    """Detection processing status enum"""

    RECEIVED = "received"
    PROCESSING = "processing"
    AI_COMPLETE = "ai_complete"
    RESULTS_SAVED = "results_saved"
    CLIENT_NOTIFIED = "client_notified"
    COMPLETED = "completed"
    FAILED = "failed"
    SAVED = "saved"


class DetectionRecordBase(SQLModel):
    # Source info
    original_filename: str
    el_folder_path: str
    source_file_path: str

    # Machine context
    machine_id: str = Field(index=True)
    machine_name: str

    # Historical path storage
    source_path_at_creation: Optional[str] = Field(default=None)
    watch_path_at_creation: Optional[str] = Field(default=None)
    processed_path_at_creation: Optional[str] = Field(default=None)

    # Processing results
    total_defects: int = 0
    confidence_threshold: float
    processing_time_ms: int

    # Result file paths
    annotated_image_path: Optional[str] = None
    json_results_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    grid_report_path: Optional[str] = None  # NEW: Grid analysis report

    # File metadata
    file_size_bytes: int


class DetectionRecord(DetectionRecordBase, table=True):
    __tablename__ = "detection_records"

    id: UUID = Field(default_factory=uuid4, primary_key=True)

    # Detailed detection results (includes grid cell info per defect)
    detection_details: Optional[Dict[str, Any]] = Field(
        default=None, sa_column=Column(JSON)
    )

    # NEW: Grid configuration used for this detection
    grid_config: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))

    # NEW: Grid statistics calculated from detections
    grid_statistics: Optional[Dict[str, Any]] = Field(
        default=None, sa_column=Column(JSON)
    )

    # Status tracking
    status: DetectionStatus = Field(
        default=DetectionStatus.RECEIVED, sa_column=Column(SQLEnum(DetectionStatus))
    )
    error_message: Optional[str] = None

    # Timestamps
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True)),
    )
    processing_started_at: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True))
    )
    ai_completed_at: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True))
    )
    results_saved_at: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True))
    )
    client_notified_at: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True))
    )
    completed_at: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True))
    )
    processed_at: Optional[datetime] = Field(  # Legacy compatibility
        default=None, sa_column=Column(DateTime(timezone=True))
    )

    # Cleanup tracking
    scheduled_deletion_date: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True))
    )
    is_archived: bool = Field(default=False)


class DetectionRecordCreate(SQLModel):
    original_filename: str
    el_folder_path: str
    source_file_path: str
    machine_id: str
    machine_name: str
    source_path_at_creation: Optional[str] = None
    watch_path_at_creation: Optional[str] = None
    processed_path_at_creation: Optional[str] = None
    total_defects: int = 0
    confidence_threshold: float
    processing_time_ms: int
    annotated_image_path: Optional[str] = None
    json_results_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    grid_report_path: Optional[str] = None
    file_size_bytes: int
    grid_config: Optional[Dict[str, Any]] = None
    grid_statistics: Optional[Dict[str, Any]] = None


class DetectionRecordRead(DetectionRecordBase):
    id: UUID
    status: DetectionStatus
    created_at: datetime
    detection_details: Optional[Dict[str, Any]] = None
    grid_config: Optional[Dict[str, Any]] = None
    grid_statistics: Optional[Dict[str, Any]] = None
    processing_started_at: Optional[datetime] = None
    ai_completed_at: Optional[datetime] = None
    results_saved_at: Optional[datetime] = None
    client_notified_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    source_path_at_creation: Optional[str] = None
    watch_path_at_creation: Optional[str] = None
    processed_path_at_creation: Optional[str] = None
    grid_report_path: Optional[str] = None


class DetectionRecordUpdate(SQLModel):
    status: Optional[DetectionStatus] = None
    error_message: Optional[str] = None
    processing_started_at: Optional[datetime] = None
    ai_completed_at: Optional[datetime] = None
    results_saved_at: Optional[datetime] = None
    client_notified_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    grid_config: Optional[Dict[str, Any]] = None
    grid_statistics: Optional[Dict[str, Any]] = None
    grid_report_path: Optional[str] = None
