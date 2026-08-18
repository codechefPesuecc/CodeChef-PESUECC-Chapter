# WASM Compilation & Execution Guide

This document explains how to set up and use the Hybrid WebAssembly execution engine for C/C++, Go, and Rust support in CP Arena.

## Overview

The system consists of three parts:

1. **Compilation Backend** — Compiles source code to WebAssembly binaries
2. **Execution Engine** — Runs WASM binaries in isolated Web Workers
3. **Integration** — React hooks and ArenaWorkspace integration

## Part 1: Compilation Backend Setup

### Prerequisites

You need the following toolchains installed locally:

#### **For C/C++ (Emscripten)**

```bash
# Install Emscripten (macOS with Homebrew)
brew install emscripten

# Or from source: https://emscripten.org/docs/getting_started/index.html
# Verify installation
emcc --version
```

#### **For Go (Go 1.21+)**

```bash
# Go's native WASI support is built-in since 1.21
go version  # Must be >= 1.21
```

#### **For Rust (wasm32-wasip1 target)**

```bash
# Install Rust if not already installed
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Add WASM target
rustup target add wasm32-wasip1

# Verify
rustc --print target-list | grep wasm32-wasip1
```

### Local Development Server

Run the standalone WASM compiler service:

```bash
node scripts/wasmCompiler.mjs
```

This starts a server on `http://localhost:3001` with endpoints:

- `POST /compile/cpp` — Compile C/C++ to WASM
- `POST /compile/go` — Compile Go to WASM  
- `POST /compile/rust` — Compile Rust to WASM

### Configuration

In `src/lib/useWasmExecution.ts`, update the compilation endpoint:

```typescript
const response = await fetch(`/api/compile/${language}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sourceCode }),
});
```

For production, replace `/api/compile` with your external compilation service URL:

```typescript
const compilationServiceUrl = process.env.NEXT_PUBLIC_WASM_COMPILER_URL || 'http://localhost:3001';
const response = await fetch(`${compilationServiceUrl}/compile/${language}`, {
  ...
});
```

## Part 2: Execution Engine

### WASM Execution Manager

Located in `src/lib/wasmExecution.ts`, it:

- Manages Web Worker pool
- Loads WASI shim from CDN
- Executes WASM binaries
- Enforces timeouts (TLE detection)
- Captures stdout/stderr

### WASI Shim

The engine uses `@bjorn3/browser_wasi_shim` to simulate WASI system calls in the browser:

- File descriptor mapping (stdin/stdout/stderr)
- System call translation to JavaScript
- Memory management

### Worker Pool

Two workers are pre-initialized to handle concurrent WASM executions.

## Part 3: React Integration

### Using the Hook

```typescript
import { useWasmExecution } from '@/lib/useWasmExecution';

export function MyComponent() {
  const { compileAndExecute, isCompiling, isExecuting, result, error } = useWasmExecution();

  const handleRun = async () => {
    const cppCode = `
#include <iostream>
int main() {
  int n;
  std::cin >> n;
  std::cout << n * 2 << std::endl;
  return 0;
}
    `;

    const result = await compileAndExecute('cpp', cppCode, '5', 2000);
    // result.stdout === '10'
  };

  return (
    <>
      <button onClick={handleRun} disabled={isCompiling || isExecuting}>
        {isCompiling ? 'Compiling...' : isExecuting ? 'Running...' : 'Run'}
      </button>
      {result && <pre>{result.stdout}</pre>}
      {error && <div className="error">{error}</div>}
    </>
  );
}
```

## Build Flags & Optimization

### Emscripten C/C++ Build

```bash
emcc source.cpp -o output.wasm \
  -O2 \                          # Optimization level
  -s STANDALONE_WASM \           # Pure WASI binary (no JS glue)
  -s WASM=1                      # Ensure WASM output
