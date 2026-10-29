# Phase 6 — Custom program playground

The public `/custom-code` page now accepts pasted programs and local `.js`, `.java` and `.c` file uploads. It interprets a documented teaching subset in a separate browser Worker and returns the same Step format used by the library. Output, source-line highlighting, variable watch, numeric-array animation and the searchable dry-run table are connected to the real execution trace. There is no backend code-execution endpoint and no new dependency or API key.

## Scope decision: interpreted teaching subset

The Java/C plan originally proposed an isolated compiler service. This machine has Java/C compilers but no configured isolated runner. Running uploads through those host compilers would not meet the isolation design. Piston's official README now requires public API authorization and excludes portfolio projects; do not assume that endpoint is an available free service: https://github.com/engineer-man/piston . Judge0 is another compiler-service option, but none is configured or verified for this project: https://github.com/judge0/judge0 .

To provide working Java/C learning support without sending code elsewhere, this phase instead implements a small interpreter for a shared educational language subset. It executes the parsed program, not a guessed library algorithm. The UI prominently labels it **“Teaching subset · interpreted, not compiled.”** It is not a standards-compliant JavaScript engine, Java JVM/compiler, C compiler or debugger. General-purpose native Java/C execution and native debugger-backed tracing remain unimplemented; they require separate isolated infrastructure. Do not describe this project as supporting arbitrary Java/C programs.

## Start and verify

From `C:\coding\dsa project`:

```powershell
npm ci
npm run dev:client
```

Open http://localhost:5173/custom-code. Custom execution works without the backend; start `npm run dev:server` in another terminal when using account features.

1. Run the default Java example: output must be `Sum: 14`.
2. Click Next: the array appears on its declaration line. Continue to the sum assignment, select `sum` in Variable watch and inspect 0 → 4 → 6 → 13 → 14 across recorded steps.
3. Choose C and run its example; verify the same output and return value 0.
4. Choose JavaScript and run with Input JSON `{"values":[4,2,7,1]}`.
5. Upload `docs/examples/sum.c` or `docs/examples/Main.java`; the language is detected from the extension. JavaScript example upload needs the Input JSON shown above because upload resets input to `{}`.
6. Try `while(true){}` in JavaScript mode: it must fail with a bounded step-limit error rather than freeze the page. Try `fetch("https://example.com");`: it must be rejected.
7. Edit source or input while running, switch language, or leave the page: old workers are terminated and stale results cannot replace the current run.

```powershell
npm test
npm run lint
npm run format:check
npm run build
```

The production build must emit a separate `runner.worker-*.js` asset. The Worker constructor is deliberately static so Vite bundles its imports; the unit-test worker substitute does not replace that production construction path.

## Supported syntax

All languages require explicit semicolons. Comments, scalar literals, arithmetic/comparison/logical expressions, assignments, ++/--, if/else, for/while, break/continue, function declarations/calls, recursion and one-dimensional arrays are supported. No pointers, closures returned as values, objects/classes with behavior, modules, exceptions, callbacks, async code, DOM, networking or system access.

| Mode       | Supported examples                                                                                                                                                                | Important limitations                                                                                                                                                                                                                                                                      |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| JavaScript | `let`, `const`, `var`, `function f(n){return n*2;}`, `[1,2]`, `arr.length`, push/pop/shift/unshift, `console.log`                                                                 | Declarations use lexical block scopes, including `var`; no hoisting, automatic semicolon insertion, object literals, destructuring, template literals or arrow functions. Equality is strict even when written `==`. Reads outside the array are rejected rather than returning undefined. |
| Java       | `public class Main { public static void main(String[] args) { ... } }`, typed helper functions, int/boolean/String variables and arrays, `new int[n]`, `System.out.println/print` | Teaching syntax only; no imports, Scanner, objects, inheritance, generics, floating-point variables or full compiler type checking. Integer overflow is rejected rather than wrapped.                                                                                                      |
| C          | `#include <stdio.h>`, `int main(){...return 0;}`, typed helper functions, `int arr[4]`, `int arr[]={1,2}`, basic printf `%d`, `%f`, `%s`, `%%`                                    | No pointers, structs, scanf, macros or other headers; printf formatting is simplified. This subset initializes uninitialized integers/arrays to zero and rejects signed overflow, rather than modeling C undefined behavior.                                                               |

The shared typed subset also accepts bool/boolean and string/String spellings, so its syntax is intentionally broader than the native languages in places. Conditions and logical operations follow interpreter truthiness; this is not full Java boolean checking. Numeric literals and arithmetic in Java/C mode must remain 32-bit integers; division truncates toward zero. JavaScript numeric results must be finite and within ±1e12.

