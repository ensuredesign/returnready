# ReturnReady — PRD and Antigravity Build Prompt

Version: 1.0 | Prepared: 23 October 2026 | Status: implementation specification, not a claim of completed work

**Project:** ReturnReady — Your Household Returns Assistant  
**Target:** Amazon Developer Hackathon, Alexa+ simulated-experience track  
**Stack:** Google Antigravity, React, TypeScript, Vite, Supabase  
**Delivery:** Working source repository, reproducible setup, demo video, and truthful submission materials

## 1. Start here

1. Create a new, empty ReturnReady folder in Antigravity. Keep it separate from existing jewelry or client projects.
2. Place this file in the folder as `ReturnReady_PRD_and_Antigravity_Prompt.md`.
3. Paste the complete prompt from section 20 into Antigravity Agent mode.
4. If a Supabase MCP connection is available, identify the exact new/dedicated ReturnReady project before applying migrations. Do not reuse another application's database by assumption.
5. Provide the Supabase project URL and publishable key through the local environment file. Never paste privileged keys into the source or submission.
6. Build and test before writing the final Project Story. Save the Devpost application as a draft meanwhile.

### Submission timing and track basis

The published deadline is **23 October 2026 at noon PDT**, equivalent to **24 October 2026 at 12:30 a.m. IST**. Aim to finish submission by 11:30 p.m. IST on 23 October. Recheck the event page before submitting.

The rules permit an Alexa+ simulation built with an AI/agentic tool, without a specific framework, SDK, or MCP interface. Its source must be included and the video must show the simulation. Third-party integrations are allowed under their terms. Supabase and Antigravity are therefore appropriate for this route; this is an interpretation of the general rules, not a Supabase-specific endorsement. AWS Builder is a separate optional mini-challenge with additional requirements. Do not select it without qualifying AWS usage. Do not call this a live Alexa integration.

Sources checked in this conversation:
- Rules: https://amazonappdev2026.devpost.com/rules
- FAQs: https://amazonappdev2026.devpost.com/details/faqs
- Organizer simulation clarification: https://amazonappdev2026.devpost.com/forum_topics/45058-clarification-on-simulated-alexa-web-experience-requirements

## 2. Product goal and problem

ReturnReady helps a household turn an intention to return a purchase into a prepared, assigned task. A return can fail because the deadline is forgotten, accessories are missing, or responsibility is unclear.

Core promise: **Know what is due, prepare what is needed, and decide who will handle it.**

The prototype demonstrates a plausible Alexa+ use case: a conversational request retrieves relevant household state and leads to a confirmed action. It is not a generic open-ended chatbot or an automated retailer return portal.

### Primary user

A busy shopper managing several purchases and coordinating errands with family members. The first version has one authenticated workspace owner. Household members are names within that workspace, not separate logged-in collaborators. Do not claim multi-user collaboration or notifications.

### Success criteria

- A new judge can enter the demo and see five sample purchases in under 30 seconds after the app loads.
- The full “what is due → select item → checklist → assign owner → confirm → refresh” flow works.
- Writes persist in Supabase and survive a page refresh in the same authenticated browser session.
- Two independent sessions cannot read or change one another's records.
- An unknown request produces help, not an invented action or false success message.
- A clear demonstration fits within 2 minutes 30 seconds.

## 3. Scope and priorities

| Priority | Requirement | Release decision |
|---|---|---|
| P0 | Isolated demo access through Supabase Auth | Required |
| P0 | Five seeded sample purchases, visible demo-data notice | Required |
| P0 | Purchase list, details, explicit deadlines, filters | Required |
| P0 | Item-specific preparation checklists | Required |
| P0 | Conversation with supported intents and contextual follow-ups | Required |
| P0 | Confirmed assignment and drop-off status changes | Required |
| P0 | Supabase persistence, RLS, useful error states | Required |
| P0 | README, migrations, tests, license, demo script | Required |
| P1 | Add/edit purchase and member names | Build after core flow |
| P1 | Responsive mobile layout and keyboard polish | Build after core flow |
| P2 | Optional browser text-to-speech | Only after P0 passes |
| Later | LLM interpretation, receipts, shared accounts, reminders | Excluded today |