```

**Why `-s STANDALONE_WASM`?**
- Produces pure WebAssembly without JavaScript wrapper
- Reduces binary size from ~500KB to ~50KB
- Enables direct WASI compatibility

### Go Build

```bash
GOOS=wasip1 GOARCH=wasm go build -o output.wasm source.go
```

**Why `wasip1`?**
- Native WASI support in Go 1.21+
- No additional toolchain needed
- Produces ~2-5MB binaries (large but functional)

### Rust Build

```bash
rustup target add wasm32-wasip1
cargo build --target wasm32-wasip1 --release
```

**Why `wasm32-wasip1`?**
- Tier 1 Rust target
- System interface via WASI
- Good binary size (~100KB-500KB)

## Security & Timeouts

### Time Limit Enforcement

Each execution is guarded by a watchdog timer:

```typescript
setTimeout(() => {
  worker.terminate();
  resolve({ status: 'TLE', ... });
}, timeoutMs + 1000);  // Hard limit 1s after soft timeout
```

- **Soft timeout**: Communicated to WASM runner
- **Hard timeout**: Immediate worker termination
- Prevents infinite loops from freezing the UI

### Memory Limits

WebAssembly has built-in memory constraints:

- Default: 1 page (64KB)
- Max per instance: ~2GB
- Set in WASM module (Emscripten/Go/Rust handles automatically)

### Sandboxing

The WASI sandbox restricts:

- No filesystem access (except captured I/O)
- No network access
- No arbitrary system calls
- All I/O redirected through custom file descriptors

## Limitations & Workarounds

### Limitation 1: No `#include <bits/stdc++.h>` in Emscripten

**Issue**: Emscripten uses glibc, which may not have this non-standard header.

**Workaround**: Use explicit includes:
```cpp
#include <iostream>
#include <vector>
#include <algorithm>
// etc.
```

### Limitation 2: Go Binaries are Large (~2-5MB)

**Issue**: Go's WASM output includes full runtime.

**Workaround**: 
- Use Go for algorithms that benefit from its simplicity
- Pre-cache binaries in browser
- Compress with gzip before transmission

### Limitation 3: Rust Requires External Dependencies in Cargo.toml

**Issue**: Standard library must be explicitly configured for WASI.

**Workaround**: Compiler service handles this automatically.

## Performance Characteristics

| Language | Compilation | Execution | Binary Size |
|----------|-------------|-----------|-------------|
| C++ | 500ms | 10-100ms | 30-100KB |
| Go | 1s | 5-50ms | 2-5MB |
| Rust | 2-3s | 10-50ms | 100-500KB |

**Notes:**
- First WASI shim load: ~1-2s
- Subsequent runs use cached shim
- Binary sizes can be reduced with `wasm-opt` post-processing

## Debugging

### Browser DevTools

1. Open DevTools (F12)
2. Go to **Sources** tab
3. Look for `blob:http://localhost:3000/...` entries
4. These are the worker scripts

### Logging

Enable verbose logging in `src/lib/wasmExecution.ts`:

```typescript
console.log('WASM Worker initialized');
console.log('WASM execution started:', id);
console.log('WASM execution result:', response);
```

### Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| "WASI shim not loaded" | CDN unavailable | Check network in DevTools |
| "Compilation failed" | Syntax error in code | Check browser console |
| "RangeError: out of bounds" | Array access overflow | Increase WASM memory |
| "TLE" | Infinite loop | Verify algorithm logic |

## Production Deployment

### Option 1: Pre-Compiled Binaries

Store pre-compiled `.wasm` files in S3/R2:

```typescript
const wasmBuffer = await fetch('/wasm-binaries/solution.wasm').then(r => r.arrayBuffer());
await execute({ wasmBuffer, stdin, timeoutMs: 2000 });
```

### Option 2: External Compilation Service

Host `wasmCompiler.mjs` on a dedicated server:

```bash
# Production server (e.g., DigitalOcean, AWS)
WASM_COMPILER_PORT=8080 node wasmCompiler.mjs
```

Then point frontend to it:
```typescript
const COMPILER_URL = process.env.REACT_APP_WASM_COMPILER_URL;
```

### Option 3: Hybrid (Recommended)

- **Pre-cache common solutions**: Binary search, sorting, etc.
- **Compile on-demand**: User submissions
- **Cache for 24h**: Recently compiled solutions

## Testing

### Local Test

```typescript
const { compileAndExecute } = useWasmExecution();

const result = await compileAndExecute('cpp', `
#include <iostream>
int main() {
  std::cout << "Hello from WASM!" << std::endl;
  return 0;
}
`, '');

console.log(result.stdout); // "Hello from WASM!"
```

### Unit Tests

See `src/lib/wasmExecution.test.ts` (to be created).

## References

- [Emscripten Docs](https://emscripten.org/)
- [WebAssembly WASI Spec](https://wasi.dev/)
- [browser_wasi_shim](https://github.com/bjorn3/browser_wasi_shim)
- [Go WASI Support](https://github.com/golang/go/issues/31105)
- [Rust WASM Book](https://rustwasm.github.io/)
