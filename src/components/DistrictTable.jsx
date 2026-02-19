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
      fontSize: 10,
      fontWeight: 'bold',
      letterSpacing: '0.06em',
      whiteSpace: 'nowrap',
    }}>
      {cfg.label}
    </span>
  )
}

function ProbBar({ prob, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
      <div style={{
        flex: 1,
        height: 6,
        background: '#1e2a4a',
        borderRadius: 3,
        overflow: 'hidden',
      }}>
        <div style={{
          width: `${Math.min(prob * 100, 100)}%`,
          height: '100%',
          background: color,
          borderRadius: 3,
          transition: 'width 0.4s ease',
        }} />
      </div>
      <span style={{ fontSize: 13, color, fontWeight: 'bold', minWidth: 42, textAlign: 'right' }}>
        {(prob * 100).toFixed(0)}%
      </span>
    </div>
  )
}

function DeltaCell({ delta }) {
  if (delta > 0) {
    return <span style={{ color: '#4caf50', fontWeight: 'bold' }}>+{delta.toLocaleString()}</span>
  }
  if (delta < 0) {
    return <span style={{ color: '#f44336', fontWeight: 'bold' }}>{delta.toLocaleString()}</span>
  }
  return <span style={{ color: '#334466' }}>—</span>
}

const thStyle = {
  textAlign: 'left',
  fontSize: 11,
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
  fontSize: 13,
  color: '#c8d8f0',
  borderBottom: '1px solid #111827',
  verticalAlign: 'middle',
}

// Compute medal assignments — only for districts still collecting signatures
function useMedals(districts) {
  return useMemo(() => {
    if (!districts || districts.length === 0) return {}
    const medals = {}
    const active = districts.filter(d => d.verified < d.threshold)
    if (active.length === 0) return {}

    // Most signatures: gold, silver, bronze
    const byVerified = [...active].sort((a, b) => b.verified - a.verified)
    if (byVerified[0]) medals[byVerified[0].d] = { ...(medals[byVerified[0].d] || {}), sigs: '🥇' }
    if (byVerified[1]) medals[byVerified[1].d] = { ...(medals[byVerified[1].d] || {}), sigs: '🥈' }
    if (byVerified[2]) medals[byVerified[2].d] = { ...(medals[byVerified[2].d] || {}), sigs: '🥉' }

    // Fastest growth (highest last-interval delta)
    const byGrowth = [...active].sort((a, b) => {
      const aLast = (a.weeklySignatures || [0]).slice(-1)[0] || 0
      const bLast = (b.weeklySignatures || [0]).slice(-1)[0] || 0
      return bLast - aLast
    })
    if (byGrowth[0]) medals[byGrowth[0].d] = { ...(medals[byGrowth[0].d] || {}), growth: '🚀' }

    // Slowest growth (turtle award)
    if (byGrowth.length > 0) {
      const slowest = byGrowth[byGrowth.length - 1]
      medals[slowest.d] = { ...(medals[slowest.d] || {}), slow: '🐢' }
    }

    return medals
  }, [districts])
}

export default function DistrictTable({ districts }) {
  const [sortKey, setSortKey] = useState('prob')
  const [sortDir, setSortDir] = useState('desc')
  const [tierFilter, setTierFilter] = useState('All')
  const medals = useMedals(districts)

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
          fontSize: 13,
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
                fontSize: 11,
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

              return (
                <tr
                  key={d.d}
                  style={{
                    borderLeft: `3px solid ${cfg.color}`,
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#0f1a35'}
                  onMouseLeave={e => e.currentTarget.style.background = ''}
                >
                  <td style={{ ...tdStyle, fontWeight: 'bold', color: '#e8eaf0' }}>
                    <span>D{d.d}</span>
                    {medals[d.d]?.sigs && (
                      <span title={medals[d.d].sigs === '🥇' ? 'Most signatures' : medals[d.d].sigs === '🥈' ? '2nd most signatures' : '3rd most signatures'}
                        style={{ marginLeft: 4, fontSize: 14 }}>{medals[d.d].sigs}</span>
                    )}
                    {medals[d.d]?.growth && (
                      <span title="Fastest growth" style={{ marginLeft: 3, fontSize: 13 }}>{medals[d.d].growth}</span>
                    )}
                    {medals[d.d]?.slow && (
                      <span title="Slowest growth" style={{ marginLeft: 3, fontSize: 13 }}>{medals[d.d].slow}</span>
                    )}
                    <div style={{ fontSize: 10, color: '#334466', marginTop: 1 }}>
                      {(d.threshold || THRESHOLDS[d.d]).toLocaleString()} needed
                    </div>
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
                    <ProbBar prob={d.prob} color={cfg.color} />
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{
                        width: 60,
                        height: 4,
                        background: '#1e2a4a',
                        borderRadius: 2,
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          width: `${Math.min(d.pctVerified * 100, 100)}%`,
                          height: '100%',
                          background: d.pctVerified >= 1 ? '#00c853' : '#4a9eff',
                          borderRadius: 2,
                        }} />
                      </div>
                      <span style={{ fontSize: 12, color: '#8899bb' }}>
                        {(d.pctVerified * 100).toFixed(1)}%
                      </span>
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <DeltaCell delta={d.delta} />
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

      <div style={{ padding: '10px 20px', fontSize: 11, color: '#334466' }}>
        {sorted.length} district{sorted.length !== 1 ? 's' : ''} shown
        {tierFilter !== 'All' && ` (filtered: ${TIER_CONFIG[tierFilter]?.label || tierFilter})`}
        &nbsp;· Click column headers to sort
      </div>
    </div>
  )
}
