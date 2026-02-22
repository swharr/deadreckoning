import React, { useState, useCallback, useMemo } from 'react'

const QUALIFY_MIN = 26
const RUN_OPTIONS = [100, 1_000, 10_000, 100_000]

// ---------------------------------------------------------------------------
// Core simulation — pure JS, runs synchronously (100k runs ≈ <5ms)
// ---------------------------------------------------------------------------
function runSimulation(districtProbs, numRuns) {
  const n = districtProbs.length
  // histogram[k] = number of runs where exactly k districts qualified
  const histogram = new Int32Array(n + 1)
  let qualifyCount = 0

  for (let r = 0; r < numRuns; r++) {
    let qualified = 0
    for (let i = 0; i < n; i++) {
      if (Math.random() < districtProbs[i]) qualified++
    }
    histogram[qualified]++
    if (qualified >= QUALIFY_MIN) qualifyCount++
  }

  // Per-district qualification rate across all runs
  // We need a second lightweight pass for this — track per-district
  const districtQualCount = new Int32Array(n)
  // Re-seed isn't needed — run again for per-district stats
  for (let r = 0; r < numRuns; r++) {
    for (let i = 0; i < n; i++) {
      if (Math.random() < districtProbs[i]) districtQualCount[i]++
    }
  }

  return {
    pQualify: qualifyCount / numRuns,
    histogram: Array.from(histogram),
    districtRates: Array.from(districtQualCount).map(c => c / numRuns),
    numRuns,
  }
}

