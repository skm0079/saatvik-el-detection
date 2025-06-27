#!/usr/bin/env python3
"""
Auto-updater for EL Detection System
Automatically updates machine configurations based on shift schedules
"""

import json
import os
import subprocess
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Tuple

# Configuration
SCRIPT_DIR = Path(__file__).parent
CONFIG_FILE = SCRIPT_DIR / "shared_config.json"
BACKUP_DIR = SCRIPT_DIR / "config_backups"
LOG_DIR = SCRIPT_DIR

# HARDCODED SHIFT DEFINITIONS (copied from setup_config_json.py)
MACHINES_SHIFT_CONFIG = {
    "Test Machine": {
        "base_path": "/mnt/shared",
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
        "base_path": "/mnt/shared2",
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
        "base_path": "/mnt/shared3/21-12-24/el",
        "shifts": {
            "Morning Shift": {
                "start": 7,
                "end": 19,
                "minutes": 0,
            },  # 7:00 AM to 7:00 PM
            "Night Shift": {"start": 19, "end": 7, "minutes": 0},  # 7:00 PM to 7:00 AM
        },
    },
}


class Logger:
    """Simple logger for auto-updater"""

    @staticmethod
    def log(message: str, level: str = "INFO"):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{timestamp}] {message}")


logger = Logger()


def run_command(
    command: str, ignore_failure: bool = False, timeout: int = 120
) -> Tuple[bool, str, str]:
    """Run a shell command and return success, stdout, stderr"""
    try:
        logger.log(f"Running: {command}")
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
            cwd=SCRIPT_DIR,
        )

        if result.stdout.strip():
            logger.log(f"Output: {result.stdout.strip()}")
        if result.stderr.strip():
            logger.log(f"Stderr: {result.stderr.strip()}")

        if result.returncode == 0:
            logger.log("✅ Command completed successfully")
            return True, result.stdout, result.stderr
        else:
            if ignore_failure:
                logger.log(f"❌ Command failed (exit code: {result.returncode})")
                return False, result.stdout, result.stderr
            else:
                logger.log(f"❌ Command failed (exit code: {result.returncode})")
                raise subprocess.CalledProcessError(result.returncode, command)

    except subprocess.TimeoutExpired:
        logger.log(f"⏰ Command timed out after {timeout} seconds")
        if not ignore_failure:
            raise
        return False, "", "Timeout"
    except Exception as e:
        logger.log(f"❌ Command error: {e}")
        if not ignore_failure:
            raise
        return False, "", str(e)


def load_config() -> Dict:
    """Load configuration from JSON file"""
    try:
        with open(CONFIG_FILE, "r") as f:
            return json.load(f)
    except Exception as e:
        logger.log(f"❌ Failed to load config: {e}")
        raise


def save_config(config: Dict) -> None:
    """Save configuration to JSON file"""
    try:
        # Create backup first
        backup_config(config)

        with open(CONFIG_FILE, "w") as f:
            json.dump(config, f, indent=2)
        logger.log("✅ Config file updated successfully")
    except Exception as e:
        logger.log(f"❌ Failed to save config: {e}")
        raise


