# CodeChef PESUECC Chapter Portal 💻🌾

[![good first issues](https://img.shields.io/github/issues/codechefPesuecc/CodeChef-PESUECC-Chapter/good%20first%20issue.svg?label=good%20first%20issues&color=7057ff)](https://github.com/codechefPesuecc/CodeChef-PESUECC-Chapter/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22good%20first%20issue%22)
[![help wanted](https://img.shields.io/github/issues/codechefPesuecc/CodeChef-PESUECC-Chapter/help%20wanted.svg?label=help%20wanted&color=008672)](https://github.com/codechefPesuecc/CodeChef-PESUECC-Chapter/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22help%20wanted%22)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![live demo](https://img.shields.io/badge/demo-live-A67C52.svg)](https://codechef.pesuecc.workers.dev)

The official web platform and high-performance competitive programming ecosystem for the **CodeChef PESUECC Chapter**.

This repository houses a modern, edge-optimized application engineered using **Next.js**, **Cloudflare Pages**, and **Cloudflare D1**. It powers our landing page, dynamic student portfolios, a database-backed challenge track, and a live daily contest leaderboard backed by a secure, self-hosted sandboxed code execution microservice.

> ### 🙌 New here? We'd love your help.
> This is a **real platform our chapter uses every day** — so your PR ships to actual users, not a toy repo. There's a surface for every skill level: UI/UX, edge APIs, tests, docs, problem-setting, and DevOps. You do **not** need to be a competitive-programming or Next.js expert.
>
> **Get running in ~60 seconds** — no database or code-judge setup needed for most work:
> ```bash
> git clone https://github.com/codechefPesuecc/CodeChef-PESUECC-Chapter.git
> cd CodeChef-PESUECC-Chapter && npm ci && npm run dev   # → http://localhost:3000
> ```
>
> 👉 Pick a **[good first issue](https://github.com/codechefPesuecc/CodeChef-PESUECC-Chapter/issues?q=is%3Aissue%20is%3Aopen%20label%3A%22good%20first%20issue%22)** · skim the friendly **[Contributing guide](./CONTRIBUTING.md)** · try it live at **[codechef.pesuecc.workers.dev](https://codechef.pesuecc.workers.dev)**.
> Your first-ever open-source PR? Fixing a typo counts. **You belong here.**

---

## 🏗️ Technical Architecture & Stack

* **Frontend Framework:** Next.js (App Router) built for Cloudflare Workers via the OpenNext adapter (`@opennextjs/cloudflare`).
* **Hosting & Deploy:** **Cloudflare Workers**. Builds run through the OpenNext adapter and deploy with Wrangler (see `DEPLOY.md`).
* **Database (Edge Storage):** **Cloudflare D1** (Serverless, ultra-low latency SQLite database running natively on Cloudflare's global edge network).
* **Content Pipeline:** Problems live in **Cloudflare D1** — authored as JSON, validated, and loaded with `npm run challenges:seed`, so publishing a problem needs no redeploy. Hidden tests never enter the repo.
* **Code Judge Sandbox:** A self-hosted instance of the **Rust Judge Sandbox / AlgoHunt Base** running on an isolated Linux VPS with Cgroups v2, pivot_root, namespaces, and seccomp isolation.

---

## 📂 Repository Directory Tree

```text
├── .github/workflows/       # CI: typecheck, lint, test, build
├── src/
│   ├── app/                 # Next.js App Router (Pages & Edge API Routes)
│   │   ├── api/             # Edge backends (/api/submit, /api/leaderboard)
│   │   ├── cp-arena/        # Daily challenge engine & live standings
│   │   ├── initiatives/     # Events & Engineered Systems portfolio
│   │   └── team/            # Core and Alumni registry pages
│   ├── components/          # Reusable UI modules (CodeChef Brand System)
│   └── styles/              # Global layout design variables
├── challenges/              # Problem authoring source (JSON) — seeded into D1, not committed
├── migrations/              # Cloudflare D1 SQLite database schemas
├── wrangler.jsonc            # Cloudflare Workers & D1 binding configuration
└── README.md
```

---

## 🎨 Official CodeChef Branding Guide

The interface utilizes the formal, premium CodeChef corporate visual palette to match the global platform look and feel:

* **Background:** `#F5F1EB` (Clean, Soft Cream Canvas)
* **Primary Structural Accent:** `#5B4638` (Warm Earthy Brown)
* **Deep Contrast Typography:** `#3E2F24` (Dark Chocolate Brown)
* **Call-to-Actions / Buttons:** `#A67C52` (Polished Bronze Accent)
* **Body Narrative UI:** `#1F1F1F` (Charcoal)
* **Component Panels:** `#FFFFFF` (Pure White Containers)

---

## 📝 Problem Setters' Workflow

Problems live in the database, not the repo. A problem is authored as one **JSON** file, validated, then loaded into D1 with the seed script — **publishing is a database write, not a redeploy** — and hidden tests never enter the public repository. (An in-browser admin dashboard for authoring is planned; until then, the seed script is the publish path.)

### Challenge file format (`YYYY-MM-DD-slug.json`)

Each problem is a single JSON object. The authoritative shape is enforced by the shared schema in `scripts/challenge-schema.ts` (used by both the validator and the seeder); see `challenges/README.md` for the full field list. In brief:

```json
{
  "title": "Minimize the Maximum Difference",
  "difficulty": "Medium",
  "date": "2026-07-20",
  "tags": ["Arrays", "Binary Search", "Greedy"],
  "timeLimit": "1s",
  "memoryLimit": "256 MB",
  "statement": "Given an integer array nums and an integer p, ...",
  "inputFormat": "The first line contains the array size and p, ...",
  "outputFormat": "A single integer ...",
  "constraints": "1 <= n <= 1e5",
  "checker": "token",
  "samples": [{ "input": "4 1\n10 1 2 7", "output": "1" }],
  "tests":   [{ "input": "...", "output": "..." }]
}
```

`samples` are shown to solvers; `tests` are the hidden judged cases — server-side only, never sent to the client, and never committed to the repo (the authoring JSON is git-ignored).

### How a problem goes live

1. Author `YYYY-MM-DD-slug.json` and validate it: `npm run challenges:validate`.
2. Seed it into the database — local dev: `npm run challenges:seed`; production D1: `npm run challenges:seed -- --target remote`.
3. It's live immediately: the Problem of the Day is the most recent released challenge whose `date` (IST) is on or before today. No deploy required.

---

## ⚙️ Solution Runner & Sandbox Architecture

To prevent execution vulnerabilities (Infinite loops, file-system intrusions, fork bombs), arbitrary user code submitted to the site is entirely isolated from Cloudflare components:

1. **Submission Event:** A student writes a solution on the portal frontend and clicks **Submit**.
2. **Edge Proxying:** The Cloudflare Edge API captures the request, assigns it a secure verification tracking token inside Cloudflare D1, and securely dispatches an HTTP POST payload to the remote **Oracle Cloud Linux VPS**.
3. **Container Sandboxing:** The Oracle Cloud VPS runs a fast code runner container. It spins up an ephemeral, isolated container shell, parses the student's script code against hidden validation vectors, tracks time limits, and calculates the response flag (`AC` (Accepted), `WA` (Wrong Answer), `TLE` (Time Limit Exceeded)).
4. **Result Callback:** The VPS safely relays the status state back to the Cloudflare API endpoint, which updates the live Cloudflare D1 database records and adjusts leaderboard positions in real-time.

---

## 🚀 Local Development Setup

### Prerequisites

* Node.js v18+
* Cloudflare Wrangler CLI installed globally (`npm install -g wrangler`)

### Step-by-Step Installation

1. **Clone the codebase:**

   ```bash
   git clone https://github.com/codechefPesuecc/CodeChef-PESUECC-Chapter.git
   cd CodeChef-PESUECC-Chapter
   ```

2. **Install project node components:**

   ```bash
   npm install
   ```

3. **Run the app** — no database setup needed. `npm run dev` uses a local SQLite file (`./data/arena.db`) and auto-applies the migrations in `/migrations` on startup:

   ```bash
   npm run dev
   ```

   For the code judge (Run / Submit), start the Judge Sandbox — see `docs/backend.md`. Deploying to Cloudflare (the `pesuecc-arena` D1 database + secrets) is covered in `DEPLOY.md`.

Open `http://localhost:3000` inside your browser to see your local instance.

---