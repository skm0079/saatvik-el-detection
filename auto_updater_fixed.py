#!/usr/bin/env python3
import json, os, subprocess, time
from datetime import datetime, timedelta
from pathlib import Path

# Your shift config (unchanged)
MACHINES_SHIFT_CONFIG = {
    "Test Machine": {"base_path": "/mnt/shared", "shifts": {"Morning Shift": {"start": 6, "end": 18, "minutes": 50}, "Night Shift": {"start": 18, "end": 6, "minutes": 50}}},
    "Factory Line 2": {"base_path": "/mnt/shared2", "shifts": {"Morning Shift": {"start": 7, "end": 19, "minutes": 0}, "Night Shift": {"start": 19, "end": 7, "minutes": 0}}},
    "Factory Line 1": {"base_path": "/mnt/shared3/21-12-24/el", "shifts": {"Morning Shift": {"start": 7, "end": 19, "minutes": 0}, "Night Shift": {"start": 19, "end": 7, "minutes": 0}}}
}

def log(msg): print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}")

def get_shift_info(machine_name):
    now = datetime.now()
    if machine_name not in MACHINES_SHIFT_CONFIG: return "Unknown", ""
    
    shifts = MACHINES_SHIFT_CONFIG[machine_name]["shifts"]
    current_time_mins = now.hour * 60 + now.minute
    
    for shift_name, times in shifts.items():
        start_mins = times["start"] * 60 + times["minutes"]
        end_mins = times["end"] * 60 + times["minutes"]
        
        if start_mins > end_mins:  # Night shift
            if current_time_mins >= start_mins or current_time_mins < end_mins:
                date_str = (now - timedelta(days=1)).strftime("%Y-%m-%d") if now.hour < 7 else now.strftime("%Y-%m-%d")
                return shift_name, f"{MACHINES_SHIFT_CONFIG[machine_name]['base_path']}/{date_str}/{shift_name}"
        else:  # Day shift
            if start_mins <= current_time_mins < end_mins:
                return shift_name, f"{MACHINES_SHIFT_CONFIG[machine_name]['base_path']}/{now.strftime('%Y-%m-%d')}/{shift_name}"
    
    return list(shifts.keys())[0], ""

def main():
    log("🚀 AUTO-UPDATER STARTING")
    
    # Load config
    with open("shared_config.json", "r") as f:
        config = json.load(f)
    
    machines = config["modes"]["dev"]["machines"]
    updates = []
    
    # Check updates needed
    for machine_id, machine_config in machines.items():
        current = machine_config["smb_watch_path"]
        shift, expected = get_shift_info(machine_id)
        
        log(f"{machine_id}: {current} → {expected}")
        
        if current != expected and expected:
            updates.append({"machine_id": machine_id, "old": current, "new": expected})
            machine_config["smb_watch_path"] = expected
    
    if not updates:
        log("✅ All up to date")
        return
    
    # Save config
    with open("shared_config.json", "w") as f:
        json.dump(config, f, indent=2)
    
    log(f"✅ Updated {len(updates)} machines")
    
    # Restart services (SIMPLE)
    log("🔄 Restarting services...")
    subprocess.run("make down", shell=True, check=True)
    time.sleep(5)
    subprocess.run("make dev", shell=True, check=True)
    time.sleep(30)
    
    # Start watchers (SIMPLE - no complex sudo chains)
    log("🔄 Starting watchers...")
    subprocess.run("pkill -f watcher", shell=True)  # Kill old
    time.sleep(2)
    
    # Start simple
    for machine in ["Test Machine", "Factory Line 1", "Factory Line 2"]:
        cmd = f"MACHINE='{machine}' nohup python3 watchdog/el_watcher.py > /tmp/{machine.replace(' ', '_').lower()}.log 2>&1 &"
        subprocess.run(cmd, shell=True)
        time.sleep(1)
    
    subprocess.run("nohup python3 watchdog/processed_watcher.py > /tmp/processed_watcher.log 2>&1 &", shell=True)
    
    log("✅ DONE")

if __name__ == "__main__":
    main()
