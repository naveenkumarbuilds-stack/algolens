# AlgoLens — Phase 0

This phase creates the project contracts and configuration. The app starts running in Phases 1 and 2; no unfinished routes or screens are presented as working features here.

## Architecture and decisions

Use JavaScript ES modules, npm workspaces, React Context for authentication, Zustand for playback, SVG for graphs/trees, and Recharts for dashboard activity. Library algorithms run locally as pure step generators. Express handles identity, saved work, practice history, and optional AI explanations. Guests may visualize; persistence requires login.

```text
Browser: React + Router + Tailwind
  |-- Library generators --> immutable Step[] --> Zustand playback
  |                                            |-- SVG / bars / DP grid
  |                                            |-- dry-run table + code
  |-- Custom editor --> dedicated Web Worker --> restricted AST interpreter
  |                      | timeout/terminate      | bounded Step[]
  |<---------------------+------------------------+
  |
  | HTTPS JSON + httpOnly JWT cookie + CSRF header
  v
Express API: validation -> auth/ownership -> service -> Prisma
  |                                                   |
  | optional AI provider                              +-- SQLite (local)
  | server-held API key                               +-- PostgreSQL (production)
  v
Bounded plain-text explanation
```

Production: Vercel serves the frontend and proxies `/api/*` to Render, preserving a same-origin browser API and cookie path. Render connects to Neon using TLS. Direct cross-site cookie authentication is not the default because browsers may block third-party cookies. Locally, requests to port 4000 use credentials and exact-origin CORS for port 5173. Render trusts its documented proxy hop count only. Free-tier availability, quotas, cold starts, and proxy behavior must be verified during Phase 9.

### Safety and correctness contracts

- JWT cookie: httpOnly, seven-day expiry, secure in production, SameSite=Lax, Path=/, no Domain. Logout clears matching attributes. Tokens contain a user ID and issuer/audience; never password data. Logout clears the browser session but does not revoke an already stolen token; server-side revocation is a future feature.
- bcrypt hashes passwords at cost 12. Accept 12–72 UTF-8 bytes; never silently truncate. Normalize email to lowercase, enforce uniqueness, return generic invalid-credentials errors. Registration returns 409 for an existing email. Responses omit passwordHash.
- Require a random signed double-submit CSRF token/header and a trusted Origin on cookie-authenticated mutations, including login/register; expose bootstrap token endpoint. CORS alone is not CSRF protection.
- Helmet, exact-origin CORS, auth and general rate limits, 256 KB JSON limit, bounded strings/collections, reject unknown fields, and Prisma parameterized access. Render user notes as text; do not strip meaningful code characters as “sanitization.” Every resource lookup includes userId.
- Never run user code through eval, Function, script injection, or Node vm. Phase 6 implements a restricted AST interpreter in a dedicated module Worker. Supported language: literals, arrays, plain objects, lexical variables, assignments, arithmetic/comparisons, if/else, bounded loops, functions/recursion, return, array indexing and explicitly allowed array methods. No imports, async, classes, getters, prototype/constructor access, ambient globals, DOM, network, or dynamic code generation. Unsupported syntax returns a positioned error.
- Worker receives structured-cloned input, has a 2-second wall timeout enforced by the parent, 100,000 interpreter-operation limit, recursion depth 100, 2,000 recorded steps, source size 20 KB, collection length 10,000 and snapshot payload budget 2 MB. Count operations even in empty loops. Terminate/recreate on timeout or cancellation; use run IDs to reject stale messages. A Worker is scheduling isolation; the interpreter is the capability boundary. A browser Worker cannot guarantee a hard OS memory limit.
- Library arrays cap at 64 elements, graphs at 30 nodes/100 edges, DP grids at 2,500 cells. Reject negative Dijkstra weights; validate graph endpoints. Binary search requires sorted input and reports invalid input instead of silently changing it. Reject oversized input rather than silently truncating a trace.
- Snapshots are deep copies, never references to mutable state. Capture state after the indicated line executes; initial/complete synthetic steps use line=null. Line numbers reference the exact displayed source. JSON-unsafe values become labeled strings, e.g. `Infinity` and `undefined`; circular references receive `[Circular]`.

## Folder structure

Files marked “future” are planned for the stated phase, not empty placeholder files.

