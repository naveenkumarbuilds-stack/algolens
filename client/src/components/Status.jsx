export function Loading({ label = 'Checking your session…' }) {
  return (
    <div className="status-panel" role="status">
      <span className="spinner" aria-hidden="true" />
      {label}
    </div>
  );
}

export function ErrorNotice({ message, onRetry }) {
  return (
    <div className="error-notice" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button className="button secondary" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
