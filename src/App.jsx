import React, { useState, useEffect, useRef } from 'react'
import SnapshotBoxes from './components/SnapshotBoxes.jsx'
import StatCards from './components/StatCards.jsx'
import DistributionChart from './components/DistributionChart.jsx'
import DistrictTable from './components/DistrictTable.jsx'
import DistrictMap from './components/DistrictMap.jsx'
import VelocityTracker from './components/VelocityTracker.jsx'
import MonteCarloPanel from './components/MonteCarloPanel.jsx'
import ProbabilityTimeline from './components/ProbabilityTimeline.jsx'
import './telemetry.js'

// Injected at build time by vite.config.js
const BUILD_SHA = __BUILD_SHA__
const BUILD_BRANCH = __BUILD_BRANCH__
const BUILD_TIME = __BUILD_TIME__

function formatUTCWithMT(isoString) {
  if (!isoString) return null
  const d = new Date(isoString)
  if (isNaN(d)) return null
  const utc = d.toLocaleString('en-US', {
    timeZone: 'UTC',
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  })
  const mt = d.toLocaleString('en-US', {
    timeZone: 'America/Denver',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  })
  const mtLabel = d.toLocaleString('en-US', { timeZone: 'America/Denver', timeZoneName: 'short' })
    .split(' ').pop()
  return `${utc} UTC (${mt} ${mtLabel})`
}

function buildId(time, branch) {
  const str = `${time}|${branch}`
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i)
    h = h >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

function BuildInfo({ meta }) {
  const buildIdStr = buildId(BUILD_TIME, BUILD_BRANCH)
  const builtAt = formatUTCWithMT(BUILD_TIME)
  // dataAt = the date the LG file was published (not when the build ran)
  const dataDate = meta?.lastUpdated   // "YYYY-MM-DD" from process.py
  // processedAt = when process.py actually ran
  const processedAt = formatUTCWithMT(meta?.processedAt)

  return (
    <div style={{
      marginTop: 12,
      paddingTop: 10,
      borderTop: '1px solid #0e1628',
      fontSize: 10,
      color: '#2a3a55',
      lineHeight: 1.8,
      fontFamily: 'monospace',
      letterSpacing: '0.03em',
    }}>
      <span style={{ color: '#1e2e4a' }}>build</span>{' '}
      <span style={{ color: '#334466' }}>{buildIdStr}</span>
      {' · '}
      <span style={{ color: '#1e2e4a' }}>ref</span>{' '}
      <span style={{ color: '#334466' }}>{BUILD_SHA}</span>
      {' · '}
      <span style={{ color: '#1e2e4a' }}>branch</span>{' '}
      <span style={{ color: '#334466' }}>{BUILD_BRANCH}</span>
      {builtAt && (
        <>
          {' · '}
          <span style={{ color: '#1e2e4a' }}>deployed</span>{' '}
          <span style={{ color: '#334466' }}>{builtAt}</span>
        </>
      )}
      {dataDate && (
        <>
          {' · '}
          <span style={{ color: '#1e2e4a' }}>data</span>{' '}
          <span style={{ color: '#334466' }}>{dataDate}</span>
        </>
      )}
      {processedAt && (
        <>
          {' · '}
          <span style={{ color: '#1e2e4a' }}>processed</span>{' '}
          <span style={{ color: '#334466' }}>{processedAt}</span>
        </>
      )}
    </div>
  )
}

const STYLES = {
  app: {
    background: '#0a0f1e',
    minHeight: '100vh',
    color: '#e8eaf0',
    fontFamily: 'Georgia, "Times New Roman", Times, serif',
    margin: 0,
    padding: 0,
  },
  header: {
    background: 'linear-gradient(180deg, #0d1530 0%, #0a0f1e 100%)',
    borderBottom: '1px solid #1e2a4a',
    padding: '36px 32px 32px',
  },
  headerInner: {
    maxWidth: 1100,
    margin: '0 auto',
  },
  eyebrow: {
    fontSize: 11,
    color: '#4a9eff',
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    marginBottom: 14,
    fontFamily: 'Georgia, serif',
  },
  titleWhite: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#ffffff',
    margin: 0,
    lineHeight: 1.15,
    fontFamily: 'Georgia, serif',
  },
  titleBlue: {
    fontSize: 42,
    fontWeight: 'bold',
    fontStyle: 'italic',
    color: '#4a9eff',
    margin: '0 0 16px',
    lineHeight: 1.15,
    fontFamily: 'Georgia, serif',
  },
  subtitle: {
    fontSize: 14,
    color: '#8899bb',
    margin: 0,
    maxWidth: 540,
    lineHeight: 1.6,
  },
  main: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '28px 32px 60px',
  },
  section: {
    marginBottom: 36,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    flexDirection: 'column',
    gap: 16,
    color: '#4a9eff',
    fontSize: 16,
  },
  error: {
    background: '#1a0a0a',
    border: '1px solid #7f1d1d',
    borderRadius: 8,
    padding: 24,
    color: '#fca5a5',
    textAlign: 'center',
    marginTop: 40,
  },
  footer: {
    borderTop: '1px solid #1e2a4a',
    padding: '20px 32px',
    textAlign: 'center',
    color: '#445577',
    fontSize: 12,
    lineHeight: 1.6,
  },
  footerLink: {
    color: '#4a9eff',
    textDecoration: 'none',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid #1e2a4a',
    borderTop: '3px solid #4a9eff',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
}

