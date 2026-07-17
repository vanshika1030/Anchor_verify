import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, Upload as UploadIcon, Sparkles, X, ArrowRight, RotateCcw, Shirt, Eye } from 'lucide-react'
import { useApp } from '../AppContext'
import { extractAnchorAttributes } from '../services/api'
import Stepper from '../components/Stepper'

const FLOW = ['Upload', 'Details', 'Verify', 'Publish']

const ANCHOR_STEPS = [
  {
    key: 'front',
    title: 'Front view',
    instruction: 'Place the garment flat on a plain surface, front facing up. Good lighting, no shadows, no wrinkles.',
    icon: Shirt,
  },
  {
    key: 'back',
    title: 'Back view',
    instruction: 'Flip the garment over. Same position, same lighting. We need to see the back construction.',
    icon: RotateCcw,
  },
  {
    key: 'closeup',
    title: 'Fabric closeup',
    instruction: 'Hold camera 6-8 inches from the fabric. Capture the weave, texture, and any embellishment detail.',
    icon: Eye,
  },
]

export default function Upload() {
  const nav = useNavigate()
  const {
    anchorFront, setAnchorFront,
    anchorBack, setAnchorBack,
    anchorCloseup, setAnchorCloseup,
    catalogFiles, setCatalogFiles,
    catalogPreviews, setCatalogPreviews,
    mode, setMode,
    setAnchorExtracted, setExtracting, extracting, error, setError,
    getAnchorPreviews,
  } = useApp()
  const fileRef = useRef(null)
  const catalogRef = useRef(null)

  // Which anchor step we're on (0=front, 1=back, 2=closeup, 3=done)
  const anchorImages = [anchorFront, anchorBack, anchorCloseup]
  const currentAnchorStep = anchorImages.findIndex(img => img === null)
  const anchorStep = currentAnchorStep === -1 ? 3 : currentAnchorStep

  const pickAnchor = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      const data = { file, preview: e.target.result }
      if (anchorStep === 0) setAnchorFront(data)
      else if (anchorStep === 1) setAnchorBack(data)
      else if (anchorStep === 2) setAnchorCloseup(data)
    }
    reader.readAsDataURL(file)
  }

  const removeAnchor = (idx) => {
    if (idx === 0) { setAnchorFront(null); setAnchorBack(null); setAnchorCloseup(null) }
    else if (idx === 1) { setAnchorBack(null); setAnchorCloseup(null) }
    else { setAnchorCloseup(null) }
  }

  const pickCatalog = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      setCatalogFiles(prev => [...prev, file])
      setCatalogPreviews(prev => [...prev, e.target.result])
    }
    reader.readAsDataURL(file)
  }

  const removeCatalog = (idx) => {
    setCatalogFiles(prev => prev.filter((_, i) => i !== idx))
    setCatalogPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  const allAnchorDone = anchorStep === 3
  const canContinue = allAnchorDone && (mode === 'generate' || catalogFiles.length >= 1)

  const handleContinue = async () => {
    // Extract attributes from anchor images via backend
    setExtracting(true)
    setError(null)
    try {
      const files = [anchorFront?.file, anchorBack?.file, anchorCloseup?.file].filter(Boolean)
      const result = await extractAnchorAttributes(files)
      setAnchorExtracted(result.attributes)
      nav('/new-listing/details')
    } catch (err) {
      console.error('Anchor extraction failed:', err)
      setError(`Extraction failed: ${err.message}`)
    } finally {
      setExtracting(false)
    }
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <Stepper steps={FLOW} current={0} />

      {/* Step-by-step anchor upload */}
      <div className="card">
        <div className="card-title">Anchor photos (3 required)</div>
        <div className="card-desc">
          Your real product photos are the ground truth. We need front, back, and a fabric closeup.
        </div>

        {/* Completed thumbnails */}
        {anchorStep > 0 && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
            {anchorImages.map((img, i) => {
              if (!img) return null
              return (
                <div key={i} style={{ position: 'relative', width: 80 }}>
                  <img
                    src={img.preview} alt={ANCHOR_STEPS[i].title}
                    style={{ width: 80, height: 106, objectFit: 'cover', borderRadius: 6, border: '2px solid var(--success)', display: 'block' }}
                  />
                  <div style={{ fontSize: 10, textAlign: 'center', marginTop: 3, color: 'var(--success)', fontWeight: 600 }}>
                    {ANCHOR_STEPS[i].title}
                  </div>
                  <button
                    onClick={() => removeAnchor(i)}
                    style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: 'var(--danger)', color: 'white', border: 'none', cursor: 'pointer', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={10} />
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {/* Current step upload zone */}
        {anchorStep < 3 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              {(() => { const Icon = ANCHOR_STEPS[anchorStep].icon; return <Icon size={18} color="var(--accent)" /> })()}
              <span style={{ fontSize: 14, fontWeight: 600 }}>
                Step {anchorStep + 1} of 3: {ANCHOR_STEPS[anchorStep].title}
              </span>
            </div>
            <div
              className="drop-zone"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('over') }}
              onDragLeave={e => e.currentTarget.classList.remove('over')}
              onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('over'); pickAnchor(e.dataTransfer.files[0]) }}
            >
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { pickAnchor(e.target.files[0]); e.target.value = '' }} />
              <Camera size={24} color="var(--text-tertiary)" />
              <div className="drop-title">{ANCHOR_STEPS[anchorStep].instruction}</div>
              <div className="drop-hint">Drop photo or <span className="drop-link">browse</span> — JPG/PNG</div>
            </div>
          </div>
        )}

        {/* All done */}
        {allAnchorDone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px', borderRadius: 6, background: 'var(--success-bg)', border: '1px solid var(--success-border)', fontSize: 13, color: 'var(--success)' }}>
            All 3 anchor photos captured. Ready for attribute extraction.
          </div>
        )}
      </div>

      {/* Mode toggle — only after all anchor photos */}
      {allAnchorDone && (
        <>
          <div className="mode-toggle">
            <button className={`mode-btn ${mode === 'upload' ? 'active' : ''}`} onClick={() => setMode('upload')}>
              I have catalog images
            </button>
            <button className={`mode-btn ${mode === 'generate' ? 'active' : ''}`} onClick={() => setMode('generate')}>
              Generate with Anchor
            </button>
          </div>

          {mode === 'upload' ? (
            <div className="card">
              <div className="card-title">Catalog images</div>
              <div className="card-desc">
                Upload 4-6 images: front, back, side, closeup, lifestyle. From any source.
              </div>

              {catalogPreviews.length > 0 && (
                <div className="catalog-grid" style={{ marginBottom: 14 }}>
                  {catalogPreviews.map((p, i) => (
                    <div className="catalog-thumb" key={i}>
                      <img src={p} alt={`Catalog ${i + 1}`} />
                      <div className="catalog-thumb-label">
                        {['Front', 'Back', 'Side', 'Closeup', 'Lifestyle'][i] || `Image ${i + 1}`}
                      </div>
                      <button onClick={() => removeCatalog(i)} style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(255,255,255,0.9)', border: 'none', borderRadius: 3, cursor: 'pointer', padding: '2px 4px' }}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {catalogPreviews.length < 6 && (
                <div
                  className="drop-zone" style={{ padding: '20px 16px' }}
                  onClick={() => catalogRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('over') }}
                  onDragLeave={e => e.currentTarget.classList.remove('over')}
                  onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('over'); pickCatalog(e.dataTransfer.files[0]) }}
                >
                  <input ref={catalogRef} type="file" accept="image/*" hidden onChange={e => { pickCatalog(e.target.files[0]); e.target.value = '' }} />
                  <UploadIcon size={18} color="var(--text-tertiary)" />
                  <div className="drop-title" style={{ fontSize: 13 }}>Add catalog image ({catalogPreviews.length}/6)</div>
                  <div className="drop-hint">3:4 portrait, 1080x1440px min, JPEG</div>
                </div>
              )}
            </div>
          ) : (
            <div className="info-box" style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 14 }}>✨ AI Listing Generation</div>
              <div style={{ lineHeight: 1.6 }}>
                We'll use your anchor photos to auto-generate a complete Myntra listing — title, description, key features, tags, and care instructions.
                Your product photos will be verified against your declared attributes.
              </div>
            </div>
          )}
        </>
      )}

      {/* Error display */}
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 6, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
        <button className="btn btn-ghost" onClick={() => nav('/')}>Back</button>
        <button className="btn btn-primary" disabled={!canContinue || extracting} onClick={handleContinue}>
          {extracting ? (
            <><span className="spinner" style={{ marginRight: 6 }} /> Extracting attributes...</>
          ) : (
            <>Continue to details <ArrowRight size={14} /></>
          )}
        </button>
      </div>
    </div>
  )
}
