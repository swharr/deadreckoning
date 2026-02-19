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
// Biggest Losses card
// ---------------------------------------------------------------------------
function LossesCard({ losses, districts }) {
  const hasLosses = losses && losses.length > 0

  if (hasLosses) {
    return (
      <div style={card}>
        <div style={cardTitle}>📉 Biggest Losses</div>
        {losses.map(g => (
          <div key={g.d} style={row}>
            <span style={{ color: '#c8d8f0' }}>District {g.d}</span>
            <span style={{ color: '#f44336', fontWeight: 'bold' }}>{g.delta.toLocaleString()}</span>
          </div>
        ))}
      </div>
    )
  }

  // No losses — show removal campaign warning
  const highRisk = [14, 9, 7]
  const riskDistricts = (districts || []).filter(d => highRisk.includes(d.d))

  return (
    <div style={card}>
      <div style={cardTitle}>📉 Biggest Losses</div>
      <p style={emptyNote}>
        No signature removals recorded yet. However, a coordinated removal
        campaign has filed <strong style={{ color: '#ff7043' }}>1,300+ removal requests</strong>{' '}
        in Salt Lake County — clerks are processing these through March 9.
      </p>
      <div style={callout}>
        <span style={calloutTitle}>Highest-risk districts for removals:</span>
        {riskDistricts.map(d => {
          const threshold = THRESHOLDS[d.d] || d.threshold
          const pct = threshold > 0 ? ((d.verified / threshold) * 100).toFixed(1) : '—'
          return (
            <div key={d.d} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span>District {d.d}</span>
              <span style={{ color: '#ff7043' }}>{pct}% verified</span>
            </div>
          )
        })}
        {riskDistricts.length === 0 && (
          <div style={{ color: '#556688' }}>D14, D9, D7 — data pending</div>
        )}
      </div>
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
// Anomaly alert banner
// ---------------------------------------------------------------------------
function AnomalyBanner({ anomalies }) {
  if (!anomalies || anomalies.length === 0) return null

  return (
    <div style={{
      background: '#1a0800',
      border: '1px solid #b45309',
      borderRadius: 8,
      padding: '12px 18px',
      marginBottom: 16,
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
      <div>
        <div style={{
          fontSize: 13,
          fontWeight: 'bold',
          color: '#fbbf24',
          marginBottom: 6,
          letterSpacing: '0.04em',
        }}>
          Anomalous Signature Drops Detected
        </div>
        <div style={{ fontSize: 12, color: '#92680a', lineHeight: 1.7 }}>
          The following districts recorded unusually large drops between snapshots,
          consistent with packet-level fraud rejections by county clerks rather
          than normal signature-by-signature corrections.
        </div>
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {anomalies.map((a, i) => (
            <div key={i} style={{
              background: '#2a1200',
              border: '1px solid #7c3a00',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 12,
              color: '#fbbf24',
            }}>
              <strong>D{a.district}</strong>
              {' '}−{a.drop.toLocaleString()} sigs
              {' '}<span style={{ color: '#92680a' }}>({(a.dropPct * 100).toFixed(1)}%)</span>
              {' '}<span style={{ color: '#5a3a00' }}>on {a.date}</span>
            </div>
          ))}
        </div>
      </div>
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
// Main export
// ---------------------------------------------------------------------------
export default function SnapshotBoxes({ snapshot, meta, districts, overall, modelView }) {
  const anomalies = snapshot?.anomalies || []

  return (
    <div>
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
        <LossesCard
          losses={snapshot?.biggestLosses}
          districts={districts}
        />
        <PredictionCard
          snapshot={snapshot}
          meta={meta}
          districts={districts}
          overall={overall}
          modelView={modelView}
        />
      </div>
      <MethodologyPanel meta={meta} />
    </div>
  )
}
