// file: src/constants/config.ts

export const API = {
  BASE_URL: '/api/v1',
  RECENT: '/detect/recent',
  STATUS: '/detect/status',
  HEALTH: '/health',
  MACHINES: '/detect/machines'  // 🆕 NEW: Machine endpoint
} as const;

export const ROUTES = {
  LIVE: '/',           // Live Image Viewer (new landing page)
  DASHBOARD: '/dashboard',
  HISTORY: '/history',
  DETAIL: '/detail'
} as const;

export const UI = {
  DEFAULT_LIMIT: 10,
  REFRESH_INTERVAL: 5000,  // 5 seconds for auto-refresh
  POLLING_INTERVAL: 4000   // 4 seconds for live mode
} as const;

export const MESSAGES = {
  LOADING: 'Loading...',
  NO_DATA: 'No detections found',
  ERROR: 'Something went wrong'
} as const;

// 🆕 NEW: Machine filter constants
export const MACHINE_FILTER = {
  ALL_MACHINES: 'all',
  CURRENT_MACHINE: null  // null = backend default (current machine)
} as const;