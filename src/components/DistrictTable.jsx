import React, { useState, useMemo } from 'react'
import { TIER_CONFIG, TIER_ORDER, THRESHOLDS } from '../lib/probability.js'

const TREND_ARROWS = {
  ACCEL: { symbol: '▲', color: '#4caf50', label: 'Accelerating' },
  STABLE: { symbol: '→', color: '#8899bb', label: 'Stable' },
  DECEL: { symbol: '▼', color: '#f44336', label: 'Decelerating' },
}

function TierBadge({ tier }) {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG['NO CHANCE']
  return (
    <span style={{
      background: cfg.bg,
      color: cfg.color,
      border: `1px solid ${cfg.color}33`,
      borderRadius: 4,
      padding: '2px 7px',
      fontSize: 11,
      fontWeight: 'bold',
      letterSpacing: '0.06em',
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

function RingGauge({ value, color, size = 38, strokeWidth = 4, label }) {
  // value: 0–N (supports >1 for "second lap" districts)
  const lapped = value > 1
  const outerR = (size - strokeWidth) / 2
  const outerC = 2 * Math.PI * outerR

  // Inner ring: fits inside outer with a gap
  const innerStroke = strokeWidth - 1
  const innerR = outerR - strokeWidth - 2
  const innerC = 2 * Math.PI * innerR
  const overageFraction = lapped ? (value - 1) : 0
  const innerDash = overageFraction * innerC
  const innerGap = innerC - innerDash

  // Outer ring: always full when lapped, normal fill otherwise
  const outerFraction = lapped ? 1 : Math.min(Math.max(value, 0), 1)
  const outerDash = outerFraction * outerC
  const outerGap = outerC - outerDash

  const glowColor = lapped ? '#00c853' : color
  const glowFilter = lapped ? 'drop-shadow(0 0 3px #00c85388)' : 'none'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg
        width={size} height={size}
        style={{ transform: 'rotate(-90deg)', flexShrink: 0, filter: glowFilter }}
      >
        {/* Outer track */}
        <circle cx={size / 2} cy={size / 2} r={outerR}
          fill="none" stroke="#1e2a4a" strokeWidth={strokeWidth} />
        {/* Outer fill */}
        <circle cx={size / 2} cy={size / 2} r={outerR}
          fill="none" stroke={glowColor} strokeWidth={strokeWidth}
          strokeDasharray={`${outerDash} ${outerGap}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
        {/* Inner "second lap" ring — only shown when over 100% */}
        {lapped && innerR > 2 && (
          <>
            <circle cx={size / 2} cy={size / 2} r={innerR}
              fill="none" stroke="#1e2a4a" strokeWidth={innerStroke} />
            <circle cx={size / 2} cy={size / 2} r={innerR}
              fill="none" stroke="#69f0ae" strokeWidth={innerStroke}
              strokeDasharray={`${innerDash} ${innerGap}`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.5s ease' }}
            />
          </>
        )}
      </svg>
      <span style={{ fontSize: 14, color: glowColor, fontWeight: 'bold', minWidth: 34, textAlign: 'right' }}>
        {label}
      </span>
    </div>
  )
}

function ProbCell({ prob, tier }) {
  // Confirmed districts: show a green checkmark instead of a gauge
  if (tier === 'CONFIRMED') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width={38} height={38} viewBox="0 0 38 38" style={{ flexShrink: 0 }}>
          <circle cx={19} cy={19} r={17} fill="#003318" stroke="#00c853" strokeWidth={1.5} />
          <polyline
            points="11,19 16.5,25 27,13"
            fill="none"
            stroke="#00c853"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span style={{ fontSize: 14, color: '#00c853', fontWeight: 'bold', minWidth: 34, textAlign: 'right' }}>
          ✓
        </span>
      </div>
    )
  }

  const cfg = TIER_CONFIG[tier] || TIER_CONFIG['NO CHANCE']
  return (
    <RingGauge
      value={prob}
      color={cfg.color}
      label={`${(prob * 100).toFixed(0)}%`}
    />
  )
}

function DeltaCell({ delta, intervalRemoved }) {
  if (delta > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ color: '#4caf50', fontWeight: 'bold' }}>+{delta.toLocaleString()}</span>
        {intervalRemoved > 0 && (
          <span style={{ color: '#f44336', fontSize: 11 }}>
            -{intervalRemoved.toLocaleString()} removed
          </span>
        )}
      </div>
    )
  }
  if (delta < 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ color: '#f44336', fontWeight: 'bold' }}>{delta.toLocaleString()}</span>
        {intervalRemoved > 0 && (
          <span style={{ color: '#f44336', fontSize: 11 }}>
            -{intervalRemoved.toLocaleString()} removed
          </span>
        )}
      </div>
    )
  }
  if (intervalRemoved > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ color: '#334466' }}>—</span>
        <span style={{ color: '#f44336', fontSize: 11 }}>
          -{intervalRemoved.toLocaleString()} removed
        </span>
      </div>
    )
  }
  return <span style={{ color: '#334466' }}>—</span>
}

const thStyle = {
  textAlign: 'left',
  fontSize: 12,
  color: '#445577',
  fontWeight: 'bold',
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  padding: '8px 12px',
  borderBottom: '1px solid #1e2a4a',
  cursor: 'pointer',
  userSelect: 'none',
  whiteSpace: 'nowrap',
}

const tdStyle = {
  padding: '10px 12px',
  fontSize: 14,
  color: '#c8d8f0',
  borderBottom: '1px solid #111827',
  verticalAlign: 'middle',
}

export default function DistrictTable({ districts }) {
  const [sortKey, setSortKey] = useState('prob')
  const [sortDir, setSortDir] = useState('desc')
  const [tierFilter, setTierFilter] = useState('All')

  const tiers = useMemo(() => {
    const present = new Set((districts || []).map(d => d.tier))
    return ['All', ...TIER_ORDER.filter(t => present.has(t))]
  }, [districts])

  const sorted = useMemo(() => {
    let rows = [...(districts || [])]

    if (tierFilter !== 'All') {
      rows = rows.filter(d => d.tier === tierFilter)
    }

    rows.sort((a, b) => {
      let av = a[sortKey]
      let bv = b[sortKey]
      if (typeof av === 'string') av = av.toLowerCase()
      if (typeof bv === 'string') bv = bv.toLowerCase()
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return rows
  }, [districts, sortKey, sortDir, tierFilter])

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function sortIndicator(key) {
    if (sortKey !== key) return <span style={{ opacity: 0.3 }}> ↕</span>
    return <span style={{ color: '#4a9eff' }}>{sortDir === 'desc' ? ' ↓' : ' ↑'}</span>
  }

  return (
    <div style={{
      background: '#0d1530',
      border: '1px solid #1e2a4a',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {/* Header + tier filter */}
      <div style={{
        padding: '18px 20px 12px',
        borderBottom: '1px solid #1e2a4a',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 10,
      }}>
        <div style={{
          fontSize: 14,
          fontWeight: 'bold',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#8899bb',
          marginRight: 8,
        }}>
          Districts
        </div>

        {tiers.map(t => {
          const cfg = t !== 'All' ? TIER_CONFIG[t] : null
          const active = tierFilter === t
          return (
            <button
              key={t}
              onClick={() => setTierFilter(t)}
              style={{
                background: active ? (cfg?.bg || '#1e2a4a') : 'transparent',
                border: `1px solid ${active ? (cfg?.color || '#4a9eff') : '#1e2a4a'}`,
                color: active ? (cfg?.color || '#4a9eff') : '#445577',
                borderRadius: 4,
                padding: '3px 10px',
                fontSize: 12,
                fontWeight: 'bold',
                cursor: 'pointer',
                letterSpacing: '0.05em',
                fontFamily: 'inherit',
                transition: 'all 0.15s',
              }}
            >
              {t === 'All' ? 'All' : (TIER_CONFIG[t]?.label || t)}
            </button>
          )
        })}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#0a0f1e' }}>
              <th style={thStyle} onClick={() => handleSort('d')}>
                District{sortIndicator('d')}
              </th>
              <th style={thStyle}>Tier</th>
              <th style={thStyle} onClick={() => handleSort('trend')}>
                Trend{sortIndicator('trend')}
              </th>
              <th style={thStyle} onClick={() => handleSort('prob')}>
                Probability{sortIndicator('prob')}
              </th>
              <th style={thStyle} onClick={() => handleSort('pctVerified')}>
                Verified %{sortIndicator('pctVerified')}
              </th>
              <th style={thStyle} onClick={() => handleSort('delta')}>
                Delta{sortIndicator('delta')}
              </th>
              <th style={thStyle} onClick={() => handleSort('projectedPct')}>
                Projected %{sortIndicator('projectedPct')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(d => {
              const cfg = TIER_CONFIG[d.tier] || TIER_CONFIG['NO CHANCE']
              const trend = TREND_ARROWS[d.trend] || TREND_ARROWS.STABLE

              const met = d.pctVerified >= 1.0
              const glowOpacity = met ? 0 : Math.max(0.02, 0.10 * (1 - d.pctVerified))
              const rowBg = met ? 'transparent' : `rgba(255, 112, 67, ${glowOpacity.toFixed(3)})`

              return (
                <tr
                  key={d.d}
                  style={{
                    borderLeft: `3px solid ${cfg.color}`,
                    background: rowBg,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#0f1a35'}
                  onMouseLeave={e => e.currentTarget.style.background = rowBg}
                >
                  <td style={{ ...tdStyle, fontWeight: 'bold', color: '#e8eaf0' }}>
                    <span>D{d.d}</span>
                    <div style={{ fontSize: 11, color: '#334466', marginTop: 1 }}>
                      {(d.threshold || THRESHOLDS[d.d]).toLocaleString()} needed
                    </div>
                    {!met && (
                      <div style={{ marginTop: 4 }}>
                        <div style={{ width: 72, height: 4, borderRadius: 2, background: '#1e2a4a', overflow: 'hidden' }}>
                          <div style={{
                            width: `${Math.min(d.pctVerified * 100, 100)}%`,
                            height: '100%',
                            borderRadius: 2,
                            background: d.pctVerified >= 0.85 ? '#4caf50'
                                      : d.pctVerified >= 0.65 ? '#ffca28'
                                      : '#ff7043',
                            transition: 'width 0.4s ease',
                          }} />
                        </div>
                        <div style={{ fontSize: 11, color: '#ff7043', marginTop: 2, fontWeight: 'bold' }}>
                          {((d.threshold || THRESHOLDS[d.d]) - d.verified).toLocaleString()} to go
                        </div>
                      </div>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <TierBadge tier={d.tier} />
                  </td>
                  <td style={tdStyle}>
                    <span
                      title={trend.label}
                      style={{ color: trend.color, fontSize: 16, fontWeight: 'bold' }}
                    >
                      {trend.symbol}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <ProbCell prob={d.prob} tier={d.tier} />
                  </td>
                  <td style={tdStyle}>
                    <RingGauge
                      value={d.pctVerified}
                      color={d.pctVerified >= 1 ? '#00c853' : '#4a9eff'}
                      label={`${(d.pctVerified * 100).toFixed(1)}%`}
                    />
                  </td>
                  <td style={tdStyle}>
                    <DeltaCell delta={d.delta} intervalRemoved={d.intervalRemoved ?? 0} />
                  </td>
                  <td style={tdStyle}>
                    <span style={{
                      color: d.projectedPct >= 1 ? '#4caf50' : '#8899bb',
                      fontWeight: d.projectedPct >= 1 ? 'bold' : 'normal',
                    }}>
                      {(d.projectedPct * 100).toFixed(1)}%
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '10px 20px', fontSize: 12, color: '#334466' }}>
        {sorted.length} district{sorted.length !== 1 ? 's' : ''} shown
        {tierFilter !== 'All' && ` (filtered: ${TIER_CONFIG[tierFilter]?.label || tierFilter})`}
        &nbsp;· Click column headers to sort
      </div>
    </div>
  )
}
