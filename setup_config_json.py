#!/usr/bin/env python3

"""
setup_config_json.py - Configuration Generator for Saatvik EL Detection System

This script generates and updates the shared_config.json file with proper machine configurations.
Run this once to set up your machines, then auto_updater.py will handle the rest.

3 Machines Configuration:
- Test Machine: 6:50 AM to 6:50 PM (default shift names)
- Factory Line 2: 7:00 AM to 7:00 PM (Morning Shift/Night Shift)
- Factory Line 1: 7:00 AM to 7:00 PM (X/Y shift names)
"""

import json
import datetime
from pathlib import Path

# ==============================================================================
# MACHINE & SHIFT CONFIGURATION
# ==============================================================================

# Project configuration
PROJECT_DIR = "/home/administrator/Documents/defect_detection/saatvik-el-detection"
CONFIG_FILE = "shared_config.json"

# Machine configurations - 3 MACHINES WITH DIFFERENT SHIFT NAMES
MACHINES = {
    "Test Machine": {
        "machine_id": "IT Office Machine",
        "machine_name": "IT Office Machine",
        "smb_source_path": "/mnt/shared",
        "smb_processed_path": "/mnt/shared/processed",
        "client_ip": "10.10.2.1",
        "client_os": "windows",
        "shift_config": {
            "Morning Shift": {
                "start": 6,
                "end": 18,
                "minutes": 50,
            },  # 6:50 AM to 6:50 PM
            "Night Shift": {"start": 18, "end": 6, "minutes": 50},  # 6:50 PM to 6:50 AM
        },
    },
    "Factory Line 2": {
        "machine_id": "Factory Line 2",
        "machine_name": "Factory Line 2",
        "smb_source_path": "/mnt/shared2",
        "smb_processed_path": "/mnt/shared1/processed",
        "client_ip": "10.10.1.194",
        "client_os": "windows",
        "shift_config": {
            "Morning Shift": {
                "start": 7,
                "end": 19,
                "minutes": 0,
            },  # 7:00 AM to 7:00 PM
            "Night Shift": {"start": 19, "end": 7, "minutes": 0},  # 7:00 PM to 7:00 AM
        },
    },
    "Factory Line 1": {
        "machine_id": "Factory Line 1",
        "machine_name": "Factory Line 1",
        "smb_source_path": "/mnt/shared3",
        "smb_processed_path": "/mnt/shared1/processed",
        "client_ip": "10.10.1.193",
        "client_os": "windows",
        "shift_config": {
            "X": {"start": 7, "end": 19, "minutes": 0},  # 7:00 AM to 7:00 PM (called X)
            "Y": {"start": 19, "end": 7, "minutes": 0},  # 7:00 PM to 7:00 AM (called Y)
        },
    },
}

# ==============================================================================
# HELPER FUNCTIONS
# ==============================================================================


def get_current_shift_for_machine(machine_name, current_hour, current_minute):
    """Get current shift for a specific machine based on its shift times"""

    if machine_name not in MACHINES:
        return None

    machine = MACHINES[machine_name]
    shift_config = machine["shift_config"]

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


def generate_watch_path(machine_name, date_str, shift_name):
    """Generate smb_watch_path for a machine"""
    base_path = MACHINES[machine_name]["smb_source_path"]
    return f"{base_path}/{date_str}/{shift_name}"


def create_machine_config(machine_name):
    """Create JSON config for a machine with current path"""

    machine = MACHINES[machine_name]

    # Generate current path
    now = datetime.datetime.now()
    date_str = now.strftime("%Y-%m-%d")
    current_shift = get_current_shift_for_machine(machine_name, now.hour, now.minute)
    current_path = generate_watch_path(machine_name, date_str, current_shift)

    # Return machine config for JSON
    return {
        "machine_id": machine["machine_id"],
        "machine_name": machine["machine_name"],
        "smb_source_path": machine["smb_source_path"],
        "smb_watch_path": current_path,
        "smb_processed_path": machine["smb_processed_path"],
        "client_ip": machine["client_ip"],
        "client_os": machine["client_os"],
    }


