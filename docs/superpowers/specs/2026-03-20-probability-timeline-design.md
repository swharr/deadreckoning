# Probability Over Time — Design Spec

**Date:** 2026-03-20
**Status:** Approved
**Mockup:** `.superpowers/brainstorm/8117-1774038878/timeline-mockup-v2.html`

## Summary

Add a "Probability Over Time" chart to the deadreckoning dashboard that visualizes how the overall ballot qualification probability has changed across all historical snapshots (Jan 16 – present). The chart sits between StatCards and DistributionChart, uses a dot-emphasis line style, annotates the Feb 15 model switch, and shows day-over-day probability deltas for all post-deadline snapshots. The timeline grows automatically as new data arrives through the pipeline.

## Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| What to show | Overall qualification probability only (not per-district) | Keeps chart focused and readable |
| Data location | Baked into `public/data.json` as `probabilityTimeline` | Single fetch, single source of truth |
| Historical model | Use whichever model was active at each date + annotate the switch | Honest representation; annotation explains the discontinuity |
| Dashboard placement | Between StatCards and VelocityTracker (actual component order in App.jsx) | "Here's the number → here's the journey" narrative flow |
| Chart style | Dot-emphasis line (prominent dots, subtle connecting line) | Respects discrete data updates; data-journalism feel |
| Backfill approach | `process.py` reads `data/history.json` and computes probabilities for each snapshot | All model logic stays in one file; no `replay.py` changes |
| Day-over-day deltas | Computed and stored for all post-Feb 15 snapshots | Shows the survival-phase story of incremental change |

## Data Pipeline Changes

### `scripts/process.py`

Add a new function `compute_probability_timeline(history)` that iterates chronologically through `history["snapshots"]`, reconstructing cumulative state at each snapshot to compute the overall qualification probability.

**The challenge:** The existing model functions (`compute_district_prob`, `compute_district_prob_survival`) require derived parameters (trend, velocity, projections, peak verified, removal rates, etc.) that are only computed for the current snapshot in `main()`. For historical backfill, we must reconstruct these parameters cumulatively.

**Approach: Cumulative replay with simplified parameters.** The function iterates snapshots in order, maintaining running state:

1. **Running state tracked across iterations:**
   - `peak_verified[d]`: highest count seen so far per district (updated each snapshot)
   - `post_deadline_removed[d]`: cumulative removals per district since Feb 15 (from snapshot-to-snapshot decreases post-deadline)
   - `prev_counts[d]`: previous snapshot's per-district counts (for computing deltas, velocity, trend)
   - `snapshot_index`: how many snapshots we've seen (for `snapshot_count` entropy pull)

