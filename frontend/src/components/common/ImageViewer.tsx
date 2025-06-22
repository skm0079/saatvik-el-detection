// file: src/components/common/ImageViewer.tsx

import { useEffect, useRef } from 'react';
import { FullScreenViewer } from 'iv-viewer';

interface ImageViewerProps {
  originalImageUrl: string;
  annotatedImageUrl: string;
  currentImage: 'original' | 'annotated';
  onClose: () => void;
  onToggleImage: () => void;
}

export function ImageViewer({
  originalImageUrl,
  annotatedImageUrl,
  currentImage,
  onClose,
  onToggleImage
}: ImageViewerProps) {
  const viewerRef = useRef<FullScreenViewer | null>(null);

  useEffect(() => {
    // Initialize iv-viewer
    const viewer = new FullScreenViewer({
      zoomValue: 100,
      maxZoom: 500,
      snapView: true,
      refreshOnResize: true
    });

    viewerRef.current = viewer;

    // Show current image
    const imageUrl = currentImage === 'original' ? originalImageUrl : annotatedImageUrl;
    viewer.show(imageUrl);

    // Cleanup on unmount
    return () => {
      if (viewerRef.current) {
        viewerRef.current.hide();
      }
    };
  }, []);

  // Update image when currentImage changes
  useEffect(() => {
    if (viewerRef.current) {
      const imageUrl = currentImage === 'original' ? originalImageUrl : annotatedImageUrl;
      viewerRef.current.load(imageUrl);
    }
  }, [currentImage, originalImageUrl, annotatedImageUrl]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case ' ': // Spacebar
        case 'Tab':
          e.preventDefault();
          onToggleImage();
          break;
        case 'ArrowLeft':
        case 'ArrowRight':
          e.preventDefault();
          onToggleImage();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [onClose, onToggleImage]);

  return (
    <div className="image-viewer-overlay">
      <div className="viewer-controls">
        <div className="image-toggle">
          <button
            onClick={onToggleImage}
            className={`toggle-btn ${currentImage === 'original' ? 'active' : ''}`}
          >
            🖼️ Original
          </button>
          <button
            onClick={onToggleImage}
            className={`toggle-btn ${currentImage === 'annotated' ? 'active' : ''}`}
          >
            🎯 Detected
          </button>
        </div>
        
        <div className="viewer-actions">
          <span className="help-text">
            Press SPACE to toggle • ESC to close • Mouse wheel to zoom
          </span>
          <button onClick={onClose} className="close-btn">
            ✕ Close
          </button>
        </div>
      </div>
    </div>
  );
}