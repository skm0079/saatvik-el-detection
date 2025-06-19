from ultralytics import YOLO
import cv2
from pathlib import Path
import asyncio
import time
import json
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any
from loguru import logger

class YOLOService:
    def __init__(self, model_path: Path):
        self.model_path = model_path
        self.model: YOLO = None
        self.executor = ThreadPoolExecutor(max_workers=2)
        self._load_model()
    
    def _load_model(self):
        """Load YOLO model on service initialization"""
        try:
            logger.info(f"Loading YOLO model from {self.model_path}")
            self.model = YOLO(str(self.model_path))
            logger.success("YOLO model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load YOLO model: {e}")
            raise RuntimeError(f"Could not load YOLO model: {e}")
    
    async def detect_defects_async(
        self, 
        image_path: Path, 
        confidence: float = 0.5
    ) -> Dict[str, Any]:
        """Run YOLO detection asynchronously"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self.executor, 
            self._detect_defects_sync, 
            str(image_path), 
            confidence
        )
    
    def _detect_defects_sync(self, image_path: str, confidence: float) -> Dict[str, Any]:
        """Synchronous YOLO detection in thread pool"""
        try:
            start_time = time.time()
            
            # Run YOLO inference
            results = self.model.predict(
                source=image_path,
                conf=confidence,
                save=False,
                verbose=False
            )
            
            # Extract detections
            detections = []
            annotated_image = None
            
            for result in results:
                # Get annotated image
                annotated_image = result.plot()
                
                # Extract detection data
                if result.boxes is not None:
                    for box in result.boxes:
                        detection = {
                            "class_name": str(result.names[int(box.cls[0])]),
                            "confidence": float(box.conf[0].item()),  # .item() converts numpy to python
                            "bbox": {
                                "x": float(box.xywh[0][0].item()),
                                "y": float(box.xywh[0][1].item()),
                                "width": float(box.xywh[0][2].item()),
                                "height": float(box.xywh[0][3].item())
                            },
                            "bbox_normalized": {
                                "x1": float(box.xyxyn[0][0].item()),
                                "y1": float(box.xyxyn[0][1].item()),
                                "x2": float(box.xyxyn[0][2].item()),
                                "y2": float(box.xyxyn[0][3].item())
                            }
                        }
                        detections.append(detection)
            
            processing_time = (time.time() - start_time) * 1000  # Convert to ms
            
            return {
                "total_defects": len(detections),
                "defects": detections,
                "processing_time_ms": int(processing_time),
                "annotated_image": annotated_image,
                "model_confidence": confidence,
                "image_path": image_path
            }
            
        except Exception as e:
            logger.error(f"YOLO detection failed for {image_path}: {e}")
            raise RuntimeError(f"Detection failed: {e}")
    
    async def save_results(
        self, 
        detection_result: Dict[str, Any], 
        detection_id: str,
        original_filename: str
    ) -> Dict[str, str]:
        """Save detection results to processed folders"""
        try:
            from app.core.config import settings
            
            # Create timestamped subfolder
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            result_folder = settings.processed_dir / timestamp
            
            annotated_dir = result_folder / "annotated"
            json_dir = result_folder / "json"
            thumbnail_dir = result_folder / "thumbnails"
            
            # Create directories
            annotated_dir.mkdir(parents=True, exist_ok=True)
            json_dir.mkdir(parents=True, exist_ok=True)
            thumbnail_dir.mkdir(parents=True, exist_ok=True)
            
            # File paths
            base_name = Path(original_filename).stem
            annotated_path = annotated_dir / f"{detection_id}_{base_name}_annotated.jpg"
            json_path = json_dir / f"{detection_id}_{base_name}_results.json"
            thumbnail_path = thumbnail_dir / f"{detection_id}_{base_name}_thumb.jpg"
            
            # Save annotated image
            if detection_result.get("annotated_image") is not None:
                cv2.imwrite(str(annotated_path), detection_result["annotated_image"])
                
                # Create thumbnail
                img = cv2.imread(str(annotated_path))
                thumbnail = cv2.resize(img, (300, 200))
                cv2.imwrite(str(thumbnail_path), thumbnail)
            
            # Save JSON results
            json_data = {
                "detection_id": detection_id,
                "original_filename": original_filename,
                "total_defects": detection_result["total_defects"],
                "confidence_threshold": detection_result["model_confidence"],
                "processing_time_ms": detection_result["processing_time_ms"],
                "defects": detection_result["defects"],
                "timestamp": datetime.now().isoformat()
            }
            
            with open(json_path, 'w') as f:
                json.dump(json_data, f, indent=2)
            
            return {
                "annotated_image_path": str(annotated_path.relative_to(settings.processed_dir)),
                "json_results_path": str(json_path.relative_to(settings.processed_dir)),
                "thumbnail_path": str(thumbnail_path.relative_to(settings.processed_dir))
            }
            
        except Exception as e:
            logger.error(f"Failed to save results: {e}")
            raise RuntimeError(f"Could not save results: {e}")

# Global service instance
_yolo_service = None

def get_yolo_service() -> YOLOService:
    global _yolo_service
    if _yolo_service is None:
        from app.core.config import settings
        _yolo_service = YOLOService(settings.model_path)
    return _yolo_service