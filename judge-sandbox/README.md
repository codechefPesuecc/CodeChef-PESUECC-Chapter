# ??? High-Performance Rust Judge Sandbox

An ultra-low overhead, enterprise-grade, memory-safe online judge execution engine built in Rust. Designed to run untrusted student code securely with microsecond-level isolation, sub-millisecond execution overhead, bounded backpressure defense, and horizontal multi-machine scaling via Redis Streams.

---

## ?? Table of Contents

- [Key Architecture & Safeguards](#-key-architecture--safeguards)
- [Supported Language Stack](#-supported-language-stack)
- [System Requirements & Footprint](#-system-requirements--footprint)
- [Live Performance Benchmarks](#-live-performance-benchmarks)
- [API & WebSocket Specification](#-api--websocket-specification)
- [Horizontal Multi-Machine Scaling (Redis)](#-horizontal-multi-machine-scaling-redis)
- [Deployment & Systemd Service](#-deployment--systemd-service)
- [Verification & Test Suite](#-verification--test-suite)

---

## ?? Key Architecture & Safeguards

The engine provides multi-layered kernel isolation and resource protection:

```
                      +----------------------------------------+
                      �          Untrusted Submission          �
                      +----------------------------------------+
                                          �
                                          ?
                      +----------------------------------------+
                      �         Axum REST / WS Gateway         �
                      �  - DefaultBodyLimit: 2 MB              �
                      �  - Queue Backpressure: max 128 (503)   �
                      +----------------------------------------+
                                          �
                                          ?
                      +----------------------------------------+
                      �    Adaptive Worker Pool (Tokio)        �
                      �    Workers = available_parallelism()   �
                      +----------------------------------------+
                                          �
    +---------------------------------------------------------------------------+
    ?                                     ?                                     ?
+------------------------+    +------------------------+    +------------------------+
�   Linux Namespaces     �    �       Cgroups v2       �    �   Seccomp & RLIMITs    �
� - CLONE_NEWNET (No net)�    � - memory.max = 256MB   �    � - RLIMIT_FSIZE (16MB)  �
� - CLONE_NEWPID (Hidden)�    � - pids.max (anti-fork) �    � - RLIMIT_CPU (Hard kill�
� - CLONE_NEWNS  (Mount) �    � - cgroup.kill cleanup  �    � - MS_RDONLY Rootfs     �
� - pivot_root isolation �    � - memory.swap.max = 0  �    � - Blacklisted Syscalls �
+------------------------+    +------------------------+    +------------------------+
```

### 1. Filesystem & Escape Isolation (`pivot_root` + `MS_RDONLY`)
- Per-submission isolated root filesystem created inside `/tmp/judge-fs/<uuid>`.
- `pivot_root` changes the real root to the sandbox directory, unmounting the host filesystem.
- The entire root is mounted read-only (`MS_RDONLY`); only a temporary in-memory `tmpfs` is writable for standard output and scratch files.

### 2. Network Isolation (`CLONE_NEWNET` & Egress Filter)
- Every submission executes in an unshared network namespace (`CLONE_NEWNET`) with no loopback interface (`lo` down). Socket creations and network egress fail instantly.
- Container-level iptables rules drop traffic directed to cloud metadata endpoints (`169.254.169.254`).

### 3. Resource & Fork-Bomb Protection (`Cgroups v2` + `pids.max`)
- Sandboxed processes are placed in dedicated cgroups under `/sys/fs/cgroup/judge/<uuid>`.
- Strict memory caps (`memory.max = 256MB`, `memory.swap.max = 0`) trigger immediate kernel-level OOM killing on over-allocation.
- Thread/process count is strictly capped (`pids.max = 2` for C/C++/Python, `12` for Bun/Java), preventing fork-bomb DoS attacks.
- Atomic cgroup cleanup via `cgroup.kill` guarantees no zombie or orphan child processes remain after execution.

### 4. Output Limit Enforcement (`RLIMIT_FSIZE`)
- Hard file size and output limit enforced via `RLIMIT_FSIZE` (default: 16 MB).
- Infinite output floods (`while(1) printf("A");`) trigger immediate `SIGXFSZ` and `RuntimeError` / `OutputLimitExceeded` verdict.

### 5. Contest Stampede & Backpressure Resilience
- **Adaptive Concurrency**: Number of execution workers automatically detects CPU core count (`available_parallelism()`). On a 1-core machine, exactly 1 job runs at any instant to protect RAM.
- **Bounded Channel Queue**: Tokio channel is bounded to 128 pending jobs (`JUDGE_MAX_QUEUE`).
- **HTTP 503 Retry Defense**: When the queue is saturated, incoming requests immediately return `HTTP 503 Service Unavailable` with `{"retry_after_secs": 3}` instead of accumulating unbounded TCP buffers.
- **Body Size Caps**: `DefaultBodyLimit::max(2 MB)` rejects oversize requests before parsing.

---

## ?? Supported Language Stack

All runtimes are pre-warmed for competitive programming speed:

| Language | Runtime / Compiler | Version | Optimizations Applied |
| :--- | :--- | :--- | :--- |
| **C** | GCC | 12.2+ | `-O3 -march=x86-64` |
| **C++** | G++ | 12.2+ (C++20) | Precompiled `<bits/stdc++.h>` PCH + **AtCoder Library (ACL)** |
| **Python 3** | CPython | 3.11+ | Precompiled standard library bytecode (`.pyc`) |
| **JavaScript** | Bun | 1.1+ | V8-compatible fast engine, `--no-addons` |
| **TypeScript** | Bun TS | 1.1+ | Native zero-transpile JIT |
| **SQL** | SQLite3 | 3.40+ | In-memory execution with CSV table output parsing |
| **Java** | OpenJDK | 17 LTS | Headless JDK + Pre-dumped **Java CDS (Class Data Sharing)** |

---

## ?? Live Performance Benchmarks

*Tested on a live Azure Virtual Machine: 2 vCPUs, 1 GB RAM, Ubuntu 24.04 LTS.*

```
+--------------------------------------------------------------------------------+
� Language / Workload             � Throughput (/sec)  � Avg Latency    � P50    �
+---------------------------------+--------------------+----------------+--------�
� TypeScript (Bun JIT)            � 26.70 / sec        � 146.1 ms       � 144 ms �
� Python 3 (.pyc Bytecode)        � 26.61 / sec        � 146.3 ms       � 145 ms �
� SQL (SQLite3 In-Memory)         � 26.40 / sec        � 148.8 ms       � 144 ms �
� JavaScript (Bun)                � 21.65 / sec        � 180.9 ms       � 144 ms �
� C (GCC -O3)                     � 11.65 / sec        � 170.5 ms       � 167 ms �
� C++ (G++ -O3 + PCH)             �  2.65 / sec        � 755.0 ms       � 739 ms �
� Java (OpenJDK 17 + javac + CDS) �  1.38 / sec        � 1432.5 ms      � 1391 ms�
+--------------------------------------------------------------------------------+
```

- **Memory Footprint**: Only **~20 MB RAM** at idle.
- **Pass Rate**: **100% (18/18 tests)** across all languages, error verdicts, and attack vectors.

---

## ?? API & WebSocket Specification

### 1. Health & Queue Telemetry
```http
GET /health
```
**Response:**
```json
{
  "total_workers": 2,
  "idle_workers": 2,
  "busy_workers": 0,
  "queued_jobs": 0,
  "uptime_secs": 1240
}
```

### 2. Synchronous Code Evaluation
```http
POST /api/v1/submit
Content-Type: application/json
X-Judge-Secret: your_secure_random_token  # Required when JUDGE_SECRET is configured
```
**Request Payload:**
```json
{
  "job_id": "submission-1001",
  "language": "cpp",
  "source_code": "#include <iostream>\nusing namespace std;\nint main() {\n  int a, b;\n  if (cin >> a >> b) cout << a + b << endl;\n  return 0;\n}",
  "time_limit_ms": 2000,
  "memory_limit_bytes": 268435456,
  "test_cases": [
    {
      "input": "15 25",
      "expected_output": "40"
    }
  ]
}
```

**Response (`Accepted`):**
```json
{
  "job_id": "submission-1001",
  "verdict": "Accepted",
  "total_time_ms": 42,
  "peak_memory_bytes": 28180480,
  "test_case_results": [
    {
      "test_case_index": 0,
      "verdict": "Accepted",
      "time_ms": 2,
      "memory_bytes": 4194304,
      "stdout": "40\n",
      "stderr": ""
    }
  ]
}
```

### 3. Real-Time WebSocket Streaming
```http
WS /api/v1/ws/submit
```
Client sends the JSON payload and receives streaming progress events in real-time:
```json
{"event": "Compiling", "job_id": "submission-1001"}
{"event": "Running", "job_id": "submission-1001", "test_case_index": 0}
{"event": "Completed", "result": { ... }}
```

---

## ?? Horizontal Multi-Machine Scaling (Redis)

The engine can run as a distributed cluster across multiple servers:

```
               +------------------------------+
               �    HTTP / Web Frontend       �
               � (Submits code via API / Web) �
               +------------------------------+
                              � XADD judge:jobs
                              ?
               +------------------------------+
               �     Central Redis Stream     �
               �        (`judge:jobs`)        �
               �  Consumer Group: `workers`   �
               +------------------------------+
                       �              �
        +----------------------+      +----------------------+
        ?                      ?                     ?       ?
+----------------+     +----------------+    +----------------+
�  Worker Node 1 �     �  Worker Node 2 �     �  Worker Node 3 �
�  (Azure VPS)   �     �  (Laptop / PC) �     �  (On-Prem VM)  �
+----------------+     +----------------+    +----------------+
```

1. **Consumer Groups**: Workers claim jobs via `XREADGROUP`, ensuring zero duplicate executions.
2. **Result Cache**: Verdicts are stored in `judge:results:<job_id>` with 24-hour TTL and acknowledged via `XACK`.
3. **Launch Worker**:
   ```bash
   akiro --mode worker --redis redis://<REDIS_HOST>:6379
   ```

---

## ?? Deployment & Systemd Service

### Quick Container Run
```bash
sudo docker run -d \
  --name akiro-server \
  --restart always \
  --init \
  --privileged \
  -p 8080:8080 \
  -e JUDGE_MODE=server \
  -e JUDGE_PORT=8080 \
  -e JUDGE_MAX_QUEUE=128 \
  akiro
```

### Production Systemd Service
Create `/etc/systemd/system/akiro.service`:

```ini
[Unit]
Description=CodeChef Judge Sandbox Execution Service
After=docker.service
Requires=docker.service

[Service]
TimeoutStartSec=0
Restart=always
RestartSec=5s
ExecStartPre=-/usr/bin/docker stop akiro-server
ExecStartPre=-/usr/bin/docker rm akiro-server
ExecStart=/usr/bin/docker run --name akiro-server --init --privileged -p 8080:8080 -e RUST_LOG=info -e JUDGE_MODE=server -e JUDGE_PORT=8080 -e JUDGE_MAX_QUEUE=128 akiro
ExecStop=/usr/bin/docker stop -t 10 akiro-server

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable akiro
sudo systemctl start akiro
```

---

## ?? Verification & Test Suite

Run the 18-point verification test suite covering all target languages and security attack vectors:

```bash
node scripts/comprehensive_test_suite.js http://localhost:8080
```

Run the multi-language live throughput benchmark:
```bash
node scripts/benchmark_throughput.js
```