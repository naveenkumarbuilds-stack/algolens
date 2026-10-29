import { describe, it, expect } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import schema from '../../../docs/step.schema.json';
import { algorithms, generateTrace, getAlgorithm } from './registry';
import { AlgorithmInputError, recorder } from './core';

const validate = new Ajv2020({ strict: true, allowUnionTypes: true }).compile(schema);
const run = generateTrace;
const sorts = ['bubble-sort', 'selection-sort', 'insertion-sort', 'merge-sort', 'quick-sort'];
const last = (trace) => trace.steps.at(-1);
function checkTrace(trace, algorithm) {
  expect(trace.steps[0].type).toBe('initial');
  expect(last(trace).type).toBe('complete');
  expect(last(trace).variables.result).toEqual(trace.result);
  for (const [index, step] of trace.steps.entries()) {
    expect(validate(step), JSON.stringify(validate.errors)).toBe(true);
    expect(step.index).toBe(index);
    expect(Object.isFrozen(step)).toBe(true);
    if (step.line !== null)
      expect(step.line).toBeLessThanOrEqual(algorithm.source.split('\n').length);
    else expect(['initial', 'complete']).toContain(step.type);
    const view = step.view;
    for (const h of step.highlights)
      for (const id of h.ids) {
        if (h.target === 'array') expect(Number(id)).toBeGreaterThanOrEqual(0);
        if (h.target === 'array') expect(Number(id)).toBeLessThan(view.values.length);
        if (h.target === 'node') expect(view.nodes.some((node) => node.id === id)).toBe(true);
        if (h.target === 'edge') expect(view.edges.some((edge) => edge.id === id)).toBe(true);
        if (h.target === 'cell') {
          const [r, c] = id.split(':').map(Number);
          expect(view.cells[r]?.[c]).not.toBeUndefined();
        }
      }
    if (view.kind === 'dp') {
      expect(view.cells.length).toBe(view.rowLabels.length);
      view.cells.forEach((row) => expect(row.length).toBe(view.columnLabels.length));
    }
    if (view.kind === 'graph' || view.kind === 'tree') {
      const ids = new Set(view.nodes.map((node) => node.id));
      expect(ids.size).toBe(view.nodes.length);
      expect(new Set(view.edges.map((edge) => edge.id)).size).toBe(view.edges.length);
      view.edges.forEach((edge) => {
        expect(ids.has(edge.from)).toBe(true);
        expect(ids.has(edge.to)).toBe(true);
      });
    }
  }
}

describe('universal trace contract', () => {
  it('registers 17 distinct algorithms', () => {
    expect(algorithms).toHaveLength(17);
    expect(new Set(algorithms.map((a) => a.id)).size).toBe(17);
  });
  it.each(algorithms.map((a) => [a.id, a]))(
    '%s emits schema-valid immutable, deterministic snapshots without modifying input',
    (id, algorithm) => {
      const input = structuredClone(algorithm.example),
        before = structuredClone(input);
      const trace = run(id, input);
      checkTrace(trace, algorithm);
      expect(input).toEqual(before);
      expect(run(id, input)).toEqual(trace);
      expect(JSON.parse(JSON.stringify(trace))).toEqual(trace);
      expect(algorithm.complexity.note.length).toBeGreaterThan(10);
      expect(algorithm.inputGuide.length).toBeGreaterThan(10);
    },
  );
  it('keeps earlier array snapshots independent from swaps', () => {
    const trace = run('bubble-sort', { values: [2, 1] });
    expect(trace.steps[0].view.values).toEqual([2, 1]);
    expect(last(trace).view.values).toEqual([1, 2]);
    expect(() => trace.steps[0].view.values.push(3)).toThrow();
  });
  it('keeps earlier DP cells and graph queue variables unchanged', () => {
    const fib = run('fibonacci', { n: 4 });
    expect(fib.steps[0].view.cells[0]).toEqual([null, null, null, null, null]);
    const bfs = run('bfs', getAlgorithm('bfs').example);
    expect(bfs.steps[1].variables.queue).toEqual(['A']);
  });
  it('rejects unknown algorithms and malformed root inputs', () => {
    expect(() => run('missing', {})).toThrow(AlgorithmInputError);
    expect(() => run('bubble-sort', null)).toThrow(AlgorithmInputError);
    expect(() => run('bubble-sort', [])).toThrow(AlgorithmInputError);
  });
  it('fails explicitly instead of returning a truncated oversized trace', () => {
    const trace = recorder(() => ({ kind: 'array', values: [] }));
    expect(() => {
      for (let i = 0; i < 20001; i++) trace.emit('snapshot', 1, {}, 'A bounded step.');
    }).toThrow(/too large/);
  });
});

