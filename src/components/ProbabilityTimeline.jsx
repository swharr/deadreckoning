import React, { useState, useRef } from 'react'

const SUBMISSION_DEADLINE = '2026-02-15'
const REMOVAL_WINDOW_START = '2026-03-09'
const MARGIN = { top: 30, right: 20, bottom: 50, left: 55 }
const CHART_WIDTH = 844
const CHART_HEIGHT = 280
const PLOT_W = CHART_WIDTH - MARGIN.left - MARGIN.right
const PLOT_H = CHART_HEIGHT - MARGIN.top - MARGIN.bottom

/** Format ISO date string as "Mon D" */
function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Map an ISO date string to an x pixel within the plot area */
function xScale(iso, minMs, rangeMs) {
  const ms = new Date(iso + 'T00:00:00').getTime()
  return MARGIN.left + ((ms - minMs) / rangeMs) * PLOT_W
}

/** Map a probability (0-1) to a y pixel within the plot area */
function yScale(p) {
  return MARGIN.top + PLOT_H - p * PLOT_H
}

/** Pick smart x-axis ticks: first, deadline, last, plus evenly spaced */
function buildXTicks(timeline, minMs, rangeMs) {
  const ticks = new Set()
  ticks.add(timeline[0].date)
  ticks.add(timeline[timeline.length - 1].date)

  // Add deadline if it falls within the date range
  const dlMs = new Date(SUBMISSION_DEADLINE + 'T00:00:00').getTime()
  if (dlMs >= minMs && dlMs <= minMs + rangeMs) {
    ticks.add(SUBMISSION_DEADLINE)
  }

  // Add evenly spaced ticks (target ~5 total)
  const targetCount = 5
  const step = Math.max(1, Math.floor(timeline.length / targetCount))
  for (let i = step; i < timeline.length - 1; i += step) {
    ticks.add(timeline[i].date)
  }

  return Array.from(ticks).sort()
}

/** Format delta as colored string parts */
function deltaDisplay(delta) {
  if (delta === null || delta === undefined) return null
  const pct = Math.abs(delta * 100).toFixed(1)
  if (delta > 0) return { text: `↑+${pct}%`, color: '#00e676' }
  if (delta < 0) return { text: `↓-${pct}%`, color: '#ff5252' }
  return { text: `→0.0%`, color: '#8899bb' }
}

