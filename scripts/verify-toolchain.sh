#!/bin/bash

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "================================"
echo "Multi-Language Toolchain Verification"
echo "================================"
echo ""

# Track results
PASSED=0
FAILED=0

check_tool() {
  local name=$1
  local cmd=$2
  local version_flag=$3

  echo -n "Checking $name... "

  if command -v "$cmd" &> /dev/null; then
    if [ -n "$version_flag" ]; then
      version=$($cmd $version_flag 2>&1 | head -1)
      echo -e "${GREEN}✅${NC} $version"
    else
      echo -e "${GREEN}✅${NC} installed"
    fi
    ((PASSED++))
  else
    echo -e "${RED}❌${NC} NOT FOUND"
    ((FAILED++))
  fi
}

# Python
check_tool "Python 3" "python3" "--version"

# Node.js
check_tool "Node.js" "node" "--version"

# Go
check_tool "Go" "go" "version"

# Rust
check_tool "Rust (rustc)" "rustc" "--version"

# C++ Compiler
check_tool "C++ (g++)" "g++" "--version" || check_tool "C++ (clang)" "clang++" "--version"

# Emscripten
echo -n "Checking Emscripten... "
if [ -d ~/emsdk ]; then
  source ~/emsdk/emsdk_env.sh 2>/dev/null
  if command -v emcc &> /dev/null; then
    version=$(emcc --version 2>&1 | head -1)
    echo -e "${GREEN}✅${NC} $version"
    ((PASSED++))
  else
    echo -e "${RED}❌${NC} SDK found but emcc not in PATH"
    echo "   Run: source ~/emsdk/emsdk_env.sh"
    ((FAILED++))
  fi
else
  echo -e "${RED}❌${NC} emsdk not found at ~/emsdk"
  ((FAILED++))
fi

# WASM Targets
echo ""
echo "Checking WASM Targets..."

echo -n "  Rust wasm32-wasip1... "
if rustc --print target-list 2>/dev/null | grep -q "wasm32-wasip1"; then
  echo -e "${GREEN}✅${NC}"
  ((PASSED++))
else
  echo -e "${RED}❌${NC} (run: rustup target add wasm32-wasip1)"
  ((FAILED++))
fi

echo -n "  Go WASI support... "
if [ $(go env GOMINOR) -ge 21 ] 2>/dev/null; then
  echo -e "${GREEN}✅${NC} Go 1.21+"
  ((PASSED++))
else
  echo -e "${YELLOW}⚠️${NC} Go version check failed"
fi

echo ""
echo "================================"
echo "Summary"
echo "================================"
echo -e "${GREEN}✅ Passed:${NC} $PASSED"
echo -e "${RED}❌ Failed:${NC} $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}All toolchains verified successfully!${NC}"
  echo ""
  echo "You can now:"
  echo "  1. Test locally: bash tests/test-all-languages.sh"
  echo "  2. Test in browser: npm run dev → visit /cp-arena/solve"
  echo "  3. Start compiler: node scripts/wasmCompiler.mjs"
  exit 0
else
  echo -e "${RED}Some toolchains are missing. See errors above.${NC}"
  exit 1
fi
