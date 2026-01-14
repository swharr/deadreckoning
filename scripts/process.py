#!/usr/bin/env python3
"""
process.py — Parses petition xlsx, computes district stats, writes public/data.json.

Usage:
    python scripts/process.py [--file path/to/file.xlsx]
"""

import argparse
import json
import math
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from dateutil import parser as dateutil_parser
from openpyxl import load_workbook

REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = REPO_ROOT / "data"
PUBLIC_DIR = REPO_ROOT / "public"
LATEST_PATH = DATA_DIR / "latest.xlsx"
DATA_JSON_PATH = PUBLIC_DIR / "data.json"

THRESHOLDS = {
    1: 5238, 2: 4687, 3: 4737, 4: 5099, 5: 4115, 6: 4745, 7: 5294,
    8: 4910, 9: 4805, 10: 2975, 11: 4890, 12: 3248, 13: 4088, 14: 5680,
    15: 4596, 16: 4347, 17: 5368, 18: 5093, 19: 5715, 20: 5292, 21: 5684,
    22: 5411, 23: 4253, 24: 3857, 25: 4929, 26: 5178, 27: 5696, 28: 5437,
    29: 5382,
}

# 81,620 additional valid signatures estimated from GOP's claimed 200k+
# at ~23% historical rejection rate.  Once March 7 clerk counts land in
# the xlsx the raw verified numbers absorb this and we set it to 0.
ESTIMATED_VALID_UNVERIFIED = 81620
QUALIFICATION_THRESHOLD_STATEWIDE = 140748
DISTRICTS_REQUIRED = 26
TOTAL_DISTRICTS = 29
CLERK_DEADLINE = "2026-03-07"
ELECTION_DATE = "2026-11-03"

# Number of weekly buckets to track
WEEKLY_BUCKETS = 10


# ---------------------------------------------------------------------------
# Probability model
# ---------------------------------------------------------------------------

def compute_district_prob(
    verified: int,
    threshold: int,
    trend: str,
    final_week_sigs: int,
    projected_pct: float,
) -> float:
    """
    Compute P(district meets threshold) based on multiple weighted factors.

    Returns a value in [0.01, 1.00].  Returns exactly 1.0 only when verified >= threshold.
    """
    if verified >= threshold:
        return 1.0

    # Base score: raw fraction of threshold already met
    base_score = verified / threshold  # 0.0 – 1.0+

    # Trend multiplier
    trend_mult = {"ACCEL": 1.08, "STABLE": 1.0, "DECEL": 0.90}.get(trend, 1.0)

    # Projected pct factor (with surge): how far projected total overshoots threshold
    # proj_pct = (verified + surge_est) / threshold
    proj_factor = min(projected_pct, 2.5) / 1.0  # normalise: 1.0 = right at threshold

    # Weighted combination
    # 50% base, 30% projection, 20% trend influence
    raw = 0.50 * base_score + 0.30 * proj_factor + 0.20 * (base_score * trend_mult)

    # Sigmoid-style squeeze: very low bases stay low, high bases push to certainty
    if base_score < 0.50:
        raw *= 0.6
    elif base_score < 0.75:
        raw *= 0.85
    elif base_score >= 0.95:
        raw = max(raw, 0.85)

    # Velocity bonus: districts with strong final-week momentum
    if final_week_sigs > 500:
        raw += 0.03
    elif final_week_sigs > 200:
        raw += 0.01

    return max(0.01, min(0.99, raw))


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
# Trend calculation
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

def parse_xlsx(path: Path) -> tuple[dict[int, int], dict[int, list[datetime]]]:
    """
    Read xlsx, return:
      - district_counts: {district_num: verified_count}
      - district_dates:  {district_num: [datetime, ...]}  (Entry Date per row)
    Uses only columns A (Voter ID), B (Entry Date), D (Senate District).
    """
    print(f"Reading {path} ...")
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb.active

    district_counts: dict[int, int] = defaultdict(int)
    district_dates: dict[int, list[datetime]] = defaultdict(list)
    skipped = 0
    total = 0

    for i, row in enumerate(ws.iter_rows(min_row=2, values_only=True)):
        # Columns: A=0, B=1, C=2, D=3
        if len(row) < 4:
            skipped += 1
            continue

        _voter_id = row[0]
        entry_date_raw = row[1]
        _name = row[2]
        district_raw = row[3]

        # Parse district
        try:
            district = int(district_raw)
        except (TypeError, ValueError):
            skipped += 1
            continue

        if district not in THRESHOLDS:
            skipped += 1
            continue

        # Parse entry date
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
        total += 1

    wb.close()
    print(f"Parsed {total} rows ({skipped} skipped).")
    return dict(district_counts), dict(district_dates)