Explicitly out of scope: retailer account access; Amazon order imports; refunds; payments; policy eligibility checks; courier bookings; return-label generation; receipt upload/OCR; email/SMS; subscriptions; real Alexa device integration; MCP server development; production-scale household sharing; live AI runtime dependency.

No fake integration buttons, invented API responses, or placeholder links. Hide unavailable features or mark them as roadmap text outside the working flow.

## 4. Experience and visual direction

### Screen A — Entry

- ReturnReady wordmark with a simple original parcel/check icon.
- Heading: “Get your returns ready.”
- Subtext: “Track deadlines, prepare items, and coordinate your next drop-off.”
- Primary button: “Try sample household”.
- Small notice: “Alexa+ experience simulation · Sample data · No retailer connection”.
- Button starts or resumes an anonymous Supabase-authenticated session and bootstraps its data.
- Reuse an existing session; do not create a new user on every render or refresh.

### Screen B — Main workspace

Desktop: header, summary row, purchase list on the left, conversation panel on the right. Item details open in a side panel or modal. Mobile: stacked panels with accessible navigation between Returns and Assistant.

Header contains sample-data label, connection/save state, and reset-demo control. Summary cards: active returns, due within seven days, ready to drop off. Do not imply money has been saved or refunded.

Purchase card: generic product illustration/icon, name, merchant label, purchase value in INR, recorded deadline, urgency text, owner, and status. Avoid retailer logos and borrowed product photos.

Visual palette: warm off-white background, deep navy text, teal primary actions, amber deadlines, red overdue indicators. Use restrained shadows, 12–16px corner radii, consistent spacing, readable type, and 44px minimum touch targets. Status cannot rely on color alone. Respect reduced-motion settings; no animation should delay interaction.

### Screen C — Item details

- Name, merchant, amount, purchase date, recorded deadline and deadline note.
- “User-entered deadline; retailer eligibility has not been verified.”
- Checklist with independent toggles and a completion counter.
- Assigned household member or Unassigned.
- Explicit “Mark dropped off” action with confirmation.
- “Dropped off” means user-recorded handover, not refund received or retailer acceptance.
- Close restores focus to the triggering control; dialogs support keyboard escape.

## 5. Functional behavior

### FR-01: Demo initialization

Create a session-specific workspace in a single transactional bootstrap operation. Seed only when that user has no workspace. Reloads and double clicks must not duplicate rows. Show loading while initialization runs. On failure, show a retry action and actionable configuration guidance; never silently switch to local storage and claim Supabase is working.

### FR-02: Purchase list and filtering

Default list shows active items sorted by earliest recorded deadline, then name. Filters: All, Due soon, Ready, Dropped off. Search matches product names and merchant labels case-insensitively.

“Due soon” = deadline from today through today + 7 calendar days, inclusive. “Overdue” = deadline before today and not dropped off. Handle overdue separately so the user can see it, without asserting that return eligibility has ended.

### FR-03: Checklist

Each item has a preparation checklist appropriate to the sample product. These are suggested preparation steps, not retailer requirements. Save toggles to Supabase, disable duplicate submissions during a write, and retain/restore the prior state if the write fails. Display a success state only after persistence succeeds.

### FR-04: Status

Use stored statuses `planning`, `preparing`, `dropped_off`. Derive the visible “Ready” state when all checklist items are checked and the stored status is not `dropped_off`. A checklist must contain at least one item for Ready to apply. The bootstrap starts items in `planning`; the first completed check can move them to `preparing`.

Unchecking a step removes the derived Ready state. Once dropped off, checklist editing is disabled until the user explicitly reopens the item with confirmation. Reopening sets `preparing` and clears `dropped_off_at`; Ready may reappear if all steps remain checked.

Allow a user-recorded drop-off with incomplete preparation only through a confirmation that clearly states how many checks are incomplete. Never falsely say every step was completed.

### FR-05: Assignment

Assign a member by ID from the same workspace. Show “Assign Headphones to Priya?” with Confirm and Cancel. Only Confirm writes. Do not send messages or suggest the person received a notification. On success say “Assigned to Priya in ReturnReady.”

### FR-06: Optional purchase editing

