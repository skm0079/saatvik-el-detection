# File: scripts/test_setup.py 

#!/usr/bin/env python3
"""
Complete setup testing script for Saatvik EL Detection system
"""

import asyncio
import httpx
import time
from pathlib import Path
import shutil
from loguru import logger

class SaatvikTestSuite:
    def __init__(self):
        self.api_base = "http://127.0.0.1:8000/api/v1"
        self.smb_mount = Path("/mnt/shared")
        self.test_results = []
    
    async def run_all_tests(self):
        """Run complete test suite"""
        logger.info("🧪 Starting Saatvik EL Detection Test Suite")
        
        tests = [
            ("SMB Mount", self.test_smb_mount),
            ("API Health", self.test_api_health),
            ("YOLO Model", self.test_yolo_model),
            ("File Upload", self.test_file_upload),
            ("Detection Pipeline", self.test_detection_pipeline),
            ("Directory Structure", self.test_directories),
            ("Database", self.test_database)
        ]
        
        for test_name, test_func in tests:
            logger.info(f"Running: {test_name}")
            try:
                result = await test_func()
                self.test_results.append((test_name, "✅ PASS", result))
                logger.success(f"✅ {test_name}: PASSED")
            except Exception as e:
                self.test_results.append((test_name, "❌ FAIL", str(e)))
                logger.error(f"❌ {test_name}: FAILED - {e}")
        
        self.print_summary()
    
    async def test_smb_mount(self):
        """Test SMB mount accessibility"""
        if not self.smb_mount.exists():
            raise Exception(f"SMB mount not found: {self.smb_mount}")
        
        # Test read access
        test_files = list(self.smb_mount.rglob("*.jpg"))[:5]
        if not test_files:
            raise Exception("No JPG files found in SMB mount")
        
        # Test file access
        for file_path in test_files:
            if not file_path.is_file():
                raise Exception(f"Cannot access file: {file_path}")
        
        return f"Found {len(test_files)} accessible image files"
    
    async def test_api_health(self):
        """Test API server health"""
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.api_base}/health/")
            if response.status_code != 200:
                raise Exception(f"Health check failed: {response.status_code}")
            
            # Test detailed health
            response = await client.get(f"{self.api_base}/health/detailed")
            if response.status_code != 200:
                raise Exception(f"Detailed health check failed: {response.status_code}")
            
            health_data = response.json()
            return f"API healthy, components: {health_data['components']}"
    
    async def test_yolo_model(self):
        """Test YOLO model loading"""
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.api_base}/health/detailed")
            health_data = response.json()
            
            if health_data["components"]["yolo_model"] != "loaded":
                raise Exception("YOLO model not loaded")
            
            return "YOLO model loaded successfully"
    
    async def test_file_upload(self):
        """Test file upload functionality"""
        # Create a test image
        test_image_path = Path("test_image.jpg")
        
        # Copy a real image from SMB mount for testing
        source_files = list(self.smb_mount.rglob("*.jpg"))
        if not source_files:
            raise Exception("No source images available for testing")
        
        shutil.copy2(source_files[0], test_image_path)
        
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                with open(test_image_path, 'rb') as f:
                    files = {"file": ("test_image.jpg", f, "image/jpeg")}
                    data = {"el_folder_path": "test/folder", "confidence": 0.5}
                    
                    response = await client.post(
                        f"{self.api_base}/detect/detect-defect",
                        files=files,
                        data=data
                    )
                
                if response.status_code != 200:
                    raise Exception(f"Upload failed: {response.status_code} - {response.text}")
                
                result = response.json()
                return f"Upload successful, processing time: {result['processing_time_ms']}ms"
        
        finally:
            if test_image_path.exists():
                test_image_path.unlink()
    
    async def test_detection_pipeline(self):
        """Test complete detection pipeline"""
        # Get a test image
        source_files = list(self.smb_mount.rglob("*.jpg"))[:1]
        if not source_files:
            raise Exception("No test images available")
        
        test_file = source_files[0]
        print(f"Using test image: {test_file}")
        start_time = time.time()
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            with open(test_file, 'rb') as f:
                files = {"file": (test_file.name, f, "image/jpeg")}
                data = {"el_folder_path": "pipeline/test", "confidence": 0.3}
                response = await client.post(
                    f"{self.api_base}/detect/detect-defect",
                    files=files,
                    data=data
                )
        
        if response.status_code != 200:
            raise Exception(f"Detection failed: {response.status_code}")
        
        result = response.json()
        total_time = int((time.time() - start_time) * 1000)
        
        # Verify files were created
        processed_dir = Path("processed")
        if not any(processed_dir.rglob("*annotated*")):
            raise Exception("No annotated images created")
        
        return f"Pipeline complete: {result['total_defects']} defects, {total_time}ms total"
    
    async def test_directories(self):
        """Test directory structure"""
        required_dirs = [
            Path("source"),
            Path("processed"),
            Path("backup"),
            Path("logs")
        ]
        
        for dir_path in required_dirs:
            if not dir_path.exists():
                raise Exception(f"Required directory missing: {dir_path}")
            
            # Test write access
            test_file = dir_path / "test_write.tmp"
            try:
                test_file.touch()
                test_file.unlink()
            except Exception as e:
                raise Exception(f"Cannot write to {dir_path}: {e}")
        
        return f"All {len(required_dirs)} directories accessible"
    
    async def test_database(self):
        """Test database connectivity"""
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{self.api_base}/health/detailed")
            health_data = response.json()
            
            if health_data["components"]["database"] != "connected":
                raise Exception("Database not connected")
            
            return "Database connected successfully"
    
    def print_summary(self):
        """Print test results summary"""
        logger.info("\n" + "="*60)
        logger.info("🧪 SAATVIK EL DETECTION TEST RESULTS")
        logger.info("="*60)
        
        passed = sum(1 for _, status, _ in self.test_results if "PASS" in status)
        total = len(self.test_results)
        
        for test_name, status, details in self.test_results:
            logger.info(f"{status} {test_name}: {details}")
        
        logger.info("="*60)
        if passed == total:
            logger.success(f"🎉 ALL TESTS PASSED ({passed}/{total})")
            logger.success("✅ System ready for production!")
        else:
            logger.error(f"❌ {total - passed} TESTS FAILED ({passed}/{total})")
            logger.error("🔧 Please fix failing tests before proceeding")
        logger.info("="*60)

async def main():
    """Run test suite"""
    test_suite = SaatvikTestSuite()
    await test_suite.run_all_tests()

if __name__ == "__main__":
    # Setup logging
    logger.remove()
    logger.add(
        lambda msg: print(msg, end=""),
        level="INFO",
        format="{time:HH:mm:ss} | {level} | {message}\n"
    )
    
    asyncio.run(main())