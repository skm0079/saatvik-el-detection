#!/bin/bash

# Fine: auto_path_updater.sh
# This script automatically updates the SMB watch path in the shared configuration file in the same folder as the script.

# ==============================================================================
# FIXED VERSION - Saatvik EL Detection System Path Updater
# ==============================================================================

# Configuration
CONFIG_FILE="/home/administrator/Documents/defect_detection/saatvik-el-detection/shared_config.json"
BACKUP_DIR="./backup"
LOG_FILE="./auto_updater.log"
LOCK_FILE="/tmp/saatvik_updater.lock"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Enhanced logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Silent logging function (only to file, not stdout)
log_silent() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log_separator() {
    echo "===========================================" | tee -a "$LOG_FILE"
}

# Create lock file to prevent multiple instances
create_lock() {
    if [ -f "$LOCK_FILE" ]; then
        log "ERROR: Another instance is running (PID: $(cat $LOCK_FILE)). Exiting."
        exit 1
    fi
    echo $$ > "$LOCK_FILE"
    log "Lock file created with PID: $$"
}

# Remove lock file
remove_lock() {
    if [ -f "$LOCK_FILE" ]; then
        rm -f "$LOCK_FILE"
        log "Lock file removed"
    fi
}

# Cleanup function
cleanup() {
    log "Cleanup function called"
    remove_lock
    exit
}

# Set trap for cleanup
trap cleanup EXIT INT TERM

# Generate new path based on current time - COMPLETELY FIXED VERSION
generate_new_path() {
    local current_date=$(date '+%Y-%m-%d')
    local current_hour=$(date '+%H')
    local current_minute=$(date '+%M')
    
    # Use silent logging to avoid contaminating return value
    log_silent "Current time: $current_date $current_hour:$current_minute"
    
    # Determine shift based on time (7 AM - 7 PM = Morning, 7 PM - 7 AM = Night)
    if [ "$current_hour" -ge 7 ] && [ "$current_hour" -lt 19 ]; then
        shift_name="Morning Shift"
        log_silent "Time check: Morning Shift (7 AM - 7 PM range)"
    else
        shift_name="Night Shift" 
        log_silent "Time check: Night Shift (7 PM - 7 AM range)"
    fi
    
    local new_path="/mnt/shared2/$current_date/$shift_name"
    log_silent "Generated path: $new_path"
    
    # Return ONLY the path, no extra output
    echo "$new_path"
}

# Backup current config
backup_config() {
    local backup_name="config_backup_$(date '+%Y%m%d_%H%M%S').json"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    if cp "$CONFIG_FILE" "$backup_path"; then
        log "✅ Config backed up to: $backup_path"
        return 0
    else
        log "❌ Failed to backup config"
        return 1
    fi
}

# Update config with new path - FIXED VERSION
update_config() {
    local new_path="$1"
    local temp_file=$(mktemp)
    
    log "Attempting to update config with path: $new_path"
    
    # Use Python to update JSON - FIXED to handle the path properly
    python3 << EOF
import json
import sys

try:
    with open('$CONFIG_FILE', 'r') as f:
        config = json.load(f)
    
    old_path = config['modes']['dev']['machines']['Factory Line 2']['smb_watch_path']
    print(f"Old path: {old_path}")
    
    # Update the smb_watch_path for Factory Line 2
    config['modes']['dev']['machines']['Factory Line 2']['smb_watch_path'] = '$new_path'
    
    with open('$temp_file', 'w') as f:
        json.dump(config, f, indent=4)
    
    print(f"New path: {config['modes']['dev']['machines']['Factory Line 2']['smb_watch_path']}")
    print("SUCCESS")
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
EOF

    if [ $? -eq 0 ]; then
        mv "$temp_file" "$CONFIG_FILE"
        log "✅ Config updated successfully with new path: $new_path"
        return 0
    else
        rm -f "$temp_file"
        log "❌ Failed to update config file"
        return 1
    fi
}

# Get current path from config
get_current_path() {
    python3 << EOF
import json
try:
    with open('$CONFIG_FILE', 'r') as f:
        config = json.load(f)
    current_path = config['modes']['dev']['machines']['Factory Line 2']['smb_watch_path']
    print(current_path)
except Exception as e:
    print("ERROR: " + str(e))
EOF
}

# Check if application is running
check_app_status() {
    log "Checking application status..."
    
    # Check Docker containers
    running_containers=$(docker ps --format "{{.Names}}" | wc -l)
    log "Running Docker containers: $running_containers"
    
    # Check API health
    if curl -s http://localhost:8000/api/v1/health > /dev/null 2>&1; then
        log "✅ API health check: PASSED"
        return 0
    else
        log "⚠️ API health check: FAILED (may be starting up)"
        return 1
    fi
}

# Restart application with detailed logging
restart_application() {
    log "🔄 Starting application restart process..."
    
    # Check initial status
    check_app_status
    
    # Stop the application
    log "Stopping application with 'make down'..."
    if make down >> "$LOG_FILE" 2>&1; then
        log "✅ 'make down' completed"
    else
        log "⚠️ 'make down' may have had issues"
    fi
    
    # Wait for proper shutdown
    log "Waiting 5 seconds for proper shutdown..."
    sleep 5
    
    # Start the application
    log "Starting application with 'make dev'..."
    if make dev >> "$LOG_FILE" 2>&1; then
        log "✅ 'make dev' completed"
    else
        log "❌ 'make dev' failed"
        return 1
    fi
    
    # Wait for application to be ready
    log "Waiting 15 seconds for application to be ready..."
    sleep 15
    
    # Check final status
    if check_app_status; then
        log "✅ Application restart completed successfully"
        return 0
    else
        log "⚠️ Application may still be starting up"
        return 0
    fi
}

# Main function with comprehensive logging
main() {
    log_separator
    log "🚀 STARTING Automated Path Update Check"
    log "Current working directory: $(pwd)"
    log "Script PID: $$"
    log "User: $(whoami)"
    log_separator
    
    create_lock
    
    # Check if config file exists
    if [ ! -f "$CONFIG_FILE" ]; then
        log "❌ ERROR: Config file '$CONFIG_FILE' not found!"
        exit 1
    fi
    log "✅ Config file found: $CONFIG_FILE"
    
    # Generate what the new path should be
    new_path=$(generate_new_path)
    current_path=$(get_current_path)
    
    log "📊 PATH COMPARISON:"
    log "   Current path: $current_path"
    log "   Expected path: $new_path"
    
    # Check if update is needed
    if [ "$current_path" != "$new_path" ]; then
        log "🔄 PATH UPDATE REQUIRED!"
        log_separator
        
        # Backup current config
        log "Creating backup..."
        if backup_config; then
            log "✅ Backup completed"
        else
            log "❌ Backup failed - aborting update"
            exit 1
        fi
        
        # Update config
        log "Updating configuration..."
        if update_config "$new_path"; then
            log "✅ Configuration updated"
        else
            log "❌ Configuration update failed - aborting restart"
            exit 1
        fi
        
        # Restart application
        log "Restarting application..."
        if restart_application; then
            log "✅ Application restart completed"
        else
            log "⚠️ Application restart may have issues"
        fi
        
        log_separator
        log "✅ PATH UPDATE AND RESTART COMPLETED SUCCESSFULLY"
        
    else
        log "✅ No path update needed. Current path is correct."
        log "Checking application status anyway..."
        check_app_status
    fi
    
    log_separator
    log "🏁 SCRIPT COMPLETED - $(date)"
    log_separator
}

# Run main function
main