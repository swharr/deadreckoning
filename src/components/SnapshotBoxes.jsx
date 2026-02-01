import React from 'react'
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
        through <strong style={{ color: '#8899bb' }}>March 7, 2026</strong>.
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
        in Salt Lake County — clerks are processing these through March 7.
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
// Change from Base Prediction card
// ---------------------------------------------------------------------------
function PredictionCard({ snapshot, meta, districts }) {
  const prevProb = snapshot?.overallProbDelta !== undefined
    ? null  // We'll reconstruct from districts
    : null

  // Get current overall prob from districts (reconstruct)
  const districtList = districts || []

  // Derive prevProb from snapshot.overallProbDelta and current pQualify
  // The snapshot holds overallProbDelta = newProb - prevProb
  // We need to get pQualify from the parent. We'll read from districts' probDelta.
  // Best approach: get the snapshot values via meta or reconstruct.
  // Since we don't have overall directly here, we'll show what we can.

  const probDelta = snapshot?.overallProbDelta ?? 0
  const unchanged = probDelta === 0

  // Find districts with highest final-week velocity for "what to watch"
  const byVelocity = [...districtList]
    .sort((a, b) => {
      const aLast = a.weeklySignatures?.[a.weeklySignatures.length - 1] || 0
      const bLast = b.weeklySignatures?.[b.weeklySignatures.length - 1] || 0
      return bLast - aLast
    })
    .slice(0, 3)

  return (
    <div style={card}>
      <div style={cardTitle}>🎯 Change from Base Prediction</div>

      {unchanged ? (
        <>
          <p style={{ ...emptyNote, marginBottom: 14 }}>
            <strong style={{ color: '#e8eaf0' }}>Prediction unchanged — data pending.</strong>
            <br />
            No new verified signatures have been recorded since the last update.
            Waiting for clerk verification results (due March 7).
          </p>
          <div style={callout}>
            <span style={calloutTitle}>Scenario ranges:</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>Proportional surge</span>
              <span style={{ color: '#4caf50' }}>~35–45%</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Heavy fraud rejection</span>
              <span style={{ color: '#ff7043' }}>~12–18%</span>
            </div>
          </div>
        </>
      ) : (
        <div style={{ marginBottom: 14 }}>
          <div style={{
            fontSize: 18,
            color: '#e8eaf0',
            fontWeight: 'bold',
            marginBottom: 8,
          }}>
            <span style={{ color: '#8899bb' }}>prev</span>
            {' '}→{' '}
            <span style={{ color: probDelta > 0 ? '#4caf50' : '#f44336' }}>
              {probDelta > 0 ? '▲' : '▼'}
            </span>
          </div>
          <div style={{ fontSize: 14, color: '#8899bb' }}>
            <span style={{ color: probDelta > 0 ? '#4caf50' : '#f44336', fontWeight: 'bold' }}>
              {probDelta > 0 ? '+' : ''}{(probDelta * 100).toFixed(1)} pp
            </span>
            {' '}change in qualification probability
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
// Main export
// ---------------------------------------------------------------------------
export default function SnapshotBoxes({ snapshot, meta, districts }) {
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
        />
      </div>
    </div>
  )
}
