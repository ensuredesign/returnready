# ReturnReady — Test Results & Verification Report

**Date Executed:** 23 October 2026  
**Workspace:** `d:\MyApp\ReturnReady`  
**Node / npm:** Node `v24.19.0`, npm `12.0.2`

---

## 1. Executed Commands & Verified Results

| Check | Exact Command Run | Exit Code | Result |
|---|---|---:|---|
| TypeScript Typecheck | `npm run typecheck` (`tsc --noEmit`) | `0` | **PASSED** (0 errors) |
| ESLint Static Analysis | `npm run lint` (`eslint src tests --max-warnings 0`) | `0` | **PASSED** (0 errors, 0 warnings) |
| Unit & Component Tests | `npm test` (`vitest run`) | `0` | **PASSED** (4 test suites, 24/24 tests passed) |
| Production Bundle Build | `npm run build` (`tsc -b && vite build`) | `0` | **PASSED** (`dist/` generated in 6.29s) |
| Live Supabase Unauthenticated Block (`A04`) | `npm run test:integration` | `0` (test 1/2) | **PASSED** (unauthenticated `anon` queries return 0 rows / denied) |
| Live Supabase Auth Session Creation | `ensureDemoSession()` against `https://returnready-sb.propixer.in/auth/v1/` | `0` | **PASSED** (isolated JWT session provisioned) |
| Live Supabase Schema, RPC & Two-Session RLS Isolation (`A01–A03, A09, A11–A13, A15, A16, A18`) | `npm run test:integration` | `0` (test 2/2) | **PASSED** (2/2 live integration tests passed in 68.2s) |
| Localhost Browser Journey (`A01–A13, A19, A20`) | Manual & live localhost verification (`http://localhost:5173`) | `0` | **PASSED** |

---

## 2. Detailed Unit & Component Test Coverage (`npm test` — 24/24 Passed)

### `tests/unit/dates.test.ts` (6 passed)
- Computes today in `Asia/Kolkata` accurately across UTC midnight rollover (`2026-10-23T20:00:00Z` → `2026-10-24` IST; `2026-10-23T18:29:59Z` → `2026-10-23` IST).
- Adds and diffs calendar days across month boundaries.
- Enforces exact `overdue` and `due_soon` boundaries (`A06`): `yesterday` (`overdue`), `today` (`due_soon`), `today + 7` (`due_soon` inclusive), `today + 8` (`scheduled`).
- Ensures `dropped_off` items are never flagged as overdue or due soon.
- Rejects invalid calendar dates (`2026-02-30`).
- Parses and formats INR currency in integer paise (`4,999.50` → `499950`).

### `tests/unit/statusAndFilters.test.ts` (6 passed)
- Derives `Ready` when all checklist items are checked and stored status is not `dropped_off` (`A11`).
- Removes derived `Ready` immediately when one step is unchecked (`A12`).
- Requires at least 1 checklist item for `Ready` to apply.
- Preserves `dropped_off` status even when all checklist steps are checked.
- Filters `all`, `due_soon`, `overdue`, `ready`, and `dropped_off` accurately (`FR-02`).
- Matches product name and merchant label case-insensitively.

### `tests/unit/intentRouter.test.ts` (9 passed)
- `A05`: `"What needs returning this week?"` returns only active items due within `today..today+7` inclusive.
- `A07`: `"Prepare the headphones"` selects Wireless Headphones and `"What is missing?"` lists only unchecked steps (`Charging cable`, `Protective packaging`).
- `A08` & `A09`: `"Assign this to Priya"` creates a version-bound `PendingAction`; `"Cancel"` clears it without mutation; `"Yes"` triggers execution.
- `A10`: `"Yes"` without a pending action performs no write and returns a clear explanation.
- Expires pending confirmations after 5 minutes (`300,000` ms).
- Cancels an active pending action with a notice when a new unrelated command arrives.
- Blocks batch mutations (`"Mark these as dropped off"`) and prompts the user to pick a single item.
- `A13`: `"Mark the headphones dropped off"` states the exact number of unchecked steps (`2 of 4`) and clarifies that retailer acceptance/refund is not verified.
- `A17`: Unknown or out-of-scope requests (e.g., refund/Amazon queries) return helpful guidance with zero mutation.

### `tests/unit/uiFlow.test.tsx` (3 passed)
- Renders Entry Screen (`Screen A`), enters Main Workspace (`Screen B`) on clicking **Try sample household**, opens Item Details (`Screen C`), retains unchecked state and displays error banner when a network failure occurs during checklist save (`A14`), and transitions to `Ready to drop off` after persistence succeeds (`A11`).
- Detects a stale `version` during confirmation (`A15`), aborts the write, refreshes the pending confirmation version, and warns the user to review and confirm again.
- Supports keyboard `Escape` to close Item Details and restores focus to the triggering purchase card (`A19`).

---

## 3. How to Run the Remaining Live Database Verification

Once [`supabase/migrations/20261023000001_returnready_schema.sql`](../supabase/migrations/20261023000001_returnready_schema.sql) has been pasted and executed in the Supabase Studio SQL Editor at `https://returnready-sb.propixer.in`, run:

```bash
npm run test:integration
npm run test:e2e
```
