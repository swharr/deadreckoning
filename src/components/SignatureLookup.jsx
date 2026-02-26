import React, { useState, useRef } from 'react'

// ---------------------------------------------------------------------------
// Bloom filter helpers — must match Python build_bloom_filter() exactly
// ---------------------------------------------------------------------------

// Double hashing: h_i(x) = (h1 + i*h2) mod m
// h1 = first 8 bytes of SHA-256 as BigInt, h2 = bytes 8-16 (forced odd)
async function bloomPositions(key, m, k) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  const bytes = new Uint8Array(buf)
  // Read as 64-bit big-endian BigInts
  let h1 = 0n
  let h2 = 0n
  for (let i = 0; i < 8; i++) h1 = (h1 << 8n) | BigInt(bytes[i])
  for (let i = 8; i < 16; i++) h2 = (h2 << 8n) | BigInt(bytes[i])
  h2 = h2 | 1n  // force odd
  const M = BigInt(m)
  const positions = []
  for (let i = 0n; i < BigInt(k); i++) {
    positions.push(Number((h1 + i * h2) % M))
  }
  return positions
}

function bloomCheck(bits64, m, k, positions) {
  // bits64 is a Uint8Array decoded from base64
  for (const pos of positions) {
    const byteIdx = pos >> 3
    const bitIdx = pos & 7
    if (!(bits64[byteIdx] & (1 << bitIdx))) return false
  }
  return true
}

function base64ToUint8Array(b64) {
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return arr
}

// District-scoped bloom lookup: key = "LASTNAME,FIRSTNAME,D{n}"
async function bloomLookup(districtBloom, lastName, firstName, districtNum) {
  const { m, k, bits } = districtBloom
  const key = `${lastName.trim().toUpperCase()},${firstName.trim().toUpperCase()},D${districtNum}`
  const positions = await bloomPositions(key, m, k)
  const bitsArr = base64ToUint8Array(bits)
  return bloomCheck(bitsArr, m, k, positions)
}

const RESULT = {
  FOUND: 'found',
  NOT_FOUND: 'not_found',
  IDLE: 'idle',
  LOADING: 'loading',
  ERROR: 'error',
}

