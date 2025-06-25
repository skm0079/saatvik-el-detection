# FIle: app/services/yolo_service.py

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
        self, image_path: Path, confidence: float = 0.5
    ) -> Dict[str, Any]:
        """Run YOLO detection asynchronously"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self.executor, self._detect_defects_sync, str(image_path), confidence
        )

    def _detect_defects_sync(
        self, image_path: str, confidence: float
    ) -> Dict[str, Any]:
        """Synchronous YOLO detection in thread pool with SMALLER font annotations"""
        try:
            start_time = time.time()

            # Run YOLO inference
            results = self.model.predict(
                source=image_path, conf=confidence, save=False, verbose=False
            )

            # Extract detections
            detections = []
            annotated_image = None

            for result in results:
                # ENHANCED: Get annotated image with SMALLER font size
                # Load original image to customize annotation
                import cv2

                original_image = cv2.imread(image_path)

                if result.boxes is not None:
                    # Create custom annotations with smaller font
                    annotated_image = original_image.copy()

                    for box in result.boxes:
                        # Extract detection data (EXISTING LOGIC)
                        detection = {
                            "class_name": str(result.names[int(box.cls[0])]),
                            "confidence": float(box.conf[0].item()),
                            "bbox": {
                                "x": float(box.xywh[0][0].item()),
                                "y": float(box.xywh[0][1].item()),
                                "width": float(box.xywh[0][2].item()),
                                "height": float(box.xywh[0][3].item()),
                            },
                            "bbox_normalized": {
                                "x1": float(box.xyxyn[0][0].item()),
                                "y1": float(box.xyxyn[0][1].item()),
                                "x2": float(box.xyxyn[0][2].item()),
                                "y2": float(box.xyxyn[0][3].item()),
                            },
                        }
                        detections.append(detection)

                        # CUSTOM ANNOTATION with SMALLER font
                        # Get bounding box coordinates
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        class_name = detection["class_name"]
                        conf = detection["confidence"]

                        # Draw bounding box (same color as YOLO default)
                        color = (255, 0, 255)  # Magenta/Pink color
                        thickness = 2
                        cv2.rectangle(
                            annotated_image,
                            (int(x1), int(y1)),
                            (int(x2), int(y2)),
                            color,
                            thickness,
                        )

                        # SMALLER font size for text
                        label = f"{class_name} {conf:.2f}"

                        # Calculate font scale based on image size (SMALLER than default)
                        img_height, img_width = annotated_image.shape[:2]
                        base_font_scale = (
                            min(img_width, img_height) / 2000
                        )  # Much smaller base
                        font_scale = max(
                            0.3, base_font_scale
                        )  # Minimum 0.3, much smaller than YOLO default
                        font_thickness = max(1, int(font_scale * 2))  # Thinner text

                        # Get text size for background rectangle
                        (text_width, text_height), baseline = cv2.getTextSize(
                            label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, font_thickness
                        )

                        # Position text above the box (with small margin)
                        text_x = int(x1)
                        text_y = int(y1) - 5  # Small margin above box

                        # Ensure text stays within image bounds
                        if text_y - text_height < 0:
                            text_y = (
                                int(y1) + text_height + 5
                            )  # Place below box if no space above

                        # Draw text background (semi-transparent)
                        cv2.rectangle(
                            annotated_image,
                            (text_x, text_y - text_height),
                            (text_x + text_width, text_y + baseline),
                            color,
                            cv2.FILLED,
                        )

                        # Draw text with SMALLER font
                        cv2.putText(
                            annotated_image,
                            label,
                            (text_x, text_y),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            font_scale,  # SMALLER font scale
                            (255, 255, 255),  # White text
                            font_thickness,  # Thinner text
                            cv2.LINE_AA,
                        )
                else:
                    # No detections - use original image
                    annotated_image = original_image

            processing_time = (time.time() - start_time) * 1000

            logger.info(
                f"✅ YOLO detection complete: {len(detections)} defects, smaller font applied"
            )

            return {
                "total_defects": len(detections),
                "defects": detections,
                "processing_time_ms": int(processing_time),
                "annotated_image": annotated_image,
                "model_confidence": confidence,
                "image_path": image_path,
                "annotation_style": "custom_small_font",
            }

        except Exception as e:
            logger.error(f"YOLO detection failed for {image_path}: {e}")
            raise RuntimeError(f"Detection failed: {e}")

    async def save_results(
        self,
        detection_result: Dict[str, Any],
        detection_id: str,
        original_filename: str,
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
                "timestamp": datetime.now().isoformat(),
            }

            with open(json_path, "w") as f:
                json.dump(json_data, f, indent=2)

            return {
                "annotated_image_path": str(
                    annotated_path.relative_to(settings.processed_dir)
                ),
                "json_results_path": str(json_path.relative_to(settings.processed_dir)),
                "thumbnail_path": str(
                    thumbnail_path.relative_to(settings.processed_dir)
                ),
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
