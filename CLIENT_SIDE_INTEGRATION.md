# Client-Side Execution Integration Guide

This guide explains how to integrate the client-side code execution engine with the existing CP Arena infrastructure (currently using Piston for server-side execution).

## Overview

The CP Arena currently uses a **server-side Piston judge** for code execution and testing. The client-side engine provides an alternative execution path that:

1. **Reduces server load** — offload simple runs to the browser
2. **Improves UX** — instant feedback without network latency
3. **Enables offline-like experience** — works even with high server load
4. **Supports iterative development** — fast code-test-debug cycles

## Architecture Integration

### Current Flow (Piston Server-Side)

```
User Code → Submit → Server (/api/submit) → Piston → Judge → Verdict + Score
```

### Proposed Hybrid Flow

```
User Code → Run Button (Try It) → Client Worker → Live Feedback
        ↘→ Submit Button → Server (/api/submit) → Piston → Official Verdict
```

## Integration Points

### 1. Code Editor Component

The existing `CodeEditor` component (used in solve pages) can be enhanced:

```typescript
// src/components/cp-arena/CodeEditor.tsx (existing)

import { useCodeExecution } from '@/lib/useCodeExecution';

export function CodeEditor({ problemId, language, code, onChange }) {
  const { execute, isExecuting, result } = useCodeExecution();

  const handleQuickRun = async () => {
    // Quick run against sample input (no submission)
    const sample = problem.samples[0];
    const result = await execute({
      language,
      code,
      stdin: sample.input,
      timeoutMs: problem.timeLimit || 2000,
    });
    // Show result in a panel
    showResult(result);
  };

  return (
    <>
      <CodeMirror value={code} onChange={onChange} />
      <button onClick={handleQuickRun} disabled={isExecuting}>
        {isExecuting ? 'Running...' : 'Try It'}
      </button>
      {result && <ExecutionOutput result={result} />}
    </>
  );
}
```

### 2. Test Case Evaluator

Integrate with the problem's sample test cases:

```typescript
// src/components/cp-arena/SampleTestsPanel.tsx (new)

import { useTestRunner } from '@/lib/useCodeExecution';
import type { TestCase } from '@/lib/testRunner';

export function SampleTestsPanel({ problem, code, language }) {
  const { runTests, isRunning, results } = useTestRunner();

  const sampleTestCases: TestCase[] = problem.samples.map((s, i) => ({
    id: `sample-${i + 1}`,
    input: s.input,
    expectedOutput: s.output,
  }));

  const handleRunTests = () => {
    runTests(language, code, sampleTestCases, {
      concurrent: false,
      timeoutMs: problem.timeLimit || 2000,
    });
  };

  return (
    <div className="bg-slate-900 rounded-lg p-4">
      <h3 className="text-lg font-semibold mb-4">Sample Test Cases</h3>
      
      <button
        onClick={handleRunTests}
        disabled={isRunning}
        className="mb-4 px-4 py-2 bg-green-600 rounded hover:bg-green-700 disabled:bg-gray-600"
      >
        {isRunning ? 'Running...' : 'Test Sample Cases'}
      </button>

      {results && (
        <div className="space-y-2">
          <div className="text-sm font-medium">
            Passed: {results.passed}/{results.total}
          </div>
          {results.results.map((result) => (
            <div
              key={result.testId}
              className={`p-2 rounded text-sm ${
                result.verdict === 'AC'
                  ? 'bg-green-900/30 text-green-300'
                  : result.verdict === 'WA'
                    ? 'bg-red-900/30 text-red-300'
                    : 'bg-orange-900/30 text-orange-300'
              }`}
            >
              <span className="font-mono font-semibold">{result.testId}</span>
              {' '} — {result.verdict}
              {result.verdict === 'WA' && (
                <details className="mt-1 text-xs">
                  <summary>Show output</summary>
                  <pre className="mt-1 p-1 bg-black/30 overflow-auto max-h-24">
                    {result.stdout}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 3. Quick Run vs Official Submit Flow

Modify the submission workflow:

```typescript
// src/app/cp-arena/solve/[slug]/page.tsx (existing)