describe('sorting', () => {
  const arrays = [[]];
  for (let length = 1; length <= 4; length++) {
    const build = (prefix) => {
      if (prefix.length === length) arrays.push(prefix);
      else for (const v of [-1, 0, 1]) build([...prefix, v]);
    };
    build([]);
  }
  it.each(sorts)('%s matches numeric sort on all 121 short arrays', (id) => {
    for (const values of [
      ...arrays,
      [5.5, -2.2, 0, 5.5],
      Array.from({ length: 64 }, (_, i) => 63 - i),
    ]) {
      const original = [...values];
      const trace = run(id, { values });
      expect(trace.result).toEqual([...values].sort((a, b) => a - b));
      expect(values).toEqual(original);
      for (const step of trace.steps)
        if (step.type === 'swap')
          expect([...step.view.values].sort((a, b) => a - b)).toEqual(
            [...values].sort((a, b) => a - b),
          );
    }
  });
  it('bubble sort exits after one pass for sorted input', () => {
    const trace = run('bubble-sort', { values: [1, 2, 3, 4] });
    expect(trace.steps.filter((s) => s.type === 'compare')).toHaveLength(3);
    expect(trace.steps.some((s) => s.type === 'swap')).toBe(false);
  });
  it.each([undefined, [NaN], [Infinity], ['2'], Array(65).fill(0), [1e10]])(
    'rejects invalid array %#',
    (values) => expect(() => run('merge-sort', { values })).toThrow(AlgorithmInputError),
  );
});

describe('searching', () => {
  it.each(['linear-search', 'binary-search'])(
    '%s handles absent/present targets, duplicates, boundaries and empty input',
    (id) => {
      for (const values of [[], [1], [1, 1, 2, 3, 5], [-3, -1, 0, 2]])
        for (const target of [-4, -3, 0, 1, 2, 5, 9]) {
          const index = run(id, { values, target }).result;
          if (values.includes(target)) expect(values[index]).toBe(target);
          else expect(index).toBe(-1);
        }
    },
  );
  it('linear search returns the first duplicate and binary search refuses unsorted input', () => {
    expect(run('linear-search', { values: [4, 4], target: 4 }).result).toBe(0);
    expect(() => run('binary-search', { values: [2, 1], target: 1 })).toThrow(/sorted/);
    expect(() => run('linear-search', { values: [1], target: NaN })).toThrow(AlgorithmInputError);
  });
});

