# Client-Side Code Execution Engine

A comprehensive, production-grade client-side code execution engine for running Python and JavaScript directly in the browser with WebAssembly support, Web Workers, and strict execution timeout handling.

## Overview

This implementation provides:

- **Python Execution** via [Pyodide](https://pyodide.org/) (WebAssembly)
- **JavaScript Execution** via isolated Web Workers
- **Stdin/Stdout/Stderr Capture** for all execution
- **Time Limit Exceeded (TLE) Handling** with hard worker termination
- **Main-Thread Protection** — all computation happens in background workers
- **Comprehensive Test Runner** for batch test case evaluation
- **React Hooks & Components** for seamless integration

## Architecture

### Directory Structure

```
src/
├── workers/
│   ├── jsRunner.worker.ts       # JavaScript execution worker
│   └── pythonRunner.worker.ts   # Python execution worker (Pyodide)
├── lib/
│   ├── codeExecution.ts         # Core execution manager
│   ├── codeExecution.test.ts    # Execution manager tests
│   ├── testRunner.ts            # Test case runner utility
│   ├── testRunner.test.ts       # Test runner tests
│   └── useCodeExecution.ts      # React hooks
├── components/
│   └── CodePlayground.tsx       # Demo UI component
└── app/
    └── playground/
        └── page.tsx             # Playground page
```

## Core Components

### 1. Execution Managers

#### `CodeExecutionManager` (`src/lib/codeExecution.ts`)

Unified interface for code execution across languages:

```typescript
interface ExecutionRequest {
  language: 'javascript' | 'python';
  code: string;
  stdin?: string;
  timeoutMs?: number; // Default 2000ms
}

type ExecutionStatus = 'SUCCESS' | 'TLE' | 'RUNTIME_ERROR' | 'INITIALIZATION_ERROR';

type ExecutionResult = {
  status: ExecutionStatus;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  error?: string;
};

const manager = new CodeExecutionManager();
const result = await manager.execute({
  language: 'python',
  code: 'print("Hello from Python")',
  timeoutMs: 5000,
});
```

**Key Features:**
- Automatic worker initialization and pooling
- Hard timeout enforcement with worker termination
- Accurate execution time measurement
- Graceful error handling with detailed error messages

### 2. Test Runner

#### `TestRunner` (`src/lib/testRunner.ts`)

Batch evaluation of multiple test cases with automatic verdict assignment:

```typescript
interface TestCase {
  id: string;
  input: string;
  expectedOutput: string;
}

type TestVerdictType = 'AC' | 'WA' | 'TLE' | 'RE' | 'CE';

const testRunner = new TestRunner(executionManager);

const batchResult = await testRunner.runBatchTests(
  'python',
  userCode,
  [
    { id: 'test1', input: '5', expectedOutput: '120' },
    { id: 'test2', input: '3', expectedOutput: '6' },
  ],
  { concurrent: false, timeoutMs: 5000 }
);

// Result:
// {
//   passed: 1,
//   total: 2,
//   results: [
//     { testId: 'test1', verdict: 'AC', executionTimeMs: 45, ... },
//     { testId: 'test2', verdict: 'WA', executionTimeMs: 32, stdout: '5', ... }
//   ]
// }
```

**Verdict Types:**
- **AC** (Accepted) — Correct output within time limit
- **WA** (Wrong Answer) — Output doesn't match expected
- **TLE** (Time Limit Exceeded) — Execution exceeded timeout
- **RE** (Runtime Error) — Unhandled exception or crash
- **CE** (Compilation Error) — Syntax error or initialization failure

**Output Matching:**
- Whitespace-normalized comparison
- Trailing newlines trimmed
- Empty lines ignored

### 3. React Hooks

#### `useCodeExecution()` (`src/lib/useCodeExecution.ts`)

Hook for single-execution code runs:

```typescript
export function MyComponent() {
  const { execute, isExecuting, result, error } = useCodeExecution();

  const handleRun = async () => {
    const result = await execute({
      language: 'javascript',
      code: 'console.log("Test");',
      timeoutMs: 3000,
    });
  };

  return (
    <>
      <button onClick={handleRun} disabled={isExecuting}>
        Run Code
      </button>
      {result && <pre>{result.stdout}</pre>}
      {error && <div className="error">{error}</div>}
    </>
  );
}
```

#### `useTestRunner()`

Hook for batch test case evaluation:

```typescript
export function TestBench() {
  const { runTests, isRunning, results } = useTestRunner();

  const handleRunTests = async () => {
    await runTests(
      'python',
      userCode,
      testCases,
      { concurrent: false, timeoutMs: 5000 }
    );
  };

  return (
    <>
      <button onClick={handleRunTests} disabled={isRunning}>
        Run All Tests
      </button>
      {results && (
        <div>
          Passed: {results.passed}/{results.total}
        </div>
      )}
    </>
  );
}
```

## Usage Examples

### Example 1: Basic JavaScript Execution

```typescript
const manager = new CodeExecutionManager();

const result = await manager.execute({
  language: 'javascript',
  code: `
    const arr = [1, 2, 3, 4, 5];
    console.log(arr.reduce((a, b) => a + b, 0));
  `,
  timeoutMs: 2000,
});

console.log(result);
// Output: { status: 'SUCCESS', stdout: '15', stderr: '', executionTimeMs: 12, ... }
```

### Example 2: Python with Stdin

```typescript
const result = await manager.execute({
  language: 'python',
  code: `
    n = int(input())
    print(n * 2)
  `,
  stdin: '42',
  timeoutMs: 3000,
});

console.log(result.stdout); // '84'
```

### Example 3: Testing Factorial Function

```typescript
const code = `
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

n = int(input())
print(factorial(n))
`;

const testCases = [
  { id: 'test1', input: '5', expectedOutput: '120' },
  { id: 'test2', input: '0', expectedOutput: '1' },
  { id: 'test3', input: '10', expectedOutput: '3628800' },
];

const results = await testRunner.runBatchTests('python', code, testCases);
console.log(`Passed: ${results.passed}/${results.total}`);
```

### Example 4: Handling Infinite Loops

```typescript
const result = await manager.execute({
  language: 'javascript',
  code: 'while (true) {}',
  timeoutMs: 1000,
});

console.log(result.status); // 'TLE'
console.log(result.error);  // 'Time limit exceeded'
```

## Web Workers

### JavaScript Worker (`src/workers/jsRunner.worker.ts`)

- Intercepts `console.log`, `console.error`, `console.warn`
- Buffers output and captures into `stdout`/`stderr`
- Supports basic stdin simulation via function arguments
- Handles syntax errors and runtime exceptions gracefully

### Python Worker (`src/workers/pythonRunner.worker.ts`)

- Dynamically loads Pyodide from CDN (lazy initialization)
- Redirects `sys.stdout` and `sys.stderr` via StringIO
- Handles `input()` and `sys.stdin` for interactive programs
- Graceful partial output capture on errors

## Configuration

### Content Security Policy (CSP)

The project's CSP headers already include:

```
worker-src 'self' blob:
script-src ... https://cdn.jsdelivr.net  (for Pyodide)
connect-src ... https://cdn.jsdelivr.net
```

If deploying elsewhere, ensure these are configured.

### Environment

No additional environment variables required. Workers load Pyodide from a public CDN (jsDelivr):

```
https://cdn.jsdelivr.net/pyodide/v0.25.1/full/
```

To use a different CDN or self-host Pyodide, update the URL in `src/workers/pythonRunner.worker.ts`.

## Performance Considerations

### Memory & CPU

- **JavaScript**: Lightweight, ~100KB worker overhead
- **Python**: Pyodide is ~50MB on first load (cached by browser)
- **Timeout Enforcement**: Hard timeout at `timeoutMs + 1000ms` (1s grace period for cleanup)

### Optimization Tips

1. **Reuse Manager**: Use a singleton via `getExecutionManager()` to avoid creating multiple workers
2. **Sequential Tests**: For dependent tests, use `concurrent: false` in `runBatchTests()`
3. **Timeout Tuning**: Set `timeoutMs` based on problem constraints (e.g., 2s for fast problems, 5s for complex)

## Error Handling

### Common Scenarios

| Status | Cause | Handling |
|--------|-------|----------|
| `SUCCESS` | Execution completed within timeout | Check `stdout` for results |
| `TLE` | Soft timeout (in worker) or hard timeout (worker terminated) | Verdict: `TLE`, time >= `timeoutMs` |
| `RUNTIME_ERROR` | Unhandled exception, stack overflow, or crash | Check `error` and `stderr` for details |
| `INITIALIZATION_ERROR` | Worker failed to load or initialize | Check browser console; may indicate CDN issues |

### Handling Errors in React

```typescript
const { result, error } = useCodeExecution();

if (error) {
  return <div className="alert alert-error">{error}</div>;
}

if (result?.status === 'RUNTIME_ERROR') {
  return <div className="alert alert-warning">{result.error}</div>;
}

if (result?.status === 'TLE') {
  return <div className="alert alert-warning">Time Limit Exceeded</div>;
}
```

## Testing

Run the included test suite:

```bash
npm test
```

Tests cover:
- JavaScript execution (basic, errors, infinite loops, timing)
- Python execution (pending Pyodide import in test environment)
- Test runner verdict logic
- Output normalization
- Error handling

## Limitations & Future Improvements

### Current Limitations

1. **Pyodide Size**: ~50MB on first load. Consider lazy-loading or pre-warming
2. **No Module Support**: User code cannot `import` external libraries (beyond stdlib)
3. **No Networking**: Sockets and HTTP calls are blocked
4. **Memory Cap**: Worker memory is browser-dependent; extremely large data structures may fail

### Potential Improvements

1. **Worker Pool**: Reuse terminated workers for faster subsequent runs
2. **Custom Packages**: Pre-build Pyodide with popular libraries (numpy, pandas)
3. **Debugger Integration**: Step-through debugging via DevTools
4. **Output Streaming**: Real-time stdout/stderr as code executes
5. **Shared Memory**: Use SharedArrayBuffer for efficient data passing

## Browser Compatibility

- **Chrome/Edge/Firefox/Safari**: Full support (Workers + WebAssembly required)
- **Mobile**: Supported but slower on low-end devices
- **Minimum**: ES2020 (async/await, Promise.race, etc.)

## Security

The execution model is fundamentally sandboxed by the browser's worker isolation:

- User code runs in a separate thread, not the main UI thread
- No access to the DOM or global state
- Network requests blocked by default
- Filesystem access unavailable
- Hard timeout prevents infinite loops from freezing the UI

**Note**: Pyodide runs Python code natively; `eval()`-style attacks are still possible but constrained to the worker thread.

## Demo

Visit `/playground` to try the interactive demo (`CodePlayground` component).

Features:
- Language selector (JavaScript | Python)
- Code editor with sample programs
- Custom stdin input
- Test case builder
- Live execution results with timing

## Contributing

When extending this engine:

1. **Worker Changes**: Update corresponding `.test.ts` file
2. **New Languages**: Create `<lang>Runner.worker.ts` + extend `SupportedLanguage` type
3. **Hook Changes**: Update React component tests
4. **CSP Updates**: Keep `next.config.ts` CSP in sync with external CDN URLs

## References

- [Pyodide Documentation](https://pyodide.org/)
- [Web Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [Worker Threads vs Main Thread](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
