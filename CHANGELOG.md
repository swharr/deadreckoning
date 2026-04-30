# Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Added
- Archive modal and persistent archive banner announcing the Utah Lt. Governor's Elections Division final determination that the petition did not qualify for the November 2026 ballot
- Link to the official determination letter PDF (`public/UT-LG-Prop4-Determination-FINAL.pdf`)
- Footer archive notice with `tater@t8rsk8s.io` contact for questions
- Final probability timeline entry for 2026-04-30 (`pQualify: 0.0`, `modelMode: "final"`) with red marker, dashed guide, and "Did Not Qualify" annotation on the Probability Over Time chart
- Mar 9 teal dashed vertical guide on the Probability Over Time chart marking when the signature removal request window opened (matches the Feb 15 and Apr 30 marker idiom)
- `snapshot.signatureFlow.alltimeRejected: 60296` field separating clerk-side validation rejections from formal removal requests
- Final-determination callout linking to the LG letter at the bottom of the Statewide Threshold timeline

### Changed
- Statewide Threshold card: title now reads "Signature Threshold Reached" (the 140,748 statewide bar was cleared; the petition failed the 26-of-29 district rule)
- Ballot Timeline now displays the archive end-state: all four phases hardcoded as completed/determined, with a red ✗ LG's Official Determination row replacing the prior "LG certifies for November ballot" row, plus a 🛑 + "0 days left" indicator on the closed signature removal window
- Signature Flow "All time" section split into "Rejected (clerk)" and "Removed (signer)" rows with explanatory subtitles; "Removal rate" replaced with combined "Attrition rate" plus per-category breakdown
- `snapshot.signatureFlow.alltimeRemovals` corrected from `10524` to `10716` (final post-determination value)
- Site is now in archive mode — preserved as a historical record of the petition effort
- Daily data pipeline cron disabled in `.github/workflows/fetch.yml`; workflow remains triggerable manually
- Replaced the live progress banner with an archive banner; removed unused `THRESHOLDS` import and `progressPct`/`confirmedDistricts` calcs
- Scraper now falls back to direct wp-content xlsx URL after LG office removed download link from petition page (Strategy 3)

### Removed
- "Removal window open" amber callout from the Statewide Threshold card (window has closed)
- Date-driven phase logic from the ballot timeline (replaced with hardcoded archive state)

### Security
- vite 7.3.1 → 8.0.9 — arbitrary file read via WebSocket (HIGH), `server.fs.deny` bypass (HIGH), path traversal in `.map` handling (MEDIUM)
- picomatch 4.0.3 → 4.0.4 — method injection in POSIX character classes (MEDIUM)
- @vitejs/plugin-react 4.7.0 → 5.2.0 — peer compatibility for Vite 8
- brace-expansion — zero-step sequence hang (MEDIUM)
- requests 2.31.0 → 2.33.1 — insecure temp file reuse in `extract_zipped_paths()` (MEDIUM)

## 2026-03-22

### Added
- Probability Over Time chart showing ballot qualification probability across all 29 historical snapshots (Jan 16 – Mar 16), with dot-emphasis line style, Feb 15 model switch annotation with hover explainer, and day-over-day deltas for the post-deadline survival phase
- Pipeline backfills probabilities for every snapshot using cumulative state replay

## 2026-03-13

### Added
- Python regression tests for model helpers and generated artifacts
- `scripts/backtest.py` harness replaying historical snapshots to `data/calibration.json`
- `checks.yml` workflow for validation on pushes and pull requests
- District-facing UI surfaces per-district removal counts alongside net change

### Changed
- `data/removals.json` emits aggregate-only removal statistics instead of raw voter IDs/names
- `scripts/process.py` anchors time-sensitive calculations to snapshot `asOfDate` for reproducibility
- App exports `overall.pBallotQualified` and `overall.probabilityScope` for UI probability scoping
- Reprocessing the same daily xlsx preserves day-over-day deltas from `history.json` instead of flattening to zero

### Fixed
- Fetch pipeline now fails loudly on scrape/process errors instead of silently presenting stale data
- Removed redundant deploy dispatch from `fetch.yml`; added workflow concurrency to `deploy.yml` to prevent deploy races

### Security
- Removed raw voter identity data from committed artifacts

## 2026-02-28

### Added
- Clerk Verification Window countdown on Statewide Threshold card showing working days until March 9 deadline, with green/red progress bar spanning Feb 15–Mar 9

### Fixed
- District map boundaries now use dark contrasting borders and thicker strokes, eliminating blended "green blob" effect on adjacent same-tier districts
- District number labels use polygon centroid placement instead of bounding-box center for better accuracy on irregular shapes
