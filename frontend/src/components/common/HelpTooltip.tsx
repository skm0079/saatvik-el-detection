// File: frontend/src/components/common/HelpTooltip.tsx
import { useState, useRef, useEffect } from 'react';

interface HelpTooltipProps {
    content: string;
    title?: string;
    placement?: 'top' | 'bottom' | 'left' | 'right';
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

export function HelpTooltip({
    content,
    title,
    placement = 'top',
    className = '',
    size = 'md'
}: HelpTooltipProps) {
    const [show, setShow] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [actualPlacement, setActualPlacement] = useState(placement);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (show && buttonRef.current && tooltipRef.current) {
            const buttonRect = buttonRef.current.getBoundingClientRect();
            const tooltipRect = tooltipRef.current.getBoundingClientRect();
            const viewport = {
                width: window.innerWidth,
                height: window.innerHeight
            };

            let top = 0;
            let left = 0;
            let finalPlacement = placement;

            // Calculate initial position based on preferred placement
            switch (placement) {
                case 'top':
                    top = buttonRect.top - tooltipRect.height - 8;
                    left = buttonRect.left + (buttonRect.width / 2) - (tooltipRect.width / 2);
                    break;
                case 'bottom':
                    top = buttonRect.bottom + 8;
                    left = buttonRect.left + (buttonRect.width / 2) - (tooltipRect.width / 2);
                    break;
                case 'left':
                    top = buttonRect.top + (buttonRect.height / 2) - (tooltipRect.height / 2);
                    left = buttonRect.left - tooltipRect.width - 8;
                    break;
                case 'right':
                    top = buttonRect.top + (buttonRect.height / 2) - (tooltipRect.height / 2);
                    left = buttonRect.right + 8;
                    break;
            }

            // Check boundaries and adjust placement if needed
            const padding = 8;

            // If tooltip goes outside viewport, try alternative placements
            if (top < padding && placement === 'top') {
                // Switch to bottom
                top = buttonRect.bottom + 8;
                finalPlacement = 'bottom';
            } else if (top + tooltipRect.height > viewport.height - padding && placement === 'bottom') {
                // Switch to top
                top = buttonRect.top - tooltipRect.height - 8;
                finalPlacement = 'top';
            }

            if (left < padding && placement === 'left') {
                // Switch to right
                left = buttonRect.right + 8;
                top = buttonRect.top + (buttonRect.height / 2) - (tooltipRect.height / 2);
                finalPlacement = 'right';
            } else if (left + tooltipRect.width > viewport.width - padding && placement === 'right') {
                // Switch to left
                left = buttonRect.left - tooltipRect.width - 8;
                top = buttonRect.top + (buttonRect.height / 2) - (tooltipRect.height / 2);
                finalPlacement = 'left';
            }

            // Final boundary checks
            if (left < padding) left = padding;
            if (left + tooltipRect.width > viewport.width - padding) {
                left = viewport.width - tooltipRect.width - padding;
            }
            if (top < padding) top = padding;
            if (top + tooltipRect.height > viewport.height - padding) {
                top = viewport.height - tooltipRect.height - padding;
            }

            setPosition({ top, left });
            setActualPlacement(finalPlacement);
        }
    }, [show, placement]);

    const sizeClasses = {
        sm: 'w-4 h-4 text-xs',
        md: 'w-5 h-5 text-sm',
        lg: 'w-6 h-6 text-base'
    };

    const tooltipSizeClasses = {
        sm: 'max-w-xs text-xs',
        md: 'max-w-sm text-sm',
        lg: 'max-w-md text-base'
    };

    return (
        <>
            <button
                ref={buttonRef}
                onMouseEnter={() => setShow(true)}
                onMouseLeave={() => setShow(false)}
                onFocus={() => setShow(true)}
                onBlur={() => setShow(false)}
                className={`inline-flex items-center justify-center ${sizeClasses[size]} text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-full transition-all duration-200 ${className}`}
                type="button"
                aria-label="Help information"
                tabIndex={0}
            >
                <span className="font-medium">ℹ️</span>
            </button>

            {show && (
                <div
                    ref={tooltipRef}
                    className={`fixed z-50 bg-slate-900 text-white p-3 rounded-lg shadow-xl border border-slate-700 ${tooltipSizeClasses[size]}`}
                    style={{ top: position.top, left: position.left }}
                    role="tooltip"
                >
                    {title && (
                        <div className="font-semibold mb-2 text-blue-300 border-b border-slate-600 pb-1">
                            {title}
                        </div>
                    )}
                    <div className="leading-relaxed">
                        {content}
                    </div>

                    {/* Arrow indicator */}
                    <div className={`absolute w-2 h-2 bg-slate-900 transform rotate-45 ${actualPlacement === 'top' ? 'bottom-[-4px] left-1/2 -translate-x-1/2' :
                        actualPlacement === 'bottom' ? 'top-[-4px] left-1/2 -translate-x-1/2' :
                            actualPlacement === 'left' ? 'right-[-4px] top-1/2 -translate-y-1/2' :
                                'left-[-4px] top-1/2 -translate-y-1/2'
                        }`} />
                </div>
            )}
        </>
    );
}

