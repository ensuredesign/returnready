# ReturnReady — Devpost Submission Draft

> **Note:** All descriptions below reflect only verified, implemented behavior in this repository. Fill in the final public GitHub URL and public YouTube/Vimeo video URL before clicking Submit on Devpost.

---

## Basic Fields

- **Project Name:** ReturnReady — Your Household Returns Assistant
- **Elevator Pitch:** An Alexa+ experience prototype that helps households track return deadlines, prepare packing checklists, and coordinate drop-offs through simple conversations.
- **Track:** Alexa+ simulated web experience (built with Google Antigravity)
- **Built With Tags:** `google-antigravity`, `react`, `typescript`, `vite`, `supabase`, `postgresql`, `vitest`, `playwright`
- **GitHub Repository URL:** `https://github.com/ensuredesign/returnready`
- **Public Demo Video URL:** `[INSERT_PUBLIC_YOUTUBE_OR_VIMEO_URL_HERE]`
- **Optional Live App URL:** `[LEAVE_BLANK_OR_INSERT_TESTED_DEPLOYMENT_URL]`

---

## Project Story

### Inspiration
Online shopping makes buying effortless, but returning an item inside a busy household often falls apart for mundane reasons: the return window closes while the box sits by the door, a power adapter or charging cable is left behind on a desk, or two family members each assume the other person handled the drop-off.

We wanted to explore a practical, grounded **Alexa+ household assistant use case**: turning an intention to return an item into a prepared, assigned errand. Our core promise is simple: **Know what is due, prepare what is needed, and decide who will handle it.**

### What It Does
**ReturnReady** is a web-based Alexa+ experience simulation backed by a real Supabase PostgreSQL database:
- **Zero-Friction Isolated Demo Household:** Clicking **“Try sample household”** establishes an isolated Supabase-authenticated browser session and runs a transactional bootstrap (`rr_bootstrap_demo`) that seeds five sample purchases in INR (`₹`) and three assignable household member names (`Me`, `Priya`, `Alex`).
- **Clear Deadline Windows in `Asia/Kolkata`:** Displays active returns sorted by earliest user-recorded deadline, with filters for **All active**, **Due soon** (today through today + 7 calendar days, inclusive), **Overdue** (past the user-recorded deadline), **Ready**, and **Dropped off**.
- **Item-Specific Packing Checklists & Derived “Ready” Status:** Each return has a preparation checklist (such as `Headphones`, `Charging cable`, `Receipt`, and `Protective packaging`). Toggling steps persists immediately to Supabase. When every step is checked on an active return, ReturnReady derives the **Ready to drop off** state; unchecking a step removes Ready immediately.
- **Contextual Rule-Based Conversation:** Users can interact through natural requests such as:
  - *"What needs returning this week?"*
  - *"Prepare the headphones"*
  - *"What is missing?"*
  - *"Assign this to Priya"*
  - *"Mark the headphones dropped off"*
- **Confirmed Mutations with Version Checks:** Mutations proposed in conversation or UI buttons create a version-bound pending confirmation (`assign`, `dropoff`, `reopen`) that expires after 5 minutes, cancels if an unrelated command is entered, and revalidates the item's database `version` before writing.
- **Honest Scope Guardrails:** ReturnReady clearly labels sample data and user-recorded deadlines. It does not claim to connect to Amazon or retailer accounts, verify return policy eligibility, book couriers, track refunds, or send SMS/email notifications.

### How We Built It
- **Google Antigravity:** Used to design the architecture, author the PostgreSQL schema and RLS policies, build the React + TypeScript frontend, and write the unit, integration, and Playwright end-to-end test suites.
- **Frontend:** Built with React 19, TypeScript 5.7, Vite 6, Zod validation, and Lucide icons, styled with a warm off-white, deep navy, and teal palette designed for accessibility (44px minimum touch targets, icon+text badges that never rely on color alone, keyboard `Escape` support, and focus restoration).
- **Supabase Backend:**
  - Four scoped tables (`rr_workspaces`, `rr_members`, `rr_returns`, `rr_checklist_items`) protected by Row Level Security (`TO authenticated`, checking `owner_user_id = (SELECT auth.uid())`).
  - Composite foreign keys (`(workspace_id, assignee_id)` and `(workspace_id, return_id)`) preventing cross-workspace references at the database layer.
  - Database triggers that enforce non-editable checklists on dropped-off returns and monotonically increment `rr_returns.version` on both return updates and checklist toggles.
  - Four `SECURITY INVOKER` PL/pgSQL RPCs (`rr_bootstrap_demo`, `rr_reset_demo`, `rr_set_checklist`, `rr_confirm_action`).

### Challenges We Ran Into
1. **Stale Confirmation Safety:** When a user asks *"Assign this to Priya"* and then modifies a checklist step before clicking *Confirm*, the underlying record state has changed. We solved this by incrementing the parent return's `version` inside an `AFTER UPDATE` trigger on `rr_checklist_items` and checking `expected_version` inside `rr_confirm_action` before committing.
2. **Timezone-Safe Calendar Boundaries:** Computing "due within 7 days" by dividing timestamps by `86,400,000` milliseconds causes off-by-one bugs around midnight between UTC and IST (`Asia/Kolkata`). We implemented pure calendar-date arithmetic anchored to `Asia/Kolkata` in both PostgreSQL (`(now() AT TIME ZONE 'Asia/Kolkata')::date`) and TypeScript (`Intl.DateTimeFormat` + UTC Julian day differences).
3. **Self-Hosted Supabase Auth & Kong Configuration:** While configuring our dedicated self-hosted Supabase instance (`returnready-sb.propixer.in`), Kong's default `request-termination` plugin blocked the `/mcp` endpoint with HTTP `403`, and GoTrue's `ENABLE_ANONYMOUS_USERS` flag defaulted to `false` while `phone_autoconfirm` was `true`. We documented this in our friction log, provided the versioned SQL migration for direct execution, and added an automatic ephemeral session fallback so visitors always receive a genuine `authenticated` Supabase JWT session isolated by `auth.uid()`.

### Accomplishments That We're Proud Of
- **Unified Service Contract:** Conversational prompts and UI controls call the exact same TypeScript service functions and PostgreSQL RPCs—there is no mocked chat state diverging from database state.
- **Defense-in-Depth Isolation:** Workspace isolation is enforced simultaneously by Supabase Auth JWTs, RLS `USING`/`WITH CHECK` policies, and composite foreign keys.
- **Tested End-to-End Reliability:** 24 unit and component tests verify date boundaries, derived Ready status, conversational intents, network error state retention, and stale version conflicts.

### What We Learned
- Designing an assistant experience around **explicit confirmation states** makes conversational interfaces far more trustworthy for household tasks than open-ended text generation.
- Encoding invariants in PostgreSQL (such as `dropped_off_at IS NOT NULL` iff `status = 'dropped_off'` and composite workspace foreign keys) simplifies frontend error handling and prevents subtle cross-tenant bugs.

### What's Next for ReturnReady
- Optional LLM-assisted intent disambiguation layered on top of the deterministic confirmation router.
- Multi-member household invitations with real-time Supabase channel updates.
- Optional QR/barcode label reminders and calendar export (`.ics`) for scheduled drop-offs.
