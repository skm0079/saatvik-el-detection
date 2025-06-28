# File: watchdog/el_watcher.py

#!/usr/bin/env python3
"""
Simple, Robust EL Image Watcher
- Works with SMB network mounts
- Thread-safe async handling
- Runs indefinitely without issues
- Simple configuration
"""

import json
from pathlib import Path
import os
import asyncio
import httpx
import hashlib
import json
from pathlib import Path
from loguru import logger
from typing import Set
from watchdog.observers.polling import PollingObserver
from watchdog.events import FileSystemEventHandler
from queue import Queue


class ELImageWatcher(FileSystemEventHandler):
    def __init__(self, file_queue: Queue, watch_path: Path, excluded_folders: Set[str]):
        self.file_queue = file_queue
        self.processed_files: Set[str] = set()
        self._load_processed_files()
        self.watch_path = watch_path
        self.excluded_folders = excluded_folders

    def _load_processed_files(self):
        """Load previously processed files"""
        try:
            processed_file = Path("processed_files.json")
            if processed_file.exists():
                with open(processed_file, "r") as f:
                    data = json.load(f)
                    self.processed_files = set(data.get("processed_files", []))
                logger.info(
                    f"Loaded {len(self.processed_files)} previously processed files"
                )
        except Exception as e:
            logger.warning(f"Could not load processed files: {e}")

    def _save_processed_files(self):
        """Save processed files list"""
        try:
            with open("processed_files.json", "w") as f:
                json.dump({"processed_files": list(self.processed_files)}, f)
        except Exception as e:
            logger.error(f"Could not save processed files: {e}")

    def _get_file_hash(self, file_path: Path) -> str:
        """Generate file hash for duplicate detection"""
        try:
            with open(file_path, "rb") as f:
                file_hash = hashlib.md5()
                while chunk := f.read(8192):
                    file_hash.update(chunk)
                return file_hash.hexdigest()
        except Exception:
            return ""

    def on_created(self, event):
        """Handle new file creation - THREAD SAFE"""
        if event.is_directory:
            return

        file_path = Path(event.src_path)
        logger.info(f"🔍 Processing file event: {file_path}")

        # Check if file is in excluded level 1 folder
        try:
            relative_path = file_path.relative_to(self.watch_path)
            if (
                len(relative_path.parts) > 0
                and relative_path.parts[0] in self.excluded_folders
            ):
                logger.info(f"⏭️ Skipping excluded folder: {relative_path.parts[0]}")
                return  # Skip this file
        except ValueError as e:
            logger.warning(f"Path calculation error: {e}")
            pass  # File not under watch path

        # Only process image files
        if file_path.suffix.lower() in [".jpg", ".jpeg", ".png"]:
            logger.info(f"🔍 NEW FILE DETECTED: {file_path.name}")

            # Check if already processed to avoid duplicates
            logger.info(f"📝 Calculating hash for: {file_path.name}")
            file_hash = self._get_file_hash(file_path)
            logger.info(f"📝 Hash calculated: {file_hash[:8]}... for {file_path.name}")

            if file_hash and file_hash in self.processed_files:
                logger.debug(f"Already processed: {file_path.name}")
                return

            # Add to queue for async processing
            logger.info(f"📤 Adding to queue: {file_path.name}")
            self.file_queue.put((str(file_path), file_hash))
            logger.info(
                f"✅ Added to queue: {file_path.name}, queue size: {self.file_queue.qsize()}"
            )
        else:
            logger.info(f"⏭️ Skipping non-image file: {file_path.name}")

    def on_moved(self, event):
        """Handle file moves"""
        if event.is_directory:
            return

        dest_path = Path(event.dest_path)

        # Check if file is in excluded level 1 folder
        try:
            relative_path = dest_path.relative_to(self.watch_path)
            if (
                len(relative_path.parts) > 0
                and relative_path.parts[0] in self.excluded_folders
            ):
                return  # Skip this file
        except ValueError:
            pass  # File not under watch path

        if dest_path.suffix.lower() in [".jpg", ".jpeg", ".png"]:
            logger.info(f"🔍 FILE MOVED: {dest_path.name}")

            file_hash = self._get_file_hash(dest_path)
            if file_hash and file_hash in self.processed_files:
                logger.debug(f"Already processed: {dest_path.name}")
                return

            self.file_queue.put((str(dest_path), file_hash))


