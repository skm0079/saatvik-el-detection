# ========================================
# LEARNING SUMMARY FOR TOMORROW:
# ========================================
"""
KEY LEARNINGS:

1. FastAPI Route Order Matters:
   - Routes are matched in the order they're declared
   - app.mount("/", ...) creates a catch-all that intercepts everything
   - Always include API routes BEFORE mounting static files at root

2. Proper Mounting Strategy:
   - API routes first: app.include_router(api_router, prefix="/api/v1")
   - Specific static mounts: app.mount("/processed", StaticFiles(...))
   - Root static mount LAST: app.mount("/", StaticFiles(...))

3. SPA + API Integration:
   - SPAs need catch-all routing for client-side navigation
   - But this conflicts with API routes if mounted incorrectly
   - Solution: Custom StaticFiles class that excludes /api/ paths

4. Docker Development:
   - Code changes need proper volume mounting to reflect in container
   - Static file builds persist in containers even after code changes
   - Always test API endpoints separately from frontend

5. Debugging Steps:
   - Test API endpoints directly: curl http://localhost:8000/api/v1/health
   - Check what files exist: ls app/static/
   - Verify route order in main.py
   - Remove static files temporarily to isolate issues

PRODUCTION DEPLOYMENT:
- Build React app: npm run build (outputs to app/static/)
- FastAPI serves both API and static files on same port
- No separate web server needed (nginx optional for scaling)
"""

----------------------------------------------------------------------------------------------------------------------------------------------------

🏭 Saatvik EL Detection System - IT Team Manual

📋 Table of Contents

System Overview
Architecture
Installation & Setup
Configuration
Running Multiple Machines
Monitoring & Maintenance
Troubleshooting
One-Script Solution


🎯 System Overview
Saatvik EL Detection System is an AI-powered solar panel defect detection system that:

Monitors SMB network folders for new EL images
Processes images through YOLO AI model
Stores results in database with machine context
Provides web interface for viewing results
Supports multiple production lines simultaneously

Key Components:

Backend: FastAPI + PostgreSQL + YOLO AI
Watchdogs: File monitoring services
Frontend: React web interface
SMB Integration: Network folder monitoring


🏗️ Architecture
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Machine 1     │───▶│   Watchdog 1    │───▶│                 │
│ SMB: /shared1   │    │ (File Monitor)  │    │                 │
└─────────────────┘    └─────────────────┘    │                 │
                                              │   FastAPI       │
┌─────────────────┐    ┌─────────────────┐    │ (AI Processing) │
│   Machine 2     │───▶│   Watchdog 2    │───▶│                 │
│ SMB: /shared2   │    │ (File Monitor)  │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                       │                       │
         │                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Windows       │◀───│   Processed     │    │   PostgreSQL    │
│   Clients       │    │   Watcher       │    │   Database      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        ▲
                                                        │
                                              ┌─────────────────┐
                                              │   React         │
                                              │   Frontend      │
                                              └─────────────────┘




🛠️ Installation & Setup
Prerequisites:
bash# Required software
- Docker & Docker Compose
- Python 3.10+
- uv (Python package manager)
- Node.js 18+ (for frontend development)

