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


def bloom_hash_positions(key: str, m: int, k: int) -> list[int]:
    """
    Generate k bit positions for a key in a bloom filter of m bits.
    Uses double hashing: h_i(x) = (h1(x) + i*h2(x)) mod m
    where h1 = SHA-256 first 8 bytes, h2 = SHA-256 bytes 8-16.
    This matches the JS implementation exactly.
    """
    digest = hashlib.sha256(key.encode('utf-8')).digest()
    h1 = int.from_bytes(digest[0:8], 'big')
    h2 = int.from_bytes(digest[8:16], 'big') | 1  # ensure odd for full coverage
    return [(h1 + i * h2) % m for i in range(k)]


def build_bloom_filter(keys: list[str], m: int = 65536, k: int = 7) -> dict:
    """
    Build a bloom filter for a set of keys.
    m: number of bits (65536 = 8KB per district)
    k: number of hash functions (7 is optimal for ~3000-8000 entries at 8KB)
    Returns a base64-encoded bit array.
    """
    import base64
    bits = bytearray(m // 8)
    for key in keys:
        for pos in bloom_hash_positions(key, m, k):
            bits[pos >> 3] |= (1 << (pos & 7))
    return {
        "m": m,
        "k": k,
        "bits": base64.b64encode(bytes(bits)).decode('ascii'),
    }


def build_lookup_index(district_names: dict[int, list[str]]) -> dict:
    """
    Build per-district bloom filters. Key = "LASTNAME,FIRSTNAME,D{n}".
    This scopes lookups to district so cross-district false positives are eliminated.
    """
    import base64
    M = 65536  # 8KB per district (64K bits)
    K = 7      # 7 hash functions → ~0.3% FP rate at 8K entries

    districts_bloom = {}
    total_names = 0
    for d_num, names in district_names.items():
        keys = []
        for raw in names:
            norm = normalize_name(raw)
            if norm and norm != ',':
                # District-scoped key: eliminates cross-district false positives
                keys.append(f"{norm},D{d_num}")
        bf = build_bloom_filter(keys, M, K)
        districts_bloom[str(d_num)] = bf
        total_names += len(keys)

    return {
        "version": 2,
        "m": M,
        "k": K,
        "count": total_names,
        "districts": districts_bloom,
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
    Returns a value in [0.00, 1.00].
    """
    if verified >= threshold:
        return 1.0

    # Structural feasibility gate: if the projection can't get close to threshold,
    # the district has very low odds regardless of trend noise.
    proj_pct = projected_adj / threshold if threshold > 0 else 0.0
    if proj_pct < 0.65:
        # Very far off — scale from 0 to 0.02
        return round(proj_pct * 0.031, 4)  # max 0.02 at 0.65
    if proj_pct < 0.80:
        # Hard climb zone: 0.02 → 0.08
        return round(0.02 + (proj_pct - 0.65) * 0.40, 4)
    if proj_pct < 0.90:
        # Getting realistic: 0.08 → 0.18
        return round(0.08 + (proj_pct - 0.80) * 1.00, 4)

    # Base: raw fraction already verified
    base_score = verified / threshold

    # Trend multiplier
    trend_mult = {"ACCEL": 1.08, "STABLE": 1.0, "DECEL": 0.90}.get(trend, 1.0)

    # Rejection penalty: high removal rate districts get a downward nudge
    rejection_penalty = rejection_rate * 0.5  # 10% removal rate → -0.05 penalty

    # Weighted combination
    raw = 0.45 * base_score + 0.35 * proj_pct + 0.20 * (base_score * trend_mult)
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

    return max(0.00, min(0.99, raw))


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

    # Below threshold — in survival mode, the verified count is the LG-posted count.
    # Due to LG posting lag, effective_verified passed in may already be blended
    # with the growth projection to reflect pending-but-unposted signatures.
    # The gap below threshold tells us how likely late postings can close it.
    current_pct = verified / threshold if threshold > 0 else 0.0
    gap_pct = 1.0 - current_pct  # how far below threshold (using raw verified, not blended)

    if gap_pct <= 0.02:
        # Within 2% — small chance LG posting lag resolves in their favor
        return 0.20
    elif gap_pct <= 0.05:
        return 0.12
    elif gap_pct <= 0.10:
        return 0.06
    elif gap_pct <= 0.15:
        return 0.03
    elif gap_pct <= 0.25:
        return 0.01
    else:
        # Structurally impossible — too far below threshold
        return 0.00


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

def classify_tier(prob: float, pct_verified: float = 0.0) -> str:
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
    # Floors based on how far along a district already is:
    # ≥80% of threshold verified → at least LIKELY
    if pct_verified >= 0.80:
        return "LIKELY"
    # ≥60% of threshold verified → at least POSSIBLE
    if pct_verified >= 0.60:
        return "POSSIBLE"
    if prob >= 0.10:
        return "UNLIKELY"
    return "NO CHANCE"


# ---------------------------------------------------------------------------
# xlsx parsing
# ---------------------------------------------------------------------------

def parse_xlsx(path: Path) -> tuple[dict[int, int], dict[int, list[datetime]], dict[int, list[str]]]:
    """
    Read xlsx, return:
      - district_counts: {district_num: verified_count}
      - district_dates:  {district_num: [datetime, ...]}
      - district_names:  {district_num: [raw name string, ...]}
    """
    print(f"Reading {path} ...")
    wb = load_workbook(path, read_only=True, data_only=True)
    ws = wb.active

    district_counts: dict[int, int] = defaultdict(int)
    district_dates: dict[int, list[datetime]] = defaultdict(list)
    district_names: dict[int, list[str]] = defaultdict(list)
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
            district_names[district].append(str(name_raw))
        total += 1

    wb.close()
    print(f"Parsed {total:,} rows ({skipped} skipped).")
    return dict(district_counts), dict(district_dates), dict(district_names)


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
    district_counts, district_dates, district_names = parse_xlsx(xlsx_path)
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
    all_growth_probs = []

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
            # SURVIVAL MODE: submission deadline passed.
            #
            # Key nuance: the LG office posts validations with a 1-2 business day lag.
            # Signatures submitted right before the Feb 15 deadline may not yet appear
            # in the LG count. The growth projection from history gives an upper bound
            # on what those late-posted signatures might add.
            #
            # We blend: early post-deadline → lean on growth projection as "pending"
            #           later → trust only the actual LG count
            #
            # LG_LAG_DAYS: how many business days we expect lag to persist
            LG_LAG_DAYS = 7  # full business week for LG to post all pre-deadline submissions
            days_elapsed = max(0, (date.today() - SUBMISSION_DEADLINE).days)
            # lag_weight decays from 1.0 on day 0 to 0.0 after LG_LAG_DAYS
            lag_weight = max(0.0, 1.0 - days_elapsed / LG_LAG_DAYS)

            # Growth projection upper bound from history
            growth_proj_raw = None
            if history and str(d_num) in projections:
                growth_proj_raw = projections[str(d_num)]["raw"]

            # Effective verified count: blend current count with growth projection
            # to account for signatures submitted pre-deadline but not yet posted
            if growth_proj_raw and lag_weight > 0:
                effective_verified = verified + lag_weight * max(0, growth_proj_raw - verified)
            else:
                effective_verified = float(verified)

            # Pure survival prob from the current (possibly lag-blended) count
            survival_prob = compute_district_prob_survival(
                verified=effective_verified,
                threshold=threshold,
                peak_verified=peak_verified,
                post_deadline_removal_rate=post_deadline_rate,
                observed_removal_rate=rejection_rate,
                days_remaining=days_to_deadline,
            )

            # Growth prob: what would the growth model say about this district?
            # Used to blend during the lag window — if trajectory was strong, honor it.
            growth_prob_for_blend = compute_district_prob(
                verified=verified,
                threshold=threshold,
                trend=trend,
                final_week_sigs=final_week_sigs,
                projected_adj=growth_proj_raw if growth_proj_raw else float(verified),
                rejection_rate=rejection_rate,
            )

            # Blend: early post-deadline leans on growth signal;
            # as lag expires, survival signal takes over entirely.
            prob = lag_weight * growth_prob_for_blend + (1.0 - lag_weight) * survival_prob

            # Also compute a pure growth prob shadow (ignores survival mode, for toggle)
            # Projection: expected final count after remaining removals
            effective_rate = post_deadline_rate if post_deadline_rate > 0 else rejection_rate
            clerk_window_days = 20
            days_fraction = min(days_to_deadline / clerk_window_days, 1.0)
            projected_total = effective_verified - (peak_verified * effective_rate * days_fraction)
            projected_total = max(projected_total, float(verified))  # can't add, only remove
            projected_raw = growth_proj_raw if growth_proj_raw else projected_total
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
        tier = classify_tier(prob, pct_verified)
        all_probs.append(prob)

        # --- Growth-model shadow probability (always computed for toggle) ---
        if post_deadline:
            # What would the growth model say if we hadn't hit the deadline?
            growth_prob = compute_district_prob(
                verified, threshold, trend, final_week_sigs,
                projected_raw, rejection_rate
            )
        else:
            growth_prob = prob  # Already in growth mode

        all_growth_probs.append(growth_prob)

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
            "growthProb": round(growth_prob, 4),
            "prevProb": round(prev_prob, 4),
            "probDelta": round(prob_delta, 4),
            "tier": tier,
            "trend": trend,
            "weeklySignatures": weekly,
        })

    # --- DP distribution (primary model) ---
    dp = compute_distribution(all_probs)
    p_qual = p_qualify(dp)
    exp_districts = expected_districts(all_probs)
    p_exact = [round(dp[k], 6) for k in range(TOTAL_DISTRICTS + 1)]

    # --- DP distribution (growth-model shadow, for toggle) ---
    dp_growth = compute_distribution(all_growth_probs)
    p_qual_growth = p_qualify(dp_growth)
    exp_districts_growth = expected_districts(all_growth_probs)
    p_exact_growth = [round(dp_growth[k], 6) for k in range(TOTAL_DISTRICTS + 1)]

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
            "pQualifyGrowth": round(p_qual_growth, 4),
            "expectedDistrictsGrowth": round(exp_districts_growth, 2),
            "pExactGrowth": p_exact_growth,
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

    lookup = build_lookup_index(district_names)
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
