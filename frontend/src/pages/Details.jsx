import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../AppContext'
import Stepper from '../components/Stepper'
import { CheckCircle, Sparkles, Edit3 } from 'lucide-react'

const FLOW = ['Upload', 'Details', 'Verify', 'Publish']

const DETECTED = [
  { key: 'garment_type', label: 'Garment', value: 'Kurta' },
  { key: 'sleeve_type', label: 'Sleeve', value: 'Elbow Length' },
  { key: 'neck_type', label: 'Neck', value: 'Round Neck' },
  { key: 'pattern', label: 'Pattern', value: 'Printed' },
  { key: 'primary_color', label: 'Color', value: 'Navy Blue' },
  { key: 'silhouette', label: 'Silhouette', value: 'A-Line' },
  { key: 'fit_type', label: 'Fit', value: 'Regular' },
  { key: 'overall_length', label: 'Length', value: 'Regular' },
]

export default function Details() {
  const nav = useNavigate()
  const { anchorPreview, mode, setConfirmedAttrs } = useApp()

  const [attrs, setAttrs] = useState(DETECTED)
  const [editing, setEditing] = useState(null)
  const [editVal, setEditVal] = useState('')
  const [fabric, setFabric] = useState('')
  const [chest, setChest] = useState('')
  const [frontLen, setFrontLen] = useState('')
  const [sleeveLen, setSleeveLen] = useState('')
  const [washCare, setWashCare] = useState('')
  const [modelH, setModelH] = useState("5'6\"")
  const [modelS, setModelS] = useState('M')

  const beginEdit = i => { setEditing(i); setEditVal(attrs[i].value) }
  const saveEdit = () => {
    if (editing === null) return
    const next = [...attrs]; next[editing] = { ...next[editing], value: editVal }
    setAttrs(next); setEditing(null)
  }

  const handleContinue = () => {
    const confirmed = {}
    attrs.forEach(a => confirmed[a.key] = a.value)
    confirmed.fabric = fabric; confirmed.fabric_composition = fabric
    confirmed.chest = chest; confirmed.front_length = frontLen
    confirmed.sleeve_length_inches = sleeveLen; confirmed.wash_care = washCare
    confirmed.model_height = modelH; confirmed.model_size = modelS
    setConfirmedAttrs(confirmed)
    nav('/new-listing/verify')
  }

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      <Stepper steps={FLOW} current={1} />

      <div className="cols-55-45">
        {/* Left — image */}
        <div className="card">
          <div className="card-title">Your product</div>
          {anchorPreview ? (
            <img src={anchorPreview} alt="Anchor" style={{ width: '100%', borderRadius: 6, border: '1px solid var(--border)', marginBottom: 12, aspectRatio: '3/4', objectFit: 'cover' }} />
          ) : (
            <div className="img-placeholder" style={{ marginBottom: 12 }}>No image uploaded</div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 6, background: 'var(--success-bg)', border: '1px solid var(--success-border)', fontSize: 12 }}>
            <CheckCircle size={14} color="var(--success)" />
            <span>Garment isolated — segmentation confidence 92%</span>
          </div>
        </div>

        {/* Right — attributes */}
        <div className="card">
          <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={16} color="var(--accent)" /> Auto-detected attributes
          </div>
          <div className="card-desc">Click any attribute to edit if the detection is wrong.</div>

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
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: 12, width: 72, outline: 'none', fontFamily: 'var(--font)', fontWeight: 600 }}
                    />
                  </div>
                ) : (
                  <div className="chip" onClick={() => beginEdit(i)}>
                    <span className="chip-label">{a.label}</span>
                    <span className="chip-value">{a.value}</span>
                    <Edit3 size={10} color="var(--text-tertiary)" />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>Physical attributes</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14 }}>
              These cannot be detected from a photo — only you know these.
            </div>

            <div className="form-group">
              <label className="form-label">Fabric composition <span className="req">*</span></label>
              <input className="form-input" placeholder="e.g. 100% Cotton" value={fabric} onChange={e => setFabric(e.target.value)} />
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
                  <option>5'2"</option><option>5'4"</option><option>5'6"</option><option>5'8"</option><option>5'10"</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Size worn</label>
                <select className="form-select" value={modelS} onChange={e => setModelS(e.target.value)}>
                  <option>XS</option><option>S</option><option>M</option><option>L</option><option>XL</option>
                </select>
              </div>
            </div>
          </div>

          {mode === 'generate' && (
            <div className="info-box" style={{ marginTop: 14, fontSize: 12 }}>
              We'll generate 5 catalog images with a model matching {modelH} / {modelS},
              plus SEO-optimized title and description.
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
        <button className="btn btn-ghost" onClick={() => nav('/new-listing/upload')}>Back</button>
        <button className="btn btn-primary" onClick={handleContinue}>Review and verify</button>
      </div>
    </div>
  )
}
