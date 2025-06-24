// file: src/components/LiveImageViewer.tsx

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecentDetections, useMachines } from '@/hooks/useApi';
import { ImageUtils } from '@/services/imageUtils';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { ROUTES, UI, MACHINE_FILTER } from '@/constants/config';
import type { DetectionRecord } from '@/types';
import { MachineSelector } from './common/MachineSelector';

export function LiveImageViewer() {
    const navigate = useNavigate();

    // All state hooks first - never conditional
    const [currentIndex, setCurrentIndex] = useState(0);
    const [autoMode, setAutoMode] = useState(true);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false); // Start in windowed mode for responsiveness
    const [syncing, setSyncing] = useState(false);
    const [selectedMachine, setSelectedMachine] = useState<string | null>(MACHINE_FILTER.CURRENT_MACHINE);

    // Data hook
    const { data, loading, error, refetch } = useRecentDetections(50, 0, { machine_id: selectedMachine ?? undefined });
    const { data: machines } = useMachines();

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

        if (detection.annotated_image_path) {
            const annotatedUrl = ImageUtils.getAnnotatedUrl(detection.annotated_image_path);
            return annotatedUrl;
        } else if (detection.thumbnail_path) {
            const thumbnailUrl = ImageUtils.getThumbnailUrl(detection.thumbnail_path);
            return thumbnailUrl;
        } else {
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
            <div className="flex flex-col items-center justify-center min-h-[70vh] p-4">
                <div className="text-6xl mb-4">📷</div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-700 mb-2 text-center">No Images Available</h2>
                <p className="text-slate-500 mb-6 text-center">Waiting for the first detection to arrive...</p>
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

    // Responsive classes
    const containerClass = isFullscreen
        ? "fixed inset-0 z-50 bg-black flex flex-col"
        : "w-full max-w-7xl mx-auto p-2 md:p-4 space-y-4";

    const headerClass = isFullscreen
        ? "absolute top-0 left-0 right-0 z-10 bg-black bg-opacity-50 backdrop-blur-sm"
        : "bg-white rounded-lg shadow-sm border border-slate-200 p-3 md:p-4";

    const imageContainerClass = isFullscreen
        ? "flex-1 flex items-center justify-center relative"
        : "bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden";

    return (
        <div className={containerClass}>
            {/* Responsive Header Controls */}
            <div className={headerClass}>
                {/* Top row - Title and main actions */}
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center space-y-3 lg:space-y-0">
                    <div className="flex-1">
                        <h1 className={`text-lg md:text-2xl font-bold ${isFullscreen ? 'text-white' : 'text-slate-900'}`}>
                            📺 Live Image Viewer
                        </h1>
                        <div className={`text-sm ${isFullscreen ? 'text-slate-300' : 'text-slate-600'} flex flex-wrap items-center gap-2 mt-1`}>
                            <span>Real-time display</span>
                            {machines && selectedMachine === MACHINE_FILTER.ALL_MACHINES ? (
                                <span className="text-purple-500 font-medium">🌐 All Machines</span>
                            ) : machines ? (
                                <span className="text-green-500 font-medium">🤖 {machines.current_machine}</span>
                            ) : null}
                        </div>
                    </div>

                    {/* Action buttons - responsive layout */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Machine Selector - Only show when not fullscreen */}
                        {!isFullscreen && (
                            <div className="w-full sm:w-auto">
                                <MachineSelector
                                    selectedMachine={selectedMachine}
                                    onMachineChange={setSelectedMachine}
                                    className="text-sm"
                                />
                            </div>
                        )}

                        {/* Mode Toggle */}
                        <button
                            onClick={() => setAutoMode(!autoMode)}
                            className={`px-3 py-1 rounded text-sm font-medium transition-all duration-200 ${autoMode
                                ? 'bg-green-600 text-white'
                                : `${isFullscreen ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`
                                }`}
                        >
                            {autoMode ? '🔄 AUTO' : '👆 MANUAL'}
                        </button>

                        {/* Navigation */}
                        <div className="flex items-center space-x-1">
                            <button
                                onClick={handlePrevious}
                                disabled={autoMode || currentIndex >= detections.length - 1}
                                className={`p-2 rounded transition-colors duration-200 ${autoMode || currentIndex >= detections.length - 1
                                    ? `${isFullscreen ? 'bg-slate-800 text-slate-600' : 'bg-slate-100 text-slate-400'} cursor-not-allowed`
                                    : `${isFullscreen ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-600 hover:bg-slate-700 text-white'}`
                                    }`}
                                title="Previous (←)"
                            >
                                ←
                            </button>

                            <span className={`text-xs px-2 ${isFullscreen ? 'text-slate-300' : 'text-slate-600'}`}>
                                {currentIndex + 1}/{detections.length}
                            </span>

                            <button
                                onClick={handleNext}
                                disabled={autoMode || currentIndex <= 0}
                                className={`p-2 rounded transition-colors duration-200 ${autoMode || currentIndex <= 0
                                    ? `${isFullscreen ? 'bg-slate-800 text-slate-600' : 'bg-slate-100 text-slate-400'} cursor-not-allowed`
                                    : `${isFullscreen ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-slate-600 hover:bg-slate-700 text-white'}`
                                    }`}
                                title="Next (→)"
                            >
                                →
                            </button>
                        </div>

                        {/* Sync & Fullscreen */}
                        <button
                            onClick={handleSync}
                            disabled={syncing}
                            className={`px-3 py-1 rounded text-sm font-medium transition-colors duration-200 ${syncing
                                ? 'bg-gray-500 cursor-not-allowed text-white'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                            title="Sync (Space)"
                        >
                            {syncing ? '⏳' : '🔄'}
                        </button>

                        <button
                            onClick={toggleFullscreen}
                            className={`px-3 py-1 rounded text-sm font-medium transition-all duration-200 ${isFullscreen
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                            title={isFullscreen ? "Exit Fullscreen (F/Esc)" : "Fullscreen (F)"}
                        >
                            {isFullscreen ? '🪟' : '⛶'}
                        </button>

                        {/* Dashboard Link - Only show when not fullscreen */}
                        {!isFullscreen && (
                            <button
                                onClick={() => navigate(ROUTES.DASHBOARD)}
                                className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors duration-200"
                            >
                                📊
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Image Display */}
            <div className={imageContainerClass}>
                <div className={`relative ${isFullscreen ? 'w-full h-full' : 'w-full aspect-video'} flex items-center justify-center ${isFullscreen ? 'bg-black' : 'bg-slate-50'}`}>

                    {/* MOVED: Image Info to TOP LEFT */}
                    {imageLoaded && (
                        <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white px-3 py-2 rounded-lg z-10">
                            <div className="text-sm">
                                <div className="font-semibold">{currentDetection.original_filename}</div>
                                <div className="text-xs opacity-90 mt-1">
                                    {new Date(currentDetection.created_at).toLocaleDateString()} {new Date(currentDetection.created_at).toLocaleTimeString()}
                                </div>
                                <div className="text-xs opacity-90">
                                    🔴 {currentDetection.total_defects} defects • {currentDetection.processing_time_ms}ms
                                    {selectedMachine === MACHINE_FILTER.ALL_MACHINES && (
                                        <span> • 🤖 {currentDetection.machine_name}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Loading State */}
                    {!imageLoaded && !imageError && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-8 w-8 md:h-12 md:w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                                <p className={`text-sm ${isFullscreen ? 'text-white' : 'text-slate-600'}`}>Loading image...</p>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {imageError && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-center p-4">
                                <div className="text-4xl md:text-6xl mb-4">❌</div>
                                <p className={`text-lg md:text-xl mb-2 ${isFullscreen ? 'text-white' : 'text-slate-700'}`}>Failed to load image</p>
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
                        alt={`${currentDetection.original_filename}`}
                        className={`max-w-full max-h-full object-contain transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'
                            }`}
                        onLoad={handleImageLoad}
                        onError={() => handleImageError(imageUrl)}
                        style={{
                            filter: imageLoaded ? 'none' : 'blur(10px)',
                        }}
                    />

                    {/* Auto Mode Indicator */}
                    {autoMode && (
                        <div className="absolute top-4 right-4 bg-green-600 text-white px-2 py-1 rounded text-xs font-medium shadow-lg">
                            🔄 LIVE
                        </div>
                    )}

                    {/* Sync Indicator */}
                    {syncing && (
                        <div className="absolute bottom-4 right-4 bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium shadow-lg">
                            ⏳ SYNCING...
                        </div>
                    )}
                </div>
            </div>

            {/* Quick actions bar - Only show when not fullscreen */}
            {!isFullscreen && (
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-2 sm:space-y-0">
                        <div className="flex items-center space-x-4 text-sm text-slate-600">
                            <div className="flex items-center space-x-2">
                                <div className={`w-2 h-2 rounded-full ${autoMode ? 'bg-green-400 animate-pulse' : 'bg-slate-400'}`}></div>
                                <span className="font-medium">
                                    {autoMode ? 'Auto Refresh ON' : 'Manual Mode'}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2">
                            <button
                                onClick={() => navigate(`${ROUTES.DETAIL}/${currentDetection.detection_id}`)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors duration-200"
                            >
                                📋 Details
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Help Text - Only show when not fullscreen */}
            {!isFullscreen && (
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <p className="text-xs md:text-sm text-slate-600">
                        {autoMode ? (
                            <>
                                <span className="font-medium">Auto Mode:</span> Refreshes every 30s •
                                Press <kbd className="bg-slate-200 px-1 rounded text-xs">F</kbd> for fullscreen •
                                <kbd className="bg-slate-200 px-1 rounded text-xs">Space</kbd> to sync
                            </>
                        ) : (
                            <>
                                <span className="font-medium">Manual Mode:</span> Use
                                <kbd className="bg-slate-200 px-1 rounded text-xs mx-1">←</kbd>
                                <kbd className="bg-slate-200 px-1 rounded text-xs mr-1">→</kbd> to navigate •
                                <kbd className="bg-slate-200 px-1 rounded text-xs">Space</kbd> to sync •
                                <kbd className="bg-slate-200 px-1 rounded text-xs">F</kbd> for fullscreen
                            </>
                        )}
                    </p>
                </div>
            )}
        </div>
    );
}