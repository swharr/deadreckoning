import { describe, expect, it } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import ProbabilityTimeline from './ProbabilityTimeline.jsx'

const SAMPLE_TIMELINE = [
  { date: '2026-01-20', pQualify: 0.05, modelMode: 'growth', delta: null },
  { date: '2026-02-10', pQualify: 0.35, modelMode: 'growth', delta: null },
  { date: '2026-02-18', pQualify: 0.52, modelMode: 'survival', delta: null },
  { date: '2026-02-21', pQualify: 0.55, modelMode: 'survival', delta: 0.03 },
  { date: '2026-03-16', pQualify: 0.71, modelMode: 'survival', delta: 0.02 },
]

describe('ProbabilityTimeline', () => {
  it('renders without crashing with valid data', () => {
    const { container } = render(<ProbabilityTimeline timeline={SAMPLE_TIMELINE} />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('renders nothing when timeline is empty', () => {
    const { container } = render(<ProbabilityTimeline timeline={[]} />)
    expect(container.querySelector('svg')).toBeFalsy()
  })

  it('renders nothing when timeline is undefined', () => {
    const { container } = render(<ProbabilityTimeline timeline={undefined} />)
    expect(container.querySelector('svg')).toBeFalsy()
  })

  it('renders correct number of data dots', () => {
    const { container } = render(<ProbabilityTimeline timeline={SAMPLE_TIMELINE} />)
    const dots = container.querySelectorAll('circle[data-idx]')
    expect(dots.length).toBe(SAMPLE_TIMELINE.length)
  })

  it('renders model switch annotation line', () => {
    const { container } = render(<ProbabilityTimeline timeline={SAMPLE_TIMELINE} />)
    const lines = container.querySelectorAll('line')
    const dashedLines = Array.from(lines).filter(l => l.getAttribute('stroke-dasharray'))
    expect(dashedLines.length).toBeGreaterThan(0)
  })
})
