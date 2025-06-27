// File: src/components/DetectionDetail.tsx
// COMPLETE: Enhanced Detection Detail with Full Grid Analysis

import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDetectionDetail, useImageAnalysis, useExport } from '@/hooks/useApi';
import { ImageUtils } from '@/services/imageUtils';
import { TimeUtils } from '@/utils/timeUtils';
import { ImageViewer } from '@/components/common/ImageViewer';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { ROUTES, GRID_CONFIG, GRID_COLORS } from '@/constants/config';

export function DetectionDetail() {
  const { detection_id } = useParams<{ detection_id: string }>();
  const navigate = useNavigate();
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [currentImage, setCurrentImage] = useState<'original' | 'annotated'>('annotated');
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // API hooks
  const { data: detection, loading, error, refetch } = useDetectionDetail(detection_id!);
  const { data: imageAnalysis, loading: analysisLoading } = useImageAnalysis(detection_id!);
  const { exportPDF, exportExcel, isExporting, error: exportHookError } = useExport();

  // Processed grid data
  const gridData = useMemo(() => {
    if (!detection?.affected_cells && !imageAnalysis?.defect_analysis.defects_by_cell) {
      return null;
    }

    const cellData: Record<string, { defects: number; types: string[]; maxConfidence: number }> = {};

    // From detection data
    if (detection?.grid_statistics?.defects_per_cell) {
      Object.entries(detection.grid_statistics.defects_per_cell).forEach(([cell, count]) => {
        cellData[cell] = { defects: count as number, types: [], maxConfidence: 0 };
      });
    }

    // Enhanced from image analysis
    if (imageAnalysis?.defect_analysis.defects_by_cell) {
      Object.entries(imageAnalysis.defect_analysis.defects_by_cell).forEach(([cell, defects]) => {
        if (!cellData[cell]) {
          cellData[cell] = { defects: 0, types: [], maxConfidence: 0 };
        }

        defects.forEach(defect => {
          cellData[cell].defects++;
          if (!cellData[cell].types.includes(defect.type)) {
            cellData[cell].types.push(defect.type);
          }
          if (defect.confidence > cellData[cell].maxConfidence) {
            cellData[cell].maxConfidence = defect.confidence;
          }
        });
      });
    }

    return cellData;
  }, [detection, imageAnalysis]);

  // Export handlers with success/error feedback
  const handleExportPDF = useCallback(async () => {
    if (!detection_id) return;
    try {
      setExportError(null);
      await exportPDF(detection_id);
      setShowExportSuccess(true);
      setTimeout(() => setShowExportSuccess(false), 3000);
    } catch (error) {
      setExportError('PDF export failed. Please try again.');
      console.error('PDF export failed:', error);
    }
  }, [detection_id, exportPDF]);

  const handleExportExcel = useCallback(async () => {
    if (!detection_id) return;
    try {
      setExportError(null);
      await exportExcel(detection_id);
      setShowExportSuccess(true);
      setTimeout(() => setShowExportSuccess(false), 3000);
    } catch (error) {
      setExportError('Excel export failed. Please try again.');
      console.error('Excel export failed:', error);
    }
  }, [detection_id, exportExcel]);

  // Grid cell color calculation
  const getCellColor = useCallback((cell: string) => {
    if (!gridData || !gridData[cell]) return GRID_COLORS.NO_DEFECTS;

    const defectCount = gridData[cell].defects;
    if (defectCount >= 5) return GRID_COLORS.VERY_HIGH_DEFECTS;
    if (defectCount >= 3) return GRID_COLORS.HIGH_DEFECTS;
    if (defectCount >= 2) return GRID_COLORS.MEDIUM_DEFECTS;
    if (defectCount >= 1) return GRID_COLORS.LOW_DEFECTS;
    return GRID_COLORS.NO_DEFECTS;
  }, [gridData]);

  // Generate grid cells
  const generateGridCells = useCallback(() => {
    const cells = [];
    const rows = detection?.grid_config?.num_rows || GRID_CONFIG.DEFAULT_ROWS;
    const cols = detection?.grid_config?.num_cols || GRID_CONFIG.DEFAULT_COLS;
    const labels = detection?.grid_config?.row_labels || GRID_CONFIG.DEFAULT_LABELS;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const cellLabel = `${labels[row]}${col + 1}`;
        const hasDefects = gridData && gridData[cellLabel];
        const defectCount = hasDefects ? gridData[cellLabel].defects : 0;

        cells.push({
          label: cellLabel,
          row,
          col,
          defects: defectCount,
          color: getCellColor(cellLabel),
          isSelected: selectedCell === cellLabel,
          hasDefects: !!hasDefects
        });
      }
    }
    return cells;
  }, [detection, gridData, getCellColor, selectedCell]);

  if (loading) return <LoadingSpinner message="Loading detection details..." />;
  if (error) return <ErrorMessage message={error} onRetry={refetch} />;
  if (!detection) return <ErrorMessage message="Detection not found" />;

  // Safe URL construction
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

  const gridCells = generateGridCells();

  return (
    <div className="space-y-8">
      {/* Export Success/Error Notifications */}
      {showExportSuccess && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-40 flex items-center space-x-2">
          <span>✅</span>
          <span>Export completed successfully!</span>
        </div>
      )}

      {(exportError || exportHookError) && (
        <div className="fixed top-4 right-4 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg z-40 flex items-center space-x-3">
          <span>❌</span>
          <span>{exportError || exportHookError}</span>
          <button
            onClick={() => { setExportError(null) }}
            className="text-white hover:text-red-200"
          >
            ✕
          </button>
        </div>
      )}

      {/* Enhanced Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(ROUTES.HISTORY)}
            className="bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
          >
            ← Back to History
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">📋 Detection Analysis</h1>
            <p className="text-slate-600 mt-1">
              Detailed analysis for <strong className="text-lg">{detection.original_filename}</strong>
            </p>
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 shadow-md hover:shadow-lg flex items-center space-x-2"
          >
            {isExporting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <span>📄</span>
                <span>Export PDF</span>
              </>
            )}
          </button>

          <button
            onClick={handleExportExcel}
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
              <p className="text-sm font-medium text-slate-600 mb-1">📄 Original Filename</p>
              <p className="font-semibold text-slate-900 break-words text-lg">{detection.original_filename}</p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm font-medium text-slate-600 mb-1">🔴 Total Defects</p>
              <p className="text-2xl font-bold text-red-600">{detection.total_defects}</p>
              {detection.affected_cells && (
                <p className="text-xs text-slate-500 mt-1">
                  across {detection.affected_cells.length} cells
                </p>
              )}
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm font-medium text-slate-600 mb-1">⏱️ Processing Time</p>
              <p className="font-semibold text-slate-900">{detection.processing_time_ms}ms</p>
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
              <p className="text-sm font-medium text-slate-600 mb-1">🤖 Machine</p>
              <p className="font-semibold text-slate-900">{detection.machine_name}</p>
              <p className="text-xs text-slate-500 mt-1">ID: {detection.machine_id}</p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm font-medium text-slate-600 mb-1">📅 Processed At (IST)</p>
              <p className="font-semibold text-slate-900 text-sm">{TimeUtils.toIST(detection.created_at)}</p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm font-medium text-slate-600 mb-1">🎯 Confidence</p>
              <p className="font-semibold text-slate-900">{(detection.confidence_threshold * 100).toFixed(1)}%</p>
            </div>
          </div>

          {/* Historical Paths Section */}
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
                <span className="font-medium">📍 Context:</span> These paths were active when this detection was processed.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* COMPLETE Grid Analysis Section */}
      {(detection.affected_cells?.length || gridData) ? (
        <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-green-50 border-b border-green-200">
            <h2 className="text-lg font-semibold text-slate-900">📐 Interactive Grid Analysis</h2>
            <p className="text-sm text-slate-600 mt-1">Click on grid cells to see detailed defect information</p>
          </div>

          <div className="p-6">
            <div className="space-y-6">
              {/* Grid Summary */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-600 mb-1">📐 Grid Configuration</p>
                  <p className="font-semibold text-slate-900">
                    {detection.grid_config?.num_rows || 6} × {detection.grid_config?.num_cols || 24}
                  </p>
                  <p className="text-xs text-slate-500">Solar panel grid layout</p>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-600 mb-1">🔴 Affected Cells</p>
                  <p className="font-semibold text-slate-900">
                    {detection.cells_with_defects || detection.affected_cells?.length || 0}
                  </p>
                  <p className="text-xs text-slate-500">Cells with defects</p>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-600 mb-1">📊 Coverage</p>
                  <p className="font-semibold text-slate-900">
                    {(((detection.cells_with_defects || detection.affected_cells?.length || 0) / GRID_CONFIG.TOTAL_CELLS) * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-slate-500">Grid cells affected</p>
                </div>

                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm font-medium text-green-600 mb-1">🎯 Max Defects/Cell</p>
                  <p className="font-semibold text-slate-900">
                    {gridData ? Math.max(...Object.values(gridData).map(d => d.defects)) : 0}
                  </p>
                  <p className="text-xs text-slate-500">Highest defect count</p>
                </div>
              </div>

              {/* Interactive Grid Visualization */}
              <div>
                <h3 className="text-md font-semibold text-slate-800 mb-3 flex items-center">
                  🗺️ Interactive Grid Map
                  <span className="ml-2 text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                    Click cells for details
                  </span>
                </h3>

                <div className="grid gap-1 p-4 bg-slate-50 rounded-lg overflow-x-auto"
                  style={{ gridTemplateColumns: `repeat(${detection.grid_config?.num_cols || 24}, minmax(0, 1fr))` }}>
                  {gridCells.map((cell) => (
                    <div
                      key={cell.label}
                      className={`
                        aspect-square min-w-[24px] min-h-[24px] flex items-center justify-center text-xs font-medium 
                        cursor-pointer transition-all duration-200 rounded border
                        ${cell.isSelected ? 'ring-2 ring-blue-500 scale-110 z-10' : ''}
                        ${cell.hasDefects ? 'hover:scale-105 shadow-sm' : 'hover:bg-slate-200'}
                      `}
                      style={{
                        backgroundColor: cell.color,
                        color: cell.hasDefects ? '#1f2937' : '#6b7280'
                      }}
                      onClick={() => setSelectedCell(cell.isSelected ? null : cell.label)}
                      title={`${cell.label}: ${cell.defects} defects`}
                    >
                      {cell.defects > 0 ? cell.defects : ''}
                    </div>
                  ))}
                </div>

                {/* Grid Legend */}
                <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                  <span className="font-medium text-slate-700">Legend:</span>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: GRID_COLORS.NO_DEFECTS }}></div>
                    <span>No defects</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: GRID_COLORS.LOW_DEFECTS }}></div>
                    <span>1 defect</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: GRID_COLORS.MEDIUM_DEFECTS }}></div>
                    <span>2 defects</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: GRID_COLORS.HIGH_DEFECTS }}></div>
                    <span>3-4 defects</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: GRID_COLORS.VERY_HIGH_DEFECTS }}></div>
                    <span>5+ defects</span>
                  </div>
                </div>
              </div>

              {/* Selected Cell Details */}
              {selectedCell && gridData && gridData[selectedCell] && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="text-md font-semibold text-blue-800 mb-3">
                    📍 Cell {selectedCell} Details
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <span className="text-sm font-medium text-blue-700">Total Defects:</span>
                      <p className="text-lg font-bold text-slate-900">{gridData[selectedCell].defects}</p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-blue-700">Defect Types:</span>
                      <p className="text-sm text-slate-900">
                        {gridData[selectedCell].types.length > 0
                          ? gridData[selectedCell].types.join(', ')
                          : 'No specific types'
                        }
                      </p>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-blue-700">Max Confidence:</span>
                      <p className="text-sm text-slate-900">
                        {(gridData[selectedCell].maxConfidence * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Most Affected Cells */}
              {detection.grid_statistics?.most_affected_cells && (
                <div>
                  <h3 className="text-md font-semibold text-slate-800 mb-3">🔥 Most Affected Cells</h3>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    {detection.grid_statistics.most_affected_cells.slice(0, 12).map(([cell, count]) => (
                      <div
                        key={cell}
                        className={`
                          bg-slate-50 rounded-lg p-3 text-center cursor-pointer transition-all duration-200
                          ${selectedCell === cell ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-slate-100'}
                        `}
                        onClick={() => setSelectedCell(selectedCell === cell ? null : cell)}
                      >
                        <div className="text-lg font-bold text-slate-900">{cell}</div>
                        <div className="text-sm text-slate-600">{count} defects</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md border border-slate-200 p-8 text-center">
          <div className="text-4xl mb-4">📐</div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No Grid Data Available</h3>
          <p className="text-slate-500">This detection was processed without grid analysis.</p>
        </div>
      )}

      {/* Detailed Defect Analysis */}
      {imageAnalysis && imageAnalysis.defect_analysis.defect_coordinates.length > 0 && (
        <div className="bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 bg-red-50 border-b border-red-200">
            <h2 className="text-lg font-semibold text-slate-900">🔍 Detailed Defect Analysis</h2>
            <p className="text-sm text-slate-600 mt-1">Individual defect locations and properties</p>
          </div>

          <div className="p-6">
            {analysisLoading ? (
              <LoadingSpinner message="Loading detailed analysis..." size="sm" />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full table-auto">
                  <thead>
                    <tr className="bg-slate-50">
                      <th className="px-4 py-2 text-left text-sm font-medium text-slate-600">#</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-slate-600">Grid Cell</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-slate-600">Defect Type</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-slate-600">Confidence</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-slate-600">Center X</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-slate-600">Center Y</th>
                    </tr>
                  </thead>
                  <tbody>
                    {imageAnalysis.defect_analysis.defect_coordinates.map((defect, index) => (
                      <tr
                        key={index}
                        className={`
                          border-t border-slate-200 cursor-pointer hover:bg-slate-50 transition-colors
                          ${selectedCell === defect.grid_cell ? 'bg-blue-50' : ''}
                        `}
                        onClick={() => setSelectedCell(selectedCell === defect.grid_cell ? null : defect.grid_cell)}
                      >
                        <td className="px-4 py-2 text-sm text-slate-900">{index + 1}</td>
                        <td className="px-4 py-2 text-sm font-medium text-blue-600">{defect.grid_cell}</td>
                        <td className="px-4 py-2 text-sm text-slate-900 capitalize">{defect.defect_type}</td>
                        <td className="px-4 py-2 text-sm text-slate-900">{(defect.confidence * 100).toFixed(1)}%</td>
                        <td className="px-4 py-2 text-sm text-slate-600">{Math.round(defect.center_x)}</td>
                        <td className="px-4 py-2 text-sm text-slate-600">{Math.round(defect.center_y)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

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
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjFmNWY5Ii8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzY0NzQ4YiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk9yaWdpbmFsIEltYWdlIE5vdCBGb3VuZDwvdGV4dD48L3N2Zz4=';
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
                  e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjFmNWY5Ci8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzY0NzQ4YiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkFubm90YXRlZCBJbWFnZSBOb3QgRm91bmQ8L3RleHQ+PC9zdmc+';
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
      <div className="flex flex-wrap justify-center gap-4">
        <button
          onClick={() => openFullscreen('original')}
          className="bg-slate-600 hover:bg-slate-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
        >
          <span>🖼️</span>
          <span>View Original</span>
        </button>

        <button
          onClick={() => openFullscreen('annotated')}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
        >
          <span>🎯</span>
          <span>View Defects</span>
        </button>

        <button
          onClick={handleExportPDF}
          disabled={isExporting}
          className="bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
        >
          {isExporting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>Exporting...</span>
            </>
          ) : (
            <>
              <span>📄</span>
              <span>Export PDF</span>
            </>
          )}
        </button>

        <button
          onClick={handleExportExcel}
          disabled={isExporting}
          className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
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
          onClick={() => navigate(ROUTES.HISTORY)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 flex items-center space-x-2"
        >
          <span>📋</span>
          <span>Back to History</span>
        </button>
      </div>

      {/* Performance Insights */}
      {detection.total_defects > 0 && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl border border-yellow-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
            💡 Analysis Insights
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <p className="font-medium text-slate-800">Defect Distribution:</p>
              <ul className="space-y-1 text-slate-600">
                <li>• Total defects found: <strong>{detection.total_defects}</strong></li>
                <li>• Processing time: <strong>{detection.processing_time_ms}ms</strong></li>
                <li>• Detection confidence: <strong>{(detection.confidence_threshold * 100).toFixed(1)}%</strong></li>
                {detection.affected_cells && (
                  <li>• Grid cells affected: <strong>{detection.affected_cells.length}</strong></li>
                )}
              </ul>
            </div>

            <div className="space-y-2">
              <p className="font-medium text-slate-800">Recommendations:</p>
              <ul className="space-y-1 text-slate-600">
                {detection.total_defects > 5 ? (
                  <li>• High defect count detected - consider panel inspection</li>
                ) : detection.total_defects > 0 ? (
                  <li>• Moderate defect count - monitor for trends</li>
                ) : (
                  <li>• No defects detected - panel in good condition</li>
                )}

                {detection.affected_cells && detection.affected_cells.length > 10 && (
                  <li>• Multiple cells affected - check for systematic issues</li>
                )}

                <li>• Export data for maintenance records</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* File Information */}
      <div className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">📁 File Information</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div>
            <p className="font-medium text-slate-800 mb-2">Available Files:</p>
            <div className="space-y-2">
              {detection.annotated_image_path && (
                <div className="flex items-center space-x-2">
                  <span>🎯</span>
                  <span>Annotated Image</span>
                  <button
                    onClick={() => window.open(annotatedUrl, '_blank')}
                    className="text-blue-600 hover:text-blue-800 text-xs"
                  >
                    [Open]
                  </button>
                </div>
              )}

              {detection.thumbnail_path && (
                <div className="flex items-center space-x-2">
                  <span>🖼️</span>
                  <span>Thumbnail</span>
                  <button
                    onClick={() => window.open(ImageUtils.getThumbnailUrl(detection.thumbnail_path), '_blank')}
                    className="text-blue-600 hover:text-blue-800 text-xs"
                  >
                    [Open]
                  </button>
                </div>
              )}

              {detection.grid_report_path && (
                <div className="flex items-center space-x-2">
                  <span>📊</span>
                  <span>Grid Report</span>
                  <button
                    onClick={() => window.open(`/processed/${detection.grid_report_path}`, '_blank')}
                    className="text-blue-600 hover:text-blue-800 text-xs"
                  >
                    [Download]
                  </button>
                </div>
              )}
            </div>
          </div>

          <div>
            <p className="font-medium text-slate-800 mb-2">Detection Details:</p>
            <div className="space-y-1 text-slate-600">
              <p>Detection ID: <span className="font-mono text-xs">{detection.detection_id}</span></p>
              <p>Folder: <span className="break-all">{detection.el_folder_path}</span></p>
              <p>Status: <span className="capitalize">{detection.status}</span></p>
              <p>Created: {TimeUtils.toIST(detection.created_at)}</p>
            </div>
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