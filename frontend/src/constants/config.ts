// File: src/constants/config.ts

export const API = {
  BASE_URL: '/api/v1',

  // Existing endpoints (enhanced)
  RECENT: '/detect/recent',
  STATUS: '/detect/status',
  HEALTH: '/health',
  MACHINES: '/detect/machines',

  // NEW: Analytics endpoints
  ANALYTICS_DASHBOARD: '/analytics/dashboard',
  ANALYTICS_IMAGE: '/analytics/image',
  ANALYTICS_GRID: '/analytics/grid-summary',

  // NEW: Export endpoints
  EXPORT_PDF: '/export/pdf',
  EXPORT_EXCEL: '/export/excel',
  EXPORT_BULK: '/export/excel/bulk'
} as const;

export const ROUTES = {
  LIVE: '/',
  DASHBOARD: '/dashboard',
  HISTORY: '/history',
  DETAIL: '/detail'
} as const;

export const UI = {
  DEFAULT_LIMIT: 10,
  REFRESH_INTERVAL: 30000,  // 30 seconds
  POLLING_INTERVAL: 5000    // 5 seconds for live mode
} as const;

export const MESSAGES = {
  LOADING: 'Loading...',
  NO_DATA: 'No detections found',
  ERROR: 'Something went wrong'
} as const;

// Machine filter constants
export const MACHINE_FILTER = {
  ALL_MACHINES: 'all',
  CURRENT_MACHINE: null  // null = backend default (current machine)
} as const;

// NEW: Grid configuration constants
export const GRID_CONFIG = {
  DEFAULT_ROWS: 6,
  DEFAULT_COLS: 24,
  DEFAULT_LABELS: ['A', 'B', 'C', 'D', 'E', 'F'],
  TOTAL_CELLS: 144
} as const;

// NEW: Color scheme for grid visualization
export const GRID_COLORS = {
  NO_DEFECTS: '#f0f9ff',      // Light blue
  LOW_DEFECTS: '#fef3c7',     // Light yellow  
  MEDIUM_DEFECTS: '#fed7aa',  // Light orange
  HIGH_DEFECTS: '#fecaca',    // Light red
  VERY_HIGH_DEFECTS: '#fca5a5' // Red
} as const;

// NEW: Export configuration
export const EXPORT_CONFIG = {
  MAX_BULK_RECORDS: 1000,
  PDF_SUPPORTED: true,
  EXCEL_SUPPORTED: true
} as const;