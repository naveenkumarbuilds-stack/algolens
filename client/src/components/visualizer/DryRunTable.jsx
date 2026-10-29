import { useState } from 'react';
import { filterSteps, pageSteps, variableChanges } from './traceRows';

export function DryRunTable({ steps, currentIndex, watched, onSeek, source }) {
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(0);
  const filtered = filterSteps(steps, { action, query, watched });
  const result = pageSteps(filtered, page);
  function showCurrent() {
    setQuery('');
    setAction('');
    setPage(Math.floor(currentIndex / 40));
  }
  return (
    <section className="dryrun-section" aria-label="Dry-run table">
      <div className="section-heading">
        <div>
          <span className="eyebrow">FOLLOW THE DECISIONS</span>
          <h2>Dry-run table{watched ? ` · ${watched}` : ''}</h2>
        </div>
        <button className="button secondary small" onClick={showCurrent}>
          Show current step
        </button>
      </div>
      <div className="dryrun-filters">
        <label>
          Search steps
          <input
            type="search"
            placeholder="Explanation, line, or value…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label>
          Action
          <select
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All actions</option>
            {[...new Set(steps.map((step) => step.type))].map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="table-help">
        {filtered.length} of {steps.length} steps · Select a step number to pause playback there.
        Highlighted variables changed from the preceding recorded step.
      </p>
      <div className="trace-table-wrap" tabIndex={0} aria-label="Scrollable dry-run table">
        <table className="trace-table detailed-trace">
          <caption>
            Values are recorded after the operation. A missing variable is “Not recorded”; it is
            never assumed unchanged.
          </caption>
          <thead>
            <tr>
              {['Step', 'Action', 'Executed line', 'Explanation', watched || 'Variables'].map(
                (heading) => (
                  <th scope="col" key={heading}>
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((step) => {
              const changes = variableChanges(step, steps[step.index - 1]);
              const entries = watched
                ? Object.hasOwn(step.variables, watched)
                  ? [[watched, step.variables[watched]]]
                  : []
                : Object.entries(step.variables);
              return (
                <tr key={step.index} className={step.index === currentIndex ? 'current-row' : ''}>
                  <td>
                    <button
                      onClick={() => onSeek(step.index)}
                      aria-label={`Go to step ${step.index + 1}`}
                      aria-current={step.index === currentIndex ? 'step' : undefined}
                    >
                      {step.index + 1}
                    </button>
                  </td>
                  <td>
                    <span className="action-badge">{step.type}</span>
                  </td>
                  <td>
                    {step.line === null ? (
                      'Summary'
                    ) : (
                      <>
                        <strong>Line {step.line}</strong>
                        <code className="executed-code">{source.split('\n')[step.line - 1]}</code>
                      </>
                    )}
                  </td>
                  <td>{step.explanation}</td>
                  <td>
                    {entries.length ? (
                      <dl className="trace-variables">
                        {entries.map(([name, value]) => (
                          <div
                            key={name}
                            className={changes.includes(name) ? 'variable-changed' : ''}
                          >
                            <dt>
                              {name}
                              {changes.includes(name) && (
                                <span className="change-label"> changed</span>
                              )}
                            </dt>
                            <dd>
                              <code>{JSON.stringify(value)}</code>
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <span className="quiet-label">
                        {watched ? 'Not recorded' : 'No variables recorded'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length && (
          <div className="library-empty">
            <h3>No matching steps</h3>
            <p>Try a different action or search term.</p>
            <button
              className="button secondary"
              onClick={() => {
                setAction('');
                setQuery('');
                setPage(0);
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
      <div className="table-pagination">
        <span aria-live="polite">
          Page {result.page + 1} of {result.pages}
        </span>
        <button
          className="button secondary small"
          disabled={result.page === 0}
          onClick={() => setPage(result.page - 1)}
        >
          Previous page
        </button>
        <button
          className="button secondary small"
          disabled={result.page === result.pages - 1}
          onClick={() => setPage(result.page + 1)}
        >
          Next page
        </button>
      </div>
    </section>
  );
}
