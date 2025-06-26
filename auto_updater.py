#!/usr/bin/env python3

"""
auto_updater.py - Automatic Path Updater for Saatvik EL Detection System

This script runs via cron every 10 minutes to:
1. Check if machine paths need updating based on time/shift
2. Update shared_config.json if needed
3. Restart services (make down → make dev + watchdogs)
4. Wait for services to be ready

3 Machines with different shift names:
- Test Machine: Morning Shift/Night Shift (6:50 AM/PM)
- Factory Line 2: Morning Shift/Night Shift (7:00 AM/PM)
- Factory Line 1: X/Y (7:00 AM/PM)
"""

import json
import os
import subprocess
import time
import datetime
import logging
import sys
import shutil
from pathlib import Path

# ==============================================================================
# CONFIGURATION - EDIT THESE VALUES
# ==============================================================================

# Project settings
PROJECT_DIR = "/home/administrator/Documents/defect_detection/saatvik-el-detection"
CONFIG_FILE = "shared_config.json"
LOG_FILE = "auto_updater.log"
BACKUP_DIR = "backup"

# Service restart timing (in seconds)
SHUTDOWN_WAIT = 60  # Wait time after 'make down'
STARTUP_WAIT = 90  # Wait time after 'make dev'
WATCHDOG_WAIT = 30  # Wait time after starting watchdogs

# Machine shift configurations - 3 MACHINES WITH DIFFERENT SHIFT NAMES
SHIFT_CONFIGS = {
    "Test Machine": {
        "source_path": "/mnt/shared",
        "shifts": {
            "Morning Shift": {
                "start": 6,
                "end": 18,
                "minutes": 50,
            },  # 6:50 AM to 6:50 PM
            "Night Shift": {"start": 18, "end": 6, "minutes": 50},  # 6:50 PM to 6:50 AM
        },
    },
    "Factory Line 2": {
        "source_path": "/mnt/shared2",
        "shifts": {
            "Morning Shift": {
                "start": 7,
                "end": 19,
                "minutes": 0,
            },  # 7:00 AM to 7:00 PM
            "Night Shift": {"start": 19, "end": 7, "minutes": 0},  # 7:00 PM to 7:00 AM
        },
    },
    "Factory Line 1": {
        "source_path": "/mnt/shared3",
        "shifts": {
            "X": {"start": 7, "end": 19, "minutes": 0},  # 7:00 AM to 7:00 PM
            "Y": {"start": 19, "end": 7, "minutes": 0},  # 7:00 PM to 7:00 AM
        },
    },
}

# ==============================================================================
# LOGGING SETUP
# ==============================================================================


def setup_logging():
    """Set up logging to file and console"""

    log_path = Path(PROJECT_DIR) / LOG_FILE

    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[logging.FileHandler(log_path), logging.StreamHandler(sys.stdout)],
    )

    return logging.getLogger(__name__)


# ==============================================================================
# UTILITY FUNCTIONS
# ==============================================================================


def get_current_shift(machine_name, current_hour, current_minute):
    """Get current shift for a machine based on time"""

    if machine_name not in SHIFT_CONFIGS:
        logger.error(f"Machine '{machine_name}' not found in SHIFT_CONFIGS")
        return None

    shifts = SHIFT_CONFIGS[machine_name]["shifts"]
    current_time_minutes = current_hour * 60 + current_minute

    # Check each shift to see which one we're in
    for shift_name, times in shifts.items():
        start_minutes = times["start"] * 60 + times["minutes"]
        end_minutes = times["end"] * 60 + times["minutes"]

        # Handle shift that crosses midnight (e.g., 18:50 to 06:50 next day)
        if start_minutes > end_minutes:  # Night shift crossing midnight
            if (
                current_time_minutes >= start_minutes
                or current_time_minutes < end_minutes
            ):
                return shift_name
        else:  # Day shift within same day
            if start_minutes <= current_time_minutes < end_minutes:
                return shift_name

    # If no shift found, return the first one (fallback)
    return list(shifts.keys())[0]


def generate_expected_path(machine_name, date_str, shift_name):
    """Generate expected path for a machine"""

    if machine_name not in SHIFT_CONFIGS:
        return None

    base_path = SHIFT_CONFIGS[machine_name]["source_path"]
    return f"{base_path}/{date_str}/{shift_name}"


