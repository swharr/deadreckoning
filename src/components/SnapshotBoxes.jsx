import React, { useState } from 'react'
import { THRESHOLDS } from '../lib/probability.js'

const card = {
  background: '#0d1530',
  border: '1px solid #1e2a4a',
  borderRadius: 10,
  padding: '20px 22px',
  flex: '1 1 300px',
  minWidth: 280,
}

const cardTitle = {
  fontSize: 13,
  fontWeight: 'bold',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: 14,
  color: '#8899bb',
}

const row = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '6px 0',
  borderBottom: '1px solid #131c33',
  fontSize: 14,
}

const emptyNote = {
  fontSize: 13,
  color: '#667799',
  lineHeight: 1.6,
  marginBottom: 12,
}

const callout = {
  background: '#111827',
  border: '1px solid #1e3a5a',
  borderRadius: 6,
  padding: '10px 14px',
  fontSize: 12,
  color: '#7a9cc5',
  lineHeight: 1.6,
}

const calloutTitle = {
  color: '#4a9eff',
  fontWeight: 'bold',
  marginBottom: 6,
  display: 'block',
  fontSize: 12,
}

// ---------------------------------------------------------------------------
// Biggest Gains card
// ---------------------------------------------------------------------------
function GainsCard({ gains, districts }) {
  const hasGains = gains && gains.length > 0

  if (hasGains) {
    return (
      <div style={card}>
        <div style={cardTitle}>📈 Biggest Gains</div>
        {gains.map(g => (
          <div key={g.d} style={row}>
            <span style={{ color: '#c8d8f0' }}>District {g.d}</span>
            <span style={{ color: '#4caf50', fontWeight: 'bold' }}>+{g.delta.toLocaleString()}</span>
          </div>
        ))}
      </div>
    )
  }

  // No gains — clerk verification window state
  // Find top 5 districts by final-week velocity
  const byVelocity = [...(districts || [])]
    .filter(d => d.weeklySignatures && d.weeklySignatures.length > 0)
    .sort((a, b) => {
      const aLast = a.weeklySignatures[a.weeklySignatures.length - 1] || 0
      const bLast = b.weeklySignatures[b.weeklySignatures.length - 1] || 0
      return bLast - aLast
    })
    .slice(0, 5)

  return (
    <div style={card}>
      <div style={cardTitle}>📈 Biggest Gains</div>
      <p style={emptyNote}>
        No new signatures recorded in this update. We're currently in the county clerk
        verification window — signatures submitted before Feb 15 are being reviewed
        through <strong style={{ color: '#8899bb' }}>March 9, 2026</strong>.
      </p>
      {byVelocity.length > 0 && (
        <div style={callout}>
          <span style={calloutTitle}>What to watch for — highest final-week velocity:</span>
          {byVelocity.map(d => {
            const lastWeek = d.weeklySignatures[d.weeklySignatures.length - 1] || 0
            return (
              <div key={d.d} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span>District {d.d}</span>
                <span style={{ color: '#4a9eff' }}>{lastWeek.toLocaleString()} final-wk sigs</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Signature Flow card — net new vs removals
// ---------------------------------------------------------------------------
function SignatureFlowCard({ snapshot }) {
  const flow = snapshot?.signatureFlow || {}
  const intervalNet = flow.intervalNet ?? 0
  const intervalRemovals = flow.intervalRemovals ?? 0
  const intervalGross = flow.intervalGross ?? intervalNet
  const alltimeAdded = flow.alltimeAdded ?? 0
  const alltimeRemovals = flow.alltimeRemovals ?? 0
  const districtRemovals = flow.districtRemovals || []

  const flowRow = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '7px 0',
    borderBottom: '1px solid #131c33',
  }

  return (
    <div style={card}>
      <div style={cardTitle}>🔄 Signature Flow</div>

      {/* Last interval */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: '#556688', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 'bold', marginBottom: 6 }}>
          Last update
        </div>
        <div style={flowRow}>
          <span style={{ color: '#8899bb', fontSize: 13 }}>Net new</span>
          <span style={{ color: intervalNet > 0 ? '#4caf50' : intervalNet < 0 ? '#f44336' : '#556688', fontWeight: 'bold', fontSize: 15 }}>
            {intervalNet > 0 ? '+' : ''}{intervalNet.toLocaleString()}
          </span>
        </div>
        {intervalRemovals > 0 && (
          <div style={flowRow}>
            <span style={{ color: '#8899bb', fontSize: 13 }}>Removed</span>
            <span style={{ color: '#f44336', fontWeight: 'bold', fontSize: 15 }}>
              -{intervalRemovals.toLocaleString()}
            </span>
          </div>
        )}
        {intervalGross !== intervalNet && intervalGross > 0 && (
          <div style={flowRow}>
            <span style={{ color: '#8899bb', fontSize: 13 }}>Gross added</span>
            <span style={{ color: '#4a9eff', fontWeight: 'bold', fontSize: 15 }}>
              +{intervalGross.toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* All-time totals */}
      <div style={{ marginBottom: intervalRemovals > 0 ? 14 : 0 }}>
        <div style={{ fontSize: 11, color: '#556688', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 'bold', marginBottom: 6 }}>
          All time
        </div>
        <div style={flowRow}>
          <span style={{ color: '#8899bb', fontSize: 13 }}>Total added</span>
          <span style={{ color: '#4caf50', fontWeight: 'bold', fontSize: 15 }}>
            +{alltimeAdded.toLocaleString()}
          </span>
        </div>
        <div style={flowRow}>
          <span style={{ color: '#8899bb', fontSize: 13 }}>Total removed</span>
          <span style={{ color: alltimeRemovals > 0 ? '#f44336' : '#556688', fontWeight: 'bold', fontSize: 15 }}>
            {alltimeRemovals > 0 ? `-${alltimeRemovals.toLocaleString()}` : '0'}
          </span>
        </div>
        {alltimeRemovals > 0 && alltimeAdded > 0 && (
          <div style={{ ...flowRow, borderBottom: 'none' }}>
            <span style={{ color: '#8899bb', fontSize: 13 }}>Removal rate</span>
            <span style={{ color: '#ff7043', fontWeight: 'bold', fontSize: 15 }}>
              {((alltimeRemovals / alltimeAdded) * 100).toFixed(2)}%
            </span>
          </div>
        )}
      </div>

      {/* Per-district removals if any this interval */}
      {districtRemovals.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: '#556688', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 'bold', marginBottom: 6 }}>
            Removals by district
          </div>
          {districtRemovals.map(dr => (
            <div key={dr.d} style={flowRow}>
              <span style={{ color: '#c8d8f0' }}>District {dr.d}</span>
              <span style={{ color: '#f44336', fontWeight: 'bold' }}>-{dr.removed.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline tooltip for scenario range labels
// ---------------------------------------------------------------------------
function ScenarioTooltip({ label, value, valueColor, tip }) {
  const [visible, setVisible] = useState(false)
  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', cursor: 'help' }}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
      >
        <span style={{ borderBottom: '1px dotted #445577' }}>{label}</span>
        <span style={{ color: valueColor }}>{value}</span>
      </div>
      {visible && (
        <div style={{
          marginTop: 4,
          width: '100%',
          background: '#0d1530',
          border: '1px solid #2a3a60',
          borderRadius: 7,
          padding: '9px 12px',
          fontSize: 11,
          color: '#8899bb',
          lineHeight: 1.6,
          boxShadow: '0 4px 18px rgba(0,0,0,0.6)',
        }}>
          {tip}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Prediction Outlook card
// ---------------------------------------------------------------------------
function PredictionCard({ snapshot, meta, districts, overall, modelView }) {
  const districtList = districts || []
  const isGrowthView = modelView === 'growth'

  // Switch expected districts based on model view
  const expectedDists = isGrowthView
    ? (overall?.expectedDistrictsGrowth ?? overall?.expectedDistricts ?? 0)
    : (overall?.expectedDistricts ?? 0)
  const distsDelta = snapshot?.expectedDistrictsDelta ?? 0

  // Prob getter respects model view toggle
  const getProb = (d) => isGrowthView ? (d.growthProb ?? d.prob) : d.prob

  // Top movers: districts with biggest probability delta (positive or negative)
  // Exclude districts with prevProb=0 (initial load, not a real change)
  const topMovers = [...districtList]
    .filter(d => d.probDelta !== 0 && d.prevProb > 0)
    .sort((a, b) => Math.abs(b.probDelta) - Math.abs(a.probDelta))
    .slice(0, 5)

  // Count districts by tier using model-appropriate probability
  const notMet = districtList.filter(d => d.verified < d.threshold)
  const metCount = districtList.filter(d => d.verified >= d.threshold).length
  const certainCount = notMet.filter(d => getProb(d) >= 0.9).length
  const likelyCount = notMet.filter(d => getProb(d) >= 0.5 && getProb(d) < 0.9).length
  const longShotCount = notMet.filter(d => getProb(d) > 0 && getProb(d) < 0.5).length

  const hasNewData = distsDelta !== 0 || topMovers.length > 0

  return (
    <div style={card}>
      <div style={cardTitle}>🎯 Prediction Outlook</div>

      {/* Expected qualifying districts — primary metric */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 28, fontWeight: 'bold', color: '#e8eaf0', lineHeight: 1.2 }}>
          {expectedDists.toFixed(1)}
          <span style={{ fontSize: 14, color: '#556688', fontWeight: 'normal' }}> / 26 needed</span>
        </div>
        <div style={{ fontSize: 13, color: '#667799', marginTop: 4 }}>
          expected districts meeting threshold
        </div>
        {distsDelta !== 0 && (
          <div style={{ fontSize: 13, marginTop: 4 }}>
            <span style={{ color: distsDelta > 0 ? '#4caf50' : '#f44336', fontWeight: 'bold' }}>
              {distsDelta > 0 ? '▲ +' : '▼ '}{distsDelta.toFixed(2)}
            </span>
            <span style={{ color: '#556688' }}> since last update</span>
          </div>
        )}
      </div>

      {/* District breakdown bar */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#8899bb', marginBottom: 6, flexWrap: 'wrap' }}>
          <span><span style={{ color: '#4caf50', fontWeight: 'bold' }}>{metCount}</span> met</span>
          <span><span style={{ color: '#66bb6a', fontWeight: 'bold' }}>{certainCount}</span> nearly certain</span>
          <span><span style={{ color: '#ffc107', fontWeight: 'bold' }}>{likelyCount}</span> likely</span>
          <span><span style={{ color: '#ff7043', fontWeight: 'bold' }}>{longShotCount}</span> possible</span>
        </div>
        <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: '#1a2040' }}>
          {metCount > 0 && <div style={{ flex: metCount, background: '#4caf50' }} />}
          {certainCount > 0 && <div style={{ flex: certainCount, background: '#66bb6a' }} />}
          {likelyCount > 0 && <div style={{ flex: likelyCount, background: '#ffc107' }} />}
          {longShotCount > 0 && <div style={{ flex: longShotCount, background: '#ff7043' }} />}
          <div style={{ flex: 29 - metCount - certainCount - likelyCount - longShotCount, background: '#1a2040' }} />
        </div>
      </div>

      {/* Top movers or waiting message */}
      {hasNewData && topMovers.length > 0 ? (
        <div>
          <div style={{ fontSize: 11, color: '#556688', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6, fontWeight: 'bold' }}>
            Top movers
          </div>
          {topMovers.map(d => {
            const delta = d.probDelta
            const color = delta > 0 ? '#4caf50' : '#f44336'
            return (
              <div key={d.d} style={{ ...row, borderBottom: '1px solid #131c33' }}>
                <span style={{ color: '#8899bb' }}>District {d.d}</span>
                <span style={{ color, fontWeight: 'bold', fontSize: 13 }}>
                  {delta > 0 ? '+' : ''}{(delta * 100).toFixed(1)} pp
                </span>
              </div>
            )
          })}
        </div>
      ) : (
        <div style={callout}>
          <span style={calloutTitle}>Waiting for new data</span>
          <div style={{ marginTop: 4, fontSize: 12, color: '#667799' }}>
            No new verified signatures since last update.
            Clerk verification results due by {meta?.clerkDeadline || 'March 7'}.
          </div>
        </div>
      )}

      {meta?.clerkDeadline && (
        <div style={{ marginTop: 14, fontSize: 12, color: '#445577' }}>
          Next update expected: <strong style={{ color: '#4a9eff' }}>{meta.clerkDeadline}</strong>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Newly Met Districts banner — shows when any district newly crossed threshold
// ---------------------------------------------------------------------------
function NewlyMetBanner({ newlyMet, newlyFailed, districts }) {
  const hasMet = newlyMet && newlyMet.length > 0
  const hasFailed = newlyFailed && newlyFailed.length > 0
  if (!hasMet && !hasFailed) return null

  const districtMap = {}
  ;(districts || []).forEach(d => { districtMap[d.d] = d })

  return (
    <div style={{
      background: hasMet ? 'linear-gradient(135deg, #0a1f0f 0%, #0d2a1a 100%)' : '#1a0a0a',
      border: `1px solid ${hasMet ? '#2d6a4f' : '#7f1d1d'}`,
      borderRadius: 10,
      padding: '16px 20px',
      marginBottom: 16,
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 12,
    }}>
      <span style={{ fontSize: 24 }}>{hasMet ? '🎉' : '⚠️'}</span>
      <div style={{ flex: 1, minWidth: 200 }}>
        {hasMet && (
          <div style={{ color: '#4caf50', fontWeight: 'bold', fontSize: 14, marginBottom: hasFailed ? 4 : 0 }}>
            {newlyMet.length === 1
              ? `District ${newlyMet[0]} just crossed its threshold!`
              : `${newlyMet.length} districts just crossed their thresholds!`}
          </div>
        )}
        {hasFailed && (
          <div style={{ color: '#f44336', fontWeight: 'bold', fontSize: 14 }}>
            {newlyFailed.length === 1
              ? `District ${newlyFailed[0]} dropped back below threshold.`
              : `${newlyFailed.length} districts dropped below threshold.`}
          </div>
        )}
        {hasMet && newlyMet.map(dNum => {
          const d = districtMap[dNum]
          if (!d) return null
          const pct = d.verified / d.threshold * 100
          return (
            <div key={dNum} style={{ fontSize: 12, color: '#667799', marginTop: 2 }}>
              D{dNum}: {d.verified.toLocaleString()} verified / {d.threshold.toLocaleString()} needed ({pct.toFixed(1)}%)
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Confirmed Districts card — shows all districts that have met their threshold
// ---------------------------------------------------------------------------
function ConfirmedDistrictsCard({ districts, newlyMet }) {
  const confirmed = (districts || []).filter(d => d.verified >= d.threshold)
    .sort((a, b) => (b.verified / b.threshold) - (a.verified / a.threshold))
  const newlyMetSet = new Set(newlyMet || [])

  return (
    <div style={card}>
      <div style={cardTitle}>✅ Confirmed Districts</div>
      {confirmed.length === 0 ? (
        <p style={emptyNote}>No districts have met their threshold yet.</p>
      ) : (
        confirmed.map(d => {
          const pct = (d.verified / d.threshold * 100).toFixed(1)
          const isNew = newlyMetSet.has(d.d)
          return (
            <div key={d.d} style={{
              ...row,
              background: isNew ? 'rgba(76, 175, 80, 0.06)' : 'transparent',
              borderRadius: isNew ? 4 : 0,
              padding: '6px 4px',
            }}>
              <span style={{ color: '#c8d8f0' }}>
                District {d.d}
                {isNew && (
                  <span style={{
                    marginLeft: 6,
                    fontSize: 10,
                    background: '#1a3d2a',
                    color: '#4caf50',
                    border: '1px solid #2d6a4f',
                    borderRadius: 4,
                    padding: '1px 5px',
                    fontWeight: 'bold',
                    letterSpacing: '0.05em',
                    verticalAlign: 'middle',
                  }}>NEW</span>
                )}
              </span>
              <span style={{ color: '#4caf50', fontWeight: 'bold' }}>{pct}%</span>
            </div>
          )
        })
      )}
      <div style={{ marginTop: 10, fontSize: 11, color: '#334466' }}>
        {confirmed.length} of 26 required districts confirmed
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Biggest Drops by Day — compact inline list, only shows with 3+ anomalies
// ---------------------------------------------------------------------------
function AnomalyBanner({ anomalies }) {
  if (!anomalies || anomalies.length < 3) return null

  return (
    <div style={{
      ...card,
      borderColor: '#b4530933',
      marginBottom: 16,
    }}>
      <div style={cardTitle}>📉 Biggest Drops by Day</div>
      {anomalies.slice(0, 8).map((a, i) => (
        <div key={i} style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 0',
          borderBottom: '1px solid #131c33',
          fontSize: 13,
        }}>
          <span style={{ color: '#8899bb' }}>
            D{a.district} <span style={{ color: '#445577', fontSize: 11 }}>· {a.date}</span>
          </span>
          <span style={{ color: '#f44336', fontWeight: 'bold' }}>
            −{a.drop.toLocaleString()}
            <span style={{ color: '#77444a', fontWeight: 'normal', fontSize: 11 }}> ({(a.dropPct * 100).toFixed(1)}%)</span>
          </span>
        </div>
      ))}
      {anomalies.length > 8 && (
        <div style={{ fontSize: 11, color: '#445577', marginTop: 6 }}>
          +{anomalies.length - 8} more
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// "How we calculate this" methodology panel
// ---------------------------------------------------------------------------
function MethodologyPanel({ meta }) {
  const [open, setOpen] = useState(false)
  const isSurvival = meta?.modelMode === 'survival'

  return (
    <div style={{ marginTop: 14 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'none',
          border: 'none',
          color: '#445577',
          fontSize: 12,
          cursor: 'pointer',
          padding: 0,
          fontFamily: 'Georgia, serif',
          textDecoration: 'underline',
          letterSpacing: '0.02em',
        }}
      >
        {open ? '▾' : '▸'} How we calculate this
      </button>

      {open && (
        <div style={{
          marginTop: 10,
          background: '#080d1c',
          border: '1px solid #1e2a4a',
          borderRadius: 8,
          padding: '16px 20px',
          fontSize: 12,
          color: '#667799',
          lineHeight: 1.8,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px 28px',
        }}>
          <div>
            <div style={{ color: '#4a9eff', fontWeight: 'bold', marginBottom: 6, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {isSurvival ? '⚖️ Survival Model (active)' : '📈 Growth Model (active)'}
            </div>
            {isSurvival ? (
              <p style={{ margin: 0 }}>
                The submission deadline has passed (Feb 15). No new signatures can be added.
                Each district's probability reflects how likely the current verified count will
                survive clerk review through March 9 — accounting for expected removal rates
                based on observed post-deadline drops across all 29 districts.
              </p>
            ) : (
              <p style={{ margin: 0 }}>
                Signatures are still being submitted and validated. Each district's probability
                is driven by its current verified count relative to threshold, its recent
                collection velocity, and a weighted linear projection to the submission deadline (Feb 15).
                Recent snapshots are weighted 4× more than older ones.
              </p>
            )}
          </div>

          <div>
            <div style={{ color: '#4a9eff', fontWeight: 'bold', marginBottom: 6, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Overall Ballot Probability
            </div>
            <p style={{ margin: 0 }}>
              We run an exact dynamic programming calculation across all 29 independent district
              outcomes — each with its own probability — to compute the precise probability that
              at least 26 of 29 reach their threshold. This accounts for every combination of
              which districts qualify, not just an average.
            </p>
          </div>

          <div>
            <div style={{ color: '#4a9eff', fontWeight: 'bold', marginBottom: 6, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Data Source
            </div>
            <p style={{ margin: 0 }}>
              All counts come directly from the Lt. Governor's office published xlsx file
              at vote.utah.gov — updated each business day. We do not use campaign-reported
              numbers or media estimates. Signatures are only counted after county clerk
              verification and LG posting.
            </p>
          </div>

          <div>
            <div style={{ color: '#4a9eff', fontWeight: 'bold', marginBottom: 6, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Rejection & Removal Rates
            </div>
            <p style={{ margin: 0 }}>
              Removal rates are computed from historical snapshots — the ratio of signatures
              that disappeared between updates vs. the district peak. Post-deadline rates
              isolate clerk-review removals only. Anomalous single-interval drops (≥2%)
              are flagged separately as potential packet-level fraud rejections.
            </p>
          </div>

          <div style={{
            gridColumn: '1 / -1',
            borderTop: '1px solid #1e2a4a',
            paddingTop: 14,
            marginTop: 2,
          }}>
            <div style={{ color: '#fbbf24', fontWeight: 'bold', marginBottom: 6, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              ⚠️ Why probabilities change between updates
            </div>
            <p style={{ margin: 0, color: '#556688', lineHeight: 1.8 }}>
              Probabilities are recalculated automatically each time the Lt. Governor posts new data —
              typically once per business day. They will shift as verified signature counts change,
              as clerk removals are recorded, and as the lag between submission and LG posting resolves.
              <strong style={{ color: '#8899bb' }}> This is the model updating to new evidence, not editorial adjustment.</strong>
              {' '}No numbers are manually changed. The source code for the probability model is
              available on{' '}
              <a
                href="https://github.com/swharr/deadreckoning/blob/main/MODEL-DESCRIPTION.md"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#4a9eff' }}
              >
                GitHub
              </a>
              {' '}for independent review.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Statewide Threshold Projection card
// ---------------------------------------------------------------------------
function StatewideProjectionCard({ overall, meta }) {
  const proj = overall?.statewideProjection
  if (!proj) return null

  const {
    target, current, pctComplete, remaining,
    netDailyVelocity, projectedFinalCount,
    projectedCrossingDate, daysToProjectedCrossing,
    pReachTarget, onTrack,
  } = proj

  const alreadyMet = current >= target
  const pPct = Math.round(pReachTarget * 100)
  const pColor = pPct >= 70 ? '#4caf50' : pPct >= 40 ? '#ffc107' : '#f44336'
  const barPct = Math.min(pctComplete * 100, 100)
  const daysToDeadline = meta?.daysToDeadline ?? 0
  const clerkDeadline = meta?.clerkDeadline || '2026-03-09'

  // Format crossing date nicely
  let crossingLabel = null
  if (projectedCrossingDate) {
    const d = new Date(projectedCrossingDate + 'T00:00:00')
    crossingLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div style={card}>
      <div style={cardTitle}>📊 Statewide Threshold</div>

      {alreadyMet ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 28, fontWeight: 'bold', color: '#4caf50', lineHeight: 1.2 }}>
            Target Reached!
          </div>
          <div style={{ fontSize: 13, color: '#667799', marginTop: 4 }}>
            {current.toLocaleString()} verified of {target.toLocaleString()} needed
          </div>
          <div style={{ fontSize: 13, color: '#4caf50', marginTop: 4 }}>
            +{(current - target).toLocaleString()} above threshold
          </div>
        </div>
      ) : (
        <>
          {/* Percentage complete */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 28, fontWeight: 'bold', color: '#e8eaf0', lineHeight: 1.2 }}>
              {(pctComplete * 100).toFixed(1)}%
            </div>
            <div style={{ fontSize: 13, color: '#667799', marginTop: 2 }}>
              of {target.toLocaleString()} target
            </div>
          </div>

          {/* Progress bar */}
          <div style={{
            height: 8,
            borderRadius: 4,
            background: '#1a2040',
            marginBottom: 8,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${barPct}%`,
              borderRadius: 4,
              background: barPct >= 90 ? '#4caf50' : barPct >= 70 ? '#66bb6a' : '#4a9eff',
              transition: 'width 0.3s ease',
            }} />
          </div>

          <div style={{ fontSize: 13, color: '#8899bb', marginBottom: 16 }}>
            {current.toLocaleString()} verified · {remaining.toLocaleString()} remaining
          </div>

          {/* P(reaching target) */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#556688', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 'bold', marginBottom: 6 }}>
              P(reaching {target.toLocaleString()})
            </div>
            <div style={{ fontSize: 36, fontWeight: 'bold', color: pColor, lineHeight: 1.1 }}>
              {pPct}%
            </div>
          </div>

          {/* Projected crossing or shortfall */}
          <div style={{ fontSize: 13, color: '#8899bb', lineHeight: 1.8 }}>
            {onTrack && crossingLabel ? (
              <>
                <div>
                  Projected: <strong style={{ color: '#e8eaf0' }}>{crossingLabel}</strong>
                  {daysToProjectedCrossing != null && (
                    <span style={{ color: '#556688' }}> ({daysToProjectedCrossing} day{daysToProjectedCrossing !== 1 ? 's' : ''})</span>
                  )}
                </div>
                <div style={{ color: '#556688' }}>
                  At current pace ({netDailyVelocity.toLocaleString()} net/day)
                </div>
              </>
            ) : (
              <div style={{ color: '#ff7043' }}>
                Not projected to reach target
                {projectedFinalCount > 0 && (
                  <div style={{ fontSize: 12, color: '#556688', marginTop: 2 }}>
                    Projected final: ~{projectedFinalCount.toLocaleString()}
                    {' '}(shortfall of {(target - projectedFinalCount).toLocaleString()})
                  </div>
                )}
              </div>
            )}
            <div style={{ color: '#445577', marginTop: 4 }}>
              Clerk deadline: {clerkDeadline} ({daysToDeadline} day{daysToDeadline !== 1 ? 's' : ''})
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Velocity summary card — sits in the snapshot row
// ---------------------------------------------------------------------------
function VelocityCard({ meta, districts, onExpand }) {
  const allDistricts = districts || []
  const accel = allDistricts.filter(d => d.trend === 'ACCEL').length
  const stable = allDistricts.filter(d => d.trend === 'STABLE').length
  const decel = allDistricts.filter(d => d.trend === 'DECEL').length

  const top3 = [...allDistricts]
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 3)

  const velocity = meta?.dailyVelocity

  return (
    <div style={card}>
      <div style={cardTitle}>⚡ Velocity</div>

      {/* Daily velocity */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 28, fontWeight: 'bold', color: '#4a9eff', lineHeight: 1.2 }}>
          {velocity != null ? velocity.toLocaleString() : '—'}
        </div>
        <div style={{ fontSize: 12, color: '#556688', marginTop: 2 }}>sigs / day statewide</div>
      </div>

      {/* Trend breakdown */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: '#4caf50' }}>{accel}</div>
          <div style={{ fontSize: 10, color: '#556688' }}>▲ accel</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: '#8899bb' }}>{stable}</div>
          <div style={{ fontSize: 10, color: '#556688' }}>→ stable</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 20, fontWeight: 'bold', color: '#ef5350' }}>{decel}</div>
          <div style={{ fontSize: 10, color: '#556688' }}>▼ decel</div>
        </div>
      </div>

      {/* Top 3 by delta */}
      {top3.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#556688', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 'bold', marginBottom: 6 }}>
            Top districts
          </div>
          {top3.map(d => (
            <div key={d.d} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #131c33', fontSize: 13 }}>
              <span style={{ color: '#c8d8f0' }}>District {d.d}</span>
              <span style={{ color: '#4caf50', fontWeight: 'bold' }}>+{d.delta.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Expand link */}
      <button
        onClick={onExpand}
        style={{
          background: 'none',
          border: 'none',
          color: '#4a9eff',
          fontSize: 12,
          cursor: 'pointer',
          padding: 0,
          fontFamily: 'Georgia, serif',
          textDecoration: 'underline',
          letterSpacing: '0.02em',
        }}
      >
        ▸ Show full velocity tracker
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export default function SnapshotBoxes({ snapshot, meta, districts, overall, modelView, onExpandVelocity }) {
  const anomalies = snapshot?.anomalies || []
  const newlyMet = snapshot?.newlyMet || []
  const newlyFailed = snapshot?.newlyFailed || []

  return (
    <div>
      <NewlyMetBanner newlyMet={newlyMet} newlyFailed={newlyFailed} districts={districts} />
      <AnomalyBanner anomalies={anomalies} />
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <GainsCard
          gains={snapshot?.biggestGains}
          districts={districts}
        />
        <SignatureFlowCard
          snapshot={snapshot}
        />
        <ConfirmedDistrictsCard
          districts={districts}
          newlyMet={newlyMet}
        />
        <StatewideProjectionCard
          overall={overall}
          meta={meta}
        />
        <PredictionCard
          snapshot={snapshot}
          meta={meta}
          districts={districts}
          overall={overall}
          modelView={modelView}
        />
        <VelocityCard
          meta={meta}
          districts={districts}
          onExpand={onExpandVelocity}
        />
      </div>
      <MethodologyPanel meta={meta} />
    </div>
  )
}
