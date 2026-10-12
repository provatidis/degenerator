# Release history

## 1.9.1 — 2026-10-12

- Keep keyboard focus on a selected price when either calculator redraws its comparison table. Clearing a saved comparison and undoing a removal return focus to available controls.
- Preserve readable chart-label sizes as cards shrink on mobile, including charts revealed after switching workspaces. Add sideways-scroll hints to mobile comparison tables and visible disclosure focus outlines.
- Place collapsed example and saved-experiment controls together on desktop; expanded libraries retain the full available width.
- Define LP on the calculator entry screen, clarify cumulative replay fees and show each recorded case’s dates. Order the position examples from in-range to out-of-range to fee accounting.
- Align the guide’s experiment names and local startup instructions with the current interface. Add browser regressions for comparison keyboard continuity, saved-library focus and all four charts at 390px and 320px.

## 1.9.0 — 2026-10-12

- Add a second verified fixed-position case: 17 checkpoints over 33 hours 27 minutes, with exits, returns and 41.7% time in range.
- Keep the in-range baseline first and add the longer case as example 10, with a direct link and recorded-case selector.
- Explain interval fee credits, active/outside time, and activity hidden between sampled prices; preserve cumulative integer rounding.
- Add checkpoint milestones, a price chart focused on relevant bounds, exact evidence/export and a principal-only Playground handoff.
- Reject impossible adjacent range-time counters and decreasing cumulative fee credits; handle delayed case loads and retries.

## 1.8.1 — 2026-10-12

- Keep primary navigation visible and make Experiment/Inspect open their section introductions.
- Offset anchored tools, sticky lab tabs and the learning sidebar below the measured header.
- Preserve valid working calculator drafts when visiting Learn and returning in the same tab.

## 1.8.0 — 2026-10-11

- Focus Experiment, Inspect and Pool mechanics on separate workspaces while preserving existing links and drafts.
- Keep Learn directly accessible alongside the tools.
- Add a verified 83-minute fixed-position case with nine checkpoints, calculated period fees, cumulative range time and JSON export.
- Shorten the project introduction and move detailed guides, models and architecture into `docs/`.

## 1.7.0 — 2026-10-11

- Save named experiments with notes, reopen working copies, compare up to three setups and export/import the library.
- Preserve verified source snapshots when starting assumptions still match.
- Protect edits across tabs and handle delayed dialog close events.

## 1.6.0 — 2026-10-11

- Add block-pinned v3 fee accounting and distinguish new fee credits, recorded owed tokens and estimated collectable balances.
- Add an applied fee-accounting example and read-only collection verification.

Earlier changes are available in the [commit history](https://github.com/provatidis/degenerator/commits/main/).
