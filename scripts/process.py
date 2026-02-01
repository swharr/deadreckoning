#!/usr/bin/env python3
"""
process.py — Parses petition xlsx, computes district stats, writes public/data.json.

If data/history.json exists (built by replay.py), uses it for:
  - Real inter-snapshot velocity
  - Per-district rejection/removal rates
  - Linear trajectory projections to March 7

Usage:
    python scripts/process.py [--file path/to/file.xlsx]
"""

import argparse
import hashlib
import json
import math
import os
import sys
from collections import defaultdict
from datetime import datetime, date, timezone
from pathlib import Path

from dateutil import parser as dateutil_parser
from openpyxl import load_workbook

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
PUBLIC_DIR = REPO_ROOT / "public"
LATEST_PATH = DATA_DIR / "latest.xlsx"
DATA_JSON_PATH = PUBLIC_DIR / "data.json"
LOOKUP_INDEX_PATH = PUBLIC_DIR / "lookup.json"
HISTORY_PATH = DATA_DIR / "history.json"

THRESHOLDS = {
    1: 5238, 2: 4687, 3: 4737, 4: 5099, 5: 4115, 6: 4745, 7: 5294,
    8: 4910, 9: 4805, 10: 2975, 11: 4890, 12: 3248, 13: 4088, 14: 5680,
    15: 4596, 16: 4347, 17: 5368, 18: 5093, 19: 5715, 20: 5292, 21: 5684,
    22: 5411, 23: 4253, 24: 3857, 25: 4929, 26: 5178, 27: 5696, 28: 5437,
    29: 5382,
}

# Only used if history.json is absent (fallback for first-run / no snapshot data)
ESTIMATED_VALID_UNVERIFIED = 0
QUALIFICATION_THRESHOLD_STATEWIDE = 140748
DISTRICTS_REQUIRED = 26
TOTAL_DISTRICTS = 29
CLERK_DEADLINE = date(2026, 3, 7)
CLERK_DEADLINE_STR = "2026-03-07"
SUBMISSION_DEADLINE = date(2026, 2, 15)  # last day petitioners could submit new sigs
ELECTION_DATE = "2026-11-03"

# Number of historical weekly buckets for sparkline display
WEEKLY_BUCKETS = 10


# ---------------------------------------------------------------------------
# Name lookup helpers
# ---------------------------------------------------------------------------

def normalize_name(raw: str) -> str:
    """
    Normalize a name from the xlsx for hashing.
    Input format: "Lastname, Firstname Middlename" or "Lastname, Firstname"
    Output: "LASTNAME,FIRSTNAME" (uppercase, no middle name, no spaces)
    """
    raw = str(raw).strip().upper()
    if ',' in raw:
        parts = raw.split(',', 1)
        last = parts[0].strip()
        first_parts = parts[1].strip().split()
        first = first_parts[0] if first_parts else ''
    else:
        last = raw
        first = ''
    return f"{last},{first}"


def name_hash(normalized: str) -> str:
    """First 20 hex chars of SHA-256 (10 bytes = 80 bits)."""
    return hashlib.sha256(normalized.encode('utf-8')).hexdigest()[:20]


def build_lookup_index(names: list[str]) -> dict:
    hashes = set()
    for raw in names:
        norm = normalize_name(raw)
        if norm and norm != ',':
            hashes.add(name_hash(norm))
    return {
        "count": len(hashes),
        "hashes": sorted(hashes),
    }


# ---------------------------------------------------------------------------
# History loader
# ---------------------------------------------------------------------------

def load_history() -> dict | None:
    """Load data/history.json if present, else return None."""
    if not HISTORY_PATH.exists():
        return None
    try:
        with open(HISTORY_PATH) as f:
            return json.load(f)
    except Exception as e:
        print(f"Warning: could not load history.json: {e}")
        return None


# ---------------------------------------------------------------------------
# Probability model
# ---------------------------------------------------------------------------

