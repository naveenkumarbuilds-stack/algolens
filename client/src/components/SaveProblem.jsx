import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { api } from '../api/client';
import { ErrorNotice } from './Status';

export function SaveProblem({ problem, defaultTitle }) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(null);
  async function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError('');
    try {
      const response = await api('/problems', {
        method: 'POST',
        body: {
          ...problem,
          title: data.get('title'),
          notes: data.get('notes'),
          tags: String(data.get('tags'))
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          status: data.get('status'),
        },
      });
      setSaved(response.problem);
    } catch (error) {
      setError(
        error.details?.length
          ? error.details.map((item) => `${item.path}: ${item.message}`).join(' · ')
          : error.message,
      );
    } finally {
      setBusy(false);
    }
  }
  if (!user)
    return (
      <div className="save-problem">
        <h3>Keep this explanation.</h3>
        <p>
          <Link to="/login">Sign in</Link> to save this problem, add notes and build your practice
          history.
        </p>
      </div>
    );
  if (saved)
    return (
      <div className="save-problem" role="status">
        <h3>Saved: {saved.title}</h3>
        <p>
          Find it in <Link to="/dashboard">My workspace</Link>.{' '}
          {saved.status === 'solved'
            ? 'One practice completion was recorded.'
            : 'Marked for review.'}
        </p>
      </div>
    );
  return (
    <details className="save-problem">
      <summary>Save to My Problems</summary>
      <form onSubmit={submit}>
        <div className="save-fields">
          <label>
            Problem title
            <input name="title" required maxLength={120} defaultValue={defaultTitle} />
          </label>
          <label>
            Tags (comma separated)
            <input name="tags" placeholder="arrays, interview" maxLength={250} />
          </label>
          <label>
            Status
            <select name="status">
              <option value="revisit">Revisit</option>
              <option value="solved">Solved · record practice</option>
            </select>
          </label>
        </div>
        <label>
          Notes
          <textarea name="notes" rows={3} maxLength={5000} placeholder="What did you learn?" />
        </label>
        <button className="button primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save problem'}
        </button>
        {error && <ErrorNotice message={error} />}
      </form>
    </details>
  );
}
