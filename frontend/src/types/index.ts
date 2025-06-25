// file: src/types/index.ts

// Detection record from /api/v1/detect/recent
export interface DetectionRecord {
  detection_id: string;
  original_filename: string;
  machine_id: string;
  machine_name: string;
  total_defects: number;
  status: string;
  created_at: string;
  processing_time_ms: number;
  confidence_threshold: number;
  annotated_image_path: string;
  thumbnail_path: string;
  el_folder_path: string;
  error_message?: string;
  paths_at_creation?: {  // Historical paths when detection was created
    source: string;
    watch: string;
    processed: string;
  };
}

// Response from /api/v1/detect/recent
export interface RecentDetectionsResponse {
  total: number;
  limit: number;
  offset: number;
  machine_filter: string;      // Active machine filter
  detections: DetectionRecord[];
}

// Machine info from /api/v1/detect/machines
export interface MachineInfo {
  current_machine: string;
  current_mode: string;
  available_machines: string[];
  machine_names: Record<string, string>;
  current_machine_paths?: {
    source: string;
    watch: string;
    processed: string;
  };
  paths_context?: string;  // "current_operational" 
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
  machine_id: string;          // Machine context
  machine_name: string;        // Machine context
  environment: string;         // Environment context
}

// Search filters for queries - UPDATED with date filtering
export interface SearchFilters {
  search?: string;
  status?: string;
  date_from?: string;          // NEW: ISO date string for filtering
  date_to?: string;            // NEW: ISO date string for filtering
  min_defects?: number;
  max_defects?: number;
  machine_id?: string;         // Machine filter
}

// NEW: Date range for UI components
export interface DateRange {
  from: Date | null;
  to: Date | null;
}