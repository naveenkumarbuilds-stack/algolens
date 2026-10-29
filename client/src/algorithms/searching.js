import { numbers, finite, requireInput, recorder, highlight } from './core.js';

export function linearSearch(input) {
  const values = numbers(input.values),
    target = finite(input.target, 'Target');
  const trace = recorder(() => ({ kind: 'array', values }), { target });
  for (let i = 0; i < values.length; i++) {
    trace.emit(
      'compare',
      2,
      { i, target, value: values[i] },
      `Compare arr[${i}]=${values[i]} with target ${target}.`,
      highlight('array', [i], 'compare'),
    );
    if (values[i] === target) {
      trace.emit(
        'return',
        3,
        { index: i },
        `Found the first match at index ${i}.`,
        highlight('array', [i], 'final'),
      );
      return trace.finish(i);
    }
  }
  return trace.finish(-1, 'Target not found; return -1.');
}
export function binarySearch(input) {
  const values = numbers(input.values),
    target = finite(input.target, 'Target');
  requireInput(
    values.every((value, i) => i === 0 || values[i - 1] <= value),
    'Binary search requires ascending sorted input.',
  );
  const trace = recorder(() => ({ kind: 'array', values }), { target });
  let low = 0,
    high = values.length - 1;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    trace.emit(
      'compare',
      3,
      { low, high, mid, target },
      `Compare middle value ${values[mid]} with ${target}.`,
      highlight('array', [mid], 'compare'),
    );
    if (values[mid] === target) {
      trace.emit(
        'return',
        4,
        { low, high, mid },
        `Found a match at index ${mid}.`,
        highlight('array', [mid], 'final'),
      );
      return trace.finish(mid);
    }
    if (values[mid] < target) low = mid + 1;
    else high = mid - 1;
    trace.emit(
      'write',
      5,
      { low, high, mid, target },
      `Narrow the remaining range to [${low}, ${high}].`,
    );
  }
  return trace.finish(-1, 'The range is empty; target not found.');
}
