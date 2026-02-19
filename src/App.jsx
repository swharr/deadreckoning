import React, { useState, useEffect } from 'react'
import SnapshotBoxes from './components/SnapshotBoxes.jsx'
import StatCards from './components/StatCards.jsx'
import DistributionChart from './components/DistributionChart.jsx'
import DistrictTable from './components/DistrictTable.jsx'
import SignatureLookup from './components/SignatureLookup.jsx'
import DistrictMap from './components/DistrictMap.jsx'

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
`

export default function App() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [modelView, setModelView] = useState('primary') // 'primary' | 'growth'

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
              {data.meta?.modelMode && (
                <span style={{
                  display: 'inline-block',
                  background: data.meta.modelMode === 'survival' ? '#1a0800' : '#001a10',
                  border: `1px solid ${data.meta.modelMode === 'survival' ? '#b45309' : '#2d6a4f'}`,
                  borderRadius: 4,
                  padding: '2px 8px',
                  fontSize: 10,
                  fontWeight: 'bold',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: data.meta.modelMode === 'survival' ? '#fbbf24' : '#4caf50',
                  whiteSpace: 'nowrap',
                }}>
                  {data.meta.modelMode === 'survival' ? '⚖️ Survival Model' : '📈 Growth Model'}
                </span>
              )}
              {data.meta?.modelMode === 'survival' && (
                <button
                  onClick={() => setModelView(v => v === 'primary' ? 'growth' : 'primary')}
                  title={modelView === 'growth'
                    ? 'Switch back to Survival Model — reflects clerk-review removals through March 9'
                    : 'Switch to Growth Model — hypothetical view of where trajectory was heading before the Feb 15 deadline'}
                  style={{
                    background: modelView === 'growth' ? '#0d2a1a' : '#0d1530',
                    border: `1px solid ${modelView === 'growth' ? '#2d6a4f' : '#2a3a60'}`,
                    borderRadius: 4,
                    padding: '3px 10px',
                    fontSize: 10,
                    fontWeight: 'bold',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: modelView === 'growth' ? '#4caf50' : '#4a9eff',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontFamily: 'Georgia, serif',
                  }}
                >
                  {modelView === 'growth' ? '📈 Growth View' : 'Switch to Growth View'}
                </button>
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
            <div style={STYLES.section}>
              <SnapshotBoxes snapshot={data.snapshot} meta={data.meta} districts={data.districts} modelView={modelView} />
            </div>

            <div style={STYLES.section}>
              <SignatureLookup districts={data.districts} />
            </div>

            <div style={STYLES.section}>
              <StatCards overall={data.overall} meta={data.meta} districts={data.districts} modelView={modelView} />
            </div>

            <div style={STYLES.section}>
              <DistributionChart overall={data.overall} modelView={modelView} />
            </div>

            <div style={STYLES.section}>
              <DistrictTable districts={data.districts} />
            </div>

            <div style={{ ...STYLES.section, maxWidth: 700, margin: '0 auto 36px' }}>
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
      </footer>
    </div>
  )
}
