# File: app/main.py
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

# Create single FastAPI instance with lifespan
app = FastAPI(
    title=settings.project_name,
    description="AI-powered solar panel EL defect detection system",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# IMPORTANT: Include API routes FIRST (before any static mounting)
app.include_router(api_router, prefix=settings.api_v1_str)

# Mount processed images as static files
app.mount("/processed", StaticFiles(directory="processed"), name="processed")

# Custom StaticFiles class to handle SPA routing
class SPAStaticFiles(StaticFiles):
    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except (HTTPException, StarletteHTTPException) as ex:
            if ex.status_code == 404:
                return await super().get_response("index.html", scope)
            else:
                raise ex

# Mount React app LAST (only if static files exist)
if os.path.exists("app/static") and os.listdir("app/static"):
    app.mount("/", SPAStaticFiles(directory="app/static", html=True), name="static")
else:
    print("⚠️  Static directory not found - React app not built yet")
    
    # Fallback route when no React app
    @app.get("/", response_class=HTMLResponse)
    async def root():
        """Simple home page"""
        return f"""
        <html>
            <head><title>Saatvik EL Detection API</title></head>
            <body>
                <h1>🔍 Saatvik EL Defect Detection API</h1>
                <p>AI-powered solar panel defect detection system</p>
                <ul>
                    <li><a href="/docs">📚 API Documentation (Swagger)</a></li>
                    <li><a href="/api/v1/health">💚 Health Check</a></li>
                    <li><a href="/api/v1/health/detailed">🔧 Detailed Health</a></li>
                </ul>
            </body>
        </html>
        """