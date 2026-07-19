# CodeChef PESUECC Chapter Portal 💻🌾

The official web platform and high-performance competitive programming ecosystem for the **CodeChef PESUECC Chapter**.

This repository houses a modern, edge-optimized application engineered using **Next.js**, **Cloudflare Pages**, and **Cloudflare D1**. It powers our landing page, dynamic student portfolios, a GitOps-driven challenge track, and a live daily contest leaderboard backed by a secure, self-hosted sandboxed code execution microservice.

---

## 🏗️ Technical Architecture & Stack

* **Frontend Framework:** Next.js (App Router) optimized for Edge runtimes.
* **Hosting & CI/CD:** **Cloudflare Pages** integrated directly with GitHub. Every commit to `main` instantly builds and updates globally via Wrangler pipelines.
* **Database (Edge Storage):** **Cloudflare D1** (Serverless, ultra-low latency SQLite database running natively on Cloudflare's global edge network).
* **Content Pipeline (GitOps):** Markdown (`.md`) files with YAML Frontmatter for challenge orchestration.
* **Code Judge Sandbox:** A self-hosted instance of the **Piston Engine / AlgoHunt Base** running on an isolated **Oracle Cloud Infrastructure (OCI) Always Free Ampere A1 Compute Instance** (Configured at 2 OCPUs / 12 GB RAM).

---

## 📂 Repository Directory Tree

```text
├── .github/workflows/       # CI/CD pipelines (Auto-sync challenges to D1)
├── src/
│   ├── app/                 # Next.js App Router (Pages & Edge API Routes)
│   │   ├── api/             # Edge backends (/api/submit, /api/leaderboard)
│   │   ├── cp-arena/        # Daily challenge engine & live standings
│   │   ├── initiatives/     # Events & Engineered Systems portfolio
│   │   └── team/            # Core and Alumni registry pages
│   ├── components/          # Reusable UI modules (CodeChef Brand System)
│   └── styles/              # Global layout design variables
├── challenges/              # GitOps directory: Active challenge Markdown records
├── migrations/              # Cloudflare D1 SQLite database schemas
├── wrangler.toml             # Cloudflare Pages & D1 binding configurations
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

## 📝 Problem Setters' Workflow (GitOps)

Problem setters do not access databases or administrative visual panels directly. To push a new problem to the live site, they utilize standard version-controlled Markdown files inside the `/challenges/` directory.

### Challenge Schema File Format (`/challenges/YYYY-MM-DD-slug.md`)

````markdown
---
title: "Minimize the Maximum Difference"
difficulty: "Medium"
points: 100
tags: ["Arrays", "Binary Search", "Greedy"]
date: "2026-07-20"
---

# Minimize the Maximum Difference

Given an integer array `nums` and an integer `p`, find `p` pairs of indices such that the maximum difference between the paired elements is minimized.

## Input Format
- The first line contains the array size and `p`.
- The second line contains the array elements.

## Sample Input
```text
4 1
10 1 2 7
```

## Sample Output
```text
1
```
````

### Automated Sync Mechanics

1. A problem setter pushes a new `.md` file via a GitHub Pull Request (PR).
2. The core team reviews the formatting, hidden edge cases, and constraints before merging to `main`.
3. Upon merge, a **GitHub Action** executes a custom parser script that reads the YAML Frontmatter header, converts the markdown body into standard text/HTML format, and invokes the `wrangler d1 execute` command to instantly sync the problem parameters into the live Cloudflare D1 database.

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
   git clone https://github.com/your-username/codechef-pesuecc-site.git
   cd codechef-pesuecc-site
   ```

2. **Install project node components:**

   ```bash
   npm install
   ```

3. **Initialize the local Cloudflare D1 SQLite test database instance:**

   ```bash
   wrangler d1 migrations apply codechef_db --local
   ```

4. **Boot up the local Next.js edge simulation server environment:**

   ```bash
   npm run dev
   ```

Open `http://localhost:3000` inside your browser to see your local instance.

---