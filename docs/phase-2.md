# Phase 2 — Frontend foundation

The React website now connects to the Phase 1 backend. It includes the overview, account creation, sign-in, logout, a protected account workspace, upcoming-feature information pages and a 404 page. The layout supports mobile screens, keyboard navigation, loading/error states, and light/dark themes. The overview artwork is a labeled preview; actual algorithm playback arrives in Phases 3–5.

## Start it

For a fresh checkout, run from `C:\coding\dsa project`:

```powershell
npm ci
npm run setup:env -w server
npm run db:generate -w server
npm run db:deploy -w server
```

In one terminal:

```powershell
npm run dev:server
```

In another terminal:

```powershell
npm run dev:client
```

Open **http://localhost:5173**. Use `localhost` consistently for both frontend and backend: switching the frontend to `127.0.0.1` changes its Origin and the backend correctly rejects mutations. Port 5173 is fixed so Vite cannot silently move to a port the backend does not trust.

The client uses `VITE_API_URL=http://localhost:4000/api` by default. To override it, copy `client/.env.example` to `client/.env` if the latter does not already exist, edit it and restart Vite. `VITE_` values are public. No API key or JWT secret belongs there.

## What works

| Route             | Behavior                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `/`               | Responsive overview with real registration/workspace navigation                          |
| `/register`       | Validated registration form, detected timezone, automatic login                          |
| `/login`          | Sign-in form, visible server errors, show/hide password                                  |
| `/dashboard`      | Private account details; redirects guests to login and returns them after authentication |
| `/library`        | Explains the library implementation phases; no simulated algorithm execution             |
| `/custom-code`    | Explains the upcoming playground implementation                                          |
| Any unmatched URL | Accessible 404 page linking back to the overview                                         |

Saved problems and practice charts belong to Phase 7; the current workspace displays genuine account data rather than made-up progress.

## Files and state flow

| Client file                              | Responsibility                                                                                                  |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| index.html, vite.config.js, package.json | Vite entrypoint, React/Tailwind plugins, scripts and exact dependency pins                                      |
| src/main.jsx, src/App.jsx                | Router, auth provider and route definitions                                                                     |
| src/api/client.js                        | Credentialed fetch, 15-second timeout, normalized errors, signed CSRF bootstrap/retry and session-expiry events |
| src/auth/context.js                      | Auth context and consumer hook                                                                                  |
| src/auth/AuthProvider.jsx                | Session loading, user state, login/register/logout, retry and stale-request guards                              |
| src/auth/ProtectedRoute.jsx              | Loading/error handling before deciding whether a guest needs login                                              |
| src/components/AppShell.jsx              | Sidebar, mobile navigation, header, logout, theme persistence and route focus                                   |
| src/components/Icon.jsx, Status.jsx      | SVG icons and reusable accessible error/loading states                                                          |
| src/pages/Overview.jsx                   | Public learning overview                                                                                        |
| src/pages/AuthPage.jsx                   | Registration/login forms and inline field errors                                                                |
| src/pages/Workspace.jsx                  | Protected account information and honest practice empty state                                                   |
| src/pages/ComingSoon.jsx                 | Future-feature information and 404                                                                              |
| src/styles.css                           | Tailwind import, theme tokens, responsive layouts, focus states and reduced motion                              |
| src/api/client.test.js                   | API security/session behavior tests                                                                             |
| eslint.config.js                         | Browser-aware linting and React hooks checks                                                                    |

```text
Form -> AuthProvider.authenticate -> API client
  -> GET csrf token + private cookie
  -> POST login/register with credentials + CSRF header
  -> backend sets httpOnly session cookie
  -> response user stored in React Context -> protected page

Refresh -> GET /auth/me with cookie -> restore user or guest state
Logout -> POST /auth/logout -> clear server cookie -> clear context -> login
```

Tokens are never stored in browser localStorage. Only the visual theme is stored there. The CSRF token lives in memory; a shared bootstrap promise avoids simultaneous cookie rotation within one tab. A CSRF rejection triggers one refresh and retry because the server rejects it before running the route. Other failed mutations are never retried automatically. The backend remains authoritative for security: frontend protected routes only control presentation.

## Tests and verification

```powershell
npm test
npm run lint
npm run format:check
npm run build
npm audit
```

The five client tests cover credentialed CSRF mutations, single-token refresh/retry, no credential-error retry, expired-session notification and readable network failures. The 17 backend integration tests still use a separate migrated database. Browser checks verified registration, refresh persistence, logout redirect, wrong-password feedback and subsequent login with a synthetic local test account. A 390-pixel viewport check verified the account layout; the navigation scrolls horizontally on narrow screens. Theme switching was checked in the browser. A disconnected backend was observed to produce the retry state rather than a misleading login redirect.

Manual check:

1. Visit `/dashboard` while logged out; confirm it opens `/login`.
2. Create an account with a unique email and a password of at least 12 characters (at most 72 UTF-8 bytes).
3. Confirm your account details appear and persist after refresh.
4. Sign out; confirm the private page redirects to login.
5. Try an incorrect password, then the correct password.
6. Use Tab to reach fields/buttons; check the visible focus ring and password visibility button.
7. Resize to phone width, switch theme, and refresh to check its persistence.

Dependency pins supersede the historical Phase 0 baseline: React/React DOM 19.3.1, React Router 7.18.5, Vite 8.3.5, React Vite plugin 6.1.2 and Tailwind/plugin 4.3.3. Authentication uses Context as planned; Zustand is deferred until playback state exists. The committed lockfile records all exact transitive resolutions.

## Interview summary

React Router chooses the page, while Context shares the current user across components.
The API client sends private cookies and CSRF headers; the backend decides whether each request is authorized.
Loading, error and guest states are separate, so a slow or unavailable server does not look like a logged-out session.

Suggested commit: `feat(client): build responsive app shell and secure authentication flows`.
