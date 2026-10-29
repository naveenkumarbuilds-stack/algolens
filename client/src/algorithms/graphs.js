import { object, requireInput, finite, recorder, highlight } from './core.js';

function graph(input, weighted = false) {
  const { nodes, edges, start } = input;
  requireInput(
    Array.isArray(nodes) && nodes.length > 0 && nodes.length <= 30,
    'Supply 1–30 nodes.',
  );
  requireInput(
    nodes.every((id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(id)) &&
      new Set(nodes).size === nodes.length,
    'Node IDs must be unique letters, digits, underscores or hyphens (1–24 characters).',
  );
  requireInput(nodes.includes(start), 'Start must identify an existing node.');
  requireInput(Array.isArray(edges) && edges.length <= 100, 'Supply at most 100 edges.');
  const normalized = edges.map((edge, i) => {
    object(edge);
    requireInput(
      nodes.includes(edge.from) && nodes.includes(edge.to),
      'Every edge endpoint must exist.',
    );
    requireInput(
      edge.directed === undefined || typeof edge.directed === 'boolean',
      'Edge directed must be a boolean.',
    );
    const weight = edge.weight === undefined ? 1 : finite(edge.weight, 'Edge weight');
    if (weighted) requireInput(weight >= 0, 'Dijkstra requires non-negative weights.');
    return { id: `e${i}`, from: edge.from, to: edge.to, directed: edge.directed ?? false, weight };
  });
  const adjacency = new Map(nodes.map((id) => [id, []]));
  for (const edge of normalized) {
    adjacency.get(edge.from).push({ to: edge.to, weight: edge.weight, edgeId: edge.id });
    if (!edge.directed && edge.from !== edge.to)
      adjacency.get(edge.to).push({ to: edge.from, weight: edge.weight, edgeId: edge.id });
  }
  return {
    nodes,
    start,
    adjacency,
    view: () => ({
      kind: 'graph',
      nodes: nodes.map((id) => ({ id, label: id })),
      edges: normalized,
    }),
  };
}
export function bfs(input) {
  const g = graph(input);
  const trace = recorder(g.view);
  const queue = [g.start],
    seen = new Set([g.start]),
    order = [];
  trace.emit(
    'enqueue',
    1,
    { queue },
    `Enqueue start node ${g.start}.`,
    highlight('node', [g.start]),
  );
  while (queue.length) {
    const current = queue.shift();
    order.push(current);
    trace.emit(
      'dequeue',
      3,
      { current, queue, order },
      `Dequeue and visit ${current}.`,
      highlight('node', [current], 'visited'),
    );
    for (const { to, edgeId } of g.adjacency.get(current)) {
      trace.emit(
        'compare',
        4,
        { current, neighbor: to, seen: [...seen], queue },
        `Check whether ${to} has already been discovered.`,
        highlight('edge', [edgeId], 'compare'),
      );
      if (!seen.has(to)) {
        seen.add(to);
        queue.push(to);
        trace.emit(
          'enqueue',
          5,
          { current, queue, seen: [...seen] },
          `Discover ${to} and enqueue it once.`,
          highlight('node', [to], 'changed'),
        );
      }
    }
  }
  return trace.finish(order, 'BFS has visited every node reachable from the start.');
}
export function dfs(input) {
  const g = graph(input),
    trace = recorder(g.view),
    seen = new Set(),
    order = [],
    callStack = [];
  function visit(current) {
    seen.add(current);
    order.push(current);
    callStack.push(current);
    trace.emit(
      'visit',
      2,
      { current, order, callStack },
      `Enter ${current} and mark it visited.`,
      highlight('node', [current], 'visited'),
    );
    for (const { to, edgeId } of g.adjacency.get(current)) {
      trace.emit(
        'compare',
        3,
        { current, neighbor: to, callStack, seen: [...seen] },
        `Check neighbor ${to}.`,
        highlight('edge', [edgeId], 'compare'),
      );
      if (!seen.has(to)) visit(to);
    }
    callStack.pop();
    trace.emit(
      'return',
      5,
      { current, callStack, order },
      `Return from ${current} after exploring its neighbors.`,
      highlight('node', [current], 'visited'),
    );
  }
  visit(g.start);
  return trace.finish(order, 'DFS has visited every node reachable from the start.');
}
export function dijkstra(input) {
  const g = graph(input, true),
    trace = recorder(g.view);
  const distances = new Map(g.nodes.map((id) => [id, Infinity]));
  const previous = new Map(g.nodes.map((id) => [id, null]));
  distances.set(g.start, 0);
  const settled = new Set();
  const snapshot = () =>
    Object.fromEntries(
      [...distances].map(([id, value]) => [id, Number.isFinite(value) ? value : 'Infinity']),
    );
  trace.emit(
    'write',
    1,
    { distances: snapshot() },
    `Set distance(${g.start}) to 0; all others are Infinity.`,
    highlight('node', [g.start], 'changed'),
  );
  while (settled.size < g.nodes.length) {
    let current = null;
    for (const id of g.nodes)
      if (!settled.has(id) && (current === null || distances.get(id) < distances.get(current)))
        current = id;
    if (current === null || distances.get(current) === Infinity) break;
    settled.add(current);
    trace.emit(
      'visit',
      3,
      { current, distances: snapshot(), settled: [...settled] },
      `Settle ${current}, the nearest unsettled reachable node.`,
      highlight('node', [current], 'visited'),
    );
    for (const { to, weight, edgeId } of g.adjacency.get(current)) {
      const candidate = distances.get(current) + weight;
      trace.emit(
        'compare',
        4,
        { current, neighbor: to, candidate, distances: snapshot() },
        `Compare candidate distance ${candidate} with ${snapshot()[to]} for ${to}.`,
        highlight('edge', [edgeId], 'compare'),
      );
      if (!settled.has(to) && candidate < distances.get(to)) {
        distances.set(to, candidate);
        previous.set(to, current);
        trace.emit(
          'relax',
          5,
          { current, neighbor: to, distances: snapshot(), previous: Object.fromEntries(previous) },
          `Improve distance(${to}) to ${candidate} via ${current}.`,
          highlight('edge', [edgeId], 'changed'),
        );
      }
    }
  }
  return trace.finish(
    { distances: snapshot(), previous: Object.fromEntries(previous) },
    'Shortest distances are complete. Infinity means unreachable.',
  );
}
