// file: src/components/common/LoadingSpinner.tsx

interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <div className="absolute inset-0 rounded-full h-12 w-12 border-2 border-slate-200"></div>
      </div>
      <p className="mt-4 text-slate-600 font-medium">{message}</p>
    </div>
  );
}