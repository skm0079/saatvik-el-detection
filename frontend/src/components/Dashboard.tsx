// file: src/components/Dashboard.tsx

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHealth, useRecentDetections } from '@/hooks/useApi';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
// import { ErrorMessage } from '@/components/common/ErrorMessage';
import { ROUTES, UI } from '@/constants/config';

export function Dashboard() {
  const navigate = useNavigate();
  const { data: health, loading: healthLoading, error: healthError, refetch: refetchHealth } = useHealth();
  const { data: recent, loading: recentLoading, refetch: refetchRecent } = useRecentDetections(5, 0);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetchHealth();
      refetchRecent();
    }, UI.REFRESH_INTERVAL);

    return () => clearInterval(interval);
  }, [refetchHealth, refetchRecent]);

  const totalToday = recent?.detections.filter(d => {
    const today = new Date().toDateString();
    return new Date(d.created_at).toDateString() === today;
  }).length || 0;

  const avgProcessingTime = recent?.detections && recent.detections.length > 0
    ? recent.detections.reduce((acc, d) => acc + d.processing_time_ms, 0) / recent.detections.length
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">🏭 Saatvik EL Detection</h1>
          <p className="text-slate-600 mt-1">Real-time solar panel defect detection and analysis</p>
        </div>
        <button
          onClick={() => navigate(ROUTES.HISTORY)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 shadow-md hover:shadow-lg"
        >
          📋 View All Detections
        </button>
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
                </div>
              ) : health ? (
                <div className="mt-2">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${health.status === 'healthy'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                    }`}>
                    {health.status === 'healthy' ? '🟢' : '🔴'} {health.status.toUpperCase()}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* Today's Activity */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">📊 Today's Activity</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{totalToday}</p>
              <p className="text-xs text-slate-500">Images Processed</p>
            </div>
            <div className="text-3xl">📈</div>
          </div>
        </div>

        {/* Performance */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600">⏱️ Performance</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">{avgProcessingTime.toFixed(0)}ms</p>
              <p className="text-xs text-slate-500">Avg Processing Time</p>
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
              <p className="text-xs text-slate-500">Total Detections</p>
            </div>
            <div className="text-3xl">📊</div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-900">🕒 Recent Activity</h2>
          <button
            onClick={refetchRecent}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
          >
            🔄 Refresh
          </button>
        </div>

        <div className="p-6">
          {recentLoading ? (
            <LoadingSpinner message="Loading recent activity..." />
          ) : recent ? (
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
                      <p className="text-sm text-slate-500">{new Date(detection.created_at).toLocaleTimeString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${detection.status === 'completed' ? 'bg-green-100 text-green-800' :
                      detection.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        detection.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                      }`}>
                      {detection.status}
                    </span>
                    <span className="text-sm text-slate-600">🔴 {detection.total_defects}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}