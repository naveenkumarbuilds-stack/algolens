import { useLocation } from 'react-router-dom';
import { useState } from 'react';
import { algorithms, generateTrace } from '../algorithms/registry';
import { ErrorNotice } from '../components/Status';
import { SaveProblem } from '../components/SaveProblem';
import { AlgorithmCatalog } from '../components/AlgorithmCatalog';
import { ComplexityPanel } from '../components/ComplexityPanel';
import { TracePlayer } from '../components/visualizer/TracePlayer';

export function Library() {
  const restored = useLocation().state?.problem;
  const [algorithmId, setAlgorithmId] = useState(restored?.algorithmId || algorithms[0].id);
  const algorithm = algorithms.find((item) => item.id === algorithmId);
  const [input, setInput] = useState(JSON.stringify(restored?.input ?? algorithm.example, null, 2));
  const [trace, setTrace] = useState(null);
  const [runId, setRunId] = useState(0);
  const [error, setError] = useState('');
  function choose(id) {
    const next = algorithms.find((item) => item.id === id);
    setAlgorithmId(id);
    setInput(JSON.stringify(next.example, null, 2));
    setTrace(null);
    setError('');
  }
  function run(event) {
    event.preventDefault();
    setError('');
    setTrace(null);
    try {
      if (input.length > 20000)
        throw new Error('Input is too large. Use at most 20,000 characters.');
      setTrace(generateTrace(algorithmId, JSON.parse(input)));
      setRunId((id) => id + 1);
    } catch (error) {
      setError(
        error instanceof SyntaxError
          ? 'Input must be valid JSON. Check commas, quotes, and brackets.'
          : error.message,
      );
    }
  }
  return (
    <div className="page library-page">
      <span className="eyebrow">ALGORITHM LIBRARY · 17 ALGORITHMS</span>
      <h1 className="page-title">Explore the logic.</h1>
      <p className="page-description">
        Choose an algorithm, run your input, and watch every step. Play the animation or inspect
        variables at your own pace.
      </p>
      <AlgorithmCatalog selectedId={algorithmId} onSelect={choose} />
      <div className="library-layout">
        <section className="library-input">
          <form onSubmit={run}>
            <label htmlFor="algorithm-select">Algorithm</label>
            <select
              id="algorithm-select"
              value={algorithmId}
              onChange={(event) => choose(event.target.value)}
            >
              {[...new Set(algorithms.map((item) => item.category))].map((category) => (
                <optgroup label={category} key={category}>
                  {algorithms
                    .filter((item) => item.category === category)
                    .map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            <label htmlFor="algorithm-input">Input (JSON)</label>
            <textarea
              id="algorithm-input"
              rows={12}
              value={input}
              spellCheck={false}
              aria-describedby="input-guide"
              onChange={(event) => {
                setInput(event.target.value);
                setTrace(null);
                setError('');
              }}
            />
            <p id="input-guide" className="input-guide">
              {algorithm.inputGuide}
            </p>
            <div className="library-actions">
              <button className="button primary" type="submit">
                Run algorithm →
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => choose(algorithm.id)}
              >
                Load example
              </button>
            </div>
          </form>
          {error && <ErrorNotice message={error} />}
        </section>
        <ComplexityPanel algorithm={algorithm} />
      </div>
      <section className="library-results" aria-label="Algorithm results">
        {trace ? (
          <div key={runId}>
            <SaveProblem
              defaultTitle={algorithm.name}
              problem={{ mode: 'library', algorithmId: algorithm.id, input: JSON.parse(input) }}
            />
            <TracePlayer trace={trace} algorithm={algorithm} />
          </div>
        ) : (
          <div className="library-empty">
            <h2>Ready when you are.</h2>
            <p>Run the selected example to see its result and step-by-step explanation.</p>
          </div>
        )}
      </section>
    </div>
  );
}