2. **Per-snapshot computation:**

   **Growth mode (pre-Feb 15):** Use a simplified growth probability. The full growth model needs linear projections and trend classifications that depend on weighted least-squares fits across the entire history — too complex to faithfully reconstruct in a backfill loop. Instead:
   - Compute `current_pct = verified / threshold` for each district
   - Derive a simple trend from the last two snapshots: `ACCEL` if velocity increasing, `DECEL` if decreasing, `STABLE` otherwise
   - Use `final_week_sigs` from the delta between current and previous snapshot
   - Set `projected_adj = verified` (no projection — conservative baseline)
   - Call `compute_district_prob()` with these simplified inputs
   - This is an acceptable approximation: growth-mode probabilities are inherently speculative (they're predicting future signature collection), and the timeline's purpose is showing the arc, not pixel-perfect historical replay

   **Survival mode (post-Feb 15):** Replicate the `main()` blending logic faithfully. The survival model's parameters can all be reconstructed cumulatively:
   - `peak_verified[d]`: tracked in running state
   - `post_deadline_removed[d]`: computed from count decreases between consecutive post-deadline snapshots
   - `observed_removal_rate`: `post_deadline_removed[d] / peak_verified[d]`
   - `days_remaining`: `(CLERK_DEADLINE - snapshot_date).days`
   - `pre_deadline_slope`: computed from the last two pre-deadline snapshots (fixed after Feb 15)
   - `LG_LAG_DAYS` decay, empirical lag detection, effective_verified blending: replicate the logic from `main()` using the cumulative state available at each snapshot's point in time
   - `growth_prob_for_blend`: use the same simplified growth model as above
   - Final `prob = lag_weight * growth_prob_for_blend + (1.0 - lag_weight) * survival_prob`

3. **DP distribution + correlation penalty:** For each snapshot, run `compute_distribution()` on the 29 district probabilities, then apply `CORRELATION_PENALTY_SCALE = 0.030` deflation, matching the live computation exactly.

4. **Delta computation:** For post-Feb 15 entries (after the first one), `delta = current.pQualify - previous.pQualify`.

5. **Consistency guarantee:** The final timeline entry must match the current live `pDistrictRule` value (within rounding). If it doesn't, that's a bug — the same parameters should produce the same result since the last snapshot in the timeline uses identical data to the live computation.

**Implementation note:** Extract the survival-mode blending logic (lag weight, empirical lag detection, effective_verified, growth blend) from `main()` into a helper function that both `main()` and `compute_probability_timeline()` can call. This avoids duplicating ~80 lines of logic and ensures the timeline and live values stay in sync.

### Output in `public/data.json`

New top-level key `probabilityTimeline`:

```json
{
  "probabilityTimeline": [
    { "date": "2026-01-16", "pQualify": 0.04, "modelMode": "growth", "delta": null },
    { "date": "2026-01-18", "pQualify": 0.06, "modelMode": "growth", "delta": null },
    ...
    { "date": "2026-02-15", "pQualify": 0.52, "modelMode": "survival", "delta": null },
    { "date": "2026-02-18", "pQualify": 0.55, "modelMode": "survival", "delta": 0.03 },
    ...
    { "date": "2026-03-16", "pQualify": 0.7088, "modelMode": "survival", "delta": -0.012 }
  ]
}
```

**Field definitions:**
- `date`: ISO date string (YYYY-MM-DD)
- `pQualify`: Overall P(≥26 districts qualify), 0.0–1.0
- `modelMode`: `"growth"` or `"survival"` — which model was used
- `delta`: Change from previous snapshot's `pQualify`. `null` for all growth-mode entries and the first survival-mode entry (Feb 15 is the baseline). Computed for all subsequent survival entries.

**Auto-extension:** When the pipeline runs with a new snapshot, `history.json` grows, and `process.py` recomputes the full timeline including the new data point. No manual intervention required.

## React Component

### `src/components/ProbabilityTimeline.jsx`

**Rendering:** Pure inline-styled SVG (no charting library). Follows the same pattern as `DistributionChart.jsx` and `VelocityTracker.jsx`.

**Container:**
- Card style: `#0d1530` background, `#1e2a4a` border, 10px border-radius, 24px/28px padding
- Title: "PROBABILITY OVER TIME" — 13px, bold, uppercase, letterspaced, `#8899bb`

**Chart elements:**
- **Y-axis:** 0% to 100%, gridlines at 25% intervals, labels in `#8899bb`
- **X-axis:** Snapshot dates — always show first date, Feb 15, and last date. Add up to 4 additional evenly-spaced ticks (targeting ~7 labels max). Skip any tick that would overlap within 30px of an anchor label. Feb 15 label in orange bold.
- **Connecting line:** `#4a9eff`, 1.5px stroke, 0.4–0.5 opacity
- **Data dots:** 5px radius circles, `#4a9eff` fill, `#0d1530` stroke ring (2px). The first survival-mode dot (first snapshot on or after Feb 15) is 6px and `#ff9800` (orange). If no snapshot falls exactly on Feb 15, the annotation line is placed at the Feb 15 x-position interpolated between the nearest surrounding snapshots, and the orange dot goes on the first post-deadline snapshot.
- **Model switch annotation:** Dashed vertical line at Feb 15 in `#ff9800` with "Feb 15 · Model Switch" label
- **Phase labels:** "Growth Model" / "Survival Model" in `#556688` italic below the chart on each side of the divider

**Hover interactions:**
- **Dot hover:** Tooltip showing date, probability (%), model mode, and delta (for post-Feb 15 points). Format: "Mar 16 — 70.9%" with "↑ +1.1% from prior" in green for increases, red for decreases.
- **Model switch hover:** Tooltip explaining the model switch: "Model Switch — Feb 15, 2026 / Before: estimated odds based on signature collection *trajectory*. After: all signatures submitted — model now tracks whether verified counts will *survive* clerk review."

**Responsive:** SVG uses viewBox for responsive scaling. No fixed pixel widths.

### Integration in `App.jsx`

- Import `ProbabilityTimeline`
- Pass `data.probabilityTimeline` as a prop
- Render between `StatCards` and `VelocityTracker` (matching actual component order in App.jsx)
- Only render if `probabilityTimeline` exists and has length > 0 (graceful degradation)

## Testing

### Python
- Unit test: given a known history.json fixture with a few snapshots, verify `compute_probability_timeline()` returns expected structure with correct fields, correct model mode per date, and non-null deltas only for post-Feb-15 entries after the first
- Regression: existing tests must still pass (model output for current snapshot unchanged)

### JavaScript
- Vitest: `ProbabilityTimeline` renders without error when given valid timeline data
- Vitest: component renders nothing (no crash) when `probabilityTimeline` is empty or undefined
- Vitest: correct number of dots rendered matches timeline length

## Edge Cases

- **Missing `history.json`:** `compute_probability_timeline()` returns empty list. Component renders nothing.
- **< 2 snapshots:** Timeline still renders (single dot), but no connecting line or deltas.
- **No snapshot on exactly Feb 15:** Model switch annotation placed at interpolated x-position; first survival-mode dot goes on the first post-deadline snapshot.

## Out of Scope

- Per-district probability timelines (possible future enhancement)
- Confidence bands or uncertainty ranges on historical points
- Animation/transitions on the chart
- Any changes to `replay.py`
