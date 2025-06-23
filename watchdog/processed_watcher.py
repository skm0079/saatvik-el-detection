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
import shutil
from pathlib import Path
from loguru import logger
from watchdog.observers.polling import PollingObserver
from watchdog.events import FileSystemEventHandler
from queue import Queue

# from constants.constants import get_client_ip, get_config


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
        if (
            file_path.suffix.lower() in [".jpg", ".jpeg", ".png"]
            and "annotated" in file_path.name
            and not file_path.name.startswith("viewer_")
            and not file_path.name.startswith("thumb")
            and file_path.name not in self.processed_files
        ):

            logger.info(f"🖼️ NEW PROCESSED IMAGE: {file_path.name}")
            self.processed_files.add(file_path.name)
            self.image_queue.put(str(file_path))


class ImageViewerService:
    def __init__(self, processed_dir: str):
        self.processed_dir = Path(processed_dir)
        self.image_queue = Queue()
        self.observer = PollingObserver(timeout=3)

    # TODO: Revert 10.10.2.1
    def _get_client_info(self) -> dict:
        """Get client information -> Possible Values -> 10.10.2.126 / 10.10.2.1 / 10.10.1.194 """,
        # return {
        #     "client_ip": get_client_ip(),
        #     "client_os": get_config("client_os", "windows"),
        #     "client_type": get_config("client_type", "windows"),
        # }
        return {
            "client_ip": "10.10.1.194",
            "client_os": "windows",
            "client_type": "windows",
        }

    def _copy_to_shared_and_trigger(self, image_path: Path):
        """Simple copy to shared folder and trigger client"""
        try:
            # Extract detection_id from filename (first part before underscore)
            # Filename format: detection_id_original_filename_annotated.jpg
            filename_parts = image_path.name.split("_")
            if len(filename_parts) >= 2:
                detection_id = filename_parts[0]
                logger.info(f"🔍 Extracted detection_id: {detection_id}")
            else:
                detection_id = None
                logger.warning(f"Could not extract detection_id from {image_path.name}")

            # Create shared processed folder
            shared_dir = Path("/mnt/shared/processed")
            shared_dir.mkdir(parents=True, exist_ok=True)

            # Simple copy to shared folder
            if not shared_dir.exists():
                logger.error(f"Shared directory does not exist: {shared_dir}")
                return
            shared_image_path = shared_dir / image_path.name
            shutil.copy2(image_path, shared_image_path)

            logger.success(f"✅ Copied to shared: {shared_image_path}")

            # Get client info
            client_info = self._get_client_info()
            client_os = client_info.get("client_os", "windows").lower()
            client_ip = client_info.get("client_ip", "10.10.2.1")

            # Create network path
            if client_os == "windows":
                network_path = f"\\\\10.10.1.4\\shared\\processed\\{image_path.name}"
            else:
                network_path = str(shared_image_path)

            logger.info(f"🎯 Targeting {client_os} client at {client_ip}")
            logger.info(f"🪟 Network path: {network_path}")

            # Post Result Ready & Dropped to Client State
            logger.info(
                f"🪟 Result Ready :: Source Path : {shared_image_path} || Destination Path: {image_path}"
            )

            # Update status to SAVED only if we have detection_id
            if detection_id:
                try:
                    import requests
                    from datetime import datetime

                    api_response = requests.put(
                        f"http://localhost:8000/api/v1/detect/status/{detection_id}?status=saved",
                        json={
                            "client_notified_at": datetime.now().isoformat(),
                            "completed_at": datetime.now().isoformat(),
                        },
                        timeout=5,
                    )
                    print(
                        f"API Response: {api_response.status_code} - {api_response.text}"
                    )
                    if api_response.status_code == 200:
                        logger.success(f"📊 Status updated to SAVED for {detection_id}")
                    else:
                        logger.warning(
                            f"Failed to update status: {api_response.status_code}"
                        )
                except Exception as e:
                    logger.warning(f"Could not update status to SAVED: {e}")

            logger.success(f"✅ Dropped to {client_os} client: {image_path.name}")

        except Exception as e:
            logger.error(f"Failed to copy and trigger: {e}")

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
                        logger.warning(
                            f"File too small: {image_path} ({file_size} bytes)"
                        )
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

    def _extract_detection_id(self, filename: str) -> str:
        """Extract detection_id from processed image filename"""
        try:
            # Expected format: detection_id_original_filename_annotated.jpg
            # Example: a1b2c3d4-e5f6-7890-abcd-ef1234567890_solar_panel_001_annotated.jpg

            # Split by underscore and take first part
            parts = filename.split("_")
            potential_id = parts[0]

            # Validate it looks like a UUID (basic check)
            if len(potential_id) == 36 and potential_id.count("-") == 4:
                return potential_id
            else:
                logger.warning(
                    f"Filename doesn't contain valid detection_id: {filename}"
                )
                return None

        except Exception as e:
            logger.error(f"Failed to extract detection_id from {filename}: {e}")
            return None


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
        format="{time:YYYY-MM-DD HH:mm:ss} | {level} | {message}",
    )
    logger.add(
        lambda msg: print(msg, end=""),
        level="INFO",
        format="{time:HH:mm:ss} | {level} | {message}\n",
    )

    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("🛑 Program terminated by user")
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
    finally:
        logger.info("👋 Goodbye!")