P1 form: product name (1–100 chars), merchant (1–100 chars), purchase date, recorded return deadline, amount (nonnegative, two decimal places), and optional deadline note (max 500 chars). Currency is INR throughout this MVP. Store amount as integer paise, not floating-point currency. Validate deadline is on/after purchase date. Past deadlines are allowed with an explicit overdue display.

Create a suggested default checklist for a new item. Editing dates does not modify retailer eligibility. Confirmation is needed before discarding unsaved changes.

### FR-07: Reset sample data

Reset requires explicit confirmation. It resets only the authenticated user's demo workspace and conversation context; other users are unaffected. It re-seeds relative to the user's current workspace date. No global truncate/delete operations.

## 6. Conversational contract

Implement a small deterministic intent router first. No model API is required. Be explicit in README: “Rule-based conversational simulation built using AI-assisted development; no live Alexa backend or LLM runtime.”

Messages display in a normal chat interface with suggested prompts and structured action cards. Maintain selected item, pending action, and current filter in React state. Chat transcript persistence is optional and excluded from P0. Reload clears pending confirmations so a stale “yes” cannot mutate data.

| Example request | Intent | Behavior |
|---|---|---|
| What needs returning this week? | list_due | Query deadline window; display records and counts |
| Show overdue items | list_overdue | Show overdue records; no policy judgment |
| Show all returns | list_all | Show active list |
| Prepare the headphones | select_item | Select item and show its checklist |
| What is missing? | missing_checks | Use selected item; list unchecked steps |
| Assign this to Priya | propose_assignment | Resolve selected item/member; request confirmation |
| Yes / Confirm | confirm_pending | Execute only a valid pending action |
| No / Cancel | cancel_pending | Clear pending action with no write |
| Mark these as dropped off | ambiguous_mutation | Ask which single item; do not batch mutate |
| Mark the headphones dropped off | propose_dropoff | Show confirmation with actual checklist state |
| Help | help | Show supported requests |

Normalize casing, punctuation, and common synonyms. Match product aliases (headphones/headset; shoes/trainers). If multiple records match, offer choices. If no item is selected for “this”, ask the user to select one. If two people match a name, offer choices. Buttons and text intents call the same application service functions.

Pending action shape:

```ts
type PendingAction =
  | { kind: 'assign'; itemId: string; memberId: string; expectedVersion: number }
  | { kind: 'dropoff'; itemId: string; expectedVersion: number }
  | { kind: 'reopen'; itemId: string; expectedVersion: number };
```

New unrelated commands cancel pending actions with a brief notice. Confirmations expire after five minutes. Before execution, re-read the target and validate ownership, current version and valid state. Changed versions trigger a fresh confirmation. Unknown text must answer with supported options. Never fabricate purchase details, dates, refunds, bookings, notifications, or successful saves.

## 7. Architecture

```text
React UI → intent router / application services → Supabase JS client
                                                ↓
                                       Auth + PostgreSQL + RLS
```

Suggested dependencies: React, TypeScript, Vite, `@supabase/supabase-js`, Zod, Lucide React, Vitest, Testing Library, Playwright. Keep dependencies minimal and pin tested versions in a committed lockfile. Antigravity must check current official docs for APIs it uses.

Use plain CSS or Tailwind based on fastest reliable setup. Do not spend time installing a large UI stack. Use Vite dev server locally and a static build for optional Vercel deployment. Do not implement a custom HTTP backend merely to proxy ordinary Supabase operations.

Application layer:

```ts
bootstrapDemo(): Promise<Workspace>
listReturns(filter: ReturnFilter): Promise<ReturnItem[]>
getReturn(itemId: string): Promise<ReturnDetail>
setChecklistItem(checkId: string, checked: boolean): Promise<ReturnDetail>
assignReturn(itemId: string, memberId: string, version: number): Promise<ReturnDetail>
markDroppedOff(itemId: string, version: number): Promise<ReturnDetail>
reopenReturn(itemId: string, version: number): Promise<ReturnDetail>
resetOwnDemo(): Promise<Workspace>
```

Errors return typed categories (unauthenticated, validation, conflict, network, forbidden) and user-facing explanations. Never log access tokens or complete session objects. Do not allow arbitrary SQL generated from chat.

## 8. Supabase data model

