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

sudo tail -f /var/log/syslog | grep auto_updater

### Docker Full Ceanup

```bash
docker system prune -a -f --volumes
```
sudo chown -R $USER:$USER saatvik-el-detection/

```bash 
docker volume inspect saatvik-el-detection_postgres_data
```

### IP List (as of 21-06-2025)

Kayword: TODO: Revert

1. 10.10.2.126 -> Pre eLLine 2 :: Folder Name: ``
2. 10.10.1.194 -> Desktop with Display
3. 10.10.2.1 -> Test Machine :: Folder Name : `/mnt/shared`

---

docker exec -it saatvik-el-db psql -U postgres -d saatvik_el_db

-- Drop table if exists
DROP TABLE IF EXISTS detection_records;

-- Create table with correct timezone columns
CREATE TABLE detection_records (
    id UUID PRIMARY KEY,
    original_filename VARCHAR NOT NULL,
    el_folder_path VARCHAR NOT NULL,
    source_file_path VARCHAR NOT NULL,
    total_defects INTEGER NOT NULL DEFAULT 0,
    confidence_threshold FLOAT NOT NULL,
    processing_time_ms INTEGER NOT NULL,
    annotated_image_path VARCHAR,
    json_results_path VARCHAR,
    thumbnail_path VARCHAR,
    file_size_bytes INTEGER NOT NULL,
    image_width INTEGER,
    image_height INTEGER,
    detection_details JSON,
    status VARCHAR NOT NULL DEFAULT 'completed',
    error_message VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    scheduled_deletion_date TIMESTAMP WITH TIME ZONE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE
);

-- Verify the table
\d detection_records

-- Exit
\q

---
Complete Development
# This starts everything in one command
make dev

# It will:
# 1. Start backend (API + DB) in Docker
# 2. Start frontend with hot reload
# Keep both terminals open


Option 2: Manual Control (Advanced)
# Terminal 1: Start backend
make dev-backend

# Terminal 2: Start frontend (hot reload)
make dev-frontend

# Edit frontend code → auto-refresh! 🔥
# Edit backend code → restart with: make stop-dev && make dev-backend


### Dev <-> Stage Run Checklist


🎯 Final Configuration Summary
Ports & Services
EnvironmentAPI PortDB PortContainer NamesDevelopment80005432saatvik-el-api, saatvik-el-dbStaging80015433saatvik-el-api-stage, saatvik-el-db-stageProduction80025434saatvik-el-api-prod, saatvik-el-db-prod
Data Folders

Dev: ./source, ./processed, ./backup, ./logs
Staging: ./staging/source, ./staging/processed, ./staging/backup, ./staging/logs
Production: ./production/source, ./production/processed, ./production/backup, ./production/logs

Commands (Your Requirements)
bash# Normal commands = Development
make up        # Start dev
make down      # Stop dev
make logs      # Dev logs

# Stage commands (with -stage suffix)
make up-stage     # Start staging
make down-stage   # Stop staging
make logs-stage   # Staging logs

# Production commands (with -prod suffix)
make up-prod      # Start production
make down-prod    # Stop production
make logs-prod    # Production logs
📋 Setup Steps

Create directories:

TODO: chmod & chown to current user & permission , especially write & modify

mkdir -p staging/{source,processed,backup,logs}
mkdir -p production/{source,processed,backup,logs}

Make Makefile executable:

bashchmod +x Makefile

Test all environments:

bashmake up           # Dev on 8000
make up-stage     # Staging on 8001
make up-prod      # Production on 8002
make status       # See all running


-----------------------

# 🔍 Saatvik EL Detection System - Complete Overview

## 🎯 **What This Application Does**

**Saatvik EL Detection** is an AI-powered industrial automation system that transforms manual solar panel quality control into an intelligent, automated pipeline. It detects defects in solar panel Electroluminescence (EL) images using computer vision.

---

## 🔄 **Complete End-to-End Workflow**

### **1. File Monitoring & Detection** 📁
```
Windows Production Line → SMB Network Share → Ubuntu Server (Watchdog)
```

**Process:**
- **EL Watcher** (`watchdog/el_watcher.py`) monitors `/mnt/shared/raw_el_images/`
- Uses **PollingObserver** (works with SMB network mounts)
- Detects new `.jpg/.png` files as they're captured from production line
- Maintains processed file hash list to avoid duplicates

