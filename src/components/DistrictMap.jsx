import React, { useState } from 'react'
import { DISTRICT_PATHS } from '../lib/districtPaths.js'
import { TIER_CONFIG } from '../lib/probability.js'

// SVG viewBox from mapshaper Albers USA projection
const VIEWBOX = '0 0 800 1001'

// Salt Lake / Utah County inset: these districts are tiny slivers
// We define a zoom region (in SVG coords) to show in an inset box
// D17 is a huge rural wrapper district — show on main map only; not in inset
const INSET_DISTRICTS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23]
// Wasatch Front bounding box in SVG coords (computed from actual path extents)
const INSET_X = 340
const INSET_Y = 144
const INSET_W = 194
const INSET_H = 247

function tierToFill(tier) {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG['NO CHANCE']
  return cfg.color
}

function tierToStroke(tier) {
  const cfg = TIER_CONFIG[tier] || TIER_CONFIG['NO CHANCE']
  // Darken the tier color slightly for the stroke
  return cfg.color + 'aa'
}

export default function DistrictMap({ districts = [] }) {
  const [hovered, setHovered] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  // Build a lookup map by district number
  const byDistrict = {}
  for (const d of districts) {
    byDistrict[d.d] = d
  }

  function handleMouseMove(e, distNum) {
    const rect = e.currentTarget.closest('svg').getBoundingClientRect()
    setTooltipPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
    setHovered(distNum)
  }

  const hd = hovered ? byDistrict[hovered] : null

  return (
    <div style={{
      background: '#0d1530',
      border: '1px solid #1e2a4a',
      borderRadius: 10,
      padding: '20px 24px',
    }}>
      <div style={{
        fontSize: 13,
        fontWeight: 'bold',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#8899bb',
        marginBottom: 4,
      }}>
        🗺 District Heatmap
      </div>
      <p style={{ fontSize: 12, color: '#445577', margin: '0 0 16px', lineHeight: 1.5 }}>
        Qualification probability by Senate district. Hover for details.
        Inset shows the Wasatch Front (Salt Lake &amp; Utah County).
      </p>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        {[
          { color: '#1b5e20', label: '≥95% Nearly Certain' },
          { color: '#388e3c', label: '80–95% Very Likely' },
          { color: '#689f38', label: '65–80% Likely' },
          { color: '#f9a825', label: '50–65% Toss-Up' },
          { color: '#e65100', label: '35–50% Unlikely' },
          { color: '#b71c1c', label: '<35% Critical' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#556688' }}>
            <div style={{ width: 12, height: 12, background: color, borderRadius: 2, flexShrink: 0 }} />
            {label}
          </div>
        ))}
      </div>

      <div style={{ position: 'relative' }}>
        <svg
          viewBox={VIEWBOX}
          style={{ width: '100%', maxWidth: 700, display: 'block', margin: '0 auto' }}
          onMouseLeave={() => setHovered(null)}
        >
          {/* Main map paths */}
          {Object.entries(DISTRICT_PATHS).map(([distStr, pathD]) => {
            const distNum = parseInt(distStr, 10)
            const data = byDistrict[distNum]
            const fill = data ? tierToFill(data.tier) : '#1e2a4a'
            const stroke = data ? tierToStroke(data.tier) : '#0d1530'
            const isHovered = hovered === distNum

            return (
              <path
                key={distNum}
                d={pathD}
                fill={fill}
                stroke={isHovered ? '#ffffff' : stroke}
                strokeWidth={isHovered ? 1.5 : 0.5}
                style={{ cursor: 'pointer', transition: 'stroke 0.1s, stroke-width 0.1s' }}
                onMouseMove={e => handleMouseMove(e, distNum)}
                onMouseEnter={() => setHovered(distNum)}
              />
            )
          })}

          {/* District number labels — only for larger districts */}
          {Object.entries(DISTRICT_PATHS).map(([distStr]) => {
            const distNum = parseInt(distStr, 10)
            // Skip Wasatch Front districts — too small for labels on main map
            if (INSET_DISTRICTS.includes(distNum)) return null
            const data = byDistrict[distNum]
            if (!data) return null

            // Compute approximate centroid from path bounding box
            const path = DISTRICT_PATHS[distNum]
            const nums = path.match(/-?\d+\.?\d*/g).map(Number)
            let xs = [], ys = []
            for (let i = 0; i < nums.length - 1; i += 2) {
              xs.push(nums[i]); ys.push(nums[i + 1])
            }
            const cx = (Math.min(...xs) + Math.max(...xs)) / 2
            const cy = (Math.min(...ys) + Math.max(...ys)) / 2

            return (
              <text
                key={`label-${distNum}`}
                x={cx}
                y={cy + 4}
                textAnchor="middle"
                fontSize={10}
                fill="rgba(255,255,255,0.85)"
                style={{ pointerEvents: 'none', fontFamily: 'Georgia, serif', fontWeight: 'bold' }}
              >
                {distNum}
              </text>
            )
          })}

          {/* Inset box border */}
          <rect
            x={INSET_X - 2}
            y={INSET_Y - 2}
            width={INSET_W + 4}
            height={INSET_H + 4}
            fill="none"
            stroke="#4a9eff"
            strokeWidth={1}
            strokeDasharray="4 2"
            style={{ pointerEvents: 'none' }}
          />
        </svg>

        {/* Inset zoomed panel for Wasatch Front */}
        <div style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: 200,
          background: '#080d1c',
          border: '1px solid #4a9eff',
          borderRadius: 6,
          overflow: 'hidden',
        }}>
          <div style={{ fontSize: 10, color: '#4a9eff', padding: '4px 8px', borderBottom: '1px solid #1a2540', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Wasatch Front (zoom)
          </div>
          <svg
            viewBox={`${INSET_X} ${INSET_Y} ${INSET_W} ${INSET_H}`}
            style={{ width: '100%', display: 'block' }}
            onMouseLeave={() => setHovered(null)}
          >
            {Object.entries(DISTRICT_PATHS).map(([distStr, pathD]) => {
              const distNum = parseInt(distStr, 10)
              if (!INSET_DISTRICTS.includes(distNum)) return null
              const data = byDistrict[distNum]
              const fill = data ? tierToFill(data.tier) : '#1e2a4a'
              const stroke = data ? tierToStroke(data.tier) : '#0d1530'
              const isHovered = hovered === distNum

              return (
                <path
                  key={`inset-${distNum}`}
                  d={pathD}
                  fill={fill}
                  stroke={isHovered ? '#ffffff' : stroke}
                  strokeWidth={isHovered ? 0.8 : 0.3}
                  style={{ cursor: 'pointer' }}
                  onMouseMove={e => handleMouseMove(e, distNum)}
                  onMouseEnter={() => setHovered(distNum)}
                />
              )
            })}

            {/* Inset labels */}
            {Object.entries(DISTRICT_PATHS).map(([distStr]) => {
              const distNum = parseInt(distStr, 10)
              if (!INSET_DISTRICTS.includes(distNum)) return null
              const path = DISTRICT_PATHS[distNum]
              const nums = path.match(/-?\d+\.?\d*/g).map(Number)
              let xs = [], ys = []
              for (let i = 0; i < nums.length - 1; i += 2) {
                xs.push(nums[i]); ys.push(nums[i + 1])
              }
              const cx = (Math.min(...xs) + Math.max(...xs)) / 2
              const cy = (Math.min(...ys) + Math.max(...ys)) / 2

              // Only label if centroid is within the inset viewport
              if (cx < INSET_X || cx > INSET_X + INSET_W || cy < INSET_Y || cy > INSET_Y + INSET_H) return null

              return (
                <text
                  key={`inset-label-${distNum}`}
                  x={cx}
                  y={cy + 2}
                  textAnchor="middle"
                  fontSize={4}
                  fill="rgba(255,255,255,0.9)"
                  style={{ pointerEvents: 'none', fontFamily: 'Georgia, serif', fontWeight: 'bold' }}
                >
                  {distNum}
                </text>
              )
            })}
          </svg>
        </div>

        {/* Tooltip */}
        {hd && (
          <div style={{
            position: 'absolute',
            left: Math.min(tooltipPos.x + 12, 460),
            top: Math.max(tooltipPos.y - 80, 0),
            background: '#0d1530',
            border: '1px solid #2a3a60',
            borderRadius: 8,
            padding: '10px 14px',
            pointerEvents: 'none',
            zIndex: 10,
            minWidth: 180,
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: '#e8eaf0', marginBottom: 6 }}>
              Senate District {hd.d}
            </div>
            <div style={{ fontSize: 12, color: '#8899bb', lineHeight: 1.8 }}>
              <div>
                <span style={{ color: '#445577' }}>Verified: </span>
                <span style={{ color: '#e8eaf0' }}>{hd.verified.toLocaleString()}</span>
                <span style={{ color: '#445577' }}> / {hd.threshold.toLocaleString()} needed</span>
              </div>
              <div>
                <span style={{ color: '#445577' }}>Progress: </span>
                <span style={{ color: '#e8eaf0' }}>{Math.round(hd.pctVerified * 100)}%</span>
              </div>
              <div>
                <span style={{ color: '#445577' }}>Qualification odds: </span>
                <span style={{ color: tierToFill(hd.tier), fontWeight: 'bold' }}>
                  {Math.round(hd.prob * 100)}%
                </span>
              </div>
              <div>
                <span style={{ color: '#445577' }}>Status: </span>
                <span style={{ color: tierToFill(hd.tier), fontWeight: 'bold' }}>{hd.tier}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
