export class ProgramError extends Error {
  constructor(message, line = 1) {
    super(`Line ${line}: ${message}`);
    this.name = 'ProgramError';
    this.line = line;
  }
}

const banned = new Set([
  '__proto__',
  'prototype',
  'constructor',
  'eval',
  'Function',
  'import',
  'export',
  'require',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'Worker',
  'globalThis',
  'window',
  'document',
  'self',
  'process',
  'Reflect',
  'Proxy',
  'this',
  'super',
  'async',
  'await',
  'delete',
  'try',
  'throw',
]);
function lex(source) {
  const tokens = [];
  let i = 0,
    line = 1;
  const add = (value, type = 'symbol', tokenLine = line) =>
    tokens.push({ value, type, line: tokenLine });
  while (i < source.length) {
    const c = source[i];
    if (/\s/.test(c)) {
      if (c === '\n') line++;
      i++;
      continue;
    }
    if (source.startsWith('//', i)) {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (source.startsWith('/*', i)) {
      const start = line;
      i += 2;
      while (i < source.length && !source.startsWith('*/', i)) {
        if (source[i] === '\n') line++;
        i++;
      }
      if (i === source.length) throw new ProgramError('Unclosed comment.', start);
      i += 2;
      continue;
    }
    if (c === '#') {
      const end = source.indexOf('\n', i),
        text = source.slice(i, end < 0 ? source.length : end);
      if (!/^#\s*include\s*<stdio\.h>\s*$/.test(text))
        throw new ProgramError('Only #include <stdio.h> is supported.', line);
      i = end < 0 ? source.length : end;
      continue;
    }
    if (c === '"' || c === "'") {
      const start = line,
        quote = c;
      let value = '';
      i++;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === '\n') throw new ProgramError('Newline in string literal.', line);
        if (source[i] === '\\') {
          i++;
          const escapes = { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'" };
          if (!(source[i] in escapes)) throw new ProgramError('Unsupported string escape.', line);
          value += escapes[source[i++]];
        } else value += source[i++];
      }
      if (source[i] !== quote) throw new ProgramError('Unclosed string.', start);
      i++;
      add(value, 'string', start);
      continue;
    }
    const number = source.slice(i).match(/^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/);
    if (number) {
      add(number[0], 'number');
      i += number[0].length;
      continue;
    }
    const identifier = source.slice(i).match(/^[A-Za-z_$][\w$]*/);
    if (identifier) {
      if (banned.has(identifier[0]))
        throw new ProgramError(`'${identifier[0]}' is not available in this playground.`, line);
      add(identifier[0], 'id');
      i += identifier[0].length;
      continue;
    }
    const operator = [
      '===',
      '!==',
      '++',
      '--',
      '+=',
      '-=',
      '*=',
      '/=',
      '%=',
      '==',
      '!=',
      '<=',
      '>=',
      '&&',
      '||',
    ].find((op) => source.startsWith(op, i));
    if (operator) {
      add(operator);
      i += operator.length;
      continue;
    }
    if ('{}[]();,.?:+-*/%<>=!'.includes(c)) {
      add(c);
      i++;
      continue;
    }
    throw new ProgramError(`Unsupported character '${c}'.`, line);
  }
  add('<eof>');
  return tokens;
}

const precedence = {
  '=': 1,
  '+=': 1,
  '-=': 1,
  '*=': 1,
  '/=': 1,
  '%=': 1,
  '||': 2,
  '&&': 3,
  '==': 4,
  '!=': 4,
  '===': 4,
  '!==': 4,
  '<': 5,
  '>': 5,
  '<=': 5,
  '>=': 5,
  '+': 6,
  '-': 6,
  '*': 7,
  '/': 7,
  '%': 7,
};
export function parseProgram(source, language) {
  if (!['javascript', 'java', 'c'].includes(language))
    throw new ProgramError('Choose JavaScript, Java or C.');
  if (typeof source !== 'string' || new TextEncoder().encode(source).length > 20000)
    throw new ProgramError('Source must be at most 20 KB.');
  const tokens = lex(source);
  let pos = 0,
    nesting = 0;
  const current = () => tokens[pos];
  const at = (value) => current().value === value;
  const take = (value) => (at(value) ? (pos++, true) : false);
  function expect(value) {
    if (!take(value))
      throw new ProgramError(`Expected '${value}', found '${current().value}'.`, current().line);
  }
  function id() {
    const token = current();
    if (token.type !== 'id')
      throw new ProgramError('Expected a variable or function name.', token.line);
    pos++;
    return token.value;
  }
  function type() {
    const token = current();
    if (!['int', 'boolean', 'bool', 'String', 'string', 'void'].includes(token.value))
      throw new ProgramError(
        'Supported types: int, boolean/bool, String/string, and arrays of these types.',
        token.line,
      );
    pos++;
    let name = token.value;
    if (take('[')) {
      expect(']');
      name += '[]';
    }
    return name;
  }
  function expression(min = 1) {
    if (++nesting > 100)
      throw new ProgramError('Expression nesting limit reached.', current().line);
    const token = current();
    let node;
    if (['!', '-', '+', '++', '--'].includes(token.value)) {
      pos++;
      node = {
        kind: token.value === '++' || token.value === '--' ? 'update' : 'unary',
        op: token.value,
        argument: expression(8),
        prefix: true,
        line: token.line,
      };
    } else if (take('(')) {
      node = expression();
      expect(')');
    } else if (take('[') || (language !== 'javascript' && take('{'))) {
      const close = tokens[pos - 1].value === '[' ? ']' : '}';
      const elements = [];
      if (!at(close))
        do {
          elements.push(expression(2));
        } while (take(','));
      expect(close);
      node = { kind: 'array', elements, line: token.line };
    } else if (take('new')) {
      expect('int');
      expect('[');
      const size = at(']') ? null : expression();
      expect(']');
      if (size) node = { kind: 'newArray', size, line: token.line };
      else {
        expect('{');
        const elements = [];
        if (!at('}'))
          do {
            elements.push(expression(2));
          } while (take(','));
        expect('}');
        node = { kind: 'array', elements, line: token.line };
      }
    } else if (token.type === 'number' || token.type === 'string') {
      pos++;
      node = {
        kind: 'literal',
        value: token.type === 'number' ? Number(token.value) : token.value,
        line: token.line,
      };
    } else if (['true', 'false', 'null'].includes(token.value)) {
      pos++;
      node = {
        kind: 'literal',
        value: token.value === 'null' ? null : token.value === 'true',
        line: token.line,
      };
    } else if (token.type === 'id') {
      pos++;
      node = { kind: 'identifier', name: token.value, line: token.line };
    } else throw new ProgramError(`Expected an expression, found '${token.value}'.`, token.line);
    while (true) {
      if (take('[')) {
        const property = expression();
        expect(']');
        node = { kind: 'member', object: node, property, computed: true, line: token.line };
      } else if (take('.'))
        node = { kind: 'member', object: node, property: id(), computed: false, line: token.line };
      else if (take('(')) {
        const args = [];
        if (!at(')'))
          do {
            args.push(expression(2));
          } while (take(','));
        expect(')');
        node = { kind: 'call', callee: node, args, line: token.line };
      } else if (at('++') || at('--')) {
        const op = current().value;
        pos++;
        node = { kind: 'update', argument: node, op, prefix: false, line: token.line };
      } else break;
    }
    while ((precedence[current().value] || 0) >= min) {
      const op = current().value;
      pos++;
      const right = expression(precedence[op] + (precedence[op] === 1 ? 0 : 1));
      node = {
        kind: precedence[op] === 1 ? 'assign' : 'binary',
        op,
        left: node,
        right,
        line: token.line,
      };
    }
    nesting--;
    return node;
  }
  function declaration(consumeSemicolon = true) {
    const token = current();
    let declaredType;
    if (['let', 'const', 'var'].includes(token.value)) {
      pos++;
      declaredType = token.value;
    } else declaredType = type();
    const name = id();
    if (take('(')) {
      const params = [];
      if (!at(')'))
        do {
          const paramType = language === 'javascript' ? 'let' : type();
          params.push({ name: id(), type: paramType });
        } while (take(','));
      expect(')');
      return {
        kind: 'function',
        name,
        params,
        body: block(),
        returnType: declaredType,
        line: token.line,
      };
    }
    let size = null;
    if (take('[')) {
      if (!at(']')) size = expression();
      expect(']');
      declaredType += '[]';
    }
    let value = take('=') ? expression() : null;
    if (!value && size) value = { kind: 'newArray', size, line: token.line };
    if (consumeSemicolon) expect(';');
    return { kind: 'declare', name, type: declaredType, value, line: token.line };
  }
  function block() {
    const line = current().line;
    expect('{');
    const body = [];
    while (!at('}') && !at('<eof>')) body.push(statement());
    expect('}');
    return { kind: 'block', body, line };
  }
  function statement() {
    if (++nesting > 100) throw new ProgramError('Statement nesting limit reached.', current().line);
    const line = current().line;
    let node;
    if (at('{')) node = block();
    else if (take(';')) node = { kind: 'empty', line };
    else if (take('function')) {
      if (language !== 'javascript')
        throw new ProgramError('Use typed function declarations.', line);
      const name = id();
      expect('(');
      const params = [];
      if (!at(')'))
        do {
          params.push({ name: id(), type: 'let' });
        } while (take(','));
      expect(')');
      node = { kind: 'function', name, params, returnType: 'let', body: block(), line };
    } else if (take('if')) {
      expect('(');
      const test = expression();
      expect(')');
      const yes = statement();
      node = { kind: 'if', test, yes, no: take('else') ? statement() : null, line };
    } else if (take('while')) {
      expect('(');
      const test = expression();
      expect(')');
      node = { kind: 'while', test, body: statement(), line };
    } else if (take('for')) {
      expect('(');
      let init = null;
      if (!at(';'))
        init = ['let', 'const', 'var', 'int', 'boolean', 'bool', 'String', 'string'].includes(
          current().value,
        )
          ? declaration(false)
          : { kind: 'expr', value: expression(), line };
      expect(';');
      const test = at(';') ? null : expression();
      expect(';');
      const update = at(')') ? null : expression();
      expect(')');
      node = { kind: 'for', init, test, update, body: statement(), line };
    } else if (take('return')) {
      node = { kind: 'return', value: at(';') ? null : expression(), line };
      expect(';');
    } else if (take('break')) {
      expect(';');
      node = { kind: 'break', line };
    } else if (take('continue')) {
      expect(';');
      node = { kind: 'continue', line };
    } else if (
      ['let', 'const', 'var', 'int', 'boolean', 'bool', 'String', 'string', 'void'].includes(
        current().value,
      )
    )
      node = declaration();
    else {
      node = { kind: 'expr', value: expression(), line };
      expect(';');
    }
    nesting--;
    return node;
  }
  const body = [];
  if (language === 'java') {
    take('public');
    expect('class');
    id();
    expect('{');
    while (!at('}') && !at('<eof>')) {
      take('public');
      take('private');
      take('static');
      body.push(declaration());
    }
    expect('}');
  } else while (!at('<eof>')) body.push(statement());
  expect('<eof>');
  return { kind: 'program', body };
}