// Preset help tooltips for common use cases
export const HelpTooltips = {
    GridCell: (props: Partial<HelpTooltipProps>) => (
        <HelpTooltip
            title="Grid Cell Search"
            content="Search for defects in specific solar panel grid cells. Enter cell coordinates like A15, C22, or B30. The grid has 6 rows (A-F) and 24 columns (1-24). This will show only images that have defects in the specified cell."
            {...props}
        />
    ),

    MachineSelector: (props: Partial<HelpTooltipProps>) => (
        <HelpTooltip
            title="Machine Selection"
            content="Choose which machine's data to view. 'Current Machine' shows only the active machine's detections. 'All Machines' shows data from all machines in the current environment for comparison."
            {...props}
        />
    ),

    DateFilter: (props: Partial<HelpTooltipProps>) => (
        <HelpTooltip
            title="Date Filtering"
            content="Filter detections by date and time. All times are in IST (Indian Standard Time). Use quick presets like 'Today' or 'Last 7 days', or select custom date ranges. The system automatically converts to UTC for database queries."
            {...props}
        />
    ),

    FilenameSearch: (props: Partial<HelpTooltipProps>) => (
        <HelpTooltip
            title="Filename Search"
            content="Search for specific image files by typing part of the filename. Requires at least 3 characters. Search is case-insensitive and matches partial filenames. Use this to find specific solar panel images you processed earlier."
            {...props}
        />
    ),

    ConfidenceThreshold: (props: Partial<HelpTooltipProps>) => (
        <HelpTooltip
            title="Confidence Threshold"
            content="AI confidence level for defect detection. Higher values (closer to 100%) mean the AI is more certain about defects but might miss some. Lower values detect more potential defects but may include false positives."
            {...props}
        />
    ),

    ProcessingTime: (props: Partial<HelpTooltipProps>) => (
        <HelpTooltip
            title="Processing Time"
            content="Time taken by the AI to analyze the image and detect defects. Measured in milliseconds (ms). Typical processing times are 500-3000ms depending on image size and complexity."
            {...props}
        />
    ),

    GridAnalysis: (props: Partial<HelpTooltipProps>) => (
        <HelpTooltip
            title="Grid Analysis"
            content="Solar panel images are divided into a 6×24 grid (144 cells total). Each cell is labeled with a row letter (A-F) and column number (1-24). This helps identify exactly where defects are located on the panel."
            {...props}
        />
    ),

    ExportData: (props: Partial<HelpTooltipProps>) => (
        <HelpTooltip
            title="Export Options"
            content="Download detection data in Excel format. PDF exports include detailed reports with grid visualization. Excel exports include all detection data with grid cell information and can be filtered by date range and machine."
            {...props}
        />
    ),

    LiveMode: (props: Partial<HelpTooltipProps>) => (
        <HelpTooltip
            title="Live View Mode"
            content="AUTO mode automatically refreshes every 30 seconds to show the latest processed images. MANUAL mode lets you navigate through images manually using arrow keys or buttons. Press Space to sync manually."
            {...props}
        />
    ),

    ImageViewer: (props: Partial<HelpTooltipProps>) => (
        <HelpTooltip
            title="Image Viewer Controls"
            content="Use mouse wheel or +/- keys to zoom. Drag to pan when zoomed in. Press Space or Tab to toggle between original and annotated images. Press F for fullscreen, Esc to close. All keyboard shortcuts work in fullscreen mode."
            {...props}
        />
    )
};