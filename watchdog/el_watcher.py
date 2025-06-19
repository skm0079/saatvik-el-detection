import asyncio
import httpx
import hashlib
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from pathlib import Path
from loguru import logger
from typing import Set
import json

class ELImageWatcher(FileSystemEventHandler):
    def __init__(self, api_endpoint: str, watch_path: Path):
        self.api_endpoint = api_endpoint
        self.watch_path = watch_path
        self.processing: Set[str] = set()
        self.processed_files: Set[str] = set()
        
        # Load previously processed files
        self._load_processed_files()
    
    def _load_processed_files(self):
        """Load list of previously processed files to avoid reprocessing"""
        processed_file = Path("processed_files.json")
        if processed_file.exists():
            try:
                with open(processed_file, 'r') as f:
                    data = json.load(f)
                    self.processed_files = set(data.get("processed_files", []))
                logger.info(f"Loaded {len(self.processed_files)} previously processed files")
            except Exception as e:
                logger.warning(f"Could not load processed files list: {e}")
    
    def _save_processed_files(self):
        """Save list of processed files"""
        try:
            with open("processed_files.json", 'w') as f:
                json.dump({"processed_files": list(self.processed_files)}, f)
        except Exception as e:
            logger.error(f"Could not save processed files list: {e}")
    
    def _get_file_hash(self, file_path: Path) -> str:
        """Generate hash of file for duplicate detection"""
        try:
            with open(file_path, 'rb') as f:
                file_hash = hashlib.md5()
                while chunk := f.read(8192):
                    file_hash.update(chunk)
                return file_hash.hexdigest()
        except Exception:
            return ""
    
    def on_created(self, event):
        if event.is_directory:
            return
        
        file_path = Path(event.src_path)
        
        # Only process image files
        if file_path.suffix.lower() in ['.jpg', '.jpeg', '.png']:
            asyncio.create_task(self._process_new_image(file_path))
    
    def on_moved(self, event):
        """Handle file moves (camera might move files)"""
        if event.is_directory:
            return
        
        dest_path = Path(event.dest_path)
        if dest_path.suffix.lower() in ['.jpg', '.jpeg', '.png']:
            asyncio.create_task(self._process_new_image(dest_path))
    
    async def _process_new_image(self, file_path: Path):
        """Process a new EL image"""
        file_key = str(file_path)
        
        # Prevent duplicate processing
        if file_key in self.processing:
            logger.debug(f"Already processing: {file_path.name}")
            return
        
        # Check if already processed
        file_hash = self._get_file_hash(file_path)
        if file_hash and file_hash in self.processed_files:
            logger.debug(f"Already processed (hash match): {file_path.name}")
            return
        
        self.processing.add(file_key)
        
        try:
            # Wait for file to be fully written
            await asyncio.sleep(2)
            
            # Double-check file still exists and is readable
            if not file_path.exists():
                logger.warning(f"File disappeared: {file_path}")
                return
            
            # Check file size is reasonable
            file_size = file_path.stat().st_size
            if file_size < 1000:  # Less than 1KB, probably incomplete
                logger.warning(f"File too small, skipping: {file_path} ({file_size} bytes)")
                return
            
            logger.info(f"Processing new EL image: {file_path.name} ({file_size} bytes)")
            
            # Calculate relative path from watch directory
            try:
                relative_path = file_path.relative_to(self.watch_path.parent)
                el_folder_path = str(relative_path.parent)
            except ValueError:
                el_folder_path = "unknown"
            
            # Send to FastAPI server
            await self._send_to_api(file_path, el_folder_path)
            
            # Mark as processed
            if file_hash:
                self.processed_files.add(file_hash)
                self._save_processed_files()
            
        except Exception as e:
            logger.error(f"Failed to process {file_path}: {e}")
        finally:
            self.processing.discard(file_key)
    
    async def _send_to_api(self, file_path: Path, el_folder_path: str):
        """Send image to FastAPI detection endpoint"""
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                with open(file_path, 'rb') as f:
                    files = {
                        "file": (file_path.name, f, "image/jpeg")
                    }
                    data = {
                        "el_folder_path": el_folder_path,
                        "confidence": 0.5
                    }
                    
                    logger.info(f"Sending {file_path.name} to API...")
                    response = await client.post(
                        f"{self.api_endpoint}/detect-defect",
                        files=files,
                        data=data
                    )
                    
                if response.status_code == 200:
                    result = response.json()
                    logger.success(
                        f"✅ Detection completed: {file_path.name} | "
                        f"ID: {result['detection_id']} | "
                        f"Defects: {result['total_defects']} | "
                        f"Time: {result['processing_time_ms']}ms"
                    )
                else:
                    logger.error(f"❌ API error {response.status_code}: {response.text}")
                    
        except httpx.TimeoutException:
            logger.error(f"⏰ API timeout for {file_path.name}")
        except Exception as e:
            logger.error(f"💥 API call failed for {file_path.name}: {e}")

class ELWatchdogService:
    def __init__(self, watch_path: str, api_endpoint: str):
        self.watch_path = Path(watch_path)
        self.api_endpoint = api_endpoint
        self.observer = Observer()
    async def start_watching(self):
        """Start watching for new EL images"""
        
        if not self.watch_path.exists():
            logger.error(f"Watch path does not exist: {self.watch_path}")
            return
        
        # Create event handler
        event_handler = ELImageWatcher(self.api_endpoint, self.watch_path)
        
        # Start observer
        self.observer.schedule(
            event_handler, 
            str(self.watch_path), 
            recursive=True
        )
        
        logger.info(f"🔍 Starting EL image watcher...")
        logger.info(f"📁 Watching: {self.watch_path}")
        logger.info(f"🌐 API Endpoint: {self.api_endpoint}")
        
        self.observer.start()
        
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            logger.info("Stopping watcher...")
            self.observer.stop()
        
        self.observer.join()
        logger.info("Watcher stopped")

async def main():
    """Main entry point"""
    
    # Configuration
    WATCH_PATH = "/mnt/shared"  # CHANGE THIS MANUALLY
    API_ENDPOINT = "http://10.10.1.4:8000/api/v1/detect"  # Ubuntu server IP
    
    logger.info("🚀 Saatvik EL Image Watcher Starting...")
    logger.info(f"📁 Watch Path: {WATCH_PATH}")
    logger.info(f"🌐 API Endpoint: {API_ENDPOINT}")
    
    # Verify paths exist
    watch_path = Path(WATCH_PATH)
    if not watch_path.exists():
        logger.error(f"❌ Watch path does not exist: {WATCH_PATH}")
        logger.error("Please check SMB mount and folder path")
        return
    
    # Test API connectivity
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{API_ENDPOINT.replace('/detect', '')}/health")
            if response.status_code == 200:
                logger.success("✅ API server is reachable")
            else:
                logger.warning(f"⚠️ API server returned {response.status_code}")
    except Exception as e:
        logger.error(f"❌ Cannot reach API server: {e}")
        logger.error("Please ensure FastAPI server is running")
        return
    
    # Start watching
    watcher = ELWatchdogService(WATCH_PATH, API_ENDPOINT)
    await watcher.start_watching()

if __name__ == "__main__":
    # Setup logging
    logger.remove()
    logger.add(
        "logs/el_watcher.log",
        rotation="1 day",
        retention="7 days",
        level="INFO",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}"
    )
    logger.add(
        lambda msg: print(msg, end=""),
        level="INFO",
        format="{time:HH:mm:ss} | {level} | {message}\n"
    )
    
    asyncio.run(main())