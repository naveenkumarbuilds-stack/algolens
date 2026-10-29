# Phase 3 — Algorithm step generators

All 17 library generators are implemented as pure functions. They accept a bounded input object and return `{ steps, result }`. They do not call the backend, modify input, access the DOM, or animate anything. Phase 4 will consume these traces for playback; Phase 5 will provide the interactive library. The current library information page reflects this milestone.

## Install and verify

From `C:\coding\dsa project`:

```powershell
npm ci
npm run test -w client
npm test
npm run lint
npm run format:check
npm run build
```

The frontend tests run without starting the API. The root test command also runs the existing auth tests against a disposable SQLite database. If running from a fresh checkout, follow Phase 1's setup/client-generation commands first. API integration tests need local loopback access.

To launch the existing UI, use separate terminals:

```powershell
npm run dev:server
```

```powershell
npm run dev:client
```

The visible algorithm animations are intentionally scheduled for Phase 4; Phase 3 can be verified directly through the automated tests and returned trace data.

## Public interface

Use this code inside a client module (Vite resolves the module imports):

```js
import { algorithms, getAlgorithm, generateTrace } from './algorithms/registry';

const metadata = getAlgorithm('bubble-sort');
const { steps, result } = generateTrace('bubble-sort', { values: [5, 3, 1] });
console.log(result); // [1, 3, 5]
console.log(steps[0].view.values); // [5, 3, 1]
console.log(steps[1].explanation); // Compare arr[0]=5 with arr[1]=3.
console.log(metadata.sourceLanguage); // pseudocode
console.log(algorithms.length); // 17
```

`generateTrace` is the application entrypoint; it validates the root object and algorithm ID before calling the algorithm-specific validator. Invalid input or a trace that exceeds resource limits throws `AlgorithmInputError` with a readable message. Consumers must catch this error and show it beside the input editor. No partial trace is returned after failure.

Registry entries contain `id`, `name`, `category`, `generate`, `complexity`, `source`, `sourceLanguage`, `example` and `inputGuide`. Sources are explicitly labeled pseudocode. Each non-synthetic step's one-based `line` maps to that exact displayed pseudocode. Generators record selected meaningful operations, not every JavaScript instruction. Initial and complete steps use `line: null`.

## Algorithms and input/output contracts

| ID             | Input                                                                | Result                                                   |
| -------------- | -------------------------------------------------------------------- | -------------------------------------------------------- |
| bubble-sort    | `{values:[5,3,1]}`                                                   | ascending numeric array; adjacent swaps, early exit      |
| selection-sort | `{values:[5,3,1]}`                                                   | ascending array; select minimum and swap                 |
| insertion-sort | `{values:[5,3,1]}`                                                   | ascending array; save key, shift and insert              |
| merge-sort     | `{values:[5,3,1]}`                                                   | ascending array; stable buffered merging                 |
| quick-sort     | `{values:[5,3,1]}`                                                   | ascending array; Lomuto-style last-element pivot         |
| linear-search  | `{values:[5,3,1],target:3}`                                          | first matching index or `-1`                             |
| binary-search  | `{values:[1,3,5],target:3}`                                          | any matching index or `-1`; rejects unsorted input       |
| bfs            | `{nodes,edges,start}`                                                | reachable visit order; input edge order breaks ties      |
| dfs            | `{nodes,edges,start}`                                                | recursive reachable visit order and call-stack snapshots |
| dijkstra       | `{nodes,edges,start}`                                                | `{distances,previous}` with predecessor node IDs         |
| fibonacci      | `{n:8}`                                                              | `21`; base cases F(0)=0 and F(1)=1                       |
| knapsack       | `{weights:[2,3],values:[4,5],capacity:5}`                            | `{maxValue:9,items:[0,1]}`; item indices are zero-based  |
| lcs            | `{a:'ABC',b:'AC'}`                                                   | `{length:2,sequence:'AC'}`                               |
| stack          | `{values:[],operations:[{type:'push',value:4},{type:'pop'}]}`        | `{values:[],outputs:[{operation:'pop',value:4}]}`        |
| queue          | `{values:[],operations:[{type:'enqueue',value:4},{type:'dequeue'}]}` | `{values:[],outputs:[{operation:'dequeue',value:4}]}`    |
| bst-insert     | `{values:[8,3,10]}`                                                  | `{root:'n0',values:[8,3,10]}` in unique insertion order  |
| bst-search     | `{values:[8,3,10],target:3}`                                         | `{found:true,nodeId:'n1'}`; includes construction steps  |

Example graph:

```json
{
  "nodes": ["A", "B", "C", "X"],
  "edges": [
    { "from": "A", "to": "B", "weight": 4 },
    { "from": "A", "to": "C", "weight": 1 },
    { "from": "C", "to": "B", "weight": 2, "directed": true }
  ],
  "start": "A"
}
```

Edges default to undirected with weight 1; the normalized view gives each an `e0`, `e1`, ... ID. BFS/DFS ignore weights. Dijkstra rejects negative weights, permits zero weights and parallel edges, and reports unreachable distance as the JSON-safe string `"Infinity"`. Unreachable predecessors are null. Node IDs permit 1–24 letters, digits, underscores and hyphens, including names such as `constructor`; Maps avoid object-prototype collisions internally. Empty graphs are invalid because there is no valid start; a single isolated start is valid.