// ---------------------------------------------------------------------------
// Histogram bar chart — reuses the same visual language as DistributionChart
// ---------------------------------------------------------------------------
function SimHistogram({ histogram, numRuns }) {
  const [hoveredK, setHoveredK] = useState(null)

  // Only show the interesting range: 18–29
  const kMin = 18
  const kMax = 29
  const buckets = []
  for (let k = kMin; k <= kMax; k++) {
    buckets.push({ k, count: histogram[k] ?? 0, p: (histogram[k] ?? 0) / numRuns })
  }

  const maxCount = Math.max(...buckets.map(b => b.count), 1)

  return (
    <div>
      <div style={{ fontSize: 11, color: '#445577', marginBottom: 10, letterSpacing: '0.04em' }}>
        Simulated outcome distribution — {numRuns.toLocaleString()} runs
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 5,
        height: 120,
        position: 'relative',
        marginBottom: 6,
      }}>
        {buckets.map(({ k, count, p }) => {
          const qualifies = k >= QUALIFY_MIN
          const barHeight = maxCount > 0 ? Math.max((count / maxCount) * 100, count > 0 ? 3 : 0) : 0
          const isHovered = hoveredK === k
          const color = qualifies ? '#4caf50' : '#4a9eff'
          const hoverColor = qualifies ? '#66bb6a' : '#64b5f6'

          return (
            <div
              key={k}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', cursor: 'default' }}
              onMouseEnter={() => setHoveredK(k)}
              onMouseLeave={() => setHoveredK(null)}
            >
              {isHovered && (
                <div style={{
                  position: 'absolute',
                  bottom: barHeight + 26,
                  background: '#1a2540',
                  border: `1px solid ${color}`,
                  borderRadius: 5,
                  padding: '5px 9px',
                  fontSize: 11,
                  color: '#e8eaf0',
                  whiteSpace: 'nowrap',
                  zIndex: 10,
                  pointerEvents: 'none',
                }}>
                  <div style={{ fontWeight: 'bold' }}>k = {k}</div>
                  <div style={{ color }}>{count.toLocaleString()} runs ({(p * 100).toFixed(1)}%)</div>
                  {qualifies && <div style={{ color: '#4caf50', fontSize: 10 }}>✓ Qualifies</div>}
                </div>
              )}
              <div style={{
                width: '100%',
                height: barHeight,
                background: isHovered ? hoverColor : color,
                borderRadius: '2px 2px 0 0',
                opacity: count === 0 ? 0.15 : 1,
                transition: 'background 0.12s',
              }} />
              <div style={{ fontSize: 9, color: qualifies ? '#4caf50' : '#445577', marginTop: 3, fontWeight: qualifies ? 'bold' : 'normal' }}>
                {k}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Per-district rate table (compact, sorted by district number)
// ---------------------------------------------------------------------------
function DistrictRateTable({ districtRates, districts, dpProbs }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 11, color: '#445577', marginBottom: 8, letterSpacing: '0.04em' }}>
        Per-district qualification rate vs model probability
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
        gap: 6,
      }}>
        {districtRates.map((rate, i) => {
          const d = districts[i]
          const dpProb = dpProbs[i]
          const diff = rate - dpProb
          const diffColor = Math.abs(diff) < 0.03 ? '#445577' : diff > 0 ? '#4caf50' : '#ff7043'
          const diffSign = diff >= 0 ? '+' : ''
          const isConfirmed = d?.tier === 'CONFIRMED'
          return (
            <div key={i} style={{
              background: '#111827',
              border: '1px solid #1a2540',
              borderRadius: 5,
              padding: '7px 10px',
              fontSize: 11,
            }}>
              <div style={{ color: '#8899bb', marginBottom: 2, fontWeight: 'bold' }}>D{d?.d ?? i + 1}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ color: '#e8eaf0' }}>{(rate * 100).toFixed(1)}%</span>
                {!isConfirmed && (
                  <span style={{ fontSize: 10, color: diffColor }}>
                    {diffSign}{(diff * 100).toFixed(1)}
                  </span>
                )}
                {isConfirmed && (
                  <span style={{ fontSize: 10, color: '#4caf50' }}>✓</span>
                )}
              </div>
              <div style={{ fontSize: 9, color: '#334466', marginTop: 1 }}>
                model {(dpProb * 100).toFixed(1)}%
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function MonteCarloPanel({ districts, overall }) {
  const [numRuns, setNumRuns] = useState(1_000)
  const [result, setResult] = useState(null)
  const [running, setRunning] = useState(false)

  // Extract ordered district probs and DP probs from data
  const districtProbs = useMemo(
    () => (districts ?? []).map(d => d.prob ?? 0),
    [districts]
  )

  const dpPQualify = overall?.pQualify ?? 0

  const handleRun = useCallback(() => {
    if (running || districtProbs.length === 0) return
    setRunning(true)
    // Yield to the browser for one frame so the button state updates visually
    requestAnimationFrame(() => {
      const t0 = performance.now()
      const sim = runSimulation(districtProbs, numRuns)
      const elapsed = performance.now() - t0
      setResult({ ...sim, elapsed })
      setRunning(false)
    })
  }, [districtProbs, numRuns, running])

  const convergenceDiff = result
    ? Math.abs(result.pQualify - dpPQualify) * 100
    : null

  return (
    <div style={{
      background: '#0d1530',
      border: '1px solid #1e2a4a',
      borderRadius: 10,
      padding: '24px 28px',
    }}>
      {/* Header */}
      <div style={{
        fontSize: 13,
        fontWeight: 'bold',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#8899bb',
        marginBottom: 4,
      }}>
        Monte Carlo Simulation
      </div>
      <div style={{ fontSize: 11, color: '#334466', marginBottom: 20, lineHeight: 1.5 }}>
        Samples each district independently using its model probability.
        Results should converge toward the DP exact answer with more runs.
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <span style={{ fontSize: 11, color: '#445577' }}>Runs:</span>
        {RUN_OPTIONS.map(n => (
          <button
            key={n}
            onClick={() => setNumRuns(n)}
            style={{
              background: numRuns === n ? '#1e2a4a' : 'transparent',
              border: `1px solid ${numRuns === n ? '#4a9eff' : '#1e2a4a'}`,
              borderRadius: 5,
              color: numRuns === n ? '#4a9eff' : '#445577',
              fontSize: 11,
              padding: '4px 12px',
              cursor: 'pointer',
              fontFamily: 'monospace',
              letterSpacing: '0.04em',
            }}
          >
            {n.toLocaleString()}
          </button>
        ))}

        <button
          onClick={handleRun}
          disabled={running}
          style={{
            background: running ? '#1a2540' : '#1a3a5c',
            border: '1px solid #4a9eff',
            borderRadius: 5,
            color: running ? '#445577' : '#4a9eff',
            fontSize: 12,
            fontWeight: 'bold',
            padding: '5px 18px',
            cursor: running ? 'not-allowed' : 'pointer',
            letterSpacing: '0.06em',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          {running ? 'Running…' : '▶ Run'}
        </button>

        {result && (
          <span style={{ fontSize: 10, color: '#334466', fontFamily: 'monospace' }}>
            {result.elapsed.toFixed(1)}ms
          </span>
        )}
      </div>

      {/* Results */}
      {result && (
        <>
          {/* Summary row */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
            <div style={{
              background: '#111827',
              border: '1px solid #1e3a2a',
              borderRadius: 7,
              padding: '12px 20px',
              minWidth: 140,
            }}>
              <div style={{ fontSize: 11, color: '#4caf50', marginBottom: 4, letterSpacing: '0.06em' }}>
                Sim P(qualify)
              </div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#e8eaf0' }}>
                {(result.pQualify * 100).toFixed(result.numRuns >= 10_000 ? 2 : 1)}%
              </div>
              <div style={{ fontSize: 10, color: '#334466', marginTop: 2 }}>
                {result.numRuns.toLocaleString()} runs
              </div>
            </div>

            <div style={{
              background: '#111827',
              border: '1px solid #1e2a3a',
              borderRadius: 7,
              padding: '12px 20px',
              minWidth: 140,
            }}>
              <div style={{ fontSize: 11, color: '#4a9eff', marginBottom: 4, letterSpacing: '0.06em' }}>
                DP Exact P(qualify)
              </div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#e8eaf0' }}>
                {(dpPQualify * 100).toFixed(3)}%
              </div>
              <div style={{ fontSize: 10, color: '#334466', marginTop: 2 }}>
                analytical
              </div>
            </div>

            <div style={{
              background: '#111827',
              border: `1px solid ${convergenceDiff < 2 ? '#1e3a2a' : '#3a2a1e'}`,
              borderRadius: 7,
              padding: '12px 20px',
              minWidth: 140,
            }}>
              <div style={{ fontSize: 11, color: convergenceDiff < 2 ? '#4caf50' : '#ffca28', marginBottom: 4, letterSpacing: '0.06em' }}>
                Δ vs Exact
              </div>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#e8eaf0' }}>
                {convergenceDiff.toFixed(2)}<span style={{ fontSize: 14, color: '#445577' }}>pp</span>
              </div>
              <div style={{ fontSize: 10, color: '#334466', marginTop: 2 }}>
                {convergenceDiff < 0.5 ? 'converged' : convergenceDiff < 2 ? 'close' : 'still noisy'}
              </div>
            </div>
          </div>

          <SimHistogram histogram={result.histogram} numRuns={result.numRuns} />

          <DistrictRateTable
            districtRates={result.districtRates}
            districts={districts}
            dpProbs={districtProbs}
          />
        </>
      )}

      {!result && (
        <div style={{ fontSize: 11, color: '#2a3a55', fontStyle: 'italic', textAlign: 'center', padding: '20px 0' }}>
          Select a run count and press Run to simulate.
        </div>
      )}
    </div>
  )
}
