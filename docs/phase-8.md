# Phase 8 — Optional AI explanations and accessibility polish

Each library/custom-program player now includes an **AI Explain · optional** panel. The original deterministic explanation, variable snapshots, animation, dry-run table and practice features continue to work without an AI key. The feature is off by default. No real provider request was made during development: service tests use controlled responses, and the browser was verified with AI disabled.

## Run and verify without AI

From `C:\coding\dsa project`, use separate terminals:

```powershell
npm run dev:server
```

```powershell
npm run dev:client
```

Open http://localhost:5173/library, run an example and expand **AI Explain · optional**. With a blank key it must report that AI is not configured while preserving the trace. Focus the playback region and press Right/Left, Space and Home; form controls keep their normal keys. Switch the theme from the header and inspect a narrow screen: controls wrap and the code/variable panels stack.

```powershell
npm test
npm run lint
npm run format:check
npm run build
```

## Optional provider configuration

Edit the existing `server/.env` locally; do not overwrite its database/JWT settings or paste secrets into the frontend:

```dotenv
AI_API_KEY=your_private_api_key
AI_API_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-4.1-mini
```

Replace the example key with your own valid key and restart the backend. The model is configurable; the account must have access to it. A configured key does not prove live account access or available API usage. Leave the key blank to keep the app fully non-AI. There is no VITE\_ AI secret and no key entry form in the product.

The integration uses the [official OpenAI Responses API](https://developers.openai.com/api/reference/typescript/resources/responses/methods/create). It sends `store:false` and `max_output_tokens:450`, and reads assistant `output_text` content from completed responses. `store:false` disables response storage for later API retrieval; it is not a claim of zero provider retention. Review the provider's current data controls before sending sensitive work.

## Consent and UI behavior

Only a signed-in user can request an explanation. Before requesting, the user must check consent to send the selected step's variables and recorded explanation to OpenAI through the backend. Library requests also include registry pseudocode. A custom program's full source is omitted unless its separate checkbox is checked. The variable snapshot itself can contain user input or strings; the UI explicitly says not to include secrets.

Consent and response state reset when moving to a different step, preventing an old explanation from appearing beside a new frame. Clicking Explain pauses playback. Availability is fetched once per mounted player rather than on every animation frame. A failed availability check has a retry action. Returned text is rendered as text, not HTML, and labeled AI-generated. It does not change snapshots, scores or saved solutions and can be inaccurate. No request is automatically retried after it reaches the provider.

## API and limits

| Route                   | Access                         | Behavior                              |
| ----------------------- | ------------------------------ | ------------------------------------- |
| GET /api/explain/status | public                         | {enabled,provider}; never reveals key |
| POST /api/explain       | JWT, Origin/CSRF, consent:true | {explanation,provider}                |

Request fields: optional algorithmId, language, optional sourceCode, and step `{type,line,variables,explanation}`. Unknown fields and algorithm IDs are rejected. Step size is at most 12 KB; optional source at most 20 KB; recorded explanation at most 3,000 characters. The server derives library source from the registry rather than trusting a submitted library source.

Requests are limited to six per authenticated user per 15 minutes, on top of general API limits. The application timer aborts after ten seconds. Provider responses are read with a 64 KiB limit and returned explanation text is capped at 8,000 characters. Missing keys return 503, validation 400, provider usage/rate limits 429, unexpected/malformed/incomplete responses 502 and timeouts 504. Provider error bodies and credentials are not forwarded or logged.

The destination is restricted to `https://api.openai.com/v1`; request bodies cannot select URLs, models, tools or token budgets. Redirects are rejected to avoid forwarding the authorization header elsewhere. Prompts label source/comments/variable data as untrusted context and request a short explanation, not execution or tool use. This is a prompt guardrail, not a guarantee against inaccurate or manipulated text. Rate limits use the existing in-memory store: a multi-instance deployment needs shared counters and server-owner usage monitoring.

## Polish and accessibility changes

- Visible focus styles now cover summary, select, textarea and focusable scroll/playback regions.
- Dark-theme comparison text has a brighter color; forced-color styles preserve outlines around active rows and cells. Text labels accompany state colors.
- Disabled navigation uses a not-allowed cursor rather than a misleading loading cursor.
- Activity bars do not animate; existing reduced-motion CSS suppresses visualizer transitions. Playback timing remains user controlled.
- A root error boundary offers reload/home recovery if rendering fails and explains that unsaved editor text may be lost.
- An offline notice explains that loaded traces can be inspected while network-backed saving and AI need connectivity.
- The homepage no longer says practice tracking is a future Phase 7 feature.
- Existing keyboard navigation, skip link, route focus, labeled controls, live status/error text, theme persistence, scrollable tables and responsive layouts are retained.

Browser checks covered keyboard stepping, the AI-off message, a 390×844 dark-mode layout and the restored desktop view. These are targeted manual checks, not a formal WCAG conformance audit or complete screen-reader certification. Live AI output and account/model access remain unverified without a configured real key.

## Files

- `server/src/config.js`: optional AI configuration validation; fixed HTTPS provider destination.
- `server/src/routes/explain.js`: availability, consent, authentication and request validation/limits.
- `server/src/services/explain.js`: bounded Responses API request/response and safe errors.
- `server/test/explain.test.js`: disabled mode, auth/CSRF, consent/size checks, payload privacy, rate limiting, provider failures and timeout tests.
- `client/src/components/AIExplain.jsx`: optional per-step opt-in and response/error display.
- `client/src/components/ErrorBoundary.jsx` and `ConnectionNotice.jsx`: recovery and offline UX.
- `TracePlayer.jsx`, `AppShell.jsx`, `main.jsx`, `styles.css`: feature wiring and accessibility polish.
- `Overview.jsx`, `Workspace.jsx`: current feature copy and non-animated activity chart.

No database migration or new dependency is required in this phase.

## Interview summary

AI is an optional explanation layer; deterministic algorithm snapshots remain the source of truth.
Credentials stay on the server, and consent, size limits, rate limits and timeouts bound provider requests.
Accessibility requires keyboard access, meaningful labels and readable states in addition to visual animation.

Suggested commit: `feat(explain): add opt-in AI step explanations and accessibility polish`.
