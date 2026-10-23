# ReturnReady — Product Requirements Reference

The canonical, complete Product Requirements Document (PRD) and build specification for ReturnReady is maintained at the repository root in:

- [`../ReturnReady_PRD_and_Antigravity_Prompt.md`](../ReturnReady_PRD_and_Antigravity_Prompt.md)

## Quick Summary of P0 Scope Implemented

1. **Isolated Demo Access (`FR-01`):** Supabase Auth session creation/reuse and transactional workspace seeding (`rr_bootstrap_demo`).
2. **Purchase List & Filtering (`FR-02`):** Five seeded INR purchases anchored to `Asia/Kolkata` today, sorted by earliest recorded deadline, with filters (`All active`, `Due soon`, `Overdue`, `Ready`, `Dropped off`) and search.
3. **Preparation Checklists (`FR-03`):** Item-specific packing steps persisted via `rr_set_checklist` with duplicate-click protection and failure rollback.
4. **Derived Ready & Drop-Off Status (`FR-04`):** Stored statuses (`planning`, `preparing`, `dropped_off`) with derived `Ready to drop off` when all checklist steps are checked; locked checklist when `dropped_off` until reopened.
5. **Confirmed Household Assignment (`FR-05`):** Version-checked assignment to household member names (`Me`, `Priya`, `Alex`) via `rr_confirm_action`.
6. **Optional Purchase & Member Editing (`FR-06`, P1):** Add/edit return modal with integer paise conversion, date validation, and unsaved-changes confirmation.
7. **Isolated Demo Reset (`FR-07`):** Resets only the caller's workspace (`rr_reset_demo`) with explicit confirmation.
