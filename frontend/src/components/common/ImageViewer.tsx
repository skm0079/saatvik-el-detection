// file: src/components/common/ImageViewer.tsx

import { useEffect, useRef, useState } from 'react';

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
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  const currentImageUrl = currentImage === 'original' ? originalImageUrl : annotatedImageUrl;

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
    document.body.style.overflow = 'hidden'; // Prevent background scroll

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
      document.body.style.overflow = 'unset';
    };
  }, [onClose, onToggleImage]);

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex flex-col">
      {/* Header Controls */}
      <div className="flex justify-between items-center p-4 bg-black bg-opacity-50">
        <div className="flex items-center space-x-4">
          {/* Image Toggle Buttons */}
          <button
            onClick={onToggleImage}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${currentImage === 'original'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
              }`}
          >
            🖼️ Original
          </button>
          <button
            onClick={onToggleImage}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${currentImage === 'annotated'
              ? 'bg-red-600 text-white shadow-lg'
              : 'bg-white bg-opacity-20 text-white hover:bg-opacity-30'
              }`}
          >
            🎯 Defects
          </button>
        </div>

        {/* Help Text & Close */}
        <div className="flex items-center space-x-4">
          <span className="text-white text-sm bg-black bg-opacity-50 px-3 py-1 rounded">
            Press SPACE to toggle • ESC to close • Mouse wheel to zoom
          </span>
          <button
            onClick={onClose}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* Image Container */}
      <div className="flex-1 flex items-center justify-center p-4 relative">
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p>Loading image...</p>
            </div>
          </div>
        )}

        {imageError && (
          <div className="text-white text-center">
            <div className="text-6xl mb-4">❌</div>
            <p className="text-xl mb-2">Failed to load image</p>
            <p className="text-sm opacity-75">Check if the image file exists</p>
          </div>
        )}

        <img
          ref={imageRef}
          src={currentImageUrl}
          alt={currentImage === 'original' ? 'Original EL Image' : 'Annotated EL Image'}
          className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          onLoad={handleImageLoad}
          onError={handleImageError}
          style={{
            filter: imageLoaded ? 'none' : 'blur(10px)',
          }}
        />

        {/* Navigation Hint */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
          <div className="bg-black bg-opacity-50 text-white px-4 py-2 rounded-lg text-sm">
            {currentImage === 'original' ? '🖼️ Original Image' : '🎯 Defects Detected'}
          </div>
        </div>
      </div>

      {/* Click Overlay to Close */}
      <div
        className="absolute inset-0 -z-10"
        onClick={onClose}
      />
    </div>
  );
}