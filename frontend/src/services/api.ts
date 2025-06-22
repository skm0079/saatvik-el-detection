// file: src/services/api.ts

import { API } from '@/constants/config';
import type { RecentDetectionsResponse, DetectionRecord, HealthResponse, SearchFilters } from '@/types';

class ApiService {
  private async request<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${API.BASE_URL}${endpoint}`);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    return response.json();
  }

  /**
   * Get recent detections with pagination and filters
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

    return this.request(`${API.RECENT}?${params}`);
  }

  /**
   * Get detection by ID
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
}

export const apiService = new ApiService();