**Configuration:**
```python
# Centralized config in constants/constants.py
WATCH_PATH = "/mnt/shared/raw_el_images"
EXCLUDED_FOLDERS = {"NG", "OK", "processed"}
API_ENDPOINT = "http://localhost:8000/api/v1/detect"
```

### **2. AI Processing Pipeline** 🤖
```
New Image Detected → API Call → YOLO Analysis → Results Storage
```

**Process:**
- Watchdog triggers API call to `/api/v1/detect/detect-defect`
- **FastAPI** receives image and metadata
- **YOLOv8 model** (`models/best_6.pt`) analyzes image for defects
- **Status tracking**: RECEIVED → PROCESSING → AI_COMPLETE → RESULTS_SAVED

**AI Detection:**
- **Model**: Custom-trained YOLOv8 for solar panel defects
- **Classes**: Cracks, hotspots, finger interruptions, etc.
- **Processing Time**: ~3-4 seconds per image
- **Confidence Threshold**: Configurable (0.2-0.5)

### **3. Database Recording** 📊
```
Detection Results → PostgreSQL → Status Tracking → Audit Trail
```

**Database Schema:**
```sql
detection_records:
- id (UUID)
- original_filename, el_folder_path
- total_defects, confidence_threshold
- processing_time_ms, file_size_bytes
- detection_details (JSON with defect coordinates)
- status (enum: received→processing→ai_complete→results_saved→saved)
- timestamps for each status transition
```

**Status Flow:**
1. **RECEIVED** - File uploaded, record created
2. **PROCESSING** - YOLO model running
3. **AI_COMPLETE** - Detection finished
4. **RESULTS_SAVED** - Files saved to processed folder
5. **CLIENT_NOTIFIED** - Viewer triggered
6. **SAVED** - Final completion

### **4. Result Storage & Organization** 💾
```
Processed Results → Timestamped Folders → Multiple Formats
```

**File Structure:**
```
processed/
├── 20250623_143022/
│   ├── annotated/          # Images with defect boxes drawn
│   ├── json/              # Detailed detection data
│   └── thumbnails/        # Small preview images
├── 20250623_143156/
└── ...
```

**Generated Files:**
- **Annotated Image**: Original with defect bounding boxes
- **JSON Results**: Detailed coordinates, confidence scores
- **Thumbnails**: 300x200 preview images

### **5. Client Notification & Viewing** 🖥️
```
Results Ready → Processed Watcher → SMB Copy → Client Trigger
```

**Process:**
- **Processed Watcher** (`watchdog/processed_watcher.py`) monitors `processed/` folder
- Detects new annotated images
- Copies to shared network location (`/mnt/shared/processed/`)
- Triggers Windows client to display results
- Updates database status to **SAVED**

**Client Integration:**
- **Network Path**: `\\10.10.1.4\shared\processed\image.jpg`
- **Trigger Methods**: HTTP API call, trigger file, SSH command
- **Multi-platform**: Windows/Linux client support

### **6. Web Interface & API** 🌐
```
Database Records → REST API → Frontend Dashboard
```

**API Endpoints:**
- `POST /detect/detect-defect` - Main processing endpoint
- `GET /detect/recent` - Recent detections with pagination
- `GET /detect/status/{id}` - Individual detection details
- `PUT /detect/status/{id}` - Update detection status
- `GET /health/detailed` - System health monitoring

---

## 🏗️ **System Architecture**

### **Technology Stack**
```yaml
Backend:
  - Python 3.10 + FastAPI (async web framework)
  - YOLOv8 (Ultralytics) for AI detection
  - PostgreSQL 15 (with timezone support)
  - SQLModel (async ORM)
  - Docker + Docker Compose

Infrastructure:
  - Ubuntu Server (AI processing)
  - SMB/Samba (network storage)
  - Watchdog (file monitoring)
  - Multi-environment (dev/staging/prod)

Frontend: (Planned)
  - React SPA or FastAPI templates
  - Real-time dashboard
  - Image comparison viewer
  - Search and filtering
```

