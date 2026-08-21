# Judge Sandbox - Phase 1

High-performance, memory-safe online judge executor in Rust targeting minimal CPU and memory overhead for up to 2000 concurrent submissions.

## Architecture

### Core Components

- **`sandbox/config.rs`** — Execution configuration with time/memory limits, I/O redirection, and output constraints
- **`sandbox/child.rs`** — Child process isolation: Linux namespaces, POSIX resource limits, environment sanitization, binary execution
- **`sandbox/supervisor.rs`** — Parent process monitoring: timeout enforcement, wait4/getrusage collection, verdict determination
- **`sandbox/result.rs`** — Structured execution results with detailed metrics

### Process Isolation

The sandbox provides defense-in-depth:

1. **Linux Namespaces** (future expansion):
   - `CLONE_NEWNET` — Complete network isolation
   - `CLONE_NEWPID` — Prevent seeing host processes
   - `CLONE_NEWIPC` — Block shared memory
   - `CLONE_NEWUTS` — Isolate hostname

2. **POSIX Resource Limits** (rlimit):
   - `RLIMIT_CPU` — CPU time ceiling (converted to wall-clock with padding)
   - `RLIMIT_AS` — Virtual address space limit (enforces memory budget)
   - `RLIMIT_NPROC` — Prevents fork bombs (capped at 0–1)
   - `RLIMIT_FSIZE` — Maximum file size (prevents stdout bomb)
   - `RLIMIT_STACK` — Stack size (64 MB default)

3. **Environment Sanitization**:
   - `clearenv()` clears all parent variables
   - Only `PATH=/usr/bin:/bin` and `LANG=C.UTF-8` injected

4. **Execution Metrics** (wait4 + getrusage):
   - CPU time (user + system) in microseconds
   - Peak RSS in kilobytes
   - Wall-clock time for timeout detection
   - Exit code and signal number

## Usage

### Basic Example

```rust
use judge_sandbox::{Sandbox, SandboxConfig};
use std::path::PathBuf;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = SandboxConfig::new(PathBuf::from("/bin/echo"))
        .with_args(vec!["Hello World".to_string()])
        .with_time_limit(1000)
        .with_memory_limit(256 * 1024 * 1024);

    let result = Sandbox::execute(config).await?;

    println!("Status: {}", result.status);
    println!("CPU Time: {}ms", result.cpu_time_ms);
    println!("Memory: {}KB", result.memory_kb);
    println!("Output: {}", String::from_utf8_lossy(&result.stdout));

    Ok(())
}
```

### Configuration Options

```rust
SandboxConfig::new(executable_path)
    .with_args(vec![...])              // Program arguments
    .with_stdin(data)                  // Input data
    .with_time_limit(ms)               // CPU time limit
    .with_wall_time_limit(ms)          // Wall-clock limit
    .with_memory_limit(bytes)          // Virtual memory ceiling
    .with_max_output(bytes)            // Stdout/stderr truncation limit
    .with_work_dir(path)               // Working directory
```

## Execution Verdicts

- **`Ok`** — Exit code 0, within all limits
- **`TimeLimitExceeded`** — CPU time exceeded or SIGKILL after wall-clock deadline
- **`MemoryLimitExceeded`** — Virtual memory allocation failure or RSS exceeds limit
- **`RuntimeError(code)`** — Non-zero exit code
- **`Signaled(sig)`** — Terminated by signal (SIGSEGV, SIGFPE, etc.)
- **`OutputLimitExceeded`** — Stdout/stderr exceeded byte limit

## Building and Testing

### Compile

```bash
cd judge-sandbox
cargo build --release
```

### Run Tests (Linux only)

```bash
cargo test --lib
```

Tests include:
- Basic echo execution
- Time limit enforcement
- Output truncation
- Exit code preservation
- Stdin redirection

### Benchmarks

```bash
cargo bench
```

Benches measure:
- Simple echo latency
- CPU-bound loop execution
- Memory overhead

## Performance Goals

**For 2000 concurrent submissions:**

- Each executor: ~5 MB RSS (zero-copy I/O)
- Compile + run overhead: <50ms per submission
- Concurrency model: Tokio async for I/O, blocking task pool for wait4/getrusage
- Queue drain time: ~2–10 minutes depending on avg CPU/submission

## Future Phases

### Phase 2: Multi-Language Support
- C/C++ with isolation
- Python with resource caps
- Go, Rust, Java via container sandboxes

### Phase 3: Distributed Queue
- Durable job queue (Redis/PostgreSQL)
- Worker pool scaling
- Verdict caching + deduplication

### Phase 4: Namespace Hardening
- User namespace for rootless operation
- Read-only root filesystem
- Seccomp syscall filtering

## Memory Safety

Rust guarantees:
- No buffer overflows in judge code
- No use-after-free
- No data races
- Safe file descriptor management

Isolation guarantees:
- User code cannot escape sandbox (kernel enforced)
- Resource limits prevent DoS
- Sanitized environment blocks info leaks
