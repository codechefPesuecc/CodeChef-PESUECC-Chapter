# Akiro Distributed Horizontal Scaling Guide

Akiro features a built-in, zero-dependency distributed worker cluster powered by **Redis Streams**. This architecture allows you to scale code execution throughput linearly across multiple machines (e.g., student laptops, organizer workstations, secondary cloud VMs, or dedicated servers) during live contests or high-traffic events.

---

## 🏛 Architecture Overview

```
                      +-----------------------------------+
                      |   CodeChef PESU ECC Frontend      |
                      |   (Cloudflare Workers / Web UI)   |
                      +-----------------+-----------------+
                                        |
                                        v  HTTPS / REST API
                      +-----------------------------------+
                      |   Azure Leader Node (VM)          |
                      |   - Akiro HTTP Gateway (:8080)    |
                      |   - Embedded Redis Broker (:6379) |
                      |   - Local Worker Pool (2 vCPUs)   |
                      +-----------------+-----------------+
                                        |
                 +----------------------+----------------------+
                 |                      |                      |
                 v Redis Stream         v Redis Stream         v Redis Stream
   +---------------------------+  +---------------------------+  +---------------------------+
   |  Laptop 1 (Organizer)     |  |  Laptop 2 (Volunteer)     |  |  Secondary Cloud VM       |
   |  - 8-16 Worker Threads    |  |  - 8-16 Worker Threads    |  |  - 4-8 Worker Threads     |
   |  - Sandboxed Isolation    |  |  - Sandboxed Isolation    |  |  - Sandboxed Isolation    |
   +---------------------------+  +---------------------------+  +---------------------------+
```

### Key Principles
1. **Leader Node (`JUDGE_MODE=all`)**: Runs both the Axum HTTPS REST gateway and the Redis broker. It exposes the public API at `https://20.219.186.217.nip.io`.
2. **Worker Nodes (`JUDGE_MODE=worker`)**: Pure execution nodes that pull submissions from the `judge_workers` consumer group, run code inside isolated Linux namespaces/cgroups, and store verdicts directly into Redis keys (`judge:results:<job_id>`).
3. **Dynamic Cluster `/health` Aggregation**: The leader node inspects active consumers and heartbeats to report the total live capacity across all connected machines.
4. **Instant Zero-Downtime Join/Leave**: Workers can connect or disconnect at any second. If a worker goes offline, remaining nodes automatically drain the queue without dropping any submissions.

---

## 📋 Prerequisites for Any Worker Machine

1. **Docker Desktop** (or Docker Engine on Linux) with WSL2 enabled on Windows.
2. The SSH private key: `azure-judge-key.pem`.
3. An internet connection.

---

## 🚀 How to Add Any Laptop to the Judge Cluster (2-Step Setup)

Any organizer, core member, or volunteer can contribute their laptop's CPU cores to the live judging infrastructure in under 2 minutes:

### Step 1: Open the Encrypted Gateway SSH Tunnel

This creates an encrypted, keepalive tunnel from the laptop to the Azure VM Redis broker without needing any firewall or port changes.

#### 🪟 Windows (PowerShell):
```powershell
ssh -i "$env:USERPROFILE\Downloads\azure-judge-key.pem" -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=15 -o ServerAliveCountMax=6 -o GatewayPorts=yes -N -L 0.0.0.0:6380:127.0.0.1:6379 azureuser@20.219.186.217
```

#### 🍎 macOS / 🐧 Linux (Terminal):
```bash
chmod 400 ~/Downloads/azure-judge-key.pem
ssh -i ~/Downloads/azure-judge-key.pem -o StrictHostKeyChecking=accept-new -o ServerAliveInterval=15 -o ServerAliveCountMax=6 -o GatewayPorts=yes -N -L 0.0.0.0:6380:127.0.0.1:6379 azureuser@20.219.186.217
```
*(Keep this terminal open while the laptop is acting as a judge worker).*

---

### Step 2: Launch the Worker Container

Open a **new terminal window** and run:

#### 🪟 Windows (PowerShell / Command Prompt):
```powershell
# 1. (Optional) Build image if not already built on this laptop:
# docker build -t akiro:latest https://github.com/barunaniket/akiro.git#main

# 2. Launch worker container with 8 cores (or adjust to match CPU core count):
docker run -d --name akiro-worker --privileged --restart unless-stopped -e ENABLE_EMBEDDED_REDIS=false akiro:latest --mode worker --redis redis://:<JUDGE_SECRET>@host.docker.internal:6380 --workers 8
```

#### 🍎 macOS (Apple Silicon / Intel):
```bash
docker run -d --name akiro-worker --privileged --restart unless-stopped -e ENABLE_EMBEDDED_REDIS=false akiro:latest --mode worker --redis redis://:<JUDGE_SECRET>@host.docker.internal:6380 --workers 8
```

#### 🐧 Linux:
```bash
docker run -d --name akiro-worker --privileged --restart unless-stopped --network host -e ENABLE_EMBEDDED_REDIS=false akiro:latest --mode worker --redis redis://:<JUDGE_SECRET>@127.0.0.1:6380 --workers 8
```

---

## 🔍 How to Verify the Laptop is Connected

### 1. Check Local Worker Logs
```bash
docker logs -f akiro-worker
```
Expected output:
```log
INFO akiro: Starting Akiro in WORKER mode (Redis consumer)
INFO akiro::orchestrator::pool: Worker 0 started
...
INFO akiro::orchestrator::pool: Worker 7 started
INFO akiro::queue::redis: Redis consumer started: judge:jobs on group judge_workers as worker-w8-a4734094...
```

When submissions arrive, you will see real-time execution logs:
```log
INFO akiro::queue::redis: Processing job bench-job-078-typescript from Redis
INFO akiro::orchestrator::pool: Worker 3 completed job bench-job-078-typescript: Ok(Accepted)
INFO akiro::queue::redis: Job bench-job-078-typescript completed and result stored
```

### 2. Check Public Cluster Health
Query the public health endpoint to see the aggregated worker count:

```bash
curl -sS -H "X-Judge-Secret: <JUDGE_SECRET>" https://20.219.186.217.nip.io/health
```

Expected JSON response:
```json
{
  "idle_workers": 10,
  "busy_workers": 0,
  "queued_jobs": 0,
  "total_workers": 10,
  "uptime_secs": 143
}
```
* `2 (Azure VM) + 8 (Laptop 1) = 10 total workers`
* If a 2nd laptop joins with 8 workers, `total_workers` automatically becomes **18**!

---

## 🛑 How to Disconnect / Stop a Worker Machine

To cleanly remove a laptop from the cluster:

```bash
docker stop akiro-worker
docker rm akiro-worker
```
Close the SSH tunnel terminal window.

The Azure VM leader node will seamlessly absorb any remaining workload without losing any submissions.

---

## ⚡ Capacity Scaling Quick Reference

| Cluster Configuration | Total Active Workers | 200-Submission Heavy Burst Drain Time | Throughput |
| :--- | :---: | :---: | :---: |
| **Azure VM alone (Baseline)** | 2 | ~57 seconds | ~3.5 jobs/s |
| **Azure VM + 1 Laptop (8 cores)** | **10** | **~20–25 seconds** | **~10–12 jobs/s** |
| **Azure VM + 2 Laptops (8 cores each)** | **18** | **~10–14 seconds** | **~18–22 jobs/s** |
| **Azure VM + 3 Laptops (8 cores each)** | **26** | **~6–8 seconds** | **~26–30 jobs/s** |