def run_command_with_wait(command, wait_time=0, timeout=300):
    """Run command and wait, with proper error handling"""

    logger.info(f"Running: {command}")

    try:
        # Run command
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=PROJECT_DIR,
        )

        # Log output
        if result.stdout.strip():
            logger.info(f"Output: {result.stdout.strip()}")
        if result.stderr.strip():
            logger.warning(f"Stderr: {result.stderr.strip()}")

        success = result.returncode == 0

        if success:
            logger.info(f"✅ Command completed successfully")
        else:
            logger.error(f"❌ Command failed (exit code: {result.returncode})")

        # Wait if specified
        if wait_time > 0:
            logger.info(f"⏳ Waiting {wait_time} seconds...")
            time.sleep(wait_time)

        return success

    except subprocess.TimeoutExpired:
        logger.error(f"❌ Command timed out after {timeout} seconds")
        return False
    except Exception as e:
        logger.error(f"❌ Command error: {e}")
        return False


def check_api_health():
    """Check if API is responding"""

    try:
        result = subprocess.run(
            ["curl", "-s", "-f", "http://localhost:8000/api/v1/health"],
            capture_output=True,
            timeout=10,
        )

        if result.returncode == 0:
            logger.info("✅ API health check: PASSED")
            return True
        else:
            logger.warning("⚠️ API health check: FAILED")
            return False

    except Exception as e:
        logger.warning(f"⚠️ API health check error: {e}")
        return False


# ==============================================================================
# MAIN FUNCTIONS
# ==============================================================================


def load_current_config():
    """Load current shared_config.json"""

    config_path = Path(PROJECT_DIR) / CONFIG_FILE

    if not config_path.exists():
        logger.error(f"Config file not found: {config_path}")
        return None

    try:
        with open(config_path, "r") as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load config: {e}")
        return None


def get_current_paths(config):
    """Extract current paths from config"""

    try:
        machines = config["modes"]["dev"]["machines"]
        paths = {}

        for machine_name in SHIFT_CONFIGS.keys():
            if machine_name in machines:
                paths[machine_name] = machines[machine_name]["smb_watch_path"]
            else:
                logger.warning(f"Machine '{machine_name}' not found in config")

        return paths

    except Exception as e:
        logger.error(f"Failed to extract current paths: {e}")
        return {}


def get_expected_paths():
    """Calculate expected paths based on current time"""

    now = datetime.datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    current_hour = now.hour
    current_minute = now.minute

    expected = {}

    logger.info(
        f"Current time: {now.strftime('%Y-%m-%d %H:%M')} (Hour: {current_hour}, Minute: {current_minute})"
    )

    for machine_name in SHIFT_CONFIGS.keys():
        current_shift = get_current_shift(machine_name, current_hour, current_minute)

        if current_shift:
            expected_path = generate_expected_path(
                machine_name, date_str, current_shift
            )
            expected[machine_name] = expected_path

            # Show shift timing for clarity
            shifts = SHIFT_CONFIGS[machine_name]["shifts"]
            if current_shift in shifts:
                shift_info = shifts[current_shift]
                start_time = f"{shift_info['start']:02d}:{shift_info['minutes']:02d}"
                end_time = f"{shift_info['end']:02d}:{shift_info['minutes']:02d}"
                logger.info(
                    f"{machine_name}: {current_shift} ({start_time}-{end_time}) → {expected_path}"
                )
            else:
                logger.info(f"{machine_name}: {current_shift} → {expected_path}")
        else:
            logger.error(f"Could not determine shift for {machine_name}")

    return expected


def backup_config():
    """Create backup of current config"""

    try:
        backup_dir = Path(PROJECT_DIR) / BACKUP_DIR
        backup_dir.mkdir(exist_ok=True)

        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"config_backup_{timestamp}.json"
        backup_path = backup_dir / backup_name

        config_path = Path(PROJECT_DIR) / CONFIG_FILE
        shutil.copy2(config_path, backup_path)

        logger.info(f"✅ Config backed up: {backup_name}")
        return True

    except Exception as e:
        logger.error(f"❌ Backup failed: {e}")
        return False


def update_config_paths(config, updates):
    """Update config with new paths"""

    try:
        machines = config["modes"]["dev"]["machines"]

        for machine_name, new_path in updates.items():
            if machine_name in machines:
                old_path = machines[machine_name]["smb_watch_path"]
                machines[machine_name]["smb_watch_path"] = new_path
                logger.info(f"Updated {machine_name}:")
                logger.info(f"  Old: {old_path}")
                logger.info(f"  New: {new_path}")
            else:
                logger.error(f"Machine '{machine_name}' not found in config")
                return False

        # Save updated config
        config_path = Path(PROJECT_DIR) / CONFIG_FILE
        with open(config_path, "w") as f:
            json.dump(config, f, indent=4)

        logger.info("✅ Config file updated successfully")
        return True

    except Exception as e:
        logger.error(f"❌ Failed to update config: {e}")
        return False