Use a dedicated project if available. Keep SQL migrations in the repository. Table names below are scoped to this application to avoid collisions.

| Table | Fields and constraints |
|---|---|
| `rr_workspaces` | `id uuid PK`, `owner_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE`, `name text`, `timezone text DEFAULT 'Asia/Kolkata'`, `seed_version int DEFAULT 1`, `created_at timestamptz` |
| `rr_members` | `id uuid PK`, `workspace_id uuid FK CASCADE`, `name text NOT NULL`, `created_at timestamptz`, unique `(workspace_id, name)`, unique `(workspace_id, id)` |
| `rr_returns` | `id uuid PK`, `workspace_id uuid FK CASCADE`, `name text`, `merchant text`, `amount_minor bigint CHECK >= 0`, `currency text CHECK = 'INR'`, `purchase_date date`, `return_deadline date CHECK >= purchase_date`, `deadline_note text`, `status text CHECK IN ('planning','preparing','dropped_off')`, `assignee_id uuid nullable`, `is_sample boolean DEFAULT true`, `version int DEFAULT 1`, `dropped_off_at timestamptz nullable`, `created_at/updated_at timestamptz`, unique `(workspace_id,id)` |
| `rr_checklist_items` | `id uuid PK`, `workspace_id uuid NOT NULL`, `return_id uuid NOT NULL`, `label text NOT NULL`, `checked boolean DEFAULT false`, `sort_order int`, `updated_at timestamptz` |

Enforce composite FK `(workspace_id, assignee_id)` to `rr_members(workspace_id,id)` so another workspace's member cannot be assigned. Enforce composite FK `(workspace_id, return_id)` to `rr_returns(workspace_id,id)` with cascade delete. For this MVP, block deleting a referenced member rather than introducing complicated null-on-delete behavior.

Add indexes on child `workspace_id`, returns `(workspace_id, return_deadline)`, checklist `(return_id, sort_order)`. Timestamps default to `now()`. Update triggers maintain `updated_at` and monotonically increment return `version`. Checklist changes must also increment their parent return version so confirmations detect stale preparation state.

Status consistency: `dropped_off_at IS NOT NULL` iff status is `dropped_off`. Enforce this with a constraint and write status/timestamp together. Limit text lengths at DB and form level. Do not store secrets, real receipts, addresses, or financial account details in sample data.

## 9. Auth, isolation and database operations

### Recommended demo auth

Enable Supabase Anonymous Sign-Ins on the dedicated project. On “Try sample household”, get the current session; if absent, call `signInAnonymously()`. Each browser session gets a distinct auth user and isolated workspace. Explain that anonymous data is not recoverable after sign-out, clearing browser data, or switching devices. Do not imply permanent accounts or cross-device access.

Supabase anonymous sign-ins use the `authenticated` database role, not unauthenticated public access. A publishable key alone is not user authentication. See official docs below. For a public demo, follow Supabase's current CAPTCHA/rate-limit guidance. Do not repeatedly create users during render. If anonymous sign-in cannot be configured promptly, report the blocker and use an explicitly provisioned test account for development; never replace RLS with open public writes.

### RLS policy specification

- Enable RLS on every `rr_*` table exposed through the Data API.
- Restrict policies to `authenticated`; unauthenticated users have no record access.
- Workspace SELECT/UPDATE/DELETE require `owner_user_id = (select auth.uid())`.
- Workspace INSERT and UPDATE WITH CHECK require that same equality.
- Child SELECT/DELETE require an existing matching workspace owned by `auth.uid()`.
- Child INSERT/UPDATE WITH CHECK require that same owned workspace.
- An UPDATE must have both USING (old row access) and WITH CHECK (new row access).
- Do not permit ownership transfer, changing a child's workspace ID to an unowned workspace, or globally readable sample rows.
- Use only the grants required by the app. Test both privileges and RLS; enabling RLS alone is not the whole setup.

### SQL RPCs

Implement transactional RPCs where multiple writes must succeed together:

