// File: src/components/DetectionDetail.tsx
// COMPLETE: Added individual Excel export with images and all data points

import { useState, useCallback } from 'react';
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
  const [isExporting, setIsExporting] = useState(false);

  const { data: detection, loading, error, refetch } = useDetectionDetail(detection_id!);

  // NEW: Individual detection export handler
  const handleExportDetection = useCallback(async () => {
    if (!detection) return;

    setIsExporting(true);
    try {
      // Call the enhanced /status endpoint with xlsx format
      const response = await fetch(`/api/v1/detect/recent?format=xlsx&limit=1&offset=0&search=${detection.original_filename}`);

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status} - ${response.statusText}`);
      }

      const blob = await response.blob();

      // Check if response is actually an Excel file
      if (blob.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        throw new Error('Invalid response format - expected Excel file');
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Generate meaningful filename for single detection
      const cleanFilename = detection.original_filename.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9]/g, '_');
      const shortId = detection_id?.slice(0, 8) || 'unknown';
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `saatvik_detection_${cleanFilename}_${shortId}_${timestamp}.xlsx`;

      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log('✅ Individual detection export completed:', filename);
    } catch (error) {
      console.error('❌ Export failed:', error);

      // More detailed error handling
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      }

      alert(`Export failed: ${errorMessage}\n\nPlease try again or contact support if the issue persists.`);
    } finally {
      setIsExporting(false);
    }
  }, [detection, detection_id]);

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
      {/* ENHANCED Header with Export */}
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

        <div className="flex space-x-3">
          <button
            onClick={handleExportDetection}
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
                <span>Export Excel</span>
              </>
            )}
          </button>

          <button
            onClick={() => openFullscreen('annotated')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 shadow-md hover:shadow-lg"
          >
            🔍 Fullscreen Viewer
          </button>
        </div>
      </div>

      {/* Detection Information Panel */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">📊 Detection Information</h2>
          <p className="text-sm text-slate-600 mt-1">Complete analysis data for this detection</p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm font-medium text-slate-600 mb-1">📄 Filename</p>
              <p className="font-semibold text-slate-900 break-words">{detection.original_filename}</p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm font-medium text-slate-600 mb-1">🆔 Detection ID</p>
              <p className="font-mono text-xs text-slate-700 break-all">{detection.detection_id}</p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm font-medium text-slate-600 mb-1">📊 Status</p>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${detection.status === 'completed' || detection.status === 'saved' ? 'bg-green-100 text-green-800' :
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
              <p className="text-sm font-medium text-slate-600 mb-1">🎯 Confidence Threshold</p>
              <p className="font-semibold text-slate-900">{(detection.confidence_threshold * 100).toFixed(1)}%</p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm font-medium text-slate-600 mb-1">📅 Created At</p>
              <p className="font-semibold text-slate-900 text-sm">{new Date(detection.created_at).toLocaleString()}</p>
            </div>


            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm font-medium text-slate-600 mb-1">🤖 Machine</p>
              <p className="font-semibold text-slate-900">{detection.machine_name}</p>
              <p className="text-xs text-slate-500 mt-1">ID: {detection.machine_id}</p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 md:col-span-2">
              <p className="text-sm font-medium text-slate-600 mb-1">📁 Folder Path</p>
              <p className="font-semibold text-slate-900 break-all text-xs">{detection.el_folder_path}</p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm font-medium text-slate-600 mb-1">📷 Image Files</p>
              <div className="text-xs space-y-1">
                <p className="text-slate-700">📸 Original: Available</p>
                <p className="text-slate-700">🎯 Annotated: {detection.annotated_image_path ? 'Available' : 'N/A'}</p>
                <p className="text-slate-700">🖼️ Thumbnail: {detection.thumbnail_path ? 'Available' : 'N/A'}</p>
              </div>
            </div>
          </div>

          {/* ENHANCED: Historical Paths Section */}
          {detection.paths_at_creation && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center">
                📂 Machine Paths (When Detection Was Created)
                <span className="ml-2 text-xs bg-blue-200 text-blue-600 px-2 py-1 rounded">
                  Historical Data
                </span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium text-blue-700">📁 Source Path:</span>
                  <div className="font-mono text-xs bg-white p-2 rounded border mt-1 break-all">
                    {detection.paths_at_creation.source}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-blue-700">👁️ Watch Path:</span>
                  <div className="font-mono text-xs bg-white p-2 rounded border mt-1 break-all">
                    {detection.paths_at_creation.watch}
                  </div>
                </div>
                <div>
                  <span className="font-medium text-blue-700">💾 Processed Path:</span>
                  <div className="font-mono text-xs bg-white p-2 rounded border mt-1 break-all">
                    {detection.paths_at_creation.processed}
                  </div>
                </div>
              </div>
              <div className="mt-3 p-2 bg-blue-100 rounded text-xs text-blue-700">
                <span className="font-medium">📍 Context:</span> These paths were active when this detection was processed on{' '}
                <span className="font-semibold">{new Date(detection.created_at).toLocaleDateString()}</span> at{' '}
                <span className="font-semibold">{new Date(detection.created_at).toLocaleTimeString()}</span>
              </div>
            </div>
          )}

          {/* Warning if no historical paths available */}
          {!detection.paths_at_creation && (
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <h3 className="text-sm font-semibold text-yellow-800 mb-2 flex items-center">
                ⚠️ Historical Path Information Not Available
              </h3>
              <p className="text-xs text-yellow-700">
                Contact Support for assistance in retrieving historical paths for this detection.
              </p>
            </div>
          )}

          {/* NEW: Export Information Panel */}
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <h3 className="text-sm font-semibold text-green-800 mb-3 flex items-center">
              📊 Excel Export Information
              <span className="ml-2 text-xs bg-green-200 text-green-600 px-2 py-1 rounded">
                Data Included
              </span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-green-700">📋 Metadata:</span>
                <ul className="text-xs text-green-600 mt-1 space-y-1">
                  <li>• Machine ID & Name</li>
                  <li>• Filename & Detection ID</li>
                  <li>• Processing Time & Confidence</li>
                  <li>• Status & Timestamps</li>
                </ul>
              </div>
              <div>
                <span className="font-medium text-green-700">🎯 Defect Data:</span>
                <ul className="text-xs text-green-600 mt-1 space-y-1">
                  <li>• Total Defects Count</li>
                  <li>• Readable Defect Details</li>
                  <li>• Historical Machine Paths</li>
                  <li>• Folder & File Information</li>
                </ul>
              </div>
            </div>
            <div className="mt-3 p-2 bg-green-100 rounded text-xs text-green-700">
              <span className="font-medium">💡 Note:</span> The Excel export contains all detection data in a business-friendly format.
              Original and annotated images are referenced by their static URLs for easy access.
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
            <div className="flex space-x-2">
              <button
                onClick={() => window.open(originalUrl, '_blank')}
                className="bg-slate-500 hover:bg-slate-600 text-white px-3 py-1 rounded text-sm font-medium transition-colors duration-200"
              >
                🔗 Open
              </button>
              <button
                onClick={() => openFullscreen('original')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
              >
                🔍 Fullscreen
              </button>
            </div>
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
            <div className="mt-2 text-xs text-slate-500 text-center">
              📎 URL: {originalUrl}
            </div>
          </div>
        </div>

        {/* Annotated Image */}
        <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="text-lg font-semibold text-slate-900">🎯 Detected Defects</h3>
            <div className="flex space-x-2">
              <button
                onClick={() => window.open(annotatedUrl, '_blank')}
                className="bg-slate-500 hover:bg-slate-600 text-white px-3 py-1 rounded text-sm font-medium transition-colors duration-200"
              >
                🔗 Open
              </button>
              <button
                onClick={() => openFullscreen('annotated')}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200"
              >
                🔍 Fullscreen
              </button>
            </div>
          </div>

          <div className="p-6">
            <div className="relative bg-slate-100 rounded-lg overflow-hidden group cursor-pointer" onClick={() => openFullscreen('annotated')}>
              <img
                src={annotatedUrl}
                alt="Annotated EL Image"
                className="w-full h-auto rounded-lg transition-transform duration-200 group-hover:scale-105"
                onError={(e) => {
                  const target = e.currentTarget as HTMLImageElement;
                  target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjFmNWY5Ci8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzY0NzQ4YiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkFubm90YXRlZCBJbWFnZSBOb3QgRm91bmQ8L3RleHQ+PC9zdmc+';
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
            <div className="mt-2 text-xs text-slate-500 text-center">
              📎 URL: {annotatedUrl}
            </div>
          </div>
        </div>
      </div>

      {/* Enhanced Quick Actions */}
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
        <button
          onClick={handleExportDetection}
          disabled={isExporting}
          className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
        >
          {isExporting ? '⏳ Exporting...' : '📊 Export Excel'}
        </button>
        <button
          onClick={() => navigate(ROUTES.HISTORY)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200"
        >
          📋 Back to History
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