def compute_district_prob(
    verified: int,
    threshold: int,
    trend: str,
    final_week_sigs: int,
    projected_adj: float,   # rejection-adjusted linear projection to deadline
    rejection_rate: float,  # observed per-district removal rate [0,1]
) -> float:
    """
    Compute P(district meets threshold) using history-informed inputs where available.
    Returns a value in [0.01, 1.00].
    """
    if verified >= threshold:
        return 1.0

    # Base: raw fraction already verified
    base_score = verified / threshold

    # Trend multiplier
    trend_mult = {"ACCEL": 1.08, "STABLE": 1.0, "DECEL": 0.90}.get(trend, 1.0)

    # Projection factor: how far the rejection-adjusted projection overshoots threshold
    proj_pct = projected_adj / threshold if threshold > 0 else 0.0
    proj_factor = min(proj_pct, 2.5)

    # Rejection penalty: high removal rate districts get a downward nudge
    rejection_penalty = rejection_rate * 0.5  # 10% removal rate → -0.05 penalty

    # Weighted combination
    raw = 0.45 * base_score + 0.35 * proj_factor + 0.20 * (base_score * trend_mult)
    raw -= rejection_penalty

    # Sigmoid-style squeeze
    if base_score < 0.50:
        raw *= 0.60
    elif base_score < 0.75:
        raw *= 0.85
    elif base_score >= 0.95:
        raw = max(raw, 0.85)

    # Velocity bonus
    if final_week_sigs > 500:
        raw += 0.03
    elif final_week_sigs > 200:
        raw += 0.01

    return max(0.01, min(0.99, raw))


def compute_district_prob_survival(
    verified: int,
    threshold: int,
    peak_verified: int,       # highest count ever seen for this district
    post_deadline_removal_rate: float,  # removals / peak since submission deadline
    observed_removal_rate: float,       # full-history removal rate (background)
    days_remaining: int,
) -> float:
    """
    Post-submission-deadline survival model.

    No new signatures can be added. The question is purely:
    will enough of the current verified signatures survive clerk review?

    Model:
      - Start from current verified count
      - Project remaining removals based on observed post-deadline removal rate
        extrapolated over remaining days (if we have post-deadline data)
        or conservative background rate otherwise
      - P(survive) = P(verified_at_deadline >= threshold)

    Returns a value in [0.0, 1.0].
    """
    if verified >= threshold:
        # Already met — P = 1.0 only if we think removals won't push below threshold
        # Apply safety margin: if verified is well above threshold, still certain
        buffer = (verified - threshold) / threshold
        if buffer >= 0.10:
            return 1.0
        # Close to threshold — small prob of falling back below due to removals
        removal_risk = min(post_deadline_removal_rate * 3, 0.15)
        return max(0.90, 1.0 - removal_risk)

    # Below threshold — project forward: how much will be removed before deadline?
    # Use post-deadline rate if available, else fall back to background rate
    effective_rate = post_deadline_removal_rate if post_deadline_removal_rate > 0 else observed_removal_rate

    # Remaining removal pressure: rate * days_fraction_left
    # We don't know the pace of removals, so use a conservative uniform model:
    # assume remaining_removal_rate is proportional to days left / total clerk window (20 days)
    clerk_window_days = 20
    days_fraction = min(days_remaining / clerk_window_days, 1.0)
    expected_additional_removals = peak_verified * effective_rate * days_fraction

    projected_final = verified - expected_additional_removals
    survival_pct = projected_final / threshold if threshold > 0 else 0.0

    # Sigmoid squeeze
    if survival_pct >= 1.0:
        return min(0.95, 0.80 + (survival_pct - 1.0) * 0.10)
    elif survival_pct >= 0.95:
        return 0.65
    elif survival_pct >= 0.90:
        return 0.45
    elif survival_pct >= 0.85:
        return 0.28
    elif survival_pct >= 0.80:
        return 0.15
    else:
        return max(0.01, survival_pct * 0.10)


def compute_distribution(probs: list[float]) -> list[float]:
    """Exact DP: returns dp[k] = P(exactly k districts meet threshold)."""
    n = len(probs)
    dp = [0.0] * (n + 1)
    dp[0] = 1.0
    for p in probs:
        new_dp = [0.0] * (n + 1)
        for k in range(n + 1):
            if dp[k] == 0:
                continue
            new_dp[k + 1] += dp[k] * p
            new_dp[k] += dp[k] * (1 - p)
        dp = new_dp
    return dp


