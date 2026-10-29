import { describe, it, expect } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import schema from '../../../docs/step.schema.json';
import { runProgram } from './interpreter';
import { examples } from './examples';
const validate = new Ajv2020({ strict: true, allowUnionTypes: true }).compile(schema);
const run = (source, language = 'javascript', input = {}) =>
  runProgram({ source, language, input });
describe('real custom program traces', () => {
  it.each(['javascript', 'java', 'c'])(
    '%s example computes sum and emits the shared step schema',
    (language) => {
      const result = runProgram({ ...examples[language], language });
      expect(result.result.output).toBe('Sum: 14\n');
      expect(result.steps[0].type).toBe('initial');
      expect(result.steps.at(-1).type).toBe('complete');
      for (const [i, step] of result.steps.entries()) {
        expect(validate(step), JSON.stringify(validate.errors)).toBe(true);
        expect(step.index).toBe(i);
        if (step.line !== null)
          expect(step.line).toBeLessThanOrEqual(examples[language].source.split('\n').length);
      }
      expect(result.steps.some((s) => s.variables.sum === 14)).toBe(true);
      expect(result.steps.some((s) => s.view.kind === 'array')).toBe(true);
    },
  );
  it('records an uploaded-style bubble sort with mutation and unchanged historical snapshots', () => {
    const source =
      'let arr = input.values;\nfor (let i=0; i<arr.length; i++) {\n for (let j=0; j<arr.length-i-1; j++) {\n  if (arr[j] > arr[j+1]) {\n   let temp=arr[j];\n   arr[j]=arr[j+1];\n   arr[j+1]=temp;\n  }\n }\n}\nconsole.log(arr);';
    const input = { values: [4, 1, 3, 2] };
    const trace = runProgram({ source, input, visualVariable: 'arr' });
    expect(trace.result.output).toBe('[1,2,3,4]\n');
    expect(trace.steps.find((s) => s.view.kind === 'array').view.values).toEqual([4, 1, 3, 2]);
    expect(input.values).toEqual([4, 1, 3, 2]);
  });
  it('handles recursion, local scopes and returns', () => {
    const trace = run(
      'function fact(n) { if(n<=1) return 1; return n*fact(n-1); } let answer=fact(5); console.log(answer);',
    );
    expect(trace.result.output).toBe('120\n');
    expect(trace.steps.some((s) => s.variables.n === 3)).toBe(true);
    expect(() => run('if(true){let local=3;} console.log(local);')).toThrow(/Unknown variable/);
  });
  it('encodes nested undefined values as JSON-safe labels and preserves typed array writes', () => {
    const trace = run('let x;let a=[x];');
    expect(trace.steps.find((s) => s.variables.a).variables.a).toEqual(['undefined']);
    trace.steps.forEach((step) => expect(validate(step)).toBe(true));
    expect(() => run('int main(){int a[1];a[0]="bad";return 0;}', 'c')).toThrow(/32-bit int/);
  });
  it('supports typed C and Java functions and input helpers', () => {
    expect(
      run(
        'int twice(int n){return n*2;} int main(){int n=readInt("n");printf("%d",twice(n));return 0;}',
        'c',
        { n: 7 },
      ).result.output,
    ).toBe('14');
    expect(
      run(
        'public class Main { public static int twice(int n){return n*2;} public static void main(String[] args){int n=readInt("n");System.out.println(twice(n));}}',
        'java',
        { n: 6 },
      ).result.output,
    ).toBe('12\n');
  });
  it('applies integer division and zero initialization in the Java/C teaching subset', () => {
    expect(
      run('int main(){int arr[2];arr[0]=7/2;printf("%d %d",arr[0],arr[1]);return 0;}', 'c').result
        .output,
    ).toBe('3 0');
    expect(run('let x=7/2; console.log(x);').result.output).toBe('3.5\n');
  });
  it('handles break, continue, while and short-circuit conditions', () => {
    expect(
      run(
        'let i=0;let sum=0;while(i<10){i++;if(i==2)continue;if(i==5)break;sum+=i;} if(false && missing) sum=99;console.log(sum);',
      ).result.output,
    ).toBe('8\n');
  });
  it('supports whitelisted array operations and Math without exposing host functions', () => {
    expect(
      run('let a=[1];a.push(2);let x=a.pop();a.unshift(3);console.log(a,Math.max(x,7));').result
        .output,
    ).toBe('[3,1] 7\n');
  });
});
describe('sandbox rejection and budgets', () => {
  it.each([
    'fetch("https://example.com");',
    'window.alert(1);',
    'document.body;',
    'new Worker("x");',
    'let x=Function("return 1");',
    'let a=[];a["constructor"];',
    'let a=[];a["__proto__"];',
    'import x from "x";',
    'let a=[];a.map(1);',
    'console.log(input.constructor);',
  ])('rejects forbidden capabilities: %s', (source) => expect(() => run(source)).toThrow());
  it('rejects function internals, redeclaration and const reassignment', () => {
    expect(() => run('function f(){return 1;} console.log(f.closure);')).toThrow(/internals/);
    expect(() => run('let a=1;let a=2;')).toThrow(/already declared/);
    expect(() => run('const a=1;a=2;')).toThrow(/const/);
  });
  it('stops empty infinite loops and deep recursion', () => {
    expect(() => run('while(true){}')).toThrow(/Step limit/);
    expect(() => run('function f(){return f();}f();')).toThrow(/depth limit/);
  });
  it('counts expression work even when no statement snapshot completes', () => {
    expect(() => run('function f(n){if(n<1)return 0;return f(n-1)+f(n-1);}let x=f(18);')).toThrow(
      /limit/,
    );
  });
  it('enforces the operation budget independently of snapshot count', () => {
    const values = Array(1000).fill('1').join(',');
    expect(() => run(`let i=0;while(i<200){let a=[${values}];i++;}`)).toThrow(/Operation limit/);
  });
  it('rejects out-of-bounds access, oversized arrays, invalid arithmetic and integer overflow', () => {
    expect(() => run('let a=[1];a[2]=3;')).toThrow(/bounds/);
    expect(() => run('int main(){int a[1001];return 0;}', 'c')).toThrow(/Array size/);
    expect(() => run('let x=1/0;')).toThrow(/Division by zero/);
    expect(() => run('int main(){int a=2147483647;a++;return 0;}', 'c')).toThrow(/overflow/);
  });
  it('enforces source, output and snapshot budgets', () => {
    expect(() => run(' '.repeat(20001))).toThrow(/20 KB/);
    expect(() =>
      run('let text="' + 'x'.repeat(1000) + '";for(let i=0;i<20;i++){console.log(text);}'),
    ).toThrow(/Output limit/);
    expect(() =>
      run('int main(){int arr[1000];for(int i=0;i<1000;i++){arr[0]=i;}return 0;}', 'c'),
    ).toThrow(/Snapshot budget/);
  });
  it('rejects unsupported constructs with a line number', () => {
    expect(() => run('let a=1;\nlet f=(x)=>x;')).toThrow(/Line 2/);
    expect(() => run('int main(){int *p;return 0;}', 'c')).toThrow(/Line 1/);
    expect(() =>
      run('public class Main {public static void main(String[] args){double x=1.5;}}', 'java'),
    ).toThrow(/Line 1/);
  });
});
