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

## 2. Visual Screens Implemented

### Screen A — Entry & Simulation Disclosure
![Screen A — Entry](./images/02-entry-screen.png)

### Screen B — Main Household Workspace & Conversational Assistant
![Screen B — Main Workspace](./images/03-workspace-dashboard.png)

### Screen C — Item Details, Checklist & Derived Ready State
![Screen C — Item Details & Ready State](./images/04-checklist-and-ready-state.png)

### Confirmed Household Assignment Flow
![Confirmed Assignment to Priya](./images/05-confirmed-assignment.png)

### P1 Add / Edit Return Modal
![Add Return Modal](./images/06-add-return-modal.png)
