import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { Icon } from './Icon';
import { ErrorNotice } from './Status';
import { ConnectionNotice } from './ConnectionNotice';

function initialTheme() {
  try {
    const saved = localStorage.getItem('algolens-theme');
    if (saved === 'light' || saved === 'dark') return saved;
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}
export function AppShell() {
  const { user, status, logout } = useAuth();
  const [theme, setTheme] = useState(initialTheme);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const location = useLocation();
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('algolens-theme', theme);
    } catch {
      /* Theme still works without storage. */
    }
  }, [theme]);
  useEffect(() => {
    document.title = `AlgoLens — ${location.pathname === '/' ? 'Your learning workspace' : location.pathname.slice(1).replaceAll('-', ' ')}`;
    document.getElementById('main-content')?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [location.pathname]);
  async function handleLogout() {
    setBusy(true);
    setError('');
    try {
      await logout();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Icon name="lens" size={26} />
          </span>
          AlgoLens<span className="brand-dot">.</span>
        </Link>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          <NavLink to="/" end>
            <Icon name="grid" />
            Overview
          </NavLink>
          <NavLink to="/library">
            <Icon name="book" />
            Algorithm library
          </NavLink>
          <NavLink to="/custom-code">
            <Icon name="code" />
            Code playground
          </NavLink>
          <NavLink to="/dashboard">
            <Icon name="grid" />
            My workspace
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="small-tip">
            <span className="tip-spark">✳</span>
            <strong>Small steps. Big understanding.</strong>
            <p>Make the logic click, one line at a time.</p>
          </div>
          <span className="build-label">BUILT FOR THE CURIOUS</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="breadcrumb">
            Your workspace <span>/</span> <strong>AlgoLens</strong>
          </span>
          <div className="header-actions">
            <button
              className="icon-button"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              <Icon name={theme === 'light' ? 'moon' : 'sun'} />
            </button>
            {user ? (
              <>
                <span className="user-chip">
                  <span className="avatar">{user.name.slice(0, 1).toUpperCase()}</span>
                  <span>{user.name}</span>
                </span>
                <button
                  className="icon-button"
                  disabled={busy}
                  aria-label={busy ? 'Signing out' : 'Sign out'}
                  onClick={handleLogout}
                >
                  <Icon name="logout" />
                </button>
              </>
            ) : (
              <Link className="button small secondary" to="/login">
                {status === 'loading' ? 'Checking session…' : 'Sign in'}
                <Icon name="arrow" size={16} />
              </Link>
            )}
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          <ConnectionNotice />
          {error && <ErrorNotice message={error} />}
          <Outlet />
        </main>
        <footer>
          <span>
            AlgoLens <span className="footer-dot">/</span> See the logic. Build your intuition.
          </span>
          <span>Made for learning, step by step.</span>
        </footer>
      </div>
    </div>
  );
}