### **Deployment Architecture**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Windows       │    │   Ubuntu        │    │   Web           │
│   Production    │    │   Server        │    │   Interface     │
│                 │    │                 │    │                 │
│ • EL Camera     │───▶│ • File Watcher  │───▶│ • Dashboard     │
│ • Image Capture │    │ • YOLO AI       │    │ • History       │
│ • SMB Share     │    │ • PostgreSQL    │    │ • Analytics     │
│ • 3 Monitors    │    │ • FastAPI       │    │ • Search        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
       │                         │                         │
       └─────────────────────────┼─────────────────────────┘
                                 │
                     ┌─────────────────┐
                     │   Network       │
                     │   Storage       │
                     │                 │
                     │ • SMB Shares    │
                     │ • Backup        │
                     │ • Archive       │
                     └─────────────────┘
```

---

## 🚀 **Performance Characteristics**

### **Current Performance**
- **Detection Speed**: 3-4 seconds per image
- **Throughput**: ~15-20 images per minute
- **Accuracy**: Custom-trained model for solar defects
- **Availability**: 99%+ with Docker restart policies

### **Scalability Features**
- **Multi-environment**: Dev/staging/prod isolation
- **Horizontal scaling**: Multiple workers possible
- **Database optimization**: Indexed queries, connection pooling
- **File cleanup**: Automated archival and cleanup

---

## 🎨 **Frontend Development Requirements**

### **Core Features Needed**
1. **Real-time Dashboard**
   - Live detection status
   - Processing queue
   - System health indicators
   - Performance metrics

2. **Detection History**
   - Paginated results (10-50 per page)
   - Search by filename, date range, defect count
   - Filter by status, confidence, folder path
   - Sort by processing time, defects, date

3. **Detail View**
   - Side-by-side image comparison (original vs annotated)
   - Interactive defect highlighting
   - Zoom and pan functionality
   - Metadata display (processing time, confidence, etc.)

4. **Analytics Dashboard**
   - Defect trends over time
   - Processing time statistics
   - System performance graphs
   - Quality control reports

### **API Integration Points**
```javascript
// Get recent detections
GET /api/v1/detect/recent?limit=20&offset=0&status=completed

// Get detection details
GET /api/v1/detect/status/{detection_id}

// System health
GET /api/v1/health/detailed

// Image serving
GET /processed/{timestamp}/annotated/{filename}
GET /processed/{timestamp}/thumbnails/{filename}
```

### **Key Frontend Data Structures**
```typescript
interface Detection {
  detection_id: string;
  original_filename: string;
  total_defects: number;
  status: 'received' | 'processing' | 'ai_complete' | 'results_saved' | 'saved';
  processing_time_ms: number;
  confidence_threshold: number;
  annotated_image_path: string;
  thumbnail_path: string;
  created_at: string;
  defects: Defect[];
}

interface Defect {
  class_name: string;
  confidence: number;
  bbox: {x: number, y: number, width: number, height: number};
  bbox_normalized: {x1: number, y1: number, x2: number, y2: number};
}
```

---

## 🔧 **Configuration Management**

### **Environment-Specific Settings**
```python
# constants/constants.py - Centralized configuration
ENVIRONMENT_CONFIG = {
    "dev": {
        "client_ip": "10.10.2.126",
        "shared_path": "/mnt/shared",
        "confidence_threshold": 0.2,
        "api_endpoint": "http://localhost:8000/api/v1/detect"
    },
    "staging": {
        "client_ip": "10.10.2.1",
        "shared_path": "/mnt/shared2/processed",
        "confidence_threshold": 0.3,
        "api_endpoint": "http://localhost:8001/api/v1/detect"
    },
    "prod": {
        "client_ip": "10.10.2.1",
        "shared_path": "/mnt/shared",
        "confidence_threshold": 0.5,
        "api_endpoint": "http://localhost:8002/api/v1/detect"
    }
}
```

### **Multi-Environment Deployment**
```bash
# Development (port 8000)
make up

# Staging (port 8001) 
make up-stage

# Production (port 8002)
make up-prod

