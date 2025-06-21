# File: app/models/detection_record.py

from sqlmodel import SQLModel, Field, Column, JSON
from uuid import UUID, uuid4
from datetime import datetime
from typing import Optional, Dict, Any, List

class DetectionRecordBase(SQLModel):
    # Source info
    original_filename: str
    el_folder_path: str  # e.g., "el/2025/01/shift1"
    source_file_path: str  # Local source copy path
    
    # Processing results
    total_defects: int = 0
    confidence_threshold: float
    processing_time_ms: int
    
    # Result file paths (relative)
    annotated_image_path: Optional[str] = None
    json_results_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    
    # Image metadata
    file_size_bytes: int
    image_width: Optional[int] = None
    image_height: Optional[int] = None

class DetectionRecord(DetectionRecordBase, table=True):
    __tablename__ = "detection_records"
    
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    
    # Detailed detection results
    detection_details: Optional[Dict[str, Any]] = Field(
        default=None, sa_column=Column(JSON)
    )
    
    # Status
    status: str = Field(default="completed")  # processing, completed, failed
    error_message: Optional[str] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    processed_at: Optional[datetime] = None
    
    # For future rotational cleanup
    scheduled_deletion_date: Optional[datetime] = None
    is_archived: bool = Field(default=False)

class DetectionRecordCreate(DetectionRecordBase):
    pass

class DetectionRecordRead(DetectionRecordBase):
    id: UUID
    status: str
    created_at: datetime
    detection_details: Optional[Dict[str, Any]] = None