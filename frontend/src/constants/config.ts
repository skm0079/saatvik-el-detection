// file: src/constants/config.ts

export const API = {
  BASE_URL: '/api/v1',
  RECENT: '/detect/recent',
  STATUS: '/detect/status',
  HEALTH: '/health'
} as const;

export const ROUTES = {
  LIVE: '/',           // Live Image Viewer (new landing page)
  DASHBOARD: '/dashboard',
  HISTORY: '/history',
  DETAIL: '/detail'
} as const;

export const UI = {
  DEFAULT_LIMIT: 10,
  REFRESH_INTERVAL: 30000,  // 30 seconds for auto-refresh
  POLLING_INTERVAL: 10000   // 10 seconds for live mode
} as const;

export const MESSAGES = {
  LOADING: 'Loading...',
  NO_DATA: 'No detections found',
  ERROR: 'Something went wrong'
} as const;