# ---------------------------------------------------------------------------
# Weekly buckets
# ---------------------------------------------------------------------------

def build_weekly_buckets(dates: list[datetime], n_buckets: int = WEEKLY_BUCKETS) -> list[int]:
    """Distribute entry dates into n_buckets weekly bins (oldest → newest)."""
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


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Process petition xlsx → public/data.json")
    parser.add_argument("--file", help="Path to xlsx file (default: data/latest.xlsx)")
    args = parser.parse_args()

    if args.file:
        xlsx_path = Path(args.file)
    else:
        xlsx_path = LATEST_PATH

    if not xlsx_path.exists():
        print(f"ERROR: File not found: {xlsx_path}", file=sys.stderr)
        print("Run scraper.py first or pass --file path/to/file.xlsx", file=sys.stderr)
        sys.exit(1)

    source_file = xlsx_path.name

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
    district_counts, district_dates = parse_xlsx(xlsx_path)

    total_verified = sum(district_counts.values())

    # --- Build per-district records ---
    districts_out = []
    all_probs = []

    for d_num in sorted(THRESHOLDS.keys()):
        threshold = THRESHOLDS[d_num]
        verified = district_counts.get(d_num, 0)
        dates = district_dates.get(d_num, [])

        prev_rec = prev_district_map.get(d_num, {})
        prev_verified = prev_rec.get("verified", verified)  # default to current if no history
        delta = verified - prev_verified

        pct_verified = verified / threshold if threshold > 0 else 0.0

        # Surge estimate — proportional by district share
        if total_verified > 0:
            district_share = verified / total_verified
        else:
            district_share = 1 / TOTAL_DISTRICTS
        surge_est = district_share * ESTIMATED_VALID_UNVERIFIED

        projected_total = verified + surge_est
        projected_pct = projected_total / threshold if threshold > 0 else 0.0

        # Weekly buckets
        weekly = build_weekly_buckets(dates, WEEKLY_BUCKETS)
        final_week_sigs = weekly[-1]

        # Trend
        trend = compute_trend(weekly)

        # Probability
        prob = compute_district_prob(verified, threshold, trend, final_week_sigs, projected_pct)
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
            "projectedPct": round(projected_pct, 4),
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

    # pExact: full array length 30 (indices 0..29)
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

    # --- Build output ---
    now_utc = datetime.now(timezone.utc)
    output = {
        "meta": {
            "lastUpdated": now_utc.strftime("%Y-%m-%d"),
            "lastUpdatedISO": now_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "sourceFile": source_file,
            "totalVerified": total_verified,
            "estimatedUnverified": ESTIMATED_VALID_UNVERIFIED,
            "clerkDeadline": CLERK_DEADLINE,
            "qualificationThreshold": QUALIFICATION_THRESHOLD_STATEWIDE,
            "districtsRequired": DISTRICTS_REQUIRED,
            "totalDistricts": TOTAL_DISTRICTS,
        },
        "overall": {
            "pQualify": round(p_qual, 4),
            "expectedDistricts": round(exp_districts, 2),
            "pExact": p_exact,
        },
        "districts": districts_out,
        "snapshot": {
            "biggestGains": biggest_gains,
            "biggestLosses": biggest_losses,
            "newlyMet": newly_met,
            "newlyFailed": newly_failed,
            "overallProbDelta": overall_prob_delta,
        },
    }

    # --- Write public/data.json ---
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    with open(DATA_JSON_PATH, "w") as f:
        json.dump(output, f, indent=2)
    print(f"Wrote {DATA_JSON_PATH}")

    # --- Summary ---
    confirmed = sum(1 for d in districts_out if d["verified"] >= d["threshold"])
    print(
        f"Summary: {now_utc.strftime('%Y-%m-%d')} | "
        f"Total verified: {total_verified:,} | "
        f"Districts meeting threshold: {confirmed}/{TOTAL_DISTRICTS} | "
        f"P(qualify): {p_qual:.1%}"
    )


if __name__ == "__main__":
    main()