export default function SolvePage() {
  const [showQuickRun, setShowQuickRun] = useState(false);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <ProblemStatement problem={problem} />
        {showQuickRun && (
          <SampleTestsPanel
            problem={problem}
            code={code}
            language={language}
          />
        )}
      </div>

      <div className="space-y-3">
        <button
          onClick={() => setShowQuickRun(!showQuickRun)}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded"
        >
          {showQuickRun ? 'Hide' : 'Show'} Sample Tests
        </button>

        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full px-4 py-2 bg-green-600 text-white rounded"
        >
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </div>
  );
}
```

## Implementation Steps

### Phase 1: Non-Invasive Addition (Minimal Risk)

1. **Add to Playground Page Only**
   - Deploy `CodePlayground` component at `/playground`
   - No changes to existing CP Arena infrastructure
   - Users can test the engine in isolation

2. **Gather Feedback**
   - Monitor which languages/features users test
   - Collect error reports and performance metrics
   - Identify edge cases

### Phase 2: Integration with Editor (Low Risk)

1. **Add "Try It" Button**
   - Add quick-run capability next to the existing submit button
   - Show results in a collapsible panel
   - Don't replace server submission flow

2. **Sample Test Runner**
   - Add "Test Sample Cases" button
   - Compare against expected sample outputs
   - Show pass/fail verdict

### Phase 3: Official Integration (Higher Impact)

1. **Pre-Check Before Submit**
   - Run sample tests automatically before user hits "Submit"
   - Warn if sample tests fail: "These samples don't pass. Submit anyway?"
   - Reduce WA verdicts and improve UX

2. **Speed-Bounty Optimization**
   - For speed-bounty scoring, instant client-side validation
   - Reduce Piston queue contention during peak hours
   - Official verdict still comes from server

## Feature Flags / Gradual Rollout

Use environment variables to control which features are active:

```typescript
// src/lib/featureFlags.ts
export const features = {
  CLIENT_SIDE_PLAYGROUND: process.env.NEXT_PUBLIC_ENABLE_PLAYGROUND === 'true',
  CLIENT_SIDE_QUICK_RUN: process.env.NEXT_PUBLIC_ENABLE_QUICK_RUN === 'true',
  CLIENT_SIDE_SAMPLE_TESTS: process.env.NEXT_PUBLIC_ENABLE_SAMPLE_TESTS === 'true',
  CLIENT_SIDE_PRECHECK: process.env.NEXT_PUBLIC_ENABLE_PRECHECK === 'true',
};

// In components:
{features.CLIENT_SIDE_QUICK_RUN && <QuickRunButton ... />}
```

In `wrangler.jsonc`:

```jsonc
{
  "env": {
    "staging": {
      "vars": {
        "NEXT_PUBLIC_ENABLE_PLAYGROUND": "true",
        "NEXT_PUBLIC_ENABLE_QUICK_RUN": "true"
      }
    },
    "production": {
      "vars": {
        "NEXT_PUBLIC_ENABLE_PLAYGROUND": "true",
        "NEXT_PUBLIC_ENABLE_QUICK_RUN": "true",
        "NEXT_PUBLIC_ENABLE_SAMPLE_TESTS": "true"
      }
    }
  }
}
```

## Migration Path for Existing Submission Routes

### Option A: Parallel Execution (Safest)

Keep Piston as the official judge; client-side is preview only:

```typescript
export async function submitCode(code, language, problemId) {
  // Client-side preview (optional, for UX)
  const clientResult = await executeClientSide(code, language, problem.samples);
  
  // Official server submission
  const serverResult = await fetch('/api/submit', {
    method: 'POST',
    body: JSON.stringify({ code, language, problemId }),
  });

  return serverResult; // Official verdict from Piston
}
```

### Option B: Fallback to Piston (Recommended)

Use client-side for quick feedback; fall back to Piston if needed:

```typescript
export async function submitCode(code, language, problemId) {
  // Try client-side for speed
  const clientResult = await executeClientSide(code, language, problem.allTests);
  
  if (clientResult.status === 'SUCCESS' && clientResult.verdict === 'AC') {
    // Fast path: looks good, but still verify on server
    return submitToServer(code, language, problemId);
  } else if (clientResult.status === 'TLE') {
    // TLE on client usually means TLE on server too
    return clientResult; // Early return, skip server
  } else {
    // WA or RE on client; let server double-check
    return submitToServer(code, language, problemId);
  }
}
```

## Monitoring & Telemetry

Add monitoring to understand usage patterns:

```typescript
// src/lib/telemetry.ts
export async function logCodeExecution(event: {
  language: SupportedLanguage;
  source: 'playground' | 'quick-run' | 'sample-tests' | 'precheck';
  status: ExecutionStatus;
  executionTimeMs: number;
  codeLength: number;
  errorType?: string;
}) {
  // Send to analytics backend (e.g., Vercel Analytics, Sentry, custom)
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'code_execution', event);
  }
}

