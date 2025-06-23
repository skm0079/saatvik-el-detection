# File: constants/constants.py

import os

# Environment configuration - EDIT THIS DICT TO CHANGE VALUES
ENVIRONMENT_CONFIG = {
    "prod": {
        "client_ip": "10.10.2.126",
        "client_os": "windows",
        "client_type": "windows",
        "shared_path": "/mnt/shared",
        "watch_path": "/mnt/shared/2025-06-20/Morning Shift",
        "excluded_folders": {"NG", "OK", "processed"},
        "confidence_threshold": 0.2,
        "api_endpoint": "http://localhost:8000/api/v1/detect",
    },
    "staging": {
        "client_ip": "10.10.2.1",
        "client_os": "windows",
        "client_type": "windows",
        "shared_path": "/mnt/shared2/2025-06-20/Morning Shift/processed",
        "watch_path": "/mnt/shared2/2025-06-20/Morning Shift",
        "excluded_folders": {"NG", "OK", "processed"},
        "confidence_threshold": 0.3,
        "api_endpoint": "http://localhost:8001/api/v1/detect",
    },
    "dev": {
        "client_ip": "10.10.2.1",
        "client_os": "windows",
        "client_type": "windows",
        "shared_path": "/mnt/shared",
        "watch_path": "/mnt/shared",
        "excluded_folders": {"NG", "OK", "processed"},
        "confidence_threshold": 0.5,
        "api_endpoint": "http://localhost:8002/api/v1/detect",
    },
}


def get_config(key: str, default=None):
    """Get configuration value for current environment"""
    current_env = os.getenv("ENV", "dev")
    env_config = ENVIRONMENT_CONFIG.get(current_env, {})
    return env_config.get(key, default)


def get_all_config():
    """Get all configuration for current environment"""
    current_env = os.getenv("ENV", "dev")
    return ENVIRONMENT_CONFIG.get(current_env, {})


# Convenience functions for common values
def get_client_ip():
    return get_config("client_ip")


def get_shared_path():
    return get_config("shared_path")


def get_watch_path():
    return get_config("watch_path")


def get_excluded_folders():
    return get_config("excluded_folders", set())


def get_confidence_threshold():
    return get_config("confidence_threshold", 0.3)
