#!/usr/bin/env python3
"""
Complete Auto-Updater with Mount Checks and Proper Logging
"""
import json
import os
import subprocess
import time
import glob
from datetime import datetime, timedelta
from pathlib import Path

# Configuration
SCRIPT_DIR = Path(__file__).parent
CONFIG_FILE = SCRIPT_DIR / "shared_config.json"
LOG_DIR = SCRIPT_DIR / "auto_logs"

# Ensure log directory exists
LOG_DIR.mkdir(exist_ok=True)

# Log files
MOUNT_LOG = LOG_DIR / "mount_check.log"
WATCHER_LOG = LOG_DIR / "watcher_errors.log"
MAIN_LOG = LOG_DIR / "auto_updater.log"
CRON_LOG = LOG_DIR / "cron.log"

# Shift configuration
MACHINES_SHIFT_CONFIG = {
    "Test Machine": {
        "base_path": "/mnt/shared",
        "shifts": {
            "Morning Shift": {"start": 6, "end": 18, "minutes": 50},
            "Night Shift": {"start": 18, "end": 6, "minutes": 50},
        },
    },
    "Factory Line 2": {
        "base_path": "/mnt/shared2",
        "shifts": {
            "Morning Shift": {"start": 7, "end": 19, "minutes": 0},
            "Night Shift": {"start": 19, "end": 7, "minutes": 0},
        },
    },
    "Factory Line 1": {
        "base_path": "/mnt/shared3/21-12-24/el",
        "shifts": {
            "Morning Shift": {"start": 7, "end": 19, "minutes": 0},
            "Night Shift": {"start": 19, "end": 7, "minutes": 0},
        },
    },
}


