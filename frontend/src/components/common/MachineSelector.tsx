// file: src/components/common/MachineSelector.tsx

import { useState } from 'react';
import { useMachines } from '@/hooks/useApi';
import { MACHINE_FILTER } from '@/constants/config';

interface MachineSelectorProps {
    selectedMachine: string | null;
    onMachineChange: (machineId: string | null) => void;
    className?: string;
}

export function MachineSelector({
    selectedMachine,
    onMachineChange,
    className = ''
}: MachineSelectorProps) {
    const { data: machineInfo, loading } = useMachines();
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [pendingMachine, setPendingMachine] = useState<string | null>(null);

    if (loading || !machineInfo) {
        return (
            <div className={`flex items-center space-x-2 ${className}`}>
                <span className="text-sm text-slate-600">🤖</span>
                <div className="h-8 w-32 bg-slate-200 rounded animate-pulse"></div>
            </div>
        );
    }

    const handleMachineChange = (newMachine: string) => {
        // Convert string values to proper types
        const machineValue = newMachine === MACHINE_FILTER.ALL_MACHINES ? MACHINE_FILTER.ALL_MACHINES :
            newMachine === 'current' ? null : newMachine;

        // If switching to "All Machines", show confirmation
        if (machineValue === MACHINE_FILTER.ALL_MACHINES && selectedMachine !== MACHINE_FILTER.ALL_MACHINES) {
            setPendingMachine(machineValue);
            setShowConfirmDialog(true);
        } else {
            onMachineChange(machineValue);
        }
    };

    const confirmMachineChange = () => {
        onMachineChange(pendingMachine);
        setShowConfirmDialog(false);
        setPendingMachine(null);
    };

    const cancelMachineChange = () => {
        setShowConfirmDialog(false);
        setPendingMachine(null);
    };

    // Determine display value
    const getDisplayValue = () => {
        if (selectedMachine === MACHINE_FILTER.ALL_MACHINES) return MACHINE_FILTER.ALL_MACHINES;
        if (selectedMachine === null) return 'current';
        return selectedMachine;
    };

    // Determine display label
    const getDisplayLabel = () => {
        if (selectedMachine === MACHINE_FILTER.ALL_MACHINES) return 'All Machines';
        if (selectedMachine === null || selectedMachine === machineInfo.current_machine) {
            return `${machineInfo.current_machine} (Current)`;
        }
        return selectedMachine;
    };

    return (
        <>
            <div className={`flex items-center space-x-2 ${className}`}>
                <span className="text-sm font-medium text-slate-600">🤖 Machine:</span>
                <select
                    name={getDisplayLabel()}
                    value={getDisplayValue()}
                    onChange={(e) => handleMachineChange(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-2 text-sm font-medium bg-white hover:bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                >
                    {/* Current Machine (Default) */}
                    <option value="current">
                        {machineInfo.current_machine} (Current)
                    </option>

                    {/* Other Available Machines */}
                    {machineInfo.available_machines
                        .filter(machine => machine !== machineInfo.current_machine)
                        .map(machine => (
                            <option key={machine} value={machine}>
                                {machine}
                            </option>
                        ))}

                    {/* All Machines Option */}
                    <option value={MACHINE_FILTER.ALL_MACHINES}>
                        🌐 All Machines
                    </option>
                </select>

                {/* Current Selection Indicator */}
                <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${selectedMachine === MACHINE_FILTER.ALL_MACHINES ? 'bg-blue-500' : 'bg-green-500'
                        }`}></div>
                    <span className="text-xs text-slate-500">
                        {selectedMachine === MACHINE_FILTER.ALL_MACHINES ? 'Global View' : 'Single Machine'}
                    </span>
                </div>
            </div>

            {/* Confirmation Dialog */}
            {showConfirmDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-xl shadow-xl p-6 max-w-md mx-4">
                        <div className="text-center">
                            <div className="text-4xl mb-4">🌐</div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-2">
                                Switch to All Machines View?
                            </h3>
                            <p className="text-slate-600 mb-6">
                                This will show data from all machines in the current environment.
                                You can switch back to single machine view anytime.
                            </p>

                            <div className="flex justify-center space-x-4">
                                <button
                                    onClick={cancelMachineChange}
                                    className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmMachineChange}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                                >
                                    🌐 Show All Machines
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}