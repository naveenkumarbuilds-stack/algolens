# Phase 4 — Visualizers and playback

The library now displays array bars, stack/queue states, SVG graphs/trees and DP tables. Run any algorithm at `/library`, then use Play/Pause, Back, Next, Reset, a seek slider and adjustable step duration (100–2,000 ms). Replay at the end starts again from the beginning. Manual navigation pauses playback. Editing input, choosing a different algorithm or leaving the page discards the old player and cancels its timer.

## Run and test

```powershell
# Terminal 1, project root
npm run dev:server
# Terminal 2, project root
npm run dev:client
```

Open http://localhost:5173/library, run Bubble sort and step through its comparisons/swaps. Try BFS for visited nodes, BST insertion for stable left/right children, and Fibonacci or knapsack for table updates. Zero values have a minimum visible bar height; negative values have striped magnitude bars and signed labels.

```powershell
npm test
npm run lint
npm run format:check
npm run build
```

Keyboard: focus the playback section, then Space toggles playback, Left/Right step and Home resets. Keys in controls/editors keep their normal behavior. Labels, focus outlines, captions, text explanations and a legend accompany the highlights. Reduced-motion preferences remove transitions; automatic state changes still follow the selected timer. Paused steps are announced politely, while playback avoids announcing every frame.

## Implementation

- `client/src/components/visualizer/playback.js`: pure reducer for bounded state transitions.
- `TracePlayer.jsx`: one cleanup-managed timeout, playback controls, current pseudocode line, explanations, variable watch, seekable dry-run rows and final result.
- `Views.jsx`: array/stack/queue, graph/tree SVG and accessible DP tables. Tree positions use the completed topology for stable insertion positions; only nodes/edges present at the current step appear. Left/right edge IDs determine child placement. Graph node positions are deterministic circles, and visited state is recomputed up to the selected frame so rewinding is correct.
- `playback.test.js`: navigation, pause/end/replay, speed bounds, stale ticks and tree layout invariants.
- `layout.js`: deterministic graph coordinates and in-order tree placement shared by the renderer and tests.
- `Library.jsx`: mounts a new player per input/run and connects all 17 generators.

Playback state is local React `useReducer` state, within the project's allowed Context/state approach. A shared global store is unnecessary while only one trace player is mounted. Trace data remains immutable, and every displayed view derives from the current snapshot. Variables differ by operation; a variable absent from a particular snapshot says “not recorded” rather than falsely retaining a previous value.

Variable watch selects any top-level variable recorded by the generator. It highlights values that differ from the previous frame and filters the dry-run table to the chosen variable. Nested arrays/objects remain inspectable as JSON. This phase traces built-in algorithm variables; arbitrary user-program variables require instrumentation in Phase 6. Table and graph regions scroll for larger inputs. Parallel graph edges may overlap in the circular layout; algorithm explanations and variable snapshots retain their full data.

## Java and C — scope update for Phase 6

The custom-program feature must support Java and C alongside JavaScript, including file upload, input, animation playback and selected variable tracing. Java/C cannot run in the planned JavaScript interpreter. They require an isolated compiler/runner service with no network, CPU/wall/memory/process/output limits and disposable execution state. Never execute uploaded code inside the Express application process. Compiler-backed tracing/instrumentation must produce the shared Step contract; compilation and stdout alone do not constitute variable tracing. Before Phase 6 implementation, verify a suitable execution service and its actual free-tier availability, credentials and language support. If unavailable, report the concrete limitation rather than claiming Java/C execution works. No Java/C execution or upload is implemented in Phase 4.

## Interview summary

The visualizers render immutable snapshots, so moving backward is just choosing an earlier index.
A reducer controls playback, and one cleanup-managed timer prevents overlapping animation loops.
Variable history and line highlights connect visual changes to the algorithm's recorded operations.

Suggested commit: `feat(visualizer): animate library traces with playback and variable watch`.
