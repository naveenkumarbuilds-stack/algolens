import { integer, numbers, requireInput, recorder, highlight } from './core.js';

export function fibonacci(input) {
  const n = integer(input.n, 0, 78, 'n');
  const cells = [Array(n + 1).fill(null)];
  const trace = recorder(() => ({
    kind: 'dp',
    cells,
    rowLabels: ['F(n)'],
    columnLabels: Array.from({ length: n + 1 }, (_, i) => String(i)),
  }));
  cells[0][0] = 0;
  if (n > 0) cells[0][1] = 1;
  trace.emit(
    'write',
    1,
    { n },
    'Initialize F(0)=0 and, when present, F(1)=1.',
    highlight('cell', n > 0 ? ['0:0', '0:1'] : ['0:0'], 'changed'),
  );
  for (let i = 2; i <= n; i++) {
    cells[0][i] = cells[0][i - 1] + cells[0][i - 2];
    trace.emit(
      'write',
      3,
      { i, value: cells[0][i] },
      `F(${i}) = ${cells[0][i - 1]} + ${cells[0][i - 2]} = ${cells[0][i]}.`,
      highlight('cell', [`0:${i}`], 'changed'),
    );
  }
  return trace.finish(cells[0][n]);
}
export function knapsack(input) {
  const weights = numbers(input.weights, 30, 'Weights'),
    values = numbers(input.values, 30, 'Values');
  const capacity = integer(input.capacity, 0, 100, 'Capacity');
  requireInput(weights.length === values.length, 'Weights and values must have the same length.');
  weights.forEach((w) => integer(w, 1, 100, 'Weight'));
  requireInput(
    values.every((v) => v >= 0),
    'Knapsack values must be non-negative.',
  );
  requireInput(
    (weights.length + 1) * (capacity + 1) <= 2500,
    'DP grid must contain at most 2,500 cells.',
  );
  const cells = Array.from({ length: weights.length + 1 }, () => Array(capacity + 1).fill(0));
  const trace = recorder(() => ({
    kind: 'dp',
    cells,
    rowLabels: ['No items', ...weights.map((w, i) => `Item ${i} (w=${w})`)],
    columnLabels: Array.from({ length: capacity + 1 }, (_, i) => String(i)),
  }));
  for (let i = 1; i <= weights.length; i++)
    for (let w = 0; w <= capacity; w++) {
      const skip = cells[i - 1][w];
      const take = weights[i - 1] <= w ? values[i - 1] + cells[i - 1][w - weights[i - 1]] : null;
      cells[i][w] = take === null ? skip : Math.max(skip, take);
      trace.emit(
        'write',
        3,
        { i, capacity: w, skip, take, best: cells[i][w] },
        `For ${i} items and capacity ${w}, ${take === null ? 'this item does not fit' : `choose max(skip=${skip}, take=${take})`}; best value is ${cells[i][w]}.`,
        highlight('cell', [`${i}:${w}`], 'changed'),
      );
    }
  const items = [];
  let w = capacity;
  for (let i = weights.length; i > 0; i--) {
    if (cells[i][w] !== cells[i - 1][w]) {
      items.push(i - 1);
      w -= weights[i - 1];
    }
    trace.emit(
      'return',
      5,
      { i, remainingCapacity: w, items },
      `Backtrack row ${i}; selected item indices are [${items}].`,
      highlight('cell', [`${i}:${w}`]),
    );
  }
  return trace.finish({ maxValue: cells[weights.length][capacity], items: items.reverse() });
}
export function lcs(input) {
  requireInput(
    typeof input.a === 'string' && typeof input.b === 'string',
    'LCS requires strings a and b.',
  );
  const a = Array.from(input.a),
    b = Array.from(input.b);
  requireInput(
    a.length <= 49 && b.length <= 49 && (a.length + 1) * (b.length + 1) <= 2500,
    'LCS strings must have at most 49 Unicode code points each.',
  );
  const cells = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  const trace = recorder(() => ({
    kind: 'dp',
    cells,
    rowLabels: ['∅', ...a],
    columnLabels: ['∅', ...b],
  }));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const match = a[i - 1] === b[j - 1];
      cells[i][j] = match ? cells[i - 1][j - 1] + 1 : Math.max(cells[i - 1][j], cells[i][j - 1]);
      trace.emit(
        'write',
        3,
        { i, j, match, length: cells[i][j] },
        `Compare ${JSON.stringify(a[i - 1])} with ${JSON.stringify(b[j - 1])}: ${match ? 'match, add 1 to the diagonal' : 'different, use max(top, left)'}.`,
        highlight('cell', [`${i}:${j}`], 'changed'),
      );
    }
  const sequence = [];
  let i = a.length,
    j = b.length;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      sequence.push(a[i - 1]);
      i--;
      j--;
    } else if (cells[i - 1][j] >= cells[i][j - 1]) i--;
    else j--;
    trace.emit(
      'return',
      5,
      { i, j, reversedSequence: sequence },
      'Backtrack through the table to recover a longest common subsequence.',
      highlight('cell', [`${i}:${j}`]),
    );
  }
  return trace.finish({ length: cells[a.length][b.length], sequence: sequence.reverse().join('') });
}