```text
algolens/
  package.json, package-lock.json
  .gitignore, .prettierrc.json, .prettierignore
  docs/
    phase-0.md
    step.schema.json
    api.md, deployment.md, portfolio.md              (future)
  client/
    package.json, .env.example
    index.html, vite.config.js, eslint.config.js    (phase 2)
    src/
      main.jsx, App.jsx, styles.css
      api/                 HTTP client and error normalization
      auth/                context, protected route
      pages/               Library, Visualizer, CustomCode, Dashboard, Login, Register
      components/
        layout/            AppShell, Header, Navigation
        visualizer/        ArrayView, GraphView, TreeView, DPView, PlaybackControls
        practice/          SavedProblemCard, ActivityChart
        common/            ErrorNotice, Loading, EmptyState
      algorithms/          sorting, searching, graphs, dp, structures, registry
      store/               playbackStore
      workers/             runner.worker, interpreter, snapshot
      test/                generators, playback, interpreter
  server/
    package.json, .env.example
    prisma/
      schema.prisma
      migrations/                                  (phase 1, SQLite only)
    prisma-postgres/
      schema.prisma, migrations/                   (phase 9, PostgreSQL only)
    src/
      app.js, index.js, config.js
      lib/                 Prisma singleton, JWT/cookie utilities
      middleware/          auth, validation, errors, CSRF, rate limits
      routes/              auth, problems, practice, explain
      services/            users, problems, practice, explain
    test/                  auth integration and ownership
  .github/workflows/ci.yml                          (phase 9)
```

## Database

The executable schema is `server/prisma/schema.prisma`.

| Model        | Fields and rules                                                                                                                                | Relations / indexes                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| User         | cuid id, unique normalized email, name, bcrypt passwordHash, IANA timeZone (Asia/Kolkata default), createdAt, updatedAt                         | one-to-many problems and logs                                                              |
| SavedProblem | cuid id, userId, title, mode (library/custom), optional algorithmId/sourceCode, inputJson, tagsJson, notes, status (solved/revisit), timestamps | user cascade delete; indexes (userId, updatedAt), (userId, status)                         |
| PracticeLog  | cuid id, userId, optional savedProblemId/algorithmId, eventId, practiceDate (YYYY-MM-DD), timeZone, createdAt                                   | user cascade delete; problem SetNull; unique (userId,eventId), index (userId,practiceDate) |

Enums and JSON payloads are validated in the API. JSON is stored as validated text for simple portable SQLite/PostgreSQL schemas. API DTOs expose parsed `input` and `tags`, never raw storage fields. In library mode algorithmId is required; in custom mode sourceCode is required. SavedProblem may hold code and input but not the generated trace; regenerate on opening with the current version and disclose version changes later if trace stability becomes necessary.

Practice dates are calculated on the server from its timestamp and the user's validated IANA timezone. The stored date/timezone are immutable; changing timezone applies only to new logs. A completion event is created after reaching the final trace step or explicitly marking a problem solved. Replaying a run uses the same client UUID eventId. Multiple distinct completions increase daily counts but count as one day for streaks. Current streak ends today or yesterday; a missing day earlier breaks it. Weekly activity includes today and the preceding six local dates, zero-filled. Practice is self-reported learning activity, not proof of correctness.

SQLite and PostgreSQL migration SQL are incompatible. In Phase 9 create a PostgreSQL schema with the same models and a different datasource, generate a fresh PostgreSQL migration, and deploy only that history. Switching DATABASE_URL alone is insufficient. Local SQLite data is not automatically transferred to production.

## REST contract

All routes begin `/api`. Success is `{ "data": ... }`. Errors are `{ "error": { "code": "VALIDATION_ERROR", "message": "Check your input", "details": [{ "path": "email", "message": "Invalid email" }], "requestId": "..." } }`; details are optional. Production responses never expose stack traces. Dates are ISO UTC except explicit practiceDate.

