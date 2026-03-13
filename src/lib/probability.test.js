import { describe, expect, it } from 'vitest'
import { computeDistribution, expectedDistricts, pQualify } from './probability.js'

describe('probability helpers', () => {
  it('computes an exact distribution that sums to 1', () => {
    const dp = computeDistribution([0.25, 0.5, 0.75])
    const total = dp.reduce((sum, value) => sum + value, 0)

    expect(dp).toHaveLength(4)
    expect(total).toBeCloseTo(1, 10)
  })

  it('computes expected districts as the sum of marginal probabilities', () => {
    expect(expectedDistricts([0.1, 0.2, 0.3])).toBeCloseTo(0.6, 10)
  })

  it('computes the district-rule probability from the DP tail', () => {
    const probs = new Array(29).fill(1)
    probs[28] = 0
    const dp = computeDistribution(probs)

    expect(pQualify(dp)).toBeCloseTo(1, 10)
  })
})
