# Implementation notes
- App uses React + TypeScript + Vite, with WmsContext and localStorage persistence; no backend.
- Existing availability is WMS-05 catalog. Existing SO reservation paths include a legacy direct [02]→[04] submission and a Manager [03]→[04] path; new bookings will use separate booking records so they can exist before an SO.
- Existing WMS-01 contains request/manager/logistics tabs. WMS-11 has stock-status/processing/claims/audit views. WMS-06 tracks pick task state; its default gate is STG-GATE-01.
- Existing product master is hard-coded display rows in WMS-02, not a shared model. The requested master configuration will require a new shared demo model.

## Implemented
- `src/types/wms.ts`: added SKU work-type settings and reservation records, including warehouse review, Sales acknowledgment, SO reference/date/gate and operation tracking.
- `src/context/WmsContext.tsx`: persists bookings/configuration in localStorage; reserves inventory into [03], expires open holds after 7×24 hours back to [02], records warehouse inspection and damaged splits, accepts a substitute lot, confirms SO as [04], then creates processing [05] or pick work. SO-linked processing QC keeps passed quantity in [04].
- `src/components/workspaces/Wms05Allocation.tsx`: public [02] stock catalog and Sales booking modal with seven-day notice; legacy allocation/recommendation tabs are hidden from the main flow.
- `src/components/workspaces/Wms11Lifecycle.tsx`: booking and Sales tracking dashboard, operator review/queue estimate, Approved SO entry, issue-work actions, full Thai status labels, and interim print/PDF processing slip. The same screen backs the separate booking, inspection, processing, and inventory-overview entry points.
- `src/components/workspaces/Wms02MasterData.tsx`: manager/admin controls for finished vs processing SKU type and standard processing days.
- `src/components/workspaces/Wms06Picking.tsx`: gate choices restricted to M2/M3/G1/G2/G3 and removed the in-page role switch.
- `src/components/common/Header.tsx`, `src/components/common/Sidebar.tsx`, `src/components/common/AppGuideModal.tsx`, `src/App.tsx`: role selector retained in the top user menu; navigation now exposes seven work menus plus Settings, and the guide follows the revised booking flow.
- `src/index.css` was not changed; its existing print layout is reused for the interim processing slip. Source templates remain pending.
- Other changed source files: `src/components/workspaces/Wms02MasterData.tsx`, `src/components/workspaces/Wms05Allocation.tsx`, `src/components/workspaces/Wms06Picking.tsx`, `src/context/WmsContext.tsx`, and `src/types/wms.ts`.

## Verification
- `npm run lint` passed (`tsc --noEmit`).
- `npm run build` passed. Vite reports its existing native-loader `__dirname` notice and a bundle-size notice.
- Read-only browser inspection confirmed the sidebar shows seven work menus plus Settings; WMS-03, WMS-04, and WMS-07 open with the expected page headings; the [02] catalog shows full Thai status names and a note that every role can view it. The live check used the Sales role.
- Opened the booking confirmation dialog and verified its seven-day Approved SO wording, then closed it without submitting a booking.
- Role-switch search found a control only in `src/components/common/Header.tsx`.
- No test suite was run; package scripts provide lint/build only.
