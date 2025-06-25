// File: src/components/DetectionHistory.tsx
// UPDATED: Added IST time display and enhanced date filtering

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecentDetections } from '@/hooks/useApi';
import { useSearch } from '@/hooks/useSearch';
import { ImageUtils } from '@/services/imageUtils';
import { TimeUtils } from '@/utils/timeUtils'; // NEW: Import time utilities
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { UI, ROUTES, MACHINE_FILTER } from '@/constants/config';
import type { SearchFilters } from '@/types';
import { MachineSelector } from './common/MachineSelector';

export function DetectionHistory() {
  const navigate = useNavigate();

  // Core state
  const [limit, setLimit] = useState<number>(UI.DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [selectedMachine, setSelectedMachine] = useState<string | null>(MACHINE_FILTER.CURRENT_MACHINE);

  // Date filtering state
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  const handleSearch = useCallback((query: string) => {
    setFilters(prev => ({ ...prev, search: query || undefined }));
    setOffset(0);
  }, []);

  const { searchQuery, setSearchQuery, isWaitingForMinLength } = useSearch({
    minLength: 3,
    delay: 500,
    onSearch: handleSearch
  });

  // ENHANCED: Combine all filters with proper UTC conversion
  const allFilters = {
    ...filters,
    machine_id: selectedMachine ?? undefined,
    date_from: dateFrom ? TimeUtils.localToUTC(dateFrom) : undefined,
    date_to: dateTo ? TimeUtils.localToUTC(dateTo) : undefined
  };

  const { data, loading, error, refetch } = useRecentDetections(limit, offset, allFilters);

  const handleNextPage = useCallback(() => {
    if (data && offset + limit < data.total) {
      setOffset(prev => prev + limit);
    }
  }, [data, offset, limit]);

  const handlePrevPage = useCallback(() => {
    if (offset > 0) {
      setOffset(prev => Math.max(0, prev - limit));
    }
  }, [offset, limit]);

  const handleViewDetail = useCallback((detection_id: string) => {
    navigate(`${ROUTES.DETAIL}/${detection_id}`);
  }, [navigate]);

  const handleMachineChange = useCallback((machineId: string | null) => {
    setSelectedMachine(machineId);
    setOffset(0);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setFilters(prev => ({ ...prev, search: undefined }));
  }, [setSearchQuery]);

  const handleLimitChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setLimit(Number(e.target.value));
    setOffset(0);
  }, []);

  const handleClearDates = useCallback(() => {
    setDateFrom('');
    setDateTo('');
    setOffset(0);
  }, []);

  // XLSX Export handler
  const handleExportXLSX = useCallback(async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams({
        limit: '10000',
        offset: '0',
        format: 'xlsx'
      });

      if (selectedMachine && selectedMachine !== MACHINE_FILTER.CURRENT_MACHINE) {
        params.append('machine_id', selectedMachine);
      }
      if (dateFrom) {
        params.append('date_from', TimeUtils.localToUTC(dateFrom));
      }
      if (dateTo) {
        params.append('date_to', TimeUtils.localToUTC(dateTo));
      }
      if (filters.search) {
        params.append('search', filters.search);
      }

      const response = await fetch(`/api/v1/detect/recent?${params}`);
      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      let filename = `saatvik_detections_${new Date().toISOString().slice(0, 10)}`;
      if (selectedMachine && selectedMachine !== MACHINE_FILTER.CURRENT_MACHINE) {
        filename += `_${selectedMachine.replace(/\s+/g, '_')}`;
      }
      if (dateFrom || dateTo) {
        filename += '_filtered';
      }
      filename += '.xlsx';

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log('✅ XLSX export completed successfully');
    } catch (error) {
      console.error('❌ Export failed:', error);
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  }, [selectedMachine, dateFrom, dateTo, filters.search]);

  if (loading) return <LoadingSpinner message="Loading detections..." />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!data) return <ErrorMessage message="No data available" />;

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(data.total / limit);

  return (
    <div className="space-y-6">
      {/* Header with Export */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">🔍 Detection History</h1>
          <p className="text-slate-600 mt-1">Browse and analyze all EL detection results</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleExportXLSX}
            disabled={isExporting}
            className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 shadow-md hover:shadow-lg flex items-center space-x-2"
          >
            {isExporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <span>📊</span>
                <span>Export XLSX</span>
              </>
            )}
          </button>
          <button
            onClick={refetch}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 shadow-md hover:shadow-lg"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Search & Filters Section */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
        <div className="space-y-6">
          {/* Row 1: Machine Selector & Search */}
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-shrink-0">
              <MachineSelector
                selectedMachine={selectedMachine}
                onMachineChange={handleMachineChange}
              />
            </div>

            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by filename (min 3 characters)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-slate-400">🔍</span>
                </div>

                {isWaitingForMinLength && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <span className="text-yellow-500 text-sm">Type {3 - searchQuery.length} more...</span>
                  </div>
                )}

                {filters.search && (
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button onClick={handleClearSearch} className="text-slate-400 hover:text-slate-600">✕</button>
                  </div>
                )}
              </div>

              <div className="mt-2 text-sm text-slate-500">
                {filters.search ? (
                  <span className="text-blue-600">🔍 Searching for: "{filters.search}"</span>
                ) : searchQuery.length > 0 && searchQuery.length < 3 ? (
                  <span className="text-yellow-600">⏳ Type {3 - searchQuery.length} more characters to search</span>
                ) : (
                  <span>Type 3+ characters to search instantly</span>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: ENHANCED Date Range Filter with IST */}
          <div className="flex flex-col lg:flex-row gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-slate-600">📅 From (IST):</span>
              <input
                type="datetime-local"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setOffset(0);
                }}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                title="Enter IST time - will be converted to UTC for database queries"
              />
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-slate-600">📅 To (IST):</span>
              <input
                type="datetime-local"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setOffset(0);
                }}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                title="Enter IST time - will be converted to UTC for database queries"
              />
            </div>

            {(dateFrom || dateTo) && (
              <button
                onClick={handleClearDates}
                className="bg-slate-500 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                ✕ Clear Dates
              </button>
            )}

            <div className="flex items-center text-sm text-slate-600 ml-auto">
              <span className="mr-2">🇮🇳</span>
              <span>Times in IST (UTC+5:30)</span>
            </div>
          </div>

          {/* Row 3: Active Filters Summary with IST */}
          {(dateFrom || dateTo || filters.search || selectedMachine === MACHINE_FILTER.ALL_MACHINES) && (
            <div className="text-sm bg-blue-50 p-3 rounded-lg border border-blue-200">
              <span className="font-medium text-blue-800">Active Filters:</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {dateFrom && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                    📅 From: {TimeUtils.toIST(TimeUtils.localToUTC(dateFrom))} IST
                  </span>
                )}
                {dateTo && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                    📅 To: {TimeUtils.toIST(TimeUtils.localToUTC(dateTo))} IST
                  </span>
                )}
                {filters.search && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                    🔍 Search: "{filters.search}"
                  </span>
                )}
                {selectedMachine === MACHINE_FILTER.ALL_MACHINES && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">
                    🌐 All Machines
                  </span>
                )}
              </div>
              <div className="mt-2 text-xs text-slate-600">
                <span className="italic">🇮🇳 All times displayed in IST (Indian Standard Time). Database queries use UTC.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex justify-between items-center text-sm text-slate-600">
        <p>
          Showing {offset + 1}-{Math.min(offset + limit, data.total)} of {data.total} detections
          {filters.search && (
            <span className="ml-2 text-blue-600 font-medium">(filtered by "{filters.search}")</span>
          )}
          {selectedMachine === MACHINE_FILTER.ALL_MACHINES && (
            <span className="ml-2 text-purple-600 font-medium">(🌐 All Machines)</span>
          )}
          {selectedMachine && selectedMachine !== MACHINE_FILTER.ALL_MACHINES && (
            <span className="ml-2 text-green-600 font-medium">(🤖 {selectedMachine})</span>
          )}
        </p>
        <div className="flex items-center space-x-2">
          <span>Show:</span>
          <select value={limit} onChange={handleLimitChange} className="border border-slate-300 rounded px-2 py-1 text-sm">
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <span>per page</span>
        </div>
      </div>

      {/* Detection Grid with IST Times */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.detections.map((detection) => (
          <div
            key={detection.detection_id}
            className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden hover:shadow-lg hover:scale-[1.02] transition-all duration-200 cursor-pointer group"
            onClick={() => handleViewDetail(detection.detection_id)}
          >
            <div className="relative h-48 bg-slate-100">
              <img
                src={ImageUtils.getThumbnailUrl(detection.thumbnail_path)}
                alt={detection.original_filename}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjFmNWY5Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY0NzQ4YiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
                }}
                loading="lazy"
              />

              <div className="absolute top-3 right-3">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${detection.status === 'completed' || detection.status === 'saved' ? 'bg-green-100 text-green-800' :
                  detection.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                    detection.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                  }`}>
                  {detection.status}
                </span>
              </div>

              {detection.total_defects > 0 && (
                <div className="absolute top-3 left-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    🔴 {detection.total_defects} defects
                  </span>
                </div>
              )}

              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <span className="bg-white text-slate-900 px-4 py-2 rounded-lg font-medium shadow-lg">
                    👁️ View Details
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4">
              <h3 className="font-semibold text-slate-900 mb-2 truncate" title={detection.original_filename}>
                {detection.original_filename}
              </h3>

              {selectedMachine === MACHINE_FILTER.ALL_MACHINES && (
                <div className="mb-2">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    🤖 {detection.machine_name}
                  </span>
                </div>
              )}

              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex justify-between items-center">
                  <span>⏱️ Processing Time:</span>
                  <span className="font-medium">{detection.processing_time_ms}ms</span>
                </div>

                <div className="flex justify-between items-center">
                  <span>🎯 Confidence:</span>
                  <span className="font-medium">{(detection.confidence_threshold * 100).toFixed(1)}%</span>
                </div>

                {/* ENHANCED: IST Time Display */}
                <div className="flex justify-between items-center">
                  <span>📅 Created:</span>
                  <span className="font-medium" title={`IST: ${TimeUtils.toIST(detection.created_at)}`}>
                    {TimeUtils.toISTDate(detection.created_at)}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span>⏰ Time:</span>
                  <span className="font-medium text-blue-600">
                    {TimeUtils.toISTTime(detection.created_at)} IST
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-200">
                <p className="text-xs text-slate-500 truncate" title={detection.el_folder_path}>
                  📁 {detection.el_folder_path}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex justify-center items-center space-x-4 py-8">
        <button
          onClick={handlePrevPage}
          disabled={offset === 0}
          className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${offset === 0
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
        >
          ← Previous
        </button>

        <div className="flex items-center space-x-2">
          <span className="text-sm text-slate-600">Page {currentPage} of {totalPages}</span>
        </div>

        <button
          onClick={handleNextPage}
          disabled={offset + limit >= data.total}
          className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${offset + limit >= data.total
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
        >
          Next →
        </button>
      </div>
    </div>
  );
}