# All can run simultaneously without conflicts
```

---

## 📊 **Business Impact**

### **Before (Manual Process)**
- **Time per panel**: 50+ seconds (8s capture + 40s analysis)
- **Human error**: Subjective quality assessment
- **Inconsistency**: Operator fatigue variations
- **No analytics**: Limited defect tracking

### **After (Automated Process)**
- **Time per panel**: 10-15 seconds (8s capture + 3s AI analysis)
- **Consistency**: Standardized AI detection
- **Analytics**: Complete defect history and trends
- **Audit trail**: Full processing documentation

### **ROI Calculation**
- **Time savings**: 70% reduction in analysis time
- **Quality improvement**: Consistent defect detection
- **Data insights**: Trend analysis for process improvement
- **Scalability**: Can handle multiple production lines

---

## 🎯 **System Status**

### **✅ Currently Working**
- End-to-end image processing pipeline
- AI defect detection with YOLO
- Database recording with status tracking
- Multi-environment deployment
- File watching and client notification
- REST API with comprehensive endpoints

### **🚧 In Development**
- Frontend web interface
- Advanced analytics dashboard
- Real-time status monitoring
- User authentication system

### **📋 Future Enhancements**
- Model versioning and A/B testing
- Advanced reporting and exports
- Integration with quality management systems
- Mobile application for field inspection

**This system transforms manual solar panel QC into an intelligent, automated, and scalable solution with complete audit trails and analytics capabilities.**

# Staging (production-like testing)
make up-stage     # Start staging
make logs-stage   # View staging logs
make down-stage   # Stop staging

# Production (optimized)
make up-prod      # Start production
make logs-prod    # View production logs
make down-prod    # Stop production

📡 API Endpoints
Core Detection API
httpPOST /api/v1/detect/detect-defect
Content-Type: multipart/form-data

Parameters:
- file: Image file (JPG/PNG)
- el_folder_path: Source folder path
- confidence: Detection threshold (0.0-1.0)

Response:
{
  "detection_id": "uuid",
  "status": "completed",
  "total_defects": 3,
  "processing_time_ms": 4200,
  "defects": [...],
  "results": {
    "annotated_image_path": "...",
    "json_results_path": "..."
  }
}
Query & Management APIs
httpGET /api/v1/detect/recent          # Recent detections
GET /api/v1/detect/status/{id}     # Detection status
GET /api/v1/health                 # System health
GET /api/v1/health/detailed        # Detailed diagnostics



# 2. Start backend services
make up

# 3. Verify API is running
curl http://localhost:8000/api/v1/health

# 4. Access API documentation
# Visit: http://localhost:8000/docs
API Testing
bash# Test detection endpoint
curl -X POST "http://localhost:8000/api/v1/detect/detect-defect" \
  -F "file=@test_image.jpg" \
  -F "confidence=0.3"

# Get recent detections
curl http://localhost:8000/api/v1/detect/recent
Key Integration Points

API Base URL: http://localhost:8000/api/v1
Image Assets: Served from /processed directory
Real-time Updates: Consider WebSocket for live detection status
Error Handling: Proper API error response handling

Resources

API Documentation: Available at /docs endpoint
Database Schema: In app/models/detection_record.py
Environment Configuration: See .env files and docker-compose
Deployment Guide: Makefile commands and Docker setup


This system transforms a 50+ second manual process into a 4-second automated analysis, providing consistent, accurate defect detection with complete audit trails and analytics capabilities.RetryClaude can make mistakes. Please double-check responses.


------------

cd /home/administrator/Documents/defect_detection/saatvik-el-detection

# For Test Machine
MACHINE="Test Machine" uv run watchdog/el_watcher.py

# For Factory Line 2  
MACHINE="Factory Line 2" uv run watchdog/el_watcher.py

# For Factory Line 1
MACHINE="Factory Line 1" uv run watchdog/el_watcher.py

OR Background Run

# Test Machine
MACHINE="Test Machine" nohup uv run watchdog/el_watcher.py > el_watcher_test.log 2>&1 &

# Factory Line 2
MACHINE="Factory Line 2" nohup uv run watchdog/el_watcher.py > el_watcher_line2.log 2>&1 &

# Factory Line 1  
MACHINE="Factory Line 1" nohup uv run watchdog/el_watcher.py > el_watcher_line1.log 2>&1 &

current_machine = os.getenv("MACHINE", config.get("current_machine", "Test Machine"))