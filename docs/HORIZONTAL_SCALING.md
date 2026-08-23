# Akiro Distributed Horizontal Scaling Guide

Akiro features a built-in, zero-dependency distributed worker queue powered by **Redis Streams**. This architecture allows you to scale code execution throughput linearly across multiple machines (e.g., student laptops, secondary cloud VMs, or dedicated servers) during live contests or high-traffic events.

---

## 🏛 Architecture Overview

```
                      +-----------------------------------+
                      |   CodeChef PESU ECC Frontend      |
                      |   (Cloudflare Workers / Web)      |
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
                 |                                             |
                 v Redis Stream (`judge:jobs`)                 v Redis Stream (`judge:jobs`)
   +---------------------------+                 +---------------------------+
   |   Worker Node 1 (Laptop)  |                 |   Worker Node 2 (Cloud)   |
   |   - 8-16 Worker Threads   |                 |   - 4-8 Worker Threads    |
   |   - Sandboxed Execution   |                 |   - Sandboxed Execution   |
   +---------------------------+                 +---------------------------+
```

### Key Principles
1. **Leader Node (`JUDGE_MODE=all`)**: Runs both the Axum REST/WebSocket gateway and the lightweight embedded Redis daemon (capped at 64MB LRU memory).
2. **Worker Nodes (`JUDGE_MODE=worker`)**: Pure execution nodes that consume from the `judge_workers` consumer group, run code inside isolated Linux namespaces/cgroups, and store verdicts directly into `judge:results:<job_id>`.
3. **Automatic Load Balancing**: Redis Streams distribute submissions across all active workers in real time with zero duplicate execution.
4. **Auto-Discovery & Failover**: Workers can join or leave the cluster dynamically without restarting the leader node or interrupting active contests.

---

## 📋 Prerequisites on the Worker Machine

- **Docker Engine** (or Docker Desktop with WSL2 on Windows, Linux, or macOS).
- **Network Access** to the Azure Leader Node's Redis port (`6379`).

---

## 🚀 Adding a Worker Node (Step-by-Step)

### Option A: Local Laptop / Workstation via Encrypted SSH Tunnel (Recommended)
This method requires **no changes** to Azure firewall/NSG rules and encrypts all job traffic over SSH.

#### 1. Open the SSH Tunnel
On your local machine (PowerShell on Windows or Terminal on Linux/macOS):

```powershell
# Windows PowerShell
ssh -i "$env:USERPROFILE\Downloads\azure-judge-key.pem" -N -L 6380:127.0.0.1:6379 azureuser@20.219.186.217
```

```bash
# Linux / macOS
ssh -i ~/azure-judge-key.pem -N -L 6380:127.0.0.1:6379 azureuser@20.219.186.217
```
*(Leave this terminal window open or run with `-f` in the background).*

#### 2. Start the Akiro Worker Container
In a second terminal, launch the worker container:

```bash
docker run -d \
  --name akiro-worker \
  --privileged \
  --restart unless-stopped \
  -e JUDGE_MODE=worker \
  -e JUDGE_REDIS=redis://:ceef3470b081d9f851ea3acc65efc4a0fd61f65d3d426998f49f57e37a945e5f@host.docker.internal:6380 \
  -e JUDGE_WORKERS=8 \
  akiro:latest
```

---

### Option B: Direct Cloud-to-Cloud Connection (Secondary Cloud VMs)
If connecting a secondary cloud instance (e.g. AWS EC2, GCP Compute Engine, Hetzner):

1. **Open Port 6379 in Azure Portal**:
   - Go to **Azure Portal** ➔ **Virtual Machines** ➔ `judge-node-01` ➔ **Networking**.
   - Click **Add inbound port rule**:
     - **Destination port ranges**: `6379`
     - **Protocol**: `TCP`
     - **Action**: `Allow`
     - **Name**: `Allow-Redis-Worker-Queue`

2. **Run Worker on Secondary VM**:
   ```bash
   docker run -d \
     --name akiro-worker \
     --privileged \
     --restart unless-stopped \
     -e JUDGE_MODE=worker \
     -e JUDGE_REDIS=redis://:ceef3470b081d9f851ea3acc65efc4a0fd61f65d3d426998f49f57e37a945e5f@20.219.186.217:6379 \
     -e JUDGE_WORKERS=auto \
     akiro:latest
   ```

---

## ⚙️ Environment Variables Reference

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `JUDGE_MODE` | Operational mode: `server`, `worker`, or `all` | `worker` |
| `JUDGE_REDIS` | Redis connection URL with auth password | `redis://:<SECRET>@<HOST>:<PORT>` |
| `JUDGE_WORKERS` | Number of worker execution threads | `auto` (matches host CPU core count) or explicit integer (e.g. `8`) |
| `RUST_LOG` | Logging verbosity | `info` (or `debug` for troubleshooting) |

---

## 🔍 Verifying Connected Workers

### 1. Check Worker Container Logs
```bash
docker logs -f akiro-worker
```
Expected output:
```log
INFO akiro: Starting Akiro in ALL mode (server + worker pool)
INFO akiro::orchestrator::pool: Worker 0 started
INFO akiro::orchestrator::pool: Worker 1 started
...
INFO akiro::queue::redis: Redis consumer started: judge:jobs on group judge_workers as worker-b0ce4873-5994-4ed3-ab73-16fdc06257fa
```

### 2. Check Active Consumers on the Leader Node
On the Azure Leader VM:
```bash
sudo docker exec judge-server redis-cli -a ceef3470b081d9f851ea3acc65efc4a0fd61f65d3d426998f49f57e37a945e5f XINFO CONSUMERS judge:jobs judge_workers
```
This lists all active worker nodes connected across the cluster and their current idle/active state.

---

## 🛑 Disconnecting / Stopping a Worker Node

To cleanly remove a worker machine from the cluster:

```bash
docker stop akiro-worker
docker rm akiro-worker
```

The leader node will immediately continue processing submissions using its local pool without dropping any queued jobs.