# ==============================================================================
# MAIN FUNCTIONS
# ==============================================================================


def load_existing_config():
    """Load existing shared_config.json or create template"""

    config_path = Path(PROJECT_DIR) / CONFIG_FILE

    if config_path.exists():
        print(f"📖 Loading existing config: {config_path}")
        with open(config_path, "r") as f:
            return json.load(f)
    else:
        print(f"📝 Creating new config template")
        # Create basic template
        return {
            "current_mode": "dev",
            "current_machine": "Factory Line 2",
            "modes": {
                "dev": {
                    "database_name": "saatvik_el_db_dev",
                    "api_base": "http://localhost:8000",
                    "api_endpoint": "http://localhost:8000/api/v1/detect",
                    "confidence_threshold": 0.2,
                    "excluded_folders": ["NG", "OK", "processed"],
                    "machines": {},
                }
            },
        }


def update_config_with_machines(config):
    """Update config with all machines from MACHINES dictionary"""

    machines_section = config["modes"]["dev"]["machines"]

    print(f"🔧 Updating machines configuration...")

    # Add or update each machine
    for machine_name in MACHINES.keys():
        print(f"   → {machine_name}")
        machines_section[machine_name] = create_machine_config(machine_name)

    # Remove any machines not in our MACHINES dict
    current_machines = list(machines_section.keys())
    for machine_name in current_machines:
        if machine_name not in MACHINES:
            print(f"   ❌ Removing old machine: {machine_name}")
            del machines_section[machine_name]

    return config


def save_config(config):
    """Save config to shared_config.json"""

    config_path = Path(PROJECT_DIR) / CONFIG_FILE

    # Ensure project directory exists
    Path(PROJECT_DIR).mkdir(parents=True, exist_ok=True)

    # Write config with nice formatting
    with open(config_path, "w") as f:
        json.dump(config, f, indent=4)

    print(f"✅ Config saved to: {config_path}")


def show_config_summary():
    """Show summary of current configuration"""

    print("\n" + "=" * 60)
    print("📊 CONFIGURATION SUMMARY")
    print("=" * 60)

    now = datetime.datetime.now()

    print(f"🕐 Current time: {now.strftime('%Y-%m-%d %H:%M')}")
    print(f"📁 Project directory: {PROJECT_DIR}")
    print(f"📄 Config file: {CONFIG_FILE}")
    print()

    print("🏭 MACHINES:")
    for machine_name, machine in MACHINES.items():
        current_shift = get_current_shift_for_machine(
            machine_name, now.hour, now.minute
        )
        shift_config = machine["shift_config"]

        print(f"   {machine_name}:")
        print(f"     Current shift: {current_shift}")
        print(f"     Source path: {machine['smb_source_path']}")
        print(f"     IP: {machine['client_ip']}")

        # Show shift times
        for shift_name, times in shift_config.items():
            start_time = f"{times['start']:02d}:{times['minutes']:02d}"
            end_time = f"{times['end']:02d}:{times['minutes']:02d}"
            if times["start"] > times["end"]:  # Crosses midnight
                print(f"     {shift_name}: {start_time} - {end_time} (next day)")
            else:
                print(f"     {shift_name}: {start_time} - {end_time}")
        print()


def main():
    """Main function to generate/update shared_config.json"""

    print("🚀 Saatvik EL Detection - Config Generator (3 Machines)")
    print("=" * 60)

    try:
        # Load existing config or create new
        config = load_existing_config()

        # Update with current machines
        config = update_config_with_machines(config)

        # Save updated config
        save_config(config)

        # Show summary
        show_config_summary()

        print("✅ Configuration setup complete!")
        print()
        print("📋 NEXT STEPS:")
        print("   1. Review the generated shared_config.json")
        print("   2. Run auto_updater.py to test path updates")
        print("   3. Set up cron job for auto_updater.py")
        print()

    except Exception as e:
        print(f"❌ Error: {e}")
        return False

    return True


if __name__ == "__main__":
    main()
