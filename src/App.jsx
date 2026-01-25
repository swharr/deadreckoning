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
            <span style={{ color: '#4a9eff' }}>March 7, 2026</span>.
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
              <SnapshotBoxes snapshot={data.snapshot} meta={data.meta} districts={data.districts} />
            </div>

            <div style={STYLES.section}>
              <SignatureLookup districts={data.districts} />
            </div>

            <div style={STYLES.section}>
              <StatCards overall={data.overall} meta={data.meta} districts={data.districts} />
            </div>

            <div style={STYLES.section}>
              <DistrictMap districts={data.districts} />
            </div>

            <div style={STYLES.section}>
              <DistributionChart overall={data.overall} />
            </div>

            <div style={STYLES.section}>
              <DistrictTable districts={data.districts} />
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
          . County clerk verification deadline: <strong style={{ color: '#8899bb' }}>March 7, 2026</strong>.
          Election date (if qualifies): <strong style={{ color: '#8899bb' }}>November 3, 2026</strong>.
        </p>
        <p style={{ margin: 0 }}>
          Probability model uses exact dynamic programming across 29 independent district outcomes.
          This is an independent tracker — not affiliated with any campaign or government entity.
        </p>
      </footer>
    </div>
  )
}
