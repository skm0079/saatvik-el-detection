# File: app/main.py - COMPLETE FIXED VERSION
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
# FIXED: DYNAMIC ROUTE MOUNTING FOR ALL FOLDERS
# ========================================

# 1. FIRST: Include all API routes
app.include_router(api_router, prefix=settings.api_v1_str)

# 2. SECOND: Mount all static directories dynamically
static_folders = ["processed", "source", "staging", "production"]
mounted_paths = []

for folder in static_folders:
    if os.path.exists(folder):
        app.mount(f"/{folder}", StaticFiles(directory=folder), name=f"{folder}_files")
        mounted_paths.append(f"/{folder}")
        print(f"✅ Mounted /{folder} directory")

# Also mount subdirectories for staging/production
for env in ["staging", "production"]:
    if os.path.exists(env):
        for subfolder in ["processed", "source", "backup", "logs"]:
            full_path = os.path.join(env, subfolder)
            if os.path.exists(full_path):
                mount_path = f"/{env}/{subfolder}"
                app.mount(
                    mount_path,
                    StaticFiles(directory=full_path),
                    name=f"{env}_{subfolder}_files",
                )
                mounted_paths.append(mount_path)
                print(f"✅ Mounted {mount_path} directory")


# 3. THIRD: Custom SPA handler with dynamic exclusions
class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except (HTTPException, StarletteHTTPException) as ex:
            if ex.status_code == 404:
                request_path = scope.get("path", "")
                # Exclude API routes and all mounted static paths
                excluded_prefixes = ["/api/", "/docs", "/redoc"] + mounted_paths
                if not any(
                    request_path.startswith(prefix) for prefix in excluded_prefixes
                ):
                    return await super().get_response("index.html", scope)
            raise ex


# 4. LAST: Mount React app (ONLY if exists and not empty)
static_dir = "app/static"
if os.path.exists(static_dir) and os.listdir(static_dir):
    print("✅ Mounting React SPA at root")
    print(f"✅ SPA exclusions: {mounted_paths}")
    app.mount("/", SPAStaticFiles(directory=static_dir, html=True), name="spa")
else:
    print("⚠️  No React build found - API only mode")

    # Fallback simple home page
    @app.get("/", response_class=HTMLResponse)
    async def api_home():
        return """
        <html>
            <head><title>Saatvik EL Detection API</title></head>
            <body>
                <h1>🔍 Saatvik EL Detection API</h1>
                <p>✅ API is running in standalone mode</p>
                <ul>
                    <li><a href="/docs">📚 API Documentation</a></li>
                    <li><a href="/api/v1/health">💚 Health Check</a></li>
                </ul>
                <p><em>Frontend will be available after React build</em></p>
            </body>
        </html>
        """