Stack/queue `peek` returns without removal; removal or peek on an empty structure produces null. Push/enqueue produce steps but no output entry. The arrays depict bottom-to-top for stack and front-to-back for queue. Removing the last element has no highlight because the removed index no longer exists in the post-operation view.

BSTs ignore duplicate keys. Each node has a stable `n0`, `n1`, ... ID and numeric text label. Directed child edges use `parentId:left` or `parentId:right`; Phase 4 can position children unambiguously without changing the shared schema. These are unbalanced trees: sorted insertion can produce a chain.

Knapsack uses positive integer weights and non-negative finite values. Ties prefer skipping, so multiple optimal solutions have deterministic reconstruction. LCS operates on Unicode code points, not UTF-16 code units or user-perceived grapheme clusters. Its backtracking ties prefer upward movement; it returns one of potentially several longest common subsequences.

## Snapshot and resource rules

- All emitted steps conform to `docs/step.schema.json`. Snapshot objects, nested arrays/objects, result data and the final trace are deeply frozen; each emitted step is a separate structured clone.
- A step records post-operation state. Comparisons leave the data unchanged. Insertion sort temporarily duplicates a shifted value while the saved key lives in `variables`. Merge comparisons read buffered values shown in `variables`, so they do not misleadingly highlight overwritten array slots.
- Array/structure highlights use string indices. DP cells use `row:column`. Graph/tree highlights use node or edge IDs that actually exist in that snapshot.
- Array inputs are at most 64 values. Numeric inputs are finite and within [-1e9,1e9]. Graphs cap at 30 nodes and 100 edges. Structures accept at most 100 operations and never exceed 64 elements. BST input caps at 30 values.
- Fibonacci n is 0–78 to preserve safe integer precision. Knapsack has at most 30 items, capacity 0–100 and at most 2,500 table cells. LCS strings have at most 49 code points each. Each DP snapshot includes labels and the full table.
- Library traces cap at 20,000 steps and 16 MiB of cumulative serialized snapshot bytes. Larger cases fail explicitly and ask for smaller input. This differs from custom code's planned 2,000-step cap. The serialized-size limit bounds retained trace data; it is not a hard browser-process memory limit.

The complexity panel's metadata describes the core algorithm, excluding input copying, validation, tracing, snapshot freezing and JSON byte counting. Those educational features add meaningful time and memory: full-array snapshots can require O(steps × n), and table snapshots O(steps × rows × columns). The recorder enforces limits to keep that cost bounded.

BFS uses a small array queue with `shift`, and the metadata explicitly acknowledges potential O(V²) shifting overhead. Dijkstra uses a simple linear scan, O(V²+E), rather than claiming heap-based performance. Merge sort includes buffer/call-stack space. Quick sort and BST metadata include degenerate worst cases. Queue dequeue is honestly labeled O(n) for this array implementation.

## Files

| Path under client/src/algorithms/ | Contents                                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------------- |
| core.js                           | Typed input errors, numeric/collection validation, highlight helper, bounded immutable recorder |
| sorting.js                        | Five sorting generators                                                                         |
| searching.js                      | Linear and binary search                                                                        |
| graphs.js                         | Normalization, adjacency construction, BFS, DFS and Dijkstra                                    |
| dp.js                             | Fibonacci, knapsack with reconstruction, Unicode LCS with reconstruction                        |
| structures.js                     | Stack/queue operation traces and BST insertion/search                                           |
| registry.js                       | Public dispatch API, all 17 metadata entries, displayed pseudocode and example inputs           |
| algorithms.test.js                | Schema, snapshot, validation and algorithm correctness checks                                   |

## Test evidence

58 algorithm tests plus five existing client API tests exercise:

- Every registry example against the shared JSON Schema, line bounds, contiguous step indices, valid highlight references, DP dimensions, graph endpoint/ID validity, immutability, deterministic output, JSON round trips and input preservation.
- All 121 arrays of length 0–4 over {-1,0,1}, plus fractional and 64-element reversed arrays, for each sorter. Swap steps preserve the input multiset. Already sorted bubble input stops early.
- Empty, singleton, repeated, absent and boundary search cases.
- Cycles, direction, isolated nodes, self-loops, parallel/zero-weight edges and prototype-like node IDs; Dijkstra compared with an independent Bellman-Ford reference on 20 graphs.
- Fibonacci boundaries, knapsack against exhaustive subsets on 20 inputs, reconstruction feasibility, empty inputs, LCS subsequence validity and Unicode.
- LIFO/FIFO order, non-destructive peek, underflow/overflow, BST subtree ordering, child-side IDs, duplicates and skewed/empty searches.
- Invalid numbers, dimensions, IDs, endpoints, negative Dijkstra weights, operation types and oversized traces.

## Interview summary

Each generator returns immutable snapshots through one shared contract, so playback can move backward safely.
I test results against independent references and validate intermediate snapshots, rather than checking only the final answer.
Complexities describe the core algorithms; recording full educational traces adds bounded time and memory overhead.

Suggested commit: `feat(algorithms): add 17 immutable step generators with correctness tests`.