describe('graph algorithms', () => {
  const input = {
    nodes: ['A', 'B', 'C', 'D', 'X'],
    edges: [
      { from: 'A', to: 'B' },
      { from: 'A', to: 'C' },
      { from: 'B', to: 'D' },
      { from: 'C', to: 'D' },
      { from: 'D', to: 'A' },
    ],
    start: 'A',
  };
  it('BFS and DFS traverse deterministically without revisiting cycles', () => {
    expect(run('bfs', input).result).toEqual(['A', 'B', 'C', 'D']);
    expect(run('dfs', input).result).toEqual(['A', 'B', 'D', 'C']);
  });
  it.each(['bfs', 'dfs', 'dijkstra'])('%s respects direction and self-loops', (id) => {
    const g = {
      nodes: ['A', 'B'],
      edges: [
        { from: 'A', to: 'B', directed: true },
        { from: 'B', to: 'B' },
      ],
      start: 'B',
    };
    const result = run(id, g).result;
    if (id === 'dijkstra') expect(result.distances).toEqual({ A: 'Infinity', B: 0 });
    else expect(result).toEqual(['B']);
  });
  it('Dijkstra handles zero weights, parallel edges and disconnected nodes', () => {
    const trace = run('dijkstra', {
      nodes: ['A', 'B', 'C', 'X'],
      edges: [
        { from: 'A', to: 'B', weight: 7 },
        { from: 'A', to: 'B', weight: 0 },
        { from: 'B', to: 'C', weight: 2 },
      ],
      start: 'A',
    });
    expect(trace.result).toEqual({
      distances: { A: 0, B: 0, C: 2, X: 'Infinity' },
      previous: { A: null, B: 'A', C: 'B', X: null },
    });
  });
  it('Dijkstra agrees with an independent Bellman-Ford reference on 20 directed graphs', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const nodes = ['A', 'B', 'C', 'D', 'E'];
      const edges = [];
      for (let i = 0; i < 5; i++)
        for (let j = 0; j < 5; j++)
          if (i !== j && (seed + i * 3 + j * 7) % 3 !== 0)
            edges.push({
              from: nodes[i],
              to: nodes[j],
              weight: (seed + i * 5 + j) % 9,
              directed: true,
            });
      const distances = Object.fromEntries(nodes.map((n) => [n, Infinity]));
      distances.A = 0;
      for (let pass = 0; pass < 4; pass++)
        for (const edge of edges)
          distances[edge.to] = Math.min(distances[edge.to], distances[edge.from] + edge.weight);
      expect(run('dijkstra', { nodes, edges, start: 'A' }).result.distances).toEqual(
        Object.fromEntries(
          nodes.map((n) => [n, Number.isFinite(distances[n]) ? distances[n] : 'Infinity']),
        ),
      );
    }
  });
  it.each([
    { nodes: ['A', 'A'], edges: [], start: 'A' },
    { nodes: ['A'], edges: [{ from: 'A', to: 'B' }], start: 'A' },
    { nodes: ['A'], edges: [], start: 'B' },
    { nodes: ['A'], edges: [{ from: 'A', to: 'A', weight: -1 }], start: 'A' },
    {
      nodes: ['__proto__'],
      edges: [{ from: '__proto__', to: '__proto__', directed: 'yes' }],
      start: '__proto__',
    },
  ])('rejects invalid graph %#', (input) =>
    expect(() => run('dijkstra', input)).toThrow(AlgorithmInputError),
  );
  it('supports object-like node names without prototype collisions', () => {
    expect(
      run('dijkstra', {
        nodes: ['__proto__', 'constructor'],
        edges: [{ from: '__proto__', to: 'constructor', weight: 3 }],
        start: '__proto__',
      }).result.distances.constructor,
    ).toBe(3);
  });
});

describe('dynamic programming', () => {
  it('computes Fibonacci boundaries with safe integers', () => {
    for (const [n, result] of [
      [0, 0],
      [1, 1],
      [2, 1],
      [10, 55],
      [78, 8944394323791464],
    ])
      expect(run('fibonacci', { n }).result).toBe(result);
    expect(() => run('fibonacci', { n: 79 })).toThrow(AlgorithmInputError);
  });
  it('knapsack agrees with exhaustive subsets and reconstructs feasible items', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const weights = [1, 2, 3, 4, 5],
        values = weights.map((w, i) => (seed + w * i) % 11),
        capacity = seed % 12;
      let best = 0;
      for (let mask = 0; mask < 32; mask++) {
        let weight = 0,
          value = 0;
        for (let i = 0; i < 5; i++)
          if (mask & (1 << i)) {
            weight += weights[i];
            value += values[i];
          }
        if (weight <= capacity) best = Math.max(best, value);
      }
      const result = run('knapsack', { weights, values, capacity }).result;
      expect(result.maxValue).toBe(best);
      expect(result.items.reduce((sum, i) => sum + weights[i], 0)).toBeLessThanOrEqual(capacity);
      expect(result.items.reduce((sum, i) => sum + values[i], 0)).toBe(best);
      expect(new Set(result.items).size).toBe(result.items.length);
    }
    expect(run('knapsack', { weights: [], values: [], capacity: 0 }).result).toEqual({
      maxValue: 0,
      items: [],
    });
  });
  it('LCS recovers common subsequences, including Unicode', () => {
    for (const [a, b, length] of [
      ['', 'abc', 0],
      ['ABCBDAB', 'BDCABA', 4],
      ['abc', 'xyz', 0],
      ['aaaa', 'aa', 2],
      ['😀a🚀', 'b😀🚀', 2],
    ]) {
      const result = run('lcs', { a, b }).result;
      expect(result.length).toBe(length);
      expect(Array.from(result.sequence)).toHaveLength(length);
      for (const text of [a, b]) {
        let index = 0;
        const seq = Array.from(result.sequence);
        for (const char of Array.from(text)) if (char === seq[index]) index++;
        expect(index).toBe(length);
      }
    }
  });
  it('rejects invalid dimensions and weights', () => {
    expect(() => run('knapsack', { weights: [0], values: [1], capacity: 2 })).toThrow(
      AlgorithmInputError,
    );
    expect(() => run('knapsack', { weights: [1], values: [], capacity: 2 })).toThrow(
      AlgorithmInputError,
    );
    expect(() =>
      run('knapsack', { weights: Array(30).fill(1), values: Array(30).fill(1), capacity: 100 }),
    ).toThrow(/2,500/);
    expect(() => run('lcs', { a: 'a'.repeat(50), b: 'b' })).toThrow(AlgorithmInputError);
  });
});

