# Phase 7 — Saved problems and practice dashboard

Logged-in users can save library traces and custom programs with a title, tags, notes and solved/revisit status. The dashboard loads real account data: current/longest streak, completions, solved totals and a Recharts weekly activity chart. All saved data is stored through Prisma; there are no invented practice counts.

## Run

From `C:\coding\dsa project`, apply the new migration before starting the backend:

```powershell
npm ci
npm run db:generate -w server
npm run db:deploy -w server
npm run dev:server
```

In another terminal:

```powershell
npm run dev:client
```

Open http://localhost:5173/dashboard and sign in. Run an algorithm or custom program, then expand **Save to My Problems**. Save with a title, comma-separated tags, optional notes and status. Revisit saves do not record a practice; saving as solved does.

The new migration adds nullable `language` and an empty-default `visualVariable` to SavedProblem, preserving existing records. Java/C programs retain the language, source, chosen array variable and JSON input so they can be reopened. The Phase 6 teaching-subset limitations remain unchanged.

## Dashboard actions

- Search titles/notes, filter by exact tag or solved/revisit status, and browse ten problems per page.
- Edit title, tags and notes. Tags are normalized to lowercase and deduplicated, at most ten tags of 24 characters.
- Mark a problem solved or for revisit. A transition into solved records one completion in the same database transaction. Repeating the same solved update does not record again; marking revisit then solved is a new completion.
- Record a practice explicitly, including another review of an already solved problem. This is self-reported practice, not automatic proof that a solution is correct.
- Open and rerun a problem: the appropriate library/program editor receives saved input and source without automatically executing it.
- Delete a problem through a two-step confirmation in the UI. Its practice history remains; the optional problem relation becomes null.

For library playback, **Record completed practice** enables at the final step. Its event ID remains stable while rewinding/replaying the same run so the request is retry-safe; running the generator again creates a new run. Custom programs can be saved as solved or logged again from their dashboard card. Saving as solved and separately recording the same run are two explicit completions; use either action for one completion.

## Calendar rules

The server determines the current date using the user's IANA timezone. Clients cannot submit arbitrary practice dates. Each log stores its date and timezone, and later timezone changes do not rewrite historical logs.

Multiple completions on a date raise that day's chart count but represent one streak day. The current streak may end today or yesterday, giving the user the rest of today to continue it. If the last practice was earlier, current streak is zero. The longest streak scans distinct consecutive calendar dates. Weekly activity contains today plus the preceding six local dates, including zeros. No activity produces zero streaks and an empty chart with a helpful message. A textual daily-count list accompanies the chart.

## API additions

All paths begin `/api`; all routes require authentication and mutations also require Origin/CSRF checks. Error responses keep the existing envelope. Owner-scoped lookups return 404 for foreign records.

| Method / path         | Request / query                                                                                  | Response                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| GET /problems         | page, limit (max 50), status?, q?, tag?                                                          | {items,total,page,limit}                                                                        |
| POST /problems        | title, mode, input, tags?, notes?, status?, algorithmId? or sourceCode/language, visualVariable? | 201 {problem}                                                                                   |
| GET /problems/:id     | —                                                                                                | {problem}                                                                                       |
| PATCH /problems/:id   | subset of create fields; resulting record must validate                                          | {problem}                                                                                       |
| DELETE /problems/:id  | —                                                                                                | {deleted:true}                                                                                  |
| POST /practice        | UUID eventId and savedProblemId or algorithmId                                                   | 201 {log}; 200 for identical retry; 409 for conflicting event reuse                             |
| GET /practice/summary | —                                                                                                | currentStreak,longestStreak,totalPractices,weeklyActivity,totalProblems,solvedProblems,timeZone |

Library input is validated using the existing pure generator before storage. Custom source is bounded and stored as text; it is never executed by Express. JSON input is capped at 20 KB, source at 20 KB, notes at 5,000 characters, titles at 120 characters. Unknown fields such as userId and practiceDate are rejected. Partial updates preserve omitted fields, including fields that have defaults on creation. Practice ownership and solved-status logging are transactional. A per-user event uniqueness constraint prevents duplicate practice insertion, with a matching-response path for uniqueness races.

## Files and architecture notes

- `server/src/routes/problems.js`: validated owner-scoped problem and practice routes.
- `server/src/services/practice.js`: timezone date keys, calendar arithmetic, streaks and weekly aggregation.
- `server/prisma/schema.prisma` and the second migration: custom language/visual variable persistence.
- `server/vitest.config.js`: sequential integration test files against one disposable database.
- `server/test/problems.test.js`: persistence, ownership, validation, retry, solved transition and timezone/streak tests.
- `client/src/components/SaveProblem.jsx`: reusable save form attached to successful runs.
- `client/src/components/PracticeButton.jsx`: completion logging from final library frames.
- `client/src/pages/Workspace.jsx`: dashboard, chart, filtering, editing and saved-item actions.
- `client/src/pages/Library.jsx` and `CustomCode.jsx`: save/reopen integration.
- `client/src/App.jsx`: dashboard/chart code is loaded on demand.

The server imports the pure algorithm registry from `client/src/algorithms` to validate library input without duplicating its rules. Imports now use explicit `.js` extensions so both Node and Vite can resolve them. Deploy the monorepo as a whole; do not package the server directory without these shared pure modules. Chart code is lazy-loaded with the dashboard so guests do not download it for the library. Recharts is pinned to 3.10.1 in the lockfile.

Current scaling limit: streak summaries scan this user's practice dates in memory; this is suitable for the portfolio MVP. A high-volume deployment should aggregate distinct dates/counts in the database and use a shared rate-limit store. This phase retains the existing single-instance in-memory rate limits.

## Verification

```powershell
npm test
npm run lint
npm run format:check
npm run build
```

Test coverage includes normalized persistence, exact tags, partial-edit preservation, foreign-owner read/update/delete/log rejection, custom-language round trips, transactional solved logging, repeat-solved idempotency, immutable practice history after deletion, practice event retry/conflict, server-derived dates, input/field limits and auth/CSRF. Calendar tests cover India midnight, a DST date, leap-day arithmetic, missed days, duplicate completions and zero-filled weekly data. Existing auth, generator, playback and interpreter tests remain enabled.

## Interview summary

Every database lookup is scoped to the authenticated user; the browser never chooses a record's owner.
Unique practice event IDs prevent retry duplication, while transactions keep solved status and completion logging together.
Streaks use distinct local calendar dates, so several practices on one day increase activity without inflating the streak.

Suggested commit: `feat(practice): persist saved problems and add timezone-aware practice dashboard`.
