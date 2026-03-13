# Changelog

## 2026-03-13

### Privacy-safe removal artifacts
`data/removals.json` no longer publishes raw voter IDs or names. The replay pipeline now emits aggregate-only removal statistics, including totals by district and last-seen date, so committed artifacts remain useful for analysis without exposing raw identity data.

### Data pipeline checks and failure handling
The fetch pipeline now fails loudly when scrape/process work breaks instead of silently presenting stale data as a clean run. It also runs Python regression tests and the frontend quality pass before opening a data PR, and a new `checks.yml` workflow runs the same validation on pushes and pull requests.

### Deploy deduplication
Removed the redundant deploy dispatch from `fetch.yml` and added workflow concurrency to `deploy.yml`. Deploys now come from the `push` to `main`, and overlapping deploy attempts for the same branch are canceled cleanly before they race in Azure.

### Model reproducibility and exported probabilities
`scripts/process.py` now anchors time-sensitive calculations to the snapshot `asOfDate` rather than the machine's current date, making repeated runs of the same snapshot reproducible. The app now exports `overall.pBallotQualified` and `overall.probabilityScope` so the UI can distinguish the exact district-rule probability from the current joint ballot estimate.

### Calibration and regression coverage
Added Python regression tests for model helpers and generated artifacts, plus a `scripts/backtest.py` harness that replays historical snapshots and writes calibration metrics to `data/calibration.json`.

### Reprocessing preserves day-over-day snapshot changes
Processing the same daily xlsx more than once now still derives district count deltas, gains, losses, and newly-met/newly-failed status from `history.json` instead of flattening those fields to zero. That keeps the dashboard's "today vs. yesterday" view intact on repeat runs and redeploys.

## 2026-02-28

### Clerk Verification Window countdown
Added a countdown section to the **Statewide Threshold** card showing working days remaining until the March 9 clerk verification deadline. Includes a green/red progress bar spanning Feb 15–Mar 9 so you can see at a glance how much of the verification window has elapsed.

### District map boundary improvements
District boundaries on the heatmap are now clearly defined with dark contrasting borders and thicker strokes, eliminating the "green blob" effect where adjacent same-tier districts blended together. District number labels now use proper polygon centroid placement instead of bounding-box center, so labels sit more accurately inside irregularly shaped districts.
