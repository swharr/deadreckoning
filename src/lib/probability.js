/**
 * probability.js — Client-side DP distribution calculator
 * Mirrors scripts/process.py exactly so the UI can recompute on the fly.
 */

// ---------------------------------------------------------------------------
// District thresholds (8% of active voters, fixed)
// ---------------------------------------------------------------------------
export const THRESHOLDS = {
  1: 5238, 2: 4687, 3: 4737, 4: 5099, 5: 4115, 6: 4745, 7: 5294,
  8: 4910, 9: 4805, 10: 2975, 11: 4890, 12: 3248, 13: 4088, 14: 5680,
  15: 4596, 16: 4347, 17: 5368, 18: 5093, 19: 5715, 20: 5292, 21: 5684,
  22: 5411, 23: 4253, 24: 3857, 25: 4929, 26: 5178, 27: 5696, 28: 5437,
  29: 5382,
}

// ---------------------------------------------------------------------------
// Tier configuration — label, probability bounds, accent color
// ---------------------------------------------------------------------------
export const TIER_CONFIG = {
  'CONFIRMED':     { label: 'Confirmed',     min: 1.00, color: '#00c853', bg: '#003318' },
  'NEARLY CERTAIN':{ label: 'Nearly Certain',min: 0.90, color: '#69f0ae', bg: '#003320' },
  'VERY LIKELY':   { label: 'Very Likely',   min: 0.70, color: '#40c4ff', bg: '#001f3f' },
  'LIKELY':        { label: 'Likely',        min: 0.50, color: '#4a9eff', bg: '#001a33' },
  'POSSIBLE':      { label: 'Possible',      min: 0.25, color: '#ffca28', bg: '#332800' },
  'UNLIKELY':      { label: 'Unlikely',      min: 0.10, color: '#ff7043', bg: '#331a00' },
  'NO CHANCE':     { label: 'No Chance',     min: 0.00, color: '#ef5350', bg: '#2d0000' },
}

// Ordered list for filtering UI
export const TIER_ORDER = [
  'CONFIRMED',
  'NEARLY CERTAIN',
  'VERY LIKELY',
  'LIKELY',
  'POSSIBLE',
  'UNLIKELY',
  'NO CHANCE',
]

// ---------------------------------------------------------------------------
// DP distribution
// ---------------------------------------------------------------------------

/**
 * computeDistribution(probs) → dp array where dp[k] = P(exactly k districts qualify)
 * @param {number[]} probs - array of per-district probabilities
 * @returns {number[]} dp array of length probs.length + 1
 */
export function computeDistribution(probs) {
  const n = probs.length
  let dp = new Array(n + 1).fill(0)
  dp[0] = 1.0

  for (const p of probs) {
    const newDp = new Array(n + 1).fill(0)
    for (let k = 0; k <= n; k++) {
      if (dp[k] === 0) continue
      newDp[k + 1] += dp[k] * p
      newDp[k] += dp[k] * (1 - p)
    }
    dp = newDp
  }

  return dp
}

/**
 * pQualify(dp) → P(at least 26 districts qualify)
 * @param {number[]} dp
 * @returns {number}
 */
export function pQualify(dp) {
  return dp.slice(26).reduce((sum, v) => sum + v, 0)
}

/**
 * expectedDistricts(probs) → E[number of qualifying districts]
 * @param {number[]} probs
 * @returns {number}
 */
export function expectedDistricts(probs) {
  return probs.reduce((sum, p) => sum + p, 0)
}
