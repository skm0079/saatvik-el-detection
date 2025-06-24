// file: src/types/index.ts

// Detection record from /api/v1/detect/recent
export interface DetectionRecord {
  detection_id: string;
  original_filename: string;
  machine_id: string;          // 🆕 NEW: Machine context
  machine_name: string;        // 🆕 NEW: Machine context
  total_defects: number;
  status: string;
  created_at: string;
  processing_time_ms: number;
  confidence_threshold: number;
  annotated_image_path: string;
  thumbnail_path: string;
  el_folder_path: string;
  error_message?: string;
}

// Response from /api/v1/detect/recent
export interface RecentDetectionsResponse {
  total: number;
  limit: number;
  offset: number;
  machine_filter: string;      // 🆕 NEW: Active machine filter
  detections: DetectionRecord[];
}

// 🆕 NEW: Machine info from /api/v1/detect/machines
export interface MachineInfo {
  current_machine: string;
  current_mode: string;
  available_machines: string[];
  machine_names: Record<string, string>;
}

// Defect details from detection
export interface DefectDetails {
  class_name: string;
  confidence: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  bbox_normalized: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

// Health check response with machine context
export interface HealthResponse {
  status: string;
  timestamp: number;
  service: string;
  machine_id: string;          // 🆕 NEW: Machine context
  machine_name: string;        // 🆕 NEW: Machine context
  environment: string;         // 🆕 NEW: Environment context
}

// Search filters for queries
export interface SearchFilters {
  search?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  min_defects?: number;
  max_defects?: number;
  machine_id?: string;         // 🆕 NEW: Machine filter
}