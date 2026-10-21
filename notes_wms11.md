# Notes: WMS-11 status and movement workspace

## Sources
- `warehouse-application-brd-v1.08.md`
- `stitch-brd-audit-2026-09-30/ai-studio-implementation-notes.md`
- `stitch-brd-audit-2026-09-30/ai-studio-implementation-prompt.md`
- `tts-steel-wms/src/components/workspaces/Wms11Lifecycle.tsx`
- `tts-steel-wms/src/context/WmsContext.tsx`

## Findings
- WMS-11 is one workspace with five tabs: status matrix, zone transfer, processing, claim/return, audit trail.
- Canonical status 01 is ledger-derived; status 02 eligibility is derived; statuses 01–03 are read-only in WMS.
- Normal zone transfer changes location only, preserving canonical status; location/ledger change commits after receiver confirms receipt.
- Processing damage path is 04→05→06 then 02 after receipt/QC pass or 07 after rejection/fail, with partial slices and lineage.
- Any UI integration claims must be clearly marked simulated unless a real connector exists.

- Existing page had six tabs, with stock search separated from a status tab that actually showed audit events; transfer creation was buried in that audit tab.
- BRD v1.08 defines normal transfer as status 04 only, with request → approve/reject → move → receipt; receipt commits only received quantity, while status and received date remain unchanged.
- `WmsContext` already had request/approve/move/receipt checks but no rejection action. It labels capacity/spec checks as true in demo state, so the UI must disclose that those checks are simulated.
- QC draft values were partly reset on job selection; fail quantity and notes could leak from the prior job. Reset all draft fields when the selected job changes.
- Claim slice metadata is linked through `PickTask.claimInventoryItemIds`, `claimReason`, `soNumber`, and `pickNumber`; return receipt/QC is not modeled, so the claim list must say it is not a physical return.

## Implemented
- Reorganized WMS-11 into five primary tabs: status, zone transfer, processing, nonconforming/claim, and history.
- Added stock slice detail and a Maker-Checker status correction proposal flow. Proposals capture before/after status, full-slice quantity, source reference, expected version, reason, and evidence; only WMS-owned statuses 04–08 can be proposed, external statuses remain read-only, and approval rechecks version/state/quantity and pending work.
- Moved transfer creation into the transfer workspace, filtered regular moves to status 04, added queue filters, reasoned reject, role-aware actions, and sample-data labels for capacity checks. Receipt evidence remains required.
- Improved processing queue stage counts, linked pick/SO context, selection-safe QC defaults, and a route to WMS-06 where pick exceptions create rework jobs. Claim rows link back to pick/SO context and distinguish customer-site claims from physical returns.
- History search now includes event ID, lot, time, source/actor, trigger, and correlation ID; export follows the active filters.

## Verification
- `pnpm run lint` passed (`tsc --noEmit`).
- `pnpm run build` passed. Existing Vite `__dirname` and >500 KB chunk warnings remain.
- Browser preview could not start: local server binding was denied with `listen EPERM`, so rendered visual QA and in-browser interaction checks are unverified.
