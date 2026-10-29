# AlgoLens portfolio package

Use these drafts after you can demonstrate the features yourself. They describe implemented scope without claiming public users, speedups or an online release.

## Three resume bullets

- Built AlgoLens, a React and Express learning application visualizing 17 algorithms across sorting, searching, graphs, dynamic programming and data structures through synchronized animation and dry-run snapshots.
- Implemented a restricted JavaScript, Java and C teaching interpreter in a Web Worker with a 2,000-snapshot cap, cancellation and a two-second parent timeout, enabling variable tracing without executing submitted code as host JavaScript.
- Developed cookie-based JWT authentication, owner-scoped saved problems and time-zone-aware practice tracking; validated the application with 149 automated tests and prepared separate SQLite/PostgreSQL migrations and deployment CI.

## Ten interview questions and model answers

### 1. How is the application organized?

React handles input, playback and visualization. Pure library generators and the custom Worker produce a shared step contract. Express handles authentication and persistence through Prisma. SQLite supports local development; PostgreSQL is configured for deployment. In production a Vercel proxy forwards API requests to Render.

### 2. Why use a shared step format?

A snapshot includes the current line, variables, highlights and explanation. Renderers and the dry-run table read the same selected step, keeping views synchronized. New generators can reuse playback if they satisfy the schema and supply a supported visual representation.

### 3. How do login and logout work?

The server validates input, hashes passwords with bcrypt and issues a JWT in an httpOnly cookie. Middleware verifies the session and loads its user. Logout clears the cookie; it does not centrally revoke every previously issued token. A production revocation requirement would need additional session/version tracking.

### 4. Does an httpOnly cookie prevent CSRF?

No. Browsers attach cookies automatically. Mutations also require an allowed origin and a signed CSRF token, while secure production cookies protect transport. httpOnly prevents ordinary page JavaScript from reading the session cookie; it does not remove every XSS risk.

### 5. How is submitted code restricted?

A custom parser/interpreter accepts a teaching subset and exposes only approved operations. It runs inside a terminable Worker with bounded snapshots and resource guards. It never uses eval to run user code. A Worker alone is not a security boundary: avoiding access to host networking and system capabilities comes from the interpreter. This is not OS-level isolation or full Java/C compatibility.

### 6. How do you prevent old runs from replacing new results?

Worker requests have run IDs, and only the active run can supply results. Editing input, stopping or leaving the page terminates the Worker. The parent also enforces a timeout. This addresses stale asynchronous results as well as runaway teaching programs.

### 7. How does step backward work?

The trace is retained as snapshots. React playback state selects an index, so stepping backward selects an earlier snapshot without reversing mutations. Authentication uses Context; playback uses React state/hooks. Timers are cleaned up when playback changes or the component unmounts.

### 8. Is visualized bubble sort still O(n²)?

The sorting algorithm is O(n²) in its worst case. Capturing copies and retaining steps adds time and memory beyond that algorithmic bound. I distinguish textbook complexity from the visualizer's instrumentation costs and limit inputs and trace size to keep the learning interface responsive.

### 9. How do you protect another user's saved problems?

The server takes the owner from the authenticated session rather than a submitted user ID. Queries include that owner, including updates and deletion. Missing and foreign records return 404. Practice events also have a per-user unique event ID so retries do not inflate activity counts.

### 10. What is tested, and what remains unverified?

Tests cover generator results and schema contracts, interpreter restrictions, Worker cancellation, authentication, ownership, practice aggregation, mocked AI and proxy behavior. The local baseline is 149 passing tests plus lint, formatting and build checks. The PostgreSQL CI job and real hosting still need an external run. Live AI, a full accessibility audit, load testing and native-language execution are not established by this suite.

## Two-minute demo script

### 0:00–0:20 — Introduce the problem

“Students often see an algorithm's final output but struggle to follow how its variables change. AlgoLens connects the code, animation and dry-run table so each step is visible.” Open the library and mention its 17 algorithms.

### 0:20–0:50 — Show a library trace

Choose bubble sort with a short array. Play, pause, step forward and backward, then point to a comparison, the corresponding source line and the variable snapshot. Explain that the complexity panel describes the algorithm, while snapshot recording adds overhead.

### 0:50–1:20 — Show a custom program

Open Custom Code and upload the supplied `Main.java` example. Run it, select a variable and inspect changes. Say: “This uses a restricted teaching interpreter inside a Worker, not a native Java compiler. Input limits and termination keep supported programs bounded.”

### 1:20–1:45 — Show persistence

With a prepared demo account, save a problem with a tag and note. Open the dashboard, reopen the saved work and point out solved/revisit status and the activity chart. Use existing activity honestly; do not present seeded or single-session activity as real adoption.

### 1:45–2:00 — Close with engineering decisions

“The project has 149 automated tests and a shared snapshot contract. Authentication and persistence live on the server. Deployment files are prepared for Vercel, Render and PostgreSQL; public hosting verification is still pending.” Mention AI is optional and off without a key.

Before recording: start both local services, prepare a demo account, check the example runs and close tabs containing credentials.

## LinkedIn post draft

I built AlgoLens to make algorithm dry runs easier to follow.

The app brings together 17 classic algorithms, step-by-step animation, variable snapshots and a dry-run table. Students can also upload supported JavaScript, Java or C teaching programs and inspect how selected variables change.

Building it taught me how to design a shared trace format, manage Worker cancellation, protect cookie-based authentication and scope saved work to its owner. The project includes a practice dashboard and 149 automated tests.

Stack: React, Vite, Tailwind CSS, Express, Prisma and SQLite locally, with PostgreSQL deployment configuration prepared.

The custom-code mode is intentionally a restricted interpreter rather than a full compiler. My next milestone is verifying the hosted deployment and PostgreSQL CI run.

I'd welcome feedback on which explanations or algorithm views would help students most.

#WebDevelopment #React #NodeJS #DataStructures #LearningInPublic

Add your real repository and demo links only after they exist and you have checked them. No public link is available yet.

## Ten stretch features

1. Native Java/C execution in isolated server containers with CPU, memory and network limits.
2. Shareable read-only traces with explicit privacy controls.
3. Side-by-side algorithm comparison on identical input.
4. Breakpoints and conditional variable watches.
5. Exportable trace reports and downloadable animations.
6. Additional algorithms such as topological sort and union-find.
7. Teacher-created exercises and automated expected-output checks.
8. Shared rate-limit storage and centralized session revocation.
9. Screen-reader usability studies and a formal accessibility review.
10. Offline lesson caching with clear account-data synchronization rules.
