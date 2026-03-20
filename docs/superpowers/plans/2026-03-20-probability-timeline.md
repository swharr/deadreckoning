# Probability Over Time — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Probability Over Time" chart showing how the overall ballot qualification probability has changed across all 29 historical snapshots, with model-switch annotation and day-over-day deltas.

**Architecture:** `process.py` computes historical probabilities by replaying each snapshot through the existing model functions, writes the timeline into `public/data.json` as `probabilityTimeline`. A new `ProbabilityTimeline.jsx` component renders it as a dot-emphasis SVG line chart between StatCards and VelocityTracker.

**Tech Stack:** Python 3.11 (process.py), React 18 + Vite (inline SVG, no charting library), unittest (Python), Vitest (JS)

**Spec:** `docs/superpowers/specs/2026-03-20-probability-timeline-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `scripts/process.py` | Add `compute_survival_blend()` helper + `compute_probability_timeline()`, call in `main()`, refactor `main()` to use shared helper. Move `CORRELATION_PENALTY_SCALE` to module level. |
| Create | `src/components/ProbabilityTimeline.jsx` | SVG timeline chart component |
| Modify | `src/App.jsx` | Import + render ProbabilityTimeline between StatCards and VelocityTracker |
| Modify | `vite.config.js` | Add `test: { environment: 'jsdom' }` for component tests |
| Create | `tests/test_probability_timeline.py` | Python unit tests for timeline computation |
| Create | `src/components/ProbabilityTimeline.test.jsx` | Vitest component tests |

---

### Task 1: Extract survival blend helper from `main()`

The survival-mode blending logic (~120 lines in `main()`) needs to be callable from both `main()` and the new timeline function. Extract it into a standalone helper. Also move `CORRELATION_PENALTY_SCALE = 0.030` from inside `main()` to a module-level constant (needed by both `main()` and `compute_probability_timeline()` later).

**Files:**
- Modify: `scripts/process.py:671-838` (survival mode block in `main()`)
- Modify: `scripts/process.py:931` (move `CORRELATION_PENALTY_SCALE` to module level, near other constants around line 44)

- [ ] **Step 1: Write failing test for the new helper**

Create `tests/test_probability_timeline.py`:

```python
import importlib.util
import unittest
from datetime import date
from pathlib import Path


def load_module(path: str, name: str):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


REPO_ROOT = Path(__file__).resolve().parent.parent
process = load_module(str(REPO_ROOT / "scripts" / "process.py"), "process_module")


