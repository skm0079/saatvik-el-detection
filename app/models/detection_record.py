# File: app/models/detection_record.py

from sqlmodel import SQLModel, Field, Column, JSON
from sqlalchemy import DateTime, Enum as SQLEnum
from uuid import UUID, uuid4
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from enum import Enum


class DetectionStatus(str, Enum):
    """Detection processing status enum"""

    RECEIVED = "received"  # API call received, file uploaded
    PROCESSING = "processing"  # YOLO model running
    AI_COMPLETE = "ai_complete"  # AI detection finished
    RESULTS_SAVED = "results_saved"  # Results saved to processed folder
    CLIENT_NOTIFIED = "client_notified"  # Client/viewer triggered
    COMPLETED = "completed"  # Fully completed (kept for backward compatibility)
    FAILED = "failed"  # Processing failed
    SAVED = "saved"  # Final status - everything done and saved


class DetectionRecordBase(SQLModel):
    # Source info
    original_filename: str
    el_folder_path: str
    source_file_path: str

    # 🆕 MACHINE CONTEXT - NEW FIELDS
    machine_id: str = Field(index=True)  # "Test Machine", "Pre EL Machine 1", etc.
    machine_name: str  # Same as machine_id for now

    # Processing results
    total_defects: int = 0
    confidence_threshold: float
    processing_time_ms: int

    # Result file paths (relative)
    annotated_image_path: Optional[str] = None
    json_results_path: Optional[str] = None
    thumbnail_path: Optional[str] = None

    # File metadata
    file_size_bytes: int


class DetectionRecord(DetectionRecordBase, table=True):
    __tablename__ = "detection_records"

    id: UUID = Field(default_factory=uuid4, primary_key=True)

    # Detailed detection results
    detection_details: Optional[Dict[str, Any]] = Field(
        default=None, sa_column=Column(JSON)
    )

    # Status tracking with enum
    status: DetectionStatus = Field(
        default=DetectionStatus.RECEIVED, sa_column=Column(SQLEnum(DetectionStatus))
    )
    error_message: Optional[str] = None

    # Status transition timestamps
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

    # Legacy field (for backward compatibility)
    processed_at: Optional[datetime] = Field(
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
    machine_id: str  # 🆕 NEW FIELD
    machine_name: str  # 🆕 NEW FIELD
    total_defects: int = 0
    confidence_threshold: float
    processing_time_ms: int
    annotated_image_path: Optional[str] = None
    json_results_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    file_size_bytes: int


class DetectionRecordRead(DetectionRecordBase):
    id: UUID
    status: DetectionStatus
    created_at: datetime
    detection_details: Optional[Dict[str, Any]] = None
    processing_started_at: Optional[datetime] = None
    ai_completed_at: Optional[datetime] = None
    results_saved_at: Optional[datetime] = None
    client_notified_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class DetectionRecordUpdate(SQLModel):
    status: Optional[DetectionStatus] = None
    error_message: Optional[str] = None
    processing_started_at: Optional[datetime] = None
    ai_completed_at: Optional[datetime] = None
    results_saved_at: Optional[datetime] = None
    client_notified_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
