# Notes: WMS guide walkthrough

## Findings
- Reference TMS guide uses a centered dialog, step count, progress bar, one focused content panel, a destination CTA, and previous/skip/next controls.
- Current WMS `AppGuideModal` is a static two-column grid of six cards. Its `max-h` is on the section, while the scrollable content has a separate calculated height; this can overflow at shorter viewport heights.
- `Header.tsx` already closes the dialog after a guide destination is selected.
- WMS semantics to preserve: WMS-05 is [02] catalog search; WMS-01 Sales selection is limited to SO-linked [04] reservations.

## QA
- Local preview helper usage checked with `with_server.py --help`.

## Follow-up: header overlap and Thai-only UI (2026-09-30)
- Header badge now displays only at `2xl`; all header controls collapse to 36px icon buttons at narrower widths, and warehouse picker can truncate. This preserves control space and prevents the badge overlapping adjacent actions.
- User found overlap and English labels in the running app. Current active workspace observed via Edge is WMS-05; its UI contains numerous English labels in tabs, table headings, gates, and replacement workflow.
- Need translate user-facing labels across all WMS workspaces, not only guide/header. Preserve technical identifiers, product grades, protocol status values where operationally meaningful; translate their visible labels where feasible.
- Existing repo has unrelated parent-directory changes; leave them untouched.

## Follow-up: responsive header and Thai UI audit (2026-09-30)
- Browser checks found header controls fitting without overlap at 1456px; the sample-data badge is hidden below 2xl and its visible text is Thai only. `SIMULATED LOCAL` no longer appears in the application source text.
- The WMS-05 screen showed an English `Bay` label in recommendation copy; location labels now use Thai. The WMS-06 screens showed `Pick Execution & Handover`, English quantity/status labels, and English terms in the delivery gate; these visible strings now use Thai. Product names in these screens are translated for display.
- WMS-02 product master also exposed English product names, units, `Wizard`, and `Maker-Checker`; visible headings, names, and units now use Thai.
- Browser AX checks covered WMS-05, all three WMS-06 subpages, and WMS-02 product master. Standardized IDs, material grades, standards, protocol/workspace IDs, and PDF remain as values/codes.
- `pnpm run lint` and `pnpm run build` passed with the bundled Node runtime. Build reports a non-blocking large-chunk warning.
- Final live WMS-06 AX state confirms English quantity labels, `VERIFIED`, and delivery-gate phrases are localized; company display names and dimension units are also Thai. Remaining Latin text visible there is limited to document/location/event identifiers, product grades/standards, and the PDF file format.
