# Changelog

All notable changes to this project will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/).

## [Unreleased]

### Changed
- Scraper now falls back to direct wp-content xlsx URL after LG office removed download link from petition page (Strategy 3)

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