Selected Math functions: abs, min, max, floor, ceil, sqrt, pow. No host function or object is exposed to the submitted program. Function values cannot be assigned, passed, returned or inspected. Array methods accept only scalar values; nested arrays may come from input but nested array writes are unsupported.

Input is JSON. JavaScript can read `input.values` or `input.n`. All modes have the explicit playground helper `readInt("n")` to read an integer key from input. That helper is not standard Java/C syntax and is labeled accordingly. Object fields in input are read-only; arrays can be assigned to local variables and edited. Snapshots label undefined as the string `"undefined"`, including nested array elements, to preserve JSON serialization.

## Tracing and animation

The parser retains original one-based source line numbers, including comments and the C include line. The interpreter records declarations, completed expression statements, tested conditions, loop updates and returns. Write/expression explanations include a short summary of changed variable values. Nested function calls can produce additional intermediate snapshots. Multiple operations on the same source line are distinct steps. It does not claim to capture every machine instruction or compiler optimization.

Snapshots include visible variables from the current lexical scope; local variables disappear after scope exit. Completion shows global variables and a result object with output and main's return value. Use earlier snapshots to inspect main-local state. Function closures are kept internal, not serialized. Variable shadowing displays the innermost binding. Scope-qualified simultaneous watches are not implemented.

Choose a numeric array variable name to animate. A live array of at most 64 finite numbers becomes an array view with changed-index highlights; otherwise the step uses the variables-only code view. The same player handles both kinds as the array enters/leaves scope. Non-sorting custom programs can change array values as well as positions. No graph/tree inference is attempted for arbitrary source code.

## Isolation and budgets

```text
source/file + JSON input
  -> fresh dedicated Worker
  -> tokenizer -> parser -> allowlisted AST interpreter
  -> bounded copied Step[] + output
  -> worker terminated -> shared TracePlayer
```

The Worker never evaluates the source with eval/Function or forwards it to a shell/compiler. Interpreter values are primitive data, arrays, sanitized input objects and internal function records. Property access rejects prototype-related names, function internals and unapproved methods. Programs have no reference to browser/Worker globals. The interpreter is the capability boundary; a Worker alone is not a security boundary.

| Limit                               | Value                                                |
| ----------------------------------- | ---------------------------------------------------- |
| Source/file and JSON input          | 20 KB each                                           |
| Snapshot count                      | 2,000, including initial/complete                    |
| Interpreter operations              | 100,000, including expressions and empty-loop checks |
| Parent wall timeout                 | 2 seconds, including worker startup                  |
| Function call depth                 | 50                                                   |
| Parser nesting                      | 100                                                  |
| Input nesting                       | 10                                                   |
| Array length                        | 1,000; visualization up to 64                        |
| String length                       | 4,096 characters                                     |
| Cumulative serialized snapshot size | 2 MiB                                                |
| Printed output                      | 16 KB                                                |

Stop, timeout, completion, error, input edits and unmount terminate the Worker. Every run has an ID; mismatched and late messages are ignored. The browser may delay timers in background tabs; these limits are application guardrails, not hard real-time or OS process-memory isolation. No partial trace is reported as successful after a limit error. Source is kept in page memory, not sent to the server or persisted; reloading clears the editor.

## Files

- `client/src/pages/CustomCode.jsx`: language/source/input editor, local file loading, lifecycle controls and shared playback.
- `client/src/workers/parser.js`: tokenization, syntax validation, source lines and AST construction.
- `client/src/workers/interpreter.js`: scopes, bounded execution, data-only snapshots and output.
- `client/src/workers/runner.worker.js`: Worker message entrypoint.
- `client/src/workers/workerClient.js`: timeout, cancellation, run IDs and termination.
- `client/src/workers/examples.js`: runnable built-in programs.
- `client/src/workers/interpreter.test.js`: actual program results, schema checks, history preservation, lexical scope, typed operations, forbidden capabilities and resource limits.
- `client/src/workers/workerClient.test.js`: timeout, cancellation and stale-message behavior.
- `docs/examples/`: uploadable Java/C/JavaScript samples.

## Interview summary

An allowlisted AST interpreter executes educational source without giving it browser, filesystem or network capabilities.
The Worker keeps execution off the UI thread, while both operation budgets and parent termination bound runaway programs.
Every supported language emits the same snapshots, so source highlighting, variable history and playback share the existing interface.

Suggested commit: `feat(playground): add bounded worker interpreter and program upload tracing`.
