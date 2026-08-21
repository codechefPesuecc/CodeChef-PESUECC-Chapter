# Judge Sandbox - Google Colab Setup Guide

This guide runs the complete Rust-based online judge executor on Google Colab with all 6 language compilers.

## Prerequisites

- Google Colab account (free)
- GitHub access to clone the repository

## Step-by-Step Instructions

### Step 1: Create a New Colab Notebook

1. Go to https://colab.research.google.com
2. Click "New notebook"
3. Rename it to "Judge Sandbox Test"

### Step 2: Install Rust

**Cell 1:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source $HOME/.cargo/env
rustc --version
```

Expected output: `rustc 1.xx.x (xxxxx)`

### Step 3: Install All Language Compilers

**Cell 2:**
```bash
apt update
apt install -y gcc g++ rustc golang-go python3 default-jdk
```

Verify installation:
```bash
gcc --version
g++ --version
rustc --version
go version
python3 --version
javac -version
java -version
```

### Step 4: Clone the Judge Sandbox Repository

**Cell 3:**
```bash
cd /root
git clone https://github.com/codechefPesuecc/CodeChef-PESUECC-Chapter.git
cd CodeChef-PESUECC-Chapter
git checkout rustJudge
cd judge-sandbox
ls -la src/
```

Expected: See folders like `api/`, `languages/`, `orchestrator/`, `queue/`, `sandbox/`

### Step 5: Build the Backend (Release Mode)

**Cell 4:**
```bash
cd /root/CodeChef-PESUECC-Chapter/judge-sandbox
source $HOME/.cargo/env
cargo build --release
```

⏱️ **This takes 3-5 minutes on first run.** Wait for:
```
Finished `release` profile [optimized] target(s) in X.XXs
```

### Step 6: Start the Backend Server

**Cell 5 (Python):**
```python
import subprocess
import time
import os

os.environ['PATH'] = f"/root/.cargo/bin:{os.environ.get('PATH', '')}"

# Start backend in background
process = subprocess.Popen(
    ["bash", "-c", "cd /root/CodeChef-PESUECC-Chapter/judge-sandbox && source $HOME/.cargo/env && RUST_LOG=judge_sandbox=info cargo run --release -- --mode=server --port=8080"],
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    text=True
)

# Wait for server to start
print("⏳ Starting backend server...")
time.sleep(120)  # 2 minutes for initialization

print("✅ Backend server should now be running on http://localhost:8080")
```

### Step 7: Verify Server is Running

**Cell 6 (Python):**
```python
import requests

response = requests.get("http://localhost:8080/health")
print(response.json())
```

Expected output:
```json
{
  "idle_workers": 16,
  "busy_workers": 0,
  "total_workers": 16,
  "uptime_secs": 0
}
```

If you get connection refused, restart Cell 5 and wait longer.

### Step 8: Test All 6 Languages

**Cell 7 (Python):**
```python
import requests
import json

test_cases = {
    "c": {
        "code": "#include<stdio.h>\nint main(){printf(\"Hello C\");return 0;}",
        "expected": "Hello C"
    },
    "cpp": {
        "code": "#include<iostream>\nint main(){std::cout<<\"Hello CPP\";}",
        "expected": "Hello CPP"
    },
    "python": {
        "code": "print('Hello Python')",
        "expected": "Hello Python"
    },
    "rust": {
        "code": "fn main(){println!(\"Hello Rust\");}",
        "expected": "Hello Rust"
    },
    "go": {
        "code": "package main\nimport \"fmt\"\nfunc main(){fmt.Println(\"Hello Go\")}",
        "expected": "Hello Go"
    },
    "java": {
        "code": "public class Test{public static void main(String[]a){System.out.println(\"Hello Java\");}}",
        "expected": "Hello Java"
    }
}

print("=" * 70)
print("TESTING ALL 6 LANGUAGES")
print("=" * 70)

results = {}

for lang, test in test_cases.items():
    payload = {
        "job_id": "",
        "language": lang,
        "source_code": test["code"],
        "time_limit_ms": 5000,
        "memory_limit_bytes": 134217728,
        "test_cases": [
            {"input": "", "expected_output": test["expected"]}
        ]
    }
    
    try:
        response = requests.post(
            "http://localhost:8080/api/v1/submit",
            json=payload,
            timeout=10,
            headers={"Content-Type": "application/json"}
        )
        
        result = response.json()
        status = result.get('verdict', 'ERROR')
        compile_error = result.get('compile_output')
        cpu_time = result.get('total_cpu_time_ms', 0)
        memory = result.get('peak_memory_kb', 0)
        
        results[lang] = {
            "verdict": status,
            "compile_error": compile_error,
            "cpu_time_ms": cpu_time,
            "memory_kb": memory
        }
        
        if status == "Accepted":
            print(f"✅ {lang.upper():10} → ACCEPTED ({cpu_time}ms, {memory}KB)")
        else:
            print(f"❌ {lang.upper():10} → {status}")
            if compile_error:
                print(f"   Error: {compile_error[:100]}")
        
    except Exception as e:
        results[lang] = {"error": str(e)}
        print(f"❌ {lang.upper():10} → CONNECTION ERROR: {e}")

print("\n" + "=" * 70)
print("DETAILED RESULTS (JSON):")
print("=" * 70)
print(json.dumps(results, indent=2))
```

### Step 9: Test WebSocket Streaming (Optional)

**Cell 8 (Python):**
```python
import websocket
import json
import time
import threading

