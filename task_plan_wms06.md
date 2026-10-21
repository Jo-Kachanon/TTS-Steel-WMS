# Task Plan: WMS-06 manager-led picking workflow

## Goal
Make Warehouse Manager the workflow owner in WMS-06, with role-gated assignment/approval and stage-specific picker guidance, checks, and handoffs.

## Phases
- [x] Read the current WMS-06 UI, task state transitions, role checks, and BRD v1.08 workflow.
- [x] Define a manager-controlled task flow that preserves picker execution and Logistics ownership boundaries.
- [x] Implement stage-specific work instructions, required checks, and manager queue controls in WMS-06.
- [x] Run type/build validation and review changed-file scope.

## Decisions
- Manager owns task issue/assign/reassign before work starts, exception oversight/routing, and readiness approval.
- Picker records physical work and stage evidence; the app must not pretend the Manager performs physical picking.
- Keep existing stock-status and integration gates, and retain Logistics as booking/pickup/delivery owner.
- Limit source changes to WMS-06 unless validation proves a context-layer change is required.

## Status
**Complete with a validation limitation** — manager assignment/reassignment, stage guidance, task-specific checklists, and transition gates are implemented. Vite build passes. TypeScript lint reports errors only in the concurrently edited, out-of-scope `Wms11Lifecycle.tsx` (`catalog` state type and missing `activeEvent` bindings); no diagnostics point to WMS-06 or WmsContext.

## Verification note

- `pnpm run build`: passed.
- `pnpm run lint`: blocked by unrelated `Wms11Lifecycle.tsx` errors; that file and its existing task plan were left untouched.
- WMS-06 retains physical picking/staging actions for Picker and Logistics-owned pickup/delivery events; Manager owns assignment, pre-start reassignment, exception oversight, and readiness confirmation.
