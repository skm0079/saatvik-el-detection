// file: src/components/DetectionHistory.tsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecentDetections } from '@/hooks/useApi';
import { ImageUtils } from '@/services/imageUtils';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { UI, ROUTES } from '@/constants/config';
import type { SearchFilters } from '@/types';

export function DetectionHistory() {
  const navigate = useNavigate();
  const [limit] = useState(UI.DEFAULT_LIMIT);
  const [offset, setOffset] = useState(0);
  const [filters, setFilters] = useState<SearchFilters>({});
  const [search, setSearch] = useState('');

  const { data, loading, error, refetch } = useRecentDetections(limit, offset, filters);

  // Handle search
  const handleSearch = () => {
    setFilters({ ...filters, search: search || undefined });
    setOffset(0); // Reset to first page
  };

  // Handle pagination
  const handleNextPage = () => {
    if (data && offset + limit < data.total) {
      setOffset(offset + limit);
    }
  };

  const handlePrevPage = () => {
    if (offset > 0) {
      setOffset(Math.max(0, offset - limit));
    }
  };

  // Handle filter changes
  const handleStatusFilter = (status: string) => {
    setFilters({ ...filters, status: status || undefined });
    setOffset(0);
  };

  // Navigate to detail view
  const handleViewDetail = (detection_id: string) => {
    navigate(`${ROUTES.DETAIL}/${detection_id}`);
  };

  if (loading) return <LoadingSpinner message="Loading detections..." />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!data) return <ErrorMessage message="No data available" />;

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(data.total / limit);

  return (
    <div className="detection-history">
      <header className="history-header">
        <h1>🔍 Detection History</h1>
        <div className="controls">
          <button onClick={refetch} className="refresh-btn">
            🔄 Refresh
          </button>
        </div>
      </header>

      {/* Search and Filters */}
      <div className="search-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search filename..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch}>🔍 Search</button>
        </div>

        <div className="filters">
          <select onChange={(e) => handleStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="processing">Processing</option>
          </select>
        </div>
      </div>

      {/* Results Summary */}
      <div className="results-summary">
        <p>
          Showing {offset + 1}-{Math.min(offset + limit, data.total)} of {data.total} detections
        </p>
      </div>

      {/* Detection List */}
      <div className="detection-list">
        {data.detections.map((detection) => (
          <div
            key={detection.detection_id}
            className="detection-item"
            onClick={() => handleViewDetail(detection.detection_id)}
          >
            <div className="detection-thumbnail">
              <img
                src={ImageUtils.getThumbnailUrl(detection.thumbnail_path)}
                alt={detection.original_filename}
                loading="lazy"
              />
            </div>
            
            <div className="detection-info">
              <h3 className="filename">{detection.original_filename}</h3>
              <div className="details">
                <span className={`status status-${detection.status}`}>
                  {detection.status}
                </span>
                <span className="defects">
                  🔴 {detection.total_defects} defects
                </span>
                <span className="time">
                  ⏱️ {detection.processing_time_ms}ms
                </span>
              </div>
              <div className="metadata">
                <span className="created-at">
                  📅 {new Date(detection.created_at).toLocaleString()}
                </span>
                <span className="folder">
                  📁 {detection.el_folder_path}
                </span>
              </div>
            </div>

            <div className="detection-actions">
              <button className="view-btn">👁️ View</button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="pagination">
        <button
          onClick={handlePrevPage}
          disabled={offset === 0}
          className="page-btn"
        >
          ← Previous
        </button>
        
        <span className="page-info">
          Page {currentPage} of {totalPages}
        </span>
        
        <button
          onClick={handleNextPage}
          disabled={offset + limit >= data.total}
          className="page-btn"
        >
          Next →
        </button>
      </div>
    </div>
  );
}