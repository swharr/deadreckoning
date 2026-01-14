import React, { useState, useEffect, useRef } from 'react'
import { THRESHOLDS } from '../lib/probability.js'

function useCountUp(target, duration = 1200) {
  const [value, setValue] = useState(0)
  const rafRef = useRef(null)

  useEffect(() => {
    if (target === 0) { setValue(0); return }
    const start = performance.now()
    const animate = (now) => {
      const elapsed = now - start
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(eased * target))
      if (progress < 1) rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])

  return value
}

function kpiColor(pQualify) {
  if (pQualify >= 0.40) return '#4caf50'
  if (pQualify >= 0.25) return '#ffca28'
  return '#ef5350'
}

const cardStyle = {
  background: '#0d1530',
  border: '1px solid #1e2a4a',
  borderRadius: 10,
  padding: '22px 24px',
  flex: '1 1 200px',
  minWidth: 180,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
}

const labelStyle = {
  fontSize: 11,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: '#556688',
  fontWeight: 'bold',
}

const bigNum = (color) => ({
  fontSize: 36,
  fontWeight: 'bold',
  color: color || '#e8eaf0',
  lineHeight: 1.1,
  animation: 'countUp 0.4s ease-out',
})

const subStyle = {
  fontSize: 12,
  color: '#445577',
  marginTop: 2,
}

export default function StatCards({ overall, meta, districts }) {
  const pQualify = overall?.pQualify ?? 0
  const expectedDist = overall?.expectedDistricts ?? 0
  const totalVerified = meta?.totalVerified ?? 0

  const confirmedCount = (districts || []).filter(d => {
    const threshold = THRESHOLDS[d.d] || d.threshold
    return d.verified >= threshold
  }).length

  // Animate the probability percentage (0–100)
  const pPct = Math.round(pQualify * 100)
  const animatedPct = useCountUp(pPct)
  const animatedVerified = useCountUp(totalVerified)
  const animatedExpected10 = useCountUp(Math.round(expectedDist * 10))
  const animatedConfirmed = useCountUp(confirmedCount)

  const probColor = kpiColor(pQualify)

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 16,
    }}>
      {/* Card 1: Ballot Probability */}
      <div style={{ ...cardStyle, borderTop: `3px solid ${probColor}` }}>
        <div style={labelStyle}>Ballot Probability</div>
        <div style={bigNum(probColor)}>{animatedPct}%</div>
        <div style={subStyle}>P(≥26 districts qualify)</div>
      </div>

      {/* Card 2: Expected Districts */}
      <div style={{ ...cardStyle, borderTop: '3px solid #4a9eff' }}>
        <div style={labelStyle}>Expected Districts</div>
        <div style={bigNum('#4a9eff')}>
          {(animatedExpected10 / 10).toFixed(1)}
        </div>
        <div style={subStyle}>of 29 required districts</div>
      </div>

      {/* Card 3: Verified Signatures */}
      <div style={{ ...cardStyle, borderTop: '3px solid #69f0ae' }}>
        <div style={labelStyle}>Verified Signatures</div>
        <div style={bigNum('#69f0ae')}>{animatedVerified.toLocaleString()}</div>
        <div style={subStyle}>
          of {(meta?.qualificationThreshold ?? 140748).toLocaleString()} statewide target
        </div>
      </div>

      {/* Card 4: Already Confirmed */}
      <div style={{ ...cardStyle, borderTop: '3px solid #00c853' }}>
        <div style={labelStyle}>Already Confirmed</div>
        <div style={bigNum('#00c853')}>{animatedConfirmed}</div>
        <div style={subStyle}>districts at or above threshold</div>
      </div>
    </div>
  )
}
