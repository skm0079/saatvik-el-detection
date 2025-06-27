// File: src/services/api.ts

import { API } from '@/constants/config';
import type {
  RecentDetectionsResponse,
  DetectionRecord,
  HealthResponse,
  SearchFilters,
  MachineInfo,
  DashboardAnalytics,
  ImageAnalysis
} from '@/types';

class ApiService {
  private async request<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API.BASE_URL}${endpoint}`);

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} - ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get recent detections with enhanced grid data
   */
  async getRecentDetections(
    limit = 20,
    offset = 0,
    filters?: SearchFilters
  ): Promise<RecentDetectionsResponse> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString()
    });

    // Add filters if provided
    if (filters?.search) params.append('search', filters.search);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.date_from) params.append('date_from', filters.date_from);
    if (filters?.date_to) params.append('date_to', filters.date_to);
    if (filters?.min_defects) params.append('min_defects', filters.min_defects.toString());
    if (filters?.max_defects) params.append('max_defects', filters.max_defects.toString());
    if (filters?.grid_cell) params.append('grid_cell', filters.grid_cell);

    // Machine filtering
    if (filters?.machine_id !== undefined) {
      params.append('machine_id', filters.machine_id);
    }

    return this.request(`${API.RECENT}?${params}`);
  }

  /**
   * Get detection by ID with enhanced grid data
   */
  async getDetectionById(detection_id: string): Promise<DetectionRecord> {
    return this.request(`${API.STATUS}/${detection_id}`);
  }

  /**
   * Get system health
   */
  async getHealth(): Promise<HealthResponse> {
    return this.request(API.HEALTH);
  }

  /**
   * Get available machines
   */
  async getMachines(): Promise<MachineInfo> {
    return this.request(API.MACHINES);
  }

  /**
   * NEW: Get dashboard analytics
   */
  async getDashboardAnalytics(
    dateFrom?: string,
    dateTo?: string,
    machineId?: string
  ): Promise<DashboardAnalytics> {
    const params = new URLSearchParams();

    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    if (machineId && machineId !== 'current') params.append('machine_id', machineId);

    const endpoint = params.toString()
      ? `${API.ANALYTICS_DASHBOARD}?${params}`
      : API.ANALYTICS_DASHBOARD;

    return this.request(endpoint);
  }

  /**
   * NEW: Get individual image analysis
   */
  async getImageAnalysis(detectionId: string): Promise<ImageAnalysis> {
    return this.request(`${API.ANALYTICS_IMAGE}/${detectionId}`);
  }

  /**
   * NEW: Export detection as PDF
   */
  async exportDetectionPDF(detectionId: string): Promise<void> {
    const response = await fetch(`${API.BASE_URL}${API.EXPORT_PDF}/${detectionId}`);

    if (!response.ok) {
      throw new Error(`PDF export failed: ${response.status}`);
    }

    // Get filename from response headers
    const contentDisposition = response.headers.get('Content-Disposition');
    const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || `detection_${detectionId}.pdf`;

    // Download file
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  /**
   * NEW: Export detection as Excel
   */
  async exportDetectionExcel(detectionId: string): Promise<void> {
    const response = await fetch(`${API.BASE_URL}${API.EXPORT_EXCEL}/${detectionId}`);

    if (!response.ok) {
      throw new Error(`Excel export failed: ${response.status}`);
    }

    // Get filename from response headers
    const contentDisposition = response.headers.get('Content-Disposition');
    const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || `detection_${detectionId}.xlsx`;

    // Download file
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  /**
   * NEW: Export bulk detections as Excel
   */
  async exportBulkExcel(
    dateFrom?: string,
    dateTo?: string,
    machineId?: string,
    limit = 1000
  ): Promise<void> {
    const params = new URLSearchParams({ limit: limit.toString() });

    if (dateFrom) params.append('date_from', dateFrom);
    if (dateTo) params.append('date_to', dateTo);
    if (machineId && machineId !== 'current') params.append('machine_id', machineId);

    const response = await fetch(`${API.BASE_URL}${API.EXPORT_BULK}?${params}`);

    if (!response.ok) {
      throw new Error(`Bulk export failed: ${response.status}`);
    }

    // Get filename from response headers
    const contentDisposition = response.headers.get('Content-Disposition');
    const filename = contentDisposition?.match(/filename="(.+)"/)?.[1] || 'detections_bulk.xlsx';

    // Download file
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
}

export const apiService = new ApiService();