class SurvivalBlendHelperTest(unittest.TestCase):
    """Test the extracted compute_survival_blend() helper."""

    def test_returns_float_probability(self):
        """Basic smoke test: helper returns a float in [0, 1]."""
        # Minimal district history: 2 pre-deadline, 2 post-deadline snapshots
        district_snapshots = [
            {"date": "2026-02-10", "count": 4000},
            {"date": "2026-02-13", "count": 4500},
            {"date": "2026-02-18", "count": 4700},
            {"date": "2026-02-21", "count": 4800},
        ]
        statewide_snapshots = [
            {"date": "2026-02-10", "total": 100000},
            {"date": "2026-02-13", "total": 120000},
            {"date": "2026-02-18", "total": 140000},
            {"date": "2026-02-21", "total": 150000},
        ]
        result = process.compute_survival_blend(
            verified=4800,
            threshold=5000,
            d_num=1,
            as_of_date=date(2026, 2, 21),
            district_snapshots=district_snapshots,
            statewide_snapshots=statewide_snapshots,
            peak_verified=4800,
            post_deadline_removed=0,
            rejection_rate=0.02,
            growth_proj_raw=5100.0,
            days_to_deadline=16,
            snapshot_count=4,
        )
        self.assertIsInstance(result, float)
        self.assertGreaterEqual(result, 0.0)
        self.assertLessEqual(result, 1.0)

    def test_above_threshold_returns_high_prob(self):
        """District well above threshold should have high survival probability."""
        district_snapshots = [
            {"date": "2026-02-10", "count": 5500},
            {"date": "2026-02-13", "count": 5800},
            {"date": "2026-02-18", "count": 6000},
            {"date": "2026-02-21", "count": 6200},
        ]
        statewide_snapshots = [
            {"date": "2026-02-10", "total": 100000},
            {"date": "2026-02-13", "total": 120000},
            {"date": "2026-02-18", "total": 140000},
            {"date": "2026-02-21", "total": 155000},
        ]
        result = process.compute_survival_blend(
            verified=6200,
            threshold=5000,
            d_num=1,
            as_of_date=date(2026, 2, 21),
            district_snapshots=district_snapshots,
            statewide_snapshots=statewide_snapshots,
            peak_verified=6200,
            post_deadline_removed=0,
            rejection_rate=0.01,
            growth_proj_raw=6500.0,
            days_to_deadline=16,
            snapshot_count=4,
        )
        self.assertGreater(result, 0.7)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/python -m unittest tests/test_probability_timeline.py -v`
Expected: FAIL — `AttributeError: module has no attribute 'compute_survival_blend'`

- [ ] **Step 3: Implement `compute_survival_blend()` helper**

Add the function in `scripts/process.py` after `compute_district_prob_survival()` (around line 278). This extracts the logic from `main()` lines 671-838 into a callable function:

```python
def compute_survival_blend(
    verified: int,
    threshold: int,
    d_num: int,
    as_of_date: date,
    district_snapshots: list[dict],
    statewide_snapshots: list[dict],
    peak_verified: int,
    post_deadline_removed: int,
    rejection_rate: float,
    growth_proj_raw: float | None,
    days_to_deadline: int,
    snapshot_count: int,
) -> float:
    """
    Compute blended survival/growth probability for a single district.

    Replicates the full survival-mode blending logic from main():
    LG lag weight, empirical lag detection, effective_verified,
    pre-deadline slope, growth/survival blend.

    Used by both main() and compute_probability_timeline().
    """
    LG_LAG_DAYS = 14
    days_elapsed = max(0, (as_of_date - SUBMISSION_DEADLINE).days)
    lag_weight = max(0.0, 1.0 - days_elapsed / LG_LAG_DAYS)

    # Empirical lag detection — district-level
    empirical_lag_active = False
    pre_snaps = [s for s in district_snapshots if date.fromisoformat(s["date"]) <= SUBMISSION_DEADLINE]
    post_snaps = [s for s in district_snapshots if date.fromisoformat(s["date"]) > SUBMISSION_DEADLINE]

    if pre_snaps and post_snaps:
        last_pre_count = pre_snaps[-1]["count"]
        initial_post_gain = max(0, post_snaps[0]["count"] - last_pre_count)
        subsequent_post_gain = sum(
            max(0, post_snaps[i]["count"] - post_snaps[i - 1]["count"])
            for i in range(1, len(post_snaps))
        )
        total_post_gain = initial_post_gain + subsequent_post_gain
        if last_pre_count > 0:
            empirical_lag_active = (total_post_gain / last_pre_count) >= 0.002

    # Empirical lag — statewide fallback
    if not empirical_lag_active and statewide_snapshots:
        sw_post = [s for s in statewide_snapshots if date.fromisoformat(s["date"]) > SUBMISSION_DEADLINE]
        if len(sw_post) >= 2:
            post_gains = sum(
                max(0, sw_post[i]["total"] - sw_post[i - 1]["total"])
                for i in range(1, len(sw_post))
            )
            last_pre_sw = next(
                (s for s in reversed(statewide_snapshots)
                 if date.fromisoformat(s["date"]) <= SUBMISSION_DEADLINE),
                None
            )
            if last_pre_sw and last_pre_sw["total"] > 0:
                empirical_lag_active = (post_gains / last_pre_sw["total"]) >= 0.001

    if not empirical_lag_active:
        lag_weight = 0.0
    elif lag_weight == 0.0 and empirical_lag_active:
        lag_weight = 0.10

    # Post-deadline velocity
    post_deadline_velocity = 0.0
    post_deadline_projected = float(verified)
    if post_snaps and len(post_snaps) >= 2:
        total_net = post_snaps[-1]["count"] - post_snaps[0]["count"]
        total_days = max(1, (date.fromisoformat(post_snaps[-1]["date"]) - date.fromisoformat(post_snaps[0]["date"])).days)
        post_deadline_velocity = total_net / total_days
        post_deadline_projected = verified + post_deadline_velocity * days_to_deadline
        if post_deadline_velocity < 0:
            post_deadline_projected = max(float(verified), post_deadline_projected)
    elif post_snaps and len(post_snaps) == 1 and pre_snaps:
        span_days = max(1, (date.fromisoformat(post_snaps[0]["date"]) - date.fromisoformat(pre_snaps[-1]["date"])).days)
        post_deadline_velocity = (post_snaps[0]["count"] - pre_snaps[-1]["count"]) / span_days
        post_deadline_projected = verified + post_deadline_velocity * days_to_deadline

    # Effective verified
    if len(post_snaps) >= 2:
        upper_bound = growth_proj_raw if growth_proj_raw else post_deadline_projected
        effective_verified = min(post_deadline_projected, upper_bound)
        effective_verified = max(float(verified), effective_verified)
    elif growth_proj_raw and lag_weight > 0:
        effective_verified = verified + lag_weight * max(0, growth_proj_raw - verified)
    else:
        effective_verified = float(verified)

    # Pre-deadline slope
    pre_deadline_slope = 0.0
    if len(pre_snaps) >= 2:
        last_pre = pre_snaps[-1]
        prev_pre = pre_snaps[-2]
        interval_days = max(1, (date.fromisoformat(last_pre["date"]) - date.fromisoformat(prev_pre["date"])).days)
        pre_deadline_slope = max(0.0, (last_pre["count"] - prev_pre["count"]) / interval_days)

    # Survival probability
    survival_prob = compute_district_prob_survival(
        verified=effective_verified,
        threshold=threshold,
        peak_verified=peak_verified,
        post_deadline_removed=post_deadline_removed,
        observed_removal_rate=rejection_rate,
        days_remaining=days_to_deadline,
        pre_deadline_slope=pre_deadline_slope,
        snapshot_count=snapshot_count,
    )

    # Growth probability for blend
    # Simplified: use current verified as projection baseline when no growth_proj_raw
    trend = compute_trend_from_history(district_snapshots) if len(district_snapshots) >= 3 else "STABLE"
    final_week_sigs = 0
    if len(district_snapshots) >= 2:
        final_week_sigs = max(0, district_snapshots[-1]["count"] - district_snapshots[-2]["count"])

    growth_prob_for_blend = compute_district_prob(
        verified=verified,
        threshold=threshold,
        trend=trend,
        final_week_sigs=final_week_sigs,
        projected_adj=growth_proj_raw if growth_proj_raw else float(verified),
        rejection_rate=rejection_rate,
        snapshot_count=snapshot_count,
    )

    # Blend
    return lag_weight * growth_prob_for_blend + (1.0 - lag_weight) * survival_prob
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/python -m unittest tests/test_probability_timeline.py -v`
Expected: PASS (2 tests)

- [ ] **Step 5: Refactor `main()` to use the new helper**

Replace the survival-mode block in `main()` (lines ~671-838) with a call to `compute_survival_blend()`. The `prob` variable should get the same value as before. The growth shadow probability, projected totals, and other display fields computed in that block stay in `main()` since they're output-specific.

After refactoring, the survival block in `main()` should look roughly like:

```python
if post_deadline:
    growth_proj_raw = None
    if history and str(d_num) in projections:
        growth_proj_raw = projections[str(d_num)]["raw"]

    prob = compute_survival_blend(
        verified=verified,
        threshold=threshold,
        d_num=d_num,
        as_of_date=as_of_date,
        district_snapshots=district_history.get(d_num, []),
        statewide_snapshots=history["snapshots"] if history else [],
        peak_verified=peak_verified,
        post_deadline_removed=post_deadline_removed,
        rejection_rate=rejection_rate,
        growth_proj_raw=growth_proj_raw,
        days_to_deadline=days_to_deadline,
        snapshot_count=snapshot_count,
    )

    # ... remaining display fields (projected_total, projected_pct, etc.) stay here