describe('data structures', () => {
  it('stack is LIFO, peek is non-destructive and underflow is explicit', () => {
    const trace = run('stack', {
      values: [],
      operations: [
        { type: 'pop' },
        { type: 'push', value: 1 },
        { type: 'push', value: 2 },
        { type: 'peek' },
        { type: 'pop' },
      ],
    });
    expect(trace.result).toEqual({
      values: [1],
      outputs: [
        { operation: 'pop', value: null },
        { operation: 'peek', value: 2 },
        { operation: 'pop', value: 2 },
      ],
    });
  });
  it('queue is FIFO and can be drained', () => {
    const trace = run('queue', {
      values: [1],
      operations: [
        { type: 'enqueue', value: 2 },
        { type: 'peek' },
        { type: 'dequeue' },
        { type: 'dequeue' },
        { type: 'dequeue' },
      ],
    });
    expect(trace.result).toEqual({
      values: [],
      outputs: [
        { operation: 'peek', value: 1 },
        { operation: 'dequeue', value: 1 },
        { operation: 'dequeue', value: 2 },
        { operation: 'dequeue', value: null },
      ],
    });
  });
  it('validates operations and rejects capacity overflow', () => {
    expect(() => run('stack', { values: [], operations: [{ type: 'enqueue', value: 1 }] })).toThrow(
      AlgorithmInputError,
    );
    expect(() =>
      run('queue', { values: [], operations: [{ type: 'enqueue', value: NaN }] }),
    ).toThrow(AlgorithmInputError);
    expect(() =>
      run('stack', { values: Array(64).fill(1), operations: [{ type: 'push', value: 2 }] }),
    ).toThrow(/64/);
  });
  it('BST placement preserves all subtree ordering and child-side IDs', () => {
    const trace = run('bst-insert', { values: [8, 3, 10, 1, 6, 14, 4, 7, 13, 3] });
    const { nodes, edges } = last(trace).view;
    expect(nodes).toHaveLength(9);
    function check(id, min, max) {
      const node = nodes.find((node) => node.id === id);
      const value = Number(node.label);
      expect(value).toBeGreaterThan(min);
      expect(value).toBeLessThan(max);
      for (const edge of edges.filter((edge) => edge.from === id))
        check(
          edge.to,
          edge.id.endsWith(':left') ? min : value,
          edge.id.endsWith(':left') ? value : max,
        );
    }
    check(trace.result.root, -Infinity, Infinity);
    expect(trace.steps[0].view.nodes).toEqual([]);
  });
  it('BST handles empty, duplicate, skewed, present and absent searches', () => {
    expect(run('bst-insert', { values: [] }).result).toEqual({ root: null, values: [] });
    for (const values of [[], [1, 1, 1], [1, 2, 3, 4], [4, 3, 2, 1]])
      for (const target of [0, 1, 3, 9])
        expect(run('bst-search', { values, target }).result.found).toBe(values.includes(target));
  });
});
