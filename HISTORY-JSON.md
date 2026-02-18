# history.json — Schema and Update Logic

`data/history.json` is the model's long-term memory. It accumulates one record per official Lt. Governor snapshot (typically one per business day) and provides the probability model in `process.py` with everything it cannot derive from a single point-in-time xlsx file: real inter-snapshot velocity, per-district removal rates, trajectory projections, and anomaly records.

This file is **never committed to the repository** (it lives in `data/`, which is gitignored). It is rebuilt from scratch by running `replay.py` against the full `data/snapshots/` archive whenever needed.

---

## How it gets built

### Step 1 — Snapshot archive

Each daily xlsx downloaded from [vote.utah.gov](https://vote.utah.gov) is saved to `data/snapshots/YYYY-MM-DD.xlsx` using the date the Lt. Governor published it. The filename is the only record of when the data was current.

```
data/snapshots/
  2026-01-15.xlsx
  2026-01-16.xlsx
  ...
  2026-02-18.xlsx
```

`scraper.py` handles the daily fetch and file placement. The GitHub Actions workflow runs this daily at 17:00 UTC.

### Step 2 — replay.py

`replay.py` reads every `YYYY-MM-DD.xlsx` in `data/snapshots/`, sorted chronologically, and produces `data/history.json`.

```bash
.venv/bin/python scripts/replay.py
```

It runs automatically as part of the daily CI pipeline after `scraper.py`. You can also run it manually to backfill history after adding new snapshot files by hand.

### Step 3 — process.py consumes history.json

When `process.py` runs, it checks for `data/history.json`. If present, it uses the richer history-based inputs. If absent (first run, or history was deleted), it falls back to intra-file date bucketing from the single xlsx.

---

## What replay.py computes

### Per-snapshot records

For each `YYYY-MM-DD.xlsx`, replay.py records:

| Field | Description |
|---|---|
| `date` | ISO date string matching the filename |
| `total` | Statewide verified count |
| `districts` | `{"1": count, "2": count, ...}` for all 29 districts |
| `deltas` | Net gains per district vs prior snapshot (`max(0, diff)`) |
| `removals` | Net losses per district vs prior snapshot (`max(0, -diff)`) |
| `net` | Raw signed diff per district (can be negative) |
| `totalDelta` | Statewide total change vs prior snapshot |
| `totalRemovals` | Sum of all district-level net losses |

Note: `deltas` and `removals` are derived from the **net** change between snapshots. If a district adds 200 signatures and loses 50 in the same interval, the xlsx only shows a net +150. True gross additions cannot be separated from simultaneous removals — only the net is observable.

### Inter-snapshot velocity

`dailyVelocity` is computed from the last interval only (most recent two snapshots), normalized per day. This is fed to the probability model as the current momentum signal.

### Rejection / removal rates

Two rates are computed per district:

**Full-history rejection rate** (`rejectionRates`):
```
rejection_rate = total_removals / peak_verified
```
Total removals = sum of all inter-snapshot net declines across the entire history. Peak = highest count ever recorded for that district. This is a lifetime signal — it measures how much churn the district has experienced across the whole campaign.

**Post-deadline removal rate** (`postDeadlineRemovalRates`):
```
post_deadline_rate = total_removals_since_feb15 / peak_post_deadline
```
Only snapshots after February 15, 2026 (the submission deadline) are used. These intervals are "pure" — no new signatures can be added, so any decrease is definitively a clerk-review removal. This is the cleaner signal for the survival model.

### Weighted linear projection

For each district, `replay.py` runs a weighted least-squares linear regression over all `(date, count)` pairs, projecting to the March 7 clerk deadline:

```python
# Exponential weights: most recent = 1.0, oldest = 0.75^(n-1)
decay = 0.75
weights = [decay ** (n - 1 - i) for i in range(n)]
```

This gives recent snapshots ~4× more influence than the oldest ones, so a late-campaign surge doesn't get averaged away. The projection is then haircut by the district's full-history rejection rate:

```
projection_adjusted = projection_raw * (1 - rejection_rate)
```

The floor is always the most recent observed count — the projection never goes backwards.

### Peak verified

`peakVerified` records the highest count ever seen for each district across all snapshots. Used in the survival model to estimate the maximum possible removals remaining.

### Anomaly detection

`replay.py` scans every inter-snapshot interval for districts that lose ≥ 2% of their previous count in a single step:

```python
if drop > 0 and drop_pct >= 0.02:
    # Flag as anomaly
```

These are stored in `anomalies[]` and surfaced in the UI as a warning banner. A 2%+ single-interval drop is consistent with county clerks rejecting an entire submission packet (e.g., from a gatherer found to have collected fraudulent signatures) rather than routine signature-by-signature corrections, which tend to be small and gradual.

---

## Schema reference

```jsonc
{
  "generated": "2026-02-18T17:05:22Z",     // UTC timestamp of last replay run
  "snapshotCount": 34,                       // number of xlsx files processed
  "firstSnapshot": "2026-01-15",
  "lastSnapshot": "2026-02-18",
  "daysToDeadline": 17,                      // days to March 7 clerk deadline
  "dailyVelocity": 1744.0,                  // sigs/day, last interval only
  "statewideRejectionRate": 0.0014,          // average removal rate across all districts

  "projections": {
    "statewideRaw": 98420.0,                 // linear extrapolation, no rejection haircut
    "statewideAdjusted": 98282.0,            // after rejection rate applied
    "byDistrict": {
      "1": {
        "raw": 5510.2,
        "rejectionAdjusted": 5502.5,
        "threshold": 5238,
        "pctOfThreshold": 1.0504            // >1.0 means projected to exceed threshold
      },
      // ... all 29 districts
    }
  },

  "rejectionRates": {
    "1": 0.0008,                             // 0.08% of peak removed, full history
    // ... all 29 districts
  },

  "postDeadlineRemovalRates": {
    "1": 0.0,                                // no post-deadline removals yet for D1
    // ... all 29 districts
  },

  "statewidePostDeadlineRate": 0.0,
  "postDeadlineDataAvailable": true,

  "peakVerified": {
    "1": 4502,                               // highest count ever seen for D1
    // ... all 29 districts
  },

  "anomalies": [
    {
      "date": "2026-02-10",
      "district": 14,
      "prevCount": 3120,
      "curCount": 2980,
      "drop": 140,
      "dropPct": 0.0449,
      "prevDate": "2026-02-09"
    }
  ],

  "snapshots": [
    {
      "date": "2026-01-15",
      "total": 41203,
      "districts": { "1": 2100, "2": 1800, ... },
      "deltas":   { "1": 0, "2": 0, ... },    // 0 for first snapshot
      "removals": { "1": 0, "2": 0, ... },
      "net":      { "1": 0, "2": 0, ... },
      "totalDelta": 0,
      "totalRemovals": 0
    },
    {
      "date": "2026-01-16",
      "total": 42890,
      "districts": { "1": 2215, "2": 1843, ... },
      "deltas":   { "1": 115, "2": 43, ... },
      "removals": { "1": 0,   "2": 0,  ... },
      "net":      { "1": 115, "2": 43, ... },
      "totalDelta": 1687,
      "totalRemovals": 0
    },
    // ... one entry per snapshot file
  ]
}
```

---

## How process.py uses history.json

When `history.json` is loaded, `process.py` replaces several fallback calculations with the richer history-based versions:

| Input | Without history | With history |
|---|---|---|
| `trend` | Intra-file date bucketing (same xlsx, binned by verification date) | Real inter-snapshot velocity ratios from `history["snapshots"]` |
| `final_week_sigs` | Count of rows verified in last 7 calendar days per xlsx | Sum of net deltas over last 7 days of inter-snapshot intervals |
| `projected_total` | Flat linear extrapolation from current count | Weighted least-squares projection from `history["projections"]["byDistrict"]` |
| `rejection_rate` | 0.0 (unknown) | Per-district from `history["rejectionRates"]` |
| `post_deadline_rate` | 0.0 (unknown) | Per-district from `history["postDeadlineRemovalRates"]` |
| `peak_verified` | Current verified count | True historical peak from `history["peakVerified"]` |

The more snapshots in history, the more accurate the projection slope and removal rate estimates. With only 1–2 snapshots, the model degrades gracefully to point-in-time estimates.

---

## Rebuilding history manually

If you add historical snapshot files or need to backfill:

```bash
# Add xlsx files to data/snapshots/ with YYYY-MM-DD.xlsx filenames
cp some-old-file.xlsx data/snapshots/2026-01-20.xlsx

# Rebuild history
.venv/bin/python scripts/replay.py

# Re-run the model to pick up the updated history
.venv/bin/python scripts/process.py
```

`history.json` is always rebuilt from scratch — it is never appended to. This means every replay is a full recalculation, which keeps the file consistent and avoids accumulated drift from incremental updates.