1. `rr_bootstrap_demo()` — derive owner from `auth.uid()`, create workspace if missing, seed members/returns/checklists atomically, return workspace ID. Unique owner plus transaction/advisory locking handles concurrent clicks. No caller-provided owner ID.
2. `rr_reset_demo()` — lock and reset only the caller's workspace, then reseed. No arbitrary workspace argument.
3. `rr_set_checklist(check_id, checked)` — validate owner and non-dropped-off state, update step and parent status/version atomically.
4. `rr_confirm_action(item_id, action, member_id, expected_version)` — validate caller access, version and action allowlist; atomically assign, drop off or reopen; return updated record. Repeated stale calls fail with conflict.

Prefer SECURITY INVOKER with ordinary RLS. If any SECURITY DEFINER function is unavoidable, use explicit ownership validation, a fixed safe search_path, schema-qualified references, narrowly granted EXECUTE, and explain why it is necessary. Revoke default public execution for app RPCs and grant only to authenticated. Never expose a service-role key to the browser. P0 needs no service-role key in frontend or Vercel.

Official references:
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/auth/auth-anonymous

## 10. Dates, fixtures and demo reliability

Store deadlines as PostgreSQL DATE. Store event timestamps as TIMESTAMPTZ. Determine “today” using workspace timezone, not UTC midnight or the developer machine's locale. For this MVP timezone is fixed to Asia/Kolkata. Compare calendar dates; do not divide milliseconds by 24 hours to infer calendar boundaries. Test date rollover.

Seed relative to today once at bootstrap. Persist those actual dates; do not move deadlines on each page refresh. Reset explicitly reanchors the sample dates.

| Product | Merchant (fictional) | Amount INR | Deadline | Preparation steps |
|---|---|---:|---|---|
| Wireless Headphones | Demo Electronics | 4,999 | Today + 1 | Headphones, charging cable, receipt, protective packaging |
| Running Shoes | Demo Sports | 2,799 | Today + 3 | Both shoes, original box, receipt |
| Desk Lamp | Demo Home | 1,499 | Today + 7 | Lamp, power adapter, receipt, protective packaging |
| Travel Backpack | Demo Outdoors | 1,999 | Today - 1 | Empty all pockets, receipt, packaging |
| Coffee Grinder | Demo Kitchen | 3,499 | Today + 12 | Grinder, accessories, receipt, protective packaging |

Set purchase dates to today - 10 days. Members: Me, Priya, Alex. All descriptions, merchants and names are fictional sample data. Seed some checklist steps complete but leave headphones incomplete for the demo. One item may be fully prepared to demonstrate Ready. Do not claim checklist contents match a real merchant policy.

## 11. Environment and setup contract

Commit `.env.example` with empty placeholders:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

These are browser-facing connection settings; authorization is enforced by Auth and RLS. Use a publishable key, or a documented legacy anon-key equivalent if that is the actual project configuration. Never place a service-role/secret key in any `VITE_*` variable. Ignore `.env`, `.env.local`, and other secret-bearing files in Git.

Startup validates config and shows a useful setup screen if missing. It must not fail with a blank screen. A disconnected Supabase instance displays an error rather than fictitious saved state.

README setup order: install dependencies → create/select dedicated Supabase project → enable anonymous sign-ins → apply versioned migration(s) → configure local env → run app → click sample household → run checks. Record exact commands that actually work with the final repository. Include both SQL Editor migration instructions and CLI instructions if tested.

Expected scripts: `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:e2e`. Do not claim a command passed unless it was run.

## 12. Suggested repository structure

```text
returnready/
  README.md
  LICENSE
  package.json
  package-lock.json
  .env.example
  .gitignore
  index.html
  src/
    App.tsx
    components/
    features/returns/
    features/assistant/
    lib/supabase.ts
    lib/dates.ts
    services/returns.ts
    types/
    styles/
  supabase/migrations/
  tests/unit/
  tests/e2e/
  docs/
    PRD.md
    ARCHITECTURE.md
    DEMO_SCRIPT.md
    SUBMISSION_DRAFT.md
    PRODUCT_FEEDBACK.md
    FRICTION_LOG.md
    TEST_RESULTS.md
```

The structure is guidance, not an excuse to overengineer. Create a dedicated repository and include original source, required assets, runnable setup instructions and an MIT license if using a public repo. Confirm the copyright owner name rather than inventing a legal identity. Do not add fake deployment URLs or demo links. Check for secrets before publishing.

