import React, { useState, useMemo, useRef, useCallback, Component } from 'react'
import { TIER_CONFIG } from '../lib/probability.js'

// ---------------------------------------------------------------------------
// Error boundary — prevents VelocityTracker crash from taking down the page
// ---------------------------------------------------------------------------
class VelocityErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(e) { return { error: e } }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: '#0d1530', border: '1px solid #1e2a4a', borderRadius: 10, padding: 24, color: '#8899bb', fontSize: 13 }}>
          Velocity tracker unavailable: {this.state.error.message}
        </div>
      )
    }
    return this.props.children
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TREND_ARROWS = { ACCEL: '▲', STABLE: '→', DECEL: '▼' }
const TREND_COLORS = { ACCEL: '#4caf50', STABLE: '#8899bb', DECEL: '#ef5350' }

const CARD_STYLE = {
  background: '#0d1530',
  border: '1px solid #1e2a4a',
  borderRadius: 10,
  overflow: 'hidden',
}

// ---------------------------------------------------------------------------
// Sparkline — inline SVG, small-multiples normalized
// ---------------------------------------------------------------------------

function Sparkline({ values, trend, snapshotDates, width = 200, height = 40, interactive = true }) {
  const [hoverIdx, setHoverIdx] = useState(null)
  const svgRef = useRef(null)

  // Guard: need at least 2 points to draw a line
  if (!values || values.length < 2) return null

  const max = Math.max(...values, 1)
  const xStep = width / (values.length - 1)
  const pts = values.map((v, i) => ({
    x: i * xStep,
    y: height - (v / max) * (height - 4) - 2,
    v,
  }))

  const linePoints = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaPoints = [
    `0,${height}`,
    ...pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`),
    `${width},${height}`,
  ].join(' ')

  const color = TREND_COLORS[trend] || '#8899bb'
  const lastPt = pts[pts.length - 1]

  const getLabel = useCallback((idx) => {
    if (!snapshotDates || snapshotDates.length === 0) return null
    const offset = snapshotDates.length - values.length - 1
    const endDateIdx = offset + idx + 1
    return snapshotDates[endDateIdx] || null
  }, [snapshotDates, values.length])

  const handleMouseMove = useCallback((e) => {
    if (!interactive || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = x / rect.width
    const idx = Math.round(pct * (values.length - 1))
    setHoverIdx(Math.max(0, Math.min(values.length - 1, idx)))
  }, [interactive, values.length])

  const handleMouseLeave = useCallback(() => setHoverIdx(null), [])

  const hoverPt = hoverIdx !== null ? pts[hoverIdx] : null

  return (
    <div style={{ position: 'relative', display: 'inline-block', width }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        style={{ display: 'block', cursor: interactive ? 'crosshair' : 'default', overflow: 'visible' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <polygon points={areaPoints} fill={color} fillOpacity={0.12} />
        <polyline points={linePoints} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={lastPt.x} cy={lastPt.y} r={2.5} fill={color} />
        {hoverPt && (
          <>
            <line x1={hoverPt.x} y1={0} x2={hoverPt.x} y2={height} stroke={color} strokeWidth={1} strokeDasharray="2 2" strokeOpacity={0.6} />
            <circle cx={hoverPt.x} cy={hoverPt.y} r={3} fill={color} stroke="#0d1530" strokeWidth={1.5} />
          </>
        )}
      </svg>
      {hoverPt && interactive && (
        <div style={{
          position: 'absolute',
          bottom: height + 6,
          left: Math.min(Math.max(hoverPt.x - 40, 0), width - 80),
          background: '#0a0f1e',
          border: '1px solid #2a3a60',
          borderRadius: 5,
          padding: '4px 8px',
          fontSize: 10,
          color: '#e8eaf0',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          zIndex: 10,
          lineHeight: 1.5,
        }}>
          {getLabel(hoverIdx) && <div style={{ color: '#8899bb' }}>{getLabel(hoverIdx)}</div>}
          <div style={{ color, fontWeight: 'bold' }}>+{values[hoverIdx].toLocaleString()}</div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Statewide sparkline — sums all district weeklySignatures per slot
// ---------------------------------------------------------------------------

function aggregateSparkline(districts) {
  if (!districts || districts.length === 0) return []
  const len = districts[0].weeklySignatures?.length || 0
  const sums = new Array(len).fill(0)
  for (const d of districts) {
    const ws = d.weeklySignatures || []
    for (let i = 0; i < len; i++) {
      sums[i] += ws[i] || 0
    }
  }
  return sums
}

// ---------------------------------------------------------------------------
// PaceBar — thin progress bar for pctVerified
// ---------------------------------------------------------------------------

function PaceBar({ pct, tier }) {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG['UNLIKELY']
  const barPct = Math.min(pct * 100, 120)
  const barColor = cfg?.color || '#4a9eff'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 80 }}>
      <div style={{ flex: 1, height: 4, background: '#1e2a4a', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(barPct, 100)}%`, height: '100%', background: barColor, borderRadius: 2, transition: 'width 0.3s ease' }} />
      </div>
      <span style={{ fontSize: 10, color: '#8899bb', minWidth: 36, textAlign: 'right' }}>
        {(pct * 100).toFixed(1)}%
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// VelocityRow — one district row
// ---------------------------------------------------------------------------

