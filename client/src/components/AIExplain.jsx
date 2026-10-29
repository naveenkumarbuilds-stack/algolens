import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/context';
import { ErrorNotice } from './Status';

export function AIExplain(props) {
  const [status, setStatus] = useState('loading'),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    api('/explain/status')
      .then((data) => {
        if (active) setStatus(data.enabled ? 'enabled' : 'disabled');
      })
      .catch(() => {
        if (active) setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [version]);
  return (
    <StepAIExplain
      key={props.step.index}
      {...props}
      status={status}
      onRetry={() => {
        setStatus('loading');
        setVersion((v) => v + 1);
      }}
    />
  );
}
function StepAIExplain({ step, algorithm, onPause, status, onRetry }) {
  const { user } = useAuth();
  const [message, setMessage] = useState(''),
    [consent, setConsent] = useState(false),
    [includeSource, setIncludeSource] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function explain() {
    onPause();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await api('/explain', {
        method: 'POST',
        body: {
          consent: true,
          ...(algorithm.id ? { algorithmId: algorithm.id } : {}),
          language: algorithm.sourceLanguage ?? 'javascript',
          ...(!algorithm.id && includeSource ? { sourceCode: algorithm.source } : {}),
          step: {
            type: step.type,
            line: step.line,
            variables: step.variables,
            explanation: step.explanation,
          },
        },
      });
      setMessage(data.explanation);
    } catch (error) {
      setError(
        error.details?.length
          ? error.details.map((item) => item.message).join(' · ')
          : error.message,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="ai-explain">
      <summary>AI Explain · optional</summary>
      <p>
        The recorded explanation above works without AI. AI text can be wrong; compare it with the
        trace.
      </p>
      {status === 'loading' ? (
        <p role="status">Checking AI availability…</p>
      ) : status === 'disabled' ? (
        <p>AI is not configured on this server. All visualizers and dry runs remain available.</p>
      ) : status === 'error' ? (
        <>
          <p>Could not check AI availability.</p>
          <button className="button secondary small" onClick={onRetry}>
            Retry availability check
          </button>
        </>
      ) : !user ? (
        <p>
          <Link to="/login">Sign in</Link> to request an AI explanation.
        </p>
      ) : (
        <>
          <p>
            Request an explanation of step {step.index + 1}. We send this step’s variables and
            recorded explanation to OpenAI through the server
            {algorithm.id ? ', along with the library pseudocode' : ''}. Do not include secrets.
          </p>
          {!algorithm.id && (
            <label className="consent-label">
              <input
                type="checkbox"
                checked={includeSource}
                onChange={(event) => setIncludeSource(event.target.checked)}
              />
              Also include my full program source
            </label>
          )}
          <label className="consent-label">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            I agree to send this data to OpenAI for this explanation.
          </label>
          <button className="button secondary" disabled={!consent || busy} onClick={explain}>
            {busy ? 'Explaining…' : 'Explain this step'}
          </button>
          <span role="status">{busy ? ' Requesting an explanation…' : ''}</span>
          {error && <ErrorNotice message={error} />}{' '}
          {message && (
            <div className="ai-response" aria-live="polite">
              <strong>AI-generated explanation · step {step.index + 1}</strong>
              <p>{message}</p>
            </div>
          )}
        </>
      )}
    </details>
  );
}
