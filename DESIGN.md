# Design Specification: CodeChef PESUECC Chapter Website
**Document Version:** 1.1.0  
**Target Environment:** Google Sites / Stitch Responsive Layout Engine  
**Visual Aesthetic:** Modern Minimalist CodeChef Brand Layout (Warm Earthy Browns, Clean Neutrals, High-Contrast Readability)

---

## 🎨 1. Global Visual Identity & Theme Architecture

### Strict Color Palette
The interface utilizes the official, warm CodeChef brand system to maintain absolute continuity with the main platform. 

*   **Primary Background Canvas:** `#F5F1EB` (Clean, Soft Cream)
*   **Primary Brand Structural Elements:** `#5B4638` (Warm Earthy Brown)
*   **Headers, Focus Zones & Deep Accents:** `#3E2F24` (Dark Chocolate Brown)
*   **Interactive Call-to-Actions / Buttons:** `#A67C52` (Polished Bronze Accent)
*   **Primary Body Typography & Interfaces:** `#1F1F1F` (Sharp Charcoal)
*   **Card Background Elements:** `#FFFFFF` (Pure White Panels)

### Typography Hierarchy
*   **Display Headers / Titles:** Space Grotesk or Plus Jakarta Sans (Weight: Bold/700, Color: `#3E2F24`)
*   **Body Narrative / Descriptions:** Inter or Roboto (Weight: Regular/400, Color: `#1F1F1F`)
*   **System Metrics & Code Snippets:** Monospace / JetBrains Mono (Color: `#5B4638`)

---

## 🗺️ 2. Architectural Blueprint & Page Layouts

### 🏠 Page 1: Home Dashboard (`/index`)
Designed for an elegant, high-end university presence that emphasizes campus technical growth.

*   **Hero Module:** 
    *   Left Column: Large typography heading using Dark Brown (`#3E2F24`): `CodeChef PESUECC Chapter`. Followed by a clean Charcoal text summary about building a campus competitive programming culture.
    *   Right Column: Minimalist, clean-bordered card housing a high-resolution photo of the club's development team.
*   **Live Metrics Ledger:** A 3-column pure white (`#FFFFFF`) row panel showcasing key validation metrics:
    *   `500+` Active Developers (Rendered in `#5B4638`)
    *   `3+` Production Platforms Built
    *   `$1000+` Monthly Rewards Distributed
*   **Pillars of Growth Track:** 3 side-by-side crisp white cards detailing operational tracks (Structured CP, Universal Scale, Inter-College Integration) framed with subtle bronze (`#A67C52`) typography accents.

### ⚔️ Page 2: Daily CP Arena & Leaderboard (`/cp-arena`)
The central engagement dashboard for daily campus competitive programming.

*   **Problem of the Day Terminal:** A clean, crisp white container panel.
    *   Contains the daily challenge title, tags (e.g., *Arrays, Greedy*), and a prominent Bronze Accent (`#A67C52`) rectangular action button: `[ Solve on CodeChef ↗ ]`.
*   **Bounty Terms Container:** Styled callout frame using a soft cream base with a solid Primary Brown left-border rule, detailing the cash reward mechanics for the top monthly solvers.
*   **Dynamic Standings Grid:** Embedded live Google Sheets data matrix formatted natively with cream and white alternating rows to look integrated seamlessly into the page template.

### 🚀 Page 3: Technical Initiatives (`/initiatives`)
A structured grid showcasing both community platforms and competitive events.

*   **Sub-Section: Flagship Campus Events** (3-Column Clean Card Array)
    *   *LeetCode 101:* Foundations of problem-solving bootcamps.
    *   *AlgoHunt:* Gamified algorithms integrated with physical treasure hunts.
    *   *Praxis Hackathon:* Fast-paced AI project building sprint.
*   **Sub-Section: Engineered Systems Portfolio** (2-Column Deep-Dive Frame)
    *   *Eclipse:* The custom event management infrastructure engineered to scale the Praxis Hackathon.
    *   *AlgoHunt Base:* The standalone, independent contest engine backed by the Piston compiler engine.

### 👥 Page 4: Team Registry (`/team`)
A complete, tiered organizational tree preserving historical and active club engineering tenure.

*   **Tier 1: Core Leadership Grid:** 3 to 4 column presentation layer mapping active Core Executives. Includes sharp, circular high-resolution technical headshots framed in Primary Brown, Name text, specific Role definitions, and clean anchor links directed to GitHub and LinkedIn profiles.
*   **Tier 2: General Core Assembly:** A tight, compact inline matrix grouping technical developers, internal problem setters, and logistical operational managers.
*   **Tier 3: Alumni Legacy Archives:** Implemented via a clean, collapsible accordion layout element grouped by structural tenure year (e.g., `Legacy Cohort: Class of 2024-2025`), ensuring historical engineering contributions remain accessible without cluttering the active directory.

---

## 🛠️ 3. Component Implementation Rules

1.  **Component Borders:** Avoid heavy black borders. Use fine, soft borders (`1px solid #E2E8F0`) or gentle shadows on white backgrounds to ensure the UI feels modern, spacious, and premium.
2.  **Button Layouts:** Primary actions must use filled Bronze palettes (`#A67C52`) with white text, or an outlined style using Primary Brown (`#5B4638`).
3.  **Data Alignment:** Tables, lists, and matrix metrics must enforce crisp text line alignments, keeping numerical counts distinct and easy to scan.