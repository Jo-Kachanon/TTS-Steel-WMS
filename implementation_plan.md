# Implementation: warehouse reservation flow

## Goal
Implement the approved core of requirements v0.2 in the local WMS demo: public available-stock view, seven-day soft booking [03], warehouse response and Sales tracking, approved-SO confirmation to [04], pick/readiness visibility, full Thai status names, gate mock values, and remove inline role switches.

## Scope assumptions
- A booking is tracked by lot and quantity in tons, matching current inventory model; partial booking splits stock slices.
- Seven days means 7×24 hours from booking timestamp, Bangkok display. A periodic browser check plus action-time expiry check supports this demo; server-backed enforcement is outside its current localStorage architecture.
- Approved SO is manually recorded in the demo (reference + dates), because no document templates or backend verification service have been supplied.
- Issue pick/processing work only after [04]. Keep existing role switch in the Header menu; remove switches embedded in WMS-05/06.
- No real TMS integration; use the requested five gate labels as demo choices.

## Phases
- [x] Read requirements and relevant source files.
- [x] Add persisted booking model and transitions, including expiry and SO confirmation.
- [x] Add viewable stock booking action, warehouse review/lead-time acknowledgment and Sales tracking.
- [x] Provide the seven agreed work-menu routes plus Settings: inventory overview, available stock, booking tracking, inspection, processing queue, delivery preparation, and clearance plan.
- [x] Surface full status names, requested gates and simplify role switching to header.
- [x] Add interim print/PDF layouts for pick and processing slips pending the three source templates.
- [x] Run typecheck/build, inspect changed files and summarize limits.

## Status
Implementation complete for the agreed demo scope.

## Errors / constraints
- This is a localStorage-backed demo; seven-day expiry is checked by the open browser, not a server scheduler.
- Approved SO is recorded by reference and dates; the app does not verify an uploaded/approved source document.
- The three user-provided document templates are still outstanding. Pick and processing print/PDF layouts are interim mock forms.
- No real logistics/TMS integration; gate choices are M2, M3, G1, G2, G3.
- `npm run build` passes with existing Vite native-loader and large-chunk warnings.