// In CodePlayground or submission handlers:
await logCodeExecution({
  language: 'python',
  source: 'playground',
  status: result.status,
  executionTimeMs: result.executionTimeMs,
  codeLength: code.length,
});
```

## Troubleshooting

### Pyodide CDN Failures

If users report "Pyodide not loading":

1. Check browser DevTools → Network tab → look for 404s from `cdn.jsdelivr.net`
2. Fallback CDN option in `pythonRunner.worker.ts`:
   ```typescript
   const urls = [
     'https://cdn.jsdelivr.net/pyodide/',      // Primary
     'https://unpkg.com/pyodide/',              // Fallback 1
     'https://pyodide.org/en/stable/',          // Fallback 2 (self-hosted)
   ];
   ```

### Memory Issues on Low-End Devices

- Warn users if Pyodide is >50MB
- Offer JS-only mode for mobile
- Implement lazy loading: "Load Python runtime?" button

### Worker Script Loading Errors

If workers fail to load in production:

1. Check that `next.config.ts` CSP includes `worker-src 'self' blob:`
2. Ensure worker files are included in the build: `npm run build`
3. Test with `wrangler dev` before deploying to Cloudflare

## Performance Baseline

Expected metrics for reference:

| Metric | Value |
|--------|-------|
| JS Worker Init | ~5ms |
| Python Worker Init (first) | ~2-3s (Pyodide download + init) |
| Python Worker Init (cached) | ~50ms (from cache) |
| Simple JS Execution | 5-20ms |
| Python Execution (no stdlib) | 20-100ms |
| Pyodide CDN Download | 5-15s (50MB) |

## Security Considerations

When exposing user code execution in the browser:

1. **XSS in Error Messages**: Sanitize error output before rendering
2. **Resource Abuse**: Monitor worker memory usage; terminate if >100MB
3. **Infinite Loops**: Hard timeout at `timeoutMs + 1000ms` prevents UI freeze
4. **Code Injection**: Users control the code, so this is by design (sandboxed)

## Rollback Plan

If client-side execution causes issues:

1. **Disable at Feature Flag**: Set `NEXT_PUBLIC_ENABLE_PLAYGROUND=false`
2. **Disable Worker Script**: Return empty blob from `/api/worker-script`
3. **Full Revert**: `git revert <commit>` (only 1 commit since branch created)

All changes are isolated to new files and hooks; existing Piston flow is untouched.

## Next Steps

1. Review this integration guide with the team
2. Deploy Phase 1 (Playground only) to staging
3. Collect feedback for 1-2 weeks
4. Plan Phase 2 if metrics are positive
5. Plan full integration timeline

## References

- [CLIENT_SIDE_EXECUTION.md](./CLIENT_SIDE_EXECUTION.md) — Technical details
- [Existing CP Arena Architecture](./CLAUDE.md) — See §7 (CP Arena)
- [Piston Judge Implementation](./src/server/judge.ts)
- [Submit Route](./src/app/api/submit/route.ts)
