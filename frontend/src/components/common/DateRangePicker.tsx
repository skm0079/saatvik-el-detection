// File: src/components/common/DateRangePicker.tsx

import { useState, useRef, useEffect } from 'react';

interface DateRangePickerProps {
    dateFrom: string;
    dateTo: string;
    onDateFromChange: (date: string) => void;
    onDateToChange: (date: string) => void;
    onClearDates: () => void;
}

export function DateRangePicker({
    dateFrom,
    dateTo,
    onDateFromChange,
    onDateToChange,
    onClearDates
}: DateRangePickerProps) {
    const [isFromOpen, setIsFromOpen] = useState(false);
    const [isToOpen, setIsToOpen] = useState(false);
    const [isPresetOpen, setIsPresetOpen] = useState(false);
    const fromRef = useRef<HTMLDivElement>(null);
    const toRef = useRef<HTMLDivElement>(null);
    const presetRef = useRef<HTMLDivElement>(null);

    // Close dropdowns when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (fromRef.current && !fromRef.current.contains(event.target as Node)) {
                setIsFromOpen(false);
            }
            if (toRef.current && !toRef.current.contains(event.target as Node)) {
                setIsToOpen(false);
            }
            if (presetRef.current && !presetRef.current.contains(event.target as Node)) {
                setIsPresetOpen(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Quick date presets
    const getQuickDatePresets = () => {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        return [
            {
                label: 'Today',
                emoji: '📅',
                from: formatDateTimeLocal(today),
                to: formatDateTimeLocal(new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1))
            },
            {
                label: 'Yesterday',
                emoji: '📋',
                from: formatDateTimeLocal(new Date(today.getTime() - 24 * 60 * 60 * 1000)),
                to: formatDateTimeLocal(new Date(today.getTime() - 1))
            },
            {
                label: 'Last 7 days',
                emoji: '📊',
                from: formatDateTimeLocal(new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)),
                to: formatDateTimeLocal(new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1))
            },
            {
                label: 'Last 30 days',
                emoji: '📈',
                from: formatDateTimeLocal(new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)),
                to: formatDateTimeLocal(new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1))
            },
            {
                label: 'This month',
                emoji: '🗓️',
                from: formatDateTimeLocal(new Date(now.getFullYear(), now.getMonth(), 1)),
                to: formatDateTimeLocal(new Date(today.getTime() + 24 * 60 * 60 * 1000 - 1))
            },
            {
                label: 'Last month',
                emoji: '📆',
                from: formatDateTimeLocal(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
                to: formatDateTimeLocal(new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59))
            }
        ];
    };

    const formatDateTimeLocal = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const formatDisplayDate = (dateTimeLocal: string): string => {
        if (!dateTimeLocal) return '';
        const date = new Date(dateTimeLocal);
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const formatShortDate = (dateTimeLocal: string): string => {
        if (!dateTimeLocal) return '';
        const date = new Date(dateTimeLocal);
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short'
        });
    };

    const applyPreset = (preset: { from: string; to: string }) => {
        onDateFromChange(preset.from);
        onDateToChange(preset.to);
        setIsPresetOpen(false);
    };

    const quickPresets = getQuickDatePresets();

    // Check if current selection matches any preset
    const activePreset = quickPresets.find(preset =>
        preset.from === dateFrom && preset.to === dateTo
    );

    return (
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-xl border border-blue-200 p-5 shadow-sm">
            <div className="flex flex-col space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <span className="text-lg">🗓️</span>
                        <h3 className="text-sm font-semibold text-slate-700">Date Range Filter</h3>
                    </div>
                    {(dateFrom || dateTo) && (
                        <button
                            onClick={onClearDates}
                            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md flex items-center space-x-1"
                        >
                            <span>✕</span>
                            <span>Clear All</span>
                        </button>
                    )}
                </div>

                {/* Quick Presets Dropdown */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-1" ref={presetRef}>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            ⚡ Quick Select
                        </label>
                        <button
                            onClick={() => setIsPresetOpen(!isPresetOpen)}
                            className="w-full px-4 py-3 text-left bg-white border border-slate-300 rounded-lg shadow-sm hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        >
                            <div className="flex items-center justify-between">
                                <span className={activePreset ? 'text-slate-900 font-medium' : 'text-slate-500'}>
                                    {activePreset ? (
                                        <span className="flex items-center space-x-2">
                                            <span>{activePreset.emoji}</span>
                                            <span>{activePreset.label}</span>
                                        </span>
                                    ) : (
                                        'Choose a quick range...'
                                    )}
                                </span>
                                <svg className={`w-5 h-5 text-slate-400 transition-transform ${isPresetOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </div>
                        </button>

                        {isPresetOpen && (
                            <div className="absolute z-50 mt-2 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                                <div className="p-2">
                                    {quickPresets.map((preset, index) => (
                                        <button
                                            key={index}
                                            onClick={() => applyPreset(preset)}
                                            className={`w-full px-3 py-2.5 text-left rounded-lg transition-colors duration-150 flex items-center space-x-3 ${activePreset?.label === preset.label
                                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                                : 'hover:bg-slate-50 text-slate-700'
                                                }`}
                                        >
                                            <span className="text-lg">{preset.emoji}</span>
                                            <span className="font-medium">{preset.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Custom Date Inputs */}
                    <div className="flex flex-col sm:flex-row gap-3 flex-2">
                        {/* From Date */}
                        <div className="relative flex-1" ref={fromRef}>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                📅 From (IST)
                            </label>
                            <button
                                onClick={() => setIsFromOpen(!isFromOpen)}
                                className="w-full px-4 py-3 text-left bg-white border border-slate-300 rounded-lg shadow-sm hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <span className={dateFrom ? 'text-slate-900' : 'text-slate-500'}>
                                        {dateFrom ? formatDisplayDate(dateFrom) : 'Select start date...'}
                                    </span>
                                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${isFromOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </button>

                            {isFromOpen && (
                                <div className="absolute z-50 mt-2 w-full bg-white border border-slate-200 rounded-lg shadow-xl">
                                    <div className="p-4">
                                        <label className="block text-xs font-medium text-slate-600 mb-2">
                                            Select date and time (IST)
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={dateFrom}
                                            onChange={(e) => {
                                                onDateFromChange(e.target.value);
                                                setIsFromOpen(false);
                                            }}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                            title="Enter IST time - will be converted to UTC for database queries"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* To Date */}
                        <div className="relative flex-1" ref={toRef}>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                📅 To (IST)
                            </label>
                            <button
                                onClick={() => setIsToOpen(!isToOpen)}
                                className="w-full px-4 py-3 text-left bg-white border border-slate-300 rounded-lg shadow-sm hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <span className={dateTo ? 'text-slate-900' : 'text-slate-500'}>
                                        {dateTo ? formatDisplayDate(dateTo) : 'Select end date...'}
                                    </span>
                                    <svg className={`w-4 h-4 text-slate-400 transition-transform ${isToOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </button>

                            {isToOpen && (
                                <div className="absolute z-50 mt-2 w-full bg-white border border-slate-200 rounded-lg shadow-xl">
                                    <div className="p-4">
                                        <label className="block text-xs font-medium text-slate-600 mb-2">
                                            Select date and time (IST)
                                        </label>
                                        <input
                                            type="datetime-local"
                                            value={dateTo}
                                            onChange={(e) => {
                                                onDateToChange(e.target.value);
                                                setIsToOpen(false);
                                            }}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                                            title="Enter IST time - will be converted to UTC for database queries"
                                            min={dateFrom} // Prevent selecting end date before start date
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Active Range Display */}
                {(dateFrom || dateTo) && (
                    <div className="bg-white rounded-lg p-3 border border-blue-200">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium text-slate-700">📊 Active Range:</span>
                                <span className="text-sm text-blue-700 font-medium">
                                    {dateFrom ? formatShortDate(dateFrom) : '∞'} → {dateTo ? formatShortDate(dateTo) : '∞'}
                                </span>
                            </div>
                            <div className="flex items-center space-x-1 text-xs text-slate-500">
                                <span>🇮🇳</span>
                                <span>IST (UTC+5:30)</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}