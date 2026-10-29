# Phase 9 — Deployment preparation

Phase 9 prepares AlgoLens to run online. Your local project still runs with SQLite. Hosting uses Vercel for the website and API proxy, Render for Express, and Neon PostgreSQL for persistent accounts and saved work.

The application is not published by these files. Creating the hosting projects, entering secrets and confirming the first online deployment remain account-owner steps. No existing SQLite data is copied to PostgreSQL automatically.

## What changed

- `vercel.json` builds the React app, supports direct links to pages, and adds browser security headers.
- `api/[...path].js` forwards website API requests to Render. Login cookies stay on the website's domain. The proxy limits request/response sizes, applies a timeout and preserves authentication cookies.
- Render requires a shared proxy secret and a platform-provided client address for API access. The health endpoint stays public. Client addresses keep rate limits separate for different visitors.
- `render.yaml` defines the backend build, startup migrations and environment settings.
- `server/prisma-postgres` contains a separate PostgreSQL schema and initial migration. SQLite SQL cannot be reused as PostgreSQL migration history.
- `scripts/sync-postgres-schema.js` generates the PostgreSQL schema from the local schema. CI checks that every model remains synchronized.
- GitHub Actions checks formatting, lint, tests and a production build, with another job for PostgreSQL migrations and server tests. Dependabot checks dependency updates.

The production website uses `/api` automatically. Development continues to use the local server unless `VITE_API_URL` overrides it.

## Before hosting

1. Keep a backup of your local project and database. Push the project to a GitHub repository you own, excluding `.env`, database files and `node_modules`. Commit the example environment files and both migration directories.
2. Open the repository's Actions tab and wait for both CI jobs to pass. The PostgreSQL job uses a disposable local test database and needs no hosting credentials.
3. Create Vercel, Render and Neon accounts. Use a similar region for Render and Neon where available.
4. Generate two independent secrets. Run this command twice in your terminal and store each result privately:

```powershell
node --input-type=module -e "import { randomBytes } from 'node:crypto'; console.log(randomBytes(48).toString('hex'))"
```

Use the first value for `JWT_SECRET` and the second for `PROXY_SECRET`. Never commit either value or put secrets in a variable beginning with `VITE_`; those variables are visible in the built website.

## 1. Create the database

Create an empty Neon PostgreSQL database. Copy its pooled connection URL for `DATABASE_URL` and its direct connection URL for `DIRECT_URL`. Preserve the supplied SSL settings. Paste these only into Render's private environment settings.

