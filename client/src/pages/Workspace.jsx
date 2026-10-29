import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useAuth } from '../auth/context';
import { api } from '../api/client';
import { ErrorNotice, Loading } from '../components/Status';

export function Workspace() {
  const { user } = useAuth();
  const [data, setData] = useState(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0);
  const [filters, setFilters] = useState({ q: '', status: '', tag: '' }),
    [page, setPage] = useState(1);
  const query = new URLSearchParams({
    page: String(page),
    limit: '10',
    ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
  }).toString();
  useEffect(() => {
    let active = true;
    Promise.all([api(`/problems?${query}`), api('/practice/summary')])
      .then(([problems, summary]) => {
        if (active) {
          setData({ problems, summary });
          setLoading(false);
          setError('');
        }
      })
      .catch((error) => {
        if (active) {
          setError(error.message);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [query, version]);
  function reload() {
    setLoading(true);
    setVersion((v) => v + 1);
  }
  function search(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setLoading(true);
    setFilters({
      q: String(form.get('q')).trim(),
      status: String(form.get('status')),
      tag: String(form.get('tag')).trim(),
    });
    setPage(1);
    setVersion((v) => v + 1);
  }
  const summary = data?.summary;
  return (
    <div className="page dashboard-page">
      <span className="eyebrow">YOUR PRACTICE, OVER TIME</span>
      <h1 className="page-title">Keep showing up, {user.name}.</h1>
      <p className="page-description">
        Save what matters. Revisit what’s tricky. Your practice dates follow {user.timeZone}.
      </p>
      {error && <ErrorNotice message={error} onRetry={reload} />}
      {summary && (
        <>
          <div className="dashboard-stats">
            {[
              [summary.currentStreak, 'Current streak · days'],
              [summary.longestStreak, 'Longest streak · days'],
              [summary.totalPractices, 'Practice completions'],
              [`${summary.solvedProblems}/${summary.totalProblems}`, 'Problems solved'],
            ].map(([value, label]) => (
              <article key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </article>
            ))}
          </div>
          <section className="activity-panel">
            <div className="section-heading">
              <div>
                <span className="eyebrow">A LITTLE EVERY DAY</span>
                <h2>Your last seven days</h2>
              </div>
              <span className="quiet-label">{summary.timeZone}</span>
            </div>
            <div
              className="activity-chart"
              role="img"
              aria-label={`Daily practice counts: ${summary.weeklyActivity.map((d) => `${d.date}: ${d.count}`).join(', ')}`}
            >
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={summary.weeklyActivity}
                  margin={{ top: 10, right: 12, left: -20, bottom: 0 }}
                >
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(day) => day.slice(5)}
                    tick={{ fill: 'var(--muted)', fontSize: 11 }}
                  />
                  <YAxis allowDecimals={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      color: 'var(--text)',
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    isAnimationActive={false}
                    dataKey="count"
                    name="Practices"
                    fill="#7b9d61"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={45}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="table-help">
              {summary.totalPractices
                ? 'Multiple completions on one day increase activity; they count as one streak day.'
                : 'Your first recorded practice will appear here. No activity has been recorded yet.'}
            </p>
            <details>
              <summary>View daily counts</summary>
              <ul className="daily-counts">
                {summary.weeklyActivity.map((day) => (
                  <li key={day.date}>
                    <span>{day.date}</span>
                    <strong>{day.count}</strong>
                  </li>
                ))}
              </ul>
            </details>
          </section>
        </>
      )}
      <section className="my-problems">
        <div className="section-heading">
          <div>
            <span className="eyebrow">YOUR PERSONAL LIBRARY</span>
            <h2>My Problems</h2>
          </div>
          <Link className="button primary small" to="/library">
            Explore algorithms →
          </Link>
        </div>
        <form className="dashboard-filters" onSubmit={search}>
          <label>
            Search title or notes
            <input name="q" type="search" maxLength={120} placeholder="Find a problem…" />
          </label>
          <label>
            Tag
            <input name="tag" maxLength={24} placeholder="arrays" />
          </label>
          <label>
            Status
            <select name="status">
              <option value="">All problems</option>
              <option value="revisit">Revisit</option>
              <option value="solved">Solved</option>
            </select>
          </label>
          <button className="button secondary" type="submit">
            Apply filters
          </button>
        </form>
        {loading ? (
          <Loading label="Loading your practice…" />
        ) : data?.problems.items.length ? (
          <>
            <p className="catalog-count">
              {data.problems.total} saved problems matching these filters
            </p>
            <div className="saved-list">
              {data.problems.items.map((problem) => (
                <ProblemCard
                  key={`${problem.id}:${problem.updatedAt}`}
                  problem={problem}
                  onChange={reload}
                />
              ))}
            </div>
            <div className="table-pagination">
              <span>
                Page {page} of {Math.max(1, Math.ceil(data.problems.total / 10))}
              </span>
              <button
                className="button secondary small"
                disabled={page === 1}
                onClick={() => {
                  setLoading(true);
                  setPage(page - 1);
                }}
              >
                Previous
              </button>
              <button
                className="button secondary small"
                disabled={page * 10 >= data.problems.total}
                onClick={() => {
                  setLoading(true);
                  setPage(page + 1);
                }}
              >
                Next
              </button>
            </div>
          </>
        ) : (
          !error && (
            <div className="library-empty">
              <h2>
                {data?.problems.total
                  ? 'No problems on this page.'
                  : 'A fresh page for your progress.'}
              </h2>
              <p>
                Run a library example or your own program, then use “Save to My Problems.” If you
                applied filters, try clearing them.
              </p>
              {page > 1 && (
                <button
                  className="button secondary"
                  onClick={() => {
                    setLoading(true);
                    setPage(1);
                  }}
                >
                  Go to first page
                </button>
              )}
              <Link className="button primary" to="/library">
                Find an algorithm
              </Link>
            </div>
          )
        )}
      </section>
    </div>
  );
}

function ProblemCard({ problem, onChange }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [deleting, setDeleting] = useState(false),
    [eventId, setEventId] = useState(() => crypto.randomUUID());
  async function mutate(method, body) {
    setBusy(true);
    setError('');
    try {
      await api(`/problems/${problem.id}`, { method, body });
      onChange();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function practice() {
    setBusy(true);
    setError('');
    try {
      await api('/practice', { method: 'POST', body: { eventId, savedProblemId: problem.id } });
      setEventId(crypto.randomUUID());
      onChange();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  function edit(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void mutate('PATCH', {
      title: String(form.get('title')),
      notes: String(form.get('notes')),
      tags: String(form.get('tags'))
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    });
  }
  return (
    <article className="saved-card">
      <div className="saved-card-header">
        <div>
          <span className="pill">
            {problem.mode === 'custom' ? problem.language : problem.algorithmId}
          </span>
          <h3>{problem.title}</h3>
        </div>
        <span className={`problem-status ${problem.status}`}>
          {problem.status === 'solved' ? 'Solved ✓' : 'Revisit'}
        </span>
      </div>
      <div className="problem-tags">
        {problem.tags.map((tag) => (
          <span key={tag}>#{tag}</span>
        ))}
      </div>
      {problem.notes && <p className="problem-notes">{problem.notes}</p>}
      <p className="problem-updated">Updated {new Date(problem.updatedAt).toLocaleDateString()}</p>
      <div className="saved-actions">
        <Link
          className="button primary small"
          to={problem.mode === 'custom' ? '/custom-code' : '/library'}
          state={{ problem }}
        >
          Open & rerun →
        </Link>
        <button
          className="button secondary small"
          disabled={busy}
          onClick={() =>
            void mutate('PATCH', { status: problem.status === 'solved' ? 'revisit' : 'solved' })
          }
        >
          {problem.status === 'solved' ? 'Mark for revisit' : 'Mark solved'}
        </button>
        <button className="button secondary small" disabled={busy} onClick={practice}>
          Record practice
        </button>
      </div>
      <details className="problem-editor">
        <summary>Edit title, tags & notes</summary>
        <form onSubmit={edit}>
          <label>
            Title
            <input name="title" required maxLength={120} defaultValue={problem.title} />
          </label>
          <label>
            Tags
            <input name="tags" maxLength={250} defaultValue={problem.tags.join(', ')} />
          </label>
          <label>
            Notes
            <textarea name="notes" rows={3} maxLength={5000} defaultValue={problem.notes} />
          </label>
          <button className="button secondary small" disabled={busy}>
            Save changes
          </button>
        </form>
      </details>
      {deleting ? (
        <div className="delete-confirm">
          <p>Delete this saved problem? Its practice history will remain.</p>
          <button
            className="button secondary small"
            disabled={busy}
            onClick={() => void mutate('DELETE')}
          >
            Delete permanently
          </button>
          <button className="button secondary small" onClick={() => setDeleting(false)}>
            Keep problem
          </button>
        </div>
      ) : (
        <button className="delete-problem" disabled={busy} onClick={() => setDeleting(true)}>
          Delete problem
        </button>
      )}
      {error && <ErrorNotice message={error} />}
    </article>
  );
}
