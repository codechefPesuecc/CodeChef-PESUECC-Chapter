# Client-Side Execution Integration Guide

The client-side code execution engine is now **fully integrated** into the CP Arena. This guide explains how it works and how to extend it.

## Overview

The CP Arena now uses a **hybrid execution model**:

1. **Python & JavaScript** — runs instantly in the browser via Web Workers (no server latency)
2. **Other languages** — uses the existing server-side Piston judge (C++, Java, C, C#, Go, Rust, Zig)

### Architecture

```
User Code → Run Button
         ├→ Python/JavaScript → Client Web Worker → Instant Feedback
         └→ Other Languages → Server (/api/run) → Piston → Verdict
```

This provides:
- **Instant feedback** for Python and JavaScript development
- **Reduced server load** — browser handles simple runs
- **No breaking changes** — other languages work exactly as before
- **Fast iteration** — edit-run-debug cycles are near-instant

## Current Implementation

The client-side execution engine is **already integrated** into `ArenaWorkspace` (`src/components/cp-arena/ArenaWorkspace.tsx`). Here's how it works:

### Run Button Flow

```typescript
const run = async () => {
  // Python and JavaScript use client-side execution
  if (language === "python" || language === "javascript") {
    const result = await clientExecute({
      language,
      code,
      stdin,
      timeoutMs: 5000,
    });
    // Map result status to verdict (TLE, RE, CE, AC, WA, RAN)
    // Display in the judgement panel
  }

  // All other languages fall back to Piston
  else {
    const res = await fetch("/api/run", { /* ... */ });
    // Use existing Piston flow
  }
};
```

### Verdict Mapping

| Client Status | Arena Verdict | Display |
|---|---|---|
| `SUCCESS` | `AC` (if matches sample) or `WA` | Output shown |
| `TLE` | `TLE` | "Exceeded the 5.0s time limit." |
| `RUNTIME_ERROR` | `RE` | Stderr shown |
| `INITIALIZATION_ERROR` | `CE` | Error shown |

### Key Files

- **Integration point:** `src/components/cp-arena/ArenaWorkspace.tsx` (the `run` function)
- **Hook:** `src/lib/useCodeExecution.ts` (the `useCodeExecution` hook)
- **Workers:** `src/workers/jsRunner.worker.ts` and `src/workers/pythonRunner.worker.ts`

## Extending the Engine

### Adding More Languages

To add support for another language via WebAssembly:

1. **Create a new worker** (`src/workers/langRunner.worker.ts`):
   ```typescript
   type LangWorkerMessage = { id: string; code: string; stdin?: string; };
   type LangWorkerResponse = { id: string; success: boolean; stdout: string; stderr: string; };

   self.onmessage = async (event: MessageEvent<LangWorkerMessage>) => {
     // Load runtime, execute code, capture output
     self.postMessage(response);
   };
   ```

2. **Update `codeExecution.ts`**:
   ```typescript
   export type SupportedLanguage = 'javascript' | 'python' | 'rust'; // Add 'rust'

   private initializeWorkers() {
     this.rustWorker = new Worker(
       new URL('../workers/rustRunner.worker.ts', import.meta.url),
       { type: 'module' }
     );
     // ...
   }
   ```

3. **Update `ArenaWorkspace.tsx`**:
   ```typescript
   if (language === "python" || language === "javascript" || language === "rust") {
     // Use client-side execution
   }
   ```

### Fallback to Piston

If a language's Web Worker fails or isn't available, it automatically falls back to the server-side Piston judge. No additional configuration needed.

## Submit vs Run

**Important distinction:**

- **Run Button** (`/api/run`):
  - Uses client-side execution for Python/JavaScript
  - Falls back to Piston for other languages
  - No scoring, no submission record
  - Instant feedback

- **Submit Button** (`/api/submit`):
  - Always uses server-side Piston (hidden tests)
  - Creates official submission record
  - Counts toward leaderboard and speed bounty
  - Proctoring checks apply

The submit flow is **unchanged**. This integration only affects the "run" button for quick feedback.

## Performance Characteristics

### Client-Side Execution (Python/JavaScript)

| Metric | Typical | Notes |
|--------|---------|-------|
| First run | 2-3s | Pyodide download + init (cached) |
| Subsequent runs | 20-100ms | Pure execution time |
| JS execution | 5-20ms | Very fast for simple code |
| Python startup | 50ms | After Pyodide init |
| Network latency | 0ms | Browser-local |

### Server-Side Execution (Other Languages)

| Metric | Typical | Notes |
|--------|---------|-------|
| Network round-trip | 100-300ms | To/from judge |
| Compilation | 50-500ms | Language-dependent |
| Execution | 10-1000ms | Problem-dependent |
| **Total** | 200-2000ms | Network + judge |

**Benefit:** Python/JavaScript users get instant feedback (after initial Pyodide load). Other language users see no change.

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

If client-side execution causes issues in production:

### Quick Rollback (5 minutes)

Temporarily disable client-side execution for specific languages:

```typescript
// src/components/cp-arena/ArenaWorkspace.tsx
if (false && (language === "python" || language === "javascript")) {
  // Temporarily disabled
} else {
  // Fall back to Piston for all languages
}
```

Then redeploy with this change.

### Full Rollback

Revert the feature branch commit:
```bash
git revert feat/client-side-code-execution
npm run cf:deploy
```

All other CP Arena functionality remains unaffected.

## Testing Checklist

- [ ] Python code runs with stdin and produces correct output
- [ ] JavaScript code runs with stdin and produces correct output
- [ ] Pyodide loads successfully (check DevTools Network tab)
- [ ] C++/Java/Go/etc. still use Piston (verify `/api/run` calls)
- [ ] Sample output comparison works for all languages
- [ ] Custom stdin input works correctly
- [ ] TLE detection works (run infinite loop)
- [ ] CE detection works (syntax error)
- [ ] RE detection works (runtime error)
- [ ] Submit button still uses server (unchanged)
- [ ] Speed bounty scoring unchanged

## References

- [CLIENT_SIDE_EXECUTION.md](./CLIENT_SIDE_EXECUTION.md) — Technical details
- [Existing CP Arena Architecture](./CLAUDE.md) — See §7 (CP Arena)
- [Piston Judge Implementation](./src/server/judge.ts)
- [Submit Route](./src/app/api/submit/route.ts)
