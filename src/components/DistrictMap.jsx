import React, { useState, useCallback, useRef, useEffect } from 'react'
import { DISTRICT_PATHS } from '../lib/districtPaths.js'
import { TIER_CONFIG, TIER_ORDER } from '../lib/probability.js'

// SVG viewBox: Utah-centric Transverse Mercator, upright orientation
const VIEWBOX = '0 0 800 1000'

// Wasatch Front inset: small urban/suburban districts
// D11 and D20 are large rural districts that span the inset area — shown on main map only
const INSET_DISTRICTS = [4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 25]
// Wasatch Front bounding box in SVG coords (from path extents + margin)
const INSET_X = 250
const INSET_Y = 125
const INSET_W = 193
const INSET_H = 292

const TREND_ARROWS = {
  ACCEL: { symbol: '▲', color: '#4caf50', label: 'Accelerating' },
  STABLE: { symbol: '→', color: '#8899bb', label: 'Stable' },
  DECEL: { symbol: '▼', color: '#f44336', label: 'Decelerating' },
}

function tierToFill(tier) {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG['NO CHANCE']
  return cfg.color
}

function tierToStroke(tier) {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG['NO CHANCE']
  return cfg.color + 'aa'
}

// Compute bounding-box centroid from an SVG path string
function pathCentroid(pathD) {
  const nums = pathD.match(/-?\d+\.?\d*/g).map(Number)
  let xs = [], ys = []
  for (let i = 0; i < nums.length - 1; i += 2) {
    xs.push(nums[i]); ys.push(nums[i + 1])
  }
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  }
}

