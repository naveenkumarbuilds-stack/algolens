import { numbers, finite, object, requireInput, recorder, highlight } from './core.js';

export function operations(input, kind) {
  const values = numbers(input.values);
  requireInput(
    Array.isArray(input.operations) && input.operations.length <= 100,
    'Supply at most 100 operations.',
  );
  const add = kind === 'stack' ? 'push' : 'enqueue',
    remove = kind === 'stack' ? 'pop' : 'dequeue';
  // Validate the complete request before emitting or mutating local state.
  input.operations.forEach((op) => {
    object(op);
    requireInput(
      [add, remove, 'peek'].includes(op.type),
      `Allowed operations: ${add}, ${remove}, peek.`,
    );
    if (op.type === add) finite(op.value);
  });
  const trace = recorder(() => ({ kind, values })),
    outputs = [];
  for (const [operationIndex, op] of input.operations.entries()) {
    if (op.type === add) {
      requireInput(values.length < 64, 'The structure cannot exceed 64 elements.');
      values.push(op.value);
      trace.emit(
        add,
        2,
        { operationIndex, value: op.value, size: values.length },
        `${add === 'push' ? 'Push' : 'Enqueue'} ${op.value}.`,
        highlight('array', [values.length - 1], 'changed'),
      );
    } else {
      const value = values.length
        ? op.type === 'peek'
          ? values[kind === 'stack' ? values.length - 1 : 0]
          : kind === 'stack'
            ? values.pop()
            : values.shift()
        : null;
      outputs.push({ operation: op.type, value });
      trace.emit(
        op.type === 'peek' ? 'snapshot' : remove,
        op.type === 'peek' ? 4 : 3,
        { operationIndex, value, size: values.length },
        value === null
          ? 'The structure is empty; return null without removing anything.'
          : `${op.type} returns ${value}.`,
        values.length && op.type === 'peek'
          ? highlight('array', [kind === 'stack' ? values.length - 1 : 0])
          : [],
      );
    }
  }
  return trace.finish({ values, outputs });
}

export const stack = (input) => operations(input, 'stack');
export const queue = (input) => operations(input, 'queue');

function bst(input, searching) {
  const values = numbers(input.values, 30);
  const target = searching ? finite(input.target, 'Target') : null;
  const nodes = [],
    edges = [],
    tree = new Map();
  let root = null;
  const trace = recorder(() => ({ kind: 'tree', nodes, edges }));
  for (const value of values) {
    let current = root,
      parent = null,
      side = null;
    while (current !== null) {
      const node = tree.get(current);
      trace.emit(
        'compare',
        2,
        { value, current, nodeValue: node.value },
        `Compare insertion value ${value} with ${node.value}.`,
        highlight('node', [current], 'compare'),
      );
      if (value === node.value) break;
      parent = current;
      side = value < node.value ? 'left' : 'right';
      current = node[side];
    }
    if (current !== null) continue;
    const id = `n${nodes.length}`;
    tree.set(id, { value, left: null, right: null });
    nodes.push({ id, label: String(value) });
    if (parent === null) root = id;
    else {
      tree.get(parent)[side] = id;
      edges.push({ id: `${parent}:${side}`, from: parent, to: id, directed: true });
    }
    trace.emit(
      'write',
      3,
      { value, id, parent, side, root },
      `Insert ${value} ${parent === null ? 'as the root' : `as the ${side} child of ${tree.get(parent).value}`}.`,
      highlight('node', [id], 'changed'),
    );
  }
  if (!searching)
    return trace.finish(
      { root, values: nodes.map((node) => Number(node.label)) },
      'BST insertion is complete. Duplicate keys are ignored.',
    );
  let current = root;
  while (current !== null) {
    const node = tree.get(current);
    trace.emit(
      'compare',
      5,
      { target, current, nodeValue: node.value },
      `Compare target ${target} with ${node.value}.`,
      highlight('node', [current], 'compare'),
    );
    if (target === node.value) return trace.finish({ found: true, nodeId: current });
    current = target < node.value ? node.left : node.right;
  }
  return trace.finish(
    { found: false, nodeId: null },
    'Reached an empty child; the target is absent.',
  );
}
export const bstInsert = (input) => bst(input, false);
export const bstSearch = (input) => bst(input, true);
