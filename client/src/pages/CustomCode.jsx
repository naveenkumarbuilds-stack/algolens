import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SaveProblem } from '../components/SaveProblem';
import { TracePlayer } from '../components/visualizer/TracePlayer';
import { ErrorNotice } from '../components/Status';
import { examples } from '../workers/examples';
import { startProgram } from '../workers/workerClient';

const titles = { javascript: 'JavaScript', java: 'Java', c: 'C' };
export function CustomCode() {
  const restored = useLocation().state?.problem;
  const [language, setLanguage] = useState(restored?.language || 'java');
  const [source, setSource] = useState(restored?.sourceCode || examples.java.source);
  const [input, setInput] = useState(JSON.stringify(restored?.input ?? {}));
  const [visual, setVisual] = useState(restored?.visualVariable ?? 'arr');
  const [trace, setTrace] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [runId, setRunId] = useState(0);
  const cancelRef = useRef(null),
    generation = useRef(0);
  useEffect(
    () => () => {
      cancelRef.current?.();
    },
    [],
  );
  function cancel() {
    generation.current++;
    cancelRef.current?.();
    cancelRef.current = null;
    setBusy(false);
  }
  function clear() {
    cancel();
    setTrace(null);
    setError('');
  }
  function load(next) {
    clear();
    setLanguage(next);
    setSource(examples[next].source);
    setInput(JSON.stringify(examples[next].input, null, 2));
    setVisual(examples[next].visualVariable);
  }
  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    clear();
    const current = generation.current;
    try {
      if (file.size > 20000) throw new Error('Upload a source file of at most 20 KB.');
      const extension = file.name.split('.').at(-1).toLowerCase(),
        next = { js: 'javascript', java: 'java', c: 'c' }[extension];
      if (!next) throw new Error('Choose a .js, .java, or .c text file.');
      const text = await file.text();
      if (current !== generation.current) return;
      setLanguage(next);
      setSource(text);
      setInput('{}');
    } catch (error) {
      if (current === generation.current) setError(error.message);
    }
  }
  function run(event) {
    event.preventDefault();
    clear();
    try {
      if (new TextEncoder().encode(source).length > 20000)
        throw new Error('Source must be at most 20 KB.');
      if (new TextEncoder().encode(input).length > 20000)
        throw new Error('Input JSON must be at most 20 KB.');
      if (visual && !/^[A-Za-z_$][\w$]*$/.test(visual))
        throw new Error('Array visual variable must be a simple variable name, such as arr.');
      const data = JSON.parse(input),
        current = generation.current;
      setBusy(true);
      cancelRef.current = startProgram(
        { source, language, input: data, visualVariable: visual },
        {
          onComplete: (result) => {
            if (current !== generation.current) return;
            setTrace(result);
            setRunId((id) => id + 1);
            setBusy(false);
          },
          onError: (message) => {
            if (current !== generation.current) return;
            setError(message);
            setBusy(false);
          },
        },
      );
    } catch (error) {
      setBusy(false);
      setError(error instanceof SyntaxError ? 'Input must be valid JSON.' : error.message);
    }
  }
  return (
    <div className="page custom-page">
      <span className="eyebrow">CODE PLAYGROUND · LOCAL EXECUTION</span>
      <h1 className="page-title">Follow your own logic.</h1>
      <p className="page-description">
        Paste or upload a program, run it, and trace its variables one line at a time. Your source
        stays in this browser.
      </p>
      <div className="subset-notice">
        <strong>Teaching subset · interpreted, not compiled</strong>
        <p>
          JavaScript, Java and C support basic variables, one-dimensional arrays, functions,
          if/else, for/while loops and simple output. Java/C use bounded 32-bit integers. This is
          not a full Java or C compiler.
        </p>
      </div>
      <div className="custom-layout">
        <form className="custom-editor" onSubmit={run} aria-busy={busy}>
          <div className="custom-toolbar">
            <label>
              Language
              <select value={language} onChange={(event) => load(event.target.value)}>
                {Object.entries(titles).map(([key, title]) => (
                  <option key={key} value={key}>
                    {title}
                  </option>
                ))}
              </select>
            </label>
            <label className="upload-label">
              Upload program
              <input type="file" accept=".js,.java,.c" onChange={upload} />
            </label>
          </div>
          <label htmlFor="program-source">Your program · {titles[language]}</label>
          <textarea
            id="program-source"
            spellCheck={false}
            rows={18}
            value={source}
            onChange={(event) => {
              clear();
              setSource(event.target.value);
            }}
            aria-describedby="source-help"
          />
          <p id="source-help" className="input-guide">
            Keep semicolons and braces. Maximum 20 KB. Lines in playback refer to this exact source.
          </p>
          <label htmlFor="program-input">Input JSON</label>
          <textarea
            id="program-input"
            rows={4}
            value={input}
            spellCheck={false}
            onChange={(event) => {
              clear();
              setInput(event.target.value);
            }}
          />
          <label htmlFor="visual-variable">Array variable to animate (optional)</label>
          <input
            id="visual-variable"
            value={visual}
            placeholder="arr"
            onChange={(event) => {
              clear();
              setVisual(event.target.value);
            }}
          />
          <p className="input-guide">
            Choose a numeric array of up to 64 elements. Other variables are available in Variable
            watch. Arrays outside a local scope are not shown.
          </p>
          <div className="library-actions">
            <button className="button primary" disabled={busy} type="submit">
              {busy ? 'Running…' : 'Run & trace →'}
            </button>
            {busy && (
              <button className="button secondary" type="button" onClick={cancel}>
                Stop execution
              </button>
            )}
            <button className="button secondary" type="button" onClick={() => load(language)}>
              Load example
            </button>
          </div>
          <div role="status" className="form-status">
            {busy ? 'Running in a separate worker. You can stop execution.' : ''}
          </div>
          {error && <ErrorNotice message={error} />}
        </form>
        <aside className="custom-help">
          <h2>Make the steps understandable.</h2>
          <ol>
            <li>Start with the example for your language.</li>
            <li>Choose an array variable for the animation.</li>
            <li>Run, then select any recorded variable in Variable watch.</li>
            <li>Use Next and Back to compare values, or search the dry-run table.</li>
          </ol>
          <details open>
            <summary>Supported syntax and limits</summary>
            <p>
              Declarations, assignments, arithmetic, comparisons, logical operators, ++/--, if/else,
              for/while, break/continue, functions and recursion. Java main(String[] args) and C
              main() wrappers are supported.
            </p>
            <p>
              JavaScript: let/const/var, array literals, array.length, push/pop/shift/unshift,
              console.log and selected Math functions. Object literals, callbacks and arrow
              functions are not supported.
            </p>
            <p>
              Java/C: int, boolean/bool, strings, one-dimensional arrays and typed functions. Java:
              System.out.println/print and new int[n]. C: printf with %d/%f/%s and stdio.h. No
              pointers, structs, imports, objects, floating-point variables, scanf or Scanner.
            </p>
            <p>
              Read inputs with <code>readInt("n")</code> for an Input JSON key, for example{' '}
              <code>{'{"n":5}'}</code>. This is a playground helper, not a standard Java/C function.
              JavaScript can read <code>input.values</code>.
            </p>
            <p>
              2,000 steps · 100,000 operations · 50 calls deep · 2 seconds · 2 MiB snapshots · 16 KB
              output. Unsupported syntax produces an error. Equality is strict; C/Java integer
              overflow is rejected. This interpreter does not reproduce every language rule.
            </p>
          </details>
          <details>
            <summary>How execution is isolated</summary>
            <p>
              A parser and interpreter run in a dedicated Web Worker. The program receives no
              browser, filesystem or network capability. It is never passed to eval, Function, a
              shell or your installed compilers. The worker is terminated on completion, stop or
              timeout.
            </p>
          </details>
        </aside>
      </div>
      {trace && (
        <section className="library-results" aria-label="Program execution">
          <SaveProblem
            key={runId}
            defaultTitle={`My ${titles[language]} program`}
            problem={{
              mode: 'custom',
              sourceCode: source,
              language,
              visualVariable: visual,
              input: JSON.parse(input),
            }}
          />
          <div className="program-output">
            <h2>Program output</h2>
            <pre>{trace.result.output || '(No output printed)'}</pre>
          </div>
          <TracePlayer
            key={runId}
            trace={trace}
            algorithm={{
              name: `Your ${titles[language]} program`,
              source,
              sourceLanguage: language,
            }}
          />
        </section>
      )}
    </div>
  );
}
