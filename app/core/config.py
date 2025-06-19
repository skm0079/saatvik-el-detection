from pydantic_settings import BaseSettings
from pathlib import Path
from typing import Optional

class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@postgres:5432/saatvik_el_db"
    
    # Paths
    smb_mount_path: Path = Path("/mnt/shared")
    el_folder_path: str = "el/2025/01/shift1"  # MANUALLY SET THIS
    
    source_dir: Path = Path("/app/source")
    processed_dir: Path = Path("/app/processed")
    backup_dir: Path = Path("/app/backup")
    
    # YOLO Model
    model_path: Path = Path("models/best_6.pt")
    confidence_threshold: float = 0.5
    
    # API
    api_v1_str: str = "/api/v1"
    project_name: str = "Saatvik EL Defect Detection"
    
    # Processing
    max_file_size: int = 50 * 1024 * 1024  # 50MB
    allowed_extensions: set[str] = {".jpg", ".jpeg", ".png"}
    processing_timeout: int = 30  # seconds
    
    # Logging
    log_level: str = "INFO"
    log_file: str = "logs/saatvik_el.log"
    
    class Config:
        env_file = ".env"

settings = Settings()