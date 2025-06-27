// File: src/hooks/useApi.ts

import { useState, useEffect, useRef, useCallback } from 'react';
import { apiService } from '@/services/api';
import type {
  RecentDetectionsResponse,
  DetectionRecord,
  HealthResponse,
  SearchFilters,
  MachineInfo,
  DashboardAnalytics,
  ImageAnalysis
} from '@/types';

/**
 * Anti-flicker hook for recent detections with grid data
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
 * Hook for health data
 */
export function useHealth() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

      // Only update if changed
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
 * Hook for fetching single detection details with grid data
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

      // Log grid information for debugging
      if (result.grid_statistics) {
        console.log('📐 Grid data loaded:', result.grid_statistics);
      }
      if (result.affected_cells?.length) {
        console.log('🔲 Affected cells:', result.affected_cells);
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

/**
 * NEW: Hook for dashboard analytics
 */
export function useDashboardAnalytics(
  dateFrom?: string,
  dateTo?: string,
  machineId?: string
) {
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const lastDataRef = useRef<DashboardAnalytics | null>(null);

  const fetchData = useCallback(async (isRefetch = false) => {
    try {
      if (isRefetch) {
        setIsRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const result = await apiService.getDashboardAnalytics(dateFrom, dateTo, machineId);

      // Only update if changed
      const resultString = JSON.stringify(result);
      const lastDataString = JSON.stringify(lastDataRef.current);

      if (resultString !== lastDataString) {
        lastDataRef.current = result;
        setData(result);
        console.log('📊 Dashboard analytics loaded:', result);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analytics failed');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [dateFrom, dateTo, machineId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => fetchData(true), [fetchData]);

  return { data, loading, error, refetch, isRefreshing };
}

/**
 * NEW: Hook for individual image analysis
 */
export function useImageAnalysis(detectionId: string) {
  const [data, setData] = useState<ImageAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!detectionId) return;

    try {
      setLoading(true);
      setError(null);
      const result = await apiService.getImageAnalysis(detectionId);

      console.log('🔍 Image analysis loaded:', result);
      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed';
      setError(errorMessage);
      console.error('Image analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [detectionId]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * NEW: Hook for export operations
 */
export function useExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportPDF = useCallback(async (detectionId: string) => {
    try {
      setIsExporting(true);
      setError(null);
      await apiService.exportDetectionPDF(detectionId);
      console.log('✅ PDF export completed');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'PDF export failed';
      setError(errorMessage);
      console.error('PDF export error:', err);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportExcel = useCallback(async (detectionId: string) => {
    try {
      setIsExporting(true);
      setError(null);
      await apiService.exportDetectionExcel(detectionId);
      console.log('✅ Excel export completed');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Excel export failed';
      setError(errorMessage);
      console.error('Excel export error:', err);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportBulk = useCallback(async (
    dateFrom?: string,
    dateTo?: string,
    machineId?: string,
    limit = 1000
  ) => {
    try {
      setIsExporting(true);
      setError(null);
      await apiService.exportBulkExcel(dateFrom, dateTo, machineId, limit);
      console.log('✅ Bulk export completed');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Bulk export failed';
      setError(errorMessage);
      console.error('Bulk export error:', err);
    } finally {
      setIsExporting(false);
    }
  }, []);

  return {
    isExporting,
    error,
    exportPDF,
    exportExcel,
    exportBulk,
    clearError: () => setError(null)
  };
}