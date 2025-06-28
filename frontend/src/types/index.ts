// File: src/types/index.ts

// Grid configuration from backend
export interface GridConfig {
  num_rows: number;
  num_cols: number;
  row_labels: string[];
  enable_grid_mapping: boolean;
}

// Grid statistics from backend
export interface GridStatistics {
  cells_with_defects: number;
  defects_per_cell: Record<string, number>;
  defects_by_class_and_cell?: Record<string, Record<string, number>>;
  most_affected_cells: Array<[string, number]>;
}

// Enhanced defect details with grid information
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
  // NEW: Grid cell information from enhanced backend
  grid_cell?: string;
  center_coordinates?: {
    x: number;
    y: number;
  };
  image_dimensions?: {
    width: number;
    height: number;
  };
}

// Enhanced detection record with grid support
export interface DetectionRecord {
  detection_id: string;
  original_filename: string;  // Now prominently displayed
  machine_id: string;
  machine_name: string;
  total_defects: number;
  status: string;
  created_at: string;
  processing_time_ms: number;
  confidence_threshold: number;
  annotated_image_path: string;
  thumbnail_path: string;
  grid_report_path?: string;
  el_folder_path: string;
  error_message?: string;

  // Historical paths when detection was created
  paths_at_creation?: {
    source: string;
    watch: string;
    processed: string;
  };

  // NEW: Grid information from enhanced backend
  affected_cells?: string[];           // ["A15", "C22"]
  cells_with_defects?: number;         // 3
  grid_summary?: string;               // "3 cells affected"
  grid_config?: GridConfig;
  grid_statistics?: GridStatistics;

  // Enhanced detection details
  detection_details?: {
    total_defects: number;
    processing_time_ms: number;
    model_confidence: number;
    image_path: string;
    defects: DefectDetails[];
    image_dimensions?: {
      width: number;
      height: number;
    };
  };
}

// Response from enhanced /api/v1/detect/recent
export interface RecentDetectionsResponse {
  total: number;
  limit: number;
  offset: number;
  machine_filter: string;
  detections: DetectionRecord[];
  date_filters?: {
    date_from?: string;
    date_to?: string;
  };
  current_machine_paths?: {
    source: string;
    watch: string;
    processed: string;
  };
  paths_context?: string;
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
  paths_context?: string;
  last_updated?: string;
}

// Health check response
export interface HealthResponse {
  status: string;
  timestamp: number;
  service: string;
  machine_id: string;
  machine_name: string;
  environment: string;
}

// NEW: Dashboard analytics from /api/v1/analytics/dashboard
export interface DashboardAnalytics {
  totals: {
    images_processed: number;
    total_defects_found: number;
    avg_defects_per_image: number;
    avg_processing_time_ms: number;
  };
  today: {
    images_today: number;
    defects_today: number;
    avg_defects_today: number;
    most_affected_cells_today: Array<[string, number]>;
  };
  grid_insights: {
    total_unique_cells_affected: number;
    most_affected_cells_overall: Array<[string, number]>;
    grid_config: {
      rows: number;
      cols: number;
      total_cells: number;
    };
  };
  defect_breakdown: {
    by_type: Record<string, number>;
    by_machine: Record<string, { images: number; defects: number }>;
  };
  date_range: {
    from?: string;
    to?: string;
    timezone: string;
  };
}

// NEW: Individual image analysis from /api/v1/analytics/image/{id}
export interface ImageAnalysis {
  image_info: {
    detection_id: string;
    original_filename: string;
    processed_at_ist: string;
    machine_name: string;
    machine_id: string;
    processing_time_ms: number;
    confidence_threshold: number;
    file_size_bytes: number;
  };
  defect_analysis: {
    total_defects: number;
    defects_by_cell: Record<string, Array<{
      type: string;
      confidence: number;
      coordinates: { x: number; y: number };
      bbox: any;
    }>>;
    affected_cells: string[];
    defect_coordinates: Array<{
      grid_cell: string;
      center_x: number;
      center_y: number;
      defect_type: string;
      confidence: number;
    }>;
  };
  grid_data: {
    grid_config: GridConfig;
    grid_statistics: GridStatistics;
    image_dimensions: { width: number; height: number };
  };
  file_paths: {
    annotated_image: string;
    thumbnail: string;
    grid_report?: string;
    json_results: string;
  };
}

// Enhanced search filters
export interface SearchFilters {
  search?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  min_defects?: number;
  max_defects?: number;
  machine_id?: string;
  // NEW: Grid-specific filters
  grid_cell?: string;
}

// Date range for UI components
export interface DateRange {
  from: Date | null;
  to: Date | null;
}