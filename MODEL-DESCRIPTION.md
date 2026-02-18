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
- County clerk verification deadline: March 7, 2026
- Election date (if qualified): November 3, 2026

---

## Data pipeline

```
vote.utah.gov (xlsx) → scraper.py (fetch) → process.py (parse + model) → public/data.json → React UI
```

1. **Fetch:** A GitHub Actions workflow runs daily at 17:00 UTC and downloads the latest xlsx from the Lt. Governor's site. The file is also triggered on manual dispatch and on push to `data/manual/`.

2. **Parse:** `process.py` reads the xlsx row by row, extracting each signer's Senate district and verification date. It counts verified signatures per district and cross-references against the known per-district thresholds.

3. **History:** A `data/history.json` file accumulates one record per snapshot (one per business day). This enables the model to compute real inter-snapshot velocity, per-district removal rates, and trajectory slopes rather than relying on point-in-time counts alone.

4. **Model:** The probability model runs entirely in Python, producing a `data.json` that the React frontend reads. No server-side computation happens at page load.

5. **Publish:** `data.json` is committed to the repository and served as a static file via Azure Static Web Apps.

---

## Two model modes

The model has two operating modes, selected automatically based on whether the submission deadline has passed.

### Growth Model (pre-February 15)

Before the submission deadline, the question was: *at the current trajectory, will enough districts reach their threshold by February 15?*

Each district's probability was computed from:

- **Current verified count** relative to its threshold (base score)
- **Linear trajectory projection** to the submission deadline, using history-weighted velocity. Recent intervals are weighted 4× more than older ones to capture recent momentum changes.
- **Trend classification** (ACCEL / STABLE / DECEL) from the ratio of the last two inter-snapshot velocity intervals vs. the two prior intervals.
- **Rejection penalty** derived from the observed rate at which previously-counted signatures disappeared between snapshots (clerk removals, duplicate removal, etc.).
- **Structural feasibility gate:** if the projected total at deadline is below 65% of threshold, the probability is capped near zero regardless of trend, since the gap is mathematically too large to close.

### Survival Model (post-February 15, currently active)

After the submission deadline, no new signatures can be added. The question becomes: *will the current verified count survive county clerk review through March 7?*

For districts **at or above threshold**, survival probability is near 1.0, reduced slightly if the buffer above threshold is thin (< 10%) and the post-deadline removal rate is elevated.

For districts **below threshold**, the model uses a gap-based table: the larger the gap between current verified count and threshold, the lower the probability that late LG postings or count corrections can close it.

| Gap below threshold | Estimated P(survive) |
|---|---|
| ≤ 2% | 20% |
| ≤ 5% | 12% |
| ≤ 10% | 6% |
| ≤ 15% | 3% |
| ≤ 25% | 1% |
| > 25% | 0% |

**LG posting lag blend:** Immediately after the submission deadline, the Lt. Governor's office continues posting signatures that were submitted before the cutoff but not yet processed. To account for this, the model blends growth-model projections with survival-model probabilities over a 7-day window. On day 0, the blend is 60% growth / 40% survival. By day 7, it is 100% survival. This prevents districts that were projecting to 90%+ of threshold from immediately collapsing to 0% while the LG catches up on processing.

---

## Per-district probability inputs

For each of the 29 districts, the model receives:

| Input | Source |
|---|---|
| `verified` | Direct count from the current LG xlsx |
| `threshold` | Fixed per-district value (8% of registered voters) |
| `trend` | Computed from inter-snapshot velocity ratios in history.json |
| `final_week_sigs` | Total signatures added in the most recent 7-day window |
| `projected_total` | Linear extrapolation of velocity to the deadline, rejection-adjusted |
| `rejection_rate` | Observed fraction of signatures removed between snapshots (lifetime average) |
| `post_deadline_rate` | Observed removal rate since February 15 specifically |
| `peak_verified` | Highest count ever recorded for this district (used in survival model) |

---

## Overall ballot probability

Each district's probability is treated as **independent** (whether District 5 qualifies has no bearing on whether District 22 qualifies, given the same petition). This allows an exact calculation.

We use **dynamic programming** over all 29 district probabilities to compute the complete distribution: `P(exactly k districts qualify)` for k = 0 through 29. The overall ballot probability is the sum of `P(k ≥ 26)`.

```python
# Exact DP — O(n²) in the number of districts
dp = [0.0] * (n + 1)
dp[0] = 1.0
for p in district_probs:
    new_dp = [0.0] * (n + 1)
    for k in range(n + 1):
        new_dp[k + 1] += dp[k] * p       # this district qualifies
        new_dp[k]     += dp[k] * (1 - p)  # this district does not
    dp = new_dp

p_qualify = sum(dp[26:])  # P(≥26 districts meet threshold)
```

This accounts for every possible combination of which districts qualify — not just an average or approximation.

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

## Anomaly detection

The model flags unusual single-interval drops (≥ 2% of a district's current count disappearing between consecutive snapshots). These anomalies are surfaced in the UI with a banner and stored in `history.json`. They may indicate packet-level rejection by county clerks, not gradual clerk review attrition.

---

## What the model does not do

- **It does not adjust or edit signature counts.** Every count shown comes directly from the LG xlsx.
- **It does not weight districts differently based on politics, geography, or campaign activity.** All 29 districts are treated identically under the same model rules.
- **It does not predict fraud.** The fraud-scenario range shown in the UI (~12–18% probability under heavy rejection) is a hypothetical envelope, not a model output.
- **It does not have access to pending-but-unsubmitted signatures.** Only LG-verified counts are used.
- **It does not backfill or interpolate missing days.** If the LG doesn't post on a given business day, the model runs on the previous data unchanged.

---

## Why probabilities change between updates

The model runs automatically each time new LG data is posted — typically once per business day. Probabilities will shift when:

- Verified signature counts increase (new batch posted by county clerks)
- Verified counts decrease (clerk removals recorded in the LG file)
- The LG posting lag resolves (more post-deadline submissions appear)
- Days elapse and the lag blend shifts further toward the pure survival model

**These changes are the model reacting to new evidence.** No numbers are manually adjusted. The probability you see today will differ from tomorrow's if and only if the underlying LG data changes, or if the lag blend progresses by one day.

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
