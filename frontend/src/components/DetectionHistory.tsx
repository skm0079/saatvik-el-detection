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
  const [limit, setLimit] = useState(UI.DEFAULT_LIMIT);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">🔍 Detection History</h1>
          <p className="text-slate-600 mt-1">Browse and analyze all EL detection results</p>
        </div>
        <button
          onClick={refetch}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 shadow-md hover:shadow-lg"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search Box */}
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by filename..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-slate-400">🔍</span>
              </div>
            </div>
          </div>

          {/* Status Filter */}
          <div className="sm:w-48">
            <select
              onChange={(e) => handleStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            >
              <option value="">All Status</option>
              <option value="completed">✅ Completed</option>
              <option value="processing">🔄 Processing</option>
              <option value="failed">❌ Failed</option>
              <option value="pending">⏳ Pending</option>
            </select>
          </div>

          {/* Search Button */}
          <button
            onClick={handleSearch}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors duration-200"
          >
            🔍 Search
          </button>
        </div>
      </div>

      {/* Results Summary */}
      <div className="flex justify-between items-center text-sm text-slate-600">
        <p>
          Showing {offset + 1}-{Math.min(offset + limit, data.total)} of {data.total} detections
        </p>
        <div className="flex items-center space-x-2">
          <span>Show:</span>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="border border-slate-300 rounded px-2 py-1 text-sm"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          <span>per page</span>
        </div>
      </div>

      {/* Detection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.detections.map((detection) => (
          <div
            key={detection.detection_id}
            className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden hover:shadow-lg hover:scale-[1.02] transition-all duration-200 cursor-pointer group"
            onClick={() => handleViewDetail(detection.detection_id)}
          >
            {/* Image Thumbnail */}
            <div className="relative h-48 bg-slate-100">
              <img
                src={ImageUtils.getThumbnailUrl(detection.thumbnail_path)}
                alt={detection.original_filename}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback to a placeholder
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjFmNWY5Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzY0NzQ4YiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';
                }}
                loading="lazy"
              />

              {/* Status Badge */}
              <div className="absolute top-3 right-3">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${detection.status === 'completed' ? 'bg-green-100 text-green-800' :
                  detection.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                    detection.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                  }`}>
                  {detection.status}
                </span>
              </div>

              {/* Defect Count Badge */}
              {detection.total_defects > 0 && (
                <div className="absolute top-3 left-3">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    🔴 {detection.total_defects} defects
                  </span>
                </div>
              )}

              {/* Hover Overlay */}
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <span className="bg-white text-slate-900 px-4 py-2 rounded-lg font-medium shadow-lg">
                    👁️ View Details
                  </span>
                </div>
              </div>
            </div>

            {/* Card Content */}
            <div className="p-4">
              <h3 className="font-semibold text-slate-900 mb-2 truncate" title={detection.original_filename}>
                {detection.original_filename}
              </h3>

              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex justify-between items-center">
                  <span>⏱️ Processing Time:</span>
                  <span className="font-medium">{detection.processing_time_ms}ms</span>
                </div>

                <div className="flex justify-between items-center">
                  <span>🎯 Confidence:</span>
                  <span className="font-medium">{(detection.confidence_threshold * 100).toFixed(1)}%</span>
                </div>

                <div className="flex justify-between items-center">
                  <span>📅 Created:</span>
                  <span className="font-medium">{new Date(detection.created_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Folder Path */}
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
          <span className="text-sm text-slate-600">
            Page {currentPage} of {totalPages}
          </span>
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