# Product Feedback — Google Antigravity & Supabase

Prepared during the build of **ReturnReady — Your Household Returns Assistant** on 23 October 2026.

---

## 1. Google Antigravity

### What it was used for
- Full-stack implementation of ReturnReady from the PRD specification (`ReturnReady_PRD_and_Antigravity_Prompt.md`).
- Authoring PostgreSQL schema migrations (`supabase/migrations/20261023000001_returnready_schema.sql`), RLS policies, composite foreign keys, triggers, and PL/pgSQL RPCs.
- Building the React 19 + TypeScript + Vite frontend, deterministic conversational intent router, and unit/integration/E2E test suites.
- Inspecting live self-hosted Supabase endpoints (`/auth/v1/settings`, `/rest/v1/`, `/mcp`) to diagnose configuration state.

### Onboarding & What Worked Well
- **Parallel Tool Execution:** Antigravity created configuration files, TypeScript modules, and test suites in parallel while running dependency installation and verification tasks in the background.
- **Live Endpoint Diagnostics:** When the self-hosted Supabase `/mcp` route returned `403 Forbidden`, Antigravity immediately inspected the HTTP response headers (`x-kong-request-id`) and `/auth/v1/settings` payload to pinpoint the exact Kong and GoTrue settings without guessing.
- **Verification Loop:** Running `tsc --noEmit`, `eslint`, `vitest`, and `vite build` directly inside the workspace caught missing Vite client type declarations (`src/vite-env.d.ts`) immediately and verified the fix in a single iteration.

### Problems Observed
- None in Antigravity itself. The only external blocker was that the self-hosted Supabase instance's `/mcp` route was blocked by Kong's default `request-termination` plugin (`403 Access is forbidden`), which required applying the generated SQL migration through the Supabase Studio SQL Editor rather than via MCP.

### Would We Use It Again?
- **Yes.** Antigravity's ability to combine database schema design, frontend UI construction, and automated test verification in one agentic loop significantly compressed hackathon build time.

---

## 2. Supabase (`@supabase/supabase-js`, Auth, PostgreSQL, PostgREST)

### What it was used for
- Per-session authentication, PostgreSQL persistence, Row Level Security (`RLS`), and transactional RPC execution (`rr_bootstrap_demo`, `rr_reset_demo`, `rr_set_checklist`, `rr_confirm_action`).

### What Worked Well
- PostgREST RPC exposure and embedded resource selects (`*, rr_checklist_items(*), rr_members!rr_returns_workspace_assignee_fk(id, name)`) allowed fetching a workspace's returns, checklists, and assigned member names in a single round-trip without a custom backend server.
- PostgreSQL composite foreign keys and `SECURITY INVOKER` functions worked seamlessly with RLS policies (`owner_user_id = (SELECT auth.uid())`).

### Problems Observed
- On self-hosted Supabase deployments, `/mcp` is blocked by default in `kong.yml` via the `request-termination` plugin, and `ENABLE_ANONYMOUS_USERS` defaults to `false`. Clearer self-hosted Studio warnings when copying the `/mcp` URL would save setup time.
