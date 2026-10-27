# ReturnReady Guardian — GitLab Duo DevSecOps Flow

> **GitLab Transcend 2026: Life After Code Hackathon**  
> **Theme 2: Bring Your Own**  
> **Developer:** Ritesh Kochar (`@ensure01`)  
> **Live Deployed Application:** [https://returnready-guardian.vercel.app/](https://returnready-guardian.vercel.app/)  
> **GitLab Hackathon Repository:** [https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43775292/returnready-guardian](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43775292/returnready-guardian)  
> **Original GitHub Repository:** [https://github.com/ensuredesign/returnready](https://github.com/ensuredesign/returnready)  

---

## 1. Overview: From Existing Code to AI-Powered DevSecOps

![GitLab Duo Flow Overview](https://raw.githubusercontent.com/ensuredesign/returnready/main/docs/images/06-gitlab-duo-flow-overview.jpg)

**ReturnReady Guardian** is a household returns assistant built with React 19, TypeScript, Vite, and Supabase PostgreSQL with Row Level Security. While the application already worked, this hackathon entry demonstrates **"Life After Code"** — how autonomous AI agents and automated DevSecOps transform software verification, security scanning, review, and delivery.

Using **GitLab Duo Developer Flow** and **GitLab Duo Code Review Flow**, an existing codebase was upgraded with a comprehensive CI/CD pipeline, independent AI code review, automated security scanning, and public deployment.

---

## 2. The 6-Step GitLab Duo Agent Flow

![GitLab Duo Agent Platform — DevSecOps Lifecycle](https://raw.githubusercontent.com/ensuredesign/returnready/main/docs/images/07-gitlab-duo-agent-platform-lifecycle.jpg)

```
[1. Develop] ───> [2. Verify] ───> [3. Secure] ───> [4. Review] ───> [5. Govern] ───> [6. Release]
 GitLab Duo        6 CI Jobs       Semgrep SAST     GitLab Duo       Human Merge      Live Vercel
 Developer Flow    24 Unit Tests   Secret Detect    Code Review      to Main Branch   Deployment
 (Session 10118219) (Pipeline)     (Isolated)       (Session 10120008) (Pipeline Green) (Supabase RLS)
```

### Step 1: Develop — GitLab Duo Developer Flow (Session #10118219)
- **Goal:** Upgrade `.gitlab-ci.yml` from security-only scanning to a full validation pipeline.
- **Autonomous Execution:** The Duo Developer agent inspected the repository, detected existing npm scripts (`typecheck`, `lint`, `test`, `build`), and implemented a hidden `.node_job` template using `node:22-alpine` with npm dependency caching keyed to `package-lock.json`.
- **Output:** The agent opened [Merge Request !2](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43775292/returnready-guardian/-/merge_requests/2) on branch `ci/add-validation-pipeline` with no human intervention.

### Step 2: Verify — Automated CI/CD Pipeline
- **TypeScript Typecheck:** `tsc --noEmit` verifies strict type safety with 0 errors.
- **ESLint Linting:** `eslint src tests --max-warnings 0` enforces clean code style with 0 warnings.
- **Vitest Unit Tests:** `vitest run` executes 24 unit tests across 4 test suites with native JUnit XML reporting (`artifacts: reports: junit`).
- **Production Build:** `tsc -b && vite build` compiles the production assets into `dist/` artifacts.

### Step 3: Secure — Container-Isolated Security Scanners
- **SAST & Secret Detection:** Preserves GitLab's official templates (`Security/SAST.gitlab-ci.yml` and `Security/Secret-Detection.gitlab-ci.yml`).
- **Container Isolation:** The security scanner containers (`semgrep-sast`, `secret_detection`) do not inherit Node.js-specific commands, preventing `npm not found` errors.
- **MR Rule Compliance:** `AST_ENABLE_MR_PIPELINES: 'true'` ensures security scans execute on Merge Request pipelines.

### Step 4: Review — GitLab Duo Code Review Flow (Session #10120008)
- **Independent Analysis:** GitLab Duo examined the diff on MR !2.
- **Verified Isolation:** Confirmed that `.node_job` is scoped strictly to Node jobs and security analyzers remain untouched.
- **Formal Approval:** GitLab Duo posted a detailed review summary and **approved Merge Request !2**.

### Step 5: Govern & Merge — Human Decision & Main Pipeline #2993974901
- **Human in the Loop:** Maintainer Ritesh Kochar reviewed the AI-approved MR and merged it into `main`.
- **Main Pipeline:** Pipeline #2993974901 executed all 6 jobs concurrently on `main` and passed with 100% green checks.

### Step 6: Release & Deploy — Public Production Application
- **Live Deployment:** [https://returnready-guardian.vercel.app/](https://returnready-guardian.vercel.app/)
- **Zero Functional Drift:** All original household return features, deadline tracking in Asia/Kolkata, packing checklists, derived Ready states, and Supabase RLS isolation remain fully functional.

---

## 3. Product & Household Assistant Architecture

![ReturnReady Guardian Assistant Flow](https://raw.githubusercontent.com/ensuredesign/returnready/main/docs/images/09-returnready-guardian-assistant-flow.jpg)

ReturnReady Guardian solves real household friction around product returns:
- **Deadline Tracking:** Visual urgency indicators (past deadline, due tomorrow, due in 3 days) calculated in the local timezone (`Asia/Kolkata`).
- **Smart Packing Checklists:** Item accessories, box, tags, and receipt checks before drop-off.
- **Household Role Assignment:** Assigning drop-off tasks to household members.
- **Conversational Assistant:** Simulated voice / conversational assistant for query and status updates.

---

## 4. Results & Verified Metrics

![GitLab Transcend Hackathon Results](https://raw.githubusercontent.com/ensuredesign/returnready/main/docs/images/08-gitlab-transcend-hackathon-results.jpg)
![GitLab Duo Workflow Key Outcomes](https://raw.githubusercontent.com/ensuredesign/returnready/main/docs/images/10-gitlab-duo-workflow-outcomes.jpg)

| Metric | Result | Verification Link |
|---|---|---|
| **GitLab Duo Developer Flow** | Session #10118219 (Autonomous MR !2) | [MR !2](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43775292/returnready-guardian/-/merge_requests/2) |
| **GitLab Duo Code Review Flow** | Session #10120008 (AI Approval) | [MR !2 Discussion](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43775292/returnready-guardian/-/merge_requests/2) |
| **CI/CD Pipeline Jobs** | 6/6 Concurrent Jobs Passed | [Pipeline #2993974901](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43775292/returnready-guardian/-/pipelines/2993974901) |
| **Vitest Unit Tests** | 24/24 Passed (4 Test Suites) | [Job #17500632234](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43775292/returnready-guardian/-/jobs/17500632234) |
| **SAST & Secret Detection** | 0 Vulnerabilities, 0 Leaked Secrets | [Security Tab](https://gitlab.com/gitlab-ai-hackathon/transcend-october-2026/43775292/returnready-guardian/-/security/configuration) |
| **Production Deployment** | Live on Vercel with Supabase PostgreSQL | [returnready-guardian.vercel.app](https://returnready-guardian.vercel.app/) |
