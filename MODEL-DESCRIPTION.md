# Model Description — deadreckoning.t8rsk8s.io

*Utah Proposition 4 Repeal Initiative — District Probability Analysis*

---

## What this tracker does

This site estimates the probability that the Proposition 4 repeal initiative qualifies for the November 2026 ballot. It does not advocate for or against the petition. It does not modify, adjust, or editorialize the underlying data. It reads the official Lt. Governor's signature count file, runs a probability model over it, and publishes the result.

The source of truth is the xlsx file published daily at [vote.utah.gov](https://vote.utah.gov/repeal-of-the-independent-redistricting-commission-and-standards-act-direct-initiative-list-of-signers/). Every number on this site flows directly from that file. No counts are altered, smoothed, or hand-tuned.

---

## Qualification rules

To reach the November ballot, the petition must satisfy **both** of the following conditions simultaneously:

1. **Statewide total:** at least **140,748 verified signatures** across all 29 Senate districts.
2. **District threshold:** at least **8% of registered voters** (as of the most recent election) must be verified signers in **at least 26 of the 29** Senate districts.

Failing the district requirement in even one of the required 26 disqualifies the entire initiative, regardless of the statewide total. This is the binding constraint — it's much harder to satisfy than the raw signature count alone.

Per-district thresholds range from 2,975 (District 10) to 5,715 (District 19), derived from the 8% rule applied to each district's registered voter count as revised by the Lt. Governor's office.

**Key dates:**
- Signature submission deadline: February 15, 2026 (passed)
- County clerk verification deadline: March 9, 2026
- Election date (if qualified): November 3, 2026

---

## Data pipeline

```
vote.utah.gov (xlsx) → scraper.py (fetch) → replay.py (history) → process.py (model) → public/data.json → React UI
```

1. **Fetch:** A GitHub Actions workflow runs daily at 17:00 UTC and downloads the latest xlsx from the Lt. Governor's site. The file is also triggered on manual dispatch and on push to `data/manual/`.

2. **Parse:** `process.py` reads the xlsx row by row, extracting each signer's Senate district and verification date. It counts verified signatures per district and cross-references against the known per-district thresholds.

3. **History:** `replay.py` rebuilds `data/history.json` from all snapshots in `data/snapshots/`. This accumulates one record per business day and enables the model to compute real inter-snapshot velocity, per-district removal rates, post-deadline trajectory, and anomaly records — none of which are recoverable from a single point-in-time xlsx.

4. **Model:** The probability model runs entirely in Python, producing a `data.json` that the React frontend reads. No server-side computation happens at page load.

5. **Publish:** `data.json` is committed to the repository and served as a static file via Azure Static Web Apps.

---

## Two model modes

The model has two operating modes, selected automatically based on whether the submission deadline has passed.

### Growth Model (pre-February 15)

Before the submission deadline, the question was: *at the current trajectory, will enough districts reach their threshold by February 15?*

Each district's probability was computed from:

- **Current verified count** relative to its threshold (base score, weight 45%)
- **Linear trajectory projection** to the submission deadline (weight 35%), using history-weighted velocity. Recent intervals are weighted with exponential decay (factor 0.75) so late-campaign momentum is captured without discarding older trend data.
- **Trend-adjusted base score** (weight 20%), applying a multiplier from the trend classification: ACCEL ×1.08, STABLE ×1.00, DECEL ×0.90.
- **Rejection penalty** derived from the observed rate at which previously-counted signatures disappeared between snapshots.
- **Structural feasibility gate:** if the projected total at deadline is below 65% of threshold, the probability is capped near zero regardless of trend, since the gap is mathematically too large to close.

### Survival Model (post-February 15, currently active)

After the submission deadline, no new signatures can be added. The question becomes: *will the current verified count survive county clerk review through March 9?*

For districts **at or above threshold**, survival probability is near 1.0, reduced slightly when:
- The buffer above threshold is thin (< 10%), and
- The Bayesian-blended removal rate suggests removals could breach the threshold.

For districts **below threshold**, the model uses a gap-based table as a starting point, then applies adjustments for trajectory and removal rate:

| Gap below threshold | Base P(survive) |
|---|---|
| ≤ 2% | 18% |
| ≤ 5% | 10% |
| ≤ 10% | 5% |
| ≤ 15% | 2% |
| ≤ 25% | 0.5% |
| > 25% | 0% |

Two adjustments are then applied to the base probability:

**Trajectory multiplier:** Districts that were accelerating strongly just before the February 15 deadline are more likely to have signatures still in the LG posting pipeline. The base probability is boosted proportionally to the pre-deadline velocity (sigs/day in the last pre-deadline interval), decaying to zero over 10 days post-deadline.

**Removal rate penalty:** If the posterior removal-rate estimate exceeds 3%, the base probability is nudged downward, reflecting that this district is under heavier-than-average clerk scrutiny.

---

## Bayesian removal rate prior

The model does not use the raw observed post-deadline removal rate directly. Early clerk-review data is sparse, so tiny sample sizes can produce misleading 0% or 10% readings. Instead, the model uses a simple Beta-style pseudo-count prior:

- **Prior mean:** 1.65% statewide removal rate
- **Prior strength:** 2,000 pseudo-signatures

For each district, the posterior estimate is:

```
posterior_rate = (prior_mean * prior_strength + observed_removed) /
                 (prior_strength + peak_verified)
```

`peak_verified` is used as the district's exposure term, so credibility now grows with actual observed scale instead of just elapsed calendar days. This keeps the estimate stable when clerk removals are still sparse while allowing larger districts with more evidence to move away from the prior sooner.

---

## LG posting lag

After the February 15 submission deadline, the Lt. Governor's office continued posting signatures that were submitted before the cutoff but not yet processed. Empirically, 22,934 net signature additions appeared in the LG data between February 16 and February 20 — a 25.8% gain relative to the pre-deadline total of 88,948. This confirmed a substantial and extended posting backlog.

The model handles this with a **14-day lag window** (extended from an initial 7-day estimate based on the observed data). During this window, each district's effective verified count is blended between the actual LG count and the pre-deadline linear projection, weighted by how much of the window remains.

Additionally, the model checks empirically whether the LG lag has resolved. The old version used only a statewide switch; the current version first looks for district-level post-deadline gains relative to that district's last pre-deadline count, then falls back to the statewide signal if the district evidence is too thin. If the fixed window expires but the data still shows meaningful lag, a small floor lag weight is maintained.

Once ≥ 2 post-deadline snapshots are available for a district, the model switches from lag-blended projections to **observed post-deadline velocity** — the actual sigs/day rate seen in post-deadline intervals. This velocity is projected forward to March 9 as the district's effective count, clipped to the pre-deadline projection as an upper bound.

---

## Trend classification

Each district is classified as ACCEL, STABLE, or DECEL based on its velocity history. The model fits a **linear regression over the full velocity series** (per-day rates for each inter-snapshot interval), then checks whether the slope is meaningful:

```python
relative_slope = regression_slope / mean_abs_rate
if relative_slope >= 0.10:  return "ACCEL"
if relative_slope <= -0.10: return "DECEL"
else:                        return "STABLE"
```

The 10% normalized slope threshold prevents single-interval noise from triggering false ACCEL/DECEL signals — a common failure mode when the sample size is small (5–10 intervals). Only a sustained, statistically meaningful acceleration or deceleration pattern changes the classification.

---

## Anomaly detection and feedback

The model flags unusual single-interval drops (≥ 2% of a district's previous count disappearing between consecutive snapshots). These are consistent with packet-level rejection by county clerks — an entire submission packet from a fraud-flagged gatherer being discarded — rather than routine gradual corrections.

Flagged districts receive a **+1 percentage point bump** to their effective rejection rate (capped at 5%), so the survival model treats them as facing modestly elevated removal risk going forward. Anomalies are also surfaced in the UI with a warning banner.

---

## Per-district probability inputs

For each of the 29 districts, the survival model receives:

| Input | Source |
|---|---|
| `verified` | Direct count from the current LG xlsx |
| `threshold` | Fixed per-district value (8% of registered voters) |
| `effective_verified` | Blended count: observed post-deadline velocity projection, or lag-blended growth projection, or raw verified |
| `post_deadline_velocity` | Observed sigs/day rate in post-deadline intervals (when ≥2 available) |
| `pre_deadline_slope` | Sigs/day rate in last pre-deadline interval (for trajectory multiplier) |
| `post_deadline_removed` | Count of voter-ID removals observed after February 15 for this district |
| `rejection_rate` | Full-history removal rate; bumped +1pp for anomaly-flagged districts |
| `peak_verified` | Highest count ever recorded for this district |
| `days_remaining` | Days until March 9 clerk deadline |

---

## District-rule probability

Each district's probability is first computed independently. The model then applies two corrections before computing the probability that the petition clears the **district rule**:

- at least 26 of 29 districts reach threshold

This is the exported `overall.pDistrictRule` value in `public/data.json`. For backwards compatibility the same value is also written to `overall.pQualify`.

The app now also exports `overall.pBallotQualified`, which combines the district rule with the statewide signature threshold:

- if the statewide threshold is already met, `pBallotQualified = pDistrictRule`
- otherwise, `pBallotQualified = pDistrictRule × pReachTarget`

That second case is explicitly labeled as an **independence approximation** in the JSON/UI via `overall.probabilityScope`. It is more honest than showing only the district-rule probability, but it is still not a full dependence model.

### 1. Exact DP distribution

We use **dynamic programming** over all 29 district probabilities to compute the complete distribution: `P(exactly k districts qualify)` for k = 0 through 29. The district-rule probability is the sum of `P(k ≥ 26)`.

```python
dp = [0.0] * (n + 1)
dp[0] = 1.0
for p in district_probs:
    new_dp = [0.0] * (n + 1)
    for k in range(n + 1):
        new_dp[k + 1] += dp[k] * p       # this district qualifies
        new_dp[k]     += dp[k] * (1 - p)  # this district does not
    dp = new_dp

p_qualify_raw = sum(dp[26:])
```

### 2. Correlation penalty

The DP assumes independent districts — whether D5 qualifies has no bearing on D22. In practice, districts share exposure to statewide risks: a fraud wave, a broad clerk ruling, or a coordinated removal campaign can affect many districts simultaneously. County removal-request data (February 2026) showed concentrated fraud risk in specific high-population counties (Salt Lake, Utah, Weber) that span multiple districts, consistent with meaningful inter-district correlation.

To account for this, a **3% correlation deflator** is applied to the raw DP result:

```python
p_qualify = max(0.0, p_qualify_raw - 0.030 * p_qualify_raw)
```

This reduces P(qualify) by approximately 3 pp at p = 1.0, scaling proportionally with the raw probability. It represents a conservative estimate of the systematic risk that the independence assumption ignores.

---

## Tier classification

Each district is assigned a human-readable tier label based on its probability:

| Tier | Condition |
|---|---|
| CONFIRMED | Verified count ≥ threshold |
| NEARLY CERTAIN | prob ≥ 90% |
| VERY LIKELY | prob ≥ 70% |
| LIKELY | prob ≥ 50% |
| POSSIBLE | prob ≥ 25% |
| UNLIKELY | prob ≥ 10% |
| NO CHANCE | prob < 10% |

**Floor rules:** Because the survival model can produce very low probabilities for districts that have collected significant real signatures, two floors apply:

- Any district with ≥ 80% of its threshold already verified is shown as at least **LIKELY**, regardless of model probability.
- Any district with ≥ 60% of its threshold already verified is shown as at least **POSSIBLE**, regardless of model probability.

These floors reflect a simple reality: a district that already has 75% of the signatures it needs is not categorically hopeless, even if the model's survival odds are low. The floors are transparent and the underlying probability is still visible in the district table.

---

## Confidence score

The site displays a **confidence score** (0–100%) on the District Rule Probability card. It answers: *"How much should you trust the number you're seeing right now?"* — not whether the petition will qualify, but how reliable the model's current estimate is given the data available.

The current implementation uses **two** axes, multiplied together:

### 1. Data maturity

How much evidence the model has accumulated.

- **Pre-deadline:** `min(snapshot_count / 22, 1.0)` — where 22 is the estimated number of business-day snapshots from the campaign start through the February 15 submission deadline.
- **Post-deadline:** Blends snapshot maturity (60%) with clerk-window progress (40%) through the March 9 clerk deadline. As more daily updates arrive during clerk review, this component rises from 0% toward 100%.

Early in the clerk review window, data maturity is typically the primary drag on the overall score, because the pseudo-count removal prior still dominates observed clerk actions.

### 2. Model sharpness

How narrow the DP probability distribution is, measured by its standard deviation:

```
model_sharpness = max(0.0, 1 − std(pExact) / 5.0)
```

A tight spike in the distribution (most probability mass concentrated at one or two values of k) means the model's internal math is producing a clean, consistent answer. A wide spread means outcomes are genuinely dispersed and the headline probability is masking meaningful variance. A standard deviation of 5+ (roughly what a 50/50 binomial over 29 districts would produce) maps to 0% sharpness.

### Composite score

```
confidence = data_maturity × model_sharpness
```

The model deliberately does **not** include an additional "outcome certainty" multiplier based on distance from 26 districts. The probability itself already communicates threshold proximity, and penalizing close-call scenarios again in the confidence score made the UI read artificially low precisely when the model was providing its most useful answer.

The result is labeled:

| Score | Label |
|---|---|
| ≥ 85% | Very High |
| ≥ 65% | High |
| ≥ 40% | Moderate |
| ≥ 20% | Low |
| < 20% | Very Low |

The UI also generates a plain-English explanation of which axis is the current limiting factor, updated automatically on each data refresh. The component values are available in `overall.confidenceComponents` in `data.json` for independent inspection.

---

## What the model does not do

- **It does not adjust or edit signature counts.** Every count shown comes directly from the LG xlsx.
- **It does not weight districts differently based on politics, geography, or campaign activity.** All 29 districts are treated identically under the same model rules.
- **It does not predict fraud.** The anomaly detection flags statistically unusual drops; it does not make legal or criminal determinations.
- **It does not have access to pending-but-unsubmitted signatures.** Only LG-verified counts are used.
- **It does not backfill or interpolate missing days.** If the LG doesn't post on a given business day, the model runs on the previous data unchanged.

---

## Why probabilities change between updates

The model runs automatically each time new LG data is posted — typically once per business day (Monday–Friday). Probabilities shift when:

- Verified signature counts increase (new batch posted by county clerks or LG posting backlog resolves)
- Verified counts decrease (clerk removals recorded in the LG file)
- Post-deadline velocity data accumulates (each new snapshot updates the per-district sigs/day rate and projection)
- The posterior removal-rate estimate updates as more district-specific removal evidence arrives
- The LG lag blend advances (closer to March 9, the model weights post-deadline observations more heavily)

**These changes are the model reacting to new evidence.** No numbers are manually adjusted.

The complete source code for the model is available at [github.com/swharr/deadreckoning](https://github.com/swharr/deadreckoning) for independent review.

---

## Updates

On February 26, 2026, a pipeline bug in `scripts/process.py` was fixed so anomaly-based rejection-rate adjustments (the +1 percentage point penalty for districts flagged by historical packet-level anomalies, capped at 5%) are applied **before** district probabilities are calculated instead of after. Previously, the anomaly bump only changed the exported `rejectionRate` shown in the UI/JSON and did not affect `prob`, `pDistrictRule` / `pQualify`, or the DP distribution, which made the anomaly logic effectively cosmetic. This change makes the model internally consistent with the methodology, so anomaly risk now influences probability outputs as intended. Re-running the model on the February 25, 2026 snapshot produced small but real probability shifts (for example, the district-rule probability changed from `0.8149` to `0.8233`) without any source-data change.

On March 13, 2026, the pipeline was updated in three ways:

- `scripts/replay.py` now emits aggregate-only `data/removals.json` output and no longer writes raw voter names or voter IDs into committed artifacts.
- `scripts/process.py` now anchors deadline math to the snapshot's `asOfDate`, making repeated processing runs reproducible.
- The app now exports `overall.pBallotQualified` in addition to `overall.pDistrictRule`, with an explicit `probabilityScope` field indicating whether the ballot number is exact for the current state or an independence approximation.

---

*This is an independent tracker, not affiliated with any campaign, political party, or government entity.*
