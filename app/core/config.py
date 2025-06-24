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
    current_machine = os.getenv(
        "MACHINE", config.get("current_machine", "Test Machine")
    )

    if current_mode not in config["modes"]:
        raise RuntimeError(
            f"❌ CRITICAL: Mode '{current_mode}' not found in shared_config.json"
        )

    # Validate machine exists in current mode
    if current_machine not in config["modes"][current_mode]["machines"]:
        available_machines = list(config["modes"][current_mode]["machines"].keys())
        raise RuntimeError(
            f"❌ CRITICAL: Machine '{current_machine}' not found in {current_mode} mode. "
            f"Available machines: {available_machines}"
        )

    return config, current_mode, current_machine


# Load shared config
_shared_config, _current_mode, _current_machine = load_shared_config()
_mode_config = _shared_config["modes"][_current_mode]
_machine_config = _mode_config["machines"][_current_machine]


class Settings(BaseSettings):
    # Machine identification from shared config
    machine_id: str = _machine_config["machine_id"]  # "Test Machine"
    machine_name: str = _machine_config["machine_name"]  # "Test Machine"
    current_mode: str = _current_mode  # "dev"

    # Database - EXACTLY same format as before, just mode-specific name
    database_url: str = (
        f"postgresql+asyncpg://postgres:postgres@postgres:5432/{_mode_config['database_name']}"
    )

    # SMB Paths from machine-specific config
    smb_mount_path: Path = Path(_machine_config["smb_source_path"])  # "/mnt/shared"
    smb_watch_path: Path = Path(_machine_config["smb_watch_path"])
    smb_processed_path: Path = Path(_machine_config["smb_processed_path"])

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
    ]  # From mode config

    # API - UNCHANGED
    api_v1_str: str = "/api/v1"
    project_name: str = (
        f"Saatvik EL Detection - {_machine_config['machine_name']} ({_current_mode})"
    )

    # Processing - UNCHANGED
    max_file_size: int = 50 * 1024 * 1024  # 50MB
    allowed_extensions: set[str] = {".jpg", ".jpeg", ".png"}
    processing_timeout: int = 30  # seconds

    # Logging - UNCHANGED
    log_level: str = "INFO"
    log_file: str = (
        f"logs/saatvik_el_{_current_mode}_{_current_machine.replace(' ', '_')}.log"
    )

    class Config:
        env_file = f".env.{_current_mode}"


settings = Settings()


# Helper functions for external scripts (watchdog) and API
def get_shared_config():
    """Get full shared configuration"""
    return _shared_config


def get_current_mode_config():
    """Get current mode configuration"""
    return _mode_config


def get_current_machine_config():
    """Get current machine configuration"""
    return _machine_config


def get_all_machines_in_current_mode():
    """Get list of all machines in current environment"""
    return list(_mode_config["machines"].keys())


def get_config_value(key: str, default=None):
    """Get specific config value for current machine"""
    return _machine_config.get(key, default)
