# Notes: WMS-06 manager-led picking workflow

## Sources

- `warehouse-application-brd-v1.08.md` §11.6: Manager issues/assigns/reassigns tasks and confirms readiness; Picker scans stock, records actual quantity and condition, completes packing/staging; Logistics owns pickup and delivery evidence.
- `warehouse-application-brd-v1.08.md` WMS-06 blueprint: discrete steps are issue → in progress → picked/partial/short → verify → stage → ready; stage-specific required fields and blockers are specified.
- `tts-steel-wms/src/components/workspaces/Wms06Picking.tsx`: current tabs are pick slip, pick results, manager delivery; current status pipeline is mostly a static label strip. Assignment action is currently initiated by `crane_operator`; picker and Manager responsibilities blur in the active cockpit.

## Design direction

- Preserve the existing slate/cobalt, data-dense operations UI. Use a compact manager work queue and a task detail panel.
- Make the active lifecycle stage explicit and change the instruction/checklist/actions as the stage changes.
- Keep task-state badges separate from inventory status badges.

## Implementation decisions

- Manager assigns a queued task and may reassign it only before scanning/actual picking; operator cannot move a task from queued to assigned.
- Picking checks (item/spec and dimension tolerance) appear only during `picking`; bundling, documents, and actual staging placement appear only during `qc_packing`. State transitions enforce those checks in the context layer as well as disabling premature UI actions.
- The active stage card states the task owner, concrete actions, and safety/check reminders. Manager view adds counts for unassigned work, staging review, exceptions, and ready tasks.
- The manager coordinates/approves the workflow; the picker still records physical picking and staging evidence, while Logistics remains responsible for pickup and delivery events.

## Verification

- Production Vite build passed. It still reports the repository's config-loader and large-chunk warnings.
- TypeScript lint currently fails only on `src/components/workspaces/Wms11Lifecycle.tsx`: the active-tab union omits `catalog`, and the active-event bindings are missing. WMS-06 and `WmsContext.tsx` do not appear in the diagnostics. Left that component untouched because a separate WMS UI task is editing it.