class ELWatchdogService:
    def __init__(
        self, watch_path: str, api_endpoint: str, excluded_folders: Set[str] = None
    ):
        self.watch_path = Path(watch_path)
        self.api_endpoint = api_endpoint
        self.file_queue = Queue()
        self.observer = PollingObserver(timeout=3)  # Poll every 3 seconds
        self.processing = set()
        self.excluded_folders = excluded_folders or set()

    async def process_files(self):
        """Async file processor - runs in main thread"""
        while True:
            try:
                # Check for new files in queue
                if not self.file_queue.empty():
                    file_path_str, file_hash = self.file_queue.get_nowait()

                    if file_path_str not in self.processing:
                        self.processing.add(file_path_str)
                        asyncio.create_task(
                            self._process_single_file(file_path_str, file_hash)
                        )

                await asyncio.sleep(1)  # Check queue every second

            except Exception as e:
                logger.error(f"Error in file processor: {e}")
                await asyncio.sleep(5)

    async def _process_single_file(self, file_path_str: str, file_hash: str):
        """Process a single file"""
        try:
            file_path = Path(file_path_str)
            logger.info(f"📁 File path object created: {file_path}")

            # Wait for file to be fully written (important for network mounts)
            logger.info(f"⏳ Waiting 2 seconds for file to be fully written...")
            await asyncio.sleep(2)
            logger.info(f"✅ Wait complete, checking file existence...")

            # Verify file still exists and is readable
            if not file_path.exists():
                logger.warning(f"File disappeared: {file_path.name}")
                return

            # Check file size
            file_size = file_path.stat().st_size
            if file_size < 1000:
                logger.warning(f"File too small: {file_path.name} ({file_size} bytes)")
                return

            logger.info(f"📸 Processing: {file_path.name} ({file_size} bytes)")

            # Calculate folder path
            try:
                relative_path = file_path.relative_to(self.watch_path)
                el_folder_path = (
                    str(relative_path.parent)
                    if relative_path.parent.name != "."
                    else "root"
                )
            except ValueError:
                el_folder_path = "unknown"

            # Send to API
            success = await self._send_to_api(file_path, el_folder_path)

            # Mark as processed if successful
            if success and file_hash:
                # Save to processed files directly
                try:
                    processed_file = Path("processed_files.json")
                    processed_files = set()

                    if processed_file.exists():
                        with open(processed_file, "r") as f:
                            data = json.load(f)
                            processed_files = set(data.get("processed_files", []))

                    processed_files.add(file_hash)

                    with open(processed_file, "w") as f:
                        json.dump({"processed_files": list(processed_files)}, f)

                except Exception as e:
                    logger.error(f"Could not save processed files: {e}")

        except Exception as e:
            logger.error(f"Failed to process {file_path_str}: {e}")
        finally:
            self.processing.discard(file_path_str)

    async def _send_to_api(self, file_path: Path, el_folder_path: str) -> bool:
        """Send file to API"""
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                with open(file_path, "rb") as f:
                    files = {"file": (file_path.name, f, "image/jpeg")}
                    # Get current machine name from environment
                    # Get current machine config
                    machine_from_env = os.getenv("MACHINE", "Unknown")
                    data = {
                        "el_folder_path": el_folder_path,
                        "confidence": 0.2,  # TODO: Default confidence threshold
                        "machine_name": machine_from_env,  # Use environment variable
                    }

                    logger.info(f"📤 Sending {file_path.name} to API...")
                    response = await client.post(
                        f"{self.api_endpoint}/detect-defect", files=files, data=data
                    )

                if response.status_code == 200:
                    result = response.json()
                    logger.success(
                        f"✅ Detection completed: {file_path.name} | "
                        f"ID: {result['detection_id']} | "
                        f"Defects: {result['total_defects']} | "
                        f"Time: {result['processing_time_ms']}ms"
                    )
                    return True
                else:
                    logger.error(
                        f"❌ API error {response.status_code}: {response.text}"
                    )
                    return False

        except Exception as e:
            logger.error(f"💥 API call failed for {file_path.name}: {e}")
            return False

    async def start_watching(self):
        """Start the watcher service"""

        if not self.watch_path.exists():
            logger.error(f"❌ Watch path does not exist: {self.watch_path}")
            return

        # Create event handler
        event_handler = ELImageWatcher(
            self.file_queue, self.watch_path, self.excluded_folders
        )

        # Start observer
        self.observer.schedule(event_handler, str(self.watch_path), recursive=True)

        logger.info("🚀 Starting EL Image Watcher...")
        logger.info(f"📁 Watching: {self.watch_path}")
        logger.info(f"🌐 API Endpoint: {self.api_endpoint}")
        logger.info("🔍 Using PollingObserver for SMB mount")
        logger.info("🛑 Press Ctrl+C to stop gracefully")

        self.observer.start()

        # Start async file processor
        processor_task = asyncio.create_task(self.process_files())

        try:
            # Keep running until interrupted
            while True:
                await asyncio.sleep(1)

        except KeyboardInterrupt:
            logger.info("🛑 Graceful shutdown initiated...")

            # Stop observer
            logger.info("⏹️ Stopping file watcher...")
            self.observer.stop()

            # Cancel processor
            logger.info("⏹️ Stopping file processor...")
            processor_task.cancel()

            try:
                await processor_task
            except asyncio.CancelledError:
                pass

            # Wait for observer to finish
            logger.info("⏳ Waiting for observer to finish...")
            self.observer.join()

            logger.info("✅ Shutdown complete!")


