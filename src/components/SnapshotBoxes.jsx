import React, { useState } from 'react'

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
function GainsCard({ gains, districts, anomalies }) {
  const hasGains = gains && gains.length > 0
  const hasDrops = anomalies && anomalies.length >= 3

  // Drops section — shared between both branches
  const dropsSection = hasDrops && (
    <div style={{ marginTop: hasGains ? 16 : 0 }}>
      {hasGains && <div style={{ borderTop: '1px solid #1e2a4a', marginBottom: 14 }} />}
      <div style={{
        fontSize: 12,
        fontWeight: 'bold',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        color: '#f44336',
        marginBottom: 10,
      }}>
        📉 Biggest Drops by Day
      </div>
      {anomalies.slice(0, 6).map((a, i) => (
        <div key={i} style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '5px 0',
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
      {anomalies.length > 6 && (
        <div style={{ fontSize: 11, color: '#445577', marginTop: 6 }}>
          +{anomalies.length - 6} more
        </div>
      )}
    </div>
  )

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
        {dropsSection}
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
      <div style={cardTitle}>📈 Gains & Drops</div>
      <p style={emptyNote}>
        No new signatures recorded in this update. We're currently in the
        signature removal window — names can be withdrawn through
        <strong style={{ color: '#8899bb' }}> April 23, 2026</strong>.
      </p>
      {dropsSection}
      {byVelocity.length > 0 && (
        <div style={{ marginTop: hasDrops ? 16 : 0 }}>
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
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Signature Flow card — net new vs removals
// ---------------------------------------------------------------------------
function SignatureFlowCard({ snapshot, districts }) {
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

      {/* Districts at risk — confirmed but thin margin, sorted by tightest buffer */}
      {(() => {
        const allDists = districts || []
        // Confirmed districts sorted by surplus ascending (tightest first)
        const atRisk = allDists
          .filter(d => d.verified >= d.threshold)
          .map(d => ({
            ...d,
            surplus: d.verified - d.threshold,
            removalRate: d.postDeadlineRate || d.rejectionRate || 0,
          }))
          .sort((a, b) => a.surplus - b.surplus)
          .slice(0, 5)

        // Also show districts that have already fallen below threshold
        const belowThreshold = allDists
          .filter(d => d.verified < d.threshold)
          .map(d => ({
            ...d,
            deficit: d.threshold - d.verified,
          }))
          .sort((a, b) => a.deficit - b.deficit)

        if (atRisk.length === 0 && belowThreshold.length === 0) return null

        // Find the widest surplus for the mini bar scale
        const maxSurplus = atRisk.length > 0 ? Math.max(...atRisk.map(d => d.surplus), 1) : 1

        return (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #1e2a4a' }}>
            <div style={{ fontSize: 11, color: '#556688', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 'bold', marginBottom: 8 }}>
              Districts at risk
            </div>

            {belowThreshold.length > 0 && (
              <div style={{ marginBottom: atRisk.length > 0 ? 10 : 0 }}>
                {belowThreshold.map(d => (
                  <div key={d.d} style={{ padding: '6px 0', borderBottom: '1px solid #131c33' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: '#ef5350', fontSize: 13, fontWeight: 'bold' }}>
                        D{d.d}
                        <span style={{
                          marginLeft: 6,
                          fontSize: 9,
                          background: '#3d1a1a',
                          color: '#ef5350',
                          border: '1px solid #6a2d2d',
                          borderRadius: 3,
                          padding: '1px 5px',
                          fontWeight: 'bold',
                          letterSpacing: '0.05em',
                          verticalAlign: 'middle',
                        }}>BELOW</span>
                      </span>
                      <span style={{ fontSize: 12, color: '#ef5350', fontWeight: 'bold' }}>
                        -{d.deficit.toLocaleString()} short
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: '#556688', marginTop: 2 }}>
                      {d.verified.toLocaleString()} / {d.threshold.toLocaleString()} needed
                    </div>
                  </div>
                ))}
              </div>
            )}

            {atRisk.map(d => {
              const barPct = Math.min((d.surplus / maxSurplus) * 100, 100)
              const barColor = d.surplus < 200 ? '#ef5350'
                : d.surplus < 500 ? '#ff7043'
                : d.surplus < 1000 ? '#ffca28'
                : '#4caf50'
              return (
                <div key={d.d} style={{ padding: '6px 0', borderBottom: '1px solid #131c33' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: '#c8d8f0', fontSize: 13 }}>
                      D{d.d}
                      {d.surplus < 200 && (
                        <span style={{
                          marginLeft: 6,
                          fontSize: 9,
                          background: '#3d1a1a',
                          color: '#ff7043',
                          border: '1px solid #6a2d2d',
                          borderRadius: 3,
                          padding: '1px 5px',
                          fontWeight: 'bold',
                          letterSpacing: '0.05em',
                          verticalAlign: 'middle',
                        }}>THIN</span>
                      )}
                    </span>
                    <span style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                      {d.delta !== 0 && (
                        <span style={{ fontSize: 11, color: d.delta < 0 ? '#ef5350' : '#4caf50' }}>
                          {d.delta > 0 ? '+' : ''}{d.delta}
                        </span>
                      )}
                      <span style={{ fontSize: 13, fontWeight: 'bold', color: barColor }}>
                        +{d.surplus.toLocaleString()}
                      </span>
                    </span>
                  </div>
                  {/* Surplus buffer bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                    <div style={{ flex: 1, height: 3, background: '#1a2040', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{
                        width: `${barPct}%`,
                        height: '100%',
                        background: barColor,
                        borderRadius: 2,
                        transition: 'width 0.3s ease',
                      }} />
                    </div>
                    {d.removalRate > 0 && (
                      <span style={{ fontSize: 10, color: '#556688', whiteSpace: 'nowrap' }}>
                        {(d.removalRate * 100).toFixed(1)}% rej
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inline tooltip for scenario range labels
// ---------------------------------------------------------------------------
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

      {meta?.lastUpdated && meta?.clerkDeadline && (() => {
        // Compute next M–F business day after last data date, capped at clerkDeadline
        const d = new Date(meta.lastUpdated + 'T12:00:00Z')
        do { d.setUTCDate(d.getUTCDate() + 1) } while (d.getUTCDay() === 0 || d.getUTCDay() === 6)
        const nextBizDay = d.toISOString().slice(0, 10)
        const cap = meta.clerkDeadline
        const nextUpdate = nextBizDay <= cap ? nextBizDay : cap
        return (
          <div style={{ marginTop: 14, fontSize: 12, color: '#445577' }}>
            Next update expected: <strong style={{ color: '#4a9eff' }}>{nextUpdate}</strong>
          </div>
        )
      })()}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Newly Met Districts banner — shows when any district newly crossed threshold
// ---------------------------------------------------------------------------
function NewlyFailedBanner({ newlyFailed, districts }) {
  if (!newlyFailed || newlyFailed.length === 0) return null

  const districtMap = {}
  ;(districts || []).forEach(d => { districtMap[d.d] = d })

  return (
    <div style={{
      background: '#1a0a0a',
      border: '1px solid #7f1d1d',
      borderRadius: 10,
      padding: '16px 20px',
      marginBottom: 16,
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 12,
    }}>
      <span style={{ fontSize: 24 }}>⚠️</span>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ color: '#f44336', fontWeight: 'bold', fontSize: 14 }}>
          {newlyFailed.length === 1
            ? `District ${newlyFailed[0]} dropped below threshold`
            : `${newlyFailed.length} districts dropped below threshold`}
        </div>
        {newlyFailed.map(dNum => {
          const d = districtMap[dNum]
          if (!d) return null
          const deficit = d.threshold - d.verified
          return (
            <div key={dNum} style={{ fontSize: 12, color: '#ff7043', marginTop: 2 }}>
              D{dNum}: {d.verified.toLocaleString()} / {d.threshold.toLocaleString()} needed ({deficit.toLocaleString()} short)
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
function ConfirmedDistrictsCard({ districts }) {
  const confirmed = (districts || []).filter(d => d.verified >= d.threshold)
    .sort((a, b) => (a.verified / a.threshold) - (b.verified / b.threshold))  // tightest margins first
  const newlyFailedSet = new Set(
    (districts || []).filter(d => {
      const prev = d.prevVerified ?? d.verified
      return prev >= d.threshold && d.verified < d.threshold
    }).map(d => d.d)
  )
  const totalDelta = confirmed.reduce((sum, d) => sum + (d.delta || 0), 0)

  return (
    <div style={card}>
      <div style={cardTitle}>✅ Confirmed Districts</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontSize: 13, color: '#8899bb' }}>{confirmed.length} of 26 required</span>
        <span style={{ fontSize: 13, fontWeight: 'bold', color: totalDelta < 0 ? '#ff7043' : totalDelta > 0 ? '#4caf50' : '#556688' }}>
          {totalDelta > 0 ? '+' : ''}{totalDelta.toLocaleString()} net today
        </span>
      </div>
      {confirmed.length === 0 ? (
        <p style={emptyNote}>No districts have met their threshold yet.</p>
      ) : (
        confirmed.map(d => {
          const surplus = d.verified - d.threshold
          const delta = d.delta || 0
          const intervalRemoved = d.intervalRemoved || 0
          const atRisk = surplus < 200  // thin margin
          return (
            <div key={d.d} style={{
              ...row,
              background: atRisk ? 'rgba(255, 112, 67, 0.06)' : 'transparent',
              borderRadius: 4,
              padding: '6px 4px',
            }}>
              <span style={{ color: '#c8d8f0' }}>
                District {d.d}
                {atRisk && (
                  <span style={{
                    marginLeft: 6,
                    fontSize: 10,
                    background: '#3d1a1a',
                    color: '#ff7043',
                    border: '1px solid #6a2d2d',
                    borderRadius: 4,
                    padding: '1px 5px',
                    fontWeight: 'bold',
                    letterSpacing: '0.05em',
                    verticalAlign: 'middle',
                  }}>THIN</span>
                )}
              </span>
              <span style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1.2 }}>
                  <span style={{ fontSize: 12, color: delta < 0 ? '#ff7043' : delta > 0 ? '#4caf50' : '#556688' }}>
                    {delta > 0 ? '+' : ''}{delta}
                  </span>
                  {intervalRemoved > 0 && (
                    <span style={{ fontSize: 10, color: '#ff7043' }}>
                      -{intervalRemoved.toLocaleString()} removed
                    </span>
                  )}
                </span>
                <span style={{ color: '#4caf50', fontWeight: 'bold' }}>+{surplus.toLocaleString()}</span>
              </span>
            </div>
          )
        })
      )}
      {newlyFailedSet.size > 0 && (
        <div style={{ marginTop: 10, fontSize: 12, color: '#ff7043', fontWeight: 'bold' }}>
          ⚠️ {newlyFailedSet.size} district{newlyFailedSet.size !== 1 ? 's' : ''} dropped below threshold
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Biggest Drops by Day — compact inline list, only shows with 3+ anomalies
// ---------------------------------------------------------------------------
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
              District Rule Probability
            </div>
            <p style={{ margin: 0 }}>
              We run an exact dynamic programming calculation across all 29 independent district
              outcomes — each with its own probability — to compute the precise probability that
              at least 26 of 29 reach their threshold. The statewide signature target is tracked
              separately below, so this number should be read as the district-rule side of ballot qualification.
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

  // Best estimate of final statewide count (raw district projections, no removal haircut)
  const projectedRaw = overall?.projectedStatewideRaw ?? projectedFinalCount
  const projectedSurplus = projectedRaw > 0 ? Math.round(projectedRaw - target) : null

  const alreadyMet = current >= target
  const pPct = Math.round(pReachTarget * 100)
  const pColor = pPct >= 70 ? '#4caf50' : pPct >= 40 ? '#ffc107' : '#f44336'
  const barPct = Math.min(pctComplete * 100, 100)
  // Clerk verification window progress (Feb 15 → Mar 9)
  const windowStart = new Date('2026-02-15T00:00:00')
  const windowEnd   = new Date('2026-03-09T00:00:00')
  const today       = new Date()
  today.setHours(0, 0, 0, 0)
  const bizDaysBetween = (a, b) => {
    let count = 0
    const d = new Date(a)
    while (d <= b) {
      const day = d.getDay()
      if (day !== 0 && day !== 6) count++
      d.setDate(d.getDate() + 1)
    }
    return count
  }
  const clamped = today < windowStart ? windowStart : today > windowEnd ? windowEnd : today
  const remainingBizDays = bizDaysBetween(
    clamped < windowEnd ? new Date(clamped.getTime() + 86400000) : windowEnd,
    windowEnd,
  )

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
                {projectedSurplus !== null && (
                  <div style={{ color: projectedSurplus >= 0 ? '#4caf50' : '#ff7043', marginTop: 2 }}>
                    {projectedSurplus >= 0 ? '+' : ''}{projectedSurplus.toLocaleString()} projected vs {target.toLocaleString()} target
                  </div>
                )}
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
          </div>
        </>
      )}

      {/* Ballot Timeline — unified phases */}
      {(() => {
        const submissionEnd = new Date('2026-02-15T00:00:00')
        const clerkEnd      = new Date('2026-03-09T00:00:00')
        const removalEnd    = new Date('2026-04-23T00:00:00')
        const ballotDate    = new Date('2026-04-30T00:00:00')
        const asOfIso = `${meta?.lastUpdated || '2026-03-09'}T00:00:00`
        const now = new Date(asOfIso)
        now.setHours(0, 0, 0, 0)

        // Business-day counter between two dates (inclusive of both)
        const bizDaysBtwn = (a, b) => {
          let count = 0
          const d = new Date(a)
          while (d <= b) {
            const day = d.getDay()
            if (day !== 0 && day !== 6) count++
            d.setDate(d.getDate() + 1)
          }
          return count
        }

        // Phase statuses
        const submissionDone = now > submissionEnd
        const clerkDone      = now > clerkEnd
        const removalDone    = now > removalEnd

        // Removal window progress
        const removalTotalBiz   = bizDaysBtwn(clerkEnd, removalEnd)
        const removalClampedNow = now < clerkEnd ? clerkEnd : now > removalEnd ? removalEnd : now
        const removalElapsedBiz = bizDaysBtwn(clerkEnd, removalClampedNow)
        const removalRemainingBiz = removalDone ? 0 : bizDaysBtwn(
          new Date(Math.max(now.getTime(), clerkEnd.getTime()) + 86400000),
          removalEnd,
        )
        const removalPct = removalTotalBiz > 0 ? Math.min((removalElapsedBiz / removalTotalBiz) * 100, 100) : 0

        // The overall timeline runs Feb 15 → Apr 30
        const totalSpan = ballotDate.getTime() - submissionEnd.getTime()
        const clerkPct   = ((clerkEnd.getTime()   - submissionEnd.getTime()) / totalSpan) * 100
        const removalPctOfTotal = ((removalEnd.getTime() - clerkEnd.getTime()) / totalSpan) * 100
        const ballotPctOfTotal  = 100 - clerkPct - removalPctOfTotal

        // Where is "now" on the overall bar?
        const nowPct = Math.min(Math.max(((now.getTime() - submissionEnd.getTime()) / totalSpan) * 100, 0), 100)

        const phaseStyle = (done, active) => ({
          fontSize: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 0',
          borderBottom: '1px solid #131c33',
          color: done ? '#4caf50' : active ? '#e8eaf0' : '#445577',
        })

        return (
          <div style={{ borderTop: '1px solid #1e2a4a', marginTop: 16, paddingTop: 14 }}>
            <div style={{ fontSize: 11, color: '#556688', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 'bold', marginBottom: 12 }}>
              Ballot Timeline
            </div>

            {/* Overall timeline bar */}
            <div style={{ position: 'relative', marginBottom: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#445577', marginBottom: 4 }}>
                <span>Feb 15</span>
                <span>Mar 9</span>
                <span>Apr 23</span>
                <span>Apr 30</span>
              </div>
              <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                {/* Clerk verification segment */}
                <div style={{
                  width: `${clerkPct}%`,
                  background: clerkDone ? '#4caf50' : '#4a9eff',
                  transition: 'width 0.3s ease',
                }} />
                {/* Removal window segment */}
                <div style={{
                  width: `${removalPctOfTotal}%`,
                  background: removalDone ? '#4caf50' : '#1a2040',
                  position: 'relative',
                  overflow: 'hidden',
                }}>
                  {/* Fill within removal segment */}
                  {!removalDone && clerkDone && (
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      top: 0,
                      height: '100%',
                      width: `${removalPct}%`,
                      background: '#ff7043',
                      transition: 'width 0.3s ease',
                    }} />
                  )}
                  {removalDone && (
                    <div style={{ width: '100%', height: '100%', background: '#4caf50' }} />
                  )}
                </div>
                {/* Ballot confirmation segment */}
                <div style={{
                  width: `${ballotPctOfTotal}%`,
                  background: removalDone ? '#4a9eff' : '#0d1530',
                  borderLeft: '1px solid #1e2a4a',
                }} />
              </div>
              {/* "Now" marker */}
              {nowPct > 0 && nowPct < 100 && (
                <div style={{
                  position: 'absolute',
                  left: `${nowPct}%`,
                  bottom: 0,
                  transform: 'translateX(-50%)',
                  width: 2,
                  height: 8,
                  background: '#e8eaf0',
                  borderRadius: 1,
                }} />
              )}
            </div>

            {/* Phase checklist */}
            <div style={{ marginTop: 10 }}>
              <div style={phaseStyle(submissionDone, false)}>
                <span>{submissionDone ? '✓' : '○'} Signature submission</span>
                <span style={{ fontSize: 11, color: '#556688' }}>Ended Feb 15</span>
              </div>
              <div style={phaseStyle(clerkDone, !clerkDone && submissionDone)}>
                <span>{clerkDone ? '✓' : '◉'} Clerk verification</span>
                <span style={{ fontSize: 11, color: clerkDone ? '#4caf50' : '#4a9eff' }}>
                  {clerkDone ? 'Ended Mar 9' : `${remainingBizDays} biz days left`}
                </span>
              </div>
              <div style={phaseStyle(removalDone, !removalDone && clerkDone)}>
                <span>{removalDone ? '✓' : clerkDone ? '◉' : '○'} Signature removal window</span>
                <span style={{ fontSize: 11, color: removalDone ? '#4caf50' : clerkDone ? '#ff7043' : '#445577', fontWeight: clerkDone && !removalDone ? 'bold' : 'normal' }}>
                  {removalDone
                    ? 'Ended Apr 23'
                    : clerkDone
                      ? <>{removalRemainingBiz} <span style={{ fontWeight: 'normal', color: '#8899bb' }}>business days left</span></>
                      : 'Apr 23'}
                </span>
              </div>
              <div style={{ ...phaseStyle(false, removalDone), borderBottom: 'none' }}>
                <span>{removalDone ? '◉' : '○'} LG certifies for November ballot</span>
                <span style={{ fontSize: 11, color: removalDone ? '#4a9eff' : '#445577' }}>Apr 30</span>
              </div>
            </div>

            {/* Active phase callout */}
            {clerkDone && !removalDone && (
              <div style={{
                marginTop: 10,
                background: '#1a1000',
                border: '1px solid #3d2800',
                borderRadius: 6,
                padding: '10px 14px',
                fontSize: 12,
                color: '#cc8833',
                lineHeight: 1.6,
              }}>
                <strong style={{ color: '#ff7043' }}>Removal window open.</strong>{' '}
                Signers can remove their names through Apr 23.
                If the petition stays above {target.toLocaleString()} statewide
                and meets 26/29 districts, it goes on the ballot Apr 30.
              </div>
            )}
            {!clerkDone && (
              <div style={{
                marginTop: 10,
                background: '#001020',
                border: '1px solid #1a3050',
                borderRadius: 6,
                padding: '10px 14px',
                fontSize: 12,
                color: '#6699bb',
                lineHeight: 1.6,
              }}>
                County clerks are validating signatures through <strong style={{ color: '#4a9eff' }}>Mar 9</strong>.
                Counts may decrease as invalid signatures are removed.
              </div>
            )}
          </div>
        )
      })()}
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
  const newlyFailed = snapshot?.newlyFailed || []

  return (
    <div>
      <NewlyFailedBanner newlyFailed={newlyFailed} districts={districts} />
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <GainsCard
          gains={snapshot?.biggestGains}
          districts={districts}
          anomalies={anomalies}
        />
        <SignatureFlowCard
          snapshot={snapshot}
          districts={districts}
        />
        <ConfirmedDistrictsCard
          districts={districts}
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
