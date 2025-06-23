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
    <div className="detection-detail">
      <header className="detail-header">
        <button onClick={() => navigate(ROUTES.HISTORY)} className="back-btn">
          ← Back to History
        </button>
        <h1>📋 Detection Details</h1>
      </header>

      {/* Detection Information */}
      <div className="detection-info-panel">
        <div className="info-grid">
          <div className="info-item">
            <label>Filename:</label>
            <span>{detection.original_filename}</span>
          </div>
          <div className="info-item">
            <label>Status:</label>
            <span className={`status status-${detection.status}`}>
              {detection.status}
            </span>
          </div>
          <div className="info-item">
            <label>Total Defects:</label>
            <span className="defect-count">🔴 {detection.total_defects}</span>
          </div>
          <div className="info-item">
            <label>Processing Time:</label>
            <span>⏱️ {detection.processing_time_ms}ms</span>
          </div>
          <div className="info-item">
            <label>Confidence:</label>
            <span>{(detection.confidence_threshold * 100).toFixed(1)}%</span>
          </div>
          <div className="info-item">
            <label>Created:</label>
            <span>📅 {new Date(detection.created_at).toLocaleString()}</span>
          </div>
          <div className="info-item">
            <label>Folder Path:</label>
            <span>📁 {detection.el_folder_path}</span>
          </div>
        </div>
      </div>

      {/* Side-by-side Images */}
      <div className="image-comparison">
        <div className="image-panel">
          <div className="image-header">
            <h3>🖼️ Original Image</h3>
            <button
              onClick={() => openFullscreen('original')}
              className="fullscreen-btn"
            >
              🔍 Fullscreen
            </button>
          </div>
          <div className="image-container">
            <img
              src={originalUrl}
              alt="Original EL Image"
              className="comparison-image"
            />
          </div>
        </div>

        <div className="image-panel">
          <div className="image-header">
            <h3>🎯 Detected Defects</h3>
            <button
              onClick={() => openFullscreen('annotated')}
              className="fullscreen-btn"
            >
              🔍 Fullscreen
            </button>
          </div>
          <div className="image-container">
            <img
              src={annotatedUrl}
              alt="Annotated EL Image"
              className="comparison-image"
            />
          </div>
        </div>
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