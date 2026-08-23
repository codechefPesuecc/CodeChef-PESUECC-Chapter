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

# Block cloud metadata service IP (Azure / AWS / GCP) from container egress
iptables -A OUTPUT -d 169.254.169.254 -j DROP 2>/dev/null || true

echo "----------------------------------------------"
echo " Judge Sandbox starting..."
echo " Mode:    ${JUDGE_MODE:-server}"
echo " Port:    ${JUDGE_PORT:-8080}"
echo " Workers: ${JUDGE_WORKERS:-auto}"
echo "----------------------------------------------"

exec judge-sandbox "$@"