```json
{
    "current_mode": "dev",
    "current_machine": "Factory Line 1",
    "modes": {
        "dev": {
            "database_name": "saatvik_el_db_dev",
            "api_base": "http://localhost:8000",
            "api_endpoint": "http://localhost:8000/api/v1/detect",
            "confidence_threshold": 0.2,
            "excluded_folders": ["NG", "OK", "processed"],
            "machines": {
                "Factory Line 1": {
                    "machine_id": "Factory Line 1",
                    "machine_name": "Factory Line 1",
                    "smb_source_path": "/mnt/shared",
                    "smb_watch_path": "/mnt/shared/raw_el_images",
                    "smb_processed_path": "/mnt/shared/processed",
                    "client_ip": "10.10.2.126",
                    "client_os": "windows"
                },
                "Factory Line 2": {
                    "machine_id": "Factory Line 2", 
                    "machine_name": "Factory Line 2",
                    "smb_source_path": "/mnt/shared2",
                    "smb_watch_path": "/mnt/shared2/raw_el_images",
                    "smb_processed_path": "/mnt/shared2/processed",
                    "client_ip": "10.10.2.127",
                    "client_os": "windows"
                }
            }
        },
        "staging": {
            "database_name": "saatvik_el_db_staging",
            "api_base": "http://localhost:8001",
            "api_endpoint": "http://localhost:8001/api/v1/detect",
            "confidence_threshold": 0.3,
            "excluded_folders": ["NG", "OK", "processed"],
            "machines": {
                "Pre EL Machine 1": {
                    "machine_id": "Pre EL Machine 1",
                    "machine_name": "Pre EL Machine 1", 
                    "smb_source_path": "/mnt/shared/staging",
                    "smb_watch_path": "/mnt/shared/staging/raw_el_images",
                    "smb_processed_path": "/mnt/shared/staging/processed",
                    "client_ip": "10.10.2.1",
                    "client_os": "windows"
                }
            }
        },
        "prod": {
            "database_name": "saatvik_el_db_prod",
            "api_base": "http://localhost:8002", 
            "api_endpoint": "http://localhost:8002/api/v1/detect",
            "confidence_threshold": 0.5,
            "excluded_folders": ["NG", "OK", "processed"],
            "machines": {
                "Production Line 1": {
                    "machine_id": "Production Line 1",
                    "machine_name": "Production Line 1",
                    "smb_source_path": "/mnt/prod1",
                    "smb_watch_path": "/mnt/prod1/raw_el_images", 
                    "smb_processed_path": "/mnt/prod1/processed",
                    "client_ip": "10.10.1.100",
                    "client_os": "windows"
                },
                "Production Line 2": {
                    "machine_id": "Production Line 2",
                    "machine_name": "Production Line 2",
                    "smb_source_path": "/mnt/prod2",
                    "smb_watch_path": "/mnt/prod2/raw_el_images",
                    "smb_processed_path": "/mnt/prod2/processed", 
                    "client_ip": "10.10.1.101",
                    "client_os": "windows"
                }
            }
        }
    }
}
```

Configuration Parameters:
ParameterDescriptionExamplecurrent_modeEnvironment: dev/staging/prod"dev"current_machineDefault machine for this server"Factory Line 1"machine_idUnique identifier for machine"Factory Line 1"smb_watch_pathFolder to monitor for new images"/mnt/shared/raw_el_images"smb_processed_pathOutput folder for results"/mnt/shared/processed"client_ipWindows client IP for notifications"10.10.2.126"confidence_thresholdAI detection sensitivity (0.0-1.0)0.2

🚀 Running Multiple Machines
Method 1: Manual Terminal Commands
bash# Terminal 1: Start Backend (ONE instance only)
make up

# Terminal 2: Machine 1 Watchdog  
MACHINE="Factory Line 1" uv run watchdog/el_watcher.py

# Terminal 3: Machine 2 Watchdog
MACHINE="Factory Line 2" uv run watchdog/el_watcher.py

# Terminal 4: Processed Images Watcher
uv run watchdog/processed_watcher.py



-----------

# Set nano as permanent default editor for root
sudo bash -c 'echo "export EDITOR=nano" >> /root/.bashrc'
sudo bash -c 'echo "export VISUAL=nano" >> /root/.bashrc'

# Set for current user too
echo "export EDITOR=nano" >> ~/.bashrc
echo "export VISUAL=nano" >> ~/.bashrc

# Apply immediately
export EDITOR=nano
export VISUAL=nano

# Test cron editing now
crontab -e

# 1. Fix crontab editor permanently
sudo bash -c 'echo "export EDITOR=nano" >> /root/.bashrc'
echo "export EDITOR=nano" >> ~/.bashrc
export EDITOR=nano

# 2. Go to project directory
cd /home/administrator/Documents/defect_detection/saatvik-el-detection

# 3. Create setup script
nano setup_config_json.py
# Copy content from first artifact above

# 4. Create auto-updater script
nano auto_updater.py
# Copy content from second artifact above

# 5. Make executable and fix permissions
chmod +x *.py
sudo chown -R administrator:administrator .
sudo chmod +x Makefile

# 6. Generate initial configuration
python3 setup_config_json.py

# 7. Test auto-updater
python3 auto_updater.py

# 8. Set up cron job
crontab -e
# Add this line:
*/10 * * * * cd /home/administrator/Documents/defect_detection/saatvik-el-detection && python3 auto_updater.py >> cron.log 2>&1

# 9. Verify cron job
crontab -l