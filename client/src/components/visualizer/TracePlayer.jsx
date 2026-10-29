import { useEffect, useReducer, useState } from 'react';
import { initialPlayback, playbackReducer } from './playback';
import { AIExplain } from '../AIExplain';
import { PracticeButton } from '../PracticeButton';
import { DryRunTable } from './DryRunTable';
import { ArrayView, GraphView, DPView } from './Views';

export function TracePlayer({ trace, algorithm }) {
  const [state, dispatch] = useReducer(playbackReducer, initialPlayback);
  const [watched, setWatched] = useState('');
  const { steps } = trace,
    count = steps.length,
    step = steps[state.index];
  const act = (type, extra = {}) => dispatch({ type, count, ...extra });
  useEffect(() => {
    if (!state.playing) return;
    const timer = setTimeout(() => dispatch({ type: 'tick', count }), state.speed);
    return () => clearTimeout(timer);
  }, [state.playing, state.index, state.speed, count]);
  const visited = new Set();
  for (let i = 0; i <= state.index; i++)
    for (const h of steps[i].highlights)
      if (h.target === 'node' && h.role === 'visited') h.ids.forEach((id) => visited.add(id));
  const names = [...new Set(steps.flatMap((s) => Object.keys(s.variables)))];
  function keydown(event) {
    if (
      event.target.closest('input,textarea,select,button,a') ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;
    const actions = {
      ArrowRight: () => act('seek', { index: state.index + 1 }),
      ArrowLeft: () => act('seek', { index: state.index - 1 }),
      Home: () => act('reset'),
      ' ': () => act(state.playing ? 'pause' : 'play'),
    };
    if (actions[event.key]) {
      event.preventDefault();
      actions[event.key]();
    }
  }
  return (
    <section
      className="trace-player"
      tabIndex={0}
      aria-label="Algorithm playback. Space plays or pauses, arrow keys step, Home resets."
      onKeyDown={keydown}
    >
      <div className="player-heading">
        <div>
          <span className="eyebrow">STEP BY STEP</span>
          <h2>{algorithm.name} in motion</h2>
        </div>
        <span className="pill">
          {state.playing ? 'PLAYING' : state.index === count - 1 ? 'COMPLETE' : 'PAUSED'}
        </span>
      </div>
      <div className="playback-controls">
        <button className="button secondary" onClick={() => act('reset')}>
          Reset
        </button>
        <button
          className="button secondary"
          disabled={state.index === 0}
          onClick={() => act('seek', { index: state.index - 1 })}
          aria-label="Previous step"
        >
          ← Back
        </button>
        <button className="button primary" onClick={() => act(state.playing ? 'pause' : 'play')}>
          {state.playing ? 'Pause' : state.index === count - 1 ? 'Replay' : 'Play'}
        </button>
        <button
          className="button secondary"
          disabled={state.index === count - 1}
          onClick={() => act('seek', { index: state.index + 1 })}
          aria-label="Next step"
        >
          Next →
        </button>
        <label className="speed-label">
          Step duration{' '}
          <input
            type="range"
            min="100"
            max="2000"
            step="50"
            value={state.speed}
            onChange={(event) => act('speed', { speed: Number(event.target.value) })}
          />
          <span>{state.speed} ms</span>
        </label>
      </div>
      <label className="timeline-label">
        Step {state.index + 1} of {count}
        <input
          aria-label="Seek to step"
          type="range"
          min="0"
          max={count - 1}
          value={state.index}
          onChange={(event) => act('seek', { index: Number(event.target.value) })}
        />
      </label>
      <div className="visual-stage">
        {['array', 'stack', 'queue'].includes(step.view.kind) ? (
          <ArrayView step={step} initial={steps.find((s) => s.view.kind === 'array') || steps[0]} />
        ) : step.view.kind === 'dp' ? (
          <DPView step={step} />
        ) : ['graph', 'tree'].includes(step.view.kind) ? (
          <GraphView step={step} initial={steps.at(-1)} visited={visited} />
        ) : (
          <p>Follow the variables below.</p>
        )}
      </div>
      <div className="visual-legend">
        <span>● Active / changed</span>
        <span>● Comparison</span>
        <span>● Visited / final</span>
        <span>Negative array values use striped bars.</span>
      </div>
      <p className="step-explanation" aria-live={state.playing ? 'off' : 'polite'}>
        <strong>
          {step.type} · {step.line === null ? 'Summary' : `Line ${step.line}`}
        </strong>
        {step.explanation}
      </p>
      <AIExplain step={step} algorithm={algorithm} onPause={() => act('pause')} />
      <div className="player-panels">
        <section>
          <h3>
            Current line ·{' '}
            {algorithm.sourceLanguage === 'pseudocode' ? 'pseudocode' : algorithm.sourceLanguage}
          </h3>
          <ol className="source-lines playback-source">
            {algorithm.source.split('\n').map((line, i) => (
              <li
                key={i}
                className={step.line === i + 1 ? 'current-line' : ''}
                aria-current={step.line === i + 1 ? 'step' : undefined}
              >
                <code>{line}</code>
              </li>
            ))}
          </ol>
        </section>
        <section>
          <h3>Variable watch</h3>
          <label htmlFor="variable-watch">Choose a variable to trace</label>
          <select id="variable-watch" value={watched} onChange={(e) => setWatched(e.target.value)}>
            <option value="">All current variables</option>
            {names.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
          <dl className="variable-values">
            {Object.entries(step.variables)
              .filter(([name]) => !watched || name === watched)
              .map(([name, value]) => (
                <div
                  key={name}
                  className={
                    JSON.stringify(steps[state.index - 1]?.variables[name]) !==
                    JSON.stringify(value)
                      ? 'variable-changed'
                      : ''
                  }
                >
                  <dt>{name}</dt>
                  <dd>
                    <code>{JSON.stringify(value)}</code>
                  </dd>
                </div>
              ))}
          </dl>
          {(!Object.keys(step.variables).length || (watched && !(watched in step.variables))) && (
            <p className="watch-empty">
              {watched
                ? 'This variable is not recorded in the current step.'
                : 'Variables appear as the algorithm runs.'}
            </p>
          )}
        </section>
      </div>
      <DryRunTable
        steps={steps}
        currentIndex={state.index}
        watched={watched}
        source={algorithm.source}
        onSeek={(index) => act('seek', { index })}
      />
      {algorithm.id && (
        <PracticeButton
          key={algorithm.id}
          algorithmId={algorithm.id}
          completed={state.index === count - 1}
        />
      )}
      <p className="trace-result">
        Final result: <code>{JSON.stringify(trace.result)}</code>
      </p>
    </section>
  );
}
