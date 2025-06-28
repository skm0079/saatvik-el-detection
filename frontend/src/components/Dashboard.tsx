// File: frontend/src/components/Dashboard.tsx - PART 1
import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHealth, useDashboardAnalytics, useExport } from '@/hooks/useApi';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { MachineSelector } from '@/components/common/MachineSelector';
import { HelpTooltip, HelpTooltips } from '@/components/common/HelpTooltip';
import { TimeUtils } from '@/utils/timeUtils';
import { ROUTES, UI, MACHINE_FILTER, GRID_CONFIG } from '@/constants/config';
import logo from '@/assets/logo.png';

export function Dashboard() {
  const navigate = useNavigate();
  const [selectedMachine, setSelectedMachine] = useState<string | null>("Factory Line 1"); // Always start with specific machine

  // Enhanced date range state with default to today
  const [dateRange, setDateRange] = useState<{ from: string; to: string } | null>(() => {
    const todayRange = TimeUtils.getTodayRangeUTC();
    return {
      from: todayRange.start,
      to: todayRange.end
    };
  });

  // Date filter presets
  const [datePreset, setDatePreset] = useState<string>('today');
  const [showCustomDateRange, setShowCustomDateRange] = useState(false);
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');

  const [lastRefreshTime, setLastRefreshTime] = useState<string>(TimeUtils.getCurrentIST());

  // API hooks
  const { data: health, loading: healthLoading, error: healthError, refetch: refetchHealth, isRefreshing: healthRefreshing } = useHealth();
  const { data: analytics, loading: analyticsLoading, refetch: refetchAnalytics, isRefreshing: analyticsRefreshing } = useDashboardAnalytics(
    dateRange?.from,
    dateRange?.to,
    selectedMachine || undefined
  );
  const { exportBulk, isExporting } = useExport();

  // Date preset options
  const datePresets = [
    { value: 'today', label: '📅 Today', description: 'Today\'s data (IST)' },
    { value: 'yesterday', label: '📆 Yesterday', description: 'Yesterday\'s data (IST)' },
    { value: 'last7days', label: '📊 Last 7 Days', description: 'Past week data' },
    { value: 'last30days', label: '📈 Last 30 Days', description: 'Past month data' },
    { value: 'thisMonth', label: '🗓️ This Month', description: 'Current month data' },
    { value: 'custom', label: '⚙️ Custom Range', description: 'Select specific dates' }
  ];

  // Handle date preset changes
  const handleDatePresetChange = (preset: string) => {
    setDatePreset(preset);
    setShowCustomDateRange(preset === 'custom');

    if (preset !== 'custom') {
      const range = getDateRangeForPreset(preset);
      setDateRange(range);
    }
  };

  // Get date range for preset
  const getDateRangeForPreset = (preset: string) => {
    const now = new Date();
    const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

    switch (preset) {
      case 'today': {
        const todayRange = TimeUtils.getTodayRangeUTC();
        return { from: todayRange.start, to: todayRange.end };
      }
      case 'yesterday': {
        const yesterday = new Date(istNow);
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const yesterdayEnd = new Date(yesterday);
        yesterdayEnd.setHours(23, 59, 59, 999);

        // Convert IST to UTC
        const utcStart = new Date(yesterday.getTime() - (5.5 * 60 * 60 * 1000));
        const utcEnd = new Date(yesterdayEnd.getTime() - (5.5 * 60 * 60 * 1000));

        return { from: utcStart.toISOString(), to: utcEnd.toISOString() };
      }
      case 'last7days': {
        const weekAgo = new Date(istNow);
        weekAgo.setDate(weekAgo.getDate() - 7);
        weekAgo.setHours(0, 0, 0, 0);

        const todayEnd = new Date(istNow);
        todayEnd.setHours(23, 59, 59, 999);

        const utcStart = new Date(weekAgo.getTime() - (5.5 * 60 * 60 * 1000));
        const utcEnd = new Date(todayEnd.getTime() - (5.5 * 60 * 60 * 1000));

        return { from: utcStart.toISOString(), to: utcEnd.toISOString() };
      }
      case 'last30days': {
        const monthAgo = new Date(istNow);
        monthAgo.setDate(monthAgo.getDate() - 30);
        monthAgo.setHours(0, 0, 0, 0);

        const todayEnd = new Date(istNow);
        todayEnd.setHours(23, 59, 59, 999);

        const utcStart = new Date(monthAgo.getTime() - (5.5 * 60 * 60 * 1000));
        const utcEnd = new Date(todayEnd.getTime() - (5.5 * 60 * 60 * 1000));

        return { from: utcStart.toISOString(), to: utcEnd.toISOString() };
      }
      case 'thisMonth': {
        const monthStart = new Date(istNow.getFullYear(), istNow.getMonth(), 1, 0, 0, 0, 0);
        const todayEnd = new Date(istNow);
        todayEnd.setHours(23, 59, 59, 999);

        const utcStart = new Date(monthStart.getTime() - (5.5 * 60 * 60 * 1000));
        const utcEnd = new Date(todayEnd.getTime() - (5.5 * 60 * 60 * 1000));

        return { from: utcStart.toISOString(), to: utcEnd.toISOString() };
      }
      default:
        return null;
    }
  };

  // Handle custom date range application
  const handleApplyCustomRange = () => {
    if (customDateFrom && customDateTo) {
      // Convert IST datetime-local inputs to UTC
      const fromUTC = TimeUtils.localToUTC(customDateFrom);
      const toUTC = TimeUtils.localToUTC(customDateTo);

      if (fromUTC && toUTC) {
        setDateRange({ from: fromUTC, to: toUTC });
      }
    }
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (!healthRefreshing && !analyticsRefreshing) {
        refetchHealth();
        refetchAnalytics();
        setLastRefreshTime(TimeUtils.getCurrentIST());
      }
    }, UI.REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [refetchHealth, refetchAnalytics, healthRefreshing, analyticsRefreshing]);

  // Today's data calculation (IST-based)
  const todayData = useMemo(() => {
    if (!analytics) return null;
    const today = analytics.today;
    return {
      images: today.images_today,
      defects: today.defects_today,
      avgDefects: today.avg_defects_today,
      topCells: today.most_affected_cells_today.slice(0, 5)
    };
  }, [analytics]);

  // Grid insights
  const gridInsights = useMemo(() => {
    if (!analytics?.grid_insights) return null;
    const insights = analytics.grid_insights;
    return {
      totalCellsAffected: insights.total_unique_cells_affected,
      totalPossibleCells: insights.grid_config.total_cells,
      coveragePercent: Math.round((insights.total_unique_cells_affected / insights.grid_config.total_cells) * 100),
      topProblematicCells: insights.most_affected_cells_overall.slice(0, 10)
    };
  }, [analytics]);

  // System status indicator
  const getSystemStatus = () => {
    if (healthError) return { status: 'error', color: 'bg-red-500', text: 'System Error' };
    if (healthLoading) return { status: 'loading', color: 'bg-yellow-500', text: 'Checking...' };
    if (health?.status === 'healthy') return { status: 'healthy', color: 'bg-green-500', text: 'All Systems Operational' };
    return { status: 'warning', color: 'bg-orange-500', text: 'Partial Service' };
  };

  const systemStatus = getSystemStatus();

  // Handle export with current date filters
  const handleExport = async () => {
    try {
      await exportBulk(
        dateRange?.from,
        dateRange?.to,
        selectedMachine === MACHINE_FILTER.ALL_MACHINES ? 'all' : selectedMachine || undefined
      );
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  // Get current date range display text
  const getCurrentDateRangeText = () => {
    if (!dateRange) return 'All Time';

    const fromIST = TimeUtils.toISTDate(dateRange.from);
    const toIST = TimeUtils.toISTDate(dateRange.to);

    if (fromIST === toIST) {
      return `📅 ${fromIST}`;
    }
    return `📅 ${fromIST} to ${toIST}`;
  };

  // PART 2 - Return JSX (continues from Part 1)
  return (
    <div className="space-y-8">
      {/* Enhanced Header with System Status */}
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center space-x-3 mb-2">
            <img
              src={logo}
              alt="Saatvik EL Logo"
              className="w-12 h-12 object-contain filter brightness-0 invert"
            />
            <h1 className="text-3xl font-bold text-slate-900"> Saatvik EL Detection</h1>
            <div className={`w-3 h-3 rounded-full ${systemStatus.color} animate-pulse`}></div>
            <span className="text-sm font-medium text-slate-600">{systemStatus.text}</span>
            <HelpTooltip
              title="System Status"
              content="Green indicates all systems (AI, database, file storage) are operational. Yellow means checking status. Red indicates system issues that need attention."
              size="sm"
            />
          </div>
          <p className="text-slate-600 mb-3">Real-time solar panel defect detection and analysis</p>

          {/* Enhanced Machine & Time Context */}
          {health && (
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-slate-700">🤖 Machine:</span>
                  <span className="font-semibold text-blue-600">{selectedMachine || health.machine_name}</span>
                  <HelpTooltips.MachineSelector size="sm" />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-slate-700">🏭 Environment:</span>
                  <span className="font-semibold text-green-600 capitalize">{health.environment}</span>
                  <HelpTooltip
                    title="Environment"
                    content="Current deployment environment. 'dev' for development/testing, 'staging' for pre-production validation, 'prod' for live production system."
                    size="sm"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <span className="font-medium text-slate-700">🕐 IST:</span>
                  <span className="font-mono text-purple-600">{lastRefreshTime}</span>
                  <HelpTooltip
                    title="Last Updated"
                    content="Shows when the dashboard data was last refreshed. Data automatically updates every 30 seconds. All times shown in Indian Standard Time (IST)."
                    size="sm"
                  />
                </div>
                {(healthRefreshing || analyticsRefreshing) && (
                  <div className="flex items-center space-x-2 text-blue-600">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
                    <span className="text-xs">Updating...</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end space-y-4">
          <div className="flex space-x-3">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
            >
              {isExporting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <span>📊</span>
                  <span>Export Data</span>
                </>
              )}
              <HelpTooltips.ExportData size="sm" />
            </button>
            <button
              onClick={() => navigate(ROUTES.HISTORY)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 shadow-md hover:shadow-lg flex items-center space-x-2"
            >
              <span>📋</span>
              <span>View All Detections</span>
            </button>
          </div>

          {/* Machine Selector with Help */}
          <div className="flex items-center space-x-2">
            <MachineSelector
              selectedMachine={selectedMachine}
              onMachineChange={setSelectedMachine}
              className="text-sm"
            />
            <HelpTooltips.MachineSelector size="sm" />
          </div>
        </div>
      </div>

      {/* NEW: Enhanced Date & Time Filter Section */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl shadow-md border border-indigo-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <h3 className="text-lg font-semibold text-slate-900">📅 Date & Time Filters</h3>
            <span className="text-sm bg-indigo-100 text-indigo-600 px-2 py-1 rounded font-medium">
              {getCurrentDateRangeText()}
            </span>
            <HelpTooltip
              title="Date Filtering"
              content="Filter dashboard data by date range. All times are handled in IST timezone. 'Today' resets at midnight IST. Export will include only data from the selected date range."
              size="sm"
            />
          </div>
          <div className="text-xs text-slate-500">
            Timezone: IST (UTC+5:30) • Data: {analytics?.totals.images_processed || 0} images
          </div>
        </div>

        {/* Date Preset Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          {datePresets.map((preset) => (
            <button
              key={preset.value}
              onClick={() => handleDatePresetChange(preset.value)}
              className={`p-3 rounded-lg text-sm font-medium transition-all duration-200 border-2 ${datePreset === preset.value
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50'
                }`}
              title={preset.description}
            >
              <div className="font-semibold">{preset.label}</div>
              <div className="text-xs opacity-75 mt-1">{preset.description}</div>
            </button>
          ))}
        </div>

        {/* Custom Date Range Inputs */}
        {showCustomDateRange && (
          <div className="bg-white rounded-lg p-4 border border-indigo-200">
            <div className="flex items-center space-x-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  📅 From Date & Time (IST)
                </label>
                <input
                  type="datetime-local"
                  value={customDateFrom}
                  onChange={(e) => setCustomDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  max={new Date().toISOString().slice(0, 16)}
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  📅 To Date & Time (IST)
                </label>
                <input
                  type="datetime-local"
                  value={customDateTo}
                  onChange={(e) => setCustomDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  max={new Date().toISOString().slice(0, 16)}
                />
              </div>
              <div className="flex flex-col space-y-2">
                <button
                  onClick={handleApplyCustomRange}
                  disabled={!customDateFrom || !customDateTo}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white px-4 py-2 rounded-md font-medium transition-colors duration-200 text-sm"
                >
                  ✅ Apply Range
                </button>
                <button
                  onClick={() => {
                    setCustomDateFrom('');
                    setCustomDateTo('');
                  }}
                  className="bg-slate-500 hover:bg-slate-600 text-white px-4 py-2 rounded-md font-medium transition-colors duration-200 text-sm"
                >
                  🗑️ Clear
                </button>
              </div>
            </div>

            {/* Quick time helpers */}
            <div className="flex items-center space-x-2 mt-3 text-xs text-slate-500">
              <span>💡 Quick fill:</span>
              <button
                onClick={() => {
                  const now = new Date();
                  const istTime = TimeUtils.utcToLocalInput(now.toISOString());
                  setCustomDateTo(istTime);
                }}
                className="text-indigo-600 hover:text-indigo-800 underline"
              >
                Set 'To' as now
              </button>
              <span>•</span>
              <button
                onClick={() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const istTime = TimeUtils.utcToLocalInput(today.toISOString());
                  setCustomDateFrom(istTime);
                }}
                className="text-indigo-600 hover:text-indigo-800 underline"
              >
                Set 'From' as today start
              </button>
            </div>
          </div>
        )}

        {/* Current Filter Summary */}
        <div className="flex items-center justify-between mt-4 p-3 bg-white rounded-lg border border-indigo-100">
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-slate-700">🔍 Current Filter:</span>
            <span className="text-sm text-indigo-600 font-semibold">
              {datePresets.find(p => p.value === datePreset)?.label || 'Custom Range'}
            </span>
            {dateRange && (
              <span className="text-xs text-slate-500">
                ({TimeUtils.toIST(dateRange.from)} to {TimeUtils.toIST(dateRange.to)})
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <span>📊 Showing:</span>
            <span className="font-semibold text-indigo-600">
              {analyticsLoading ? 'Loading...' : `${analytics?.totals.images_processed || 0} images`}
            </span>
            <span>•</span>
            <span className="font-semibold text-red-600">
              {analyticsLoading ? 'Loading...' : `${analytics?.totals.total_defects_found || 0} defects`}
            </span>
          </div>
        </div>
      </div>

      {/* Enhanced Stats Grid with Help Tooltips */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* System Health Card */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <p className="text-sm font-medium text-slate-600">🏥 System Health</p>
                <HelpTooltip
                  title="System Health"
                  content="Overall system status including AI model availability, database connectivity, and file storage access. Green means all components are working properly."
                  size="sm"
                />
              </div>
              {healthLoading ? (
                <div className="mt-2 h-6 bg-slate-200 rounded animate-pulse"></div>
              ) : healthError ? (
                <div className="mt-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    🔴 Error
                  </span>
                  <p className="text-xs text-red-600 mt-1">Check logs</p>
                </div>
              ) : health ? (
                <div className="mt-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${health.status === 'healthy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                    {health.status === 'healthy' ? '🟢' : '🔴'} {health.status.toUpperCase()}
                  </span>
                  <p className="text-xs text-green-600 mt-1">AI Model Ready</p>
                </div>
              ) : null}
            </div>
            <div className="text-3xl">🏥</div>
          </div>
        </div>

        {/* Images in Date Range Card */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <p className="text-sm font-medium text-slate-600">📷 Images in Range</p>
                <HelpTooltip
                  title="Images in Selected Range"
                  content="Number of solar panel images processed in the selected date range. This count updates based on your date filter selection."
                  size="sm"
                />
              </div>
              <p className="text-2xl font-bold text-blue-600 mt-2">
                {analyticsLoading ? '...' : analytics?.totals.images_processed || 0}
              </p>
              <div className="text-xs text-slate-500 space-y-1 mt-1">
                <p>In selected date range</p>
                <p className="text-blue-600 font-medium">
                  {selectedMachine === MACHINE_FILTER.ALL_MACHINES ? '🌐 All Machines' : '🤖 Current Machine'}
                </p>
              </div>
            </div>
            <div className="text-3xl">📷</div>
          </div>
        </div>

        {/* Today's Defects Card */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <p className="text-sm font-medium text-slate-600">🔴 Today's Defects</p>
                <HelpTooltip
                  title="Defects Detected"
                  content="Total number of defects found in today's images. Each defect represents a potential issue on the solar panel that may need inspection or maintenance."
                  size="sm"
                />
              </div>
              <p className="text-2xl font-bold text-red-600 mt-2">
                {analyticsLoading ? '...' : todayData?.defects || 0}
              </p>
              <div className="text-xs text-slate-500 space-y-1 mt-1">
                <p>Avg: {todayData?.avgDefects?.toFixed(1) || '0'} per image</p>
                <p className="text-red-600 font-medium">IST: {TimeUtils.toISTDate(new Date().toISOString())}</p>
              </div>
            </div>
            <div className="text-3xl">🔴</div>
          </div>
        </div>

        {/* Performance Card */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <p className="text-sm font-medium text-slate-600">⚡ Performance</p>
                <HelpTooltips.ProcessingTime size="sm" />
              </div>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {analyticsLoading ? '...' : `${analytics?.totals.avg_processing_time_ms || 0}ms`}
              </p>
              <div className="text-xs text-slate-500 space-y-1 mt-1">
                <p>Average Processing Time</p>
                <p className="text-green-600 font-medium">
                  {analytics?.totals.avg_processing_time_ms ?
                    analytics.totals.avg_processing_time_ms < 2000 ? '🚀 Fast' :
                      analytics.totals.avg_processing_time_ms < 5000 ? '✅ Normal' : '⚠️ Slow'
                    : '⏳ Calculating...'
                  }
                </p>
              </div>
            </div>
            <div className="text-3xl">⚡</div>
          </div>
        </div>
      </div>

      {/* Enhanced Grid Analytics Section */}
      {gridInsights && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl shadow-md border border-blue-200 p-6">
          <div className="flex items-center space-x-3 mb-6">
            <h3 className="text-lg font-semibold text-slate-900">📐 Grid Analysis</h3>
            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded font-medium">
              {GRID_CONFIG.DEFAULT_ROWS}×{GRID_CONFIG.DEFAULT_COLS} Solar Panel Grid
            </span>
            <HelpTooltips.GridAnalysis size="sm" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg p-4 border border-blue-100">
              <div className="flex items-center space-x-2 mb-2">
                <div className="text-2xl font-bold text-blue-600">{gridInsights.totalCellsAffected}</div>
                <HelpTooltip
                  title="Affected Cells"
                  content="Number of individual grid cells that have at least one defect. Each cell represents a section of the solar panel."
                  size="sm"
                />
              </div>
              <div className="text-sm text-slate-600">Cells with Defects</div>
              <div className="text-xs text-slate-500 mt-1">
                of {gridInsights.totalPossibleCells} total cells
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <div className="flex items-center space-x-2 mb-2">
                <div className="text-2xl font-bold text-purple-600">{gridInsights.coveragePercent}%</div>
                <HelpTooltip
                  title="Grid Coverage"
                  content="Percentage of grid cells that have been analyzed and found to contain defects. Higher percentages may indicate widespread panel issues."
                  size="sm"
                />
              </div>
              <div className="text-sm text-slate-600">Grid Coverage</div>
              <div className="text-xs text-slate-500 mt-1">
                Cells analyzed overall
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-red-100">
              <div className="flex items-center space-x-2 mb-2">
                <div className="text-2xl font-bold text-red-600">
                  {todayData?.topCells[0]?.[0] || 'None'}
                </div>
                <HelpTooltip
                  title="Top Problem Cell Today"
                  content="Grid cell with the most defects detected today. Format is row letter (A-F) + column number (1-24). Monitor these cells for recurring issues."
                  size="sm"
                />
              </div>
              <div className="text-sm text-slate-600">Top Problem Cell Today</div>
              <div className="text-xs text-slate-500 mt-1">
                {todayData?.topCells[0]?.[1] || 0} defects
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-green-100">
              <div className="flex items-center space-x-2 mb-2">
                <div className="text-2xl font-bold text-green-600">
                  {analytics?.totals.images_processed || 0}
                </div>
                <HelpTooltip
                  title="Total Images"
                  content="Total number of solar panel images processed by the system in the selected date range. This includes all successful detections across all machines."
                  size="sm"
                />
              </div>
              <div className="text-sm text-slate-600">Total Images</div>
              <div className="text-xs text-slate-500 mt-1">
                In selected period
              </div>
            </div>
          </div>

          {/* Most Problematic Cells with Enhanced Display */}
          {gridInsights.topProblematicCells.length > 0 && (
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <h4 className="text-md font-semibold text-slate-800">🔥 Most Problematic Grid Cells</h4>
                <HelpTooltip
                  title="Problematic Cells"
                  content="Grid cells with the highest number of defects across all analyzed images. These areas may need closer inspection or maintenance attention."
                  size="sm"
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-2">
                {gridInsights.topProblematicCells.slice(0, 10).map(([cell, count], index) => (
                  <div
                    key={cell}
                    className={`p-3 rounded-lg text-center text-sm font-medium cursor-pointer transition-all duration-200 hover:scale-105 ${index === 0 ? 'bg-red-200 text-red-900 border-2 border-red-400' :
                      index < 3 ? 'bg-orange-200 text-orange-900 border border-orange-300' :
                        'bg-yellow-200 text-yellow-900 border border-yellow-300'
                      }`}
                    title={`Cell ${cell}: ${count} defects total`}
                  >
                    <div className="font-bold text-lg">{cell}</div>
                    <div className="text-xs opacity-75">{count} defects</div>
                    {index === 0 && <div className="text-xs mt-1">🥇 Worst</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Enhanced Total Statistics */}
      {analytics && (
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center space-x-2 mb-6">
            <h3 className="text-lg font-semibold text-slate-900">📊 Overall Statistics</h3>
            <HelpTooltip
              title="Overall Statistics"
              content="Comprehensive statistics for the selected date range. These numbers represent the performance and findings of the detection system within your chosen time period."
              size="sm"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <p className="text-sm font-medium text-slate-600">Total Processed</p>
                <HelpTooltip
                  title="Total Processed"
                  content="Total number of solar panel images successfully analyzed by the AI system in the selected date range across selected machines."
                  size="sm"
                />
              </div>
              <p className="text-3xl font-bold text-slate-900">{analytics.totals.images_processed.toLocaleString()}</p>
              <p className="text-sm text-slate-500">Images analyzed</p>
            </div>

            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <p className="text-sm font-medium text-slate-600">Total Defects Found</p>
                <HelpTooltip
                  title="Total Defects"
                  content="Total number of defects detected in the selected date range. Each defect represents a potential issue that may require inspection or maintenance."
                  size="sm"
                />
              </div>
              <p className="text-3xl font-bold text-red-600">{analytics.totals.total_defects_found.toLocaleString()}</p>
              <p className="text-sm text-slate-500">
                Avg: {analytics.totals.avg_defects_per_image.toFixed(1)} per image
              </p>
            </div>

            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <p className="text-sm font-medium text-slate-600">Defect Types</p>
                <HelpTooltip
                  title="Defect Classification"
                  content="Different types of defects detected by the AI system in the selected date range. Each type represents a specific kind of issue that can occur on solar panels."
                  size="sm"
                />
              </div>
              <div className="space-y-2">
                {Object.entries(analytics.defect_breakdown.by_type).slice(0, 3).map(([type, count]) => (
                  <div key={type} className="flex justify-between text-sm">
                    <span className="capitalize font-medium">{type}:</span>
                    <span className="font-bold text-blue-600">{count}</span>
                  </div>
                ))}
                {Object.keys(analytics.defect_breakdown.by_type).length > 3 && (
                  <div className="text-xs text-slate-500 pt-1">
                    +{Object.keys(analytics.defect_breakdown.by_type).length - 3} more types
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading States */}
      {analyticsLoading && !analytics && (
        <LoadingSpinner message="Loading dashboard analytics..." />
      )}

      {/* Quick Action Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white cursor-pointer hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
          onClick={() => navigate(ROUTES.LIVE)}>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-lg font-semibold mb-2">📺 Live View</h4>
              <p className="text-blue-100 text-sm">Monitor real-time processing</p>
            </div>
            <div className="text-3xl opacity-75">→</div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white cursor-pointer hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-lg hover:shadow-xl"
          onClick={() => navigate(ROUTES.HISTORY)}>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-lg font-semibold mb-2">📋 Detection History</h4>
              <p className="text-green-100 text-sm">Browse all processed images</p>
            </div>
            <div className="text-3xl opacity-75">→</div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-6 text-white cursor-pointer hover:from-purple-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl"
          onClick={handleExport}>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-lg font-semibold mb-2">📊 Export Data</h4>
              <p className="text-purple-100 text-sm">Download filtered analysis reports</p>
            </div>
            <div className="text-3xl opacity-75">{isExporting ? '⏳' : '↓'}</div>
          </div>
        </div>
      </div>

      {/* Auto-refresh Status */}
      <div className="text-center text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
        <div className="flex items-center justify-center space-x-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          <span>Auto-refreshing every 30 seconds</span>
          <span>•</span>
          <span>Last updated: {lastRefreshTime}</span>
          <span>•</span>
          <span>Filter: {datePresets.find(p => p.value === datePreset)?.label || 'Custom'}</span>
          <HelpTooltip
            title="Auto-refresh"
            content="Dashboard data automatically updates every 30 seconds to show the latest information. The green dot indicates active monitoring. Data is filtered by your selected date range."
            size="sm"
          />
        </div>
      </div>
    </div>
  );
}