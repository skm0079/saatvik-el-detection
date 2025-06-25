// file: src/hooks/useApi.ts

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiService } from '@/services/api';
import type { RecentDetectionsResponse, DetectionRecord, HealthResponse, SearchFilters, MachineInfo } from '@/types';

/**
 * Anti-flicker hook for recent detections
 */
export function useRecentDetections(limit = 20, offset = 0, filters?: SearchFilters) {
  const [data, setData] = useState<RecentDetectionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Keep track of last successful data to prevent flicker
  const lastDataRef = useRef<RecentDetectionsResponse | null>(null);

  const fetchData = useCallback(async (isRefetch = false) => {
    try {
      if (isRefetch) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const result = await apiService.getRecentDetections(limit, offset, filters);

      // Only update state if data actually changed to prevent flicker
      const resultString = JSON.stringify(result);
      const lastDataString = JSON.stringify(lastDataRef.current);

      if (resultString !== lastDataString) {
        lastDataRef.current = result;
        setData(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [limit, offset, JSON.stringify(filters)]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => fetchData(true), [fetchData]);

  return { data, loading, error, refetch, isRefreshing };
}

/**
 * Anti-flicker hook for health data
 */
export function useHealth() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Keep track of last successful data to prevent flicker
  const lastDataRef = useRef<HealthResponse | null>(null);

  const fetchData = useCallback(async (isRefetch = false) => {
    try {
      if (isRefetch) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const result = await apiService.getHealth();

      // Only update state if data actually changed to prevent flicker
      const resultString = JSON.stringify(result);
      const lastDataString = JSON.stringify(lastDataRef.current);

      if (resultString !== lastDataString) {
        lastDataRef.current = result;
        setData(result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Health check failed');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => fetchData(true), [fetchData]);

  return { data, loading, error, refetch, isRefreshing };
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

      // Log path information for debugging
      if (result.paths_at_creation) {
        console.log('📂 Historical paths loaded:', result.paths_at_creation);
      } else {
        console.log('⚠️ No historical path data available for this detection');
      }

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
 * Hook for fetching available machines
 */
export function useMachines() {
  const [data, setData] = useState<MachineInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiService.getMachines();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch machines');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return { data, loading, error, refetch: fetchData };
}