// file: src/components/LiveImageViewer.tsx

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecentDetections } from '@/hooks/useApi';
import { ImageUtils } from '@/services/imageUtils';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { ROUTES, UI } from '@/constants/config';
import type { DetectionRecord } from '@/types';

export function LiveImageViewer() {
    const navigate = useNavigate();

    // All state hooks first - never conditional
    const [currentIndex, setCurrentIndex] = useState(0);
    const [autoMode, setAutoMode] = useState(true);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(true);
    const [syncing, setSyncing] = useState(false);

    // Data hook
    const { data, loading, error, refetch } = useRecentDetections(50, 0);

    // Derived values
    const detections = data?.detections || [];
    const currentDetection = detections[currentIndex];

    // All useCallback hooks - never conditional
    const handleImageLoad = useCallback(() => {
        setImageLoaded(true);
        setImageError(false);
    }, []);

    const handleImageError = useCallback((imageUrl: string) => {
        console.error('Image failed to load:', imageUrl);
        setImageError(true);
        setImageLoaded(false);
    }, []);

    const getImageUrl = useCallback((detection: DetectionRecord) => {
        if (!detection) {
            console.warn('No detection provided to getImageUrl');
            return '/processed/placeholder.jpg';
        }

        console.log('Detection data:', {
            detection_id: detection.detection_id,
            annotated_image_path: detection.annotated_image_path,
            thumbnail_path: detection.thumbnail_path,
            original_filename: detection.original_filename
        });

        if (detection.annotated_image_path) {
            const annotatedUrl = ImageUtils.getAnnotatedUrl(detection.annotated_image_path);
            console.log('Using annotated URL:', annotatedUrl);
            return annotatedUrl;
        } else if (detection.thumbnail_path) {
            const thumbnailUrl = ImageUtils.getThumbnailUrl(detection.thumbnail_path);
            console.log('Using thumbnail URL:', thumbnailUrl);
            return thumbnailUrl;
        } else {
            console.warn('No image paths available, using placeholder');
            return '/processed/placeholder.jpg';
        }
    }, []);

    const handlePrevious = useCallback(() => {
        if (currentIndex < detections.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setImageLoaded(false);
            setImageError(false);
        }
    }, [currentIndex, detections.length]);

    const handleNext = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
            setImageLoaded(false);
            setImageError(false);
        }
    }, [currentIndex]);

    const handleSync = useCallback(async () => {
        if (syncing) return;

        setSyncing(true);

        try {
            const oldDetectionId = currentDetection?.detection_id;
            await refetch();

            setCurrentIndex(0);

            // Check if we got new data after refetch
            const newDetections = data?.detections || [];
            const newLatestDetection = newDetections[0];

            if (!oldDetectionId || (newLatestDetection && newLatestDetection.detection_id !== oldDetectionId)) {
                setImageLoaded(false);
                setImageError(false);
            }
        } catch (error) {
            console.error('Sync failed:', error);
            setImageError(true);
        } finally {
            setSyncing(false);
        }
    }, [refetch, syncing, currentDetection, data]);

    const toggleFullscreen = useCallback(() => {
        setIsFullscreen(!isFullscreen);
    }, [isFullscreen]);

    // All useEffect hooks - never conditional, always in same order
    useEffect(() => {
        if (!autoMode) return;

        const interval = setInterval(async () => {
            try {
                await refetch();
                setCurrentIndex(0);
            } catch (error) {
                console.error('Auto-refresh failed:', error);
            }
        }, UI.REFRESH_INTERVAL);

        return () => clearInterval(interval);
    }, [autoMode, refetch]);

    useEffect(() => {
        if (autoMode && detections.length > 0) {
            setCurrentIndex(0);
            const newDetection = detections[0];
            if (currentDetection && newDetection.detection_id !== currentDetection.detection_id) {
                setImageLoaded(false);
                setImageError(false);
            }
        }
    }, [autoMode, detections, currentDetection]);

    useEffect(() => {
        setImageLoaded(false);
        setImageError(false);
    }, [currentIndex, currentDetection?.detection_id]);

    useEffect(() => {
        const handleKeyPress = (e: KeyboardEvent) => {
            switch (e.key) {
                case 'ArrowLeft':
                    if (!autoMode && currentIndex < detections.length - 1) {
                        e.preventDefault();
                        handlePrevious();
                    }
                    break;
                case 'ArrowRight':
                    if (!autoMode && currentIndex > 0) {
                        e.preventDefault();
                        handleNext();
                    }
                    break;
                case ' ':
                    e.preventDefault();
                    handleSync();
                    break;
                case 'f':
                case 'F':
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case 'F11':
                    e.preventDefault();
                    toggleFullscreen();
                    break;
                case 'Escape':
                    if (isFullscreen) {
                        e.preventDefault();
                        setIsFullscreen(false);
                    }
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyPress);
        return () => document.removeEventListener('keydown', handleKeyPress);
    }, [autoMode, currentIndex, detections.length, handlePrevious, handleNext, handleSync, toggleFullscreen, isFullscreen]);

    // Early returns AFTER all hooks
    if (loading && !currentDetection) {
        return <LoadingSpinner message="Loading latest image..." />;
    }

    if (error) {
        return <ErrorMessage message={error} onRetry={refetch} />;
    }

    if (!currentDetection) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[80vh]">
                <div className="text-6xl mb-4">📷</div>
                <h2 className="text-2xl font-bold text-slate-700 mb-2">No Images Available</h2>
                <p className="text-slate-500 mb-6">Waiting for the first detection to arrive...</p>
                <button
                    onClick={handleSync}
                    disabled={syncing}
                    className={`px-6 py-3 rounded-lg font-medium transition-colors duration-200 ${syncing
                        ? 'bg-gray-500 cursor-not-allowed text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                >
                    {syncing ? '⏳ Checking...' : '🔄 Check for Images'}
                </button>
            </div>
        );
    }

    const imageUrl = getImageUrl(currentDetection);

    const containerClass = isFullscreen
        ? "fixed inset-0 z-50 bg-transparent flex flex-col"
        : "space-y-6";

    const headerClass = isFullscreen
        ? "absolute top-0 left-0 right-0 z-10 bg-transparent bg-opacity-75 backdrop-blur-sm"
        : "";

    const imageContainerClass = isFullscreen
        ? "flex-1 flex items-center justify-center relative"
        : "bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden";

    return (
        <div className={containerClass}>
            {/* Header Controls */}
            <div className={`flex justify-between items-center p-4 ${headerClass}`}>
                <div>
                    <h1 className={`text-3xl font-bold ${isFullscreen ? 'text-white' : 'text-slate-900'}`}>
                        📺 Live Image Viewer
                    </h1>
                    <p className={`mt-1 ${isFullscreen ? 'text-slate-300' : 'text-slate-600'}`}>
                        Real-time display of EL detection results
                    </p>
                </div>

                <div className="flex items-center space-x-4">
                    {/* Fullscreen Toggle */}
                    <button
                        onClick={toggleFullscreen}
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${isFullscreen
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                        title={isFullscreen ? "Exit Fullscreen (F/Esc)" : "Enter Fullscreen (F)"}
                    >
                        {isFullscreen ? '🪟 Exit Fullscreen' : '⛶ Fullscreen'}
                    </button>

                    {/* Auto/Manual Toggle */}
                    <div className="flex items-center space-x-2">
                        <span className={`text-sm ${isFullscreen ? 'text-slate-300' : 'text-slate-600'}`}>Mode:</span>
                        <button
                            onClick={() => setAutoMode(!autoMode)}
                            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${autoMode
                                ? 'bg-green-600 text-white shadow-md'
                                : `${isFullscreen ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`
                                }`}
                        >
                            {autoMode ? '🔄 AUTO' : '👆 MANUAL'}
                        </button>
                    </div>

                    {/* Navigation Controls */}
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={handlePrevious}
                            disabled={autoMode || currentIndex >= detections.length - 1}
                            className={`p-2 rounded-lg transition-colors duration-200 ${autoMode || currentIndex >= detections.length - 1
                                ? `${isFullscreen ? 'bg-slate-800 text-slate-600' : 'bg-slate-100 text-slate-400'} cursor-not-allowed`
                                : `${isFullscreen ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-600 hover:bg-slate-700 text-white'}`
                                }`}
                            title="Previous Image (←)"
                        >
                            ←
                        </button>

                        <span className={`text-sm px-2 ${isFullscreen ? 'text-slate-300' : 'text-slate-600'}`}>
                            {currentIndex + 1} / {detections.length}
                        </span>

                        <button
                            onClick={handleNext}
                            disabled={autoMode || currentIndex <= 0}
                            className={`p-2 rounded-lg transition-colors duration-200 ${autoMode || currentIndex <= 0
                                ? `${isFullscreen ? 'bg-slate-800 text-slate-600' : 'bg-slate-100 text-slate-400'} cursor-not-allowed`
                                : `${isFullscreen ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-600 hover:bg-slate-700 text-white'}`
                                }`}
                            title="Next Image (→)"
                        >
                            →
                        </button>
                    </div>

                    {/* Sync Button */}
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${syncing
                            ? 'bg-gray-500 cursor-not-allowed text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                        title="Sync to Latest (Space)"
                    >
                        {syncing ? '⏳ Syncing...' : '🔄 Sync'}
                    </button>

                    {/* Dashboard Link - Only show when not fullscreen */}
                    {!isFullscreen && (
                        <button
                            onClick={() => navigate(ROUTES.DASHBOARD)}
                            className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
                        >
                            📊 Dashboard
                        </button>
                    )}
                </div>
            </div>

            {/* Status Bar - Only show when not fullscreen */}
            {!isFullscreen && (
                <div className="bg-white rounded-xl shadow-md border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-6">
                            <div className="flex items-center space-x-2">
                                <div className={`w-3 h-3 rounded-full ${autoMode ? 'bg-green-400 animate-pulse' : 'bg-slate-400'}`}></div>
                                <span className="text-sm font-medium text-slate-700">
                                    {autoMode ? 'Auto Refresh ON' : 'Manual Mode'}
                                </span>
                            </div>

                            <div className="text-sm text-slate-600">
                                <span className="font-medium">📄 {currentDetection.original_filename}</span>
                            </div>

                            <div className="text-sm text-slate-600">
                                <span className="font-medium">🕐 {new Date(currentDetection.created_at).toLocaleString()}</span>
                            </div>

                            <div className="text-sm text-slate-600">
                                <span className="font-medium">🔴 {currentDetection.total_defects} defects</span>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => navigate(`${ROUTES.DETAIL}/${currentDetection.detection_id}`)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors duration-200"
                            >
                                📋 View Details
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Image Display */}
            <div className={imageContainerClass}>
                <div className={`relative ${isFullscreen ? 'w-full h-full' : 'min-h-[70vh]'} flex items-center justify-center ${isFullscreen ? 'bg-transparent' : 'bg-slate-100'}`}>
                    {/* Loading State */}
                    {!imageLoaded && !imageError && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                                <p className={`${isFullscreen ? 'text-white' : 'text-slate-600'}`}>Loading image...</p>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {imageError && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                                <div className="text-6xl mb-4">❌</div>
                                <p className={`text-xl mb-2 ${isFullscreen ? 'text-white' : 'text-slate-700'}`}>Failed to load image</p>
                                <p className={`text-sm mb-4 ${isFullscreen ? 'text-slate-300' : 'text-slate-500'}`}>Image might not be available yet</p>
                                <button
                                    onClick={handleSync}
                                    disabled={syncing}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${syncing
                                        ? 'bg-gray-500 cursor-not-allowed text-white'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                        }`}
                                >
                                    {syncing ? '⏳ Trying...' : '🔄 Try Again'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Main Image */}
                    <img
                        key={`${currentDetection.detection_id}-${imageUrl}`}
                        src={imageUrl}
                        alt={`EL Detection: ${currentDetection.original_filename}`}
                        className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'
                            }`}
                        onLoad={handleImageLoad}
                        onError={() => handleImageError(imageUrl)}
                        style={{
                            filter: imageLoaded ? 'none' : 'blur(10px)',
                        }}
                    />

                    {/* Image Overlay Info */}
                    {imageLoaded && (
                        <div className="absolute bottom-4 left-4 bg-transparent bg-opacity-75 text-white px-4 py-2 rounded-lg">
                            <div className="text-sm">
                                <div className="font-semibold">{currentDetection.original_filename}</div>
                                <div className="text-xs opacity-90">
                                    {new Date(currentDetection.created_at).toLocaleString()} •
                                    {currentDetection.total_defects} defects •
                                    {currentDetection.processing_time_ms}ms
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Auto Mode Indicator */}
                    {autoMode && (
                        <div className="absolute top-4 right-4 bg-green-600 text-white px-3 py-1 rounded-lg text-sm font-medium shadow-lg">
                            🔄 AUTO LIVE
                        </div>
                    )}

                    {/* Sync Indicator */}
                    {syncing && (
                        <div className="absolute top-4 left-4 bg-blue-600 text-white px-3 py-1 rounded-lg text-sm font-medium shadow-lg">
                            ⏳ SYNCING...
                        </div>
                    )}
                </div>
            </div>

            {/* Help Text - Only show when not fullscreen */}
            {!isFullscreen && (
                <div className="bg-slate-100 rounded-lg p-4 text-center">
                    <p className="text-sm text-slate-600">
                        {autoMode ? (
                            <>
                                <span className="font-medium">Auto Mode:</span> Latest images refresh automatically every 30 seconds •
                                Press <kbd className="bg-slate-200 px-1 rounded">F</kbd> for fullscreen •
                                <kbd className="bg-slate-200 px-1 rounded">Space</kbd> to sync
                            </>
                        ) : (
                            <>
                                <span className="font-medium">Manual Mode:</span> Use
                                <kbd className="bg-slate-200 px-1 rounded mx-1">←</kbd>
                                <kbd className="bg-slate-200 px-1 rounded mr-1">→</kbd> arrows to navigate •
                                <kbd className="bg-slate-200 px-1 rounded">Space</kbd> to sync •
                                <kbd className="bg-slate-200 px-1 rounded">F</kbd> for fullscreen
                            </>
                        )}
                    </p>
                </div>
            )}
        </div>
    );
}