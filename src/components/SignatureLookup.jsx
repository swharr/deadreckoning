import React, { useState, useRef } from 'react'

// Must match the Python name_hash() function exactly:
// normalize to "LASTNAME,FIRSTNAME", SHA-256, first 20 hex chars
async function hashName(lastName, firstName) {
  const normalized = `${lastName.trim().toUpperCase()},${firstName.trim().toUpperCase()}`
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(normalized)
  )
  const hex = Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  return hex.slice(0, 20)
}

const RESULT = {
  FOUND: 'found',
  NOT_FOUND: 'not_found',
  IDLE: 'idle',
  LOADING: 'loading',
  ERROR: 'error',
}

export default function SignatureLookup({ districts = [] }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [senateDistrict, setSenateDistrict] = useState('')
  const [result, setResult] = useState(RESULT.IDLE)
  const hashSetRef = useRef(null)  // loaded once, cached in memory

  // Sorted district list for the dropdown
  const districtOptions = [...districts].sort((a, b) => a.d - b.d)

  // District data for the selected district (if any)
  const selectedDistrict = senateDistrict
    ? districtOptions.find(d => d.d === parseInt(senateDistrict, 10))
    : null

  async function loadIndex() {
    if (hashSetRef.current) return hashSetRef.current
    const resp = await fetch('/lookup.json')
    if (!resp.ok) throw new Error(`Failed to load lookup index (HTTP ${resp.status})`)
    const data = await resp.json()
    hashSetRef.current = new Set(data.hashes)
    return hashSetRef.current
  }

  async function handleLookup(e) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) return

    setResult(RESULT.LOADING)
    try {
      const index = await loadIndex()
      const h = await hashName(lastName, firstName)
      setResult(index.has(h) ? RESULT.FOUND : RESULT.NOT_FOUND)
    } catch (err) {
      console.error(err)
      setResult(RESULT.ERROR)
    }
  }

  function handleReset() {
    setFirstName('')
    setLastName('')
    setSenateDistrict('')
    setResult(RESULT.IDLE)
  }

  const inputStyle = {
    background: '#0a0f1e',
    border: '1px solid #1e2a4a',
    borderRadius: 6,
    color: '#e8eaf0',
    fontSize: 15,
    padding: '10px 14px',
    fontFamily: 'Georgia, serif',
    flex: 1,
    minWidth: 140,
    outline: 'none',
  }

  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer',
    minWidth: 180,
  }

  const tierColor = {
    'NEARLY CERTAIN': '#4caf50',
    'LIKELY': '#8bc34a',
    'LEANING': '#ffb300',
    'TOSS-UP': '#ff9800',
    'UNLIKELY': '#ff5722',
    'CRITICAL': '#f44336',
  }

  return (
    <div style={{
      background: '#0d1530',
      border: '1px solid #1e2a4a',
      borderRadius: 10,
      padding: '24px 28px',
    }}>
      <div style={{
        fontSize: 13,
        fontWeight: 'bold',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#8899bb',
        marginBottom: 6,
      }}>
        🔍 Signature Lookup
      </div>
      <p style={{
        fontSize: 13,
        color: '#8899bb',
        margin: '0 0 16px',
        lineHeight: 1.6,
      }}>
        Check whether your name appears on the petition as a verified signer.
      </p>

      {/* How it works + security model */}
      <div style={{
        background: '#080d1c',
        border: '1px solid #1a2540',
        borderRadius: 8,
        padding: '14px 16px',
        marginBottom: 18,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 14,
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4a9eff', marginBottom: 6 }}>
            How it works
          </div>
          <div style={{ fontSize: 12, color: '#556688', lineHeight: 1.7 }}>
            Your name is normalized (uppercase, last name first) and run through
            SHA-256, producing a short fingerprint. That fingerprint is compared
            against a pre-built index of hashed signer names downloaded once to
            your browser — no name or search query ever leaves your device.
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4a9eff', marginBottom: 6 }}>
            Privacy &amp; security
          </div>
          <div style={{ fontSize: 12, color: '#556688', lineHeight: 1.7 }}>
            SHA-256 is a one-way function — the index cannot be reverse-engineered
            to recover signer names. The lookup file contains only hashes, not names.
            No analytics, no logging, no server ever sees what you type.
          </div>
        </div>
      </div>

      <form onSubmit={handleLookup} style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px' }}>
          <label style={{ fontSize: 11, color: '#445577', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            First Name
          </label>
          <input
            style={inputStyle}
            value={firstName}
            onChange={e => { setFirstName(e.target.value); setResult(RESULT.IDLE) }}
            placeholder="e.g. Jane"
            autoComplete="given-name"
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 140px' }}>
          <label style={{ fontSize: 11, color: '#445577', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            Last Name
          </label>
          <input
            style={inputStyle}
            value={lastName}
            onChange={e => { setLastName(e.target.value); setResult(RESULT.IDLE) }}
            placeholder="e.g. Smith"
            autoComplete="family-name"
          />
        </div>
        {districtOptions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px' }}>
            <label style={{ fontSize: 11, color: '#445577', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              Senate District <span style={{ color: '#334466', fontWeight: 'normal' }}>(optional)</span>
            </label>
            <select
              style={selectStyle}
              value={senateDistrict}
              onChange={e => setSenateDistrict(e.target.value)}
            >
              <option value="">— Select district —</option>
              {districtOptions.map(d => (
                <option key={d.d} value={d.d}>
                  District {d.d} — {Math.round(d.pctVerified * 100)}% verified
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          type="submit"
          disabled={result === RESULT.LOADING || !firstName.trim() || !lastName.trim()}
          style={{
            background: '#4a9eff',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            cursor: result === RESULT.LOADING ? 'wait' : 'pointer',
            fontFamily: 'Georgia, serif',
            fontSize: 14,
            fontWeight: 'bold',
            padding: '10px 22px',
            opacity: (!firstName.trim() || !lastName.trim()) ? 0.4 : 1,
            transition: 'opacity 0.15s',
            alignSelf: 'flex-end',
          }}
        >
          {result === RESULT.LOADING ? 'Checking…' : 'Check'}
        </button>
        {result !== RESULT.IDLE && result !== RESULT.LOADING && (
          <button
            type="button"
            onClick={handleReset}
            style={{
              background: 'transparent',
              border: '1px solid #1e2a4a',
              borderRadius: 6,
              color: '#445577',
              cursor: 'pointer',
              fontFamily: 'Georgia, serif',
              fontSize: 13,
              padding: '10px 16px',
              alignSelf: 'flex-end',
            }}
          >
            Clear
          </button>
        )}
      </form>

      {/* Selected district status panel */}
      {selectedDistrict && result === RESULT.IDLE && (
        <div style={{
          marginTop: 14,
          background: '#080d1c',
          border: '1px solid #1a2540',
          borderRadius: 8,
          padding: '12px 16px',
          display: 'flex',
          gap: 20,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 11, color: '#445577', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>District {selectedDistrict.d}</div>
            <div style={{ fontSize: 13, color: '#e8eaf0' }}>{selectedDistrict.verified.toLocaleString()} verified of {selectedDistrict.threshold.toLocaleString()} needed</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#445577', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Status</div>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: tierColor[selectedDistrict.tier] || '#8899bb' }}>{selectedDistrict.tier}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#445577', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Qualification odds</div>
            <div style={{ fontSize: 13, color: '#e8eaf0' }}>{Math.round(selectedDistrict.prob * 100)}%</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#445577', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Threshold</div>
            <div style={{ fontSize: 13, color: '#e8eaf0' }}>{Math.round(selectedDistrict.pctVerified * 100)}% of {Math.round(selectedDistrict.threshold / selectedDistrict.pctVerified * 8 / 100).toLocaleString()} eligible signers</div>
          </div>
        </div>
      )}

      {/* Result */}
      {result === RESULT.FOUND && (
        <div style={{
          marginTop: 18,
          background: '#001a10',
          border: '1px solid #2d6a4f',
          borderRadius: 8,
          padding: '14px 18px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
            <span style={{ fontSize: 22 }}>✅</span>
            <div>
              <div style={{ color: '#4caf50', fontWeight: 'bold', fontSize: 15, marginBottom: 4 }}>
                {firstName} {lastName} is on the petition
              </div>
              <div style={{ color: '#556688', fontSize: 13, lineHeight: 1.6 }}>
                Your name appears as a verified signer in the current Lt. Governor data.
                County clerks may still remove signatures through March 7, 2026
                if they are found to be invalid.
              </div>
            </div>
          </div>

          {/* Removal instructions */}
          <div style={{
            borderTop: '1px solid #1d4a35',
            paddingTop: 12,
            marginTop: 4,
          }}>
            <div style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4a9eff', marginBottom: 8 }}>
              How to remove your signature
            </div>
            <div style={{ fontSize: 12, color: '#556688', lineHeight: 1.8 }}>
              <div style={{ marginBottom: 6 }}>
                <span style={{ color: '#8899bb', fontWeight: 'bold' }}>Option 1 — Contact your county clerk directly.</span>{' '}
                Visit{' '}
                <a
                  href="https://elections.utah.gov/county-clerk-contact"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#4a9eff' }}
                >
                  elections.utah.gov/county-clerk-contact
                </a>{' '}
                to find your county clerk's phone number or email. Provide your full name,
                address, and date of birth and request that your signature be withdrawn.
                The deadline is <strong style={{ color: '#8899bb' }}>March 7, 2026</strong>.
              </div>
              <div style={{ marginBottom: 6 }}>
                <span style={{ color: '#8899bb', fontWeight: 'bold' }}>Option 2 — Contact the Lt. Governor's Elections Office.</span>{' '}
                Call <strong style={{ color: '#8899bb' }}>801-538-1041</strong> or visit{' '}
                <a
                  href="https://vote.utah.gov"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#4a9eff' }}
                >
                  vote.utah.gov
                </a>{' '}
                and ask to be directed to your county clerk for signature withdrawal.
              </div>
              <div style={{ color: '#445577', fontSize: 11, marginTop: 4 }}>
                Note: you must act before the March 7, 2026 clerk deadline. After that date the list is finalized.
              </div>
            </div>
          </div>
        </div>
      )}

      {result === RESULT.NOT_FOUND && (
        <div style={{
          marginTop: 18,
          background: '#1a0a00',
          border: '1px solid #7f3d00',
          borderRadius: 8,
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
        }}>
          <span style={{ fontSize: 22 }}>❌</span>
          <div>
            <div style={{ color: '#ff7043', fontWeight: 'bold', fontSize: 15, marginBottom: 4 }}>
              {firstName} {lastName} was not found
            </div>
            <div style={{ color: '#556688', fontSize: 13, lineHeight: 1.6 }}>
              Your name does not appear in the current verified signature list.
              If you believe you signed the petition, try a different spelling of
              your name, or contact the Lt. Governor's office to verify your signature
              status at{' '}
              <a
                href="https://vote.utah.gov"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: '#4a9eff' }}
              >
                vote.utah.gov
              </a>.
            </div>
          </div>
        </div>
      )}

      {result === RESULT.ERROR && (
        <div style={{
          marginTop: 18,
          background: '#1a0a0a',
          border: '1px solid #7f1d1d',
          borderRadius: 8,
          padding: '14px 18px',
          color: '#fca5a5',
          fontSize: 13,
        }}>
          Could not load the signature index. Please try again in a moment.
        </div>
      )}

      <div style={{ marginTop: 14, fontSize: 11, color: '#334466', lineHeight: 1.5 }}>
        Index updated daily from the official Lt. Governor petition list.
      </div>
    </div>
  )
}