def backup_config(config: Dict) -> None:
    """Create a backup of current configuration"""
    try:
        BACKUP_DIR.mkdir(exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = BACKUP_DIR / f"config_backup_{timestamp}.json"

        with open(backup_file, "w") as f:
            json.dump(config, f, indent=2)
        logger.log(f"✅ Config backed up: {backup_file.name}")
    except Exception as e:
        logger.log(f"⚠️ Failed to create backup: {e}")


def get_current_shift_for_machine(machine_name, current_hour, current_minute):
    """Get current shift for a specific machine based on its shift times"""

    if machine_name not in MACHINES_SHIFT_CONFIG:
        return None

    machine = MACHINES_SHIFT_CONFIG[machine_name]
    shift_config = machine["shifts"]

    # Convert current time to minutes since midnight for comparison
    current_time_minutes = current_hour * 60 + current_minute

    # Check each shift to see which one we're in
    for shift_name, times in shift_config.items():
        start_minutes = times["start"] * 60 + times["minutes"]
        end_minutes = times["end"] * 60 + times["minutes"]

        # Handle shift that crosses midnight (e.g., 19:00 to 07:00 next day)
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
    return list(shift_config.keys())[0]


def generate_expected_path(machine_name, date_str, shift_name):
    """Generate expected smb_watch_path for a machine with correct date logic"""
    if machine_name not in MACHINES_SHIFT_CONFIG:
        return None

    base_path = MACHINES_SHIFT_CONFIG[machine_name]["base_path"]

    # For night shifts, use the date when the shift STARTED
    # Night shift on 27th 7PM -> 28th 7AM should use "2025-06-27" throughout
    return f"{base_path}/{date_str}/{shift_name}"


def get_current_shift_info(machine_name: str) -> Tuple[str, str]:
    """Get current shift name and expected path for a machine with correct date handling"""
    current_time = datetime.now()

    # Get current shift based on hardcoded definitions
    current_shift = get_current_shift_for_machine(
        machine_name, current_time.hour, current_time.minute
    )

    if not current_shift:
        return "Unknown", ""

    # FIXED: Determine the correct date for the path
    # For night shifts that started before midnight, use previous day's date
    if current_shift == "Night Shift" and current_time.hour < 7:
        # It's past midnight but still night shift from previous day
        # Use previous day's date for the path
        path_date = (current_time - timedelta(days=1)).strftime("%Y-%m-%d")
    else:
        # Use current day's date
        path_date = current_time.strftime("%Y-%m-%d")

    # Generate expected path
    expected_path = generate_expected_path(machine_name, path_date, current_shift)

    return current_shift, expected_path


def check_path_updates_needed(config: Dict) -> List[Dict]:
    """Check which machines need path updates - CHECK ALL MACHINES"""
    machines_to_update = []
    current_time = datetime.now()

    logger.log(
        f"Current time: {current_time.strftime('%Y-%m-%d %H:%M')} (Hour: {current_time.hour}, Minute: {current_time.minute})"
    )

    # Get current mode and ALL machines
    current_mode = config.get("current_mode", "dev")
    machines = config.get("modes", {}).get(current_mode, {}).get("machines", {})

    if not machines:
        logger.log(f"⚠️ No machines found in mode '{current_mode}'")
        return []

    logger.log(f"🔍 Checking {len(machines)} machines for path updates...")

    # Show current shift info for ALL machines
    for machine_id, machine_config in machines.items():
        shift_name, expected_path = get_current_shift_info(machine_id)
        if machine_id in MACHINES_SHIFT_CONFIG:
            shift_config = MACHINES_SHIFT_CONFIG[machine_id]["shifts"][shift_name]
            start_time = f"{shift_config['start']:02d}:{shift_config['minutes']:02d}"
            end_time = f"{shift_config['end']:02d}:{shift_config['minutes']:02d}"
            logger.log(
                f"{machine_id}: {shift_name} ({start_time}-{end_time}) → {expected_path}"
            )
        else:
            logger.log(f"{machine_id}: No shift config found")

    logger.log("📊 PATH COMPARISON FOR ALL MACHINES:")

    # Check ALL machines for updates
    for machine_id, machine_config in machines.items():
        current_path = machine_config["smb_watch_path"]
        shift_name, expected_path = get_current_shift_info(machine_id)

        logger.log(f"  {machine_id}:")
        logger.log(f"    Current:  {current_path}")
        logger.log(f"    Expected: {expected_path}")

        if current_path != expected_path and expected_path:
            machines_to_update.append(
                {
                    "machine_id": machine_id,
                    "current_path": current_path,
                    "expected_path": expected_path,
                    "shift_name": shift_name,
                }
            )
            logger.log(f"    Status:   NEEDS UPDATE")
        else:
            logger.log(f"    Status:   UP TO DATE")

    return machines_to_update


def update_machine_paths(config: Dict, updates: List[Dict]) -> Dict:
    """Update machine paths in configuration - UPDATE ALL MACHINES"""
    updated_config = config.copy()
    current_mode = config.get("current_mode", "dev")

    logger.log(f"🔄 Updating paths for {len(updates)} machines...")

    for update in updates:
        machine_id = update["machine_id"]
        old_path = update["current_path"]
        new_path = update["expected_path"]

        updated_config["modes"][current_mode]["machines"][machine_id][
            "smb_watch_path"
        ] = new_path
        logger.log(f"✅ Updated {machine_id}:")
        logger.log(f"  Old: {old_path}")
        logger.log(f"  New: {new_path}")

    logger.log(f"🔧 All {len(updates)} machine paths updated in configuration")
    return updated_config


def kill_old_processes():
    """Kill old watchdog processes with better error handling"""
    logger.log("🔄 Stopping old watchdog processes...")

    # Kill processes more aggressively
    commands = [
        "pkill -9 -f el_watcher.py",
        "pkill -9 -f processed_watcher.py",
        "pkill -9 -f 'MACHINE=.*el_watcher'",
        "ps aux | grep 'el_watcher.py' | grep -v grep | awk '{print $2}' | xargs -r kill -9",
        "ps aux | grep 'processed_watcher.py' | grep -v grep | awk '{print $2}' | xargs -r kill -9",
    ]

    for cmd in commands:
        run_command(cmd, ignore_failure=True)
        time.sleep(2)

    logger.log("✅ Old processes terminated")


def start_el_watcher_simple(machine: str) -> bool:
    """Start el_watcher for a single machine with simplified approach"""
    log_file = machine.replace(" ", "_").lower()

    # Simple direct command without complex sudo chains
    cmd = f"cd {SCRIPT_DIR} && MACHINE='{machine}' nohup uv run watchdog/el_watcher.py > /tmp/{log_file}.log 2>&1 &"

    try:
        # Use Popen for non-blocking execution
        process = subprocess.Popen(
            cmd,
            shell=True,
            cwd=SCRIPT_DIR,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            preexec_fn=os.setsid,  # Create new process group
        )

        logger.log(f"✅ Started el_watcher for {machine} (PID: {process.pid})")
        return True

    except Exception as e:
        logger.log(f"❌ Failed to start el_watcher for {machine}: {e}")
        return False


def start_processed_watcher_simple() -> bool:
    """Start processed_watcher with simplified approach"""
    cmd = f"cd {SCRIPT_DIR} && nohup uv run watchdog/processed_watcher.py > /tmp/processed_watcher.log 2>&1 &"

    try:
        # Use Popen for non-blocking execution
        process = subprocess.Popen(
            cmd,
            shell=True,
            cwd=SCRIPT_DIR,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            preexec_fn=os.setsid,  # Create new process group
        )

        logger.log(f"✅ Started processed_watcher (PID: {process.pid})")
        return True

    except Exception as e:
        logger.log(f"❌ Failed to start processed_watcher: {e}")
        return False


def check_process_running(process_pattern: str) -> bool:
    """Check if a process is running"""
    try:
        result = subprocess.run(
            f"pgrep -f '{process_pattern}'", shell=True, capture_output=True, text=True
        )
        return result.returncode == 0 and result.stdout.strip()
    except:
        return False


def restart_services() -> None:
    """Restart all services with simplified watchdog management"""
    logger.log("🔄 Starting complete service restart...")
    logger.log(f"Working directory: {SCRIPT_DIR}")

    # Step 1: Stop services
    logger.log("Step 1: Stopping services...")
    run_command("sudo make down")
    logger.log("⏳ Waiting 30 seconds...")
    time.sleep(30)

    # Step 2: Kill old processes
    kill_old_processes()

    # Step 3: Start main application
    logger.log("Step 2: Starting main application...")
    run_command("sudo make dev")
    logger.log("⏳ Waiting 60 seconds...")
    time.sleep(60)

    # Step 4: Start watchdog processes with simplified approach
    logger.log("Step 3: Starting watchdog processes...")

    machines = ["Test Machine", "Factory Line 1", "Factory Line 2"]
    el_watcher_success = 0

    for machine in machines:
        if start_el_watcher_simple(machine):
            el_watcher_success += 1
        time.sleep(3)  # Small delay between starts

    # Start processed_watcher
    processed_watcher_success = start_processed_watcher_simple()

    # Wait for processes to initialize
    logger.log("⏳ Waiting 20 seconds for processes to initialize...")
    time.sleep(20)

    # Simple verification
    logger.log("Step 4: Verifying processes...")

    el_running = check_process_running("el_watcher.py")
    processed_running = check_process_running("processed_watcher.py")

    logger.log(f"📊 el_watcher processes: {el_watcher_success}/3 started")
    logger.log(f"📊 el_watcher running: {'✅' if el_running else '❌'}")
    logger.log(f"📊 processed_watcher running: {'✅' if processed_running else '❌'}")

    # Step 5: Final health check
    logger.log("Step 5: Final health check...")
    time.sleep(10)

    # Check API health
    success, stdout, stderr = run_command(
        "curl -s http://localhost:8000/health", ignore_failure=True
    )
    if success:
        logger.log("✅ API health check: PASSED")
    else:
        logger.log("⚠️ API health check: FAILED")

    logger.log("✅ Services restart completed")


def main():
    """Main auto-updater logic"""
    try:
        # Header
        logger.log("=" * 70)
        logger.log("🚀 AUTO-UPDATER STARTED")
        logger.log(f"Time: {datetime.now()}")
        logger.log(f"User: {os.getenv('USER', 'unknown')}")
        logger.log("=" * 70)

        # Load current configuration
        config = load_config()
        current_mode = config.get("current_mode", "dev")
        machines = config.get("modes", {}).get(current_mode, {}).get("machines", {})
        machine_count = len(machines)
        logger.log(f"🚀 AUTO-UPDATER STARTED ({machine_count} Machines)")

        # Check which machines need updates
        updates_needed = check_path_updates_needed(config)

        if not updates_needed:
            logger.log("✅ All machines are already up to date")
            logger.log("=" * 70)
            return

        logger.log(f"🔄 {len(updates_needed)} MACHINE(S) NEED UPDATES")
        logger.log("=" * 70)

        # Update configuration
        updated_config = update_machine_paths(config, updates_needed)
        save_config(updated_config)

        # Restart services
        restart_services()

        logger.log("✅ Services restart completed")
        logger.log("=" * 70)
        logger.log("✅ UPDATE PROCESS COMPLETED SUCCESSFULLY")
        logger.log("=" * 70)

    except Exception as e:
        logger.log(f"❌ Auto-updater failed: {e}")
        logger.log("=" * 70)
        raise


if __name__ == "__main__":
    main()
