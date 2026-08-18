# Complete Toolchain Setup Guide

This guide verifies that all required tools for multi-language CP Arena execution are properly installed and configured.

## Installation Status

Run this to check your system:

```bash
npm run verify:toolchain
```

## Tool Requirements

### ✅ **Python 3** (for Pyodide)
- **Required:** Yes
- **Version:** 3.7+
- **Used by:** Browser (CDN-loaded Pyodide)
- **Local usage:** Not needed for runtime

### ✅ **Node.js**
- **Required:** Yes
- **Version:** 18+
- **Status:** Already installed (you're using npm)

### ✅ **Go**
- **Required:** For Go → WASM compilation
- **Version:** 1.21+ (supports wasip1)
- **Status:** ✅ Go 1.25.1 installed
- **Test:** `go version`

### ✅ **Rust**
- **Required:** For Rust → WASM compilation
- **Version:** 1.56+
- **Status:** ✅ Rust 1.90.0 installed
- **WASM Target:** ✅ wasm32-wasip1 installed
- **Test:** `rustc --target wasm32-wasip1 --version`

### ⏳ **Emscripten (emsdk)**
- **Required:** For C/C++ → WASM compilation
- **Version:** 3.1.0+
- **Status:** 🔄 Installing (~657MB)
- **Installation Path:** `~/emsdk`
- **ETA:** 2-5 minutes depending on internet

---

## Emscripten Setup Instructions

### If Installation Hangs

Press Ctrl+C and run:

```bash
# Option 1: Install via Homebrew (macOS)
brew install emscripten

# Option 2: Install from source
git clone https://github.com/emscripten-core/emsdk.git ~/emsdk
cd ~/emsdk
./emsdk install latest
./emsdk activate latest

# Add to PATH (add to ~/.bashrc or ~/.zshrc)
source ~/emsdk/emsdk_env.sh
```

### Verify Installation

```bash
emcc --version
emcc -O2 -s STANDALONE_WASM --help | grep STANDALONE_WASM
```

Expected output:
```
emcc (Emscripten gcc-like replacement) version 3.1.x
```

---

## Testing All Languages

### Quick Test

```bash
bash tests/test-all-languages.sh
```

### Manual Language Tests

#### **Python**
```bash
echo "5" | python3 tests/language-samples/double.py
# Expected: 10
```

#### **JavaScript (Browser only)**
```bash
# Requires browser environment with Web Worker support
# Test in CP Arena: input "5" → output "10"
```

#### **C++ (Native)**
```bash
g++ -o /tmp/double tests/language-samples/double.cpp
echo "5" | /tmp/double
# Expected: 10
```

#### **C++ (WASM via Emscripten)**
```bash
emcc tests/language-samples/double.cpp -o /tmp/double.wasm -O2 -s STANDALONE_WASM
# Binary ready to run in browser with WASI shim
```

#### **Go (Native)**
```bash
go run tests/language-samples/double.go
# Input: 5
# Expected: 10
```

#### **Go (WASM via WASI)**
```bash
GOOS=wasip1 GOARCH=wasm go build -o /tmp/double.wasm tests/language-samples/double.go
# Binary ready to run in browser with WASI shim
```

#### **Rust (Native)**
```bash
rustc -o /tmp/double tests/language-samples/double.rs
echo "5" | /tmp/double
# Expected: 10
```

#### **Rust (WASM via WASM32-WASIP1)**
```bash
rustc --target wasm32-wasip1 tests/language-samples/double.rs -o /tmp/double.wasm
# Binary ready to run in browser with WASI shim
```

---

## Docker Setup (Alternative)

If you prefer isolated environments:

```dockerfile
FROM ubuntu:22.04

# Install toolchain
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    python3 \
    python3-pip

# Install Emscripten
RUN git clone https://github.com/emscripten-core/emsdk.git /opt/emsdk && \
    cd /opt/emsdk && \
    ./emsdk install latest && \
    ./emsdk activate latest

# Install Go
RUN curl -L https://go.dev/dl/go1.25.1.linux-amd64.tar.gz | tar -C /usr/local -xz

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y && \
    /root/.cargo/bin/rustup target add wasm32-wasip1

ENV PATH="/opt/emsdk:/opt/emsdk/upstream/emscripten:${PATH}"
ENV PATH="/usr/local/go/bin:${PATH}"
```

---

## Production Deployment

### Option 1: Pre-Compiled Binaries
Store `.wasm` files in S3/R2 and serve directly.

### Option 2: Lambda/Serverless Compilation
Use AWS Lambda with Emscripten layer for on-demand compilation.

### Option 3: Dedicated Compilation Service
Run `scripts/wasmCompiler.mjs` on a dedicated server.

---

## Troubleshooting

### Emscripten Download Stuck

**Solution:**
```bash
# Cancel current install (Ctrl+C)
# Try again:
cd ~/emsdk
./emsdk install latest --depth=1
```

### `emcc: command not found`

**Solution:**
```bash
# Add to PATH manually
export PATH=~/emsdk:~/emsdk/upstream/emscripten:$PATH

# Or permanently (add to ~/.bashrc or ~/.zshrc):
echo 'source ~/emsdk/emsdk_env.sh' >> ~/.bashrc
source ~/.bashrc
```

### Go WASM Binary Size Too Large

**Solution:**
- Use `go build -ldflags="-s -w"` to strip symbols (reduces ~50%)
- Use `wasm-opt` from Binaryen for additional compression

### Rust WASM Compilation Slow

**Solution:**
```bash
# Use release mode with optimizations
cargo build --target wasm32-wasip1 --release -Z build-std=std,panic_abort
```

---

## Performance Benchmarks

After setup, here are expected performance metrics:

| Language | Compilation | First Run | Cached Run |
|----------|-------------|-----------|-----------|
| Python | N/A (CDN) | 2-3s | 20-100ms |
| JavaScript | N/A | Instant | 5-20ms |
| C++ | 500ms | 50ms | 30-100ms |
| Go | 1s | 30ms | 10-50ms |
| Rust | 2-3s | 50ms | 20-100ms |

---

## Next Steps

1. ✅ All tools are installing/installed
2. ⏳ Wait for Emscripten to finish
3. 🧪 Run test suite: `bash tests/test-all-languages.sh`
4. 🚀 Test in browser: Go to `/cp-arena/solve` and click "Run"

---

## Support

If you encounter issues:

1. Check tool versions: `emcc --version`, `go version`, `rustc --version`
2. Verify WASM targets: `rustc --print target-list | grep wasm32-wasip1`
3. Test compilation: Run language-specific tests above
4. Check browser console (F12) for Web Worker errors

See `WASM_COMPILER.md` and `CLIENT_SIDE_EXECUTION.md` for more details.