function VelocityRow({ district, snapshotDates, isMobile }) {
  const { d, delta, trend, pctVerified, tier, weeklySignatures = [] } = district
  const trendColor = TREND_COLORS[trend] || '#8899bb'
  const trendArrow = TREND_ARROWS[trend] || '→'

  if (isMobile) {
    return (
      <div style={{ borderTop: '1px solid #1a2540', padding: '10px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 'bold', color: '#e8eaf0', minWidth: 30 }}>D{d}</span>
          <span style={{ color: trendColor, fontSize: 13, fontWeight: 'bold' }}>{trendArrow}</span>
          <span style={{ fontSize: 12, color: '#8899bb', marginLeft: 'auto' }}>
            <span style={{ color: delta >= 0 ? '#4caf50' : '#ef5350', fontWeight: 'bold' }}>
              {delta >= 0 ? '+' : ''}{delta.toLocaleString()}
            </span>
            {' '}sigs
          </span>
          <div style={{ minWidth: 100 }}>
            <PaceBar pct={pctVerified} tier={tier} />
          </div>
        </div>
        <div style={{ width: '100%' }}>
          <Sparkline values={weeklySignatures} trend={trend} snapshotDates={snapshotDates} width={280} height={32} interactive={false} />
        </div>
      </div>
    )
  }

  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: '52px 1fr 44px 80px 120px', alignItems: 'center', gap: 12, padding: '7px 20px', borderTop: '1px solid #1a2540', transition: 'background 0.1s', cursor: 'default' }}
      onMouseEnter={e => e.currentTarget.style.background = '#0f1a35'}
      onMouseLeave={e => e.currentTarget.style.background = ''}
    >
      <span style={{ fontSize: 13, fontWeight: 'bold', color: '#e8eaf0' }}>D{d}</span>
      <Sparkline values={weeklySignatures} trend={trend} snapshotDates={snapshotDates} width={200} height={36} interactive={true} />
      <span style={{ fontSize: 14, color: trendColor, fontWeight: 'bold', textAlign: 'center' }}>{trendArrow}</span>
      <span style={{ fontSize: 12, color: delta >= 0 ? '#4caf50' : '#ef5350', fontWeight: 'bold', fontFamily: 'monospace', textAlign: 'right' }}>
        {delta >= 0 ? '+' : ''}{delta.toLocaleString()}
      </span>
      <PaceBar pct={pctVerified} tier={tier} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// VelocityTracker — main export
// ---------------------------------------------------------------------------

const SORT_OPTIONS = [
  { key: 'velocity', label: 'Velocity' },
  { key: 'trend', label: 'Trend' },
  { key: 'gap', label: 'Gap' },
  { key: 'district', label: 'District' },
]

const FILTER_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'ACCEL', label: 'Accelerating' },
  { key: 'STABLE', label: 'Stable' },
  { key: 'DECEL', label: 'Decelerating' },
]

const TREND_SORT_ORDER = { ACCEL: 0, STABLE: 1, DECEL: 2 }

