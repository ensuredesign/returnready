# ReturnReady Guardian — From Existing Code to AI-Powered DevSecOps

**GitLab Transcend 2026: Life After Code Hackathon** • **Theme 2: Bring Your Own**  
**Developer:** **Ritesh Kochar** (`@ensure01`)  
**Live Deployed Application:** [https://returnready-guardian.vercel.app/](https://returnready-guardian.vercel.app/)  
**GitLab Hackathon Repository:** [https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43775292/returnready-guardian](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43775292/returnready-guardian)  
**Original GitHub Repository:** [https://github.com/ensuredesign/returnready](https://github.com/ensuredesign/returnready)  

[![GitLab CI Main Pipeline](https://img.shields.io/badge/GitLab_CI-6_Jobs_Passing-10B981?style=for-the-badge&logo=gitlab)](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43775292/returnready-guardian/-/pipelines/2993974901)
[![GitLab Duo MR !2](https://img.shields.io/badge/GitLab_Duo-MR_!2_Approved_%26_Merged-7B58C3?style=for-the-badge&logo=gitlab)](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43775292/returnready-guardian/-/merge_requests/2)
[![Live Application](https://img.shields.io/badge/Live_App-returnready--guardian.vercel.app-00D2FF?style=for-the-badge)](https://returnready-guardian.vercel.app/)
[![Vitest Unit Tests](https://img.shields.io/badge/Vitest-24%2F24_Passed-FCC624?style=for-the-badge&logo=vitest)](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43775292/returnready-guardian/-/jobs/17500632234)
[![License: MIT](https://img.shields.io/badge/License-MIT-0F1E36?style=for-the-badge)](./LICENSE)

---

## 1. Hackathon Overview — Life After Code with GitLab Duo

![ReturnReady Guardian — From Existing Code to AI-Powered DevSecOps](https://raw.githubusercontent.com/ensuredesign/returnready/main/docs/images/06-gitlab-duo-flow-overview.jpg)

**ReturnReady Guardian** demonstrates **"Life After Code"** for Theme 2 (Bring Your Own) of the GitLab Transcend 2026 Hackathon. 

Writing application code is only the starting point. What happens *after* development determines whether software is secure, reliable, and ready for production. We started with a genuine, working single-page application ([ReturnReady on GitHub](https://github.com/ensuredesign/returnready)) and used **GitLab Duo Autonomous Agents** to transform how it is tested, verified, reviewed, and delivered.

> **Project Tagline:** *From Existing Code to AI-Powered DevSecOps.*  
> A working household returns assistant, now developed, verified, reviewed, and released with GitLab Duo.

---

## 2. The GitLab Duo DevSecOps Lifecycle

![GitLab Duo Agent Platform — DevSecOps Lifecycle](https://raw.githubusercontent.com/ensuredesign/returnready/main/docs/images/07-gitlab-duo-agent-platform-lifecycle.jpg)

The entire delivery flow is governed by automated verification and autonomous AI agents:

```
[1. Develop] ───> [2. Verify] ───> [3. Secure] ───> [4. Review] ───> [5. Govern] ───> [6. Release]
 GitLab Duo        6 CI Jobs       Semgrep SAST     GitLab Duo       Human Merge      Live Vercel
 Developer Flow    24 Unit Tests   Secret Detect    Code Review      by Maintainer    Edge Deploy
 (Session 10118219) (Pipeline)     (Isolated)       (Session 10120008) (Pipeline #2993974901) (Supabase RLS)
```

### Stage 1: Develop — GitLab Duo Developer Flow (Session #10118219)
- **Goal:** Upgrade `.gitlab-ci.yml` from security-only scanning to a full validation pipeline.
- **Autonomous Inspection:** The agent examined `package.json`, `vite.config.ts`, `tsconfig.json`, and `.gitlab-ci.yml`.
- **Security-First Architecture:** Deliberately created a private, hidden `.node_job` template using `node:22-alpine` with npm dependency caching keyed to `package-lock.json`. This guaranteed that GitLab security scanner containers never inherit Node.js installation commands.
- **Merge Request Created:** The agent autonomously created branch `ci/add-validation-pipeline` and opened [MR !2](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43775292/returnready-guardian/-/merge_requests/2), marked it ready, and provided full technical rationale in the MR description.

### Stage 2: Verify — Automated CI/CD Pipeline
- **TypeScript Typecheck (`typecheck`):** Executes `tsc --noEmit` in stage `validate`, guaranteeing zero type errors.
- **ESLint Validation (`lint`):** Executes `eslint src tests --max-warnings 0` in stage `validate` (strict zero-warning policy).
- **Vitest Unit Tests (`unit_tests`):** Executes `vitest run` in stage `test`, reporting **24 passing tests** across 4 test suites with native JUnit XML report generation (`artifacts: reports: junit`).
- **Production Build (`build`):** Executes `tsc -b && vite build` in stage `build`, producing an optimized production bundle in `dist/` retained for 1 week.

### Stage 3: Secure — Container-Isolated Security Analysis
- **Semgrep SAST (`semgrep-sast`):** Scans the codebase for static application security vulnerabilities.
- **Secret Detection (`secret_detection`):** Scans repository commits and files for exposed credentials and API secrets.
- **Zero Pollution:** Kept official analyzer images (`registry.gitlab.com/security-products/...`) completely clean of `npm ci` overhead.
- **MR Pipeline Support:** Configured `AST_ENABLE_MR_PIPELINES: 'true'` to ensure security scanners run consistently during Merge Request evaluations.

### Stage 4: Review — GitLab Duo Code Review Flow (Session #10120008)
- **Independent AI Review:** GitLab Duo independently reviewed the diff on [MR !2](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43775292/returnready-guardian/-/merge_requests/2).
- **Key Verifications:**
  - Verified that the `.node_job` template is properly scoped with `extends` to Node jobs only.
  - Verified that `workflow:rules` avoids duplicate branch/MR pipelines while maintaining security scanner execution.
  - Verified dependency cache hygiene and artifact expiration policies.
- **Recorded Approval:** GitLab Duo commented: *"I finished my review and found nothing to comment on. Nice work! :tada:"* and formally **approved Merge Request !2**.

### Stage 5: Govern — Human Decision & Main Pipeline #2993974901
- **Human-in-the-Loop:** Maintainer Ritesh Kochar reviewed the AI-approved MR and executed the merge commit (`c9077de`) into `main`.
- **Main Pipeline Passed:** Main branch [pipeline #2993974901](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43775292/returnready-guardian/-/pipelines/2993974901) ran all 6 jobs concurrently and passed with 100% green checks.

### Stage 6: Release — Live Production Deployment
- **Public URL:** [https://returnready-guardian.vercel.app/](https://returnready-guardian.vercel.app/)
- **Zero Functional Drift:** Retained the entire working application's functionality while establishing an enterprise-grade AI-assisted delivery lifecycle.

---

## 3. Verified Hackathon Results & Automated Quality Metrics

![GitLab Transcend 2026 Hackathon Results](https://raw.githubusercontent.com/ensuredesign/returnready/main/docs/images/08-gitlab-transcend-hackathon-results.jpg)

| Metric | Result | Verification Evidence |
|---|---|---|
| **GitLab Duo Developer Flow** | **Completed Successfully** | [Agent Session #10118219](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43775292/returnready-guardian/-/automate/agent-sessions/10118219) |
| **GitLab Duo Code Review Flow** | **Approved MR !2** | [Agent Session #10120008](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43775292/returnready-guardian/-/automate/agent-sessions/10120008) |
| **AI-Generated Merge Request** | **MR !2 Merged into `main`** | [Merge Request !2](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43775292/returnready-guardian/-/merge_requests/2) |
| **Concurrent CI/CD Pipeline Jobs** | **6 / 6 Passed** | [Main Pipeline #2993974901](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43775292/returnready-guardian/-/pipelines/2993974901) |
| **Automated Unit Tests** | **24 / 24 Passed (0 Failures)** | [unit_tests Job #17500632234](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43775292/returnready-guardian/-/jobs/17500632234) |
| **Static Security Analysis** | **Semgrep SAST Clean** | [semgrep-sast Job #17500632233](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43775292/returnready-guardian/-/jobs/17500632233) |
| **Secret Detection** | **Zero Leaked Secrets** | [secret_detection Job #17500632236](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43775292/returnready-guardian/-/jobs/17500632236) |
| **Live Deployed Application** | **Public on Vercel** | [https://returnready-guardian.vercel.app/](https://returnready-guardian.vercel.app/) |

---

## 4. ReturnReady Household Assistant Experience

![ReturnReady Guardian Household Assistant & DevSecOps Flow](https://raw.githubusercontent.com/ensuredesign/returnready/main/docs/images/09-returnready-guardian-assistant-flow.jpg)

### What the Application Does
**ReturnReady** helps households turn an intention to return a purchase into a prepared, assigned errand:
1. **Deadline Tracking (`Asia/Kolkata`):** Displays active returns sorted by earliest user-recorded deadline, with instant summary cards for **Active returns (`5`)**, **Due within 7 days (`3`)**, and **Ready to drop off (`1`)**, plus one-click filters for **All active**, **Due soon**, **Overdue**, **Ready**, and **Dropped off**.
2. **Conversational Help (Alexa+ Experience Simulation):** A split-screen **ReturnReady Assistant** panel lets users ask natural questions such as *"What needs returning this week?"*, *"Prepare the headphones"*, and *"What is missing?"* via text, suggested prompt chips, or browser speech input.
3. **Packing Checklists:** Item-specific preparation steps ensure every accessory, cable, and receipt goes into the box before sealing it.
4. **Derived Ready State:** When all checklist items are checked (`4 of 4 complete`), ReturnReady automatically derives the **Ready to drop off** badge. Unchecking any step removes Ready immediately.
5. **Confirmed Assignments:** Coordinate household responsibility across members (`Me`, `Priya`, `Alex`) with version-bound optimistic concurrency verification.
6. **Supabase PostgreSQL RLS Persistence:** Scoped tables with Row Level Security (`auth.uid()`) isolate each visitor's household workspace while surviving page reloads.

---

## 5. Summary of Key Outcomes

![GitLab Duo Workflow & Key Outcomes](https://raw.githubusercontent.com/ensuredesign/returnready/main/docs/images/10-gitlab-duo-workflow-outcomes.jpg)

- **Two Real GitLab Duo Agent Flows:** Authentic Developer Flow (#10118219) and Code Review Flow (#10120008).
- **AI-Generated MR !2 and Approval:** Completed, reviewed, approved, and merged with full traceability.
- **Six Concurrent CI/CD Jobs:** Automated typechecking, linting, unit testing, Vite bundling, SAST, and Secret Detection.
- **Twenty-Four Passing Unit Tests:** Covering calendar date math, intent routing, derived ready status, and UI error retention.
- **Enterprise DevSecOps Governance:** Security scanner containers remain isolated from application Node.js tooling.
- **Working Application Live:** Deployed at [`returnready-guardian.vercel.app`](https://returnready-guardian.vercel.app/).

---

## 6. Technology Stack

| Layer | Technology | Role in ReturnReady Guardian |
|---|---|---|
| **AI Agent Platform** | **GitLab Duo Developer & Code Review Flows** | Autonomous pipeline development, repo inspection, code review, and approval |
| **DevSecOps & CI/CD** | **GitLab CI/CD, Semgrep SAST, Secret Detection** | 6-job automated pipeline, container isolation, JUnit reporting, security scanning |
| **Frontend Framework** | **React 19 + TypeScript 5.7** | Household returns workspace, accessible status cards, strict typing |
| **Build & Dev Tooling** | **Vite 6** | Fast HMR dev server and production asset compilation (`dist/`) |
| **Backend & Persistence** | **Supabase (PostgreSQL 15+ & RLS)** | Scoped tables, Row Level Security (`auth.uid()`), composite FKs, transactional RPCs |
| **Automated Testing** | **Vitest 3.0.5 + Playwright 1.50** | 24 unit/component tests + 2 live two-session Supabase RLS integration tests + E2E |
| **Hosting & Public Edge** | **Vercel** | Edge hosting for the live application at [`returnready-guardian.vercel.app`](https://returnready-guardian.vercel.app/) |
| **Agentic Engineering** | **Google Antigravity** | System architecture, schema design, test generation, and full-stack development |

---

## 7. Technical Documentation Index

All project documentation is maintained in [`docs/`](./docs/):

- [**GitLab Duo DevSecOps Flow Guide (`docs/GITLAB_DUO_FLOW.md`)**](./docs/GITLAB_DUO_FLOW.md) — Comprehensive technical guide detailing the 6-step agent flow, MR !2, and pipeline configs.
- [**Architecture Overview (`docs/ARCHITECTURE.md`)**](./docs/ARCHITECTURE.md) — System topology, RLS policies, composite FKs, triggers, and transactional RPC specifications.
- [**Product Requirements Reference (`docs/PRD.md`)**](./docs/PRD.md) — Summary of functional requirements (`FR-01`–`FR-07`), acceptance tests (`A01`–`A20`), and visual feature guide.
- [**Test Results & Verification Report (`docs/TEST_RESULTS.md`)**](./docs/TEST_RESULTS.md) — Exact commands and verified pass outputs for typecheck, lint, unit, build, and live two-session RLS integration tests.
- [**Friction Log (`docs/FRICTION_LOG.md`)**](./docs/FRICTION_LOG.md) — Detailed friction log entries (`FL-01`–`FL-03`) with severity, workarounds, and suggestions.
- [**Hackathon Video Deliverables (`demo_videos/gitlab_transcend_2026/`)**](./demo_videos/gitlab_transcend_2026/) — Master MP4 video (`01:58`), voiceover audio, SRT subtitles, cue sheet, and YouTube metadata.

---

## 8. Author & License

- **Developer:** **Ritesh Kochar** (`@ensure01`)  
- **Hackathon:** **GitLab Transcend 2026: Life After Code Hackathon (Theme 2: Bring Your Own)**  
- **License:** [MIT License](./LICENSE)
