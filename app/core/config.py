# File: app/core/config.py

from pydantic_settings import BaseSettings
from pathlib import Path
import json
import os


def load_shared_config():
    """Load shared configuration from JSON file"""
    config_file = Path("shared_config.json")
    if not config_file.exists():
        raise RuntimeError(
            f"❌ CRITICAL: shared_config.json not found at {config_file.absolute()}"
        )

    try:
        with open(config_file, "r") as f:
            config = json.load(f)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"❌ CRITICAL: Invalid JSON in shared_config.json: {e}")

    # Get current mode from environment or config default
    current_mode = os.getenv("MODE", config.get("current_mode", "dev"))

    if current_mode not in config["modes"]:
        raise RuntimeError(
            f"❌ CRITICAL: Mode '{current_mode}' not found in shared_config.json"
        )

    return config, current_mode


# Load shared config
_shared_config, _current_mode = load_shared_config()
_mode_config = _shared_config["modes"][_current_mode]


class Settings(BaseSettings):
    # Machine identification from shared config
    machine_id: str = _mode_config["machine_id"]
    machine_name: str = _mode_config["machine_name"]
    current_mode: str = _current_mode

    # Database - EXACTLY same format as before, just mode-specific name
    database_url: str = (
        f"postgresql+asyncpg://postgres:postgres@postgres:5432/{_mode_config['database_name']}"
    )

    # SMB Paths from shared config - SAME VALUES as your current setup
    smb_mount_path: Path = Path(_mode_config["smb_source_path"])  # Was "/mnt/shared"

    # NEW: Additional paths from shared config
    smb_watch_path: Path = Path(_mode_config["smb_watch_path"])
    smb_processed_path: Path = Path(_mode_config["smb_processed_path"])

    # Legacy compatibility - UNCHANGED
    el_folder_path: str = "el/2025/01/shift1"

    # Local directories - UNCHANGED
    source_dir: Path = Path("/app/source")
    processed_dir: Path = Path("processed")
    backup_dir: Path = Path("backup")

    # YOLO Model - UNCHANGED
    model_path: Path = Path("models/best_6.pt")
    confidence_threshold: float = _mode_config[
        "confidence_threshold"
    ]  # From config now

    # API - UNCHANGED
    api_v1_str: str = "/api/v1"
    project_name: str = f"Saatvik EL Detection - {_mode_config['machine_name']}"

    # Processing - UNCHANGED
    max_file_size: int = 50 * 1024 * 1024  # 50MB
    allowed_extensions: set[str] = {".jpg", ".jpeg", ".png"}
    processing_timeout: int = 30  # seconds

    # Logging - UNCHANGED
    log_level: str = "INFO"
    log_file: str = f"logs/saatvik_el_{_current_mode}.log"

    class Config:
        env_file = f".env.{_current_mode}"


settings = Settings()


# Helper functions for external scripts (watchdog)
def get_shared_config():
    """Get full shared configuration"""
    return _shared_config


def get_current_mode_config():
    """Get current mode configuration"""
    return _mode_config


def get_config_value(key: str, default=None):
    """Get specific config value for current mode"""
    return _mode_config.get(key, default)
