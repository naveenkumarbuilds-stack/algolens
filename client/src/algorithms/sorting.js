import { numbers, recorder, highlight } from './core.js';

export function bubbleSort(input) {
  const values = numbers(input.values);
  const trace = recorder(() => ({ kind: 'array', values }));
  for (let end = values.length - 1; end > 0; end--) {
    let swapped = false;
    for (let j = 0; j < end; j++) {
      trace.emit(
        'compare',
        3,
        { end, j, left: values[j], right: values[j + 1] },
        `Compare arr[${j}]=${values[j]} with arr[${j + 1}]=${values[j + 1]}.`,
        highlight('array', [j, j + 1], 'compare'),
      );
      if (values[j] > values[j + 1]) {
        [values[j], values[j + 1]] = [values[j + 1], values[j]];
        swapped = true;
        trace.emit(
          'swap',
          4,
          { end, j, swapped },
          `Swap the out-of-order neighbors at ${j} and ${j + 1}.`,
          highlight('array', [j, j + 1], 'changed'),
        );
      }
    }
    if (!swapped) break;
  }
  return trace.finish(values);
}
export function selectionSort(input) {
  const values = numbers(input.values);
  const trace = recorder(() => ({ kind: 'array', values }));
  for (let i = 0; i < values.length - 1; i++) {
    let min = i;
    for (let j = i + 1; j < values.length; j++) {
      trace.emit(
        'compare',
        3,
        { i, j, min },
        `Compare candidate ${values[j]} with current minimum ${values[min]}.`,
        highlight('array', [j, min], 'compare'),
      );
      if (values[j] < values[min]) {
        min = j;
        trace.emit(
          'write',
          4,
          { i, j, min },
          `Index ${min} is the new minimum.`,
          highlight('array', [min]),
        );
      }
    }
    if (i !== min) {
      [values[i], values[min]] = [values[min], values[i]];
      trace.emit(
        'swap',
        5,
        { i, min },
        `Place the minimum at index ${i}.`,
        highlight('array', [i, min], 'changed'),
      );
    }
  }
  return trace.finish(values);
}
export function insertionSort(input) {
  const values = numbers(input.values);
  const trace = recorder(() => ({ kind: 'array', values }));
  for (let i = 1; i < values.length; i++) {
    const key = values[i];
    let j = i - 1;
    while (j >= 0) {
      trace.emit(
        'compare',
        3,
        { i, j, key },
        `Compare ${values[j]} with the saved key ${key}.`,
        highlight('array', [j], 'compare'),
      );
      if (values[j] <= key) break;
      values[j + 1] = values[j];
      const shiftedIndex = j + 1;
      j--;
      trace.emit(
        'write',
        4,
        { i, j, key },
        `Shift ${values[shiftedIndex]} one position right. The key is held separately.`,
        highlight('array', [shiftedIndex], 'changed'),
      );
    }
    values[j + 1] = key;
    trace.emit(
      'write',
      5,
      { i, j, key },
      `Insert key ${key} at index ${j + 1}.`,
      highlight('array', [j + 1], 'changed'),
    );
  }
  return trace.finish(values);
}
export function mergeSort(input) {
  const values = numbers(input.values);
  const trace = recorder(() => ({ kind: 'array', values }));
  function sort(lo, hi) {
    if (hi - lo < 2) return;
    const mid = Math.floor((lo + hi) / 2);
    sort(lo, mid);
    sort(mid, hi);
    const left = values.slice(lo, mid),
      right = values.slice(mid, hi);
    let i = 0,
      j = 0,
      k = lo;
    while (i < left.length || j < right.length) {
      if (i < left.length && j < right.length)
        trace.emit(
          'compare',
          4,
          { lo, mid, hi, i, j, left, right },
          `Compare buffered values ${left[i]} and ${right[j]}. The buffers are shown in variables.`,
        );
      values[k] =
        j >= right.length || (i < left.length && left[i] <= right[j]) ? left[i++] : right[j++];
      trace.emit(
        'write',
        5,
        { lo, mid, hi, i, j, k, left, right },
        `Write ${values[k]} from the merge buffer to index ${k}.`,
        highlight('array', [k], 'changed'),
      );
      k++;
    }
  }
  sort(0, values.length);
  return trace.finish(values);
}
export function quickSort(input) {
  const values = numbers(input.values);
  const trace = recorder(() => ({ kind: 'array', values }));
  function sort(lo, hi) {
    if (lo >= hi) return;
    const pivot = values[hi];
    let i = lo;
    for (let j = lo; j < hi; j++) {
      trace.emit(
        'compare',
        3,
        { lo, hi, pivot, i, j },
        `Compare ${values[j]} with pivot ${pivot}.`,
        highlight('array', [j, hi], 'compare'),
      );
      if (values[j] <= pivot) {
        [values[i], values[j]] = [values[j], values[i]];
        const destination = i;
        i++;
        trace.emit(
          'swap',
          4,
          { lo, hi, pivot, i, j },
          `Move ${values[destination]} into the pivot's left partition.`,
          highlight('array', [destination, j], 'changed'),
        );
      }
    }
    [values[i], values[hi]] = [values[hi], values[i]];
    trace.emit(
      'swap',
      5,
      { lo, hi, pivot, i },
      `Place pivot ${pivot} at its final index ${i}.`,
      highlight('array', [i, hi], 'changed'),
    );
    sort(lo, i - 1);
    sort(i + 1, hi);
  }
  sort(0, values.length - 1);
  return trace.finish(values);
}