## 13. Acceptance tests

| ID | Scenario | Expected result |
|---|---|---|
| A01 | New session enters demo | One workspace, 3 members, 5 returns, appropriate checklists |
| A02 | Refresh / double-click entry | Same workspace; no duplicated seed rows |
| A03 | Session A requests B's IDs directly | Read/write denied or no rows returned |
| A04 | No auth session queries data | No data access |
| A05 | “What is due this week?” | Only active deadlines today..today+7, inclusive |
| A06 | Deadline yesterday/today/today+7/today+8 | Correct overdue and due-soon boundaries |
| A07 | Select headphones then “What is missing?” | Exactly unchecked headphones steps |
| A08 | Assign Priya then Cancel | No database update |
| A09 | Assign Priya then Confirm then refresh | Owner persisted; same item visible |
| A10 | “Yes” without pending action | No write; explanation shown |
| A11 | Check final preparation step | Ready appears and persists |
| A12 | Uncheck one step | Ready disappears |
| A13 | Confirm drop-off | Recorded dropped-off state, no refund claim |
| A14 | Network error during save | No false success; old state preserved; retry available |
| A15 | Stale version on confirm / repeat confirm | Conflict or no second write |
| A16 | Cross-workspace assignee ID | Rejected by DB constraints/access checks |
| A17 | Unknown text / ambiguous product | Helpful clarification, no mutation |
| A18 | Reset A's demo | Only A's sample data resets |
| A19 | Mobile and keyboard | Usable layout, visible focus, accessible dialog |
| A20 | Fresh clone setup | README steps reproduce the working application |

Unit-test the date window, intent parsing, pending action handling, and derived Ready status. Integration-test ownership with two actual test users/sessions. End-to-end test the primary journey using a dedicated test workspace. Do not run destructive tests against another application's database. If connected integration tests cannot run, record them as unverified, not passed.

## 14. Build sequence and time budget

This is a planning estimate, not a completion guarantee. Cut optional work before cutting isolation, persistence, testing or submission time.

| Phase | Budget | Exit condition |
|---|---:|---|
| Foundation | 20 min | App runs; env checks; Supabase session established |
| Database | 35 min | Migrations, RLS, bootstrap, isolated sample data work |
| Core UI | 45 min | Dashboard, item details, checklist and status persist |
| Conversation | 40 min | List/select/confirm flows work through shared services |
| Verification | 30 min | Core tests, failure states, session isolation checked |
| Submission package | 30 min | README/license/docs and video script ready |
| Recording and submission | 40 min | Video uploaded, URLs checked, form finalized |

If time is short: omit P1 editing and P2 voice, keep a simple polished dashboard, and prioritize the exact two-minute demonstration. Do not add an LLM API just for a technology tag. If Supabase setup blocks progress, continue UI work against an explicitly labelled test adapter while fixing setup, but do not present that as a connected Supabase implementation.

## 15. Demo video storyboard (about 2:15)

- 0:00–0:15: Explain the problem: returns require preparation and responsibility, not just a deadline reminder. Show ReturnReady and the simulation/sample-data notice.
- 0:15–0:35: Ask “What needs returning this week?” Show real seeded records and dates.
- 0:35–0:55: “Prepare the headphones.” Show the selected item and missing preparation steps.
- 0:55–1:20: Complete checklist steps. Show Ready update.
- 1:20–1:40: “Assign this to Priya.” Demonstrate confirmation and the updated owner. State that assignment is stored, no message is sent.
- 1:40–1:55: Refresh. Show checklist and assignment persisted.
- 1:55–2:15: Briefly show the repo/setup and explain: built in Antigravity, real Supabase persistence, rule-based Alexa+ simulation; no live retailer or Alexa connection.

Record the working app, not slide mockups. Use your own narration and screen capture. Keep under three minutes and upload publicly to YouTube or Vimeo. Use only media you have rights to use. Do not show credentials, dashboard secrets, or unrelated personal data. Do not film a feature that fails in the delivered code.

## 16. Submission package

Generate these from verified implementation facts:

