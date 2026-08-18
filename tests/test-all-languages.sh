#!/bin/bash

set -e

SAMPLES_DIR="$(dirname "$0")/language-samples"
TEST_INPUT="5"
EXPECTED_OUTPUT="10"

echo "================================"
echo "Testing All Language Support"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_language() {
  local lang=$1
  local cmd=$2
  local file=$3

  echo -n "Testing $lang... "

  if ! command -v $(echo $cmd | awk '{print $1}') &> /dev/null; then
    echo -e "${YELLOW}SKIPPED${NC} ($cmd not found)"
    return 0
  fi

  output=$(echo "$TEST_INPUT" | eval "$cmd $file" 2>/dev/null || true)

  if [ "$output" = "$EXPECTED_OUTPUT" ]; then
    echo -e "${GREEN}✅ PASSED${NC}"
    return 0
  else
    echo -e "${RED}❌ FAILED${NC} (got '$output', expected '$EXPECTED_OUTPUT')"
    return 1
  fi
}

# Test Python
test_language "Python" "python3" "$SAMPLES_DIR/double.py"

# Test Node.js JavaScript (note: requires input() function which we provide)
echo -n "Testing JavaScript (Browser Web Worker)... "
echo -e "${YELLOW}SKIPPED${NC} (requires browser environment)"

# Test C++
test_language "C++ (local)" "g++" "$SAMPLES_DIR/double.cpp" || true
echo -n "Testing C++ (WASM via Emscripten)... "
if command -v emcc &> /dev/null; then
  emcc "$SAMPLES_DIR/double.cpp" -o /tmp/double.wasm -O2 -s STANDALONE_WASM 2>/dev/null && \
  echo -e "${YELLOW}COMPILED${NC} (run in browser with WASI shim)" || \
  echo -e "${RED}COMPILATION FAILED${NC}"
else
  echo -e "${YELLOW}SKIPPED${NC} (emcc not found)"
fi

# Test Go (native WASI)
echo -n "Testing Go (WASM via WASI)... "
if command -v go &> /dev/null; then
  GOOS=wasip1 GOARCH=wasm go build -o /tmp/double.wasm "$SAMPLES_DIR/double.go" 2>/dev/null && \
  echo -e "${YELLOW}COMPILED${NC} (run in browser with WASI shim)" || \
  echo -e "${RED}COMPILATION FAILED${NC}"
else
  echo -e "${YELLOW}SKIPPED${NC} (go not found)"
fi

# Test Rust (wasm32-wasip1)
echo -n "Testing Rust (WASM via wasm32-wasip1)... "
if command -v rustc &> /dev/null; then
  rustc --target wasm32-wasip1 "$SAMPLES_DIR/double.rs" -o /tmp/double.wasm 2>/dev/null && \
  echo -e "${YELLOW}COMPILED${NC} (run in browser with WASI shim)" || \
  echo -e "${RED}COMPILATION FAILED${NC}"
else
  echo -e "${YELLOW}SKIPPED${NC} (rustc not found)"
fi

echo ""
echo "================================"
echo "Test Summary"
echo "================================"
echo "✅ = Native execution works"
echo "🟡 = Compiled to WASM (test in browser)"
echo "⏭️  = Requires browser environment"
echo ""
