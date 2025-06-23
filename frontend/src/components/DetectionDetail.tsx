// file: src/components/DetectionDetail.tsx

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDetectionDetail } from '@/hooks/useApi';
import { ImageUtils } from '@/services/imageUtils';
import { ImageViewer } from '@/components/common/ImageViewer';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { ROUTES } from '@/constants/config';

export function DetectionDetail() {
  const { detection_id } = useParams<{ detection_id: string }>();
  const navigate = useNavigate();
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [currentImage, setCurrentImage] = useState<'original' | 'annotated'>('annotated');

  const { data: detection, loading, error, refetch } = useDetectionDetail(detection_id!);

  if (loading) return <LoadingSpinner message="Loading detection details..." />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!detection) return <ErrorMessage message="Detection not found" />;

  // Safe URL construction with fallbacks
  const originalUrl = detection.annotated_image_path
    ? ImageUtils.getOriginalUrl(detection.annotated_image_path)
    : '/processed/placeholder.jpg';

  const annotatedUrl = detection.annotated_image_path
    ? ImageUtils.getAnnotatedUrl(detection.annotated_image_path)
    : '/processed/placeholder.jpg';

  const openFullscreen = (imageType: 'original' | 'annotated') => {
    setCurrentImage(imageType);
    setShowFullscreen(true);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(ROUTES.HISTORY)}
            className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
          >
            ← Back to History
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">📋 Detection Details</h1>
            <p className="text-slate-600 mt-1">Analysis results for {detection.original_filename}</p>
          </div>
        </div>

        <button
          onClick={() => openFullscreen('annotated')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 shadow-md hover:shadow-lg"
        >
          🔍 Open Fullscreen Viewer
        </button>
      </div>

      {/* Detection Information Panel */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">📊 Detection Information</h2>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm font-medium text-slate-600 mb-1">📄 Filename</p>
              <p className="font-semibold text-slate-900">{detection.original_filename}</p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm font-medium text-slate-600 mb-1">📊 Status</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${detection.status === 'completed' ? 'bg-green-100 text-green-800' :
                detection.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                  detection.status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                }`}>
                {detection.status.toUpperCase()}
              </span>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm font-medium text-slate-600 mb-1">🔴 Total Defects</p>
              <p className="text-2xl font-bold text-red-600">{detection.total_defects}</p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm font-medium text-slate-600 mb-1">⏱️ Processing Time</p>
              <p className="font-semibold text-slate-900">{detection.processing_time_ms}ms</p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm font-medium text-slate-600 mb-1">🎯 Confidence</p>
              <p className="font-semibold text-slate-900">{(detection.confidence_threshold * 100).toFixed(1)}%</p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm font-medium text-slate-600 mb-1">📅 Created</p>
              <p className="font-semibold text-slate-900">{new Date(detection.created_at).toLocaleString()}</p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 md:col-span-2">
              <p className="text-sm font-medium text-slate-600 mb-1">📁 Folder Path</p>
              <p className="font-semibold text-slate-900 break-all">{detection.el_folder_path}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Side-by-side Images */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Original Image */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-slate-900">🖼️ Original Image</h3>
            <button
              onClick={() => openFullscreen('original')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
            >
              🔍 Fullscreen
            </button>
          </div>

          <div className="p-6">
            <div className="relative bg-slate-100 rounded-lg overflow-hidden group cursor-pointer" onClick={() => openFullscreen('original')}>
              <img
                src={originalUrl}
                alt="Original EL Image"
                className="w-full h-auto rounded-lg transition-transform duration-200 group-hover:scale-105"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjFmNWY5Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzY0NzQ4YiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk9yaWdpbmFsIEltYWdlIE5vdCBGb3VuZDwvdGV4dD48L3N2Zz4=';
                }}
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <span className="bg-white text-slate-900 px-4 py-2 rounded-lg font-medium shadow-lg">
                    🔍 Click to view fullscreen
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Annotated Image */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-slate-900">🎯 Detected Defects</h3>
            <button
              onClick={() => openFullscreen('annotated')}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
            >
              🔍 Fullscreen
            </button>
          </div>

          <div className="p-6">
            <div className="relative bg-slate-100 rounded-lg overflow-hidden group cursor-pointer" onClick={() => openFullscreen('annotated')}>
              <img
                src={annotatedUrl}
                alt="Annotated EL Image"
                className="w-full h-auto rounded-lg transition-transform duration-200 group-hover:scale-105"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjFmNWY5Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzY0NzQ4YiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkFubm90YXRlZCBJbWFnZSBOb3QgRm91bmQ8L3RleHQ+PC9zdmc+';
                }}
              />
              <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200 flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <span className="bg-white text-slate-900 px-4 py-2 rounded-lg font-medium shadow-lg">
                    🔍 Click to view fullscreen
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex justify-center space-x-4">
        <button
          onClick={() => openFullscreen('original')}
          className="bg-slate-600 hover:bg-slate-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
        >
          🖼️ View Original
        </button>
        <button
          onClick={() => openFullscreen('annotated')}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
        >
          🎯 View Defects
        </button>
      </div>

      {/* Fullscreen Image Viewer */}
      {showFullscreen && (
        <ImageViewer
          originalImageUrl={originalUrl}
          annotatedImageUrl={annotatedUrl}
          currentImage={currentImage}
          onClose={() => setShowFullscreen(false)}
          onToggleImage={() => setCurrentImage(
            currentImage === 'original' ? 'annotated' : 'original'
          )}
        />
      )}
    </div>
  );
}