- Project name: ReturnReady — Your Household Returns Assistant
- Pitch: “An Alexa+ experience prototype that helps households track return deadlines, prepare packing checklists, and coordinate drop-offs through simple conversations.”
- Track: Alexa+ simulated experience.
- Built-with tags: only tools/libraries actually used.
- GitHub URL: actual accessible repo with license/setup/source.
- Demo URL: actual public video, less than three minutes.
- Optional live URL: only if deployed and tested.
- Project story: inspiration, working features, actual implementation, real challenges, verified accomplishments, actual learnings, roadmap.
- Tool feedback: what each used tool did, onboarding, what worked, problems observed, and whether you would use it again.

Create `PRODUCT_FEEDBACK.md` and `FRICTION_LOG.md` as work proceeds. Each friction entry records task, steps, expected result, actual result, severity, workaround, suggested improvement and evidence. Never invent tool problems for judging credit. If none were observed, say so. Avoid claiming AWS, MCP, live Alexa, shared household accounts, or production readiness.

## 17. Risks and explicit mitigations

| Risk | Response |
|---|---|
| App becomes a generic checklist | Demonstrate contextual conversation that changes saved state |
| Late database setup | Start Supabase configuration first; inspect errors rather than hide them |
| Judge cannot enter | No email onboarding for sample demo; document anonymous auth setup |
| Anonymous session lost | Explain browser-session limitation; provide reset and reproducible seeding |
| Return policy misunderstanding | Use recorded deadlines and suggested checklists; no eligibility guarantee |
| Sample data shared across visitors | Separate workspace per authenticated user with RLS |
| Accidental client database changes | Dedicated project, exact ID verification, scoped migrations only |
| Stale confirmation changes wrong record | Bind item/member IDs and version; expire and revalidate |
| Video differs from code | Record only after testing the final version |

## 18. Definition of done

- [ ] App runs from a fresh clone with documented setup.
- [ ] Real Supabase session, seed, read and write operations verified.
- [ ] RLS and cross-workspace constraints tested with two sessions.
- [ ] Core conversational journey works and survives refresh.
- [ ] Save failures, unknown requests and stale confirmations handled.
- [ ] Responsive desktop/mobile layout and basic keyboard access verified.
- [ ] No privileged secrets or fabricated integrations in source or documentation.
- [ ] Test results report exact commands and any unverified areas.
- [ ] Repo includes source, migrations, environment template, lockfile, README and license.
- [ ] Demo video recorded and uploaded; link opens publicly.
- [ ] Submission story describes actual completed work.
- [ ] Devpost final Submit action completed and confirmation checked by the participant.

## 19. Working notes for Antigravity

The user has chosen Antigravity and Supabase. Do not switch to another hosted builder or AWS stack. Supabase/GitHub MCP may be available; discover their actual capabilities instead of assuming access. Preserve unrelated resources. Ask only for indispensable missing identifiers, credentials through secure configuration, or account decisions; continue independent local implementation while blocked.

The PRD intentionally avoids full multi-tenant SaaS roles, email invitations, payments and jewelry features. Those belong to other projects. The dataset is small; straightforward SQL and component state are sufficient.

## 20. Copy-ready Antigravity master prompt

Copy everything inside this block into Antigravity after adding this Markdown file to the project folder.

