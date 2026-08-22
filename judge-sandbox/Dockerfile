# ==============================================================================
# judge-sandbox — Standalone Dockerfile
#
# Build:  docker build -t judge-sandbox .
# Run:    docker run --rm --privileged -p 8080:8080 judge-sandbox
#
# The container needs --privileged (or fine-grained caps below) because the
# sandbox uses cgroups v2, pivot_root, mount/umount2, mknod, and seccomp.
#
# Fine-grained alternative to --privileged:
#   docker run --rm \
#     --cap-add SYS_ADMIN --cap-add MKNOD --cap-add SYS_PTRACE \
#     --security-opt seccomp=unconfined \
#     --security-opt apparmor=unconfined \
#     --cgroupns=host \
#     -v /sys/fs/cgroup:/sys/fs/cgroup:rw \
#     -p 8080:8080 judge-sandbox
# ==============================================================================

# ── Stage 1: Build the Rust binary ────────────────────────────────────────────
FROM rust:bookworm AS builder

WORKDIR /build

# Cache dependency compilation: copy manifests first, then source
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs && \
    mkdir -p src/sandbox src/api src/languages src/orchestrator src/queue && \
    touch src/lib.rs src/sandbox/mod.rs src/api/mod.rs src/languages/mod.rs \
          src/orchestrator/mod.rs src/queue/mod.rs && \
    cargo build --release 2>/dev/null || true && \
    rm -rf src

# Now copy the real source and build
COPY src/ src/
COPY benches/ benches/
RUN cargo build --release


# ── Stage 2: Runtime image with language toolchains ───────────────────────────
FROM debian:bookworm-slim AS runtime

# Avoid interactive prompts during package install
ENV DEBIAN_FRONTEND=noninteractive

# ─── Install language toolchains ───
# The Rust code expects these at /usr/bin/<name>:
#   /usr/bin/gcc          (C)
#   /usr/bin/g++          (C++)
#   /usr/bin/python3      (Python)
#   /usr/bin/rustc        (Rust)
#   /usr/bin/go           (Go)
#   /usr/bin/javac        (Java compile)
#   /usr/bin/java         (Java run)
RUN apt-get update && apt-get install -y --no-install-recommends \
    # C / C++
    gcc g++ libc6-dev \
    # Python
    python3 \
    # Java (headless JDK — includes javac + java)
    default-jdk-headless \
    # Go (Debian bookworm packages golang-go -> /usr/bin/go)
    golang-go \
    # Rust compiler (Debian packages rustc -> /usr/bin/rustc)
    rustc \
    # Utilities
    procps \
    && rm -rf /var/lib/apt/lists/*

# ─── Verify all expected binary paths exist ───
RUN set -e; for bin in gcc g++ python3 rustc go javac java; do \
      command -v "$bin" || { echo "MISSING: $bin"; exit 1; }; \
    done && echo "All language toolchains verified ✓"

# ─── Copy the judge binary ───
COPY --from=builder /build/target/release/judge-sandbox /usr/local/bin/judge-sandbox

# ─── Create cgroup v2 parent directory ───
# The sandbox creates per-job cgroups under /sys/fs/cgroup/judge/<uuid>
RUN mkdir -p /sys/fs/cgroup/judge 2>/dev/null || true

# ─── Create entrypoint that sets up cgroups at container start ───
COPY <<'ENTRYPOINT_SCRIPT' /entrypoint.sh
#!/bin/bash
set -e

# Enable required cgroup controllers for the judge subtree
CGROUP_ROOT="/sys/fs/cgroup"

# Ensure the judge cgroup parent exists
mkdir -p "$CGROUP_ROOT/judge" 2>/dev/null || true

# Try to enable memory, cpu, and pids controllers
if [ -f "$CGROUP_ROOT/cgroup.subtree_control" ]; then
    echo "+memory +cpu +pids" > "$CGROUP_ROOT/cgroup.subtree_control" 2>/dev/null || true
fi

echo "──────────────────────────────────────────────"
echo " Judge Sandbox starting..."
echo " Mode:    ${JUDGE_MODE:-server}"
echo " Port:    ${JUDGE_PORT:-8080}"
echo " Workers: ${JUDGE_WORKERS:-auto}"
echo "──────────────────────────────────────────────"

exec judge-sandbox "$@"
ENTRYPOINT_SCRIPT
RUN chmod +x /entrypoint.sh

# ─── Runtime configuration ───
ENV RUST_LOG=info
ENV JUDGE_MODE=server
ENV JUDGE_PORT=8080

EXPOSE 8080

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -sf http://localhost:8080/health || exit 1

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

ENTRYPOINT ["/entrypoint.sh"]
CMD ["--mode", "server"]
