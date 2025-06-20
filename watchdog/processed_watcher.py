# File: watchdog/processed_watcher.py

#!/usr/bin/env python3
"""
Processed Folder Watcher + Windows Client Trigger
- Watches processed/annotated/ folder for new AI results ONLY
- Simply copies to shared folder and triggers Windows client
- NO image modification, NO infinite loops
"""

import asyncio
import platform
import os 
import shutil
from pathlib import Path
from loguru import logger
from watchdog.observers.polling import PollingObserver
from watchdog.events import FileSystemEventHandler
from queue import Queue

class ProcessedImageWatcher(FileSystemEventHandler):
    def __init__(self, image_queue: Queue):
        self.image_queue = image_queue
        self.processed_files = set()
    
    def on_created(self, event):
        """Handle new processed image creation"""
        if event.is_directory:
            return
        
        file_path = Path(event.src_path)
        
        # FIXED: Only process ORIGINAL annotated images, NOT viewer_ files
        if (file_path.suffix.lower() in ['.jpg', '.jpeg', '.png'] and 
            'annotated' in file_path.name and 
            not file_path.name.startswith('viewer_') and
            not file_path.name.startswith('thumb') and
            file_path.name not in self.processed_files):
            
            logger.info(f"🖼️ NEW PROCESSED IMAGE: {file_path.name}")
            self.processed_files.add(file_path.name)
            self.image_queue.put(str(file_path))