```

- [ ] **Step 6: Run full validation to confirm refactor is behavior-preserving**

Run:
```bash
.venv/bin/python scripts/replay.py
.venv/bin/python scripts/process.py
.venv/bin/python -m unittest discover -s tests -p "test_*.py"
```

Verify: `public/data.json` output is **identical** (or within rounding) to before the refactor. Diff the file — probabilities, distributions, and all district fields should match.

- [ ] **Step 7: Commit**

```bash
git add scripts/process.py tests/test_probability_timeline.py
git commit -m "Extract compute_survival_blend() helper from main()

Shared helper enables both main() and the upcoming probability
timeline to use identical survival-mode blending logic (lag weight,
empirical lag detection, effective_verified, growth blend)."
```

---

### Task 2: Implement `compute_probability_timeline()`

The core backfill function that iterates through history snapshots and computes pQualify at each point in time.

**Files:**
- Modify: `scripts/process.py` (add function after `compute_survival_blend()`)
- Modify: `tests/test_probability_timeline.py` (add tests)

- [ ] **Step 1: Write failing tests**

Add to `tests/test_probability_timeline.py`:

```python
class ProbabilityTimelineTest(unittest.TestCase):
    """Test the compute_probability_timeline() function."""

    def _make_history(self, snapshots):
        """Build a minimal history dict from a list of snapshot dicts."""
        return {
            "snapshotCount": len(snapshots),
            "firstSnapshot": snapshots[0]["date"],
            "lastSnapshot": snapshots[-1]["date"],
            "snapshots": snapshots,
            "rejectionRates": {},
            "postDeadlineRemovalRates": {},
            "postDeadlineRemovalCounts": {},
            "peakVerified": {},
            "projections": {"byDistrict": {}},
            "anomalies": [],
        }

    def test_returns_list_with_correct_length(self):
        """One timeline entry per snapshot."""
        snapshots = [
            {"date": "2026-01-20", "total": 50000,
             "districts": {str(d): 1700 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
            {"date": "2026-01-23", "total": 60000,
             "districts": {str(d): 2000 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
        ]
        history = self._make_history(snapshots)
        timeline = process.compute_probability_timeline(history)
        self.assertEqual(len(timeline), 2)

    def test_timeline_entries_have_required_fields(self):
        """Each entry must have date, pQualify, modelMode, delta."""
        snapshots = [
            {"date": "2026-01-20", "total": 50000,
             "districts": {str(d): 1700 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
        ]
        history = self._make_history(snapshots)
        timeline = process.compute_probability_timeline(history)
        entry = timeline[0]
        self.assertIn("date", entry)
        self.assertIn("pQualify", entry)
        self.assertIn("modelMode", entry)
        self.assertIn("delta", entry)

    def test_pre_deadline_uses_growth_mode(self):
        """Snapshots before Feb 15 should use growth model."""
        snapshots = [
            {"date": "2026-01-20", "total": 50000,
             "districts": {str(d): 1700 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
        ]
        history = self._make_history(snapshots)
        timeline = process.compute_probability_timeline(history)
        self.assertEqual(timeline[0]["modelMode"], "growth")

    def test_post_deadline_uses_survival_mode(self):
        """Snapshots after Feb 15 should use survival model."""
        snapshots = [
            {"date": "2026-02-10", "total": 100000,
             "districts": {str(d): 3500 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
            {"date": "2026-02-18", "total": 145000,
             "districts": {str(d): 5000 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
        ]
        history = self._make_history(snapshots)
        timeline = process.compute_probability_timeline(history)
        post_entries = [e for e in timeline if e["modelMode"] == "survival"]
        self.assertTrue(len(post_entries) > 0)

    def test_deltas_null_for_growth_and_first_survival(self):
        """Growth entries and the first survival entry should have null delta."""
        snapshots = [
            {"date": "2026-02-10", "total": 100000,
             "districts": {str(d): 3500 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
            {"date": "2026-02-18", "total": 140000,
             "districts": {str(d): 4800 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
            {"date": "2026-02-21", "total": 150000,
             "districts": {str(d): 5100 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
        ]
        history = self._make_history(snapshots)
        timeline = process.compute_probability_timeline(history)
        # Growth entry delta = None
        growth_entries = [e for e in timeline if e["modelMode"] == "growth"]
        for e in growth_entries:
            self.assertIsNone(e["delta"])
        # First survival entry delta = None
        survival_entries = [e for e in timeline if e["modelMode"] == "survival"]
        if survival_entries:
            self.assertIsNone(survival_entries[0]["delta"])

    def test_subsequent_survival_deltas_are_floats(self):
        """Second+ survival entries should have numeric delta."""
        snapshots = [
            {"date": "2026-02-18", "total": 140000,
             "districts": {str(d): 4800 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
            {"date": "2026-02-21", "total": 150000,
             "districts": {str(d): 5100 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
            {"date": "2026-02-24", "total": 155000,
             "districts": {str(d): 5300 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
        ]
        history = self._make_history(snapshots)
        timeline = process.compute_probability_timeline(history)
        survival_entries = [e for e in timeline if e["modelMode"] == "survival"]
        # At least the 2nd and 3rd should have numeric deltas
        if len(survival_entries) >= 2:
            self.assertIsNotNone(survival_entries[1]["delta"])
            self.assertIsInstance(survival_entries[1]["delta"], float)

    def test_pqualify_in_valid_range(self):
        """All pQualify values must be in [0.0, 1.0]."""
        snapshots = [
            {"date": "2026-01-20", "total": 50000,
             "districts": {str(d): 1700 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
            {"date": "2026-02-18", "total": 140000,
             "districts": {str(d): 4800 for d in range(1, 30)},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0},
        ]
        history = self._make_history(snapshots)
        timeline = process.compute_probability_timeline(history)
        for entry in timeline:
            self.assertGreaterEqual(entry["pQualify"], 0.0)
            self.assertLessEqual(entry["pQualify"], 1.0)

    def test_empty_history_returns_empty_list(self):
        """No snapshots → empty timeline."""
        history = self._make_history([
            {"date": "2026-01-20", "total": 0, "districts": {},
             "deltas": {}, "removals": {}, "net": {}, "totalDelta": 0, "totalRemovals": 0}
        ])
        history["snapshots"] = []
        history["snapshotCount"] = 0
        timeline = process.compute_probability_timeline(history)
        self.assertEqual(timeline, [])
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `.venv/bin/python -m unittest tests/test_probability_timeline.py -v`
Expected: FAIL — `AttributeError: module has no attribute 'compute_probability_timeline'`

- [ ] **Step 3: Implement `compute_probability_timeline()`**

Add in `scripts/process.py` after `compute_survival_blend()`:

```python
CORRELATION_PENALTY_SCALE = 0.030  # moved to module-level constant


def compute_probability_timeline(history: dict) -> list[dict]:
    """
    Compute overall qualification probability at each historical snapshot.

    Iterates chronologically through history["snapshots"], maintaining
    cumulative state (peak verified, post-deadline removals, etc.) and
    computing the blended probability at each point in time.

    Returns a list of {date, pQualify, modelMode, delta} dicts.
    """
    snapshots = history.get("snapshots", [])
    if not snapshots:
        return []

    projections = history.get("projections", {}).get("byDistrict", {})
    timeline = []

    # Running state
    peak_verified = {}  # d_num -> highest count seen so far
    prev_counts = {}    # d_num -> previous snapshot count
    post_deadline_removed = {}  # d_num -> cumulative removals since deadline

    prev_survival_pq = None  # for delta computation
    first_survival_seen = False

    for snap_idx, snap in enumerate(snapshots):
        snap_date = date.fromisoformat(snap["date"])
        districts = snap.get("districts", {})
        post_deadline = snap_date > SUBMISSION_DEADLINE
        days_to_deadline = max((CLERK_DEADLINE - snap_date).days, 0)

        # Build district snapshots up to this point (for the blend helper)
        district_probs = []

        for d_num in sorted(THRESHOLDS.keys()):
            threshold = THRESHOLDS[d_num]
            verified = districts.get(str(d_num), 0)

            # Update running state
            if verified > peak_verified.get(d_num, 0):
                peak_verified[d_num] = verified

            # Track post-deadline removals (count decreases after deadline)
            if post_deadline and d_num in prev_counts:
                decrease = max(0, prev_counts.get(d_num, 0) - verified)
                post_deadline_removed[d_num] = post_deadline_removed.get(d_num, 0) + decrease

            # Build this district's snapshot history up to current point
            d_history = [
                {"date": snapshots[i]["date"],
                 "count": snapshots[i].get("districts", {}).get(str(d_num), 0)}
                for i in range(snap_idx + 1)
            ]

            if post_deadline:
                # Growth projection from history (if available)
                growth_proj_raw = None
                if str(d_num) in projections:
                    growth_proj_raw = projections[str(d_num)].get("raw")

                pk = peak_verified.get(d_num, verified)
                pd_removed = post_deadline_removed.get(d_num, 0)
                # Use history's Bayesian-smoothed rejection rates when available
                # (matches what main() uses), fall back to raw ratio
                hist_rejection_rates = {
                    int(k): v for k, v in history.get("rejectionRates", {}).items()
                }
                rejection_rate = hist_rejection_rates.get(d_num, 0.0)
                if rejection_rate == 0.0 and pk > 0 and pd_removed > 0:
                    rejection_rate = pd_removed / pk

                # Statewide snapshots up to this point
                sw_snaps = [
                    {"date": snapshots[i]["date"], "total": snapshots[i].get("total", 0)}
                    for i in range(snap_idx + 1)
                ]

                prob = compute_survival_blend(
                    verified=verified,
                    threshold=threshold,
                    d_num=d_num,
                    as_of_date=snap_date,
                    district_snapshots=d_history,
                    statewide_snapshots=sw_snaps,
                    peak_verified=pk,
                    post_deadline_removed=pd_removed,
                    rejection_rate=rejection_rate,
                    growth_proj_raw=growth_proj_raw,
                    days_to_deadline=days_to_deadline,
                    snapshot_count=snap_idx + 1,
                )
            else:
                # Growth mode — simplified
                trend = compute_trend_from_history(d_history) if len(d_history) >= 3 else "STABLE"
                final_week_sigs = 0
                if len(d_history) >= 2:
                    final_week_sigs = max(0, d_history[-1]["count"] - d_history[-2]["count"])

                prob = compute_district_prob(
                    verified=verified,
                    threshold=threshold,
                    trend=trend,
                    final_week_sigs=final_week_sigs,
                    projected_adj=float(verified),  # conservative — no projection
                    rejection_rate=0.0,
                    snapshot_count=snap_idx + 1,
                )

            district_probs.append(prob)

            # Update prev_counts for next iteration
            prev_counts[d_num] = verified

        # DP distribution + correlation penalty
        dp = compute_distribution(district_probs)
        pq_raw = p_qualify(dp)
        pq = max(0.0, pq_raw - CORRELATION_PENALTY_SCALE * pq_raw)
        pq = round(pq, 4)

        # Delta computation
        model_mode = "survival" if post_deadline else "growth"
        delta = None

        if model_mode == "survival":
            if not first_survival_seen:
                first_survival_seen = True
                prev_survival_pq = pq
            else:
                delta = round(pq - prev_survival_pq, 4)
                prev_survival_pq = pq

        timeline.append({
            "date": snap["date"],
            "pQualify": pq,
            "modelMode": model_mode,
            "delta": delta,
        })

    return timeline
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `.venv/bin/python -m unittest tests/test_probability_timeline.py -v`
Expected: All 10 tests PASS

- [ ] **Step 5: Commit**

```bash
git add scripts/process.py tests/test_probability_timeline.py
git commit -m "Add compute_probability_timeline() for historical backfill

Iterates through all snapshots, computing overall qualification
probability at each point using the appropriate model mode.
Tracks cumulative state for faithful survival-mode replay."
```

---

### Task 3: Wire timeline into `main()` and `data.json` output

**Files:**
- Modify: `scripts/process.py` (call timeline in `main()`, add to output)

- [ ] **Step 1: Add timeline computation to `main()`**

In `scripts/process.py`, in the `main()` function, after the history is loaded (around line 533) and before the output JSON is built, add:

```python
    # --- Probability timeline ---
    probability_timeline = []
    if history:
        probability_timeline = compute_probability_timeline(history)
```

Also move `CORRELATION_PENALTY_SCALE = 0.030` from inside `main()` (line 931) to the module-level constant that was added in Task 2. Update the existing reference in `main()` to use the module-level constant.

- [ ] **Step 2: Add `probabilityTimeline` to the output JSON**

Find where `data.json` output dict is built in `main()` and add:

```python
    "probabilityTimeline": probability_timeline,
```

This goes as a top-level key alongside `meta`, `overall`, `districts`, `snapshot`.

- [ ] **Step 3: Run the full pipeline and verify output**

Run:
```bash
.venv/bin/python scripts/process.py
.venv/bin/python -m unittest discover -s tests -p "test_*.py"
```

Verify:
- `public/data.json` now has a `probabilityTimeline` key
- It has 29 entries (one per snapshot)
- Last entry's `pQualify` matches `overall.pDistrictRule` (within rounding)
- Growth/survival model modes are correct per date
- Deltas are null for growth entries and first survival entry

```bash
# Quick verification:
.venv/bin/python -c "
import json
d = json.load(open('public/data.json'))
tl = d['probabilityTimeline']
print(f'Timeline entries: {len(tl)}')
print(f'First: {tl[0]}')
print(f'Last: {tl[-1]}')
print(f'Live pDistrictRule: {d[\"overall\"][\"pDistrictRule\"]}')
print(f'Match: {abs(tl[-1][\"pQualify\"] - d[\"overall\"][\"pDistrictRule\"]) < 0.005}')
"
```

- [ ] **Step 4: Commit**

```bash
git add scripts/process.py public/data.json
git commit -m "Wire probability timeline into data.json output

process.py now computes and includes probabilityTimeline with
29 historical probability snapshots alongside current model output."
```

---

### Task 4: Create `ProbabilityTimeline.jsx` component

**Files:**
- Create: `src/components/ProbabilityTimeline.jsx`
- Create: `src/components/ProbabilityTimeline.test.jsx`
- Modify: `vite.config.js` (add test environment config)

- [ ] **Step 1: Install test dependencies and configure jsdom environment**

The project has no component testing setup yet — only pure function tests. Install the needed deps:

Run: `npm install --save-dev @testing-library/react @testing-library/jest-dom jsdom`

Then add a `test` block to `vite.config.js`:

```js
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'jsdom',
  },
  define: {
    // ... existing defines unchanged
  },
})
```

Verify existing tests still pass: `npm run test -- --run`

- [ ] **Step 2: Write failing Vitest test**

Create `src/components/ProbabilityTimeline.test.jsx`:

```jsx
import { describe, expect, it } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import ProbabilityTimeline from './ProbabilityTimeline.jsx'

const SAMPLE_TIMELINE = [
  { date: '2026-01-20', pQualify: 0.05, modelMode: 'growth', delta: null },
  { date: '2026-02-10', pQualify: 0.35, modelMode: 'growth', delta: null },
  { date: '2026-02-18', pQualify: 0.52, modelMode: 'survival', delta: null },
  { date: '2026-02-21', pQualify: 0.55, modelMode: 'survival', delta: 0.03 },
  { date: '2026-03-16', pQualify: 0.71, modelMode: 'survival', delta: 0.02 },
]

describe('ProbabilityTimeline', () => {
  it('renders without crashing with valid data', () => {
    const { container } = render(<ProbabilityTimeline timeline={SAMPLE_TIMELINE} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders nothing when timeline is empty', () => {
    const { container } = render(<ProbabilityTimeline timeline={[]} />)
    expect(container.querySelector('svg')).toBeFalsy()
  })

  it('renders nothing when timeline is undefined', () => {
    const { container } = render(<ProbabilityTimeline timeline={undefined} />)
    expect(container.querySelector('svg')).toBeFalsy()
  })

  it('renders correct number of data dots', () => {
    const { container } = render(<ProbabilityTimeline timeline={SAMPLE_TIMELINE} />)
    const dots = container.querySelectorAll('circle[data-idx]')
    expect(dots.length).toBe(SAMPLE_TIMELINE.length)
  })

  it('renders model switch annotation line', () => {
    const { container } = render(<ProbabilityTimeline timeline={SAMPLE_TIMELINE} />)
    const lines = container.querySelectorAll('line')
    const dashedLines = Array.from(lines).filter(l => l.getAttribute('stroke-dasharray'))
    expect(dashedLines.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test -- --run src/components/ProbabilityTimeline.test.jsx`
Expected: FAIL — module not found (component doesn't exist yet)

- [ ] **Step 4: Implement `ProbabilityTimeline.jsx`**

Create `src/components/ProbabilityTimeline.jsx`:

```jsx
import React, { useState, useRef } from 'react'

const SUBMISSION_DEADLINE = '2026-02-15'

// Chart layout constants
const MARGIN = { top: 30, right: 20, bottom: 50, left: 55 }
const CHART_WIDTH = 844
const CHART_HEIGHT = 280
const PLOT_W = CHART_WIDTH - MARGIN.left - MARGIN.right
const PLOT_H = CHART_HEIGHT - MARGIN.top - MARGIN.bottom

function formatDate(isoDate) {
  const d = new Date(isoDate + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function xScale(timeline, dateStr) {
  if (timeline.length <= 1) return MARGIN.left
  const dates = timeline.map(e => new Date(e.date + 'T12:00:00').getTime())
  const min = dates[0]
  const max = dates[dates.length - 1]
  const t = new Date(dateStr + 'T12:00:00').getTime()
  if (max === min) return MARGIN.left
  return MARGIN.left + ((t - min) / (max - min)) * PLOT_W
}

function yScale(pQualify) {
  return MARGIN.top + PLOT_H * (1 - pQualify)
}

function buildXTicks(timeline) {
  if (timeline.length === 0) return []
  const first = timeline[0].date
  const last = timeline[timeline.length - 1].date

  // Anchor labels: first, deadline, last
  const anchors = [first]
  // Find closest snapshot to Feb 15
  const deadlineEntry = timeline.find(e => e.date >= SUBMISSION_DEADLINE)
  const deadlineDate = deadlineEntry ? deadlineEntry.date : SUBMISSION_DEADLINE
  if (deadlineDate !== first && deadlineDate !== last) {
    anchors.push(deadlineDate)
  }
  if (last !== first) anchors.push(last)

  // Add up to 4 evenly spaced ticks
  const allDates = timeline.map(e => e.date)
  const step = Math.max(1, Math.floor(timeline.length / 5))
  const candidates = []
  for (let i = step; i < timeline.length - 1; i += step) {
    candidates.push(allDates[i])
  }

  const ticks = [...anchors]
  const MIN_PX = 50
  for (const c of candidates) {
    const cx = xScale(timeline, c)
    const tooClose = ticks.some(t => Math.abs(xScale(timeline, t) - cx) < MIN_PX)
    if (!tooClose && ticks.length < 7) {
      ticks.push(c)
    }
  }

  return ticks.sort()
}

export default function ProbabilityTimeline({ timeline }) {
  const [hovered, setHovered] = useState(null)
  const [modelHovered, setModelHovered] = useState(false)
  const cardRef = useRef(null)

  if (!timeline || timeline.length === 0) return null

  const firstSurvivalIdx = timeline.findIndex(e => e.modelMode === 'survival')
  const deadlineX = firstSurvivalIdx >= 0
    ? xScale(timeline, timeline[firstSurvivalIdx].date)
    : xScale(timeline, SUBMISSION_DEADLINE)

  const gridLines = [0, 0.25, 0.5, 0.75, 1.0]
  const xTicks = buildXTicks(timeline)

  // Build path
  const points = timeline.map((e, i) => ({
    x: xScale(timeline, e.date),
    y: yScale(e.pQualify),
    ...e,
    idx: i,
  }))

  // Split into growth/survival segments for the connecting line
  const growthPts = points.filter(p => p.modelMode === 'growth')
  const survivalPts = points.filter(p => p.modelMode === 'survival')

  const pathD = pts => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')

  // Bridge line from last growth to first survival
  const bridgePts = []
  if (growthPts.length > 0 && survivalPts.length > 0) {
    bridgePts.push(growthPts[growthPts.length - 1])
    bridgePts.push(survivalPts[0])
  }

  return (
    <div ref={cardRef} style={{
      background: '#0d1530',
      border: '1px solid #1e2a4a',
      borderRadius: 10,
      padding: '24px 28px',
      position: 'relative',
    }}>
      <div style={{
        fontSize: 13,
        fontWeight: 'bold',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#8899bb',
        marginBottom: 20,
      }}>
        Probability Over Time
      </div>

      {/* Dot hover tooltip — positioned via SVG viewBox ratio */}
      {hovered !== null && (() => {
        // Convert SVG viewBox coords to percentage-based positioning
        const xPct = (points[hovered].x / CHART_WIDTH) * 100
        const yPct = (points[hovered].y / CHART_HEIGHT) * 100
        return (
        <div style={{
          position: 'absolute',
          left: `${xPct}%`,
          top: `${yPct}%`,
          background: '#1a2444',
          border: '1px solid #2a3a5a',
          borderRadius: 6,
          padding: '8px 12px',
          fontSize: 12,
          color: '#c8d6e5',
          pointerEvents: 'none',
          zIndex: 10,
          whiteSpace: 'nowrap',
          transform: 'translate(-50%, calc(-100% - 12px))',
        }}>
          <div style={{ color: '#8899bb', fontSize: 11 }}>{formatDate(points[hovered].date)}</div>
          <div style={{ fontSize: 16, fontWeight: 'bold', color: '#4a9eff', margin: '2px 0' }}>
            {(points[hovered].pQualify * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: 10, color: '#556688', marginBottom: 2 }}>
            {points[hovered].modelMode === 'growth' ? 'Growth Model' : 'Survival Model'}
          </div>
          {points[hovered].delta !== null && (
            <div style={{
              color: points[hovered].delta > 0 ? '#4caf50' : points[hovered].delta < 0 ? '#ef5350' : '#8899bb',
              fontSize: 12,
            }}>
              {points[hovered].delta > 0 ? '↑' : points[hovered].delta < 0 ? '↓' : '→'}
              {' '}{points[hovered].delta > 0 ? '+' : ''}
              {(points[hovered].delta * 100).toFixed(1)}% from prior
            </div>
          )}
        </div>
        )
      })()}

      {/* Model switch tooltip */}
      {modelHovered && (() => {
        const dxPct = (deadlineX / CHART_WIDTH) * 100
        return (
        <div style={{
          position: 'absolute',
          left: `calc(${dxPct}% - 150px)`,
          bottom: 10,
          background: '#1a2444',
          border: '1px solid #ff9800',
          borderRadius: 6,
          padding: '12px 16px',
          fontSize: 12,
          color: '#c8d6e5',
          pointerEvents: 'none',
          zIndex: 20,
          width: 300,
          lineHeight: 1.5,
        }}>
          <strong style={{ color: '#ff9800', display: 'block', marginBottom: 6 }}>
            Model Switch — Feb 15, 2026
          </strong>
          Before: estimated odds based on signature collection{' '}
          <em style={{ color: '#ffb74d' }}>trajectory</em>. After: all signatures
          submitted — model now tracks whether verified counts will{' '}
          <em style={{ color: '#ffb74d' }}>survive</em> clerk review.
        </div>
        )
      })()}

      <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Grid lines */}
        {gridLines.map(v => (
          <g key={v}>
            <line
              x1={MARGIN.left} y1={yScale(v)}
              x2={CHART_WIDTH - MARGIN.right} y2={yScale(v)}
              stroke="#1e2a4a" strokeWidth={0.5}
            />
            <text
              x={MARGIN.left - 8} y={yScale(v) + 4}
              fill="#8899bb" fontSize={10} textAnchor="end" fontFamily="Georgia"
            >
              {Math.round(v * 100)}%
            </text>
          </g>
        ))}

        {/* Model switch dashed line */}
        {firstSurvivalIdx >= 0 && (
          <>
            <line
              x1={deadlineX} y1={MARGIN.top - 5}
              x2={deadlineX} y2={MARGIN.top + PLOT_H}
              stroke="#ff9800" strokeWidth={1} strokeDasharray="5,4"
            />
            {/* Hover zone */}
            <rect
              x={deadlineX - 60} y={MARGIN.top - 5}
              width={140} height={PLOT_H + 5}
              fill="transparent" style={{ cursor: 'help' }}
              onMouseEnter={() => setModelHovered(true)}
              onMouseLeave={() => setModelHovered(false)}
            />
            <text
              x={deadlineX + 6} y={MARGIN.top + 6}
              fill="#ff9800" fontSize={10} fontFamily="Georgia"
            >
              Feb 15 · Model Switch
            </text>
          </>
        )}

        {/* Phase labels */}
        {firstSurvivalIdx >= 0 && growthPts.length > 0 && (
          <text
            x={(MARGIN.left + deadlineX) / 2}
            y={MARGIN.top + PLOT_H + 28}
            fill="#556688" fontSize={9} fontFamily="Georgia"
            textAnchor="middle" fontStyle="italic"
          >
            Growth Model
          </text>
        )}
        {firstSurvivalIdx >= 0 && (
          <text
            x={(deadlineX + CHART_WIDTH - MARGIN.right) / 2}
            y={MARGIN.top + PLOT_H + 28}
            fill="#556688" fontSize={9} fontFamily="Georgia"
            textAnchor="middle" fontStyle="italic"
          >
            Survival Model
          </text>
        )}

        {/* Connecting lines */}
        {growthPts.length >= 2 && (
          <path d={pathD(growthPts)} fill="none" stroke="#4a9eff" strokeWidth={1.5} strokeOpacity={0.4} />
        )}
        {bridgePts.length === 2 && (
          <path d={pathD(bridgePts)} fill="none" stroke="#4a9eff" strokeWidth={1.5} strokeOpacity={0.3} />
        )}
        {survivalPts.length >= 2 && (
          <path d={pathD(survivalPts)} fill="none" stroke="#4a9eff" strokeWidth={1.5} strokeOpacity={0.4} />
        )}

        {/* Data dots */}
        {points.map((p, i) => {
          const isModelSwitch = i === firstSurvivalIdx
          const isHovered = hovered === i
          const baseR = isModelSwitch ? 6 : 5
          const r = isHovered ? baseR + 2 : baseR

          return (
            <circle
              key={i}
              data-idx={i}
              cx={p.x} cy={p.y} r={r}
              fill={isModelSwitch ? '#ff9800' : '#4a9eff'}
              stroke="#0d1530" strokeWidth={2}
              style={{ cursor: 'pointer', transition: 'r 0.1s' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            />
          )
        })}

        {/* X-axis ticks */}
        {xTicks.map(d => {
          const x = xScale(timeline, d)
          const isDeadline = d === (timeline[firstSurvivalIdx]?.date || SUBMISSION_DEADLINE)
          return (
            <text
              key={d}
              x={x}
              y={MARGIN.top + PLOT_H + 16}
              fill={isDeadline ? '#ff9800' : '#8899bb'}
              fontSize={9}
              fontFamily="Georgia"
              textAnchor="middle"
              fontWeight={isDeadline ? 'bold' : 'normal'}
            >
              {formatDate(d)}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -- --run src/components/ProbabilityTimeline.test.jsx`
Expected: All 5 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/ProbabilityTimeline.jsx src/components/ProbabilityTimeline.test.jsx
git commit -m "Add ProbabilityTimeline component

Dot-emphasis SVG line chart showing overall qualification probability
across all historical snapshots. Includes model switch annotation,
hover tooltips with day-over-day deltas, and responsive scaling."
```

---

### Task 5: Integrate into App.jsx and verify

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Import the component**

Add to the imports at the top of `src/App.jsx`:

```jsx
import ProbabilityTimeline from './components/ProbabilityTimeline.jsx'
```

- [ ] **Step 2: Render between StatCards and VelocityTracker**

In `src/App.jsx`, after the StatCards section (line ~542) and before the VelocityTracker section (line ~544), add:

```jsx
            {data.probabilityTimeline && data.probabilityTimeline.length > 0 && (
              <div style={STYLES.section}>
                <ProbabilityTimeline timeline={data.probabilityTimeline} />
              </div>
            )}
```

- [ ] **Step 3: Run the full test suite**

Run:
```bash
.venv/bin/python -m unittest discover -s tests -p "test_*.py"
npm run check
```

Expected: All Python tests pass, lint passes, Vitest passes, build succeeds.

- [ ] **Step 4: Start dev server and visually verify**

Run: `npm run dev`

Open http://localhost:5173 and verify:
- Chart appears between StatCards and VelocityTracker
- 29 dots are visible spanning Jan 16 to Mar 16
- Dashed orange line at Feb 15 with "Model Switch" label
- Hover on dots shows tooltip with date, probability, model mode
- Post-Feb 15 dots show delta in tooltip
- Hover on model switch area shows explainer tooltip
- Chart scales responsively on window resize

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "Integrate ProbabilityTimeline into dashboard

Renders between StatCards and VelocityTracker. Gracefully
hidden when timeline data is absent."
```

---

### Task 6: Final validation and milestone commit

- [ ] **Step 1: Run the complete validation sequence**

```bash
.venv/bin/python scripts/replay.py
.venv/bin/python scripts/process.py
.venv/bin/python -m unittest discover -s tests -p "test_*.py"
npm run check
.venv/bin/python scripts/backtest.py
```

All must pass.

- [ ] **Step 2: Verify last timeline entry matches live probability**

```bash
.venv/bin/python -c "
import json
d = json.load(open('public/data.json'))
tl = d['probabilityTimeline']
live = d['overall']['pDistrictRule']
last = tl[-1]['pQualify']
print(f'Timeline last: {last}')
print(f'Live pDistrictRule: {live}')
diff = abs(last - live)
print(f'Diff: {diff}')
assert diff < 0.005, f'Mismatch! {diff}'
print('MATCH OK')
"
```

- [ ] **Step 3: Update CHANGELOG.md**

Add under `[Unreleased]`:

```markdown
### Added
- Probability Over Time chart showing how overall qualification probability has changed across all historical snapshots
- Model switch annotation at Feb 15 deadline with hover explainer
- Day-over-day probability deltas for post-deadline survival phase
```

- [ ] **Step 4: Commit everything**

```bash
git add CHANGELOG.md
git commit -m "Add Probability Over Time chart to dashboard

New chart between StatCards and VelocityTracker shows how the
overall ballot qualification probability has evolved across all
29 historical snapshots (Jan 16 - Mar 16). Features dot-emphasis
line style, Feb 15 model switch annotation with hover explainer,
and day-over-day deltas for the post-deadline survival phase.

Pipeline: process.py now backfills probabilities for every
snapshot using cumulative state replay with the same model
logic as the live computation."
```
