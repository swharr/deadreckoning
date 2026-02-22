import React, { useState } from 'react'

const QUALIFY_MIN = 26  // need at least 26 districts

export default function DistributionChart({ overall, modelView }) {
  const [hoveredK, setHoveredK] = useState(null)

  const isGrowthView = modelView === 'growth'
  const pExact = isGrowthView
    ? (overall?.pExactGrowth ?? overall?.pExact ?? [])
    : (overall?.pExact ?? [])

  // Show k = 0..29
  const kMin = 0
  const kMax = 29
  const buckets = []
  for (let k = kMin; k <= kMax; k++) {
    buckets.push({ k, p: pExact[k] ?? 0 })
  }

  const maxP = Math.max(...buckets.map(b => b.p), 0.001)

  const qualifyExact = [26, 27, 28, 29].map(k => ({
    k,
    p: pExact[k] ?? 0,
  }))

  return (
    <div style={{
      background: '#0d1530',
      border: '1px solid #1e2a4a',
      borderRadius: 10,
      padding: '24px 28px',
    }}>
      <div style={{
        fontSize: 13,
        fontWeight: 'bold',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#8899bb',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        Qualification Probability Distribution
        {isGrowthView && (
          <span style={{ fontSize: 11, color: '#4caf50', fontWeight: 'bold', letterSpacing: '0.06em' }}>
            · growth view
          </span>
        )}
      </div>

      {/* Bar chart */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 3,
        height: 160,
        position: 'relative',
        marginBottom: 8,
      }}>
        {buckets.map(({ k, p }) => {
          const qualifies = k >= QUALIFY_MIN
          const barHeight = maxP > 0 ? Math.max((p / maxP) * 140, p > 0 ? 4 : 0) : 0
          const isHovered = hoveredK === k
          const color = qualifies ? '#4caf50' : '#4a9eff'
          const hoverColor = qualifies ? '#66bb6a' : '#64b5f6'

          return (
            <div
              key={k}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'relative',
                cursor: 'pointer',
              }}
              onMouseEnter={() => setHoveredK(k)}
              onMouseLeave={() => setHoveredK(null)}
            >
              {/* Tooltip */}
              {isHovered && (
                <div style={{
                  position: 'absolute',
                  bottom: barHeight + 30,
                  background: '#1a2540',
                  border: `1px solid ${color}`,
                  borderRadius: 6,
                  padding: '6px 10px',
                  fontSize: 12,
                  color: '#e8eaf0',
                  whiteSpace: 'nowrap',
                  zIndex: 10,
                  pointerEvents: 'none',
                }}>
                  <div style={{ fontWeight: 'bold' }}>k = {k} districts</div>
                  <div style={{ color }}>{(p * 100).toFixed(3)}%</div>
                  {qualifies && <div style={{ color: '#4caf50', fontSize: 11 }}>✓ Qualifies</div>}
                </div>
              )}

              {/* "Qualifies" annotation on green bars */}
              {qualifies && k === QUALIFY_MIN && (
                <div style={{
                  position: 'absolute',
                  bottom: 170,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: 10,
                  color: '#4caf50',
                  whiteSpace: 'nowrap',
                  fontWeight: 'bold',
                  letterSpacing: '0.05em',
                }}>
                  ← QUALIFIES
                </div>
              )}

              {/* Bar */}
              <div style={{
                width: '100%',
                height: barHeight,
                background: isHovered ? hoverColor : color,
                borderRadius: '3px 3px 0 0',
                transition: 'height 0.3s ease, background 0.15s',
                marginBottom: 0,
                opacity: p === 0 ? 0.15 : 1,
              }} />

              {/* k label */}
              <div style={{
                fontSize: 9,
                color: qualifies ? '#4caf50' : '#445577',
                marginTop: 4,
                fontWeight: qualifies ? 'bold' : 'normal',
              }}>
                {k}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{
        fontSize: 11,
        color: '#334466',
        textAlign: 'center',
        marginBottom: 24,
      }}>
        Number of districts meeting 8% threshold (need ≥26)
        &nbsp;·&nbsp;
        <span style={{ color: '#4a9eff' }}>■ Does not qualify</span>
        &nbsp;&nbsp;
        <span style={{ color: '#4caf50' }}>■ Qualifies</span>
      </div>

      {/* Breakdown cards for 26–29 */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        {qualifyExact.map(({ k, p }) => (
          <div key={k} style={{
            flex: '1 1 100px',
            background: '#111827',
            border: '1px solid #1e3a2a',
            borderRadius: 7,
            padding: '12px 16px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 11, color: '#4caf50', marginBottom: 4, letterSpacing: '0.06em' }}>
              P(exactly {k})
            </div>
            <div style={{ fontSize: 22, fontWeight: 'bold', color: '#e8eaf0' }}>
              {(p * 100).toFixed(3)}%
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
