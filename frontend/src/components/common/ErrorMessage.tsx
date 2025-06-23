// file: src/components/common/ErrorMessage.tsx

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <div className="text-4xl mb-4">❌</div>
      <h3 className="text-lg font-semibold text-red-800 mb-2">Something went wrong</h3>
      <p className="text-red-700 mb-4">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200"
        >
          🔄 Retry
        </button>
      )}
    </div>
  );
}