export default function DistrictMap({ districts = [] }) {
  const [hovered, setHovered] = useState(null)
  const [selected, setSelected] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [containerWidth, setContainerWidth] = useState(700)
  const containerRef = useRef(null)

  // Track container width for responsive inset sizing
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width)
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  const isNarrow = containerWidth < 500

  // Build a lookup map by district number
  const byDistrict = {}
  for (const d of districts) {
    byDistrict[d.d] = d
  }

  // The "active" district is selected (sticky) or hovered (transient)
  const activeNum = selected || hovered
  const hd = activeNum ? byDistrict[activeNum] : null

  function handleMouseMove(e, distNum) {
    const rect = e.currentTarget.closest('svg').getBoundingClientRect()
    setTooltipPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
    setHovered(distNum)
  }

  // Touch: tap to select, tap again to deselect
  function handleClick(distNum) {
    setSelected(prev => prev === distNum ? null : distNum)
  }

  // Close selected when tapping outside the map
  useEffect(() => {
    function handleOutsideClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setSelected(null)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('touchstart', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('touchstart', handleOutsideClick)
    }
  }, [])

  // Clamp tooltip to stay within the container
  const clampTooltip = useCallback((x, y) => {
    const cw = containerRef.current?.offsetWidth || 700
    return {
      left: Math.min(Math.max(x + 12, 0), cw - 210),
      top: Math.max(y - 100, 0),
    }
  }, [])

  const tp = clampTooltip(tooltipPos.x, tooltipPos.y)

  // Render a single district path
  function renderPath(distNum, pathD, opts = {}) {
    const { isInset = false } = opts
    const data = byDistrict[distNum]
    const fill = data ? tierToFill(data.tier) : '#1e2a4a'
    const stroke = data ? tierToStroke(data.tier) : '#0d1530'
    const isActive = activeNum === distNum

    return (
      <path
        key={isInset ? `inset-${distNum}` : distNum}
        d={pathD}
        fill={isActive ? fill + 'dd' : fill}
        stroke={isActive ? '#ffffff' : stroke}
        strokeWidth={isActive ? (isInset ? 0.8 : 1.5) : (isInset ? 0.3 : 0.5)}
        style={{ cursor: 'pointer', transition: 'stroke 0.1s, stroke-width 0.1s, fill 0.1s' }}
        onMouseMove={e => handleMouseMove(e, distNum)}
        onMouseEnter={() => setHovered(distNum)}
        onClick={() => handleClick(distNum)}
        onTouchEnd={e => { e.preventDefault(); handleClick(distNum) }}
      />
    )
  }

  // Render a district number label
  function renderLabel(distNum, opts = {}) {
    const { isInset = false, viewX = 0, viewY = 0, viewW = 800, viewH = 1001 } = opts
    const path = DISTRICT_PATHS[distNum]
    if (!path) return null
    const { x: cx, y: cy } = pathCentroid(path)

    // For inset, skip labels outside the viewport
    if (isInset && (cx < viewX || cx > viewX + viewW || cy < viewY || cy > viewY + viewH)) return null

    const isActive = activeNum === distNum

    return (
      <text
        key={isInset ? `inset-label-${distNum}` : `label-${distNum}`}
        x={cx}
        y={cy + (isInset ? 2 : 4)}
        textAnchor="middle"
        fontSize={isInset ? 6 : 18}
        fill={isActive ? '#ffffff' : 'rgba(255,255,255,0.85)'}
        style={{
          pointerEvents: 'none',
          fontFamily: 'Georgia, serif',
          fontWeight: 'bold',
          textShadow: isActive ? '0 0 4px rgba(0,0,0,0.8)' : 'none',
        }}
      >
        {distNum}
      </text>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{
        background: '#0d1530',
        border: '1px solid #1e2a4a',
        borderRadius: 10,
        padding: '20px 24px',
      }}
    >
      <div style={{
        fontSize: 13,
        fontWeight: 'bold',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#8899bb',
        marginBottom: 4,
      }}>
        District Heatmap
      </div>
      <p style={{ fontSize: 12, color: '#445577', margin: '0 0 16px', lineHeight: 1.5 }}>
        Qualification tier by Senate district. {selected ? 'Tap another district or outside to dismiss.' : 'Hover or tap for details.'}
        {' '}Inset shows the Wasatch Front.
      </p>

      {/* Legend — driven from TIER_CONFIG */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        {TIER_ORDER.map(tier => {
          const cfg = TIER_CONFIG[tier]
          // Only show tiers that appear in the current data
          const hasDistricts = districts.some(d => d.tier === tier)
          if (!hasDistricts) return null
          return (
            <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#556688' }}>
              <div style={{ width: 12, height: 12, background: cfg.color, borderRadius: 2, flexShrink: 0 }} />
              {cfg.label}
            </div>
          )
        })}
      </div>

      <div style={{
        display: 'flex',
        flexDirection: isNarrow ? 'column' : 'row',
        gap: isNarrow ? 12 : 0,
        alignItems: isNarrow ? 'center' : 'flex-start',
        position: 'relative',
      }}>
        {/* Main map */}
        <svg
          viewBox={VIEWBOX}
          style={{
            width: isNarrow ? '100%' : '65%',
            flexShrink: 0,
            display: 'block',
          }}
          onMouseLeave={() => { if (!selected) setHovered(null) }}
        >
          {Object.entries(DISTRICT_PATHS).map(([distStr, pathD]) =>
            renderPath(parseInt(distStr, 10), pathD)
          )}

          {/* District number labels — only for larger districts on main map */}
          {Object.entries(DISTRICT_PATHS).map(([distStr]) => {
            const distNum = parseInt(distStr, 10)
            if (INSET_DISTRICTS.includes(distNum)) return null
            if (!byDistrict[distNum]) return null
            return renderLabel(distNum)
          })}

          {/* Inset box border */}
          <rect
            x={INSET_X - 2}
            y={INSET_Y - 2}
            width={INSET_W + 4}
            height={INSET_H + 4}
            fill="none"
            stroke="#000000"
            strokeWidth={3.5}
            strokeDasharray="8 4"
            style={{ pointerEvents: 'none' }}
          />
        </svg>

        {/* Inset zoomed panel for Wasatch Front — beside main map on desktop, below on mobile */}
        <div style={{
          flex: isNarrow ? undefined : 1,
          width: isNarrow ? '100%' : undefined,
          maxWidth: isNarrow ? 400 : undefined,
          background: '#080d1c',
          border: '1px solid #4a9eff',
          borderRadius: 6,
          overflow: 'hidden',
          alignSelf: isNarrow ? 'center' : 'flex-start',
          marginTop: isNarrow ? 0 : 20,
        }}>
          <div style={{ fontSize: 10, color: '#4a9eff', padding: '4px 8px', borderBottom: '1px solid #1a2540', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Wasatch Front (zoom)
          </div>
          <svg
            viewBox={`${INSET_X} ${INSET_Y} ${INSET_W} ${INSET_H}`}
            style={{ width: '100%', display: 'block' }}
            onMouseLeave={() => { if (!selected) setHovered(null) }}
          >
            {Object.entries(DISTRICT_PATHS).map(([distStr, pathD]) => {
              const distNum = parseInt(distStr, 10)
              if (!INSET_DISTRICTS.includes(distNum)) return null
              return renderPath(distNum, pathD, { isInset: true })
            })}

            {/* Inset labels */}
            {Object.entries(DISTRICT_PATHS).map(([distStr]) => {
              const distNum = parseInt(distStr, 10)
              if (!INSET_DISTRICTS.includes(distNum)) return null
              return renderLabel(distNum, { isInset: true, viewX: INSET_X, viewY: INSET_Y, viewW: INSET_W, viewH: INSET_H })
            })}
          </svg>
        </div>

        {/* Tooltip — shown for hovered or selected district */}
        {hd && (
          <div style={{
            position: 'absolute',
            left: selected ? '50%' : tp.left,
            top: selected ? undefined : tp.top,
            bottom: selected ? 8 : undefined,
            transform: selected ? 'translateX(-50%)' : 'none',
            background: '#0d1530',
            border: `1px solid ${tierToFill(hd.tier)}44`,
            borderRadius: 8,
            padding: '12px 16px',
            pointerEvents: 'none',
            zIndex: 10,
            minWidth: 200,
            maxWidth: 280,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 'bold', color: '#e8eaf0' }}>
                Senate District {hd.d}
              </div>
              <span style={{
                background: (TIER_CONFIG[hd.tier] || TIER_CONFIG['NO CHANCE']).bg,
                color: tierToFill(hd.tier),
                border: `1px solid ${tierToFill(hd.tier)}33`,
                borderRadius: 4,
                padding: '2px 7px',
                fontSize: 10,
                fontWeight: 'bold',
                letterSpacing: '0.06em',
              }}>
                {(TIER_CONFIG[hd.tier] || TIER_CONFIG['NO CHANCE']).label}
              </span>
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#667799', marginBottom: 3 }}>
                <span>
                  <span style={{ color: '#e8eaf0', fontWeight: 'bold' }}>{hd.verified.toLocaleString()}</span>
                  {' / '}{hd.threshold.toLocaleString()}
                </span>
                <span style={{ color: '#e8eaf0' }}>{Math.round(hd.pctVerified * 100)}%</span>
              </div>
              <div style={{
                height: 4,
                background: '#1e2a4a',
                borderRadius: 2,
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${Math.min(hd.pctVerified * 100, 100)}%`,
                  height: '100%',
                  background: tierToFill(hd.tier),
                  borderRadius: 2,
                }} />
              </div>
            </div>

            {/* Stats grid */}
            <div style={{ fontSize: 12, color: '#8899bb', lineHeight: 1.9 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#445577' }}>Probability</span>
                <span style={{ color: tierToFill(hd.tier), fontWeight: 'bold' }}>
                  {Math.round(hd.prob * 100)}%
                </span>
              </div>
              {hd.delta !== undefined && hd.delta !== 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#445577' }}>Delta</span>
                  <span style={{ color: hd.delta > 0 ? '#4caf50' : '#f44336', fontWeight: 'bold' }}>
                    {hd.delta > 0 ? '+' : ''}{hd.delta.toLocaleString()}
                  </span>
                </div>
              )}
              {hd.trend && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#445577' }}>Trend</span>
                  <span style={{ color: (TREND_ARROWS[hd.trend] || TREND_ARROWS.STABLE).color }}>
                    {(TREND_ARROWS[hd.trend] || TREND_ARROWS.STABLE).symbol}
                    {' '}{(TREND_ARROWS[hd.trend] || TREND_ARROWS.STABLE).label}
                  </span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#445577' }}>Projected</span>
                <span style={{
                  color: hd.projectedPct >= 1 ? '#4caf50' : '#8899bb',
                  fontWeight: hd.projectedPct >= 1 ? 'bold' : 'normal',
                }}>
                  {(hd.projectedPct * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: '#334466', textAlign: 'center' }}>
        {selected
          ? `District ${selected} selected · tap another or click outside to dismiss`
          : 'Tap or hover a district for details'
        }
      </div>
    </div>
  )
}
