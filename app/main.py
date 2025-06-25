# File: app/main.py - PRODUCTION-READY VERSION WITH FALLBACKS
import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from app.api.router import api_router
from app.core.config import settings
from app.core.database import create_db_and_tables
from app.core.logging import setup_logging
from contextlib import asynccontextmanager
from starlette.exceptions import HTTPException as StarletteHTTPException

# Setup logging
setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for startup and shutdown logic."""
    from loguru import logger

    logger.info("🚀 Starting Saatvik EL Detection API...")

    # Create database tables
    await create_db_and_tables()
    logger.info("✅ Database initialized")

    # Verify YOLO model
    try:
        from app.services.yolo_service import get_yolo_service

        yolo_service = get_yolo_service()
        logger.info("✅ YOLO model loaded successfully")
    except Exception as e:
        logger.error(f"❌ Failed to load YOLO model: {e}")

    # Check directories
    settings.source_dir.mkdir(exist_ok=True)
    settings.processed_dir.mkdir(exist_ok=True)
    settings.backup_dir.mkdir(exist_ok=True)
    logger.info("✅ Directories created")

    logger.success("🎯 Saatvik EL Detection API ready!")
    yield


# Create FastAPI instance
app = FastAPI(
    title=settings.project_name,
    description="AI-powered solar panel EL defect detection system",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========================================
# PRODUCTION-READY: INTELLIGENT SOURCE MOUNTING WITH FALLBACKS
# ========================================

# 1. FIRST: Include all API routes
app.include_router(api_router, prefix=settings.api_v1_str)


# 2. SECOND: Intelligent source mounting with fallbacks
def mount_source_with_fallbacks():
    """Mount source directory with intelligent fallbacks for maximum reliability"""

    # Strategy 1: Volume-mounted source (PRIMARY - for stored/processed files)
    volume_source = "/app/source"
    if os.path.exists(volume_source) and os.listdir(volume_source):
        app.mount("/source", StaticFiles(directory=volume_source), name="volume_source")
        print(f"✅ PRIMARY: Volume source mounted -> {volume_source}")
        print(f"📊 Files available: {len(os.listdir(volume_source))}")
        return "volume"

    # Strategy 2: SMB mount fallback (SECONDARY - direct from production)
    smb_source = str(settings.smb_mount_path)
    if settings.smb_mount_path.exists():
        # Check if SMB has content
        try:
            files = list(settings.smb_mount_path.rglob("*.jpg")) + list(
                settings.smb_mount_path.rglob("*.png")
            )
            if files:
                app.mount(
                    "/source", StaticFiles(directory=smb_source), name="smb_source"
                )
                print(f"⚠️  FALLBACK: SMB source mounted -> {smb_source}")
                print(f"📊 Files available: {len(files)}")
                return "smb"
            else:
                print(f"🔍 SMB mount exists but no images found in {smb_source}")
        except Exception as e:
            print(f"❌ SMB mount check failed: {e}")

    # Strategy 3: Empty volume source (LAST RESORT - for new deployments)
    if os.path.exists(volume_source):
        app.mount(
            "/source", StaticFiles(directory=volume_source), name="empty_volume_source"
        )
        print(f"🆕 EMPTY: Volume source mounted (new deployment) -> {volume_source}")
        print("💡 Files will appear as they are processed")
        return "empty_volume"

    # Strategy 4: Create emergency source (EMERGENCY - prevent total failure)
    emergency_source = "/tmp/emergency_source"
    os.makedirs(emergency_source, exist_ok=True)
    app.mount(
        "/source", StaticFiles(directory=emergency_source), name="emergency_source"
    )
    print(f"🚨 EMERGENCY: Created temporary source -> {emergency_source}")
    print("⚠️  WARNING: Images will not persist across container restarts!")
    return "emergency"


# Execute intelligent mounting
source_strategy = mount_source_with_fallbacks()


# 3. THIRD: Mount processed directory with fallbacks
def mount_processed_with_fallbacks():
    """Mount processed directory with fallbacks"""
    processed_paths = [
        ("processed", "local"),
        (f"{settings.current_mode}/processed", "environment"),
        ("/tmp/processed", "emergency"),
    ]

    for path, strategy_name in processed_paths:
        if os.path.exists(path):
            app.mount("/processed", StaticFiles(directory=path), name="processed_files")
            print(f"✅ Processed mounted ({strategy_name}): {path}")
            return strategy_name

    # Create emergency processed
    os.makedirs("/tmp/processed", exist_ok=True)
    app.mount(
        "/processed",
        StaticFiles(directory="/tmp/processed"),
        name="emergency_processed",
    )
    print("🚨 EMERGENCY: Created temporary processed folder")
    return "emergency"


processed_strategy = mount_processed_with_fallbacks()

# 4. FOURTH: Mount additional environment-specific directories
static_folders = ["staging", "production", "backup"]
mounted_paths = ["/api/", "/docs", "/redoc", "/source", "/processed"]

for folder in static_folders:
    if os.path.exists(folder):
        app.mount(f"/{folder}", StaticFiles(directory=folder), name=f"{folder}_files")
        mounted_paths.append(f"/{folder}")
        print(f"✅ Mounted /{folder} directory")

# Mount environment subdirectories with error handling
for env in ["staging", "production"]:
    if os.path.exists(env):
        for subfolder in ["processed", "source", "backup", "logs"]:
            full_path = os.path.join(env, subfolder)
            if os.path.exists(full_path):
                try:
                    mount_path = f"/{env}/{subfolder}"
                    app.mount(
                        mount_path,
                        StaticFiles(directory=full_path),
                        name=f"{env}_{subfolder}_files",
                    )
                    mounted_paths.append(mount_path)
                    print(f"✅ Mounted {mount_path} directory")
                except Exception as e:
                    print(f"⚠️  Failed to mount {mount_path}: {e}")


# 5. FIFTH: Enhanced SPA handler with health monitoring
class ProductionSPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except (HTTPException, StarletteHTTPException) as ex:
            if ex.status_code == 404:
                request_path = scope.get("path", "")
                # Exclude API routes and all mounted static paths
                if not any(request_path.startswith(prefix) for prefix in mounted_paths):
                    return await super().get_response("index.html", scope)
            raise ex


# 6. LAST: Mount React app with enhanced error handling
static_dir = "app/static"
if os.path.exists(static_dir) and os.listdir(static_dir):
    print("✅ Mounting React SPA at root")
    print(f"✅ SPA exclusions: {mounted_paths}")
    app.mount(
        "/", ProductionSPAStaticFiles(directory=static_dir, html=True), name="spa"
    )
else:
    print("⚠️  No React build found - API only mode")

    # Enhanced fallback page with system status
    @app.get("/", response_class=HTMLResponse)
    async def api_home():
        return f"""
        <html>
            <head><title>Saatvik EL Detection API</title></head>
            <body>
                <img src="/static/logo.png" alt="Logo" style="width: 100px; height: auto;">
                <h1>aatvik EL Detection API</h1>
                <p>✅ API is running in <strong>{settings.current_mode}</strong> mode</p>
                
                <h3>📊 System Status:</h3>
                <ul>
                    <li>🗂️  Source Strategy: <strong>{source_strategy}</strong></li>
                    <li>📁 Processed Strategy: <strong>{processed_strategy}</strong></li>
                    <li>🏭 Machine: <strong>{settings.machine_name}</strong></li>
                </ul>
                
                <h3>🔗 Available Endpoints:</h3>
                <ul>
                    <li><a href="/docs">📚 API Documentation (Swagger)</a></li>
                    <li><a href="/redoc">📖 API Documentation (ReDoc)</a></li>
                    <li><a href="/api/v1/health">💚 Health Check</a></li>
                    <li><a href="/api/v1/detect/recent">🔍 Recent Detections</a></li>
                </ul>
                
                <p><em>Frontend will be available after React build</em></p>
                <hr>
                <small>Environment: {settings.current_mode} | Machine: {settings.machine_id}</small>
            </body>
        </html>
        """


# ========================================
# HEALTH MONITORING ENDPOINTS
# ========================================


@app.get("/api/v1/system/status")
async def get_system_status():
    """Get detailed system status for monitoring"""
    return {
        "environment": settings.current_mode,
        "machine_id": settings.machine_id,
        "machine_name": settings.machine_name,
        "source_strategy": source_strategy,
        "processed_strategy": processed_strategy,
        "mounted_paths": mounted_paths,
        "directories": {
            "source_exists": os.path.exists("/app/source"),
            "source_files": (
                len(os.listdir("/app/source")) if os.path.exists("/app/source") else 0
            ),
            "processed_exists": os.path.exists("processed"),
            "smb_mount_exists": settings.smb_mount_path.exists(),
        },
    }


# ========================================
# STARTUP SUMMARY
# ========================================
print("\n" + "=" * 60)
print("🎯 SAATVIK EL DETECTION - STARTUP SUMMARY")
print("=" * 60)
print(f"🏭 Environment: {settings.current_mode}")
print(f"🏷️  Machine: {settings.machine_name} ({settings.machine_id})")
print(f"🗂️  Source Strategy: {source_strategy}")
print(f"📁 Processed Strategy: {processed_strategy}")
print(f"📊 Mounted Paths: {len(mounted_paths)} total")
print(f"🌐 API Base: {settings.api_v1_str}")
print("=" * 60 + "\n")