def log_to_file(log_file: Path, message: str, level: str = "INFO"):
    """Log message to specific file with timestamp"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    log_entry = f"[{timestamp}] {level}: {message}\n"

    # Write to file
    with open(log_file, "a") as f:
        f.write(log_entry)

    # Also print to console
    print(f"[{timestamp}] {message}")


def check_all_mounts():
    """Check ALL mounts in /mnt/ directory"""
    log_to_file(MOUNT_LOG, "=== MOUNT HEALTH CHECK STARTING ===")

    # Find all mount points in /mnt/
    mnt_dirs = []
    if os.path.exists("/mnt"):
        mnt_dirs = [d for d in glob.glob("/mnt/*") if os.path.isdir(d)]

    if not mnt_dirs:
        log_to_file(MOUNT_LOG, "No mount points found in /mnt/", "WARNING")
        return False

    all_healthy = True

    for mount_dir in mnt_dirs:
        mount_name = os.path.basename(mount_dir)
        log_to_file(MOUNT_LOG, f"Checking mount: {mount_dir}")

        # Test 1: Directory exists and accessible
        if not os.path.exists(mount_dir):
            log_to_file(
                MOUNT_LOG, f"❌ {mount_name}: Directory does not exist", "ERROR"
            )
            all_healthy = False
            continue

        # Test 2: Can list directory contents
        try:
            contents = os.listdir(mount_dir)
            log_to_file(MOUNT_LOG, f"✅ {mount_name}: Readable ({len(contents)} items)")
        except PermissionError:
            log_to_file(MOUNT_LOG, f"❌ {mount_name}: Permission denied", "ERROR")
            all_healthy = False
            continue
        except OSError as e:
            log_to_file(MOUNT_LOG, f"❌ {mount_name}: Mount failed ({e})", "ERROR")
            all_healthy = False
            continue

        # Test 3: Try to create test file (write access)
        test_file = os.path.join(mount_dir, ".mount_test")
        try:
            with open(test_file, "w") as f:
                f.write("test")
            os.remove(test_file)
            log_to_file(MOUNT_LOG, f"✅ {mount_name}: Writable")
        except (PermissionError, OSError) as e:
            log_to_file(
                MOUNT_LOG, f"⚠️ {mount_name}: Read-only or write failed ({e})", "WARNING"
            )

        # Test 4: Check if it's actually a mount point
        is_mountpoint = os.path.ismount(mount_dir)
        log_to_file(
            MOUNT_LOG,
            f"📍 {mount_name}: {'Is mountpoint' if is_mountpoint else 'Not a mountpoint'}",
        )

    if not all_healthy:
        log_to_file(
            MOUNT_LOG,
            "🚨 MOUNT ISSUES DETECTED - ALERT IT TEAM FOR REMOUNT",
            "CRITICAL",
        )
        # Could add email/slack notification here
    else:
        log_to_file(MOUNT_LOG, "✅ All mounts healthy")

    log_to_file(MOUNT_LOG, "=== MOUNT HEALTH CHECK COMPLETE ===")
    return all_healthy


def create_required_directories():
    """Create required shift directories if mounts are healthy"""
    log_to_file(MAIN_LOG, "Creating required directories...")

    current_time = datetime.now()
    date_str = current_time.strftime("%Y-%m-%d")

    for machine_name, config in MACHINES_SHIFT_CONFIG.items():
        base_path = config["base_path"]

        for shift_name in config["shifts"].keys():
            dir_path = f"{base_path}/{date_str}/{shift_name}"

            try:
                os.makedirs(dir_path, exist_ok=True)
                log_to_file(MAIN_LOG, f"✅ Created/verified: {dir_path}")
            except OSError as e:
                log_to_file(MAIN_LOG, f"❌ Failed to create {dir_path}: {e}", "ERROR")


def get_current_shift_info(machine_name: str):
    """Get current shift and path for machine"""
    current_time = datetime.now()

    if machine_name not in MACHINES_SHIFT_CONFIG:
        return "Unknown", ""

    machine = MACHINES_SHIFT_CONFIG[machine_name]
    shifts = machine["shifts"]
    current_time_mins = current_time.hour * 60 + current_time.minute

    for shift_name, times in shifts.items():
        start_mins = times["start"] * 60 + times["minutes"]
        end_mins = times["end"] * 60 + times["minutes"]

        if start_mins > end_mins:  # Night shift crossing midnight
            if current_time_mins >= start_mins or current_time_mins < end_mins:
                # For night shift after midnight, use previous day's date
                if current_time.hour < 7:
                    date_str = (current_time - timedelta(days=1)).strftime("%Y-%m-%d")
                else:
                    date_str = current_time.strftime("%Y-%m-%d")
                return shift_name, f"{machine['base_path']}/{date_str}/{shift_name}"
        else:  # Day shift
            if start_mins <= current_time_mins < end_mins:
                date_str = current_time.strftime("%Y-%m-%d")
                return shift_name, f"{machine['base_path']}/{date_str}/{shift_name}"

    # Fallback to first shift
    return list(shifts.keys())[0], ""


def update_config_paths():
    """Update machine paths in config"""
    log_to_file(MAIN_LOG, "Checking for path updates...")

    try:
        with open(CONFIG_FILE, "r") as f:
            config = json.load(f)
    except Exception as e:
        log_to_file(MAIN_LOG, f"Failed to load config: {e}", "ERROR")
        return False

    machines = config.get("modes", {}).get("dev", {}).get("machines", {})
    updates_needed = []

    for machine_id, machine_config in machines.items():
        current_path = machine_config.get("smb_watch_path", "")
        shift_name, expected_path = get_current_shift_info(machine_id)

        log_to_file(MAIN_LOG, f"{machine_id}: {current_path} → {expected_path}")

        if current_path != expected_path and expected_path:
            updates_needed.append(
                {"machine_id": machine_id, "old": current_path, "new": expected_path}
            )
            machine_config["smb_watch_path"] = expected_path

    if not updates_needed:
        log_to_file(MAIN_LOG, "✅ All paths up to date")
        return False

    # Save updated config
    try:
        with open(CONFIG_FILE, "w") as f:
            json.dump(config, f, indent=2)
        log_to_file(MAIN_LOG, f"✅ Updated {len(updates_needed)} machine paths")
        return True
    except Exception as e:
        log_to_file(MAIN_LOG, f"Failed to save config: {e}", "ERROR")
        return False


def kill_old_watchers():
    """Kill old watcher processes"""
    log_to_file(MAIN_LOG, "Stopping old watcher processes...")

    # FIXED: Target UV-run processes specifically
    kill_commands = [
        "ps aux | grep 'uv run.*el_watcher' | grep -v grep | awk '{print $2}' | xargs -r kill -9",
        "ps aux | grep 'uv run.*processed_watcher' | grep -v grep | awk '{print $2}' | xargs -r kill -9",
        "ps aux | grep 'el_watcher.py' | grep -v grep | awk '{print $2}' | xargs -r kill -9",
        "ps aux | grep 'processed_watcher.py' | grep -v grep | awk '{print $2}' | xargs -r kill -9",
    ]

    for cmd in kill_commands:
        try:
            subprocess.run(cmd, shell=True, timeout=10)
        except:
            pass
        time.sleep(1)

    log_to_file(MAIN_LOG, "✅ Old watcher processes terminated")


def start_watchers():
    """Start watcher processes with mount error handling"""
    log_to_file(MAIN_LOG, "Starting watcher processes...")

    machines = ["Test Machine", "Factory Line 1", "Factory Line 2"]
    started_count = 0

    for machine in machines:
        log_file = LOG_DIR / f"{machine.replace(' ', '_').lower()}_watcher.log"

        try:
            # Use UV to run in virtual environment
            env = os.environ.copy()
            env["MACHINE"] = machine

            with open(log_file, "w") as f:
                process = subprocess.Popen(
                    ["uv", "run", "python3", "watchdog/el_watcher.py"],
                    cwd=SCRIPT_DIR,
                    env=env,
                    stdout=f,
                    stderr=subprocess.STDOUT,
                    preexec_fn=os.setsid,  # Create new process group
                )

            log_to_file(
                MAIN_LOG, f"✅ Started watcher for {machine} (PID: {process.pid})"
            )
            started_count += 1

        except Exception as e:
            log_to_file(WATCHER_LOG, f"Failed to start {machine} watcher: {e}", "ERROR")

        time.sleep(2)

    # Start processed watcher
    processed_log = LOG_DIR / "processed_watcher.log"
    try:
        with open(processed_log, "w") as f:
            process = subprocess.Popen(
                ["uv", "run", "python3", "watchdog/processed_watcher.py"],
                cwd=SCRIPT_DIR,
                stdout=f,
                stderr=subprocess.STDOUT,
                preexec_fn=os.setsid,
            )

        log_to_file(MAIN_LOG, f"✅ Started processed watcher (PID: {process.pid})")
        started_count += 1

    except Exception as e:
        log_to_file(WATCHER_LOG, f"Failed to start processed watcher: {e}", "ERROR")

    return started_count


def verify_watchers_running():
    """Verify that watchers are actually running"""
    log_to_file(MAIN_LOG, "Verifying watchers are running...")

    running_count = 0

    # Count UV el_watcher processes
    try:
        result = subprocess.run(
            "ps aux | grep 'uv run.*el_watcher' | grep -v grep | wc -l",
            shell=True,
            capture_output=True,
            text=True,
        )

        el_watcher_count = (
            int(result.stdout.strip()) if result.stdout.strip().isdigit() else 0
        )
        log_to_file(MAIN_LOG, f"📊 Found {el_watcher_count} el_watcher processes")

        if el_watcher_count >= 3:
            log_to_file(MAIN_LOG, "✅ All 3 el_watchers confirmed running")
            running_count += 3
        else:
            log_to_file(
                MAIN_LOG, f"❌ Only {el_watcher_count}/3 el_watchers running", "ERROR"
            )
            running_count += el_watcher_count

    except Exception as e:
        log_to_file(MAIN_LOG, f"❌ Failed to check el_watchers: {e}", "ERROR")

    # Check processed watcher
    try:
        result = subprocess.run(
            "ps aux | grep 'uv run.*processed_watcher' | grep -v grep | wc -l",
            shell=True,
            capture_output=True,
            text=True,
        )

        processed_count = (
            int(result.stdout.strip()) if result.stdout.strip().isdigit() else 0
        )

        if processed_count >= 1:
            log_to_file(MAIN_LOG, "✅ processed_watcher confirmed running")
            running_count += 1
        else:
            log_to_file(MAIN_LOG, "❌ processed_watcher NOT running", "ERROR")

    except Exception as e:
        log_to_file(MAIN_LOG, f"❌ Failed to check processed_watcher: {e}", "ERROR")

    log_to_file(
        MAIN_LOG, f"📊 VERIFICATION: {running_count}/4 watchers confirmed running"
    )

    if running_count < 4:
        log_to_file(MAIN_LOG, "🚨 NOT ALL WATCHERS RUNNING - CHECK LOGS", "CRITICAL")

        # Debug: Show what processes ARE running
        try:
            result = subprocess.run(
                "ps aux | grep 'uv run.*watcher' | grep -v grep",
                shell=True,
                capture_output=True,
                text=True,
            )
            log_to_file(MAIN_LOG, f"DEBUG: Watcher processes:\n{result.stdout}")
        except:
            pass

        return False

    return True


def restart_services():
    """Restart Docker services"""
    log_to_file(MAIN_LOG, "Restarting Docker services...")

    try:
        # Stop services
        subprocess.run("make down", shell=True, check=True, cwd=SCRIPT_DIR)
        time.sleep(5)

        # Start services
        subprocess.run("make dev", shell=True, check=True, cwd=SCRIPT_DIR)
        time.sleep(30)

        log_to_file(MAIN_LOG, "✅ Services restarted successfully")
        return True
    except subprocess.CalledProcessError as e:
        log_to_file(MAIN_LOG, f"Failed to restart services: {e}", "ERROR")
        return False


def main():
    """Main auto-updater logic"""
    log_to_file(MAIN_LOG, "=" * 60)
    log_to_file(MAIN_LOG, "🚀 AUTO-UPDATER STARTING")
    log_to_file(MAIN_LOG, f"Current user: {os.getenv('USER', 'unknown')}")
    log_to_file(MAIN_LOG, f"Working directory: {SCRIPT_DIR}")

    try:
        # Step 1: Check all mounts
        if not check_all_mounts():
            log_to_file(
                MAIN_LOG,
                "🚨 Mount issues detected - continuing with caution",
                "WARNING",
            )

        # Step 2: Create required directories
        create_required_directories()

        # Step 3: Check if config updates are needed
        config_updated = update_config_paths()

        # Step 4: Always check if watchers are running (regardless of config updates)
        log_to_file(MAIN_LOG, "Checking if watchers are running...")
        watchers_running = verify_watchers_running()

        # Step 5: Restart services only if config was updated
        if config_updated:
            if not restart_services():
                log_to_file(MAIN_LOG, "❌ Service restart failed", "ERROR")
                return

        # Step 6: Start watchers if not running (always check this)
        if not watchers_running:
            log_to_file(MAIN_LOG, "Watchers not running - starting them...")
            kill_old_watchers()
            started_count = start_watchers()

            # Verify they started
            time.sleep(15)
            if not verify_watchers_running():
                log_to_file(MAIN_LOG, "❌ Watcher verification failed", "ERROR")
        else:
            log_to_file(MAIN_LOG, "✅ All watchers already running")

        log_to_file(MAIN_LOG, "✅ AUTO-UPDATER COMPLETED SUCCESSFULLY")

    except Exception as e:
        log_to_file(MAIN_LOG, f"❌ Auto-updater failed: {e}", "ERROR")
        raise
    finally:
        log_to_file(MAIN_LOG, "=" * 60)


if __name__ == "__main__":
    main()
