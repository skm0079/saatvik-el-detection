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

1. 10.10.2.126 -> Production Line 2 :: Folder Name: ``
2. 10.10.
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

# Project Writeup

🔍 Saatvik EL Defect Detection System - Complete Project Overview
📋 Project Summary
Saatvik EL Defect Detection System is an AI-powered industrial automation solution that transforms manual solar panel quality control into an intelligent, automated process. The system integrates with existing manufacturing workflows to provide real-time defect detection using computer vision.

🏭 Business Context & Problem Statement
Current Manual Process

Solar panel production follows a multi-stage pipeline ending with EL (Electroluminescence) image capture
3 images captured: EL image (main focus), front visual, back visual
Manual inspection: Expert operator analyzes images on 3 monitors for 40-45 seconds
Decision making: Operator manually categorizes panels as "OK" (good) or "NG" (not good/defective)
Documentation: Manual notes on defect types and coordinates
Time per panel: 50+ seconds total (6-8s capture + 40-45s analysis)

Pain Points

Slow throughput: Manual analysis bottleneck
Human error: Subjective quality assessment
Inconsistency: Operator fatigue and skill variations
No automation: Manual button pressing for categorization
Limited analytics: No centralized defect tracking


🎯 Solution Architecture
System Overview
Windows Client (Existing)     →     Ubuntu Server (AI)     →     Web Interface (New)
┌─────────────────────┐       ┌─────────────────────┐       ┌─────────────────────┐
│ • EL Image Capture  │       │ • YOLO AI Detection │       │ • Analysis Results  │
│ • 3 Monitor Display │ ────→ │ • FastAPI Wrapper   │ ────→ │ • Search & Filter   │
│ • Manual Review     │       │ • PostgreSQL DB     │       │ • Pagination        │
│ • Network Storage   │       │ • Automated Process │       │ • Image Comparison  │
└─────────────────────┘       └─────────────────────┘       └─────────────────────┘
Core Components
1. AI Detection Engine

YOLOv8 Model: Custom-trained with best6.pt weights
Processing Time: ~4 seconds per image
FastAPI Wrapper: RESTful API endpoint /detect-defect
Confidence Threshold: Configurable (0.2-0.5)

2. Data Pipeline

File Watcher: Monitors SMB network shares for new images
Automated Processing: Triggers AI analysis on file detection
Result Storage: Processed images with annotations
Database Logging: Complete audit trail in PostgreSQL

3. Storage & Networking

SMB Mount: Network storage integration via Samba
Separate Environments: Dev, Staging, Production isolation
Backup Strategy: Automated data retention and cleanup


🛠 Technical Implementation
Technology Stack
yamlBackend:
  - Python 3.10
  - FastAPI (async web framework)
  - YOLOv8 (Ultralytics)
  - PostgreSQL 15 (database)
  - SQLModel (ORM)
  - Docker & Docker Compose

Infrastructure:
  - Ubuntu Server (AI processing)
  - SMB/Samba (network storage)
  - Watchdog (file monitoring)
  - Nginx (reverse proxy - future)

Frontend:
  - HTML/CSS/JavaScript (templating)
  - OR React (static served) - TBD
Project Structure
saatvik-el-detection/
├── app/
│   ├── api/endpoints/          # API routes
│   ├── core/                   # Configuration & database
│   ├── models/                 # Database schemas
│   └── services/               # Business logic (YOLO)
├── watchdog/                   # File monitoring scripts
├── models/                     # AI model weights
├── docker-compose.yml          # Development environment
├── docker-compose.staging.yml  # Staging environment
├── docker-compose.prod.yml     # Production environment
└── Makefile                    # Command shortcuts

🔄 Workflow Process
Automated Detection Pipeline

Image Capture: Windows client captures EL image
File Detection: Watchdog detects new image in network share
API Trigger: Automated POST to /detect-defect endpoint
AI Processing: YOLOv8 analyzes image for defects
Result Storage: Annotated image saved to processed folder
Database Entry: Complete metadata stored in PostgreSQL
Web Access: Results available via web interface

Data Flow
SMB Network Share → File Watcher → FastAPI → YOLO Model → Database
     ↓                                           ↓
New EL Image                              Annotated Result
     ↓                                           ↓
/mnt/shared/                            /processed/timestamp/

📊 Database Schema
Detection Records Table
sqldetection_records:
  - id (UUID, primary key)
  - original_filename (string)
  - el_folder_path (string)
  - total_defects (integer)
  - confidence_threshold (float)
  - processing_time_ms (integer)
  - annotated_image_path (string)
  - detection_details (JSON)
  - status (string)
  - created_at (timestamp)
  - file_size_bytes (integer)

🚀 Environment Management
Multi-Environment Setup
EnvironmentPurposePortDatabaseData FolderDevelopmentLocal development8000saatvik_el_db./source, ./processedStagingTesting & validation8001saatvik_el_db_staging./staging/*ProductionLive operations8002saatvik_el_db_prod./production/*
Deployment Commands
bash# Development (hot reload)
make up           # Start dev environment
make logs         # View logs
make down         # Stop environment

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


📞 Support & Handover
Technical Contacts

Project Lead: [Your Name] - System architecture and backend
AI/ML: YOLO model training and optimization
Infrastructure: Docker, database, and deployment

Resources

API Documentation: Available at /docs endpoint
Database Schema: In app/models/detection_record.py
Environment Configuration: See .env files and docker-compose
Deployment Guide: Makefile commands and Docker setup


This system transforms a 50+ second manual process into a 4-second automated analysis, providing consistent, accurate defect detection with complete audit trails and analytics capabilities.RetryClaude can make mistakes. Please double-check responses.