| Method / route        | Auth      | Request                                                          | Success                                                                        | Expected errors                                               |
| --------------------- | --------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| GET /health           | no        | —                                                                | 200 {status:"ok"}                                                              | 503 unavailable                                               |
| GET /auth/csrf        | no        | —                                                                | 200 {csrfToken}, signed cookie                                                 | 429                                                           |
| POST /auth/register   | no + CSRF | {name,email,password,timeZone?}                                  | 201 {user}, JWT cookie                                                         | 400 validation, 403 CSRF, 409 duplicate, 429                  |
| POST /auth/login      | no + CSRF | {email,password}                                                 | 200 {user}, JWT cookie                                                         | 400, 401 credentials, 403, 429                                |
| POST /auth/logout     | no + CSRF | {}                                                               | 200 {loggedOut:true}, cleared cookie                                           | 403                                                           |
| GET /auth/me          | yes       | —                                                                | 200 {user}                                                                     | 401                                                           |
| PATCH /auth/me        | yes       | {name?,timeZone?}                                                | 200 {user}                                                                     | 400,401,403                                                   |
| GET /problems         | yes       | query: page=1, limit=20 (max 50), status?, tag?, q?              | 200 {items,total,page,limit}                                                   | 400,401                                                       |
| POST /problems        | yes       | {title,mode,algorithmId?,sourceCode?,input,tags?,notes?,status?} | 201 {problem}                                                                  | 400,401,403                                                   |
| GET /problems/:id     | yes       | —                                                                | 200 {problem}                                                                  | 401,404                                                       |
| PATCH /problems/:id   | yes       | partial create fields; resulting record must validate            | 200 {problem}                                                                  | 400,401,403,404                                               |
| DELETE /problems/:id  | yes       | —                                                                | 200 {deleted:true}                                                             | 401,403,404                                                   |
| POST /practice        | yes       | {eventId,savedProblemId?,algorithmId?}; at least one target      | 201 {log}; 200 on identical retry                                              | 400,401,403,404,409 conflicting eventId                       |
| GET /practice/summary | yes       | —                                                                | 200 {currentStreak,longestStreak,totalPractices,weeklyActivity:[{date,count}]} | 401                                                           |
| POST /explain         | yes       | {algorithmId?,sourceCode?,step}; bounded content                 | 200 {explanation}                                                              | 400,401,403,429,502 provider failure,503 disabled,504 timeout |

All mutations require CSRF. 413 means body too large; 500 means unexpected server error on any route. Foreign-owned records return 404. Problem and log userId always come from the verified token. Practice creation verifies problem ownership in the same transaction as insertion; unique event IDs make retries safe. No route executes submitted JavaScript. Library metadata and algorithms ship with the client; there is no unnecessary algorithms endpoint.

Validation bounds: name 1–80, title 1–120, notes 5,000 characters, tags at most 10 of 24 characters each, q 120 characters, sourceCode 20 KB. Problem input is checked against its algorithm's input rules. Validate status, mode, UUID eventId and timeZone; allow no arbitrary database update fields.

## Universal step contract

`docs/step.schema.json` is the single JSON Schema for every generator and custom trace. Runtime validators in later phases enforce it plus cross-field invariants: indices are contiguous, graph IDs unique and endpoints valid, DP dimensions match labels, and highlights reference existing elements.

```json
{
  "version": 1,
  "index": 1,
  "type": "compare",
  "line": 4,
  "variables": { "i": 0, "j": 2, "left": 5, "right": 3 },
  "highlights": [{ "target": "array", "ids": ["2", "3"], "role": "compare" }],
  "explanation": "Compare arr[2]=5 with arr[3]=3; the next step swaps them.",
  "view": { "kind": "array", "values": [1, 2, 5, 3] }
}
```

Array/stack/queue IDs are zero-based index strings, cells use `row:column`, graph/tree IDs are stable strings. Nodes carry labels; edges carry explicit IDs, endpoints, direction, optional weight. The renderer computes deterministic positions from topology; BST generators preserve left/right relationships through ordered edges and labels, with a documented child-edge convention in Phase 3. Custom code defaults to a variables-only code view; an array visual appears only for an explicitly selected numeric array. Generator metadata supplies displayed source, name/category, input rules, time/space complexity (including relevant best/average/worst cases), and a when-to-use note.

## Component tree and playback flow

```text
App -> AuthProvider -> BrowserRouter -> AppShell
  |-- LibraryPage -> AlgorithmFilters + AlgorithmCard
  |-- VisualizerPage -> InputEditor + ComplexityPanel
  |                    TraceView -> CodePanel + VisualRenderer + DryRunTable
  |                    PlaybackControls
  |-- CustomCodePage -> CodeEditor + WorkerRunner + TraceView
  |-- LoginPage / RegisterPage
  +-- ProtectedRoute -> DashboardPage
                         SavedProblems + PracticeStreak + ActivityChart
```

Zustand holds steps, currentIndex, playing, speedMs, runId, generation status and error. Renderers and dry-run rows derive the current step from currentIndex; they never mutate algorithm data. A single effect owns the playback timer and cleans up on pause, route change, new trace and unmount. Play advances one step per tick and pauses at the final step. Step/back clamp to valid indices and pause playback. Reset pauses and returns to index 0. Speed changes replace the timer. Empty traces disable controls. New input cancels old runs and clears stale state. Worker messages matching only the active runId can replace the trace.

