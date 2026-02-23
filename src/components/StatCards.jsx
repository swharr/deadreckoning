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
  color: '#8899bb',
  marginTop: 2,
}

function confidenceColor(label) {
  if (label === 'Very High') return '#4caf50'
  if (label === 'High')      return '#69f0ae'
  if (label === 'Moderate')  return '#ffca28'
  if (label === 'Low')       return '#ff7043'
  return '#ef5350'  // Very Low
}

function confidenceExplain(components) {
  if (!components) return null
  const { dataMaturity, outcomeCertainty, modelSharpness } = components
  const matPct  = Math.round(dataMaturity     * 100)
  const certPct = Math.round(outcomeCertainty * 100)
  const sharpPct = Math.round(modelSharpness  * 100)

  // Plain-English sentence for the weakest axis
  let drag = null
  if (dataMaturity < 0.60) {
    drag = `Data maturity is the main drag (${matPct}%) — the model has only seen a portion of the clerk review window so far. Confidence will rise as more daily updates arrive before the March 9 deadline.`
  } else if (modelSharpness < 0.70) {
    drag = `Model sharpness is limiting confidence (${sharpPct}%) — the outcome distribution is still spread across several scenarios. More data will narrow it.`
  } else if (outcomeCertainty < 0.80) {
    drag = `Outcome certainty is moderate (${certPct}%) — the expected district count is close enough to the 26-district threshold that the model can't rule out a different result with high confidence.`
  } else {
    drag = `All three inputs are strong. The model has good data, a clear distribution, and the outcome is well away from the qualification threshold.`
  }

  return (
    <div style={{ marginTop: 8, fontSize: 11, color: '#334466', lineHeight: 1.6 }}>
      <span style={{ color: '#2a3a55', fontWeight: 'bold' }}>Why {Math.round((dataMaturity * outcomeCertainty * modelSharpness) * 100)}%? </span>
      {drag}
      {' '}
      <span style={{ color: '#2a3a55' }}>
        (Data maturity {matPct}% · Outcome certainty {certPct}% · Model sharpness {sharpPct}%)
      </span>
    </div>
  )
}

function ConfidenceMeter({ value, label, components }) {
  // value is 0–1
  const pct = Math.round(value * 100)
  const color = confidenceColor(label)
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: '#445577', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
          Confidence
        </span>
        <span style={{ fontSize: 11, fontWeight: 'bold', color, fontFamily: 'monospace' }}>
          {label} · {pct}%
        </span>
      </div>
      <div style={{
        height: 4,
        background: '#0a0f1e',
        borderRadius: 2,
        border: '1px solid #1e2a4a',
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: 2,
          transition: 'width 0.8s ease-out',
          opacity: 0.85,
        }} />
      </div>
      {confidenceExplain(components)}
    </div>
  )
}

export default function StatCards({ overall, meta, districts, modelView, snapshot }) {
  const isGrowthView = modelView === 'growth'
  const newlyMet = snapshot?.newlyMet || []
  const hasNewlyMet = newlyMet.length > 0

  // Switch between survival (primary) and growth shadow numbers
  const pQualify = isGrowthView
    ? (overall?.pQualifyGrowth ?? overall?.pQualify ?? 0)
    : (overall?.pQualify ?? 0)
  const expectedDist = isGrowthView
    ? (overall?.expectedDistrictsGrowth ?? overall?.expectedDistricts ?? 0)
    : (overall?.expectedDistricts ?? 0)
  const totalVerified = meta?.totalVerified ?? 0

  const confirmedCount = (districts || []).filter(d => {
    const threshold = THRESHOLDS[d.d] || d.threshold
    return d.verified >= threshold
  }).length

  const confidence = overall?.confidence ?? null
  const confidenceLabel = overall?.confidenceLabel ?? null
  const confidenceComponents = overall?.confidenceComponents ?? null

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
        <div style={subStyle}>
          P(≥26 districts qualify)
          {isGrowthView && <span style={{ color: '#4caf50', marginLeft: 4 }}>· growth view</span>}
        </div>
        {confidence !== null && confidenceLabel && (
          <ConfidenceMeter value={confidence} label={confidenceLabel} components={confidenceComponents} />
        )}
      </div>

      {/* Card 2: Expected Districts */}
      <div style={{ ...cardStyle, borderTop: '3px solid #4a9eff' }}>
        <div style={labelStyle}>Expected Districts</div>
        <div style={bigNum('#4a9eff')}>
          {(animatedExpected10 / 10).toFixed(1)}
        </div>
        <div style={subStyle}>
          of 26 required districts
          {isGrowthView && <span style={{ color: '#4caf50', marginLeft: 4 }}>· growth view</span>}
        </div>
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
      <div style={{
        ...cardStyle,
        borderTop: `3px solid ${hasNewlyMet ? '#4caf50' : '#00c853'}`,
        background: hasNewlyMet ? 'linear-gradient(135deg, #0d1530 0%, #0d2a1a 100%)' : '#0d1530',
      }}>
        <div style={labelStyle}>Districts Confirmed</div>
        <div style={bigNum('#00c853')}>{animatedConfirmed}</div>
        <div style={subStyle}>districts at or above threshold</div>
        {hasNewlyMet && (
          <div style={{
            marginTop: 6,
            fontSize: 11,
            color: '#4caf50',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            🎉 +{newlyMet.length} new this update
            {newlyMet.length <= 3 && (
              <span style={{ color: '#2d6a4f', fontWeight: 'normal' }}>
                (D{newlyMet.join(', D')})
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