```text
Act as a senior full-stack engineer and product designer. Build ReturnReady — Your Household Returns Assistant, following the attached ReturnReady_PRD_and_Antigravity_Prompt.md as the source of truth.

This is an urgent hackathon implementation, not a planning exercise. Deliver a working, tested application and the repository/demo documentation. Work through implementation until the P0 flow is complete. Do not stop after a plan or scaffold. Do not fabricate completed work, test results, integration claims, or links.

CONTEXT
- Track: Alexa+ simulated web experience for Amazon Developer Hackathon.
- Build with React + TypeScript + Vite and a real Supabase backend.
- Development tool: Antigravity. Use connected Supabase/GitHub MCP only when available and within the dedicated project/repository.
- No AWS-only requirement for this simulation route. No live Alexa connection, MCP server, retailer APIs, or LLM runtime is required.
- Deadline is 23 October 2026 noon PDT / 24 October 2026 00:30 IST. Reserve time for the user to record/upload the demo and submit.

FIRST ACTIONS
1. Inspect the current folder and any project instructions. Preserve existing work. If this is an unrelated project, use a new ReturnReady folder.
2. Read the entire PRD. Write a short implementation checklist and immediately start.
3. Check available Supabase/GitHub connections. Before any remote database mutation, verify the exact dedicated ReturnReady project. Never choose a client or jewelry database by assumption. If no target is established, ask for its project reference while continuing local code and migrations.
4. Use current official documentation for dependency/API details; pin versions and commit a lockfile. Do not spend time researching optional libraries.

BUILD THE P0 APP
- “Try sample household” starts/resumes Supabase anonymous auth and a session-isolated workspace.
- Implement the PRD schema, transactional bootstrap/reset/action functions, RLS, FK constraints and ownership checks using versioned migrations.
- Seed five fictional purchases and three assignable member names. Members are labels in the owner's workspace, not separate authenticated collaborators.
- Create a polished warm-white/navy/teal dashboard with deadline cards, filters, item details, editable checklists, assignment confirmation and drop-off status.
- Implement deterministic conversational intents, contextual item selection, clarification for ambiguity, and confirmed writes through the same services as UI buttons.
- Persist data to Supabase. Show successful writes only after persistence. Never silently pretend a local adapter is the connected backend.
- Use date-only deadlines in Asia/Kolkata and test the exact inclusive due-soon window.
- Bind pending actions to item/member IDs and expected version, expire them, cancel on unrelated commands and revalidate before writing.
- Display “Alexa+ experience simulation” and “Sample data” clearly. No retailer-policy verification, notifications, courier bookings, refunds or Amazon account access.

SCOPE AND QUALITY
- Prioritize P0 before P1/P2. No payments, email, OCR, file uploads, shared account invitations, AI model API or voice dependency.
- Use original icons/graphics and generic merchants; no borrowed retailer logos.
- Handle missing config, loading, errors, empty results and keyboard interaction.
- Keep project credentials in local environment configuration. Only the Supabase URL and publishable key may be browser-facing; never expose service-role/secret keys. Enable and test RLS.
- Anonymous sign-ins must be enabled and follow current Supabase abuse-protection guidance for public deployment. Reuse the current session.
- Do not deploy migrations or reset data against unrelated resources. Reset only the current user's demo workspace.

VERIFY
- Run build, typecheck and relevant tests; fix failures.
- Test session A cannot read/update session B data; unauthenticated access is blocked; cross-workspace assignees are rejected.
- Test bootstrap idempotence, date boundaries, cancel/confirm, stale confirmation, persistence after refresh, Ready derivation, save failures and unknown requests.
- Inspect the UI at desktop and mobile sizes, and complete the full demo journey.
- Record actual test commands/results. Mark blocked checks unverified, never passed.

DELIVER
- Complete runnable source, migrations, .env.example, .gitignore, lockfile and appropriate open-source license.
- README with tested local setup, anonymous auth configuration, migration steps, demo usage, simulation limitations and deployment guidance.
- docs/DEMO_SCRIPT.md: a truthful roughly 2:15 screen-recording script based on working features.
- docs/SUBMISSION_DRAFT.md: project story and pitch based only on implemented behavior; leave unknown URLs blank and labelled.
- docs/PRODUCT_FEEDBACK.md and docs/FRICTION_LOG.md: observations actually made during this build.
- docs/TEST_RESULTS.md and a concise architecture document.
- If a GitHub destination is explicitly established and publishing is authorized, push only this project's files after a secret scan. Otherwise prepare the repo and provide exact publishing steps. Do not invent a repository or deployment URL.
- Finish with what works, actual validation results, any remaining limitations, and the precise steps the user must take to record the video and submit.

Start now with the project inspection and Supabase setup, then implement the complete P0 journey.
```

## 21. Optional final audit prompt

After the first build, paste:

```text
Audit ReturnReady against the PRD's P0 acceptance criteria and definition of done. Run the actual app and inspect the implementation, migrations and RLS. Test the complete demo journey and two independent sessions. Fix defects that block the demo, persistence or isolation. Do not add new features. Reconcile README, demo script and submission story with actual behavior. Report exact checks run, remaining unverified checks and any steps I must complete before submitting. Never mark a mocked or skipped integration test as a live Supabase pass.
```
