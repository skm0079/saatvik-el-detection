# 🌟 Saatvik EL Detection System
## Features Documentation & UI Components

![Version](https://img.shields.io/badge/Version-1.0.0-blue) ![Status](https://img.shields.io/badge/Status-Production%20Ready-green) ![UI](https://img.shields.io/badge/UI-React-purple)

---

## 📋 Table of Contents
- [🎯 Current Features](#-current-features)
- [🎨 UI Components](#-ui-components)
- [🔧 Technical Implementation](#-technical-implementation)
- [📱 Web Interface Pages](#-web-interface-pages)
- [⚙️ Configuration System](#️-configuration-system)
- [🔍 Data Flow](#-data-flow)

---

## 🎯 Current Features

### 🤖 AI Detection Engine
```yaml
YOLO Integration:
  ✅ YOLO model (best_6.pt) for defect detection
  ✅ Confidence threshold configuration (0.2-0.5)
  ✅ Image format support (JPG, JPEG, PNG)
  ✅ Real-time processing with FastAPI
  ✅ Grid cell mapping (6×24 layout)
  ✅ Defect coordinate tracking

Processing Capabilities:
  ✅ Automatic image preprocessing
  ✅ Bounding box detection
  ✅ Grid cell assignment (A1-F24)
  ✅ Confidence scoring
  ✅ Result annotation overlay
  ✅ Thumbnail generation
```

### 🏭 Multi-Machine Support
```yaml
Machine Configuration:
  ✅ Test Machine (IT Office - 6:50AM-6:50PM shifts)
  ✅ Factory Line 1 (X/Y shifts - 7:00AM-7:00PM)
  ✅ Factory Line 2 (Morning/Night - 7:00AM-7:00PM)
  ✅ Independent SMB path monitoring
  ✅ Machine-specific configuration

Environment Support:
  ✅ Development environment (port 8000)
  ✅ Staging environment (port 8001)
  ✅ Production environment (port 8002)
  ✅ Separate PostgreSQL databases per environment
```

### 🕐 Shift Management System
```yaml
Automatic Path Updates:
  ✅ Auto-updater script (runs every 10 minutes via cron)
  ✅ Dynamic folder path generation based on current time
  ✅ Date-based folder structure (YYYY-MM-DD)
  ✅ Shift-specific subfolders
  ✅ Automatic service restart when paths change

Path Structure:
  ✅ /mnt/shared/YYYY-MM-DD/Morning Shift/ (Test Machine)
  ✅ /mnt/shared3/YYYY-MM-DD/X/ (Factory Line 1)
  ✅ /mnt/shared2/YYYY-MM-DD/Morning Shift/ (Factory Line 2)
```

### 📊 Analytics & Data
```yaml
Database Storage:
  ✅ PostgreSQL with SQLModel ORM
  ✅ Detection records with grid statistics
  ✅ Machine context and historical paths
  ✅ Processing metadata and timestamps
  ✅ Error tracking and status updates

Export Capabilities:
  ✅ Excel export with grid data
  ✅ PDF report generation
  ✅ Bulk data export with date filtering
  ✅ Machine-specific reporting
```

### 🌐 File Monitoring System
```yaml
Watchdog Services:
  ✅ EL Watcher (monitors SMB shares for new images)
  ✅ Processed Watcher (handles AI results and client notification)
  ✅ Polling-based file monitoring (SMB compatible)
  ✅ Duplicate detection and prevention
  ✅ Error handling and retry logic

File Processing Flow:
  ✅ SMB folder monitoring → AI detection → Database storage → Result copying → Client notification
```

---

## 🎨 UI Components

### 🏠 Dashboard Page
```yaml
System Status Section:
  ✅ Health indicator with color coding
  ✅ System uptime and environment display
  ✅ Machine name and mode information
  ✅ Real-time timestamp (IST)

Analytics Cards:
  ✅ Images processed counter
  ✅ Today's defects counter
  ✅ Average processing time
  ✅ System health status

Date Filter Controls:
  ✅ Preset buttons (Today, Yesterday, Last 7 days, etc.)
  ✅ Custom date range picker
  ✅ IST timezone handling
  ✅ Active filter display

Grid Analysis:
  ✅ Most affected cells display
  ✅ Grid coverage percentage
  ✅ Defect distribution statistics
  ✅ Machine comparison data
```

### 📺 Live Image Viewer
```yaml
Image Display:
  ✅ Latest processed image display
  ✅ Auto-refresh every 30 seconds
  ✅ Manual navigation with arrow keys
  ✅ Fullscreen mode toggle
  ✅ Image loading states and error handling

Controls:
  ✅ AUTO/MANUAL mode toggle
  ✅ Previous/Next navigation buttons
  ✅ Sync button for manual refresh
  ✅ Machine selector dropdown
  ✅ Dashboard navigation link

Status Information:
  ✅ Image metadata (filename, date, defects)
  ✅ Processing time display
  ✅ Machine information
  ✅ Current machine paths display
```

### 📋 Detection History
```yaml
Search and Filter Panel:
  ✅ Filename search (minimum 3 characters)
  ✅ Date range picker with IST support
  ✅ Machine filter dropdown
  ✅ Grid cell filter input
  ✅ Clear filters functionality

Display Options:
  ✅ Grid view and List view toggle
  ✅ Pagination controls
  ✅ Results per page selector (10, 20, 50, 100)
  ✅ Total results counter

Image Cards/Rows:
  ✅ Thumbnail previews
  ✅ Filename display with copy function
  ✅ Status badges
  ✅ Defect count indicators
  ✅ Grid cell information
  ✅ Processing metadata

Export Options:
  ✅ Excel export button
  ✅ Bulk export with current filters
  ✅ Date range export
```

### 🔍 Detection Detail View
```yaml
Image Comparison:
  ✅ Side-by-side original and annotated images
  ✅ Fullscreen image viewer
  ✅ Zoom and pan functionality
  ✅ Image toggle controls

Grid Analysis:
  ✅ Interactive 6×24 grid visualization
  ✅ Click-to-select grid cells
  ✅ Color-coded defect density
  ✅ Selected cell detail display
  ✅ Most affected cells list

Information Panels:
  ✅ Detection metadata table
  ✅ Processing statistics
  ✅ Grid configuration display
  ✅ Historical path information
  ✅ File information and links

Export Actions:
  ✅ PDF export button
  ✅ Excel export button
  ✅ Individual image download links
```

### 🎛️ Common UI Elements
```yaml
Navigation Bar:
  ✅ Logo and system title
  ✅ Active page indicators
  ✅ Live View, Dashboard, History links
  ✅ System status indicator
  ✅ Machine and environment display

Feedback Systems:
  ✅ Loading spinners
  ✅ Success/error toast notifications
  ✅ Loading states for buttons
  ✅ Progress indicators

Help System:
  ✅ Tooltip components with explanations
  ✅ Keyboard shortcut indicators
  ✅ Context-sensitive help tooltips
```

---

## 🔧 Technical Implementation

### 🐳 Docker Architecture
```yaml
Services:
  ✅ FastAPI application container
  ✅ PostgreSQL database container
  ✅ Frontend build container (for production)
  ✅ Volume mounts for data persistence
  ✅ Environment-specific compose files

Makefile Commands:
  ✅ make dev (development environment)
  ✅ make up-stage (staging environment)
  ✅ make up-prod (production environment)
  ✅ make status (container status check)
  ✅ make health (system health check)
  ✅ make clean (cleanup containers)
```

### 🔄 API Endpoints
```yaml
Health Endpoints:
  ✅ /api/v1/health (basic health check)
  ✅ /api/v1/health/detailed (comprehensive system status)

Detection Endpoints:
  ✅ /api/v1/detect/detect-defect (main detection API)
  ✅ /api/v1/detect/recent (paginated detection history)
  ✅ /api/v1/detect/status/{id} (individual detection status)
  ✅ /api/v1/detect/machines (available machines)

Analytics Endpoints:
  ✅ /api/v1/analytics/dashboard (dashboard data)
  ✅ /api/v1/analytics/image/{id} (detailed image analysis)
  ✅ /api/v1/analytics/grid-summary (grid analysis data)

Export Endpoints:
  ✅ /api/v1/export/pdf/{id} (PDF export)
  ✅ /api/v1/export/excel/{id} (Excel export)
  ✅ /api/v1/export/excel/bulk (bulk Excel export)
```

### 📁 Static File Serving
```yaml
File Routes:
  ✅ /source/* (original images)
  ✅ /processed/* (annotated images and results)
  ✅ / (React application)
  ✅ /docs (API documentation)

Frontend Integration:
  ✅ React build integration with FastAPI
  ✅ Vite build system
  ✅ Development proxy configuration
  ✅ Production static file serving
```

---

## 📱 Web Interface Pages

### 🏠 Dashboard (/)
```yaml
URL: http://localhost:8000/dashboard
Purpose: System overview and analytics
Key Features:
  ✅ Real-time system health monitoring
  ✅ Detection statistics with date filtering
  ✅ Grid analysis visualization
  ✅ Machine performance comparison
  ✅ Export functionality
```

### 📺 Live View (/) - Default Page
```yaml
URL: http://localhost:8000/
Purpose: Real-time image monitoring
Key Features:
  ✅ Latest processed image display
  ✅ Auto-refresh mechanism
  ✅ Manual navigation controls
  ✅ Fullscreen image viewer
  ✅ Machine selection
```

### 📋 Detection History (/history)
```yaml
URL: http://localhost:8000/history
Purpose: Browse and search all detections
Key Features:
  ✅ Advanced search and filtering
  ✅ Grid and list view options
  ✅ Pagination with smooth scrolling
  ✅ Bulk export capabilities
  ✅ Grid cell filtering
```

### 🔍 Detection Detail (/detail/:id)
```yaml
URL: http://localhost:8000/detail/{detection_id}
Purpose: Detailed analysis of individual detection
Key Features:
  ✅ Image comparison view
  ✅ Interactive grid analysis
  ✅ Defect coordinate mapping
  ✅ Export options (PDF/Excel)
  ✅ Historical context display
```

---

## ⚙️ Configuration System

### 📄 Main Configuration (shared_config.json)
```json
{
  "current_mode": "dev",
  "current_machine": "Factory Line 2",
  "modes": {
    "dev": {
      "database_name": "saatvik_el_db_dev",
      "api_base": "http://localhost:8000",
      "confidence_threshold": 0.2,
      "machines": {
        "Test Machine": {
          "machine_id": "IT Office Machine",
          "smb_source_path": "/mnt/shared",
          "smb_watch_path": "/mnt/shared/2025-06-27/Morning Shift",
          "smb_processed_path": "/mnt/shared/processed",
          "client_ip": "10.10.2.1"
        }
      }
    }
  }
}
```

### 🔧 Auto-Update System
```yaml
Configuration Scripts:
  ✅ setup_config_json.py (initial configuration generation)
  ✅ auto_updater.py (automatic path updates)
  ✅ Cron job setup (*/10 * * * * for auto-updates)

Environment Files:
  ✅ .env (development overrides)
  ✅ .env.staging (staging configuration)
  ✅ .env.prod (production configuration)
```

---

## 🔍 Data Flow

### 📊 Detection Process Flow
```
1. Windows Machine → Saves EL image to SMB share
2. EL Watcher → Detects new image file
3. FastAPI → Receives detection request
4. YOLO Service → Processes image and detects defects
5. Database → Stores detection record with grid data
6. File System → Saves annotated results
7. Processed Watcher → Copies results to SMB share
8. Windows Client → Gets notified of new results
```

### 🔄 Shift Update Flow
```
1. Cron Job → Triggers auto_updater.py every 10 minutes
2. Auto Updater → Checks current time against shift schedules
3. Path Generator → Creates new folder paths if shift changed
4. Configuration → Updates shared_config.json
5. Service Manager → Restarts watchers if paths changed
6. Log System → Records all changes to cron.log
```

### 🌐 Web Interface Data Flow
```
1. React Frontend → Makes API requests to FastAPI
2. FastAPI → Queries PostgreSQL database
3. Database → Returns detection records with grid data
4. API → Formats response with analytics
5. Frontend → Displays data with interactive components
6. User Interaction → Triggers new API requests
```

---

## 📋 File Structure

### 🗂️ Project Organization
```
saatvik-el-detection/
├── app/                          # FastAPI backend
│   ├── api/endpoints/           # API route handlers
│   ├── core/                    # Configuration and database
│   ├── models/                  # SQLModel database models
│   ├── services/                # YOLO and business logic
│   └── static/                  # React build output
├── frontend/                    # React application
│   ├── src/components/          # React components
│   ├── src/hooks/               # Custom React hooks
│   ├── src/services/            # API service layer
│   └── src/types/               # TypeScript definitions
├── watchdog/                    # File monitoring services
│   ├── el_watcher.py           # SMB folder monitoring
│   └── processed_watcher.py    # Result handling
├── models/                      # YOLO model files
├── processed/                   # AI processing results
├── logs/                        # Application logs
├── shared_config.json          # Main configuration
├── setup_config_json.py        # Configuration generator
├── auto_updater.py             # Automatic path updater
├── Makefile                     # Docker management commands
└── docker-compose*.yml         # Docker configurations
```

---

## 🎯 Access Points

### 🌐 Web Interfaces
- **Live View**: http://localhost:8000/
- **Dashboard**: http://localhost:8000/dashboard
- **History**: http://localhost:8000/history
- **API Documentation**: http://localhost:8000/docs

### 🔧 Management Commands
```bash
# System Management
make status          # Check container status
make health         # System health check
make dev            # Start development environment
make restart        # Restart services
make logs           # View application logs

# Watchdog Management
ps aux | grep watcher                    # Check running watchers
python3 auto_updater.py                 # Manual path update
tail -f cron.log                       # Monitor auto-updates

# Configuration
cat shared_config.json | jq .          # View current config
python3 setup_config_json.py           # Regenerate config
```

---

*📋 This documentation reflects the actual implemented features and components of the Saatvik EL Detection System as of June 2025.*

**Last Updated**: June 2025 | **Version**: 1.0