function SignatureLookupInner({ districts = [] }) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [senateDistrict, setSenateDistrict] = useState('')
  const [result, setResult] = useState(RESULT.IDLE)
  const hashSetRef = useRef(null)  // loaded once, cached in memory
  const [zipCode, setZipCode] = useState('')
  const [zipResult, setZipResult] = useState(null)
  const zipMapRef = useRef(null)

  async function loadZipMap() {
    if (zipMapRef.current) return zipMapRef.current
    const resp = await fetch('/districts-by-zip.json')
    if (!resp.ok) return null
    const data = await resp.json()
    zipMapRef.current = data
    return data
  }

  async function handleZipLookup(zip) {
    setZipCode(zip)
    setZipResult(null)
    if (zip.length !== 5) return
    const map = await loadZipMap()
    if (!map) return
    const matched = map[zip]
    if (matched && matched.length > 0) {
      setZipResult(matched)
      if (matched.length === 1) {
        setSenateDistrict(String(matched[0]))
      }
    } else {
      setZipResult([])
    }
  }

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
    hashSetRef.current = data  // store full bloom filter object
    return hashSetRef.current
  }

  async function handleLookup(e) {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim() || !senateDistrict) return

    setResult(RESULT.LOADING)
    try {
      const index = await loadIndex()

      if (index.version === 2) {
        // Bloom filter lookup — district-scoped
        const districtBloom = index.districts[String(senateDistrict)]
        if (!districtBloom) {
          setResult(RESULT.NOT_FOUND)
          return
        }
        const found = await bloomLookup(districtBloom, lastName, firstName, senateDistrict)
        setResult(found ? RESULT.FOUND : RESULT.NOT_FOUND)
      } else {
        // Legacy v1 hash set fallback
        const hashSet = new Set(index.hashes)
        const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(
          `${lastName.trim().toUpperCase()},${firstName.trim().toUpperCase()}`
        ))
        const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
        setResult(hashSet.has(hex.slice(0, 20)) ? RESULT.FOUND : RESULT.NOT_FOUND)
      }
    } catch (err) {
      console.error(err)
      setResult(RESULT.ERROR)
    }
  }

  function handleReset() {
    setFirstName('')
    setLastName('')
    setSenateDistrict('')
    setZipCode('')
    setZipResult(null)
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
    'CONFIRMED': '#00c853',
    'NEARLY CERTAIN': '#4caf50',
    'VERY LIKELY': '#69f0ae',
    'LIKELY': '#8bc34a',
    'POSSIBLE': '#ffca28',
    'UNLIKELY': '#ff5722',
    'NO CHANCE': '#f44336',
  }

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{
        fontSize: 13,
        fontWeight: 'bold',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: '#8899bb',
        marginBottom: 6,
        display: 'none',   // title now lives in the collapsible header
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
        You must select your Senate district to search; we do not support searching all districts.
        Note: there may be people with the same name in your district — a match is not a guarantee of identity.
        To remove your signature from the petition, see{' '}
        <a
          href="https://vote.utah.gov/how-do-i-remove-my-signature-from-a-petition/"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#4a9eff' }}
        >
          how to remove your signature (vote.utah.gov)
        </a>.
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
            Your name and Senate district are combined and run through SHA-256,
            producing a fingerprint scoped to your district. That fingerprint is
            checked against a compact bloom filter downloaded once to your browser
            — no name, district, or query ever leaves your device. District is
            required to prevent false matches from people with the same name in
            other districts.
          </div>
        </div>
        <div>
          <div style={{ fontSize: 11, fontWeight: 'bold', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#4a9eff', marginBottom: 6 }}>
            Privacy &amp; security
          </div>
          <div style={{ fontSize: 12, color: '#556688', lineHeight: 1.7 }}>
            SHA-256 is a one-way function — the index cannot be reverse-engineered
            to recover signer names. The lookup file contains only hashes, not names.
            Lookup inputs stay in your browser and are not sent to a server.
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 120px', maxWidth: 140 }}>
          <label style={{ fontSize: 11, color: '#445577', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            ZIP Code
          </label>
          <input
            style={{ ...inputStyle, flex: 'none' }}
            value={zipCode}
            onChange={e => handleZipLookup(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g. 84101"
            inputMode="numeric"
            maxLength={5}
          />
        </div>
        {districtOptions.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: '1 1 180px' }}>
            <label style={{ fontSize: 11, color: '#445577', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
              Senate District <span style={{ color: '#f44336', fontWeight: 'normal' }}>*</span>
            </label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
              <select
                style={{ ...selectStyle, flex: 1 }}
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
              <a
                href="https://le.utah.gov/GIS/findDistrict.jsp"
                target="_blank"
                rel="noopener noreferrer"
                title="Look up your Senate district on the official Utah Legislature site"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#0d1530',
                  border: '1px solid #1e2a4a',
                  borderRadius: 6,
                  padding: '0 10px',
                  color: '#4a9eff',
                  fontSize: 11,
                  fontFamily: 'Georgia, serif',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                  flexShrink: 0,
                }}
              >
                Find my district
              </a>
            </div>
          </div>
        )}
        {zipResult && zipResult.length > 1 && (
          <div style={{ width: '100%', fontSize: 12, color: '#8899bb', marginTop: -4 }}>
            This ZIP spans multiple districts ({zipResult.map(d => `D${d}`).join(', ')}). Please select yours above or{' '}
            <a
              href="https://le.utah.gov/GIS/findDistrict.jsp"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#4a9eff' }}
            >
              look up your exact district
            </a>.
          </div>
        )}
        {zipResult && zipResult.length === 0 && zipCode.length === 5 && (
          <div style={{ width: '100%', fontSize: 12, color: '#ff7043', marginTop: -4 }}>
            ZIP not found in our lookup table.{' '}
            <a
              href="https://le.utah.gov/GIS/findDistrict.jsp"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#4a9eff' }}
            >
              Use the official lookup instead
            </a>.
          </div>
        )}
        <button
          type="submit"
          disabled={result === RESULT.LOADING || !firstName.trim() || !lastName.trim() || !senateDistrict}
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
            opacity: (!firstName.trim() || !lastName.trim() || !senateDistrict) ? 0.4 : 1,
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
            <div style={{ fontSize: 13, color: '#e8eaf0' }}>
              {Math.round(selectedDistrict.pctVerified * 100)}% of{' '}
              {selectedDistrict.pctVerified > 0
                ? Math.round(selectedDistrict.threshold / selectedDistrict.pctVerified * 8 / 100).toLocaleString()
                : '—'} eligible signers
            </div>
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
                County clerks may still remove signatures through March 9, 2026
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
              <div style={{ marginBottom: 8 }}>
                Official instructions:{' '}
                <a
                  href="https://vote.utah.gov/how-do-i-remove-my-signature-from-a-petition/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#4a9eff' }}
                >
                  vote.utah.gov — How do I remove my signature from a petition?
                </a>
              </div>
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
                The deadline is <strong style={{ color: '#8899bb' }}>March 9, 2026</strong>.
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
                Note: you must act before the March 9, 2026 clerk deadline. After that date the list is finalized.
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

// ---------------------------------------------------------------------------
// Collapsible wrapper exported as the default
// ---------------------------------------------------------------------------
export default function SignatureLookup({ districts = [] }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{
      background: '#0d1530',
      border: '1px solid #1e2a4a',
      borderRadius: 10,
      overflow: 'hidden',
    }}>
      {/* Collapse toggle header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'transparent',
          border: 'none',
          borderBottom: open ? '1px solid #1e2a4a' : 'none',
          padding: '16px 28px',
          cursor: 'pointer',
          textAlign: 'left',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 13 }}>🔍</span>
          <span style={{
            fontSize: 13,
            fontWeight: 'bold',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#8899bb',
          }}>
            Signature Lookup
          </span>
          {!open && (
            <span style={{ fontSize: 12, color: '#334466', fontWeight: 'normal', letterSpacing: 0, textTransform: 'none' }}>
              — check if your name is on the petition
            </span>
          )}
        </div>
        <span style={{
          fontSize: 12,
          color: '#445577',
          fontFamily: 'monospace',
          flexShrink: 0,
          transition: 'transform 0.2s',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          display: 'inline-block',
        }}>
          ▼
        </span>
      </button>

      {/* Collapsible content — inner component renders inside here without its own card wrapper */}
      {open && (
        <div style={{ padding: '0 0 4px' }}>
          <SignatureLookupInner districts={districts} />
        </div>
      )}
    </div>
  )
}
