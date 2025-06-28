// File: frontend/src/components/common/ImageViewer.tsx
import { useEffect, useRef, useState, useCallback } from 'react';

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
  // SIMPLIFIED STATE MANAGEMENT
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const currentImageUrl = currentImage === 'original' ? originalImageUrl : annotatedImageUrl;

  // Reset states when image changes
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentImage, currentImageUrl]);

  // SIMPLIFIED ZOOM FUNCTIONS
  const zoomIn = useCallback(() => {
    setScale(prev => Math.min(3, prev + 0.25));
  }, []);

  const zoomOut = useCallback(() => {
    setScale(prev => Math.max(0.25, prev - 0.25));
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // FIXED DRAG HANDLING
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
      e.preventDefault();
    }
  }, [scale, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, dragStart, scale]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // KEYBOARD CONTROLS
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case ' ':
        case 'Tab':
          e.preventDefault();
          onToggleImage();
          break;
        case '=':
        case '+':
          e.preventDefault();
          zoomIn();
          break;
        case '-':
          e.preventDefault();
          zoomOut();
          break;
        case '0':
          e.preventDefault();
          resetZoom();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
      document.body.style.overflow = 'unset';
    };
  }, [onClose, onToggleImage, zoomIn, zoomOut, resetZoom]);

  // MOUSE WHEEL ZOOM
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setScale(prev => Math.max(0.25, Math.min(3, prev + delta)));
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false });
      return () => container.removeEventListener('wheel', handleWheel);
    }
  }, []);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setImageError(false);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
    setImageLoaded(false);
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex flex-col">
      {/* Header Controls */}
      <div className="flex justify-between items-center p-4 bg-black bg-opacity-70">
        <div className="flex items-center space-x-4">
          {/* Image Toggle Buttons */}
          <div className="flex bg-black bg-opacity-50 rounded-lg p-1">
            <button
              onClick={onToggleImage}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${currentImage === 'original'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-white hover:bg-white hover:bg-opacity-20'
                }`}
            >
              🖼️ Original
            </button>
            <button
              onClick={onToggleImage}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${currentImage === 'annotated'
                ? 'bg-red-600 text-white shadow-lg'
                : 'text-white hover:bg-white hover:bg-opacity-20'
                }`}
            >
              🎯 Defects
            </button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center space-x-2 bg-black bg-opacity-50 rounded-lg px-3 py-2">
            <button
              onClick={zoomOut}
              disabled={scale <= 0.25}
              className="text-white hover:text-blue-400 disabled:text-gray-500 text-xl w-8 h-8 flex items-center justify-center rounded hover:bg-white hover:bg-opacity-10"
            >
              −
            </button>
            <span className="text-white text-sm min-w-[4rem] text-center font-medium">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={zoomIn}
              disabled={scale >= 3}
              className="text-white hover:text-blue-400 disabled:text-gray-500 text-xl w-8 h-8 flex items-center justify-center rounded hover:bg-white hover:bg-opacity-10"
            >
              +
            </button>
            <button
              onClick={resetZoom}
              className="text-white hover:text-blue-400 text-sm ml-2 px-2 py-1 rounded hover:bg-white hover:bg-opacity-10"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Help & Close */}
        <div className="flex items-center space-x-4">
          <div className="text-white text-sm bg-black bg-opacity-50 px-3 py-2 rounded-lg">
            <span className="hidden md:inline">SPACE: Toggle • +/-: Zoom • 0: Reset • ESC: Close • </span>
            <span>Drag to Pan</span>
          </div>
          <button
            onClick={onClose}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
          >
            ✕ Close
          </button>
        </div>
      </div>

      {/* Main Image Container */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center p-4 relative overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
        }}
      >
        {/* Loading State */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p className="text-lg font-medium">Loading image...</p>
              <p className="text-sm opacity-75 mt-2">
                {currentImage === 'original' ? 'Original EL Image' : 'Defect Analysis'}
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {imageError && (
          <div className="text-white text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="text-xl font-bold mb-2">Image Not Available</h3>
            <p className="text-sm opacity-75 mb-4">
              The {currentImage} image could not be loaded.
            </p>
            <div className="space-x-3">
              <button
                onClick={() => {
                  setImageError(false);
                  setImageLoaded(false);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                🔄 Retry
              </button>
              <button
                onClick={onToggleImage}
                className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                🔄 Switch Image
              </button>
            </div>
          </div>
        )}

        {/* Main Image - SIMPLIFIED TRANSFORM */}
        <img
          ref={imageRef}
          src={currentImageUrl}
          alt={`${currentImage} EL Image`}
          className={`max-w-none transition-all duration-200 select-none ${imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            transformOrigin: 'center center',
            maxHeight: '90vh',
            maxWidth: '90vw'
          }}
          onLoad={handleImageLoad}
          onError={handleImageError}
          onDragStart={(e) => e.preventDefault()}
        />

        {/* Status Overlay */}
        {imageLoaded && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2">
            <div className="bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg text-sm flex items-center space-x-2">
              <span>
                {currentImage === 'original' ? '🖼️ Original Image' : '🎯 Defects Detected'}
              </span>
              {scale !== 1 && (
                <>
                  <span>•</span>
                  <span>Zoom: {Math.round(scale * 100)}%</span>
                </>
              )}
              {scale > 1 && (
                <>
                  <span>•</span>
                  <span>Drag to pan</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}