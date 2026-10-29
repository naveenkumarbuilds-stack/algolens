import { parseProgram, ProgramError } from './parser';

const forbidden = new Set(['constructor', 'prototype', '__proto__']);
class Scope {
  constructor(parent = null) {
    this.parent = parent;
    this.values = new Map();
  }
  define(name, value, type = 'let', line = 1) {
    if (this.values.has(name))
      throw new ProgramError(`'${name}' is already declared in this scope.`, line);
    this.values.set(name, { value, type });
  }
  binding(name, line) {
    if (this.values.has(name)) return this.values.get(name);
    if (this.parent) return this.parent.binding(name, line);
    throw new ProgramError(`Unknown variable '${name}'.`, line);
  }
}
export function runProgram({ source, language = 'javascript', input = {}, visualVariable = '' }) {
  const ast = parseProgram(source, language),
    lines = source.split('\n');
  let operations = 0,
    depth = 0,
    bytes = 0,
    output = '';
  const steps = [],
    global = new Scope();
  const integerLanguage = language !== 'javascript';
  function fail(message, line = 1) {
    throw new ProgramError(message, line);
  }
  function tick(line) {
    if (++operations > 100000)
      fail('Operation limit reached (100,000). Check for an infinite loop.', line);
  }
  function bound(value, line) {
    if (typeof value === 'number' && (!Number.isFinite(value) || Math.abs(value) > 1e12))
      fail('Numeric result is non-finite or exceeds 1e12.', line);
    if (
      typeof value === 'number' &&
      integerLanguage &&
      (!Number.isInteger(value) || value < -2147483648 || value > 2147483647)
    )
      fail('This teaching subset supports 32-bit integers only; overflow is rejected.', line);
    if (typeof value === 'string' && value.length > 4096)
      fail('String length limit reached (4,096).', line);
    if (Array.isArray(value) && value.length > 1000)
      fail('Array length limit reached (1,000).', line);
    return value;
  }
  function safeInput(value, level = 0) {
    if (level > 10) fail('Input nesting exceeds 10 levels.');
    if (value === null || ['number', 'boolean', 'string'].includes(typeof value))
      return bound(value, 1);
    if (Array.isArray(value)) {
      bound(value, 1);
      return value.map((v) => safeInput(v, level + 1));
    }
    if (value && typeof value === 'object') {
      const result = Object.create(null);
      for (const [key, v] of Object.entries(value)) {
        if (forbidden.has(key)) fail('Input contains a forbidden property.');
        result[key] = safeInput(v, level + 1);
      }
      return result;
    }
    fail('Input must contain JSON values only.');
  }
  if (new TextEncoder().encode(JSON.stringify(input)).length > 20000)
    fail('Input must be at most 20 KB.');
  global.define('input', safeInput(input), 'const');
  const jsonValue = (value) =>
    value === undefined
      ? 'undefined'
      : Array.isArray(value)
        ? value.map(jsonValue)
        : value && typeof value === 'object'
          ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, jsonValue(item)]))
          : value;
  const snapshot = (scope) => {
    const result = Object.create(null),
      chain = [];
    for (let current = scope; current; current = current.parent) chain.unshift(current);
    for (const current of chain)
      for (const [name, binding] of current.values)
        if (!binding.value?.functionNode) result[name] = jsonValue(binding.value);
    return structuredClone(result);
  };
  function record(type, line, scope, explanation, extras = {}) {
    if (steps.length >= 2000 || (type !== 'complete' && steps.length >= 1999))
      fail('Step limit reached (2,000). Use a smaller input.', line ?? 1);
    const variables = { ...snapshot(scope), ...extras };
    const array = visualVariable ? variables[visualVariable] : null;
    const previous = steps.at(-1);
    if (type === 'snapshot' || type === 'write') {
      const changed = Object.entries(variables)
        .filter(
          ([name, value]) => JSON.stringify(previous?.variables[name]) !== JSON.stringify(value),
        )
        .slice(0, 4)
        .map(([name, value]) => `${name} is now ${JSON.stringify(value).slice(0, 100)}`);
      if (changed.length) explanation += ` ${changed.join('; ')}.`;
    }
    const view =
      Array.isArray(array) &&
      array.length <= 64 &&
      array.every((v) => typeof v === 'number' && Number.isFinite(v))
        ? { kind: 'array', values: array }
        : { kind: 'code' };
    const ids =
      view.kind === 'array'
        ? view.values.flatMap((value, i) =>
            previous?.view.kind === 'array' && previous.view.values[i] === value ? [] : [String(i)],
          )
        : [];
    const step = structuredClone({
      version: 1,
      index: steps.length,
      type,
      line,
      variables,
      highlights: ids.length ? [{ target: 'array', ids, role: 'changed' }] : [],
      explanation,
      view,
    });
    bytes += new TextEncoder().encode(JSON.stringify(step)).byteLength;
    if (bytes > 2 * 1024 * 1024)
      fail('Snapshot budget reached (2 MiB). Use a smaller input.', line ?? 1);
    steps.push(step);
  }
  function checkType(value, type, line) {
    if (['let', 'var', 'const'].includes(type)) return bound(value, line);
    if (type.endsWith('[]')) {
      if (!Array.isArray(value)) fail(`Expected ${type}.`, line);
      value.forEach((v) => checkType(v, type.slice(0, -2), line));
      return value;
    }
    if (type === 'int' && (!Number.isInteger(value) || value < -2147483648 || value > 2147483647))
      fail('Expected a 32-bit int.', line);
    if (['boolean', 'bool'].includes(type) && typeof value !== 'boolean')
      fail('Expected a boolean.', line);
    if (['String', 'string'].includes(type) && typeof value !== 'string')
      fail('Expected a string.', line);
    return bound(value, line);
  }
  function reference(node, scope) {
    if (node.kind === 'identifier') {
      const binding = scope.binding(node.name, node.line);
      return {
        get: () => binding.value,
        set: (value) => {
          if (binding.type === 'const') fail(`Cannot reassign const '${node.name}'.`, node.line);
          binding.value = checkType(value, binding.type, node.line);
        },
      };
    }
    if (node.kind === 'member') {
      const obj = evaluate(node.object, scope),
        key = node.computed ? evaluate(node.property, scope) : node.property;
      if (obj?.functionNode) fail('Function internals are not accessible.', node.line);
      if (forbidden.has(String(key))) fail('Prototype access is blocked.', node.line);
      if (Array.isArray(obj) && Number.isInteger(key) && key >= 0 && key < obj.length)
        return {
          get: () => obj[key],
          set: (v) => {
            if (v !== null && typeof v === 'object')
              fail('Nested array writes are unsupported.', node.line);
            const declaredType =
              node.object.kind === 'identifier'
                ? scope.binding(node.object.name, node.line).type
                : 'let';
            obj[key] = declaredType.endsWith('[]')
              ? checkType(v, declaredType.slice(0, -2), node.line)
              : bound(v, node.line);
          },
        };
      if (key === 'length' && (Array.isArray(obj) || typeof obj === 'string'))
        return { get: () => obj.length, set: () => fail('length is read-only.', node.line) };
      if (obj && typeof obj === 'object' && !Array.isArray(obj) && Object.hasOwn(obj, key))
        return {
          get: () => obj[key],
          set: () =>
            fail('Input object fields are read-only; copy them into a local variable.', node.line),
        };
      fail('Invalid property or out-of-bounds array index.', node.line);
    }
    fail('The left side must be a variable or an existing array element.', node.line);
  }
  function binary(op, a, b, line) {
    if (['==', '==='].includes(op)) return a === b;
    if (['!=', '!=='].includes(op)) return a !== b;
    if (op === '+' && (typeof a === 'string' || typeof b === 'string'))
      return bound(String(a) + String(b), line);
    if (typeof a !== 'number' || typeof b !== 'number')
      fail(`Operator '${op}' requires numbers.`, line);
    switch (op) {
      case '+':
        return bound(a + b, line);
      case '-':
        return bound(a - b, line);
      case '*':
        return bound(a * b, line);
      case '/':
        if (b === 0) fail('Division by zero.', line);
        return bound(integerLanguage ? Math.trunc(a / b) : a / b, line);
      case '%':
        if (b === 0) fail('Division by zero.', line);
        return bound(a % b, line);
      case '<':
        return a < b;
      case '>':
        return a > b;
      case '<=':
        return a <= b;
      case '>=':
        return a >= b;
      default:
        fail('Unsupported operator.', line);
    }
  }
  function nameOf(node) {
    return node.kind === 'identifier'
      ? node.name
      : node.kind === 'member' && !node.computed
        ? `${nameOf(node.object)}.${node.property}`
        : '';
  }
  function print(args, line, newline = true, format = false) {
    let text;
    if (format) {
      let index = 1;
      const template = String(args[0] ?? '');
      text = template.replace(/%[%dfs]/g, (match) =>
        match === '%%' ? '%' : String(args[index++] ?? ''),
      );
    } else
      text = args
        .map((value) => (typeof value === 'object' ? JSON.stringify(value) : String(value)))
        .join(' ');
    output += text + (newline ? '\n' : '');
    if (new TextEncoder().encode(output).length > 16384)
      fail('Output limit reached (16 KB).', line);
    return null;
  }
  function call(node, scope) {
    const name = nameOf(node.callee),
      args = node.args.map((arg) => evaluate(arg, scope));
    if (args.some((value) => value?.functionNode))
      fail('Passing functions as values is unsupported.', node.line);
    if (['console.log', 'System.out.println', 'System.out.print', 'printf', 'print'].includes(name))
      return print(
        args,
        node.line,
        name !== 'printf' && name !== 'System.out.print',
        name === 'printf',
      );
    if (name === 'readInt') {
      if (
        input === null ||
        typeof input !== 'object' ||
        args.length !== 1 ||
        typeof args[0] !== 'string' ||
        !Object.hasOwn(input, args[0]) ||
        !Number.isInteger(input[args[0]])
      )
        fail('Use readInt("key") with an integer key in Input JSON.', node.line);
      return bound(input[args[0]], node.line);
    }
    const math = {
      'Math.abs': Math.abs,
      'Math.min': Math.min,
      'Math.max': Math.max,
      'Math.floor': Math.floor,
      'Math.ceil': Math.ceil,
      'Math.sqrt': Math.sqrt,
      'Math.pow': Math.pow,
    };
    if (Object.hasOwn(math, name)) {
      if (!args.length || args.length > 16 || args.some((v) => typeof v !== 'number'))
        fail('Math calls require 1–16 numeric arguments.', node.line);
      return bound(math[name](...args), node.line);
    }
    if (node.callee.kind === 'member') {
      const array = evaluate(node.callee.object, scope),
        method = node.callee.computed
          ? evaluate(node.callee.property, scope)
          : node.callee.property;
      if (
        language !== 'javascript' ||
        !Array.isArray(array) ||
        !['push', 'pop', 'shift', 'unshift'].includes(method)
      )
        fail('Only whitelisted JavaScript array methods are callable.', node.line);
      if (['push', 'unshift'].includes(method)) {
        if (args.length !== 1 || array.length >= 1000)
          fail('Append one value; arrays are capped at 1,000 elements.', node.line);
        if (args[0] !== null && typeof args[0] === 'object')
          fail('Append scalar values only.', node.line);
        bound(args[0], node.line);
        return method === 'push' ? array.push(args[0]) : array.unshift(args[0]);
      }
      if (args.length) fail('Removal takes no arguments.', node.line);
      return (method === 'pop' ? array.pop() : array.shift()) ?? null;
    }
    const fn = scope.binding(name, node.line).value;
    if (!fn?.functionNode) fail('Value is not a declared function.', node.line);
    if (++depth > 50) fail('Function call depth limit reached (50).', node.line);
    const definition = fn.functionNode;
    if (args.length !== definition.params.length)
      fail('Function argument count does not match.', node.line);
    const local = new Scope(fn.closure);
    definition.params.forEach((param, i) =>
      local.define(param.name, checkType(args[i], param.type, node.line), param.type, node.line),
    );
    const flow = execute(definition.body, local);
    depth--;
    if (flow && flow.kind !== 'return')
      fail('break/continue must be inside a loop in this function.', node.line);
    const value = flow?.value ?? null;
    if (definition.returnType !== 'void' && definition.returnType !== 'let')
      checkType(value, definition.returnType, node.line);
    return value;
  }
  function evaluate(node, scope) {
    tick(node.line);
    switch (node.kind) {
      case 'literal':
        return bound(node.value, node.line);
      case 'identifier':
        return scope.binding(node.name, node.line).value;
      case 'array':
        if (node.elements.length > 1000) fail('Array limit reached.', node.line);
        return node.elements.map((element) => {
          const value = evaluate(element, scope);
          if (value !== null && typeof value === 'object')
            fail('Only scalar array literals are supported.', node.line);
          return value;
        });
      case 'newArray': {
        const size = evaluate(node.size, scope);
        if (!Number.isInteger(size) || size < 0 || size > 1000)
          fail('Array size must be an integer from 0 to 1,000.', node.line);
        return Array(size).fill(0);
      }
      case 'member':
        return reference(node, scope).get();
      case 'call':
        return call(node, scope);
      case 'unary': {
        const value = evaluate(node.argument, scope);
        if (node.op === '!') return !value;
        if (typeof value !== 'number') fail('Unary arithmetic requires a number.', node.line);
        return bound(node.op === '-' ? -value : value, node.line);
      }
      case 'update': {
        const ref = reference(node.argument, scope),
          old = ref.get();
        if (typeof old !== 'number') fail('Increment/decrement requires a number.', node.line);
        const value = bound(old + (node.op === '++' ? 1 : -1), node.line);
        ref.set(value);
        return node.prefix ? value : old;
      }
      case 'assign': {
        const ref = reference(node.left, scope),
          right = evaluate(node.right, scope),
          value = node.op === '=' ? right : binary(node.op[0], ref.get(), right, node.line);
        if (value?.functionNode) fail('Functions cannot be assigned to variables.', node.line);
        ref.set(value);
        return value;
      }
      case 'binary': {
        const a = evaluate(node.left, scope);
        if (node.op === '&&') return a && evaluate(node.right, scope);
        if (node.op === '||') return a || evaluate(node.right, scope);
        return binary(node.op, a, evaluate(node.right, scope), node.line);
      }
      default:
        fail('Unsupported expression.', node.line);
    }
  }
  function describe(node) {
    return `Execute line ${node.line}: ${lines[node.line - 1]?.trim().slice(0, 180) || node.kind}`;
  }
  function execute(node, scope) {
    tick(node.line);
    switch (node.kind) {
      case 'empty':
        return null;
      case 'block': {
        const local = new Scope(scope);
        for (const statement of node.body) {
          const flow = execute(statement, local);
          if (flow) return flow;
        }
        return null;
      }
      case 'function':
        scope.define(node.name, { functionNode: node, closure: scope }, 'const', node.line);
        return null;
      case 'declare': {
        const value = node.value
          ? evaluate(node.value, scope)
          : integerLanguage
            ? node.type.endsWith('[]')
              ? []
              : node.type === 'int'
                ? 0
                : ['bool', 'boolean'].includes(node.type)
                  ? false
                  : ''
            : undefined;
        if (value?.functionNode) fail('Function values cannot be stored.', node.line);
        scope.define(
          node.name,
          node.value ? checkType(value, node.type, node.line) : value,
          node.type,
          node.line,
        );
        record('write', node.line, scope, `Declare ${node.name}. ${describe(node)}`);
        return null;
      }
      case 'expr':
        evaluate(node.value, scope);
        record('snapshot', node.line, scope, describe(node));
        return null;
      case 'if': {
        const test = evaluate(node.test, scope);
        record(
          'compare',
          node.line,
          scope,
          `Condition is ${Boolean(test)}; ${test ? 'take the if branch' : 'take the else branch, if present'}.`,
        );
        return test ? execute(node.yes, scope) : node.no ? execute(node.no, scope) : null;
      }
      case 'while':
      case 'for': {
        const local = new Scope(scope);
        if (node.init) execute(node.init, local);
        while (true) {
          tick(node.line);
          const test = node.test ? evaluate(node.test, local) : true;
          record(
            'compare',
            node.line,
            local,
            `Loop condition is ${Boolean(test)}; ${test ? 'continue this iteration' : 'exit the loop'}.`,
          );
          if (!test) break;
          const flow = execute(node.body, local);
          if (flow?.kind === 'return') return flow;
          if (flow?.kind === 'break') break;
          if (node.update) {
            evaluate(node.update, local);
            record(
              'write',
              node.update.line,
              local,
              'Apply the loop update before checking the condition again.',
            );
          }
        }
        return null;
      }
      case 'return': {
        const value = node.value ? evaluate(node.value, scope) : null;
        if (value?.functionNode) fail('Returning functions is unsupported.', node.line);
        record('return', node.line, scope, `Return ${JSON.stringify(value)} from this function.`);
        return { kind: 'return', value };
      }
      case 'break':
      case 'continue':
        record('snapshot', node.line, scope, describe(node));
        return { kind: node.kind };
      default:
        fail('Unsupported statement.', node.line);
    }
  }
  record(
    'initial',
    null,
    global,
    'Start the restricted interpreter. Input JSON is available as input (JavaScript) or readInt("key").',
  );
  for (const node of ast.body) {
    const flow = execute(node, global);
    if (flow) fail('return/break/continue must be inside a function or loop.', node.line);
  }
  let returned = null;
  if (integerLanguage) {
    const main = global.binding('main', 1).value;
    const params = main.functionNode.params;
    if (params.length > 1 || (params.length === 1 && language !== 'java'))
      fail('Use main() in C, or main(String[] args) in Java.');
    returned = call(
      {
        kind: 'call',
        callee: { kind: 'identifier', name: 'main' },
        args: params.length ? [{ kind: 'array', elements: [], line: 1 }] : [],
        line: 1,
      },
      global,
    );
  }
  const result = { output, returned };
  record('complete', null, global, 'Execution finished within the configured limits.', { result });
  // The last local scope remains visible in preceding snapshots; globals are shown at completion.
  return { steps, result };
}