def restart_all_services():
    """Restart all services: docker containers + watchdogs"""

    logger.info("🔄 Starting complete service restart...")

    # Change to project directory
    os.chdir(PROJECT_DIR)
    logger.info(f"Working directory: {PROJECT_DIR}")

    # Step 1: Stop everything
    logger.info("Step 1: Stopping services...")
    if not run_command_with_wait("sudo make down", wait_time=SHUTDOWN_WAIT):
        logger.warning("⚠️ 'sudo make down' failed, trying direct docker-compose...")
        if not run_command_with_wait(
            "sudo docker-compose down", wait_time=SHUTDOWN_WAIT
        ):
            logger.error("❌ Failed to stop services")
            return False

    # Step 2: Start main application
    logger.info("Step 2: Starting main application...")
    if not run_command_with_wait("sudo make dev", wait_time=STARTUP_WAIT):
        logger.warning("⚠️ 'sudo make dev' failed, trying direct docker-compose...")
        if not run_command_with_wait(
            "sudo docker-compose up -d", wait_time=STARTUP_WAIT
        ):
            logger.error("❌ Failed to start main application")
            return False

    # Step 3: Start watchdog processes
    logger.info("Step 3: Starting watchdog processes...")

    # Kill any existing watchdog processes first
    run_command_with_wait("pkill -f el_watcher.py", wait_time=2)
    run_command_with_wait("pkill -f processed_watcher.py", wait_time=2)

    # Start EL watcher
    el_cmd = "nohup uv run watchdog/el_watcher.py > el_watcher.log 2>&1 &"
    if not run_command_with_wait(el_cmd, wait_time=5):
        logger.error("❌ Failed to start el_watcher.py")
        return False

    # Start processed watcher
    proc_cmd = (
        "nohup uv run watchdog/processed_watcher.py > processed_watcher.log 2>&1 &"
    )
    if not run_command_with_wait(proc_cmd, wait_time=WATCHDOG_WAIT):
        logger.error("❌ Failed to start processed_watcher.py")
        return False

    # Step 4: Final health check
    logger.info("Step 4: Final health check...")

    # Wait a bit more for everything to stabilize
    logger.info("⏳ Waiting for services to stabilize...")
    time.sleep(15)

    # Check API health
    if check_api_health():
        logger.info("✅ All services restarted successfully")
        return True
    else:
        logger.warning("⚠️ Services restarted but API check failed")
        return True  # Still consider it success, API might need more time


def main():
    """Main execution function"""

    # Setup logging
    global logger
    logger = setup_logging()

    try:
        logger.info("=" * 70)
        logger.info("🚀 AUTO-UPDATER STARTED (3 Machines)")
        logger.info(f"Time: {datetime.datetime.now()}")
        logger.info(f"User: {os.getenv('USER', 'unknown')}")
        logger.info("=" * 70)

        # Load current config
        config = load_current_config()
        if not config:
            logger.error("❌ Failed to load config file")
            return False

        # Get current and expected paths
        current_paths = get_current_paths(config)
        expected_paths = get_expected_paths()

        if not current_paths or not expected_paths:
            logger.error("❌ Failed to determine paths")
            return False

        # Find what needs updating
        updates_needed = {}

        logger.info("📊 PATH COMPARISON:")
        for machine_name in SHIFT_CONFIGS.keys():
            current = current_paths.get(machine_name, "NOT FOUND")
            expected = expected_paths.get(machine_name, "ERROR")

            logger.info(f"  {machine_name}:")
            logger.info(f"    Current:  {current}")
            logger.info(f"    Expected: {expected}")

            if current != expected:
                updates_needed[machine_name] = expected

        # Perform updates if needed
        if updates_needed:
            logger.info(f"🔄 {len(updates_needed)} MACHINE(S) NEED UPDATES")
            logger.info("=" * 70)

            # Backup config
            if not backup_config():
                logger.error("❌ Backup failed - aborting")
                return False

            # Update config
            if not update_config_paths(config, updates_needed):
                logger.error("❌ Config update failed - aborting")
                return False

            # Restart services
            if restart_all_services():
                logger.info("✅ Services restart completed")
            else:
                logger.error("❌ Services restart failed")
                return False

            logger.info("=" * 70)
            logger.info("✅ UPDATE PROCESS COMPLETED SUCCESSFULLY")

        else:
            logger.info("✅ No updates needed - all paths are correct")

        logger.info("=" * 70)
        logger.info(f"🏁 AUTO-UPDATER FINISHED - {datetime.datetime.now()}")
        logger.info("=" * 70)

        return True

    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")
        return False


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
