# AlgoLens API reference

Base path: `/api`. Development uses `http://localhost:4000/api`; production browser requests use the website's `/api` proxy.

Success responses use `{ "data": ... }`. Errors use `{ "error": { "code": "...", "message": "...", "requestId": "..." } }`, with optional validation `details`. Requests use JSON and cookies. Fetch a CSRF token from `/auth/csrf`, retain its cookie, and send `X-CSRF-Token` with mutations together with the configured website `Origin`. The browser API client handles this flow.

| Method | Route               | Login | Request                                                   | Result / main failures                                                           |
| ------ | ------------------- | ----- | --------------------------------------------------------- | -------------------------------------------------------------------------------- |
| GET    | `/health`           | No    | None                                                      | Database health; 503 if unavailable                                              |
| GET    | `/auth/csrf`        | No    | None                                                      | `csrfToken` and cookie                                                           |
| POST   | `/auth/register`    | No    | `name,email,password,timeZone?`                           | User/session; 400 invalid, 409 email exists                                      |
| POST   | `/auth/login`       | No    | `email,password`                                          | User/session; 401 invalid credentials                                            |
| POST   | `/auth/logout`      | No    | None                                                      | Clears session                                                                   |
| GET    | `/auth/me`          | Yes   | None                                                      | Current user; 401 unauthenticated                                                |
| GET    | `/problems`         | Yes   | Query: `page,limit,status,q,tag`                          | Paginated owner problems                                                         |
| POST   | `/problems`         | Yes   | Problem fields below                                      | Creates problem; 400 invalid                                                     |
| GET    | `/problems/:id`     | Yes   | None                                                      | Owner problem; 404 missing/other owner                                           |
| PATCH  | `/problems/:id`     | Yes   | Changed problem fields                                    | Updated problem; 400 invalid, 404 missing                                        |
| DELETE | `/problems/:id`     | Yes   | None                                                      | Deletes owner problem; 404 missing                                               |
| POST   | `/practice`         | Yes   | `eventId` UUID plus `savedProblemId` and/or `algorithmId` | Log; 201 new, 200 replay, 409 conflicting event                                  |
| GET    | `/practice/summary` | Yes   | None                                                      | Streak/activity and saved/solved counts                                          |
| GET    | `/explain/status`   | No    | None                                                      | Enabled/provider status, never credentials                                       |
| POST   | `/explain`          | Yes   | `consent:true,language,step,algorithmId?,sourceCode?`     | Explanation/provider; 503 disabled, 429 limited, 502 provider error, 504 timeout |

All mutations require CSRF/origin protection. General/auth limits can return 429; malformed JSON returns 400 and oversized JSON 413. Protected routes return 401 without a valid session. Direct production backend routes additionally require the authenticated proxy, except `/health`.

## Problem fields

`title` is required (1–120 characters), `mode` is `library` or `custom`, and `input` is JSON up to 20 KB. Library work requires a known `algorithmId`. Custom work requires `sourceCode` (up to 20 KB) and `language` (`javascript`, `java`, `c`). Optional fields: `visualVariable` (identifier), `tags` (up to 10, each 24 characters), `notes` (up to 5,000 characters) and `status` (`solved` or `revisit`). Unknown fields are rejected. PATCH validates the resulting combined problem.

Example library creation body:

```json
{
  "title": "Bubble sort practice",
  "mode": "library",
  "algorithmId": "bubble-sort",
  "input": { "values": [8, 3, 1] },
  "tags": ["sorting"],
  "notes": "Watch adjacent swaps",
  "status": "revisit"
}
```

Saved work persists inputs/source and metadata, rather than an entire generated trace. Practice dates use the account time zone. Reuse the same event UUID only when retrying the same practice action; conflicting payloads return 409.

AI step fields are `type,line,variables,explanation`. The server validates size and algorithm IDs, derives trusted library source from the registry, and forwards only the approved context. Live AI availability is not verified without a real key; tests mock the provider.

Profile updates: authenticated `PATCH /auth/me` accepts the permitted profile fields `name` and `timeZone`; email/password updates are not supported by this endpoint.
