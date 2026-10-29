# Phase 1 — Backend foundation

The Express API now runs with Prisma/SQLite, registration, login, logout, current-user lookup and profile updates. Authentication uses bcrypt cost 12 and a seven-day HS256 JWT in an httpOnly cookie. JWT issuer and audience are verified. Passwords accept 12–72 UTF-8 bytes on registration, preventing bcrypt truncation. Email normalization and a database unique constraint prevent duplicate accounts, including concurrent registration races.

## Run from the project root

```powershell
Set-Location 'C:\coding\dsa project'
npm ci
npm run setup:env -w server
npm run db:generate -w server
npm run db:deploy -w server
npm run dev:server
```

The setup script preserves an existing environment, fills a blank JWT_SECRET with cryptographic random bytes, and creates the default empty SQLite file if missing. Prisma's Windows engine needs that file pre-created on this machine. No secret is printed or committed. The initial migration is committed under `server/prisma/migrations`; `db:deploy` applies it. For future schema edits use `npm run db:migrate -w server -- --name describe_change`. To start without watch mode use `npm start -w server`.

Visit http://localhost:4000/api/health. A ready database returns `{"data":{"status":"ok"}}`. No frontend is included until Phase 2.

## Verify

```powershell
npm test
npm run lint
npm run format:check
npm audit
```

The test launcher creates a unique temporary SQLite database, applies the committed migrations, runs Vitest/Supertest, and deletes only its own temporary directory. It never resets the development database. The tests need local loopback network access because Supertest starts ephemeral HTTP servers.

Coverage includes registration, email normalization, bcrypt hashing/cost, private cookie flags, duplicate emails, login/logout, generic credentials errors, invalid registration, multibyte password limits, unknown fields, missing/forged CSRF tokens, untrusted/missing origins, absent/invalid/expired/wrong-audience JWTs, deleted users, permitted profile updates, malformed JSON, oversized requests, health checks, CORS/security headers, rate limiting and production configuration validation.

## Manual authentication smoke test

With the server running, execute in another PowerShell terminal:

```powershell
$api = 'http://localhost:4000/api'
$bootstrap = Invoke-RestMethod "$api/auth/csrf" -SessionVariable session
$headers = @{ Origin = 'http://localhost:5173'; 'X-CSRF-Token' = $bootstrap.data.csrfToken }
$email = 'student-' + [guid]::NewGuid().ToString('N') + '@example.com'
$registration = @{ name = 'Student'; email = $email; password = 'learning algorithms 123' } | ConvertTo-Json
Invoke-RestMethod "$api/auth/register" -Method Post -WebSession $session -Headers $headers -ContentType 'application/json' -Body $registration
Invoke-RestMethod "$api/auth/me" -WebSession $session
Invoke-RestMethod "$api/auth/logout" -Method Post -WebSession $session -Headers $headers -ContentType 'application/json' -Body '{}'
# This final request should return HTTP 401 after logout.
Invoke-RestMethod "$api/auth/me" -WebSession $session
```

## Files and responsibilities

| Path under server/   | Responsibility                                                                                       |
| -------------------- | ---------------------------------------------------------------------------------------------------- |
| src/index.js         | Loads env, validates config, connects Prisma, starts HTTP server, graceful shutdown                  |
| src/app.js           | Testable app factory; Helmet, CORS, limits, JSON parsing, CSRF, health and route mounting            |
| src/config.js        | Validates ports, secret, database URL, exact client origin, production HTTPS/cookies and proxy count |
| src/lib/auth.js      | Public user DTO, cookie settings, JWT issuing/verification, signed double-submit CSRF                |
| src/lib/errors.js    | Consistent errors with server-generated request IDs and safe production messages                     |
| src/routes/auth.js   | Strict Zod validation, bcrypt checks, auth/profile handlers                                          |
| scripts/setup-env.js | Idempotent local configuration and SQLite file initialization                                        |
| scripts/test.js      | Disposable database, committed migrations and test runner                                            |
| test/auth.test.js    | Auth and security integration tests against real Prisma/SQLite                                       |
| eslint.config.js     | JavaScript lint configuration                                                                        |
| prisma/migrations/   | Initial SQL migration and SQLite provider lock                                                       |

The database client is constructed once in the entrypoint and injected into the app, so tests supply their own connection. Async Express 5 handlers forward thrown errors to the central handler. Database exceptions during auth lookup remain server errors rather than being mislabeled as invalid credentials.

## Security behavior and limits

- All API responses disable caching and carry a request ID. Password hashes never leave the server. Unexpected errors omit internal details and log only a safe error name and request ID.
- Every mutation requires the exact configured Origin and a matching cookie/header CSRF token with a valid HMAC signature. Fetch `/auth/csrf` first and send its token in `X-CSRF-Token`; cookies must accompany requests. The CSRF cookie is httpOnly because the bootstrap response exposes the token to the intended client.
- Production cookie names use the `__Host-` prefix, Secure, Path=/ and no Domain. Local development uses regular host-only cookie names over HTTP. Logout clears the session cookie with matching attributes. A copied JWT remains valid until expiry; revocation is outside this MVP.
- General API limit: 300 requests per 15 minutes per IP. Register/login share a stricter 20-attempt limit. These are in-memory limits suitable for a single backend instance; multiple instances need a shared store. Production must explicitly configure the trusted proxy count rather than trust arbitrary forwarded headers.
- CORS allows credentials for exactly CLIENT_ORIGIN. Helmet supplies security headers; the body limit is 256 KB. Validators reject unknown profile/account fields and preserve user text rather than trying to strip meaningful characters.
- Optional AI, saved-problem and practice endpoints are scheduled for their own phases. They are not stubbed here.

## Corrections to Phase 0 dependency baseline

The actual package manifests and lockfile are authoritative. Prisma/client are now 6.19.3, Vitest is 4.1.12, express-rate-limit is 8.7.1, and Zod is 4.6.7. The root manifest overrides deepmerge-ts to 8.0.2 to remove a Prisma CLI dependency advisory; client generation, migrations and tests are verified with that override. The original pins had security advisories, so use `npm ci` instead of the historical Phase 0 install commands. Do not run an automatic forced major-version upgrade.

## Interview summary

Passwords are bcrypt hashes, while signed JWTs in httpOnly cookies identify the logged-in user.
Cookie authentication needs CSRF protection as well as CORS, validation and request limits.
Injecting Prisma into the Express app lets integration tests exercise real routes against an isolated migrated database.

Suggested commit: `feat(server): add secure JWT authentication and Prisma integration tests`.