async def main():
    """Main entry point"""

    # Get machine from environment FIRST
    machine_from_env = os.getenv("MACHINE")
    if not machine_from_env:
        logger.error("❌ MACHINE environment variable not set!")
        logger.error("❌ Usage: MACHINE='Factory Line 1' uv run watchdog/el_watcher.py")
        return

    # Load config
    config = load_config()
    current_mode = os.getenv("MODE", config.get("current_mode", "dev"))
    mode_config = config["modes"][current_mode]

    # Find machine config by environment variable
    machine_config = None
    for machine_key, machine_data in mode_config["machines"].items():
        if (
            machine_data["machine_name"] == machine_from_env
            or machine_data["machine_id"] == machine_from_env
            or machine_key == machine_from_env
        ):
            machine_config = machine_data
            break

    if not machine_config:
        logger.error(f"❌ Machine '{machine_from_env}' not found in config!")
        logger.error(f"❌ Available machines: {list(mode_config['machines'].keys())}")
        return

    # Use machine-specific paths
    WATCH_PATH = machine_config["smb_watch_path"]
    API_ENDPOINT = mode_config["api_endpoint"]
    EXCLUDED_FOLDERS = set(mode_config["excluded_folders"])

    logger.info("🚀 Saatvik EL Image Watcher Starting...")
    logger.info(f"🏭 Environment: {current_mode}")
    logger.info(f"🤖 Machine: {machine_from_env}")
    logger.info(f"📁 Watch Path: {WATCH_PATH}")
    logger.info(f"🌐 API Endpoint: {API_ENDPOINT}")

    # Verify paths exist
    watch_path = Path(WATCH_PATH)
    if not watch_path.exists():
        logger.error(f"❌ Watch path does not exist: {WATCH_PATH}")
        return

    # Test API connectivity
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{API_ENDPOINT.replace('/detect', '')}/health")
            if response.status_code == 200:
                logger.success("✅ API server is reachable")
            elif response.status_code == 307:
                logger.info("📍 API redirect detected - will work fine")
            else:
                logger.warning(f"⚠️ API returned {response.status_code}")
    except Exception as e:
        logger.error(f"❌ Cannot reach API: {e}")
        return

    # Start watcher
    try:
        watcher = ELWatchdogService(WATCH_PATH, API_ENDPOINT, EXCLUDED_FOLDERS)
        await watcher.start_watching()
    except KeyboardInterrupt:
        logger.info("🛑 Interrupted by user")
    except Exception as e:
        logger.error(f"❌ Unexpected error: {e}")


def load_config():
    """Load configuration from shared_config.json"""
    config_file = Path("shared_config.json")
    if not config_file.exists():
        raise RuntimeError(
            f"❌ shared_config.json not found at {config_file.absolute()}"
        )

    with open(config_file, "r") as f:
        config = json.load(f)

    return config


if __name__ == "__main__":
    # Setup logging
    logger.remove()
    logger.add(
        "logs/el_watcher.log",
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

    # Handle Ctrl+C gracefully
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("🛑 Program terminated by user")
    except Exception as e:
        logger.error(f"❌ Fatal error: {e}")
    finally:
        logger.info("👋 Goodbye!")
