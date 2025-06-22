// file: src/components/common/ErrorMessage.tsx

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <div className="error-container">
      <p className="error-text">❌ {message}</p>
      {onRetry && (
        <button onClick={onRetry} className="retry-button">
          🔄 Retry
        </button>
      )}
    </div>
  );
}