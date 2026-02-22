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

**Removal rate penalty:** If the Bayesian-blended removal rate exceeds 3%, the base probability is nudged downward, reflecting that this district is under heavier-than-average clerk scrutiny.

---

## Bayesian removal rate prior

The model does not use raw observed post-deadline removal rates directly — early post-deadline data is too sparse to be credible. Instead, it blends the observed rate with an empirical prior:

**Prior: 1.65% statewide removal rate**, derived from county clerk removal-request data published by county clerks as of February 12, 2026: 2,325 documented removal requests out of approximately 141,000 verified signatures.

The blend transitions from prior-dominated (day 0 post-deadline) to observation-dominated (day 22, the end of the clerk review window):

```
effective_rate = (days_elapsed / 22) × observed_rate
              + (1 - days_elapsed / 22) × 0.0165
```

This prevents the model from treating 0% removal (observed when there are only 1–2 post-deadline snapshots) as reliable signal, while still updating as clerk review data accumulates.

---

## LG posting lag

After the February 15 submission deadline, the Lt. Governor's office continued posting signatures that were submitted before the cutoff but not yet processed. Empirically, 22,934 net signature additions appeared in the LG data between February 16 and February 20 — a 25.8% gain relative to the pre-deadline total of 88,948. This confirmed a substantial and extended posting backlog.

The model handles this with a **14-day lag window** (extended from an initial 7-day estimate based on the observed data). During this window, each district's effective verified count is blended between the actual LG count and the pre-deadline linear projection, weighted by how much of the window remains.

Additionally, the model checks empirically whether the LG lag has resolved: if net statewide additions after the deadline drop below 0.1% of the pre-deadline total, the lag weight is zeroed out regardless of the calendar window. If the fixed window expires but the data still shows substantial post-deadline gains, a floor lag weight of 0.10 is maintained.

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
| `post_deadline_rate` | Observed removal rate since February 15, Bayesian-blended with 1.65% prior |
| `rejection_rate` | Full-history removal rate; bumped +1pp for anomaly-flagged districts |
| `peak_verified` | Highest count ever recorded for this district |
| `days_remaining` | Days until March 9 clerk deadline |
| `days_post_deadline` | Days elapsed since February 15 (controls prior credibility) |

---

## Overall ballot probability

Each district's probability is first computed independently. The model then applies two corrections before computing the overall P(qualify):

### 1. Exact DP distribution

We use **dynamic programming** over all 29 district probabilities to compute the complete distribution: `P(exactly k districts qualify)` for k = 0 through 29. The overall ballot probability is the sum of `P(k ≥ 26)`.

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

The site displays a **confidence score** (0–100%) on the Ballot Probability card. It answers: *"How much should you trust the number you're seeing right now?"* — not whether the petition will qualify, but how reliable the model's current estimate is given the data available.

The score is a composite of three independent axes, multiplied together:

### 1. Data maturity

How much evidence the model has accumulated.

- **Pre-deadline:** `min(snapshot_count / 22, 1.0)` — where 22 is the estimated number of business-day snapshots from the campaign start through the February 15 submission deadline.
- **Post-deadline:** Blends snapshot maturity (60%) with clerk-window progress (40%) — `days_elapsed / 22` through the March 9 clerk deadline. As more daily updates arrive during clerk review, this component rises from 0% toward 100%.

Early in the clerk review window, data maturity is typically the primary drag on the overall score, because the Bayesian removal rate prior still dominates observed clerk actions.

### 2. Outcome certainty

How far `expectedDistricts` is from the 26-district qualification threshold.

```
outcome_certainty = tanh(|expectedDistricts − 26| / 2.5)
```

When `expectedDistricts` is far from 26 in either direction, the model is confident about the direction of the outcome — even if the precise probability estimate shifts. When `expectedDistricts` is near 26 (e.g., between 24 and 28), this is a genuine coin-flip territory and certainty drops toward zero.

The tanh function reaches ~0.92 at 3 districts away, ~0.99 at 5 districts away.

### 3. Model sharpness

How narrow the DP probability distribution is, measured by its standard deviation:

```
model_sharpness = max(0.0, 1 − std(pExact) / 5.0)
```

A tight spike in the distribution (most probability mass concentrated at one or two values of k) means the model's internal math is producing a clean, consistent answer. A wide spread means outcomes are genuinely dispersed and the headline probability is masking meaningful variance. A standard deviation of 5+ (roughly what a 50/50 binomial over 29 districts would produce) maps to 0% sharpness.

### Composite score

```
confidence = data_maturity × outcome_certainty × model_sharpness
```

All three are multiplied. A weakness in any one axis reduces the overall score proportionally. The result is labeled:

| Score | Label |
|---|---|
| ≥ 85% | Very High |
| ≥ 65% | High |
| ≥ 40% | Moderate |
| ≥ 20% | Low |
| < 20% | Very Low |

The UI also generates a plain-English explanation of which axis is the current limiting factor, updated automatically on each data refresh. The three component values are available in `overall.confidenceComponents` in `data.json` for independent inspection.

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
- The Bayesian removal rate prior fades (observed post-deadline data becomes more credible each day)
- The LG lag blend advances (closer to March 9, the model weights post-deadline observations more heavily)

**These changes are the model reacting to new evidence.** No numbers are manually adjusted.

The complete source code for the model is available at [github.com/swharr/deadreckoning](https://github.com/swharr/deadreckoning) for independent review.

---

## Name lookup — privacy model

The signature lookup tool allows users to check whether their name appears on the verified petition list. It is designed so that no name or query ever leaves the user's device.

**How it works:**

1. At build time, `process.py` constructs a per-district **bloom filter** for each of the 29 Senate districts. Each filter is an 8KB (65,536-bit) probabilistic set.
2. Each signer's name is normalized (`LASTNAME,FIRSTNAME`) and combined with their district number to form a district-scoped key: `LASTNAME,FIRSTNAME,D{n}`. This scoping ensures that a match in District 3's filter cannot occur when querying District 22's filter.
3. Keys are hashed using SHA-256 with double hashing (`h_i(x) = (h1 + i·h2) mod m`, 7 hash functions) and the corresponding bits are set in the filter.
4. The full set of 29 filters is serialized as base64 and stored in `public/lookup.json` (~310KB, compared to ~1.9MB for a plain hash set).
5. In the browser, the user's name and district are hashed identically using the Web Crypto API (`crypto.subtle.digest`). The resulting bit positions are checked against the downloaded filter — entirely client-side.

**False positives:** Bloom filters can return false positives (saying a name is present when it isn't). At 8KB per district and ~3,000–8,000 entries, the false-positive rate is approximately 0.3%. False negatives (saying a name is absent when it's actually there) are impossible by design.

**Privacy:** The lookup file contains only hashed bit positions — no names, no addresses, no identifying information. SHA-256 is a one-way function; the filter cannot be reverse-engineered to recover signer names. No analytics, logging, or server request is made when a lookup is performed.

---

*This is an independent tracker, not affiliated with any campaign, political party, or government entity.*
