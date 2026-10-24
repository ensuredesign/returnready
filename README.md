# ReturnReady — Your Household Returns Assistant

**App Developed by:** **Ritesh Kochar** (`@ensuredesign`) for **Build, Ship, Shape: Amazon Developer Hackathon** on **Oct 23, 2026**  
**Track:** Alexa+ Track (Simulated Experience Path)  
**Built With:** Google Antigravity, React 19, TypeScript 5.7, Vite 6, Supabase (Auth, PostgREST, PostgreSQL + RLS), Vitest, Playwright & Vercel

[![Live Demo Application](https://img.shields.io/badge/Live_App-returnready.ensure.in-0D7A6F?style=for-the-badge)](https://returnready.ensure.in/)
[![Watch Demo Video on YouTube](https://img.shields.io/badge/YouTube_Demo_Video-Watch_Now_(2%3A21)-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://youtu.be/GEOhZsTn5ME)
[![License: MIT](https://img.shields.io/badge/License-MIT-0F1E36?style=for-the-badge)](./LICENSE)

> **Simulation Notice:** Rule-based conversational simulation built using AI-assisted development in Google Antigravity; no live Alexa backend or LLM runtime. Sample data is provided for instant testing; ReturnReady does not connect to retailer accounts, verify return-policy eligibility, process refunds, book couriers, or send external notifications.

---

## 🎥 Official Demo Video & Live Application

- **YouTube Demo Video (2:21):** [**https://youtu.be/GEOhZsTn5ME**](https://youtu.be/GEOhZsTn5ME)
- **Live Deployed Application:** [**https://returnready.ensure.in/**](https://returnready.ensure.in/)
- **GitHub Repository:** [**https://github.com/ensuredesign/returnready**](https://github.com/ensuredesign/returnready)

---

## 1. Product Overview — Less Return Chaos, More Clarity

![ReturnReady — Less return chaos. More clarity. Your household returns, organized.](./docs/images/01-hero-household-returns-organized.jpg)

**ReturnReady** helps a household turn an intention to return a purchase into a prepared, assigned task. Household returns frequently fail because a return deadline slips by, packing accessories (such as a charging cable or receipt) are left behind on a desk, or two family members each assume the other person handled the drop-off.

> **Core Promise:** *Know what is due, prepare what is needed, and decide who will handle it.*

### Five Core Capabilities Shown Above
1. **Deadline Tracking (`Asia/Kolkata`):** Displays active returns sorted by earliest user-recorded deadline, with instant summary cards for **Active returns (`5`)**, **Due within 7 days (`3`)**, and **Ready to drop off (`1`)**, plus one-click filters for **All active**, **Due soon**, **Overdue**, **Ready**, and **Dropped off**.
2. **Conversational Help (Alexa+ Experience Simulation):** A split-screen **ReturnReady Assistant** panel lets users ask natural questions such as *"What needs returning this week?"*, *"Prepare the headphones"*, and *"What is missing?"* via text, suggested prompt chips, or browser speech input.
3. **Packing Checklists:** Item-specific preparation steps ensure every accessory, cable, and receipt goes into the box before sealing it.
4. **Confirmed Assignments:** Coordinate household responsibility across members (`Me`, `Priya`, `Alex`, or custom names) with explicit confirmation cards.
5. **Saved Progress:** Backed by a real Supabase PostgreSQL database with per-session Row Level Security (`RLS`) so every toggle and assignment persists across browser refreshes.

---

## 2. Feature Walkthrough

### 2.1 From Planning to Drop-Off — Clear Lifecycle Status for Every Return

![From planning to drop-off — See the status of each household return](./docs/images/02-planning-to-dropoff-status.jpg)

Every purchase in ReturnReady progresses through a clear, transparent preparation lifecycle:
- **1. Planning:** Record the item details, purchase amount in Indian Rupees (`₹`), and user-entered return deadline (`return_deadline >= purchase_date`), or start immediately with the 5 seeded sample household purchases via `rr_bootstrap_demo()`.
- **2. Preparing & Derived “Ready” Status:** As household members check off packing steps, the item transitions from `Planning` to `Preparing`. The moment all checklist items are checked (`100%`), ReturnReady automatically derives the **Ready to drop off** badge. Unchecking any step immediately removes the Ready state.
- **3. Dropped Off:** Once a family member takes the parcel to the drop-off location and confirms **Mark dropped off**, ReturnReady records the `dropped_off_at` timestamp in PostgreSQL and locks the checklist against accidental edits (unless explicitly reopened).
- **Honest Scope Guardrails:** ReturnReady clearly states on screen that deadlines and drop-offs are recorded by the user and that there is no live retailer connection or refund processing.

---

### 2.2 Know What Is Still Missing — Contextual Assistant & Packing Checklists

![Know what is still missing — Ask your assistant before you pack](./docs/images/03-know-what-is-missing-assistant.jpg)

Before sealing a return parcel, users can ask the **ReturnReady Assistant** what still needs to go inside the box:
- **Contextual Item Focus:** Asking *"Prepare the headphones"* selects the **Wireless Headphones (`₹4,999`)** in the workspace context. Following up with *"What is missing?"* inspects the live checklist state for that item (`2 of 4 packed`) and highlights the exact unchecked items (such as the **Charging cable** and **Receipt** / **Protective packaging**).
- **Atomic Checklist Persistence (`rr_set_checklist`):** Each checklist step toggles independently in PostgreSQL, disables duplicate clicks while saving, retains its prior state if a network error occurs, and increments the parent return's `version` counter.
- **Actionable Next Steps:** Combines deadline awareness, packing step verification, and guided next prompts in one conversational view.

---

### 2.3 Pick Up Where You Left Off — Confirmed Assignments & Persistent State

![Pick up where you left off — Your checklists and assignments stay saved](./docs/images/04-saved-progress-and-assignments.jpg)

ReturnReady is engineered so household coordination never gets lost when you close or refresh the tab:
- **Version-Bound Confirmed Household Assignment (`rr_confirm_action`):** Asking *"Assign this to Priya"* (or selecting **Priya** in the item detail view) never mutates the database silently. Instead, it creates a pending confirmation card bound to the item ID, member ID, and expected database `version` (with a 5-minute expiration window).
- **Optimistic Concurrency Verification:** When the user clicks **Confirm**, PostgreSQL verifies that `rr_returns.version = expected_version` before saving `Assigned to Priya`. If the item was modified in the meantime, the stale confirmation is rejected safely and refreshed.
- **True Supabase Persistence Across Refresh:** Because every visitor receives an isolated authenticated Supabase JWT session (`ensureDemoSession()`) backed by PostgreSQL Row Level Security (`owner_user_id = (SELECT auth.uid())`), refreshing the browser preserves `Ready to drop off` status, completed checklists, and `Assigned to Priya`.

---

## 3. End-to-End Household Return Flow & Technology Stack

![ReturnReady End-to-End Household Return Flow & Technology Stack](./docs/images/05-architecture-and-return-flow.png)

### 6-Step End-to-End Household Return Flow
1. **Try Sample Household:** Establishes an isolated Supabase Auth session and runs `rr_bootstrap_demo()` to seed 5 INR (`₹`) purchases and 3 household members (`Me`, `Priya`, `Alex`).
2. **What Is Due This Week?:** Filters active returns to the inclusive 7-day calendar window (`today` through `today + 7`) anchored to `Asia/Kolkata`.
3. **Prepare the Headphones:** Selects the item in conversational context and reports missing packing steps.
4. **Complete Checklist:** Toggles packing steps via `rr_set_checklist()` and automatically derives **Ready to Drop Off** when all steps are checked.
5. **Assign to Priya:** Presents a version-bound confirmation card (`Confirm`) and executes `rr_confirm_action()`.
6. **Persist & Handover:** Saves all state in PostgreSQL protected by Row Level Security (`RLS`) and composite foreign keys, surviving browser reloads.

### Technology Stack Summary

| Layer | Technology | Role in ReturnReady |
|---|---|---|
| **Frontend UI** | **React 19** | Split workspace dashboard, item detail drawer, and accessible status cards |
| **Type & State Safety** | **TypeScript 5.7** | Strict type checking, derived status logic, and version-bound confirmation models |
| **Build Tooling** | **Vite 6** | Fast HMR development server and optimized production asset bundling |
| **Auth & Data API** | **Supabase (`@supabase/supabase-js`)** | Isolated per-session JWT authentication, PostgREST Data API, and RPC execution |
| **Database & Security** | **PostgreSQL 15+ (RLS + PL/pgSQL)** | Scoped `rr_*` tables, Row Level Security (`auth.uid()`), composite FKs, triggers & 4 transactional RPCs |
| **Validation & Icons** | **Zod + Lucide React** | Schema/currency validation (INR paise `amount_minor`) and accessible category icons |
| **Automated Verification** | **Vitest + Playwright** | 26 automated tests (24 unit/component tests + 2 live two-session Supabase RLS integration tests) + E2E suite |
| **IDE & Hosting** | **Google Antigravity + Vercel** | Agentic full-stack engineering and global production deployment at [`returnready.ensure.in`](https://returnready.ensure.in/) |

---

## 4. Reproducible Local Setup

Follow these steps from a fresh clone:

### Step 1 — Clone & Install Dependencies
```bash
git clone https://github.com/ensuredesign/returnready.git
cd returnready
npm install
```

### Step 2 — Configure Dedicated Supabase Project & Auth
1. Create or select a dedicated Supabase project.
2. In Supabase Dashboard → **Authentication → Providers**, enable **Anonymous Sign-Ins** (ReturnReady also includes an automatic fallback to isolated ephemeral authenticated sessions if `anonymous_users` is disabled on a self-hosted GoTrue instance with `phone_autoconfirm` enabled).

### Step 3 — Apply Versioned Database Migration
Apply [`supabase/migrations/20261023000001_returnready_schema.sql`](./supabase/migrations/20261023000001_returnready_schema.sql) via **either**:
- **Supabase Studio SQL Editor:** Open **SQL Editor → New query**, paste the contents of [`supabase/migrations/20261023000001_returnready_schema.sql`](./supabase/migrations/20261023000001_returnready_schema.sql), and click **Run**.
- **Supabase CLI:**
  ```bash
  npx supabase db push
  ```

### Step 4 — Configure Environment Variables
Copy `.env.example` to `.env` and fill in your Supabase URL and publishable/anon key (never place a `service_role` or secret key in `.env`):

```bash
cp .env.example .env
```

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-or-anon-key
```

### Step 5 — Run the App & Verification Suite
```bash
npm run dev
```
Open `http://localhost:5173` and click **Try sample household**.

To run all verification checks:
```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:integration
npm run test:e2e
```

---

## 5. Technical Documentation Index

All project and hackathon documentation is maintained in [`docs/`](./docs/):

- [**Architecture Overview (`docs/ARCHITECTURE.md`)**](./docs/ARCHITECTURE.md) — System topology, RLS policies, composite FKs, triggers, and transactional RPC specifications.
- [**Product Requirements Reference (`docs/PRD.md`)**](./docs/PRD.md) — Summary of functional requirements (`FR-01`–`FR-07`), acceptance tests (`A01`–`A20`), and visual feature guide.
- [**Full PRD & Build Prompt (`ReturnReady_PRD_and_Antigravity_Prompt.md`)**](./ReturnReady_PRD_and_Antigravity_Prompt.md) — Complete specification used to build ReturnReady.
- [**Demo Video Script & Storyboard (`docs/DEMO_SCRIPT.md`)**](./docs/DEMO_SCRIPT.md) — Scene-by-scene narration for [https://youtu.be/GEOhZsTn5ME](https://youtu.be/GEOhZsTn5ME).
- [**Devpost Submission Package (`docs/SUBMISSION_DRAFT.md`)**](./docs/SUBMISSION_DRAFT.md) — Complete project story, track details, and visual showcase.
- [**Product Feedback (`docs/PRODUCT_FEEDBACK.md`)**](./docs/PRODUCT_FEEDBACK.md) — Developer tool feedback on Google Antigravity and Supabase.
- [**Friction Log (`docs/FRICTION_LOG.md`)**](./docs/FRICTION_LOG.md) — Detailed friction log entries (`FL-01`–`FL-03`) with severity, workarounds, and suggestions.
- [**Test Results & Verification Report (`docs/TEST_RESULTS.md`)**](./docs/TEST_RESULTS.md) — Exact commands and verified pass outputs for typecheck, lint, unit, build, and live two-session RLS integration tests.

---

## 6. Author & License

- **App Developed by:** **Ritesh Kochar** for **Build, Ship, Shape: Amazon Developer Hackathon** on **Oct 23, 2026**
- **License:** [MIT License](./LICENSE)