The runtime uses the pooled URL; Prisma migrations use the direct URL. See [Neon's Prisma guide](https://neon.com/docs/guides/prisma).

## 2. Create the website

Import the GitHub repository into Vercel. Select the repository root as the root directory, not `client`. The root contains both the website and its API function. Use the Other framework preset if needed; `vercel.json` supplies the install command, build command and `client/dist` output. Select Node.js 24.x.

Set `VITE_API_URL` to `/api` and set the private `PROXY_SECRET` to your second generated value. Deploy to obtain your stable production address, such as `https://your-project.vercel.app`. API requests will be unavailable until the backend URL is configured in step 4.

Use the stable production address throughout this guide, without a trailing slash. Preview deployments need their own staging backend, origin and database to test account features reliably.

## 3. Create the backend

In Render, create a Blueprint from your repository using the committed `render.yaml`. Enter these private settings when prompted:

| Setting         | Value                                                                       |
| --------------- | --------------------------------------------------------------------------- |
| `DATABASE_URL`  | Neon pooled PostgreSQL URL                                                  |
| `DIRECT_URL`    | Neon direct PostgreSQL URL                                                  |
| `CLIENT_ORIGIN` | Stable Vercel website origin, for example `https://your-project.vercel.app` |
| `JWT_SECRET`    | First generated secret                                                      |
| `PROXY_SECRET`  | Same second secret used in Vercel                                           |

The blueprint already sets production mode, secure cookies and Node.js. Leave `TRUST_PROXY` at `0`; the authenticated proxy supplies the client address. Leave the optional AI key unset to keep AI explanations off. Existing animation, tracing and saved-work features do not require AI.

The build installs dependencies and generates the PostgreSQL Prisma client. Startup applies committed PostgreSQL migrations before starting Express. Migrations run on startup because the chosen free service does not provide a separate pre-deploy command. Review migration compatibility before future releases.

When the deployment is healthy, open `https://YOUR-RENDER-HOST/api/health`. It should return a successful health response. Other direct backend routes require the proxy secret and are intentionally unavailable from a normal browser request.

See [Render's Blueprint reference](https://render.com/docs/blueprint-spec) for importing the configuration.

## 4. Connect the website

In Vercel, set private `BACKEND_ORIGIN` to the Render HTTPS origin, such as `https://your-api.onrender.com`. Do not include `/api`, a trailing path, credentials or query parameters. Confirm `PROXY_SECRET` matches Render exactly. Redeploy the website so the function receives the environment changes.

The Vercel function forwards cookies and CSRF headers and adds the shared secret. The backend only accepts the configured website origin for browser mutations. The proxy reads Vercel's platform client-IP header rather than trusting an address supplied by a visitor. See [Vercel Node.js functions](https://vercel.com/docs/functions/runtimes/node-js) and [request headers](https://vercel.com/docs/headers/request-headers).

## 5. Check the online app

Use the Vercel address for these checks:

1. Open `/api/health`, then refresh a direct page link such as `/library`.
2. Register a new test account, log out and log in again.
3. Run a library animation and step forward/back through a trace.
4. Upload a small supported Java or C teaching example. Trace a variable and try random inputs. These languages use the documented teaching interpreter, not native Java/C compilers.
5. Save work, refresh, reopen it and confirm the dashboard records practice.
6. Log out and confirm private saved work requires login.
7. Confirm AI shows its disabled state when no server key is configured.

If login fails, check the exact `CLIENT_ORIGIN`, matching proxy secrets and secure HTTPS addresses. If all proxy requests fail, inspect Render health and verify the Vercel backend origin, then redeploy after changing environment values. Keep secrets out of screenshots and logs shared publicly.

Free Render services sleep after inactivity and have an ephemeral filesystem; this is why hosted data lives in PostgreSQL. Waking the backend may exceed the proxy's 12-second timeout. Open the backend health URL, wait for it to wake, then retry a read. After a failed save, check your saved work before submitting again to avoid duplicates. Hosting limits and prices can change; see [Render free-service limitations](https://render.com/docs/free).

## Maintenance and limits

- Back up PostgreSQL before schema changes. Use forward migrations; do not run database reset commands against hosted data. Rolling back code does not undo a database migration.
- After editing the local schema, run `npm run db:sync-schema`, then create and review the corresponding PostgreSQL migration using an isolated development database. The sync script updates schema text only; it does not generate migration SQL.
- Never point the test runner at a hosted database. PostgreSQL tests require `CI=true`, a local host and a database named `algolens_test`; other targets are rejected. Generate the PostgreSQL client before those tests and regenerate the SQLite client afterward for normal local development.
- Request counters are held in memory and reset on restart. Multiple backend instances require shared rate-limit storage. Optional AI also needs provider-side spending controls.
- Keep preview/staging secrets separate from production. Changing the JWT secret signs users out; changing the proxy secret requires updating both hosts together.
- The browser policy allows same-origin scripts, API connections and workers. Review it when adding third-party services. Inline styles remain allowed for the current UI/chart implementation.

## Verification status

Locally verified: 149 tests (101 client, 48 server), lint, production build, schema synchronization and Prisma PostgreSQL schema validation. Proxy tests cover authentication headers, cookies, invalid requests, failures and client-specific rate limiting.

No local PostgreSQL service was available, so the committed PostgreSQL migration and integration-test job still need their first actual run in GitHub Actions. No Vercel, Render or Neon project was created or published during this phase. The online checks above remain required before calling the hosted release ready.

## Interview summary

The frontend and backend deploy separately, while a same-origin proxy keeps browser authentication straightforward.
SQLite supports local development; PostgreSQL provides persistent hosted storage with its own migrations.
CI checks code quality and both database configurations before a release.

Suggested commit: `chore(deploy): prepare Vercel Render PostgreSQL hosting and CI`.

Phase 10 remains: final documentation and project handover.