Keyboard: Space play/pause, Left/Right step, Home reset when visualizer has focus; do not capture keys from editors or form fields. Controls have accessible names, visible focus and disabled states. Reduced-motion mode removes transitions; an aria-live status reports a concise current-step summary without flooding playback announcements. Theme preference is stored locally and initially follows the OS.

## Setup (PowerShell)

Node 22.12+ or Node 24 LTS and npm are required. The current machine has Node 24.21.0 / npm 11.19.0. These commands configure Phase 0 only:

```powershell
Set-Location 'C:\coding\dsa project'
npm install
Copy-Item server/.env.example server/.env
Copy-Item client/.env.example client/.env
node --input-type=module -e "import fs from 'node:fs'; import crypto from 'node:crypto'; const p='server/.env'; fs.writeFileSync(p,fs.readFileSync(p,'utf8').replace(/^JWT_SECRET=$/m,'JWT_SECRET='+crypto.randomBytes(48).toString('hex')));"
npm run format:check
```

Copy env examples only on first setup; never overwrite an existing `.env`. The secret-generation command only replaces a blank JWT*SECRET. The backend will reject blank/short secrets when introduced in Phase 1. Nothing in a VITE* variable is secret. Never put AI keys or database credentials in client env files.

Dependency installation is staged with its implementation. Pins below are the initial baseline; each phase must verify compatibility and security before installation, commit the resulting lockfile, and disclose necessary updates. They are not claims of the newest available releases.

```powershell
# Phase 1
npm install -w server --save-exact express@5.1.0 @prisma/client@6.19.0 bcrypt@6.0.0 jsonwebtoken@9.0.2 zod@4.1.12 helmet@8.1.0 cors@2.8.5 express-rate-limit@8.1.0 cookie-parser@1.4.7 dotenv@17.2.3
npm install -w server -D --save-exact prisma@6.19.0 vitest@3.2.4 supertest@7.1.4 eslint@9.39.1 @eslint/js@9.39.1 globals@16.5.0
# Phase 2; chart and worker packages will be added in their own phases
npm install -w client --save-exact react@19.2.0 react-dom@19.2.0 react-router-dom@7.9.5 zustand@5.0.8
npm install -w client -D --save-exact vite@7.1.12 @vitejs/plugin-react@5.0.4 tailwindcss@4.1.16 @tailwindcss/vite@4.1.16 vitest@3.2.4 eslint@9.39.1 @eslint/js@9.39.1 globals@16.5.0 eslint-plugin-react-hooks@7.0.1 eslint-plugin-react-refresh@0.4.24
# Phase 3: schema validation and generator tests
npm install -w client -D --save-exact ajv@8.17.1
# Phase 6: parse only; interpretation is our restricted implementation
npm install -w client --save-exact acorn@8.15.0
# Phase 7
npm install -w client --save-exact recharts@3.3.0
```

For this phase, do not run future-phase commands: their entrypoints/scripts do not exist yet. Phase 1 supplies database generate/migrate commands and auth tests; Phase 2 supplies dev/build scripts. PostgreSQL connection strings, Vercel rewrites, Render proxy settings, migrations, and CI are delivered and checked in Phase 9. AI env values are optional and only become active in Phase 8; users explicitly opt in before sending code to a provider.

## Verification and acceptance

1. `npm install` resolves the Phase 0 workspaces and creates the lockfile.
2. `npm run format:check` passes after formatting.
3. Parse all package files, env examples and step schema; verify each referenced model relation has an inverse and indexed owner access.
4. In Phase 1, validate and migrate the Prisma schema with its pinned CLI and run Supertest against a disposable SQLite database. In Phase 3, validate each generated snapshot against the step schema and assert algorithm results, invariants, and input non-mutation. Browser and worker security tests arrive with their respective implementations.

The full downloadable project zip is created at the end of Phase 10, excluding secrets, local databases and dependencies.

## Interview summary

The browser generates immutable algorithm snapshots, while Express owns authentication and persistent practice data.
One versioned step contract lets bars, graphs, trees, tables and playback share the same state flow.
Custom code uses a restricted interpreter inside a terminable Worker; owner-scoped queries and CSRF-protected cookies secure persistence.

Suggested commit: `docs: define AlgoLens architecture, data model and API contracts`.