def test_websocket():
    ws = websocket.create_connection("ws://localhost:8080/api/v1/ws/execute")
    
    payload = {
        "job_id": "",
        "language": "cpp",
        "source_code": "#include<iostream>\nint main(){std::cout<<\"WebSocket Test\";}",
        "time_limit_ms": 5000,
        "memory_limit_bytes": 134217728,
        "test_cases": [
            {"input": "", "expected_output": "WebSocket Test"}
        ]
    }
    
    print("📤 Sending C++ code via WebSocket...")
    ws.send(json.dumps(payload))
    
    print("\n📥 Receiving progress events:")
    while True:
        try:
            msg = ws.recv()
            if not msg:
                break
            event = json.loads(msg)
            print(f"  Event: {json.dumps(event)}")
        except Exception as e:
            break
    
    ws.close()
    print("\n✅ WebSocket test complete!")

test_websocket()
```

### Step 10: Run a Complex Test (Optional)

**Cell 9 (Python):**
```python
import requests

# C++ program that adds two numbers
cpp_code = """
#include<iostream>
using namespace std;
int main(){
    int a, b;
    cin >> a >> b;
    cout << (a + b);
    return 0;
}
"""

payload = {
    "job_id": "",
    "language": "cpp",
    "source_code": cpp_code,
    "time_limit_ms": 5000,
    "memory_limit_bytes": 134217728,
    "test_cases": [
        {"input": "5 3", "expected_output": "8"},
        {"input": "10 20", "expected_output": "30"},
        {"input": "100 200", "expected_output": "300"}
    ]
}

response = requests.post(
    "http://localhost:8080/api/v1/submit",
    json=payload,
    headers={"Content-Type": "application/json"}
)

result = response.json()

print("=" * 70)
print("C++ ADDITION TEST (3 test cases)")
print("=" * 70)
print(f"Overall Verdict: {result['verdict']}")
print(f"Compile Time: {result.get('compile_output', 'N/A')}")
print(f"Total CPU Time: {result['total_cpu_time_ms']}ms")
print(f"Peak Memory: {result['peak_memory_kb']}KB")
print(f"\nTest Results:")

for test in result['test_results']:
    print(f"  Test {test['test_case_index'] + 1}: {test['status']}")
    print(f"    Time: {test['cpu_time_ms']}ms, Memory: {test['memory_kb']}KB")
    if test['stdout']:
        print(f"    Output: {test['stdout']}")
```

## Expected Results

✅ All 6 languages should compile and execute successfully:
- **C** - Compiles with gcc
- **C++** - Compiles with g++
- **Python** - Interpreted with python3
- **Rust** - Compiles with rustc
- **Go** - Compiles with go
- **Java** - Compiles with javac and runs on JVM

Each submission should return:
- Verdict (Accepted/WrongAnswer/CompilationError/TimeLimitExceeded/MemoryLimitExceeded)
- CPU time in milliseconds
- Peak memory in kilobytes
- Per-testcase results with stdout/stderr

## Troubleshooting

### "Connection refused" on health check
- Wait 2-3 minutes after starting the server
- Cargo build + startup takes time
- Restart Cell 5 if needed

### "Command not found: rustc"
- Run Cell 2 again to re-source the environment
- Colab may lose environment variables between cells

### Server crashes during test
- Check Cell 5 output for error messages
- Restart the backend (Cell 5)
- Ensure all compilers are installed (Cell 2)

### Compilation errors for a language
- Verify the language is installed in Cell 2
- Check the code syntax is correct
- The error message will be in `compile_output` field

## Architecture Overview

```
Google Colab (Linux VM)
    ↓
[Rust Backend - Phase 5]
    ├─ HTTP REST API (Port 8080)
    ├─ WebSocket streaming
    ├─ 16 async workers
    └─ Job queue
        ↓
    [Execution Pipeline - Phase 4]
        ├─ Language-specific compilation
        ├─ Per-testcase execution
        └─ Metrics collection
            ↓
        [Sandbox - Phases 1-3]
            ├─ Fork + rlimits
            ├─ Cgroups v2 (memory/CPU)
            ├─ Seccomp syscall filtering
            └─ pivot_root + tmpfs isolation
```

## Key Files

- `src/api/` - Axum HTTP/WebSocket server
- `src/orchestrator/` - Job queue & worker pool
- `src/languages/` - C, C++, Rust, Go, Python, Java handlers
- `src/sandbox/` - Linux-specific sandbox (phases 1-3)
- `PHASE5_IMPLEMENTATION.md` - Full Phase 5 documentation

## What Gets Tested

✅ **Compilation**
- Multi-language compiler integration
- Error handling for syntax errors
- Resource limits during compilation

✅ **Execution**
- Process isolation via rlimits
- Memory/CPU enforcement via cgroups
- Syscall filtering via seccomp
- Filesystem isolation via pivot_root

✅ **Metrics**
- CPU time measurement (getrusage)
- Peak memory tracking
- Exit codes and signals

✅ **Concurrency**
- 16 async workers processing jobs
- Thread-safe result channels
- Worker pool lifecycle

## Success Criteria

All tests should output:
```
✅ C          → ACCEPTED
✅ CPP        → ACCEPTED
✅ PYTHON     → ACCEPTED
✅ RUST       → ACCEPTED
✅ GO         → ACCEPTED
✅ JAVA       → ACCEPTED
```

If you see "ACCEPTED" for all 6 languages, **the entire judge sandbox is working correctly end-to-end!**

## Next Steps

After successful testing:
1. Share results with team
2. Deploy backend to Linux server (AWS EC2, DigitalOcean, etc.)
3. Connect frontend (React/Next.js) to REST API
4. Integrate Redis queue for batch grading
5. Set up Prometheus monitoring

---

**Questions?** Check `PHASE5_IMPLEMENTATION.md` for API documentation and deployment details.
