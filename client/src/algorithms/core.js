export class AlgorithmInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AlgorithmInputError';
  }
}
export function requireInput(condition, message) {
  if (!condition) throw new AlgorithmInputError(message);
}
export function object(value) {
  requireInput(
    value && typeof value === 'object' && !Array.isArray(value),
    'Input must be an object.',
  );
  return value;
}
export function finite(value, label = 'Value') {
  requireInput(
    typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e9,
    `${label} must be a finite number between -1e9 and 1e9.`,
  );
  return value;
}
export function integer(value, minimum, maximum, label) {
  requireInput(
    Number.isInteger(value) && value >= minimum && value <= maximum,
    `${label} must be an integer from ${minimum} to ${maximum}.`,
  );
  return value;
}
export function numbers(value, limit = 64, label = 'Array') {
  requireInput(
    Array.isArray(value) && value.length <= limit,
    `${label} must be an array with at most ${limit} elements.`,
  );
  for (const item of value) finite(item, label);
  return [...value];
}
export function highlight(target, ids, role = 'active') {
  return [{ target, ids: ids.map(String), role }];
}
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
// Each step owns its state: stepping backward must never show later mutations.
export function recorder(view, initialVariables = {}) {
  const steps = [];
  let bytes = 0;
  function emit(type, line, variables, explanation, highlights = []) {
    const step = structuredClone({
      version: 1,
      index: steps.length,
      type,
      line,
      variables,
      highlights,
      explanation,
      view: view(),
    });
    bytes += new TextEncoder().encode(JSON.stringify(step)).byteLength;
    requireInput(
      steps.length < 20000 && bytes <= 16 * 1024 * 1024,
      'This trace is too large. Use a smaller input (20,000 steps / 16 MiB maximum).',
    );
    steps.push(freeze(step));
  }
  emit('initial', null, initialVariables, 'Start with the supplied input.');
  return {
    emit,
    finish(result, explanation = 'The algorithm is complete.') {
      emit('complete', null, { result }, explanation);
      return freeze({ steps, result: structuredClone(result) });
    },
  };
}
