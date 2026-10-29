import { object, requireInput } from './core.js';
import { bubbleSort, selectionSort, insertionSort, mergeSort, quickSort } from './sorting.js';
import { linearSearch, binarySearch } from './searching.js';
import { bfs, dfs, dijkstra } from './graphs.js';
import { fibonacci, knapsack, lcs } from './dp.js';
import { stack, queue, bstInsert, bstSearch } from './structures.js';

// Displayed pseudocode has deliberately stable, one-based lines for dry-run highlighting.
function entry(id, name, category, generate, time, space, note, source, example, inputGuide) {
  return Object.freeze({
    id,
    name,
    category,
    generate,
    complexity: Object.freeze({ time, space, note }),
    source,
    sourceLanguage: 'pseudocode',
    example,
    inputGuide,
  });
}
const array = { values: [8, 3, 5, 1, 4] };
const graph = {
  nodes: ['A', 'B', 'C', 'D'],
  edges: [
    { from: 'A', to: 'B', weight: 4 },
    { from: 'A', to: 'C', weight: 1 },
    { from: 'C', to: 'B', weight: 2 },
    { from: 'B', to: 'D', weight: 1 },
  ],
  start: 'A',
};
const arrayGuide = 'values: up to 64 finite numbers in [-1e9, 1e9].';
const graphGuide =
  'nodes: 1–30 unique short IDs; edges: up to 100 {from,to,weight?,directed?}; start: node ID. Weights default to 1; edges default to undirected. Neighbor order follows edge input order. Only reachable nodes are traversed.';
const bstSource =
  'for each insertion value (ignore duplicate keys):\n  compare value with current node and choose left/right\n  insert at the first empty child, or create the root\nfor search: begin at the completed root\n  compare target; return match or follow left/right until empty';

