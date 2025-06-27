// File: src/components/DetectionHistory.tsx
// ENHANCED: Better UX, help integration, performance optimizations, and accessibility
// PART 1 of 2

import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecentDetections, useExport } from '@/hooks/useApi';
import { useSearch } from '@/hooks/useSearch';
import { ImageUtils } from '@/services/imageUtils';
import { TimeUtils } from '@/utils/timeUtils';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { UI, ROUTES, MACHINE_FILTER } from '@/constants/config';
import type { SearchFilters } from '@/types';
import { MachineSelector } from './common/MachineSelector';
import { DateRangePicker } from './common/DateRangePicker';
import { HelpTooltip, HelpTooltips } from './common/HelpTooltip';

export function DetectionHistory() {
  const navigate = useNavigate();

  // Core state
  const [limit, setLimit] = useState<number>(UI.DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [selectedMachine, setSelectedMachine] = useState<string | null>(MACHINE_FILTER.CURRENT_MACHINE);

  // Enhanced UX state
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [lastAction, setLastAction] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showSuccess, setShowSuccess] = useState<string>('');

  // Date filtering state
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Grid cell filter with validation
  const [gridCellFilter, setGridCellFilter] = useState<string>('');
  const [gridCellError, setGridCellError] = useState<string>('');

  // Refs for better UX
  const topRef = useRef<HTMLDivElement>(null);

  // Export hook with enhanced feedback
  const { exportBulk, isExporting, error: exportError, clearError } = useExport();

  // Enhanced search handling
  const handleSearch = useCallback((query: string) => {
    setFilters(prev => ({ ...prev, search: query || undefined }));
    setOffset(0);
    setLastAction('search');
    if (query) {
      setShowSuccess(`Searching for "${query}"`);
      setTimeout(() => setShowSuccess(''), 2000);
    }
  }, []);

  const { searchQuery, setSearchQuery, isWaitingForMinLength } = useSearch({
    minLength: 3,
    delay: 300,
    onSearch: handleSearch
  });


  // Combined filters with memoization
  const allFilters = useMemo(() => ({
    ...filters,
    machine_id: selectedMachine ?? undefined,
    date_from: dateFrom ? TimeUtils.localToUTC(dateFrom) : undefined,
    date_to: dateTo ? TimeUtils.localToUTC(dateTo) : undefined,
    grid_cell: gridCellFilter && !gridCellError ? gridCellFilter : undefined
  }), [filters, selectedMachine, dateFrom, dateTo, gridCellFilter, gridCellError]);

  const { data, loading, error, refetch, isRefreshing } = useRecentDetections(limit, offset, allFilters);

  // Enhanced pagination with smooth scrolling
  const handleNextPage = useCallback(() => {
    if (data && offset + limit < data.total) {
      setOffset(prev => prev + limit);
      setLastAction('next-page');
      setTimeout(() => {
        topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [data, offset, limit]);

  const handlePrevPage = useCallback(() => {
    if (offset > 0) {
      setOffset(prev => Math.max(0, prev - limit));
      setLastAction('prev-page');
      setTimeout(() => {
        topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [offset, limit]);

  // Enhanced clear functions
  const handleClearAllFilters = useCallback(() => {
    setFilters({});
    setDateFrom('');
    setDateTo('');
    setGridCellFilter('');
    setGridCellError('');
    setSearchQuery('');
    setSelectedMachine(MACHINE_FILTER.CURRENT_MACHINE);
    setOffset(0);
    setLastAction('clear-all');
    setShowSuccess('All filters cleared');
    setTimeout(() => setShowSuccess(''), 2000);
    clearError?.();
  }, [setSearchQuery, clearError]);

  // Export with better feedback
  const handleExportExcel = useCallback(async () => {
    try {
      setLastAction('export');
      await exportBulk(
        dateFrom ? TimeUtils.localToUTC(dateFrom) : undefined,
        dateTo ? TimeUtils.localToUTC(dateTo) : undefined,
        selectedMachine === MACHINE_FILTER.ALL_MACHINES ? 'all' : selectedMachine || undefined
      );
      setShowSuccess('Export completed successfully!');
      setTimeout(() => setShowSuccess(''), 3000);
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [exportBulk, dateFrom, dateTo, selectedMachine]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyboardShortcuts = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      switch (e.key) {
        case 'r':
        case 'R':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            refetch();
            setLastAction('refresh-shortcut');
            setShowSuccess('Data refreshed');
            setTimeout(() => setShowSuccess(''), 2000);
          }
          break;
        case 'f':
        case 'F':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            document.querySelector<HTMLInputElement>('input[placeholder*="Search"]')?.focus();
          }
          break;
        case 'Escape':
          if (Object.keys(allFilters).some(key => allFilters[key as keyof typeof allFilters])) {
            handleClearAllFilters();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyboardShortcuts);
    return () => document.removeEventListener('keydown', handleKeyboardShortcuts);
  }, [refetch, allFilters, handleClearAllFilters]);

  // Loading state management
  useEffect(() => {
    if (!loading && isFirstLoad) {
      setIsFirstLoad(false);
    }
  }, [loading, isFirstLoad]);

  // Memoized calculations
  const currentPage = useMemo(() => Math.floor(offset / limit) + 1, [offset, limit]);
  const totalPages = useMemo(() => Math.ceil((data?.total || 0) / limit), [data?.total, limit]);
  const hasActiveFilters = useMemo(() =>
    Object.keys(allFilters).some(key => allFilters[key as keyof typeof allFilters]),
    [allFilters]
  );

  // Early returns
  if (loading && isFirstLoad) {
    return <LoadingSpinner message="Loading detection history..." />;
  }

  if (error) {
    return (
      <ErrorMessage
        message={error}
        onRetry={refetch}
      />
    );
  }

  if (!data) {
    return <ErrorMessage message="No data available" />;
  }

  return (
    <div className="space-y-6" ref={topRef}>
      {/* Success/Error Messages */}
      {showSuccess && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-2">
          <span>✅</span>
          <span>{showSuccess}</span>
        </div>
      )}

      {exportError && (
        <div className="fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-3">
          <span>❌</span>
          <span>{exportError}</span>
          <button onClick={clearError} className="text-white hover:text-red-200">✕</button>
        </div>
      )}

      {/* Enhanced Header */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start space-y-4 lg:space-y-0">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <h1 className="text-3xl font-bold text-slate-900">🔍 Detection History</h1>
            <HelpTooltip
              title="Detection History"
              content="Browse and analyze all EL detection results. Use filters to find specific images, dates, or grid cells. All data is stored for analysis and reporting."
              size="sm"
            />
          </div>
          <p className="text-slate-600 mb-3">
            Advanced filtering and analysis of solar panel defect detection results
          </p>

          {/* Action Context */}
          {lastAction && (
            <div className="flex items-center space-x-2 text-sm">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-blue-600 font-medium">
                {lastAction === 'search' && '🔍 Search applied'}
                {lastAction === 'machine-change' && '🤖 Machine filter updated'}
                {lastAction === 'date-filter' && '📅 Date range updated'}
                {lastAction === 'clear-all' && '🔄 All filters cleared'}
                {lastAction === 'export' && '📊 Export initiated'}
                {lastAction === 'next-page' && '➡️ Next page'}
                {lastAction === 'prev-page' && '⬅️ Previous page'}
                {lastAction === 'refresh-shortcut' && '🔄 Data refreshed'}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
          {/* View Mode Toggle */}
          <div className="flex bg-slate-100 rounded-lg p-1 shadow-sm">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-2 rounded text-sm font-medium transition-all duration-200 ${viewMode === 'grid'
                ? 'bg-white shadow-sm text-slate-900'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
            >
              🔲 Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 rounded text-sm font-medium transition-all duration-200 ${viewMode === 'list'
                ? 'bg-white shadow-sm text-slate-900'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                }`}
            >
              📋 List
            </button>
          </div>

          {/* Export Button */}
          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg flex items-center space-x-2"
          >
            {isExporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <span>📊</span>
                <span>Export Excel</span>
              </>
            )}
            <HelpTooltips.ExportData size="sm" />
          </button>

          {/* Refresh Button */}
          <button
            onClick={refetch}
            disabled={isRefreshing}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-md hover:shadow-lg flex items-center space-x-2"
          >
            {isRefreshing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Refreshing...</span>
              </>
            ) : (
              <>
                <span>🔄</span>
                <span>Refresh</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Enhanced Filters Section */}
      <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 flex items-center space-x-2">
              <span>🔧</span>
              <span>Search & Filter Options</span>
              <HelpTooltip
                title="Advanced Filtering"
                content="Use these filters to find specific detections. Combine multiple filters for precise results. All filters work together."
                size="sm"
              />
            </h2>
            {hasActiveFilters && (
              <button
                onClick={handleClearAllFilters}
                className="text-blue-600 hover:text-blue-800 bg-white px-3 py-1 rounded border border-blue-200 hover:border-blue-300 text-sm font-medium transition-colors"
              >
                ✕ Clear All
              </button>
            )}
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Row 1: Machine & Search */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2">
              <MachineSelector
                selectedMachine={selectedMachine}
                onMachineChange={(machineId) => {
                  setSelectedMachine(machineId);
                  setOffset(0);
                  setLastAction('machine-change');
                }}
              />
              <HelpTooltips.MachineSelector size="sm" />
            </div>

            <div className="lg:col-span-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by filename (min 3 characters)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-20 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                />
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-slate-400">🔍</span>
                </div>

                <div className="absolute inset-y-0 right-0 pr-3 flex items-center space-x-2">
                  {isWaitingForMinLength && (
                    <span className="text-yellow-600 text-xs bg-yellow-50 px-2 py-1 rounded border border-yellow-200">
                      {3 - searchQuery.length} more...
                    </span>
                  )}
                  {filters.search && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setFilters(prev => ({ ...prev, search: undefined }));
                        setLastAction('clear-search');
                      }}
                      className="text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full w-6 h-6 flex items-center justify-center transition-colors"
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                  <HelpTooltips.FilenameSearch size="sm" />
                </div>
              </div>

              <div className="mt-2 text-sm">
                {filters.search ? (
                  <span className="text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-200">
                    🔍 Searching: "{filters.search}"
                  </span>
                ) : searchQuery.length > 0 && searchQuery.length < 3 ? (
                  <span className="text-yellow-600 bg-yellow-50 px-2 py-1 rounded border border-yellow-200">
                    ⏳ Type {3 - searchQuery.length} more characters
                  </span>
                ) : (
                  <span className="text-slate-500">
                    Quick search • Ctrl+F to focus • Ctrl+R to refresh
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Date Range */}
          <div className="flex items-start space-x-2">
            <div className="flex-1">
              <DateRangePicker
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateFromChange={(date) => {
                  setDateFrom(date);
                  setOffset(0);
                  setLastAction('date-filter');
                }}
                onDateToChange={(date) => {
                  setDateTo(date);
                  setOffset(0);
                  setLastAction('date-filter');
                }}
                onClearDates={() => {
                  setDateFrom('');
                  setDateTo('');
                  setOffset(0);
                  setLastAction('clear-dates');
                }}
              />
            </div>
            <HelpTooltips.DateFilter size="sm" />
          </div>

          {/* Row 3: Grid Cell Filter */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  {gridCellFilter && (
                    <button
                      onClick={() => {
                        setGridCellFilter('');
                        setGridCellError('');
                        setOffset(0);
                        setLastAction('clear-grid');
                      }}
                      className="text-slate-400 hover:text-slate-600 bg-white hover:bg-slate-100 px-2 py-1 rounded border border-slate-200 hover:border-slate-300 text-sm transition-colors"
                    >
                      ✕ Clear
                    </button>
                  )}
                </div>
                {gridCellError && (
                  <p className="text-red-600 text-xs mt-1 flex items-center space-x-1">
                    <span>⚠️</span>
                    <span>{gridCellError}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Active Filters Display */}
          {hasActiveFilters && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2 mb-3">
                <span className="text-blue-800 font-medium">🎯 Active Filters:</span>
                <span className="text-xs text-blue-700 bg-blue-200 px-2 py-1 rounded-full">
                  {Object.keys(allFilters).filter(key => allFilters[key as keyof typeof allFilters]).length} active
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {dateFrom && (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs bg-blue-100 text-blue-800 border border-blue-200">
                    📅 From: {new Date(dateFrom).toLocaleDateString()}
                  </span>
                )}
                {dateTo && (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs bg-blue-100 text-blue-800 border border-blue-200">
                    📅 To: {new Date(dateTo).toLocaleDateString()}
                  </span>
                )}
                {filters.search && (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs bg-green-100 text-green-800 border border-green-200">
                    🔍 "{filters.search}"
                  </span>
                )}
                {gridCellFilter && !gridCellError && (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs bg-purple-100 text-purple-800 border border-purple-200">
                    📐 {gridCellFilter}
                  </span>
                )}
                {selectedMachine === MACHINE_FILTER.ALL_MACHINES && (
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs bg-orange-100 text-orange-800 border border-orange-200">
                    🌐 All Machines
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Results Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <p className="font-medium text-slate-900 text-lg">
              {data.total.toLocaleString()} detections found
            </p>
            <p className="text-sm text-slate-600">
              Showing {offset + 1}-{Math.min(offset + limit, data.total)} • Page {currentPage} of {totalPages}
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-slate-600">Show:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setOffset(0);
                  setLastAction('limit-change');
                }}
                className="border border-slate-300 rounded px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Detection Display - Grid or List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {data.detections.map((detection) => (
            <div
              key={detection.detection_id}
              className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer group"
              onClick={() => navigate(`${ROUTES.DETAIL}/${detection.detection_id}`)}
            >
              {/* Image Container */}
              <div className="relative h-48 bg-slate-100 overflow-hidden">
                <img
                  src={ImageUtils.getThumbnailUrl(detection.thumbnail_path)}
                  alt={detection.original_filename}
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e) => {
                    e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjFmNWY5Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY0NzQ4YiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
                  }}
                  loading="lazy"
                />

                {/* Status Badge */}
                <div className="absolute top-3 right-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shadow-lg backdrop-blur-sm ${detection.status === 'completed' || detection.status === 'saved'
                    ? 'bg-green-100/90 text-green-800 border border-green-200' :
                    detection.status === 'processing'
                      ? 'bg-blue-100/90 text-blue-800 border border-blue-200' :
                      detection.status === 'failed'
                        ? 'bg-red-100/90 text-red-800 border border-red-200' :
                        'bg-yellow-100/90 text-yellow-800 border border-yellow-200'
                    }`}>
                    {detection.status.toUpperCase()}
                  </span>
                </div>

                {/* Defects Badge */}
                {detection.total_defects > 0 && (
                  <div className="absolute top-3 left-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shadow-lg backdrop-blur-sm border ${detection.total_defects > 5 ? 'bg-red-100/90 text-red-800 border-red-200' :
                      detection.total_defects > 2 ? 'bg-orange-100/90 text-orange-800 border-orange-200' :
                        'bg-yellow-100/90 text-yellow-800 border-yellow-200'
                      }`}>
                      🔴 {detection.total_defects} defect{detection.total_defects !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}

                {/* Grid Cells Indicator */}
                {detection.affected_cells && detection.affected_cells.length > 0 && (
                  <div className="absolute bottom-3 left-3 right-3">
                    <div className="bg-black/75 text-white px-2 py-1 rounded text-xs font-medium backdrop-blur-sm">
                      📐 {detection.affected_cells.slice(0, 4).join(', ')}
                      {detection.affected_cells.length > 4 && ` +${detection.affected_cells.length - 4}`}
                    </div>
                  </div>
                )}

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
                  <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 transform group-hover:scale-105">
                    <div className="bg-white text-slate-900 px-4 py-2 rounded-lg font-medium shadow-lg border border-slate-200 flex items-center space-x-2">
                      <span>👁️</span>
                      <span>View Analysis</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Content */}
              <div className="p-4">
                {/* Filename with Copy Button */}
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-slate-900 text-sm leading-tight flex-1 mr-2" title={detection.original_filename}>
                    📄 {detection.original_filename.length > 30
                      ? `${detection.original_filename.substring(0, 30)}...`
                      : detection.original_filename}
                  </h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(detection.original_filename);
                      setShowSuccess('Filename copied!');
                      setTimeout(() => setShowSuccess(''), 1500);
                    }}
                    className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-100 transition-colors"
                    title="Copy filename"
                  >
                    📋
                  </button>
                </div>

                {/* Machine Name (when showing all machines) */}
                {selectedMachine === MACHINE_FILTER.ALL_MACHINES && (
                  <div className="mb-3">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                      🤖 {detection.machine_name}
                    </span>
                  </div>
                )}

                {/* Detection Stats */}
                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center space-x-1">
                      <span>🎯</span>
                      <span>Confidence:</span>
                    </span>
                    <span className="font-medium text-slate-800">
                      {(detection.confidence_threshold * 100).toFixed(1)}%
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="flex items-center space-x-1">
                      <span>📅</span>
                      <span>Date:</span>
                    </span>
                    <span className="font-medium text-slate-800">
                      {TimeUtils.toISTDate(detection.created_at)}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="flex items-center space-x-1">
                      <span>⏰</span>
                      <span>Time:</span>
                    </span>
                    <span className="font-medium text-blue-600 font-mono text-xs">
                      {TimeUtils.toIST(detection.created_at)}
                    </span>
                  </div>

                  {/* Grid Summary */}
                  {detection.grid_summary && (
                    <div className="flex justify-between items-center">
                      <span className="flex items-center space-x-1">
                        <span>📐</span>
                        <span>Grid:</span>
                      </span>
                      <span className="font-medium text-green-600">
                        {detection.grid_summary}
                      </span>
                    </div>
                  )}
                </div>

                {/* Quick Action Button */}
                <div className="mt-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`${ROUTES.DETAIL}/${detection.detection_id}`);
                    }}
                    className="w-full bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 px-3 rounded-lg text-sm font-medium transition-colors border border-blue-200"
                  >
                    🔍 View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Image
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Filename
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Defects
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Grid Cells
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Date/Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {data.detections.map((detection) => (
                  <tr
                    key={detection.detection_id}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`${ROUTES.DETAIL}/${detection.detection_id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <img
                        src={ImageUtils.getThumbnailUrl(detection.thumbnail_path)}
                        alt={detection.original_filename}
                        className="h-12 w-16 object-cover rounded border shadow-sm"
                        loading="lazy"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-900 max-w-xs truncate">
                        {detection.original_filename}
                      </div>
                      {selectedMachine === MACHINE_FILTER.ALL_MACHINES && (
                        <div className="text-xs text-slate-500">{detection.machine_name}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${detection.total_defects > 5 ? 'bg-red-100 text-red-800' :
                        detection.total_defects > 2 ? 'bg-orange-100 text-orange-800' :
                          detection.total_defects > 0 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                        }`}>
                        {detection.total_defects}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs text-slate-600 max-w-xs">
                        {detection.affected_cells && detection.affected_cells.length > 0 ? (
                          <span className="font-mono">
                            {detection.affected_cells.slice(0, 3).join(', ')}
                            {detection.affected_cells.length > 3 && ` +${detection.affected_cells.length - 3}`}
                          </span>
                        ) : (
                          <span className="text-slate-400">None</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900">
                        {TimeUtils.toISTDate(detection.created_at)}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">
                        {TimeUtils.toIST(detection.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${detection.status === 'completed' || detection.status === 'saved'
                        ? 'bg-green-100 text-green-800' :
                        detection.status === 'processing'
                          ? 'bg-blue-100 text-blue-800' :
                          detection.status === 'failed'
                            ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                        }`}>
                        {detection.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`${ROUTES.DETAIL}/${detection.detection_id}`);
                        }}
                        className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded transition-colors"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Enhanced Pagination */}
      <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0 py-8 bg-white rounded-lg shadow-sm border border-slate-200 px-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={handlePrevPage}
            disabled={offset === 0}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 ${offset === 0
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 shadow-sm hover:shadow-md'
              }`}
          >
            <span>←</span>
            <span>Previous</span>
          </button>

          <button
            onClick={handleNextPage}
            disabled={offset + limit >= data.total}
            className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 flex items-center space-x-2 ${offset + limit >= data.total
              ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
              : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 shadow-sm hover:shadow-md'
              }`}
          >
            <span>Next</span>
            <span>→</span>
          </button>
        </div>

        {/* Page Info */}
        <div className="flex items-center space-x-4">
          <div className="text-sm text-slate-600 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
            <span className="font-medium">Page {currentPage}</span>
            <span className="mx-2">of</span>
            <span className="font-medium">{totalPages}</span>
          </div>

          {/* Jump to Page (for large datasets) */}
          {totalPages > 10 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-slate-600">Go to:</span>
              <input
                type="number"
                min="1"
                max={totalPages}
                placeholder="Page"
                className="w-16 px-2 py-1 border border-slate-300 rounded text-sm text-center focus:ring-2 focus:ring-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const page = parseInt((e.target as HTMLInputElement).value);
                    if (page >= 1 && page <= totalPages) {
                      setOffset((page - 1) * limit);
                      setLastAction('jump-to-page');
                      setShowSuccess(`Jumped to page ${page}`);
                      setTimeout(() => setShowSuccess(''), 2000);
                    }
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* No Results State */}
      {data.detections.length === 0 && (
        <div className="text-center py-16">
          <div className="bg-white rounded-xl shadow-md border border-slate-200 p-12 max-w-md mx-auto">
            <div className="text-6xl mb-6">
              {hasActiveFilters ? '🔍' : '📷'}
            </div>
            <h3 className="text-xl font-semibold text-slate-900 mb-4">
              {hasActiveFilters ? 'No matches found' : 'No detections available'}
            </h3>
            <p className="text-slate-600 mb-6">
              {hasActiveFilters
                ? 'Try adjusting your filters to see more results. You can use different date ranges, search terms, or remove some filters.'
                : 'No detection data is available. Images will appear here once processed by the AI system.'
              }
            </p>
            {hasActiveFilters && (
              <div className="space-y-3">
                <button
                  onClick={handleClearAllFilters}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 w-full"
                >
                  🔄 Clear All Filters
                </button>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilters(prev => ({ ...prev, search: undefined }));
                    setOffset(0);
                    setLastAction('clear-search-only');
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors duration-200 w-full"
                >
                  Clear Search Only
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isRefreshing && (
        <div className="fixed top-4 right-4 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg z-40 flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          <span>Refreshing data...</span>
        </div>
      )}

      {/* Keyboard Shortcuts Help */}
      <div className="text-center text-sm text-slate-500 bg-slate-50 rounded-lg p-4">
        <div className="flex flex-wrap justify-center items-center gap-4">
          <span className="flex items-center space-x-1">
            <kbd className="px-2 py-1 bg-white rounded border border-slate-300 text-xs">Ctrl+R</kbd>
            <span>Refresh</span>
          </span>
          <span className="flex items-center space-x-1">
            <kbd className="px-2 py-1 bg-white rounded border border-slate-300 text-xs">Ctrl+F</kbd>
            <span>Focus Search</span>
          </span>
          <span className="flex items-center space-x-1">
            <kbd className="px-2 py-1 bg-white rounded border border-slate-300 text-xs">Esc</kbd>
            <span>Clear Filters</span>
          </span>
          <HelpTooltip
            title="Keyboard Shortcuts"
            content="Use keyboard shortcuts for faster navigation. Ctrl+R refreshes data, Ctrl+F focuses the search box, and Esc clears all active filters."
            size="sm"
          />
        </div>
      </div>
    </div>
  );
}