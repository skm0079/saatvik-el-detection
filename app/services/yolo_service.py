# File: app/services/yolo_service.py

from ultralytics import YOLO
import cv2
import numpy as np
from pathlib import Path
import asyncio
import time
import json
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, Any, List, Tuple, Optional
from loguru import logger


class YOLOService:
    def __init__(self, model_path: Path):
        self.model_path = model_path
        self.model: YOLO = None
        self.executor = ThreadPoolExecutor(max_workers=2)

        # Default grid configuration
        self.grid_config = {
            "num_rows": 6,
            "num_cols": 24,
            "row_labels": ["A", "B", "C", "D", "E", "F"],
            "enable_grid_mapping": True,
        }

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

    def update_grid_config(self, grid_config: Dict[str, Any]):
        """Update grid configuration for defect mapping"""
        try:
            # Validate grid configuration
            required_keys = ["num_rows", "num_cols", "enable_grid_mapping"]
            for key in required_keys:
                if key not in grid_config:
                    logger.warning(f"Missing grid config key: {key}, using default")
                    continue
                self.grid_config[key] = grid_config[key]

            # Update row labels if provided, otherwise generate them
            if "row_labels" in grid_config:
                self.grid_config["row_labels"] = grid_config["row_labels"]
            else:
                # Generate default row labels A, B, C, etc.
                num_rows = self.grid_config["num_rows"]
                self.grid_config["row_labels"] = [chr(65 + i) for i in range(num_rows)]

            # Validate grid dimensions
            if self.grid_config["num_rows"] <= 0 or self.grid_config["num_cols"] <= 0:
                logger.error("Invalid grid dimensions, using defaults")
                self.grid_config["num_rows"] = 6
                self.grid_config["num_cols"] = 24

            logger.info(
                f"📐 Grid config updated: {self.grid_config['num_rows']}x{self.grid_config['num_cols']}, enabled: {self.grid_config['enable_grid_mapping']}"
            )

        except Exception as e:
            logger.error(f"Failed to update grid config: {e}")
            # Continue with existing grid config on error

    def _normalize_coordinates(
        self, bbox_absolute: Dict[str, float], img_width: int, img_height: int
    ) -> Dict[str, float]:
        """Convert absolute coordinates to normalized coordinates (0-1)"""
        return {
            "x": bbox_absolute["x"] / img_width,
            "y": bbox_absolute["y"] / img_height,
            "width": bbox_absolute["width"] / img_width,
            "height": bbox_absolute["height"] / img_height,
        }

    def _map_defect_to_grid_cell(self, bbox_normalized: Dict[str, float]) -> str:
        """
        Map a defect's bounding box center to a grid cell using normalized coordinates

        Args:
            bbox_normalized: Normalized bounding box with x, y (center), width, height (0-1 range)

        Returns:
            Grid cell identifier (e.g., "A15", "C22")
        """
        if not self.grid_config.get("enable_grid_mapping", True):
            return ""

        try:
            # Use normalized coordinates (0-1 range)
            center_x_norm = bbox_normalized["x"]  # Center X in normalized coordinates
            center_y_norm = bbox_normalized["y"]  # Center Y in normalized coordinates

            # Ensure coordinates are within bounds
            center_x_norm = max(0.0, min(1.0, center_x_norm))
            center_y_norm = max(0.0, min(1.0, center_y_norm))

            # Calculate grid cell indices
            col_index = min(
                int(center_x_norm * self.grid_config["num_cols"]),
                self.grid_config["num_cols"] - 1,
            )
            row_index = min(
                int(center_y_norm * self.grid_config["num_rows"]),
                self.grid_config["num_rows"] - 1,
            )

            # Get row label (A, B, C, etc.)
            if row_index < len(self.grid_config["row_labels"]):
                row_label = self.grid_config["row_labels"][row_index]
            else:
                row_label = chr(65 + row_index)  # Fallback to A, B, C...

            # Column number (1-based)
            col_number = col_index + 1

            grid_cell = f"{row_label}{col_number}"

            logger.debug(
                f"Mapped defect at ({center_x_norm:.3f}, {center_y_norm:.3f}) to grid cell {grid_cell}"
            )
            return grid_cell

        except Exception as e:
            logger.warning(f"Failed to map defect to grid cell: {e}")
            return ""

    def _calculate_grid_statistics(
        self, defects: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Calculate comprehensive grid-based statistics from detected defects"""
        if not self.grid_config.get("enable_grid_mapping", True):
            return {}

        try:
            grid_stats = {
                "defects_per_cell": {},
                "cells_with_defects": 0,
                "total_defects": len(defects),
                "grid_coverage_percentage": 0.0,
                "max_defects_per_cell": 0,
                "avg_defects_per_affected_cell": 0.0,
                "affected_cells_list": [],
                "grid_config_used": self.grid_config.copy(),
            }

            # Count defects per cell
            for defect in defects:
                grid_cell = defect.get("grid_cell", "")
                if grid_cell:
                    if grid_cell not in grid_stats["defects_per_cell"]:
                        grid_stats["defects_per_cell"][grid_cell] = 0
                    grid_stats["defects_per_cell"][grid_cell] += 1

            # Calculate summary statistics
            if grid_stats["defects_per_cell"]:
                grid_stats["cells_with_defects"] = len(grid_stats["defects_per_cell"])
                grid_stats["affected_cells_list"] = sorted(
                    grid_stats["defects_per_cell"].keys()
                )
                grid_stats["max_defects_per_cell"] = max(
                    grid_stats["defects_per_cell"].values()
                )
                grid_stats["avg_defects_per_affected_cell"] = sum(
                    grid_stats["defects_per_cell"].values()
                ) / len(grid_stats["defects_per_cell"])

                total_cells = (
                    self.grid_config["num_rows"] * self.grid_config["num_cols"]
                )
                grid_stats["grid_coverage_percentage"] = (
                    grid_stats["cells_with_defects"] / total_cells
                ) * 100

            logger.debug(
                f"Grid statistics calculated: {grid_stats['cells_with_defects']} cells affected out of {self.grid_config['num_rows'] * self.grid_config['num_cols']} total"
            )
            return grid_stats

        except Exception as e:
            logger.error(f"Failed to calculate grid statistics: {e}")
            return {}

    def _draw_grid_overlay(self, image: np.ndarray, alpha: float = 0.3) -> np.ndarray:
        """
        Draw grid overlay on the image for visualization

        Args:
            image: Input image array
            alpha: Transparency of grid lines (0-1)

        Returns:
            Image with grid overlay
        """
        if not self.grid_config.get("enable_grid_mapping", True):
            return image

        try:
            overlay = image.copy()
            img_height, img_width = image.shape[:2]

            # Calculate grid cell dimensions
            cell_width = img_width / self.grid_config["num_cols"]
            cell_height = img_height / self.grid_config["num_rows"]

            # Grid line color (light gray)
            grid_color = (128, 128, 128)
            line_thickness = 1

            # Draw vertical lines
            for col in range(1, self.grid_config["num_cols"]):
                x = int(col * cell_width)
                cv2.line(overlay, (x, 0), (x, img_height), grid_color, line_thickness)

            # Draw horizontal lines
            for row in range(1, self.grid_config["num_rows"]):
                y = int(row * cell_height)
                cv2.line(overlay, (0, y), (img_width, y), grid_color, line_thickness)

            # Blend with original image
            cv2.addWeighted(overlay, alpha, image, 1 - alpha, 0, image)

            return image

        except Exception as e:
            logger.warning(f"Failed to draw grid overlay: {e}")
            return image

    async def detect_defects_async(
        self, image_path: Path, confidence: float = 0.2
    ) -> Dict[str, Any]:
        """Run YOLO detection asynchronously with comprehensive grid mapping"""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(
            self.executor, self._detect_defects_sync, str(image_path), confidence
        )

    def _detect_defects_sync(
        self, image_path: str, confidence: float
    ) -> Dict[str, Any]:
        """Synchronous YOLO detection with grid mapping and enhanced annotations"""
        try:
            start_time = time.time()
            logger.info(f"🔍 Starting YOLO detection on {image_path}")

            # Run YOLO inference
            results = self.model.predict(
                source=image_path, conf=confidence, save=False, verbose=False
            )

            # Load original image
            original_image = cv2.imread(image_path)
            if original_image is None:
                raise RuntimeError(f"Could not load image: {image_path}")

            # Get image dimensions
            img_height, img_width = original_image.shape[:2]
            image_dimensions = {"width": img_width, "height": img_height}

            # Extract detections
            detections = []
            annotated_image = original_image.copy()

            # Draw grid overlay if enabled
            if self.grid_config.get("enable_grid_mapping", True):
                annotated_image = self._draw_grid_overlay(annotated_image)

            for result in results:
                if result.boxes is not None:
                    for box in result.boxes:
                        # Extract detection data with both coordinate systems
                        bbox_absolute = {
                            "x": float(box.xywh[0][0].item()),  # Center X (absolute)
                            "y": float(box.xywh[0][1].item()),  # Center Y (absolute)
                            "width": float(box.xywh[0][2].item()),  # Width (absolute)
                            "height": float(box.xywh[0][3].item()),  # Height (absolute)
                        }

                        bbox_normalized = {
                            "x1": float(
                                box.xyxyn[0][0].item()
                            ),  # Top-left X (normalized)
                            "y1": float(
                                box.xyxyn[0][1].item()
                            ),  # Top-left Y (normalized)
                            "x2": float(
                                box.xyxyn[0][2].item()
                            ),  # Bottom-right X (normalized)
                            "y2": float(
                                box.xyxyn[0][3].item()
                            ),  # Bottom-right Y (normalized)
                        }

                        # Calculate normalized center coordinates for grid mapping
                        bbox_center_normalized = {
                            "x": (bbox_normalized["x1"] + bbox_normalized["x2"]) / 2,
                            "y": (bbox_normalized["y1"] + bbox_normalized["y2"]) / 2,
                            "width": bbox_normalized["x2"] - bbox_normalized["x1"],
                            "height": bbox_normalized["y2"] - bbox_normalized["y1"],
                        }

                        # Map to grid cell using normalized coordinates
                        grid_cell = self._map_defect_to_grid_cell(
                            bbox_center_normalized
                        )

                        detection = {
                            "class_name": str(result.names[int(box.cls[0])]),
                            "confidence": float(box.conf[0].item()),
                            "bbox": bbox_absolute,  # Absolute coordinates for compatibility
                            "bbox_normalized": bbox_normalized,  # Normalized coordinates
                            "grid_cell": grid_cell,
                            "center_coordinates": {
                                "x_absolute": bbox_absolute["x"],
                                "y_absolute": bbox_absolute["y"],
                                "x_normalized": bbox_center_normalized["x"],
                                "y_normalized": bbox_center_normalized["y"],
                            },
                            "image_dimensions": image_dimensions,
                        }

                        detections.append(detection)

                        # Draw bounding box annotation
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        class_name = detection["class_name"]
                        conf = detection["confidence"]

                        # Bounding box
                        color = (255, 0, 255)  # Magenta
                        thickness = 2
                        cv2.rectangle(
                            annotated_image,
                            (int(x1), int(y1)),
                            (int(x2), int(y2)),
                            color,
                            thickness,
                        )

                        # Label with grid cell info
                        label = f"{class_name} {conf:.2f}"
                        if grid_cell:
                            label += f" ({grid_cell})"

                        # Calculate appropriate font scale
                        base_font_scale = min(img_width, img_height) / 2000
                        font_scale = max(0.4, base_font_scale)
                        font_thickness = max(1, int(font_scale * 2))

                        # Get text size
                        (text_width, text_height), baseline = cv2.getTextSize(
                            label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, font_thickness
                        )

                        # Position text
                        text_x = int(x1)
                        text_y = int(y1) - 5
                        if text_y - text_height < 0:
                            text_y = int(y1) + text_height + 5

                        # Draw text background
                        cv2.rectangle(
                            annotated_image,
                            (text_x, text_y - text_height),
                            (text_x + text_width, text_y + baseline),
                            color,
                            cv2.FILLED,
                        )

                        # Draw text
                        cv2.putText(
                            annotated_image,
                            label,
                            (text_x, text_y),
                            cv2.FONT_HERSHEY_SIMPLEX,
                            font_scale,
                            (255, 255, 255),
                            font_thickness,
                            cv2.LINE_AA,
                        )

            processing_time = (time.time() - start_time) * 1000

            # Calculate grid statistics
            grid_statistics = self._calculate_grid_statistics(detections)

            logger.success(
                f"✅ YOLO detection complete: {len(detections)} defects found in {processing_time:.1f}ms"
            )

            if grid_statistics.get("cells_with_defects", 0) > 0:
                logger.info(
                    f"📊 Grid analysis: {grid_statistics['cells_with_defects']} cells affected ({grid_statistics['grid_coverage_percentage']:.1f}% coverage)"
                )

            return {
                "total_defects": len(detections),
                "defects": detections,
                "processing_time_ms": int(processing_time),
                "annotated_image": annotated_image,
                "model_confidence": confidence,
                "image_path": image_path,
                "annotation_style": "custom_with_grid_overlay",
                "grid_statistics": grid_statistics,
                "image_dimensions": image_dimensions,
                "grid_config_used": self.grid_config.copy(),
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
        """Save detection results with comprehensive file organization"""
        try:
            from app.core.config import settings

            # Create timestamped subfolder
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            result_folder = settings.processed_dir / timestamp

            # Create organized directory structure
            directories = {
                "annotated": result_folder / "annotated",
                "json": result_folder / "json",
                "thumbnails": result_folder / "thumbnails",
                "grid_reports": result_folder / "grid_reports",
            }

            for directory in directories.values():
                directory.mkdir(parents=True, exist_ok=True)

            # Generate file paths
            base_name = Path(original_filename).stem
            file_paths = {
                "annotated": directories["annotated"]
                / f"{detection_id}_{base_name}_annotated.jpg",
                "json": directories["json"]
                / f"{detection_id}_{base_name}_results.json",
                "thumbnail": directories["thumbnails"]
                / f"{detection_id}_{base_name}_thumb.jpg",
                "grid_report": directories["grid_reports"]
                / f"{detection_id}_{base_name}_grid_report.json",
            }

            # Save annotated image
            if detection_result.get("annotated_image") is not None:
                cv2.imwrite(
                    str(file_paths["annotated"]), detection_result["annotated_image"]
                )
                logger.debug(f"Saved annotated image: {file_paths['annotated']}")

                # Create thumbnail
                img = cv2.imread(str(file_paths["annotated"]))
                if img is not None:
                    thumbnail = cv2.resize(img, (300, 200))
                    cv2.imwrite(str(file_paths["thumbnail"]), thumbnail)
                    logger.debug(f"Created thumbnail: {file_paths['thumbnail']}")

            # Save comprehensive JSON results
            json_data = {
                "detection_id": detection_id,
                "original_filename": original_filename,
                "total_defects": detection_result["total_defects"],
                "confidence_threshold": detection_result["model_confidence"],
                "processing_time_ms": detection_result["processing_time_ms"],
                "defects": detection_result["defects"],
                "grid_statistics": detection_result.get("grid_statistics", {}),
                "grid_config_used": detection_result.get("grid_config_used", {}),
                "image_dimensions": detection_result.get("image_dimensions", {}),
                "annotation_style": detection_result.get("annotation_style", ""),
                "timestamp": datetime.now().isoformat(),
            }

            with open(file_paths["json"], "w") as f:
                json.dump(json_data, f, indent=2)
            logger.debug(f"Saved JSON results: {file_paths['json']}")

            # Save dedicated grid report
            if detection_result.get("grid_statistics"):
                grid_report = {
                    "detection_id": detection_id,
                    "original_filename": original_filename,
                    "grid_config": detection_result.get("grid_config_used", {}),
                    "grid_statistics": detection_result["grid_statistics"],
                    "affected_cells": detection_result["grid_statistics"].get(
                        "affected_cells_list", []
                    ),
                    "defects_by_cell": detection_result["grid_statistics"].get(
                        "defects_per_cell", {}
                    ),
                    "summary": {
                        "total_cells": detection_result.get("grid_config_used", {}).get(
                            "num_rows", 0
                        )
                        * detection_result.get("grid_config_used", {}).get(
                            "num_cols", 0
                        ),
                        "affected_cells": detection_result["grid_statistics"].get(
                            "cells_with_defects", 0
                        ),
                        "coverage_percentage": detection_result["grid_statistics"].get(
                            "grid_coverage_percentage", 0.0
                        ),
                        "max_defects_per_cell": detection_result["grid_statistics"].get(
                            "max_defects_per_cell", 0
                        ),
                    },
                    "timestamp": datetime.now().isoformat(),
                }

                with open(file_paths["grid_report"], "w") as f:
                    json.dump(grid_report, f, indent=2)
                logger.debug(f"Saved grid report: {file_paths['grid_report']}")

            # Return relative paths for database storage
            result_paths = {
                "annotated_image_path": str(
                    file_paths["annotated"].relative_to(settings.processed_dir)
                ),
                "json_results_path": str(
                    file_paths["json"].relative_to(settings.processed_dir)
                ),
                "thumbnail_path": str(
                    file_paths["thumbnail"].relative_to(settings.processed_dir)
                ),
            }

            # Add grid report path if created
            if detection_result.get("grid_statistics"):
                result_paths["grid_report_path"] = str(
                    file_paths["grid_report"].relative_to(settings.processed_dir)
                )

            logger.success(f"📁 All results saved for detection {detection_id}")
            return result_paths

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
