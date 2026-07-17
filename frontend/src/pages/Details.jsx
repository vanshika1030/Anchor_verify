import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../AppContext'
import Stepper from '../components/Stepper'
import { CheckCircle, AlertTriangle, Edit3, ArrowRight } from 'lucide-react'

const FLOW = ['Upload', 'Details', 'Verify', 'Publish']

const ATTR_LABELS = {
  garment_type: 'Garment type', primary_color: 'Primary color', secondary_color: 'Secondary color',
  pattern_type: 'Pattern type', fabric_appearance: 'Fabric appearance', overall_length: 'Overall length',
  sleeve_length: 'Sleeve length', neck_type: 'Neck type', silhouette: 'Silhouette', fit: 'Fit',
  embellishment: 'Embellishment', transparency: 'Transparency', hemline: 'Hemline',
  occasion_style: 'Occasion', motif_description: 'Motif / print', closure_type: 'Closure',
  structural_features: 'Features',
}

const CONFIDENCE_COLOR = { HIGH: 'var(--success)', MEDIUM: 'var(--warning)', LOW: 'var(--danger)' }

export default function Details() {
  const nav = useNavigate()
  const { anchorFront, anchorExtracted, mode, confirmedAttrs, setConfirmedAttrs } = useApp()

  // Build editable attrs from Gemini extraction
  const [attrs, setAttrs] = useState([])
  const [editing, setEditing] = useState(null)
  const [editVal, setEditVal] = useState('')

  // Manual fields initialized from pre-filled CSV data if available
  const [fabric, setFabric] = useState(confirmedAttrs?.fabric_composition || '')
  const [chest, setChest] = useState('')
  const [frontLen, setFrontLen] = useState('')
  const [sleeveLen, setSleeveLen] = useState('')
  const [washCare, setWashCare] = useState('')
  const [modelH, setModelH] = useState(confirmedAttrs?.model_height || "5'6\"")
  const [modelS, setModelS] = useState(confirmedAttrs?.model_size || 'M')

  useEffect(() => {
    if (anchorExtracted) {
      const list = Object.entries(ATTR_LABELS).map(([key, label]) => {
        const extracted = anchorExtracted[key]
        // If the CSV (confirmedAttrs) has this key, use it as an override!
        const csvValue = confirmedAttrs?.[key]
        
        return {
          key,
          label,
          value: csvValue || extracted?.value || 'Not detected',
          confidence: csvValue ? 'HIGH' : (extracted?.confidence || 'LOW'),
        }
      }).filter(a => a.value !== 'Not determinable' && a.value !== 'Not detected' && a.value !== '')
      setAttrs(list)
    }
  }, [anchorExtracted, confirmedAttrs])

  const beginEdit = i => { setEditing(i); setEditVal(attrs[i].value) }
  const saveEdit = () => {
    if (editing === null) return
    const next = [...attrs]
    next[editing] = { ...next[editing], value: editVal, confidence: 'HIGH' } // seller override = HIGH confidence
    setAttrs(next)
    setEditing(null)
  }

  const handleContinue = () => {
    const confirmed = {}
    attrs.forEach(a => { confirmed[a.key] = a.value })
    confirmed.fabric_composition = fabric
    confirmed.chest = chest
    confirmed.front_length = frontLen
    confirmed.sleeve_length_inches = sleeveLen
    confirmed.wash_care = washCare
    confirmed.model_height = modelH
    confirmed.model_size = modelS
    setConfirmedAttrs(confirmed)
    nav('/new-listing/verify')
  }

  if (!anchorExtracted) {
    return (
      <div style={{ maxWidth: 600, margin: '40px auto', textAlign: 'center' }}>
        <div className="card" style={{ padding: 40 }}>
          <AlertTriangle size={28} color="var(--warning)" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>No extraction data</div>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 16 }}>
            Go back and upload your anchor photos first. We need to extract attributes before you can continue.
          </p>
          <button className="btn btn-primary" onClick={() => nav('/new-listing/upload')}>Go to upload</button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      <Stepper steps={FLOW} current={1} />

      <div className="cols-55-45">
        {/* Left — image + extraction status */}
        <div>
          <div className="card">
            <div className="card-title">Your product</div>
            {anchorFront?.preview && (
              <img src={anchorFront.preview} alt="Anchor" style={{ width: '100%', borderRadius: 6, border: '1px solid var(--border)', marginBottom: 12, maxHeight: 360, objectFit: 'cover' }} />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 6, background: 'var(--success-bg)', border: '1px solid var(--success-border)', fontSize: 12 }}>
              <CheckCircle size={14} color="var(--success)" />
              {attrs.length} attributes extracted from your anchor photos
            </div>
          </div>

          {/* Confidence legend */}
          <div className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Confidence levels</div>
            <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
              <span><span style={{ color: 'var(--success)', fontWeight: 700 }}>HIGH</span> — clearly visible</span>
              <span><span style={{ color: 'var(--warning)', fontWeight: 700 }}>MED</span> — inferred</span>
              <span><span style={{ color: 'var(--danger)', fontWeight: 700 }}>LOW</span> — uncertain</span>
            </div>
          </div>
        </div>

        {/* Right — attributes + form */}
        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Extracted attributes
          </div>
          <div className="card-desc">
            These were extracted by Gemini from your 3 anchor photos. Click any to correct if wrong.
          </div>

          {/* Attribute chips with confidence */}
          <div className="chips" style={{ marginBottom: 20 }}>
            {attrs.map((a, i) => (
              <div key={a.key}>
                {editing === i ? (
                  <div className="chip" style={{ borderColor: 'var(--accent)' }}>
                    <span className="chip-label">{a.label}</span>
                    <input
                      value={editVal} onChange={e => setEditVal(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveEdit()}
                      onBlur={saveEdit} autoFocus
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 12, width: 90, outline: 'none', fontFamily: 'var(--font)', fontWeight: 600 }}
                    />
                  </div>
                ) : (
                  <div className="chip" onClick={() => beginEdit(i)} title={`Confidence: ${a.confidence}`}>
                    <span className="chip-label">{a.label}</span>
                    <span className="chip-value">{a.value}</span>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: CONFIDENCE_COLOR[a.confidence] }} />
                    <Edit3 size={10} color="var(--text-tertiary)" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Manual fields */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>Physical attributes</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
              These cannot be detected from a photo.
            </div>

            <div className="form-group">
              <label className="form-label">Fabric composition <span className="req">*</span></label>
              <input className="form-input" placeholder="e.g. 100% Cotton, Georgette" value={fabric} onChange={e => setFabric(e.target.value)} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Chest (in)</label>
                <input className="form-input" type="number" placeholder="42" value={chest} onChange={e => setChest(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Front length (in)</label>
                <input className="form-input" type="number" placeholder="28" value={frontLen} onChange={e => setFrontLen(e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Sleeve length (in)</label>
                <input className="form-input" type="number" placeholder="14" value={sleeveLen} onChange={e => setSleeveLen(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Wash care</label>
                <select className="form-select" value={washCare} onChange={e => setWashCare(e.target.value)}>
                  <option value="">Select...</option>
                  <option>Machine Wash Cold</option>
                  <option>Hand Wash Only</option>
                  <option>Dry Clean Only</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Model height</label>
                <select className="form-select" value={modelH} onChange={e => setModelH(e.target.value)}>
                  <option>5'0"</option><option>5'1"</option><option>5'2"</option><option>5'3"</option><option>5'4"</option><option>5'5"</option><option>5'6"</option><option>5'7"</option><option>5'8"</option><option>5'9"</option><option>5'10"</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Size worn by model</label>
                <select className="form-select" value={modelS} onChange={e => setModelS(e.target.value)}>
                  <option>XS</option><option>S</option><option>M</option><option>L</option><option>XL</option><option>XXL</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
        <button className="btn btn-ghost" onClick={() => nav('/new-listing/upload')}>Back</button>
        <button className="btn btn-primary" onClick={handleContinue}>
          Review and verify <ArrowRight size={14} />
        </button>
      </div>
    </div>
  )
}
