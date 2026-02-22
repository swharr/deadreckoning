import React, { useState, useEffect, useRef } from 'react'
import SnapshotBoxes from './components/SnapshotBoxes.jsx'
import StatCards from './components/StatCards.jsx'
import DistributionChart from './components/DistributionChart.jsx'
import DistrictTable from './components/DistrictTable.jsx'
import SignatureLookup from './components/SignatureLookup.jsx'
import DistrictMap from './components/DistrictMap.jsx'
import VelocityTracker from './components/VelocityTracker.jsx'
import { THRESHOLDS } from './lib/probability.js'

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

export default function App() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modelView, setModelView] = useState('primary') // 'primary' | 'growth'
  const [isMobile, setIsMobile] = useState(false)
  const [velocityExpanded, setVelocityExpanded] = useState(false)
  const velocityRef = useRef(null)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

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

  const confirmedDistricts = data ? (data.districts || []).filter(d => {
    const threshold = THRESHOLDS[d.d] || d.threshold
    return d.verified >= threshold
  }).length : 0

  const progressPct = data ? Math.min((data.meta?.totalVerified || 0) / (data.meta?.qualificationThreshold || 140748) * 100, 100) : 0

  return (
    <div style={STYLES.app}>
      {data && (
        <div style={{
          background: '#0d1530',
          borderBottom: '1px solid #1e2a4a',
          padding: '8px 16px',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: `${progressPct}%`,
            background: 'linear-gradient(90deg, rgba(74,158,255,0.08) 0%, rgba(74,158,255,0.15) 100%)',
            transition: 'width 1s ease',
          }} />
          <div style={{
            position: 'relative',
            maxWidth: 1100,
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            flexWrap: 'wrap',
            fontSize: 12,
            color: '#8899bb',
            fontFamily: 'Georgia, serif',
            letterSpacing: '0.02em',
          }}>
            <span style={{ color: '#e8eaf0', fontWeight: 'bold' }}>
              {(data.meta?.qualificationThreshold || 140748).toLocaleString()} needed
            </span>
            <span style={{ color: '#334466' }}>&bull;</span>
            <span>
              <span style={{ color: '#4a9eff', fontWeight: 'bold' }}>{confirmedDistricts}</span> of{' '}
              <span style={{ fontWeight: 'bold' }}>{data.meta?.totalDistricts || 29}</span> districts
            </span>
            <span style={{ color: '#334466' }}>&bull;</span>
            <span>
              Clerk verification ends{' '}
              <span style={{ color: '#4a9eff', fontWeight: 'bold' }}>March 9, 2026</span>
            </span>
          </div>
        </div>
      )}

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
                        background: modelView === 'growth' ? '#0d2a1a' : 'transparent',
                        border: 'none',
                        padding: '5px 14px',
                        fontSize: 10,
                        fontWeight: 'bold',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        color: modelView === 'growth' ? '#4caf50' : '#556688',
                        cursor: 'pointer',
                        fontFamily: 'Georgia, serif',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.15s',
                      }}
                    >
                      Growth
                    </button>
                    <div className="pill-tooltip">
                      Hypothetical view of where trajectory was heading before the Feb 15 deadline. Useful for context, but not the operative model.
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {data && data.meta?.modelMode === 'survival' && modelView === 'growth' && (
            <div style={{
              background: '#0a1f0f',
              border: '1px solid #2d6a4f',
              borderRadius: 6,
              padding: '10px 16px',
              marginBottom: 16,
              fontSize: 12,
              color: '#4caf50',
              lineHeight: 1.7,
              maxWidth: 680,
            }}>
              <strong>📈 Growth View — hypothetical</strong>
              {' '}The submission deadline passed on Feb 15. This view shows what the
              growth model <em>would have</em> predicted based on pre-deadline trajectory and
              velocity — useful for context, but not the operative model.
              {' '}<span style={{ color: '#2d6a4f' }}>Switch back to Survival View for the current, operative probability.</span>
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
          <p style={{ ...STYLES.subtitle, marginTop: 10, maxWidth: 680 }}>
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
            {isMobile && (
              <div style={STYLES.section}>
                <div style={{
                  background: 'linear-gradient(135deg, #0d1530 0%, #111d40 100%)',
                  border: '1px solid #2a3a60',
                  borderRadius: 12,
                  padding: '24px 20px',
                  textAlign: 'center',
                  marginBottom: 8,
                }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>🔍</div>
                  <div style={{
                    fontSize: 20,
                    fontWeight: 'bold',
                    color: '#e8eaf0',
                    marginBottom: 6,
                    lineHeight: 1.3,
                    fontFamily: 'Georgia, serif',
                  }}>
                    Did you sign?
                  </div>
                  <div style={{
                    fontSize: 13,
                    color: '#4a9eff',
                    marginBottom: 16,
                    fontFamily: 'Georgia, serif',
                  }}>
                    Check in 15 seconds
                  </div>
                </div>
                <SignatureLookup districts={data.districts} />
              </div>
            )}

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

            {!isMobile && (
              <div style={STYLES.section}>
                <SignatureLookup districts={data.districts} />
              </div>
            )}

            <div style={STYLES.section}>
              <StatCards overall={data.overall} meta={data.meta} districts={data.districts} modelView={modelView} snapshot={data.snapshot} />
            </div>

            <div style={STYLES.section} ref={velocityRef}>
              <VelocityTracker districts={data.districts} meta={data.meta} defaultExpanded={velocityExpanded} />
            </div>

            <div style={STYLES.section}>
              <DistributionChart overall={data.overall} modelView={modelView} />
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