export const algorithms = Object.freeze([
  entry(
    'bubble-sort',
    'Bubble sort',
    'Sorting',
    bubbleSort,
    'Best O(n); average/worst O(n²)',
    'O(1)',
    'Useful for learning adjacent swaps; early exit helps already sorted input.',
    'for end from n-1 down to 1:\n  set swapped=false; loop j from 0 to end-1\n    compare arr[j] with arr[j+1]\n    if out of order: swap neighbors; swapped=true\n  if not swapped: stop',
    array,
    arrayGuide,
  ),
  entry(
    'selection-sort',
    'Selection sort',
    'Sorting',
    selectionSort,
    'Best/average/worst O(n²)',
    'O(1)',
    'Useful when minimizing writes matters; generally not stable.',
    'for i from 0 to n-2:\n  set min=i; scan j from i+1 to n-1\n    compare arr[j] with arr[min]\n    if smaller: min=j\n  swap arr[i] and arr[min] when different',
    array,
    arrayGuide,
  ),
  entry(
    'insertion-sort',
    'Insertion sort',
    'Sorting',
    insertionSort,
    'Best O(n); average/worst O(n²)',
    'O(1)',
    'Stable and effective for small or nearly sorted arrays.',
    'for i from 1 to n-1:\n  save key=arr[i]; set j=i-1\n  while j>=0: compare arr[j] with key; stop if <=\n    shift arr[j] right; decrement j\n  write key to arr[j+1]',
    array,
    arrayGuide,
  ),
  entry(
    'merge-sort',
    'Merge sort',
    'Sorting',
    mergeSort,
    'Best/average/worst O(n log n)',
    'O(n) buffers + O(log n) call stack',
    'Stable sorting with predictable running time and extra memory.',
    'sort(lo, hi): return when range has fewer than 2 values\n  split at mid; recursively sort both halves\n  copy sorted halves to left/right buffers\n  compare the next buffered candidates when both exist\n  write the smaller candidate; repeat until both buffers are exhausted',
    array,
    arrayGuide,
  ),
  entry(
    'quick-sort',
    'Quick sort',
    'Sorting',
    quickSort,
    'Best/average O(n log n); worst O(n²)',
    'Average O(log n); worst O(n) call stack',
    'In-place partitioning; this last-element pivot performs poorly on sorted or equal values.',
    'sort(lo, hi): return if lo>=hi; pivot=arr[hi]; i=lo\n  for j from lo to hi-1:\n    compare arr[j] with pivot\n    if <= pivot: swap arr[i],arr[j]; increment i\n  swap pivot into i; recursively sort both partitions',
    array,
    arrayGuide,
  ),
  entry(
    'linear-search',
    'Linear search',
    'Searching',
    linearSearch,
    'Best O(1); average/worst O(n)',
    'O(1)',
    'Works without sorting; returns the first match, or -1.',
    'for each index i:\n  compare arr[i] with target\n  if equal: return i\nreturn -1 when the array is exhausted',
    { ...array, target: 5 },
    `${arrayGuide} target: finite number.`,
  ),
  entry(
    'binary-search',
    'Binary search',
    'Searching',
    binarySearch,
    'Best O(1); average/worst O(log n)',
    'O(1)',
    'Fast lookup on sorted arrays; returns any matching index, or -1.',
    'set low=0, high=n-1\nwhile low<=high: mid=floor((low+high)/2)\n  compare arr[mid] with target\n  if equal: return mid\n  if smaller: low=mid+1; otherwise high=mid-1',
    { values: [1, 3, 4, 5, 8], target: 5 },
    `${arrayGuide} Must be sorted ascending; target is finite.`,
  ),
  entry(
    'bfs',
    'Breadth-first search',
    'Graphs',
    bfs,
    'O(V+E) with an efficient queue; this small-array queue can add O(V²)',
    'O(V+E) adjacency + O(V) traversal',
    'Find reachable nodes by increasing unweighted distance. Discovery prevents repeated enqueues.',
    'queue=[start]; mark start discovered\nwhile queue is not empty:\n  dequeue node and append it to visit order\n  for each neighbor: check discovery state\n    if undiscovered: mark discovered and enqueue',
    graph,
    graphGuide,
  ),
  entry(
    'dfs',
    'Depth-first search',
    'Graphs',
    dfs,
    'O(V+E)',
    'O(V+E) adjacency + O(V) call stack',
    'Explore a branch fully before backtracking; useful for reachability.',
    'visit(node):\n  mark visited; append to order; push call stack\n  for each neighbor: check visited state\n    if unvisited: visit(neighbor)\n  pop call stack and return',
    graph,
    graphGuide,
  ),
  entry(
    'dijkstra',
    'Dijkstra’s shortest paths',
    'Graphs',
    dijkstra,
    'O(V²+E), linear-scan implementation',
    'O(V+E)',
    'Shortest weighted paths with non-negative weights; stores predecessor links.',
    'distance[start]=0; other distances=Infinity\nrepeat until no reachable unsettled node remains:\n  select and settle the unsettled node with minimum distance\n  for each edge: compare distance[current]+weight with distance[to]\n    if improved and unsettled: update distance and predecessor',
    graph,
    `${graphGuide} Negative weights are rejected. Unreachable distances are the string "Infinity".`,
  ),
  entry(
    'fibonacci',
    'Fibonacci',
    'Dynamic programming',
    fibonacci,
    'O(n)',
    'O(n) table',
    'A simple introduction to reusing previous answers; F(0)=0, F(1)=1.',
    'initialize F(0)=0 and F(1)=1 when present\nfor i from 2 to n:\n  F(i)=F(i-1)+F(i-2)\nreturn F(n)',
    { n: 8 },
    'n: integer 0–78 (keeps results within safe integer precision).',
  ),
  entry(
    'knapsack',
    '0/1 knapsack',
    'Dynamic programming',
    knapsack,
    'O(nW)',
    'O(nW)',
    'Choose each item at most once within an integer capacity. Backtracking returns item indices; ties prefer skipping.',
    'initialize an (n+1) by (W+1) zero table\nfor each item row i and capacity w:\n  best[i][w]=max(skip, take if item fits)\nstart backtracking at (n,W)\n  if row differs from previous: select item and subtract weight',
    { weights: [2, 3, 4], values: [4, 5, 7], capacity: 5 },
    'weights: 1–100 integers; values: non-negative numbers; equal lengths up to 30; capacity: integer 0–100; at most 2,500 DP cells.',
  ),
  entry(
    'lcs',
    'Longest common subsequence',
    'Dynamic programming',
    lcs,
    'O(mn)',
    'O(mn)',
    'Find ordered shared characters without requiring adjacency; ties backtrack upward. Uses Unicode code points.',
    'initialize an (m+1) by (n+1) zero table\nfor each pair of character positions i,j:\n  if equal: diagonal+1; otherwise max(top,left)\nstart backtracking at (m,n)\n  collect matches; otherwise move toward a maximum; reverse matches',
    { a: 'ABCBDAB', b: 'BDCABA' },
    'a, b: strings of at most 49 Unicode code points each.',
  ),
  entry(
    'stack',
    'Stack operations',
    'Data structures',
    stack,
    'Push/pop/peek O(1); sequence O(k)',
    'O(n) storage',
    'Last in, first out: useful for undo and nested processing.',
    'for each operation:\n  push: append value to top\n  pop: remove and return top, or null if empty\n  peek: return top without removing, or null if empty',
    { values: [2, 4], operations: [{ type: 'push', value: 6 }, { type: 'peek' }, { type: 'pop' }] },
    'values: up to 64 numbers; operations: up to 100 push/pop/peek objects; push requires value. At most 64 elements at any time.',
  ),
  entry(
    'queue',
    'Queue operations',
    'Data structures',
    queue,
    'Enqueue/peek O(1); dequeue O(n) for this array implementation',
    'O(n) storage',
    'First in, first out: useful for scheduling; a ring buffer avoids array shifting for larger queues.',
    'for each operation:\n  enqueue: append value at rear\n  dequeue: remove and return front, or null if empty\n  peek: return front without removing, or null if empty',
    {
      values: [2, 4],
      operations: [{ type: 'enqueue', value: 6 }, { type: 'peek' }, { type: 'dequeue' }],
    },
    'values: up to 64 numbers; operations: up to 100 enqueue/dequeue/peek objects; enqueue requires value. At most 64 elements at any time.',
  ),
  entry(
    'bst-insert',
    'BST insertion',
    'Data structures',
    bstInsert,
    'Each insert O(h); total average O(n log n), worst O(n²)',
    'O(n) tree',
    'Maintain ordered keys in an unbalanced tree. Duplicate values are ignored; no balancing guarantee.',
    bstSource,
    { values: [8, 3, 10, 1, 6] },
    'values: up to 30 numbers, inserted in order. Edge IDs use parentId:left or parentId:right for stable child placement.',
  ),
  entry(
    'bst-search',
    'BST search',
    'Data structures',
    bstSearch,
    'Build: average O(n log n), worst O(n²); search O(h)',
    'O(n) tree; search O(1) auxiliary',
    'Compare and descend left/right. Includes insertion steps so the tree construction is explainable.',
    bstSource,
    { values: [8, 3, 10, 1, 6], target: 6 },
    'values: up to 30 numbers; target: finite number. Result contains found and nodeId.',
  ),
]);

export function getAlgorithm(id) {
  const algorithm = algorithms.find((algorithm) => algorithm.id === id);
  requireInput(algorithm, `Unknown algorithm: ${String(id)}.`);
  return algorithm;
}
export function generateTrace(id, input) {
  return getAlgorithm(id).generate(object(input));
}