def p_qualify(dp: list[float]) -> float:
    return sum(dp[26:])


def expected_districts(probs: list[float]) -> float:
    return sum(probs)


# ---------------------------------------------------------------------------
# Trend calculation (used when history is absent)
# ---------------------------------------------------------------------------

def compute_trend(weekly: list[int]) -> str:
    """ACCEL / STABLE / DECEL based on last 2 vs prior 2 weeks."""
    if len(weekly) < 4:
        return "STABLE"
    last2 = sum(weekly[-2:])
    prior2 = sum(weekly[-4:-2])
    if prior2 == 0:
        return "STABLE"
    ratio = last2 / prior2
    if ratio >= 1.15:
        return "ACCEL"
    if ratio <= 0.85:
        return "DECEL"
    return "STABLE"


def compute_trend_from_history(district_snapshots: list[dict]) -> str:
    """
    Compute ACCEL/STABLE/DECEL from inter-snapshot deltas.
    Uses last 2 intervals vs prior 2 intervals (weighted by days between snapshots).
    """
    if len(district_snapshots) < 3:
        return "STABLE"

    # Compute per-day rates for each interval
    rates = []
    for i in range(1, len(district_snapshots)):
        prev_date = date.fromisoformat(district_snapshots[i - 1]["date"])
        cur_date = date.fromisoformat(district_snapshots[i]["date"])
        days = max((cur_date - prev_date).days, 1)
        net = district_snapshots[i]["count"] - district_snapshots[i - 1]["count"]
        rates.append(net / days)  # sigs/day

    if len(rates) < 2:
        return "STABLE"

    recent = sum(rates[-2:]) / 2
    prior = sum(rates[:-2]) / max(len(rates[:-2]), 1)

    if prior <= 0:
        return "STABLE"
    ratio = recent / prior
    if ratio >= 1.15:
        return "ACCEL"
    if ratio <= 0.85:
        return "DECEL"
    return "STABLE"


# ---------------------------------------------------------------------------
# Tier classification
# ---------------------------------------------------------------------------

def classify_tier(prob: float) -> str:
    if prob >= 1.0:
        return "CONFIRMED"
    if prob >= 0.90:
        return "NEARLY CERTAIN"
    if prob >= 0.70:
        return "VERY LIKELY"
    if prob >= 0.50:
        return "LIKELY"
    if prob >= 0.25:
        return "POSSIBLE"
    if prob >= 0.10:
        return "UNLIKELY"
    return "NO CHANCE"


# ---------------------------------------------------------------------------
# xlsx parsing
# ---------------------------------------------------------------------------

def parse_xlsx(path: Path) -> tuple[dict[int, int], dict[int, list[datetime]], list[str]]:
    """
    Read xlsx, return:
      - district_counts: {district_num: verified_count}
      - district_dates:  {district_num: [datetime, ...]}
      - all_names:       [raw name string, ...]
    """
    print(f"Reading {path} ...")
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb.active

    district_counts: dict[int, int] = defaultdict(int)
    district_dates: dict[int, list[datetime]] = defaultdict(list)
    all_names: list[str] = []
    skipped = 0
    total = 0

    for row in ws.iter_rows(min_row=2, values_only=True):
        if len(row) < 4:
            skipped += 1
            continue

        entry_date_raw = row[1]
        name_raw = row[2]
        district_raw = row[3]

        try:
            district = int(district_raw)
        except (TypeError, ValueError):
            skipped += 1
            continue

        if district not in THRESHOLDS:
            skipped += 1
            continue

        entry_dt = None
        if entry_date_raw:
            try:
                if isinstance(entry_date_raw, datetime):
                    entry_dt = entry_date_raw
                else:
                    entry_dt = dateutil_parser.parse(str(entry_date_raw))
            except Exception:
                entry_dt = None

        district_counts[district] += 1
        if entry_dt:
            district_dates[district].append(entry_dt)
        if name_raw:
            all_names.append(str(name_raw))
        total += 1

    wb.close()
    print(f"Parsed {total:,} rows ({skipped} skipped).")
    return dict(district_counts), dict(district_dates), all_names