// Inject minimal global reset + spinner keyframe
const globalStyle = `
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; padding: 0; background: #0a0f1e; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes countUp { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  .pill-tooltip { display: none; position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%); background: #0d1530; border: 1px solid #2a3a60; border-radius: 7px; padding: 9px 12px; font-size: 11px; color: #8899bb; line-height: 1.6; width: 260px; box-shadow: 0 4px 18px rgba(0,0,0,0.6); z-index: 20; pointer-events: none; }
  .pill-btn:hover .pill-tooltip { display: block; }
  @media (max-width: 768px) {
    .desktop-only { display: none !important; }
    .mobile-only { display: block !important; }
  }
  @media (min-width: 769px) {
    .desktop-only { display: block !important; }
    .mobile-only { display: none !important; }
  }
`

const ARCHIVE_MODAL_KEY = 'dr.archiveModalDismissed.v1'
const DETERMINATION_PDF = '/UT-LG-Prop4-Determination-FINAL.pdf'

export default function App() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modelView, setModelView] = useState('primary') // 'primary' | 'growth'
  const [velocityExpanded, setVelocityExpanded] = useState(false)
  const [archiveModalOpen, setArchiveModalOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    try { return window.localStorage.getItem(ARCHIVE_MODAL_KEY) !== '1' } catch { return true }
  })
  const velocityRef = useRef(null)

  const dismissArchiveModal = () => {
    setArchiveModalOpen(false)
    try { window.localStorage.setItem(ARCHIVE_MODAL_KEY, '1') } catch { /* ignore */ }
  }

  useEffect(() => {
    // Inject global styles once
    const tag = document.createElement('style')
    tag.textContent = globalStyle
    document.head.appendChild(tag)
    return () => document.head.removeChild(tag)
  }, [])

  useEffect(() => {
    fetch('/data.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(e => {
        setError(e.message)
        setLoading(false)
      })
  }, [])

  return (
    <div style={STYLES.app}>
      {archiveModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="archive-modal-title"
          onClick={dismissArchiveModal}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(4, 7, 16, 0.82)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#0d1530',
              border: '1px solid #2a3a60',
              borderTop: '3px solid #fbbf24',
              borderRadius: 10,
              maxWidth: 560,
              width: '100%',
              padding: '28px 30px 24px',
              fontFamily: 'Georgia, serif',
              color: '#e8eaf0',
              boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
            }}
          >
            <div style={{
              fontSize: 11, color: '#fbbf24', letterSpacing: '0.18em',
              textTransform: 'uppercase', marginBottom: 10,
            }}>
              Final Determination
            </div>
            <h2 id="archive-modal-title" style={{
              margin: '0 0 14px', fontSize: 24, lineHeight: 1.2, color: '#ffffff',
            }}>
              Prop 4 Repeal did not qualify for the ballot.
            </h2>
            <p style={{ margin: '0 0 14px', fontSize: 14, lineHeight: 1.7, color: '#c8d0e0' }}>
              The Elections Division of the Office of the Utah Lieutenant Governor has officially
              certified that the Repeal of the Independent Redistricting Commission and Standards
              Act Initiative did not meet the statutory signature requirements and will not appear
              on the November 2026 ballot.
            </p>
            <p style={{ margin: '0 0 18px', fontSize: 13, lineHeight: 1.6, color: '#8899bb' }}>
              This site is now in archive mode. The data, analysis, and probability model below
              are preserved as a historical record of the petition effort.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <a
                href={DETERMINATION_PDF}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: '#fbbf24',
                  color: '#0a0f1e',
                  fontWeight: 'bold',
                  fontSize: 13,
                  letterSpacing: '0.04em',
                  padding: '9px 18px',
                  borderRadius: 6,
                  textDecoration: 'none',
                  fontFamily: 'Georgia, serif',
                }}
              >
                Read the Official Determination Letter →
              </a>
              <button
                onClick={dismissArchiveModal}
                style={{
                  background: 'transparent',
                  color: '#8899bb',
                  border: '1px solid #2a3a60',
                  fontSize: 13,
                  letterSpacing: '0.04em',
                  padding: '8px 16px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontFamily: 'Georgia, serif',
                }}
              >
                View archived site
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{
        background: '#1a1400',
        borderBottom: '1px solid #3a2500',
        padding: '10px 16px',
      }}>
        <div style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          flexWrap: 'wrap',
          fontSize: 12,
          color: '#c8a85a',
          fontFamily: 'Georgia, serif',
          letterSpacing: '0.02em',
          lineHeight: 1.5,
          textAlign: 'center',
        }}>
          <span style={{ color: '#fbbf24', fontWeight: 'bold', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Archived
          </span>
          <span style={{ color: '#5a4500' }}>&bull;</span>
          <span>
            Certified by the Utah Lt. Governor's Elections Division — petition did not qualify for the November 2026 ballot.
          </span>
          <a
            href={DETERMINATION_PDF}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#fbbf24', fontWeight: 'bold', textDecoration: 'underline' }}
          >
            Read the Official Determination Letter
          </a>
        </div>
      </div>

      <header style={STYLES.header}>
        <div style={STYLES.headerInner}>
          <div style={STYLES.eyebrow}>
            Utah Proposition 4 Repeal Initiative
            &nbsp;·&nbsp; District Probability Analysis
            {data && <span>&nbsp;·&nbsp; {data.meta?.lastUpdated}</span>}
          </div>
          {data && (
            <div style={{
              fontSize: 11,
              color: '#334466',
              marginBottom: 14,
              lineHeight: 1.5,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              flexWrap: 'wrap',
            }}>
              <span>
                Data reflects signatures verified by county clerks and posted by the Lt. Governor's office.
                Updates each business day — weekend and holiday submissions typically appear the following business day.
              </span>
              {data.meta?.modelMode === 'survival' && (
                <div style={{
                  display: 'inline-flex',
                  borderRadius: 20,
                  overflow: 'hidden',
                  border: '1px solid #2a3a60',
                }}>
                  <div className="pill-btn" style={{ position: 'relative' }}>
                    <button
                      onClick={() => setModelView('primary')}
                      style={{
                        background: modelView === 'primary' ? '#1a0800' : 'transparent',
                        border: 'none',
                        borderRight: '1px solid #2a3a60',
                        padding: '5px 14px',
                        fontSize: 10,
                        fontWeight: 'bold',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: modelView === 'primary' ? '#fbbf24' : '#556688',
                        cursor: 'pointer',
                        fontFamily: 'Georgia, serif',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s',
                      }}
                    >
                      Survival
                    </button>
                    <div className="pill-tooltip">
                      Reflects clerk-review removals through March 9. The submission deadline has passed — no new signatures can be added. This is the operative model.
                    </div>
                  </div>
                  <div className="pill-btn" style={{ position: 'relative' }}>
                    <button
                      onClick={() => setModelView('growth')}
                      style={{
                        background: modelView === 'growth' ? '#1a1200' : 'transparent',
                        border: 'none',
                        padding: '5px 14px',
                        fontSize: 10,
                        fontWeight: 'bold',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: modelView === 'growth' ? '#ffca28' : '#445566',
                        cursor: 'pointer',
                        fontFamily: 'Georgia, serif',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s',
                      }}
                    >
                      Growth ⚠️
                    </button>
                    <div className="pill-tooltip">
                      ⚠️ Outdated — pre-Feb 15 deadline model. Shows hypothetical trajectory context only. Switch to Survival for current operative probabilities.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {data && data.meta?.modelMode === 'survival' && modelView === 'growth' && (
            <div style={{
              background: '#1a1400',
              border: '2px solid #b45309',
              borderRadius: 8,
              padding: '14px 18px',
              marginBottom: 16,
              fontSize: 13,
              color: '#e8eaf0',
              lineHeight: 1.8,
              maxWidth: 720,
            }}>
              <div style={{ fontWeight: 'bold', color: '#ffca28', fontSize: 14, marginBottom: 6 }}>
                ⚠️ Growth View — Outdated Pre-Deadline Model
              </div>
              <div>
                The Feb 15 submission deadline has passed. No new signatures can be added.{' '}
                <strong style={{ color: '#fbbf24' }}>This model is no longer predictive</strong> — it shows
                what the trajectory <em>would have</em> projected before the deadline, based on pre-Feb-15
                velocity. Numbers here do not reflect actual clerk-review outcomes.
              </div>
              <div style={{ marginTop: 10 }}>
                <button
                  onClick={() => setModelView('primary')}
                  style={{
                    background: '#fbbf24',
                    border: 'none',
                    borderRadius: 5,
                    color: '#0a0f1e',
                    fontSize: 12,
                    fontWeight: 'bold',
                    padding: '6px 18px',
                    cursor: 'pointer',
                    fontFamily: 'Georgia, serif',
                    letterSpacing: '0.04em',
                  }}
                >
                  → Switch to Survival Model (recommended)
                </button>
                <span style={{ marginLeft: 12, fontSize: 11, color: '#92680a' }}>
                  The Survival Model reflects current clerk-review probabilities through March 9.
                </span>
              </div>
            </div>
          )}
          {data && data.meta?.modelMode === 'survival' && modelView === 'primary' && (
            <div style={{
              background: '#0d0a00',
              border: '1px solid #3a2500',
              borderRadius: 6,
              padding: '10px 16px',
              marginBottom: 16,
              fontSize: 12,
              color: '#92680a',
              lineHeight: 1.7,
              maxWidth: 680,
            }}>
              <strong style={{ color: '#fbbf24' }}>⚖️ Survival Model active</strong>
              {' '}The Feb 15 submission deadline has passed. No new signatures can be added.
              Probabilities now reflect whether current verified counts will survive county
              clerk review through <strong style={{ color: '#fbbf24' }}>March 9</strong>.
              {' '}
              <button
                onClick={() => setModelView('growth')}
                style={{ background: 'none', border: 'none', color: '#4a9eff', cursor: 'pointer', padding: 0, fontSize: 12, fontFamily: 'Georgia, serif', textDecoration: 'underline' }}
              >
                See growth view
              </button>
              {' '}for pre-deadline trajectory context.
            </div>
          )}

          <h1 style={{ margin: 0 }}>
            <div style={STYLES.titleWhite}>What are the odds this reaches</div>
            <div style={STYLES.titleBlue}>the November ballot?</div>
          </h1>
          <p style={STYLES.subtitle}>
            Probability distribution across all 29 Senate districts.
            Requires 26 of 29 to meet the 8% signature threshold.
          </p>

          {/* What is this initiative — always visible context for first-time visitors */}
          <div style={{ marginTop: 16, maxWidth: 680, fontSize: 13, color: '#8899bb', lineHeight: 1.8 }}>
            <p style={{ margin: '0 0 8px' }}>
              <strong style={{ color: '#e8eaf0' }}>Proposition 4</strong> was a 2018 Utah ballot
              initiative that created an independent redistricting commission and banned partisan
              gerrymandering. Voters passed it with 50.3% of the vote.
            </p>
            <p style={{ margin: '0 0 8px' }}>
              The Republican supermajority in the legislature{' '}
              <strong style={{ color: '#e8eaf0' }}>gutted Prop 4 with SB 200 in 2020</strong>,
              reducing the commission to an advisory role and drawing their own maps. What followed
              was years of court battles — the League of Women Voters sued, the Utah Supreme Court
              ruled the override unconstitutional in 2024, and when the legislature{' '}
              <strong style={{ color: '#e8eaf0' }}>refused to draw a lawful map</strong>, District
              Judge Dianna Gibson imposed one herself in November 2025. The legislature has fought
              the ruling at every turn, including a failed constitutional amendment and multiple
              appeals — all rejected by the courts.
            </p>
            <p style={{ margin: 0 }}>
              This petition is their latest effort:{' '}
              <strong style={{ color: '#e8eaf0' }}>fully repeal Proposition 4</strong> and the
              independent redistricting commission it created — wiping the slate clean as if
              Prop 4 never existed and returning all redistricting power to the legislature. If
              the petition qualifies, the question goes before Utah voters on the{' '}
              <span style={{ color: '#4a9eff' }}>November 2026 ballot</span>.
            </p>
          </div>

          <p style={{ ...STYLES.subtitle, marginTop: 16, maxWidth: 680 }}>
            To qualify, the petition needs{' '}
            <span style={{ color: '#e8eaf0', fontWeight: 'bold' }}>140,748 verified signatures statewide</span>
            {' '}and must clear the 8% threshold in at least{' '}
            <span style={{ color: '#e8eaf0', fontWeight: 'bold' }}>26 of Utah's 29 Senate districts</span>.
            Falling short in even one of those 26 disqualifies the entire effort.
            County clerks verify signatures through{' '}
            <span style={{ color: '#4a9eff' }}>March 9, 2026</span>.
          </p>
        </div>
      </header>

      <main style={STYLES.main}>
        {loading && (
          <div style={STYLES.loading}>
            <div style={STYLES.spinner} />
            <span>Loading petition data…</span>
          </div>
        )}

        {error && (
          <div style={STYLES.error}>
            <strong>Failed to load data.json</strong>
            <p style={{ margin: '8px 0 0', fontSize: 13 }}>{error}</p>
          </div>
        )}

        {data && (
          <>

            <div style={STYLES.section}>
              <SnapshotBoxes
                snapshot={data.snapshot}
                meta={data.meta}
                districts={data.districts}
                overall={data.overall}
                modelView={modelView}
                onExpandVelocity={() => {
                  setVelocityExpanded(true)
                  setTimeout(() => velocityRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
                }}
              />
            </div>

            <div style={STYLES.section}>
              <StatCards overall={data.overall} meta={data.meta} districts={data.districts} modelView={modelView} snapshot={data.snapshot} />
            </div>

            {data.probabilityTimeline && data.probabilityTimeline.length > 0 && (
              <div style={STYLES.section}>
                <ProbabilityTimeline timeline={data.probabilityTimeline} />
              </div>
            )}

            <div style={STYLES.section} ref={velocityRef}>
              <VelocityTracker districts={data.districts} meta={data.meta} defaultExpanded={velocityExpanded} />
            </div>

            <div style={STYLES.section}>
              <DistributionChart overall={data.overall} modelView={modelView} />
            </div>

            <div style={STYLES.section}>
              <MonteCarloPanel districts={data.districts} overall={data.overall} />
            </div>

            <div style={STYLES.section}>
              <DistrictTable districts={data.districts} />
            </div>

            <div style={STYLES.section}>
              <DistrictMap districts={data.districts} />
            </div>
          </>
        )}
      </main>

      <footer style={STYLES.footer}>
        <p style={{
          margin: '0 0 12px',
          padding: '12px 16px',
          background: '#0d0a00',
          border: '1px solid #3a2500',
          borderRadius: 6,
          color: '#c8a85a',
          fontSize: 12,
          lineHeight: 1.7,
          maxWidth: 720,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          <strong style={{ color: '#fbbf24' }}>This site is now in archive mode</strong> and remains
          online only as a historical record of the Prop 4 repeal petition effort. No further data
          updates will be published. Questions or corrections:{' '}
          <a href="mailto:tater@t8rsk8s.io" style={{ ...STYLES.footerLink, color: '#fbbf24' }}>
            tater@t8rsk8s.io
          </a>.
        </p>
        <p style={{ margin: '0 0 4px' }}>
          Data sourced from{' '}
          <a
            href="https://vote.utah.gov/repeal-of-the-independent-redistricting-commission-and-standards-act-direct-initiative-list-of-signers/"
            target="_blank"
            rel="noopener noreferrer"
            style={STYLES.footerLink}
          >
            vote.utah.gov
          </a>
          . County clerk verification deadline: <strong style={{ color: '#8899bb' }}>March 9, 2026</strong>.
          Election date (if qualifies): <strong style={{ color: '#8899bb' }}>November 3, 2026</strong>.
        </p>
        <p style={{ margin: 0 }}>
          {data?.meta?.modelMode === 'survival'
            ? 'Probability model is in survival mode: submission deadline has passed, projections reflect expected clerk-review removals through March 9.'
            : 'Probability model uses exact dynamic programming across 29 independent district outcomes, with history-weighted linear trajectory projection.'
          }
          {' '}This is an independent tracker — not affiliated with any campaign or government entity.
          {' '}Source code released under the{' '}
          <a
            href="https://github.com/swharr/deadreckoning/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            style={STYLES.footerLink}
          >
            MIT License
          </a>.
        </p>
        <BuildInfo meta={data?.meta} />
      </footer>
    </div>
  )
}
