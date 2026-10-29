import { useEffect, useState } from 'react';
export function ConnectionNotice() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const connected = () => setOnline(true),
      disconnected = () => setOnline(false);
    window.addEventListener('online', connected);
    window.addEventListener('offline', disconnected);
    return () => {
      window.removeEventListener('online', connected);
      window.removeEventListener('offline', disconnected);
    };
  }, []);
  return !online ? (
    <div className="connection-notice" role="status">
      You’re offline. You can inspect loaded traces; saving and AI requests need a connection.
    </div>
  ) : null;
}
