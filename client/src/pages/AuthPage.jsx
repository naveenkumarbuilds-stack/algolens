import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { ErrorNotice, Loading } from '../components/Status';
import { Icon } from '../components/Icon';

function safeDestination(value) {
  return typeof value === 'string' &&
    /^\/(?!\/)/.test(value) &&
    !['/login', '/register'].includes(value)
    ? value
    : '/dashboard';
}

export function AuthPage({ mode }) {
  const registering = mode === 'register';
  const { user, status, authenticate } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const destination = safeDestination(location.state?.from);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  if (status === 'loading') return <Loading />;
  if (user) return <Navigate to={destination} replace />;
  async function submit(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    const bytes = new TextEncoder().encode(values.password).length;
    setError('');
    setFieldErrors({});
    if (bytes > 72 || (registering && bytes < 12)) {
      setFieldErrors({ password: 'Use 12–72 UTF-8 bytes (most English characters use one byte).' });
      return;
    }
    if (registering)
      values.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
    setBusy(true);
    try {
      await authenticate(mode, values);
      navigate(destination, { replace: true });
    } catch (error) {
      setError(error.message);
      setFieldErrors(Object.fromEntries(error.details.map(({ path, message }) => [path, message])));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page auth-page">
      <section className="auth-story">
        <span className="eyebrow">YOUR NEXT “AHA” STARTS HERE</span>
        <h1>
          Learn the logic.
          <br />
          <span>Own the understanding.</span>
        </h1>
        <p>A little practice, a clear explanation, and a space to make it all click.</p>
        <div className="auth-benefits">
          {[
            'Explore at your own pace',
            'Build lasting intuition',
            'Keep your learning in one place',
          ].map((text) => (
            <div key={text}>
              <span>
                <Icon name="check" size={16} />
              </span>
              {text}
            </div>
          ))}
        </div>
        <div className="auth-quote">
          <span>“</span>
          <p>The best way to understand an algorithm is to follow its decisions.</p>
          <small>THE IDEA BEHIND ALGOLENS</small>
        </div>
      </section>
      <section className="auth-card">
        <span className="pill">
          {registering ? 'MAKE ROOM FOR LEARNING' : 'GOOD TO SEE YOU AGAIN'}
        </span>
        <h2>{registering ? 'Create your account' : 'Welcome back'}</h2>
        <p>
          {registering ? 'Start with a space that’s yours.' : 'Sign in to your learning workspace.'}
        </p>
        {error && <ErrorNotice message={error} />}
        <form onSubmit={submit} aria-busy={busy}>
          {registering && (
            <Field
              label="Your name"
              name="name"
              autoComplete="name"
              maxLength={80}
              error={fieldErrors.name}
            />
          )}
          <Field
            label="Email address"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={254}
            error={fieldErrors.email}
          />
          <div className="password-field">
            <Field
              label="Password"
              name="password"
              type={visible ? 'text' : 'password'}
              autoComplete={registering ? 'new-password' : 'current-password'}
              error={fieldErrors.password}
              hint={registering ? 'Use at least 12 characters; maximum 72 UTF-8 bytes.' : undefined}
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={visible ? 'Hide password' : 'Show password'}
              onClick={() => setVisible(!visible)}
            >
              {visible ? 'Hide' : 'Show'}
            </button>
          </div>
          <button className="button primary submit-button" disabled={busy}>
            {busy ? 'Please wait…' : registering ? 'Create account' : 'Sign in'}
            {!busy && <Icon name="arrow" size={18} />}
          </button>
          <div className="form-status" role="status">
            {busy ? (registering ? 'Creating your account…' : 'Signing you in…') : ''}
          </div>
        </form>
        <p className="auth-switch">
          {registering ? 'Already have an account?' : 'New around here?'}{' '}
          <Link to={registering ? '/login' : '/register'} state={{ from: destination }}>
            {registering ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
        <div className="auth-security">
          <Icon name="check" size={14} />
          Your password is securely hashed.
        </div>
      </section>
    </div>
  );
}

function Field({ label, name, error, hint, type = 'text', ...props }) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        required
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : hint ? `${name}-hint` : undefined}
        {...props}
      />
      {hint && <small id={`${name}-hint`}>{hint}</small>}
      {error && (
        <small className="field-error" id={`${name}-error`}>
          {error}
        </small>
      )}
    </div>
  );
}