function VelocityTrackerInner({ districts, meta, defaultExpanded = false }) {
  const [sortKey, setSortKey] = useState('velocity')
  const [trendFilter, setTrendFilter] = useState('all')
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [isMobile] = useState(() => window.innerWidth <= 768)

  const snapshotDates = meta?.snapshotDates || []
  const statewideSparkline = useMemo(() => aggregateSparkline(districts), [districts])

  const filtered = useMemo(() => {
    let rows = districts || []
    if (trendFilter !== 'all') {
      rows = rows.filter(d => d.trend === trendFilter)
    }
    return rows.slice().sort((a, b) => {
      switch (sortKey) {
        case 'velocity': return b.delta - a.delta
        case 'trend': return (TREND_SORT_ORDER[a.trend] ?? 1) - (TREND_SORT_ORDER[b.trend] ?? 1)
        case 'gap': return (a.pctVerified - b.pctVerified)
        case 'district': return a.d - b.d
        default: return 0
      }
    })
  }, [districts, sortKey, trendFilter])

  const accelCount = (districts || []).filter(d => d.trend === 'ACCEL').length
  const stableCount = (districts || []).filter(d => d.trend === 'STABLE').length
  const decelCount = (districts || []).filter(d => d.trend === 'DECEL').length

  return (
    <div style={CARD_STYLE}>
      {/* Header — always visible, click to expand/collapse */}
      <div
        style={{ padding: '14px 20px', borderBottom: expanded ? '1px solid #1e2a4a' : 'none', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 10, color: '#4a9eff', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              ⚡ Signature Velocity
            </div>
            <div style={{ fontSize: 12, color: '#556688' }}>
              {meta?.snapshotCount || '—'} snapshots · {meta?.historyRange || ''}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 13, color: '#8899bb' }}>
              <span style={{ color: '#e8eaf0', fontWeight: 'bold', fontSize: 15 }}>
                {meta?.dailyVelocity != null ? meta.dailyVelocity.toLocaleString() : '—'}
              </span>
              {' '}sigs/day
              {meta?.daysToDeadline != null && (
                <span style={{ color: '#556688', marginLeft: 8, fontSize: 11 }}>
                  · {meta.daysToDeadline}d to deadline
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, fontSize: 11 }}>
              <span style={{ color: '#4caf50', fontWeight: 'bold' }}>{accelCount}▲</span>
              <span style={{ color: '#8899bb', fontWeight: 'bold' }}>{stableCount}→</span>
              <span style={{ color: '#ef5350', fontWeight: 'bold' }}>{decelCount}▼</span>
            </div>
            <span style={{ color: '#4a9eff', fontSize: 13, display: 'inline-block', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
              ▼
            </span>
          </div>
        </div>

        {/* Statewide sparkline — only when expanded */}
        {expanded && statewideSparkline.length > 0 && (
          <div style={{ marginTop: 12 }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 10, color: '#556688', marginBottom: 4 }}>Statewide interval totals</div>
            <Sparkline values={statewideSparkline} trend="STABLE" snapshotDates={snapshotDates} width={isMobile ? 300 : 700} height={44} interactive={!isMobile} />
          </div>
        )}
      </div>

      {/* Collapsible body */}
      {expanded && <>

        {/* Filters + sort controls */}
        <div style={{ padding: '10px 20px', borderBottom: '1px solid #1a2540', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          {isMobile ? (
            <select
              value={trendFilter}
              onChange={e => setTrendFilter(e.target.value)}
              style={{ background: '#0a0f1e', border: '1px solid #2a3a60', borderRadius: 5, color: '#e8eaf0', padding: '5px 10px', fontSize: 12, fontFamily: 'Georgia, serif' }}
            >
              {FILTER_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          ) : (
            <div style={{ display: 'flex', gap: 6 }}>
              {FILTER_OPTIONS.map(o => {
                const active = trendFilter === o.key
                let countLabel = ''
                if (o.key === 'ACCEL') countLabel = ` (${accelCount})`
                if (o.key === 'STABLE') countLabel = ` (${stableCount})`
                if (o.key === 'DECEL') countLabel = ` (${decelCount})`
                return (
                  <button
                    key={o.key}
                    onClick={e => { e.stopPropagation(); setTrendFilter(o.key) }}
                    style={{ background: active ? '#1a2a50' : 'transparent', border: `1px solid ${active ? '#2a4a80' : '#1e2a4a'}`, borderRadius: 5, color: active ? '#e8eaf0' : '#556688', padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'Georgia, serif', transition: 'all 0.15s', whiteSpace: 'nowrap' }}
                  >
                    {o.label}{countLabel}
                  </button>
                )
              })}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: '#556688', letterSpacing: '0.06em' }}>SORT</span>
            {SORT_OPTIONS.map(o => (
              <button
                key={o.key}
                onClick={e => { e.stopPropagation(); setSortKey(o.key) }}
                style={{ background: sortKey === o.key ? '#1a2a50' : 'transparent', border: `1px solid ${sortKey === o.key ? '#2a4a80' : '#1e2a4a'}`, borderRadius: 5, color: sortKey === o.key ? '#4a9eff' : '#556688', padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontFamily: 'Georgia, serif', transition: 'all 0.15s' }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Column headers (desktop only) */}
        {!isMobile && (
          <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr 44px 80px 120px', gap: 12, padding: '6px 20px', borderBottom: '1px solid #1a2540', fontSize: 10, color: '#556688', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            <span>Dist</span>
            <span>Sparkline (interval deltas)</span>
            <span style={{ textAlign: 'center' }}>Trend</span>
            <span style={{ textAlign: 'right' }}>Last Delta</span>
            <span>Pace (% of threshold)</span>
          </div>
        )}

        {/* District rows */}
        <div>
          {filtered.map(d => (
            <VelocityRow key={d.d} district={d} snapshotDates={snapshotDates} isMobile={isMobile} />
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 20px', borderTop: '1px solid #1a2540', fontSize: 10, color: '#445577', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
          <span>{filtered.length} district{filtered.length !== 1 ? 's' : ''} shown</span>
          {!isMobile && <span>Hover sparkline for date · Click headers to sort</span>}
        </div>

      </>}
    </div>
  )
}

export default function VelocityTracker(props) {
  return (
    <VelocityErrorBoundary>
      <VelocityTrackerInner {...props} />
    </VelocityErrorBoundary>
  )
}