export default function ProbabilityTimeline({ timeline }) {
  const [hoveredIdx, setHoveredIdx] = useState(null)
  const [showSwitchTooltip, setShowSwitchTooltip] = useState(false)
  const containerRef = useRef(null)

  if (!timeline || timeline.length === 0) return null

  // Compute date range for scaling
  const dates = timeline.map(d => new Date(d.date + 'T00:00:00').getTime())
  const minMs = Math.min(...dates)
  const maxMs = Math.max(...dates)
  const rangeMs = maxMs - minMs || 1 // avoid division by zero

  // Map points to pixel coords
  const points = timeline.map((entry, i) => ({
    ...entry,
    x: xScale(entry.date, minMs, rangeMs),
    y: yScale(entry.pQualify),
    idx: i,
  }))

  // Deadline x position
  const deadlineMs = new Date(SUBMISSION_DEADLINE + 'T00:00:00').getTime()
  const deadlineInRange = deadlineMs >= minMs && deadlineMs <= maxMs
  const deadlineX = deadlineInRange
    ? MARGIN.left + ((deadlineMs - minMs) / rangeMs) * PLOT_W
    : null

  // Find the boundary between growth and survival phases
  const lastGrowthIdx = points.reduce((acc, p, i) => (p.modelMode === 'growth' ? i : acc), -1)
  const firstSurvivalIdx = points.findIndex(p => p.modelMode === 'survival')

  // Final determination point (modelMode === 'final')
  const finalPoint = points.find(p => p.modelMode === 'final') || null

  // X-axis ticks
  const xTicks = buildXTicks(timeline, minMs, rangeMs)

  // Y-axis gridlines at 0%, 25%, 50%, 75%, 100%
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0]

  // Hovered point info
  const hoveredPoint = hoveredIdx !== null ? points[hoveredIdx] : null

  return (
    <div
      ref={containerRef}
      style={{
        background: '#0d1530',
        border: '1px solid #1e2a4a',
        borderRadius: 10,
        padding: '24px 28px',
        position: 'relative',
      }}
    >
      {/* Header */}
      <div style={{
        fontSize: 13,
        fontWeight: 'bold',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#8899bb',
        marginBottom: 16,
      }}>
        Probability Over Time
      </div>

      {/* SVG chart wrapper for responsive scaling */}
      <div style={{ position: 'relative', width: '100%' }}>
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
        >
          {/* Y-axis gridlines and labels */}
          {yTicks.map(t => {
            const y = yScale(t)
            return (
              <g key={`y-${t}`}>
                <line
                  x1={MARGIN.left}
                  x2={CHART_WIDTH - MARGIN.right}
                  y1={y}
                  y2={y}
                  stroke="#1e2a4a"
                  strokeWidth={1}
                />
                <text
                  x={MARGIN.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fill="#667799"
                  fontSize={11}
                  fontFamily="Georgia, serif"
                >
                  {Math.round(t * 100)}%
                </text>
              </g>
            )
          })}

          {/* X-axis tick labels */}
          {xTicks.map(date => {
            const x = xScale(date, minMs, rangeMs)
            return (
              <text
                key={`x-${date}`}
                x={x}
                y={CHART_HEIGHT - MARGIN.bottom + 20}
                textAnchor="middle"
                fill="#667799"
                fontSize={10}
                fontFamily="Georgia, serif"
              >
                {formatDate(date)}
              </text>
            )
          })}

          {/* Connecting lines between dots — growth phase */}
          {points.map((pt, i) => {
            if (i === 0) return null
            // Don't draw a solid line across the model boundary
            if (i === firstSurvivalIdx && lastGrowthIdx >= 0) return null
            const prev = points[i - 1]
            return (
              <line
                key={`line-${i}`}
                x1={prev.x}
                y1={prev.y}
                x2={pt.x}
                y2={pt.y}
                stroke="#4a9eff"
                strokeWidth={2}
                strokeOpacity={0.4}
              />
            )
          })}

          {/* Bridge line between growth and survival phases */}
          {lastGrowthIdx >= 0 && firstSurvivalIdx >= 0 && (
            <line
              x1={points[lastGrowthIdx].x}
              y1={points[lastGrowthIdx].y}
              x2={points[firstSurvivalIdx].x}
              y2={points[firstSurvivalIdx].y}
              stroke="#4a9eff"
              strokeWidth={1.5}
              strokeOpacity={0.2}
              strokeDasharray="4 4"
            />
          )}

          {/* Model switch vertical line */}
          {deadlineX !== null && (
            <g
              onMouseEnter={() => setShowSwitchTooltip(true)}
              onMouseLeave={() => setShowSwitchTooltip(false)}
            >
              <line
                x1={deadlineX}
                y1={MARGIN.top}
                x2={deadlineX}
                y2={CHART_HEIGHT - MARGIN.bottom}
                stroke="#ff9800"
                strokeWidth={1.5}
                strokeDasharray="6 4"
                strokeOpacity={0.8}
              />
              {/* Wider invisible hit target for hover */}
              <line
                x1={deadlineX}
                y1={MARGIN.top}
                x2={deadlineX}
                y2={CHART_HEIGHT - MARGIN.bottom}
                stroke="transparent"
                strokeWidth={16}
              />
              <text
                x={deadlineX}
                y={MARGIN.top - 8}
                textAnchor="middle"
                fill="#ff9800"
                fontSize={9}
                fontFamily="Georgia, serif"
                fontWeight="bold"
              >
                Feb 15 · Model Switch
              </text>
            </g>
          )}

          {/* Signature removal window start vertical guide — Mar 9, 2026 */}
          {(() => {
            const ms = new Date(REMOVAL_WINDOW_START + 'T00:00:00').getTime()
            if (ms < minMs || ms > maxMs) return null
            const x = xScale(REMOVAL_WINDOW_START, minMs, rangeMs)
            return (
              <g>
                <line
                  x1={x}
                  y1={MARGIN.top}
                  x2={x}
                  y2={CHART_HEIGHT - MARGIN.bottom}
                  stroke="#26c6da"
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  strokeOpacity={0.8}
                />
                <text
                  x={x}
                  y={MARGIN.top - 8}
                  textAnchor="middle"
                  fill="#26c6da"
                  fontSize={9}
                  fontFamily="Georgia, serif"
                  fontWeight="bold"
                >
                  Mar 9 — Removal Window Opens
                </text>
              </g>
            )
          })()}

          {/* Final determination vertical guide */}
          {finalPoint !== null && (
            <g>
              <line
                x1={finalPoint.x}
                y1={MARGIN.top}
                x2={finalPoint.x}
                y2={CHART_HEIGHT - MARGIN.bottom}
                stroke="#f44336"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                strokeOpacity={0.85}
              />
              <text
                x={finalPoint.x - 6}
                y={MARGIN.top - 8}
                textAnchor="end"
                fill="#f44336"
                fontSize={9}
                fontFamily="Georgia, serif"
                fontWeight="bold"
              >
                Apr 30 — LG Determination
              </text>
            </g>
          )}

          {/* Phase labels below x-axis */}
          {lastGrowthIdx >= 0 && (
            <text
              x={(MARGIN.left + (deadlineX || points[lastGrowthIdx].x)) / 2}
              y={CHART_HEIGHT - 5}
              textAnchor="middle"
              fill="#4a9eff"
              fontSize={10}
              fontFamily="Georgia, serif"
              fontStyle="italic"
              opacity={0.6}
            >
              Growth Model
            </text>
          )}
          {firstSurvivalIdx >= 0 && (
            <text
              x={((deadlineX || points[firstSurvivalIdx].x) + CHART_WIDTH - MARGIN.right) / 2}
              y={CHART_HEIGHT - 5}
              textAnchor="middle"
              fill="#4a9eff"
              fontSize={10}
              fontFamily="Georgia, serif"
              fontStyle="italic"
              opacity={0.6}
            >
              Survival Model
            </text>
          )}

          {/* Data dots */}
          {points.map((pt) => {
            const isFinal = pt.modelMode === 'final'
            if (isFinal) {
              // Distinctive marker for the official final determination
              return (
                <g key={`dot-${pt.idx}`}>
                  {/* Outer halo ring */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={hoveredIdx === pt.idx ? 14 : 12}
                    fill="none"
                    stroke="#f44336"
                    strokeWidth={1.5}
                    strokeOpacity={0.35}
                    style={{ transition: 'r 0.15s ease' }}
                  />
                  {/* Main filled dot */}
                  <circle
                    data-idx={pt.idx}
                    cx={pt.x}
                    cy={pt.y}
                    r={hoveredIdx === pt.idx ? 9 : 7}
                    fill="#f44336"
                    stroke="#0d1530"
                    strokeWidth={2}
                    style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                    onMouseEnter={() => setHoveredIdx(pt.idx)}
                    onMouseLeave={() => setHoveredIdx(null)}
                  />
                  {/* Annotation label above-left of the point */}
                  <text
                    x={pt.x - 14}
                    y={pt.y - 18}
                    textAnchor="end"
                    fill="#f44336"
                    fontSize={10}
                    fontFamily="Georgia, serif"
                    fontWeight="bold"
                    pointerEvents="none"
                  >
                    Final: 0.0%
                  </text>
                  <text
                    x={pt.x - 14}
                    y={pt.y - 6}
                    textAnchor="end"
                    fill="#8899bb"
                    fontSize={9}
                    fontFamily="Georgia, serif"
                    pointerEvents="none"
                  >
                    Did Not Qualify
                  </text>
                </g>
              )
            }
            return (
              <circle
                key={`dot-${pt.idx}`}
                data-idx={pt.idx}
                cx={pt.x}
                cy={pt.y}
                r={hoveredIdx === pt.idx ? 7 : 5}
                fill="#4a9eff"
                stroke="#0d1530"
                strokeWidth={2}
                style={{ cursor: 'pointer', transition: 'r 0.15s ease' }}
                onMouseEnter={() => setHoveredIdx(pt.idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            )
          })}
        </svg>

        {/* Dot hover tooltip — positioned with percentages for responsive scaling */}
        {hoveredPoint && (
          <div
            style={{
              position: 'absolute',
              left: `${(hoveredPoint.x / CHART_WIDTH) * 100}%`,
              top: `${(hoveredPoint.y / CHART_HEIGHT) * 100}%`,
              transform: 'translate(-50%, calc(-100% - 12px))',
              background: '#1a2340',
              border: '1px solid #2a3a5a',
              borderRadius: 6,
              padding: '8px 12px',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              zIndex: 10,
              fontFamily: 'Georgia, serif',
            }}
          >
            <div style={{ fontSize: 12, color: '#ccddef', fontWeight: 'bold' }}>
              {formatDate(hoveredPoint.date)}
            </div>
            <div style={{ fontSize: 14, color: '#fff', marginTop: 2 }}>
              {(hoveredPoint.pQualify * 100).toFixed(1)}%
            </div>
            <div style={{ fontSize: 10, color: hoveredPoint.modelMode === 'final' ? '#f44336' : '#8899bb', marginTop: 2 }}>
              {hoveredPoint.modelMode === 'growth' ? 'Growth Model' : hoveredPoint.modelMode === 'final' ? 'LG Official Determination' : 'Survival Model'}
            </div>
            {(() => {
              const d = deltaDisplay(hoveredPoint.delta)
              if (!d) return null
              return (
                <div style={{ fontSize: 11, color: d.color, marginTop: 3 }}>
                  {d.text}
                </div>
              )
            })()}
          </div>
        )}

        {/* Model switch hover tooltip */}
        {showSwitchTooltip && deadlineX !== null && (
          <div
            style={{
              position: 'absolute',
              left: `calc(${(deadlineX / CHART_WIDTH) * 100}% - 150px)`,
              bottom: 10,
              width: 300,
              background: '#1a2340',
              border: '1px solid #ff9800',
              borderRadius: 6,
              padding: '10px 14px',
              pointerEvents: 'none',
              zIndex: 10,
              fontFamily: 'Georgia, serif',
            }}
          >
            <div style={{ fontSize: 12, color: '#ff9800', fontWeight: 'bold', marginBottom: 4 }}>
              Model Switch — Feb 15, 2026
            </div>
            <div style={{ fontSize: 11, color: '#aabbcc', lineHeight: 1.5 }}>
              Before: estimated odds based on signature collection trajectory.
              After: all signatures submitted — model now tracks whether verified
              counts will survive clerk review.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