# ---------------------------------------------------------------------------
# Weekly buckets (intra-file sparkline, used when no history)
# ---------------------------------------------------------------------------

def build_weekly_buckets(dates: list[datetime], n_buckets: int = WEEKLY_BUCKETS) -> list[int]:
    if not dates:
        return [0] * n_buckets
    sorted_dates = sorted(dates)
    earliest = sorted_dates[0]
    latest = sorted_dates[-1]
    span_days = max((latest - earliest).days, 1)
    bucket_size_days = span_days / n_buckets
    buckets = [0] * n_buckets
    for dt in sorted_dates:
        offset = (dt - earliest).days
        idx = min(int(offset / bucket_size_days), n_buckets - 1)
        buckets[idx] += 1
    return buckets


def build_weekly_buckets_from_history(district_snapshots: list[dict], n_buckets: int = WEEKLY_BUCKETS) -> list[int]:
    """
    Build WEEKLY_BUCKETS-length sparkline from inter-snapshot net deltas.
    Each entry represents net new signatures in that interval.
    """
    if not district_snapshots:
        return [0] * n_buckets

    # Compute deltas between consecutive snapshots
    deltas = []
    for i in range(1, len(district_snapshots)):
        net = max(0, district_snapshots[i]["count"] - district_snapshots[i - 1]["count"])
        deltas.append(net)

    if not deltas:
        return [0] * n_buckets

    # Pad or truncate to n_buckets
    if len(deltas) >= n_buckets:
        return deltas[-n_buckets:]
    else:
        return ([0] * (n_buckets - len(deltas))) + deltas


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Process petition xlsx → public/data.json")
    parser.add_argument("--file", help="Path to xlsx file (default: data/latest.xlsx)")
    args = parser.parse_args()

    xlsx_path = Path(args.file) if args.file else LATEST_PATH
    if not xlsx_path.exists():
        print(f"ERROR: File not found: {xlsx_path}", file=sys.stderr)
        sys.exit(1)

    source_file = xlsx_path.name

    # --- Load history ---
    history = load_history()
    if history:
        print(f"Loaded history.json: {history['snapshotCount']} snapshots, "
              f"{history['firstSnapshot']} → {history['lastSnapshot']}")
    else:
        print("No history.json found — using intra-file date bucketing only.")

    # --- Load previous data.json for deltas ---
    prev_data: dict = {}
    if DATA_JSON_PATH.exists():
        try:
            with open(DATA_JSON_PATH) as f:
                prev_data = json.load(f)
        except Exception as e:
            print(f"Warning: could not load previous data.json: {e}")

    prev_district_map: dict[int, dict] = {}
    if "districts" in prev_data:
        for d in prev_data["districts"]:
            prev_district_map[d["d"]] = d
    prev_overall = prev_data.get("overall", {})
    prev_p_qualify = prev_overall.get("pQualify", 0.0)

    # --- Parse xlsx ---
    district_counts, district_dates, all_names = parse_xlsx(xlsx_path)
    total_verified = sum(district_counts.values())

    # --- Determine model mode ---
    today = date.today()
    post_deadline = today > SUBMISSION_DEADLINE
    model_mode = "survival" if post_deadline else "growth"
    print(f"Model mode: {model_mode.upper()} "
          f"({'submission deadline passed' if post_deadline else 'accepting new signatures'})")

    # --- Build per-district history lookup (if available) ---
    district_history: dict[int, list[dict]] = {}
    rejection_rates: dict[int, float] = {}
    post_deadline_rates: dict[int, float] = {}
    peak_verified_map: dict[int, int] = {}
    projections: dict[int, dict] = {}
    daily_velocity = 0.0
    days_to_deadline = max((CLERK_DEADLINE - today).days, 0)

    if history:
        for d_num in THRESHOLDS:
            district_history[d_num] = [
                {"date": snap["date"], "count": snap["districts"].get(str(d_num), 0)}
                for snap in history["snapshots"]
            ]
        rejection_rates = {int(k): v for k, v in history.get("rejectionRates", {}).items()}
        post_deadline_rates = {int(k): v for k, v in history.get("postDeadlineRemovalRates", {}).items()}
        peak_verified_map = {int(k): v for k, v in history.get("peakVerified", {}).items()}
        projections = history.get("projections", {}).get("byDistrict", {})
        daily_velocity = history.get("dailyVelocity", 0.0)
        days_to_deadline = history.get("daysToDeadline", days_to_deadline)

    # --- Build per-district records ---
    districts_out = []
    all_probs = []

    for d_num in sorted(THRESHOLDS.keys()):
        threshold = THRESHOLDS[d_num]
        verified = district_counts.get(d_num, 0)
        dates = district_dates.get(d_num, [])

        prev_rec = prev_district_map.get(d_num, {})
        prev_verified = prev_rec.get("verified", verified)
        delta = verified - prev_verified

        pct_verified = verified / threshold if threshold > 0 else 0.0

        # --- Trend & sparkline ---
        if history and d_num in district_history and len(district_history[d_num]) >= 2:
            hist_series = district_history[d_num]
            trend = compute_trend_from_history(hist_series)
            weekly = build_weekly_buckets_from_history(hist_series, WEEKLY_BUCKETS)
        else:
            weekly = build_weekly_buckets(dates, WEEKLY_BUCKETS)
            trend = compute_trend(weekly)

        final_week_sigs = weekly[-1] if weekly else 0

        # --- Rejection rates ---
        rejection_rate = rejection_rates.get(d_num, 0.0)
        post_deadline_rate = post_deadline_rates.get(d_num, 0.0)
        peak_verified = peak_verified_map.get(d_num, verified)

        # --- Probability (mode-dependent) ---
        if post_deadline:
            # SURVIVAL MODE: no new sigs, only removals possible
            prob = compute_district_prob_survival(
                verified=verified,
                threshold=threshold,
                peak_verified=peak_verified,
                post_deadline_removal_rate=post_deadline_rate,
                observed_removal_rate=rejection_rate,
                days_remaining=days_to_deadline,
            )
            # Projection: expected final count after remaining removals
            # Use post-deadline rate if available, else background rate
            effective_rate = post_deadline_rate if post_deadline_rate > 0 else rejection_rate
            clerk_window_days = 20
            days_fraction = min(days_to_deadline / clerk_window_days, 1.0)
            projected_total = verified - (peak_verified * effective_rate * days_fraction)
            projected_total = max(projected_total, float(verified))  # can't add, only remove
            projected_raw = projected_total
            projected_pct = projected_total / threshold if threshold > 0 else 0.0
        else:
            # GROWTH MODE: sigs still coming in
            if history and str(d_num) in projections:
                proj_data = projections[str(d_num)]
                projected_total = proj_data["rejectionAdjusted"]
                projected_pct = proj_data["pctOfThreshold"]
                projected_raw = proj_data["raw"]
            else:
                if total_verified > 0:
                    district_share = verified / total_verified
                else:
                    district_share = 1 / TOTAL_DISTRICTS
                surge_est = district_share * ESTIMATED_VALID_UNVERIFIED
                projected_total = verified + surge_est
                projected_raw = projected_total
                projected_pct = projected_total / threshold if threshold > 0 else 0.0

            prob = compute_district_prob(
                verified, threshold, trend, final_week_sigs,
                projected_total, rejection_rate
            )

        prev_prob = prev_rec.get("prob", prob)
        prob_delta = round(prob - prev_prob, 4)
        tier = classify_tier(prob)
        all_probs.append(prob)

        districts_out.append({
            "d": d_num,
            "threshold": threshold,
            "verified": verified,
            "prevVerified": prev_verified,
            "delta": delta,
            "pctVerified": round(pct_verified, 4),
            "projectedTotal": round(projected_total, 1),
            "projectedRaw": round(projected_raw, 1),
            "projectedPct": round(projected_pct, 4),
            "peakVerified": peak_verified,
            "rejectionRate": round(rejection_rate, 4),
            "postDeadlineRate": round(post_deadline_rate, 4),
            "prob": round(prob, 4),
            "prevProb": round(prev_prob, 4),
            "probDelta": round(prob_delta, 4),
            "tier": tier,
            "trend": trend,
            "weeklySignatures": weekly,
        })

    # --- DP distribution ---
    dp = compute_distribution(all_probs)
    p_qual = p_qualify(dp)
    exp_districts = expected_districts(all_probs)
    p_exact = [round(dp[k], 6) for k in range(TOTAL_DISTRICTS + 1)]

    # --- Snapshot deltas ---
    gains = [d for d in districts_out if d["delta"] > 0]
    losses = [d for d in districts_out if d["delta"] < 0]
    biggest_gains = sorted(
        [{"d": d["d"], "delta": d["delta"], "verified": d["verified"], "threshold": d["threshold"]}
         for d in gains],
        key=lambda x: x["delta"], reverse=True
    )[:5]
    biggest_losses = sorted(
        [{"d": d["d"], "delta": d["delta"], "verified": d["verified"], "threshold": d["threshold"]}
         for d in losses],
        key=lambda x: x["delta"]
    )[:5]
    newly_met = [d["d"] for d in districts_out
                 if d["verified"] >= d["threshold"] and d["prevVerified"] < d["threshold"]]
    newly_failed = [d["d"] for d in districts_out
                    if d["verified"] < d["threshold"] and d["prevVerified"] >= d["threshold"]]
    overall_prob_delta = round(p_qual - prev_p_qualify, 4)

    # --- Anomalies from history ---
    anomalies = history.get("anomalies", []) if history else []

    # --- Statewide trajectory ---
    statewide_proj_raw = sum(d["projectedRaw"] for d in districts_out)
    statewide_proj_adj = sum(d["projectedTotal"] for d in districts_out)
    statewide_rejection_rate = history.get("statewideRejectionRate", 0.0) if history else 0.0

    # --- Build output ---
    now_utc = datetime.now(timezone.utc)
    output = {
        "meta": {
            "lastUpdated": now_utc.strftime("%Y-%m-%d"),
            "lastUpdatedISO": now_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "sourceFile": source_file,
            "totalVerified": total_verified,
            "daysToDeadline": days_to_deadline,
            "dailyVelocity": round(daily_velocity, 1),
            "statewideRejectionRate": statewide_rejection_rate,
            "modelMode": model_mode,
            "postDeadline": post_deadline,
            "submissionDeadline": SUBMISSION_DEADLINE.isoformat(),
            "clerkDeadline": CLERK_DEADLINE_STR,
            "qualificationThreshold": QUALIFICATION_THRESHOLD_STATEWIDE,
            "districtsRequired": DISTRICTS_REQUIRED,
            "totalDistricts": TOTAL_DISTRICTS,
            "snapshotCount": history["snapshotCount"] if history else 1,
            "historyRange": f"{history['firstSnapshot']} → {history['lastSnapshot']}" if history else "n/a",
        },
        "overall": {
            "pQualify": round(p_qual, 4),
            "expectedDistricts": round(exp_districts, 2),
            "pExact": p_exact,
            "projectedStatewideRaw": round(statewide_proj_raw, 0),
            "projectedStatewideAdjusted": round(statewide_proj_adj, 0),
        },
        "districts": districts_out,
        "snapshot": {
            "biggestGains": biggest_gains,
            "biggestLosses": biggest_losses,
            "newlyMet": newly_met,
            "newlyFailed": newly_failed,
            "overallProbDelta": overall_prob_delta,
            "anomalies": anomalies,
        },
    }

    # --- Write outputs ---
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    with open(DATA_JSON_PATH, "w") as f:
        json.dump(output, f, indent=2)
    print(f"Wrote {DATA_JSON_PATH}")

    lookup = build_lookup_index(all_names)
    with open(LOOKUP_INDEX_PATH, "w") as f:
        json.dump(lookup, f, separators=(',', ':'))
    print(f"Wrote {LOOKUP_INDEX_PATH} ({lookup['count']:,} name hashes)")

    confirmed = sum(1 for d in districts_out if d["verified"] >= d["threshold"])
    print(
        f"Summary: {now_utc.strftime('%Y-%m-%d')} | "
        f"Verified: {total_verified:,} | "
        f"Districts meeting threshold: {confirmed}/{TOTAL_DISTRICTS} | "
        f"P(qualify): {p_qual:.1%} | "
        f"Rejection rate: {statewide_rejection_rate:.1%}"
    )


if __name__ == "__main__":
    main()
