// file: src/hooks/useApi.ts

import { useState, useEffect } from 'react';
import { apiService } from '@/services/api';
import type { RecentDetectionsResponse, DetectionRecord, HealthResponse, SearchFilters } from '@/types';

/**
 * Hook for fetching recent detections
 */
export function useRecentDetections(limit = 20, offset = 0, filters?: SearchFilters) {
  const [data, setData] = useState<RecentDetectionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiService.getRecentDetections(limit, offset, filters);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [limit, offset, JSON.stringify(filters)]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook for fetching single detection details
 */
export function useDetectionDetail(detection_id: string) {
  const [data, setData] = useState<DetectionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!detection_id) return;

    try {
      setLoading(true);
      setError(null);
      const result = await apiService.getDetectionById(detection_id);
      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Detection not found';
      setError(errorMessage);
      console.error('Detection fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [detection_id]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook for system health monitoring
 */
export function useHealth() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiService.getHealth();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Health check failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refetch: fetchData };
}