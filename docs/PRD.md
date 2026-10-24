# ReturnReady — Product Requirements & Visual Feature Guide

**App Developed by:** **Ritesh Kochar** (`@ensuredesign`) for **Build, Ship, Shape: Amazon Developer Hackathon** on **Oct 23, 2026**  
**Track:** Alexa+ Track (Simulated Experience Path)  
**Live App:** [https://returnready.ensure.in/](https://returnready.ensure.in/) · **Demo Video:** [https://youtu.be/GEOhZsTn5ME](https://youtu.be/GEOhZsTn5ME)

The canonical Product Requirements Document (PRD) and build specification is maintained at the repository root in [`../ReturnReady_PRD_and_Antigravity_Prompt.md`](../ReturnReady_PRD_and_Antigravity_Prompt.md).

---

## 1. Implemented Functional Requirements (`FR-01` – `FR-07`)

| ID | Requirement | Implementation & Verification |
|---|---|---|
| **FR-01** | **Demo Initialization** | One-click **“Try sample household”** establishes an isolated Supabase Auth session and invokes `rr_bootstrap_demo()` with transaction-level advisory locking so reloads/double-clicks never duplicate seed rows (`A01`, `A02`). |
| **FR-02** | **Purchase List & Filtering** | Displays 5 seeded INR purchases sorted by earliest recorded deadline, with filters for **All active**, **Due soon** (`today..today+7` inclusive in `Asia/Kolkata`), **Overdue** (`< today`), **Ready**, and **Dropped off**, plus case-insensitive search (`A05`, `A06`). |
| **FR-03** | **Preparation Checklists** | Item-specific packing steps persisted via `rr_set_checklist(check_id, checked)` with duplicate-click protection and prior-state retention on network failure (`A07`, `A14`). |
| **FR-04** | **Derived Ready & Drop-Off Status** | Stored statuses (`planning`, `preparing`, `dropped_off`) with derived **Ready to drop off** when all steps are checked; checklist locked when `dropped_off` until reopened (`A11`, `A12`, `A13`). |
| **FR-05** | **Confirmed Household Assignment** | Proposes assignment (`Assign Wireless Headphones to Priya?`) with version-bound `PendingAction` (`expected_version`) and saves only on explicit **Confirm** (`A08`, `A09`, `A15`, `A16`). |
| **FR-06** | **Purchase & Member Editing (P1)** | Add/edit return modal with Zod validation, integer paise storage (`amount_minor`), `return_deadline >= purchase_date` check, and unsaved-changes discard confirmation. |
| **FR-07** | **Isolated Demo Reset** | **Reset sample data** modal resets only the authenticated caller's workspace (`rr_reset_demo()`) without affecting any other visitor (`A18`). |

---

## 2. Visual Feature Showcase

### 2.1 Organized Household Returns Workspace & Alexa+ Assistant (`FR-01`, `FR-02`)
![Less return chaos. More clarity. Your household returns, organized.](./images/01-hero-household-returns-organized.jpg)
- Shows the 5 active INR (`₹`) returns, 7-day `Asia/Kolkata` deadline buckets (`Due soon`, `Overdue`, `Ready`, `Dropped off`), and the split-screen **ReturnReady Assistant**.

### 2.2 Return Lifecycle — From Planning to Drop-Off (`FR-04`, `FR-06`)
![From planning to drop-off. See the status of each household return.](./images/02-planning-to-dropoff-status.jpg)
- Illustrates the three core lifecycle stages (**1. Planning**, **2. Preparing** with derived **Ready**, and **3. Dropped off**) alongside clear simulation and scope disclosures.

### 2.3 Contextual Missing-Steps Assistant & Packing Checklists (`FR-03`)
![Know what is still missing. Ask your assistant before you pack.](./images/03-know-what-is-missing-assistant.jpg)
- Demonstrates asking *"What is missing?"* for the **Wireless Headphones (`₹4,999`)** to identify unchecked items (*Charging cable*, *Receipt* / *Protective packaging*) before sealing the box.

### 2.4 Persistent Checklists & Confirmed Household Assignments (`FR-05`, `FR-07`)
![Pick up where you left off. Your checklists and assignments stay saved.](./images/04-saved-progress-and-assignments.jpg)
- Shows version-safe assignment (`Assigned to Priya`), derived `Ready to drop off` status, and real Supabase PostgreSQL persistence across browser refreshes.

---

*App Developed by: Ritesh Kochar for Build, Ship, Shape: Amazon Developer Hackathon on Oct 23, 2026*
