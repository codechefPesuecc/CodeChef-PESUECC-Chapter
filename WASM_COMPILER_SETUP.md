# WASM Compiler Backend Setup

## Quick Start

The WASM compiler service compiles C, C++, Go, and Rust code to WebAssembly that runs in the browser.

### Prerequisites

- **Emscripten SDK** installed (for C/C++ compilation)
- **Node.js** installed
- **Go, Rust, Java** toolchains (optional, for their respective languages)

### Running the Backend

Open PowerShell and run:

```powershell
call "%USERPROFILE%\emsdk\emsdk_env.bat" && node scripts/wasmCompiler.mjs
```

This will:
1. Set up the Emscripten environment
2. Start the compilation service on `http://localhost:3001`

You should see:
```
Code Compilation Service running on http://localhost:3001
POST /compile/c - Compile C to WASM
POST /compile/cpp - Compile C++ to WASM
POST /compile/go - Compile Go to WASM
POST /compile/rust - Compile Rust to WASM
POST /compile/java - Compile Java to Bytecode
```

### In Another Terminal

Run the Next.js development server:

```powershell
npm run dev
```

Open http://localhost:3000 and test code execution in the CP Arena.

## Supported Languages

✅ **C, C++** — Emscripten → WASM  
✅ **Go** — Native WASI compilation  
✅ **Rust** — rustc with wasm32-wasip1 target  
✅ **Java** — Compiled to bytecode, runs in CheerpJ browser JVM  
✅ **Python, JavaScript** — Browser interpreters (Pyodide, native)  

## Troubleshooting

**"emcc not found"** → Emscripten not in PATH. Re-run the emsdk_env.bat command above.

**"Cannot find module"** → Run `npm install` in the project root.

**Compiler service won't start** → Check that port 3001 is not in use. Run `netstat -ano | findstr 3001` to check.

## How It Works

1. Frontend sends code to `/api/compile/[language]`
2. Next.js proxies to `http://localhost:3001/compile/[language]`
3. WASM Compiler service compiles and returns `.wasm` binary
4. Browser Web Worker runs the WASM with WASI shim
5. Output is captured and displayed to the user

---

**For production deployment**, see `DEPLOY.md`.