class ImageViewerService:
    def __init__(self, processed_dir: str):
        self.processed_dir = Path(processed_dir)
        self.image_queue = Queue()
        self.observer = PollingObserver(timeout=3)
        
    def _get_client_info(self) -> dict:
        """Get client information"""
        return {
            'client_ip': '10.10.2.1',
            'client_os': 'windows',
            'client_type': 'windows'
        }
    
    def _copy_to_shared_and_trigger(self, image_path: Path):
        """Simple copy to shared folder and trigger client"""
        try:
            # Create shared processed folder
            shared_dir = Path("/mnt/shared/processed")
            shared_dir.mkdir(parents=True, exist_ok=True)
            
            # Simple copy - NO modification
            shared_image_path = shared_dir / image_path.name
            shutil.copy2(image_path, shared_image_path)
            
            logger.success(f"✅ Copied to shared: {shared_image_path}")
            
            # Get client info
            client_info = self._get_client_info()
            client_os = client_info.get('client_os', 'windows').lower()
            client_ip = client_info.get('client_ip', '10.10.2.1')
            
            # Create network path
            if client_os == "windows":
                network_path = f"\\\\10.10.1.4\\shared\\processed\\{image_path.name}"
            else:
                network_path = str(shared_image_path)
            
            logger.info(f"🎯 Targeting {client_os} client at {client_ip}")
            logger.info(f"🪟 Network path: {network_path}")
            
            # Trigger client
            self._trigger_client(client_ip, client_os, network_path)
            
            logger.success(f"✅ Triggered {client_os} client: {image_path.name}")
            
        except Exception as e:
            logger.error(f"Failed to copy and trigger: {e}")
    
    def _trigger_client(self, client_ip: str, client_os: str, image_path: str):
        """Trigger client to open image"""
        try:
            if client_os == "windows":
                self._trigger_windows_client(client_ip, image_path)
            else:
                self._trigger_linux_client(client_ip, image_path)
                
        except Exception as e:
            logger.error(f"Client trigger failed: {e}")
    
    def _trigger_windows_client(self, client_ip: str, image_path: str):
        """Trigger Windows client"""
        try:
            logger.info(f"🪟 Triggering Windows client: {image_path}")
            
            # Method 1: HTTP API call
            try:
                import requests
                response = requests.post(
                    f"http://{client_ip}:9999/open-image",
                    json={"image_path": image_path, "action": "open"},
                    timeout=3
                )
                
                if response.status_code == 200:
                    logger.success(f"✅ Windows client triggered via HTTP")
                    return
            except Exception:
                logger.debug("HTTP trigger failed, trying other methods")
            
            # Method 2: Create trigger file
            try:
                trigger_file = Path("/mnt/shared/open_image.txt")
                with open(trigger_file, 'w') as f:
                    f.write(image_path)
                
                logger.info(f"📄 Created trigger file: {trigger_file}")
                
            except Exception as e:
                logger.warning(f"Trigger file failed: {e}")
            
            # Method 3: Log for manual access
            logger.info(f"📁 Image available for Windows client: {image_path}")
            
        except Exception as e:
            logger.error(f"Windows trigger failed: {e}")
    
    def _trigger_linux_client(self, client_ip: str, image_path: str):
        """Trigger Linux client"""
        try:
            logger.info(f"🐧 Triggering Linux client: {image_path}")
            
            # Method 1: HTTP API call
            try:
                import requests
                response = requests.post(
                    f"http://{client_ip}:9999/open-image",
                    json={"image_path": image_path, "action": "open"},
                    timeout=3
                )
                
                if response.status_code == 200:
                    logger.success(f"✅ Linux client triggered via HTTP")
                    return
            except Exception:
                logger.debug("HTTP trigger failed, trying SSH")
            
            # Method 2: SSH command
            try:
                import subprocess
                ssh_cmd = [
                    'ssh', f'administrator@{client_ip}', 
                    f'DISPLAY=:0 eog "{image_path}" > /dev/null 2>&1 &'
                ]
                result = subprocess.run(ssh_cmd, timeout=5, capture_output=True)
                
                if result.returncode == 0:
                    logger.success(f"✅ Linux client triggered via SSH")
                    return
            except Exception as e:
                logger.warning(f"SSH trigger failed: {e}")
            
            # Method 3: Log for manual access
            logger.info(f"📁 Image available for Linux client: {image_path}")
            
        except Exception as e:
            logger.error(f"Linux trigger failed: {e}")
    
    async def process_images(self):
        """Process new images from queue"""
        while True:
            try:
                if not self.image_queue.empty():
                    image_path_str = self.image_queue.get_nowait()
                    image_path = Path(image_path_str)
                    
                    # Wait for file to be fully written
                    await asyncio.sleep(2)
                    
                    # Verify file exists and is readable
                    if not image_path.exists():
                        logger.warning(f"File not found: {image_path}")
                        continue
                    
                    file_size = image_path.stat().st_size
                    if file_size < 1000:
                        logger.warning(f"File too small: {image_path} ({file_size} bytes)")
                        continue
                    
                    logger.info(f"🎨 Processing: {image_path.name}")
                    
                    # Simply copy to shared and trigger client
                    self._copy_to_shared_and_trigger(image_path)
                
                await asyncio.sleep(1)
                
            except Exception as e:
                logger.error(f"Error processing images: {e}")
                await asyncio.sleep(5)
    
    async def start_watching(self):
        """Start watching processed folder"""
        
        # Watch only annotated subfolders (not the shared processed folder!)
        watch_paths = []
        
        # Add existing annotated folders in the LOCAL processed directory
        for subfolder in self.processed_dir.iterdir():
            if subfolder.is_dir():
                annotated_dir = subfolder / "annotated"
                if annotated_dir.exists():
                    watch_paths.append(annotated_dir)
                    logger.info(f"👁️ Watching: {annotated_dir}")
        
        # Also watch main processed directory for new timestamp folders
        watch_paths.append(self.processed_dir)
        logger.info(f"👁️ Watching: {self.processed_dir}")
        
        if len(watch_paths) <= 1:  # Only main dir
            logger.warning(f"No annotated folders found in {self.processed_dir}")
        
        # Create event handler
        event_handler = ProcessedImageWatcher(self.image_queue)
        
        # Start watching all paths
        for watch_path in watch_paths:
            self.observer.schedule(event_handler, str(watch_path), recursive=True)
        
        logger.info("🚀 Starting Processed Image Watcher...")
        logger.info(f"📁 Processed Directory: {self.processed_dir}")
        logger.info(f"🖥️ Operating System: {platform.system()}")
        logger.info("🛑 Press Ctrl+C to stop")
        
        self.observer.start()
        
        # Start image processor
        processor_task = asyncio.create_task(self.process_images())
        
        try:
            while True:
                await asyncio.sleep(1)
        except KeyboardInterrupt:
            logger.info("🛑 Graceful shutdown initiated...")
            self.observer.stop()
            processor_task.cancel()
            
            try:
                await processor_task
            except asyncio.CancelledError:
                pass
            
            self.observer.join()
            logger.info("✅ Processed watcher stopped")

async def main():
    """Main entry point"""
    
    # Configuration
    PROCESSED_DIR = "processed"  # LOCAL processed folder only
    
    logger.info("🚀 Saatvik Processed Image Watcher Starting...")
    logger.info(f"📁 Processed Directory: {PROCESSED_DIR}")
    logger.info(f"🖥️ Operating System: {platform.system()}")
    
    # Verify directory exists
    processed_path = Path(PROCESSED_DIR)
    if not processed_path.exists():
        logger.error(f"❌ Processed directory does not exist: {PROCESSED_DIR}")
        return
    
    # Start watcher
    try:
        watcher = ImageViewerService(PROCESSED_DIR)
        await watcher.start_watching()
    except KeyboardInterrupt:
        logger.info("🛑 Interrupted by user")
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    # Setup logging
    logger.remove()
    logger.add(
        "logs/processed_watcher.log",
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
    
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("🛑 Program terminated by user")
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
    finally:
        logger.info("👋 Goodbye!")