import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/context';
import { ErrorNotice } from './Status';

export function PracticeButton({ algorithmId, completed }) {
  const { user } = useAuth();
  const [eventId] = useState(() => crypto.randomUUID()),
    [recorded, setRecorded] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function record() {
    setBusy(true);
    setError('');
    try {
      await api('/practice', { method: 'POST', body: { eventId, algorithmId } });
      setRecorded(true);
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  if (!user)
    return (
      <p className="practice-complete">
        <Link to="/login">Sign in</Link> to record this completed practice.
      </p>
    );
  return (
    <div className="practice-complete">
      <button
        className="button secondary"
        disabled={busy || recorded || !completed}
        onClick={record}
      >
        {recorded ? 'Practice recorded ✓' : busy ? 'Recording…' : 'Record completed practice'}
      </button>
      <span role="status">
        {recorded
          ? ' View your streak in My workspace.'
          : !completed
            ? ' Reach the final step to record this run.'
            : ''}
      </span>
      {error && <ErrorNotice message={error} />}
    </div>
  );
}
