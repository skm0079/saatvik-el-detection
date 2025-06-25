// File: src/components/Dashboard.tsx  
// COMPLETE: Fixed Today's Defects Calculation (UTC midnight to midnight)

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHealth, useRecentDetections, useMachines } from '@/hooks/useApi';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { MachineSelector } from '@/components/common/MachineSelector';
import { ROUTES, UI, MACHINE_FILTER } from '@/constants/config';

export function Dashboard() {
  const navigate = useNavigate();
  const [selectedMachine, setSelectedMachine] = useState<string | null>(MACHINE_FILTER.CURRENT_MACHINE);

  const { data: health, loading: healthLoading, error: healthError, refetch: refetchHealth, isRefreshing: healthRefreshing } = useHealth();
  const { data: machines } = useMachines();
  const { data: recent, loading: recentLoading, refetch: refetchRecent, isRefreshing: recentRefreshing } = useRecentDetections(
    50, 0, { machine_id: selectedMachine ?? undefined }
  );

  // Auto-refresh every 30 seconds with flicker prevention
  useEffect(() => {
    const interval = setInterval(() => {
      // Only refresh if not already refreshing
      if (!healthRefreshing && !recentRefreshing) {
        refetchHealth();
        refetchRecent();
      }
    }, UI.REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [refetchHealth, refetchRecent, healthRefreshing, recentRefreshing]);

  // ENHANCED: Today's defects calculation (UTC midnight to midnight)
  const todayDefects = useMemo(() => {
    if (!recent?.detections) return 0;

    // Get today's UTC date range (midnight to midnight)
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const tomorrowUTC = new Date(todayUTC.getTime() + 24 * 60 * 60 * 1000);

    console.log('📅 Today\'s defects calculation:');
    console.log('📅 UTC Today start:', todayUTC.toISOString());
    console.log('📅 UTC Tomorrow start:', tomorrowUTC.toISOString());

    return recent.detections
      .filter(d => {
        const detectionDate = new Date(d.created_at);
        const isToday = detectionDate >= todayUTC && detectionDate < tomorrowUTC;

        if (isToday) {
          console.log(`📅 Including: ${d.original_filename} (${d.total_defects} defects) at ${detectionDate.toISOString()}`);
        }

        return isToday;
      })
      .reduce((total, detection) => total + detection.total_defects, 0);
  }, [recent?.detections]);

  // ENHANCED: Today's detection count for additional context
  const todayDetectionCount = useMemo(() => {
    if (!recent?.detections) return 0;

    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const tomorrowUTC = new Date(todayUTC.getTime() + 24 * 60 * 60 * 1000);

    return recent.detections.filter(d => {
      const detectionDate = new Date(d.created_at);
      return detectionDate >= todayUTC && detectionDate < tomorrowUTC;
    }).length;
  }, [recent?.detections]);

  // Average processing time calculation
  const avgProcessingTime = useMemo(() => {
    if (!recent?.detections || recent.detections.length === 0) return 0;

    return recent.detections.reduce((acc, d) => acc + d.processing_time_ms, 0) / recent.detections.length;
  }, [recent?.detections]);

  // ENHANCED: Today's processing stats
  const todayProcessingStats = useMemo(() => {
    if (!recent?.detections) return { avgTime: 0, totalTime: 0 };

    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const tomorrowUTC = new Date(todayUTC.getTime() + 24 * 60 * 60 * 1000);

    const todayDetections = recent.detections.filter(d => {
      const detectionDate = new Date(d.created_at);
      return detectionDate >= todayUTC && detectionDate < tomorrowUTC;
    });

    if (todayDetections.length === 0) return { avgTime: 0, totalTime: 0 };

    const totalTime = todayDetections.reduce((acc, d) => acc + d.processing_time_ms, 0);
    const avgTime = totalTime / todayDetections.length;

    return { avgTime, totalTime };
  }, [recent?.detections]);

  return (
    <div className="space-y-8">
      {/* Header with Machine Selector */}
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-slate-900">🏭 Saatvik EL Detection</h1>
          <p className="text-slate-600 mt-1">Real-time solar panel defect detection and analysis</p>

          {/* Machine Context Display */}
          {health && (
            <div className="mt-3 flex items-center space-x-4 text-sm text-slate-600">
              <span>🤖 Machine: <strong>{health.machine_name}</strong></span>
              <span>🏭 Environment: <strong>{health.environment}</strong></span>
              <span>⏰ Updated: <strong>{new Date().toLocaleTimeString()}</strong></span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-end space-y-4">
          <button
            onClick={() => navigate(ROUTES.HISTORY)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 shadow-md hover:shadow-lg"
          >
            📋 View All Detections
          </button>

          {/* Machine Selector */}
          <MachineSelector
            selectedMachine={selectedMachine}
            onMachineChange={setSelectedMachine}
            className="text-sm"
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* System Health */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">🏥 System Health</p>
              {healthLoading ? (
                <div className="mt-2">
                  <div className="h-4 bg-slate-200 rounded animate-pulse"></div>
                </div>
              ) : healthError ? (
                <div className="mt-2">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    🔴 Error
                  </span>
                  <p className="text-xs text-red-600 mt-1">Check connection</p>
                </div>
              ) : health ? (
                <div className="mt-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${health.status === 'healthy'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                    }`}>
                    {health.status === 'healthy' ? '🟢' : '🔴'} {health.status.toUpperCase()}
                  </span>
                  <p className="text-xs text-slate-500 mt-1">AI Ready</p>
                </div>
              ) : null}
            </div>
            <div className="text-3xl">🏥</div>
          </div>
        </div>

        {/* ENHANCED: Today's Defects (CHANGED FROM Today's Activity) */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">🔴 Today's Defects</p>
              <p className="text-2xl font-bold text-red-600 mt-2">{todayDefects}</p>
              <div className="text-xs text-slate-500 space-y-1">
                <p>From {todayDetectionCount} images today</p>
                <p className="text-blue-600" title="UTC midnight to midnight">
                  {selectedMachine === MACHINE_FILTER.ALL_MACHINES ? 'All Machines' : 'Current Machine'}
                </p>
              </div>
            </div>
            <div className="text-3xl">🔴</div>
          </div>
        </div>

        {/* ENHANCED: Performance with Today's Stats */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">⏱️ Performance</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{avgProcessingTime.toFixed(0)}ms</p>
              <div className="text-xs text-slate-500 space-y-1">
                <p>Avg Processing Time</p>
                <p className="text-green-600">
                  Today: {todayProcessingStats.avgTime.toFixed(0)}ms avg
                </p>
              </div>
            </div>
            <div className="text-3xl">⚡</div>
          </div>
        </div>

        {/* Total Records */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">📈 Total Records</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{recent?.total || 0}</p>
              <div className="text-xs text-slate-500 space-y-1">
                <p>
                  {selectedMachine === MACHINE_FILTER.ALL_MACHINES ? 'All Machines' : machines?.current_machine || 'Current Machine'}
                </p>
                <p className="text-purple-600">
                  {todayDetectionCount} processed today
                </p>
              </div>
            </div>
            <div className="text-3xl">📊</div>
          </div>
        </div>
      </div>

      {/* ENHANCED: Today's Performance Summary */}
      {todayDetectionCount > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl shadow-md border border-blue-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
            📊 Today's Summary
            <span className="ml-2 text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded">
              UTC {new Date().toLocaleDateString()}
            </span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 border border-blue-100">
              <div className="text-2xl font-bold text-blue-600">{todayDetectionCount}</div>
              <div className="text-sm text-slate-600">Images Processed</div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-red-100">
              <div className="text-2xl font-bold text-red-600">{todayDefects}</div>
              <div className="text-sm text-slate-600">Defects Found</div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-green-100">
              <div className="text-2xl font-bold text-green-600">{todayProcessingStats.avgTime.toFixed(0)}ms</div>
              <div className="text-sm text-slate-600">Avg Processing</div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-purple-100">
              <div className="text-2xl font-bold text-purple-600">
                {todayDetectionCount > 0 ? (todayDefects / todayDetectionCount).toFixed(1) : '0'}
              </div>
              <div className="text-sm text-slate-600">Avg Defects/Image</div>
            </div>
          </div>

          <div className="mt-4 p-3 bg-blue-100 rounded-lg">
            <p className="text-sm text-blue-800">
              <span className="font-medium">📍 Definition:</span> "Today" is calculated from UTC midnight to midnight
              ({new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())).toISOString().slice(0, 10)} 00:00 UTC
              to {new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1)).toISOString().slice(0, 10)} 00:00 UTC).
              {selectedMachine === MACHINE_FILTER.ALL_MACHINES ? ' Showing data from all machines.' : ` Showing data from ${machines?.current_machine || 'current machine'} only.`}
            </p>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">🕒 Recent Activity</h2>
            {selectedMachine === MACHINE_FILTER.ALL_MACHINES ? (
              <p className="text-sm text-purple-600 font-medium">🌐 Showing all machines</p>
            ) : (
              <p className="text-sm text-green-600 font-medium">🤖 {machines?.current_machine || 'Current machine'}</p>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {(healthRefreshing || recentRefreshing) && (
              <div className="flex items-center space-x-2 text-blue-600 text-sm">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span>Updating...</span>
              </div>
            )}
            <button
              onClick={refetchRecent}
              disabled={recentRefreshing}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 ${recentRefreshing
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
            >
              {recentRefreshing ? '⏳ Refreshing...' : '🔄 Refresh'}
            </button>
          </div>
        </div>

        <div className="p-6">
          {recentLoading && !recent ? (
            <LoadingSpinner message="Loading recent activity..." />
          ) : recent && recent.detections.length > 0 ? (
            <div className="space-y-4">
              {recent.detections.slice(0, 5).map((detection) => (
                <div
                  key={detection.detection_id}
                  className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors duration-200"
                  onClick={() => navigate(`${ROUTES.DETAIL}/${detection.detection_id}`)}
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-blue-600 font-bold">📷</span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{detection.original_filename}</p>
                      <div className="flex items-center space-x-2 text-sm text-slate-500">
                        <span>📅 {new Date(detection.created_at).toLocaleDateString()}</span>
                        <span>⏰ {new Date(detection.created_at).toLocaleTimeString()}</span>
                        {selectedMachine === MACHINE_FILTER.ALL_MACHINES && (
                          <span className="text-purple-600 font-medium">• 🤖 {detection.machine_name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${detection.status === 'completed' || detection.status === 'saved' ? 'bg-green-100 text-green-800' :
                      detection.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        detection.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                      }`}>
                      {detection.status.toUpperCase()}
                    </span>
                    <div className="text-right">
                      <div className="text-sm font-medium text-slate-900">🔴 {detection.total_defects}</div>
                      <div className="text-xs text-slate-500">{detection.processing_time_ms}ms</div>
                    </div>
                  </div>
                </div>
              ))}

              {recent.total > 5 && (
                <div className="text-center pt-4">
                  <button
                    onClick={() => navigate(ROUTES.HISTORY)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200"
                  >
                    View All {recent.total} Detections →
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📷</div>
              <h3 className="text-lg font-semibold text-slate-700 mb-2">No Recent Activity</h3>
              <p className="text-slate-500 mb-4">No detection results available yet.</p>
              <button
                onClick={refetchRecent}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
              >
                🔄 Check for Updates
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}