// file: src/components/Dashboard.tsx

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHealth, useRecentDetections } from '@/hooks/useApi';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
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

  const avgProcessingTime =
    recent && recent.detections
      ? recent.detections.reduce((acc, d) => acc + d.processing_time_ms, 0) /
        (recent.detections.length || 1)
      : 0;

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>🏭 Saatvik EL Detection System</h1>
        <div className="header-actions">
          <button onClick={() => navigate(ROUTES.HISTORY)} className="primary-btn">
            📋 View All Detections
          </button>
        </div>
      </header>

      {/* System Health */}
      <div className="status-grid">
        <div className="status-card">
          <h3>🏥 System Health</h3>
          {healthLoading ? (
            <LoadingSpinner message="Checking health..." />
          ) : healthError ? (
            <ErrorMessage message={healthError} onRetry={refetchHealth} />
          ) : health ? (
            <div className={`health-status ${health.status}`}>
              <span className="status-indicator">
                {health.status === 'healthy' ? '🟢' : '🔴'}
              </span>
              <span className="status-text">{health.status.toUpperCase()}</span>
            </div>
          ) : null}
        </div>

        <div className="status-card">
          <h3>📊 Today's Activity</h3>
          <div className="metric">
            <span className="metric-value">{totalToday}</span>
            <span className="metric-label">Images Processed</span>
          </div>
        </div>

        <div className="status-card">
          <h3>⏱️ Performance</h3>
          <div className="metric">
            <span className="metric-value">{avgProcessingTime.toFixed(0)}ms</span>
            <span className="metric-label">Avg Processing Time</span>
          </div>
        </div>

        <div className="status-card">
          <h3>📈 Total Records</h3>
          <div className="metric">
            <span className="metric-value">{recent?.total || 0}</span>
            <span className="metric-label">Total Detections</span>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="recent-activity">
        <div className="section-header">
          <h2>🕒 Recent Activity</h2>
          <button onClick={refetchRecent} className="refresh-btn">
            🔄 Refresh
          </button>
        </div>

        {recentLoading ? (
          <LoadingSpinner message="Loading recent activity..." />
        ) : recent ? (
          <div className="activity-list">
            {recent.detections.slice(0, 5).map((detection) => (
              <div
                key={detection.detection_id}
                className="activity-item"
                onClick={() => navigate(`${ROUTES.DETAIL}/${detection.detection_id}`)}
              >
                <div className="activity-info">
                  <span className="filename">{detection.original_filename}</span>
                  <span className={`status status-${detection.status}`}>
                    {detection.status}
                  </span>
                </div>
                <div className="activity-meta">
                  <span className="defects">🔴 {detection.total_defects}</span>
                  <span className="time">{new Date(detection.created_at).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No recent activity</p>
        )}
      </div>
    </div>
  );
}