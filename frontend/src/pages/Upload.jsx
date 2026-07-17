import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload as UploadIcon, Camera, Sparkles, X } from 'lucide-react'
import { useApp } from '../AppContext'
import Stepper from '../components/Stepper'

const FLOW = ['Upload', 'Details', 'Verify', 'Publish']

export default function Upload() {
  const nav = useNavigate()
  const { anchorFile, setAnchorFile, anchorPreview, setAnchorPreview, catalogFiles, setCatalogFiles, catalogPreviews, setCatalogPreviews, mode, setMode } = useApp()
  const anchorRef = useRef(null)
  const catalogRef = useRef(null)

  const pickFile = (file, type) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = e => {
      if (type === 'anchor') { setAnchorFile(file); setAnchorPreview(e.target.result) }
      else {
        setCatalogFiles(prev => [...prev, file])
        setCatalogPreviews(prev => [...prev, e.target.result])
      }
    }
    reader.readAsDataURL(file)
  }

  const removeCatalog = (idx) => {
    setCatalogFiles(prev => prev.filter((_, i) => i !== idx))
    setCatalogPreviews(prev => prev.filter((_, i) => i !== idx))
  }

  const canGo = anchorFile && (mode === 'generate' || catalogFiles.length >= 1)

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <Stepper steps={FLOW} current={0} />

      {/* Anchor upload */}
      <div className="card">
        <div className="card-title">Anchor photo</div>
        <div className="card-desc">Your real product photo. This is the ground truth that everything is verified against.</div>

        {!anchorFile ? (
          <div
            className="drop-zone"
            onClick={() => anchorRef.current?.click()}
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('over') }}
            onDragLeave={e => e.currentTarget.classList.remove('over')}
            onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('over'); pickFile(e.dataTransfer.files[0], 'anchor') }}
          >
            <input ref={anchorRef} type="file" accept="image/*" hidden onChange={e => pickFile(e.target.files[0], 'anchor')} />
            <Camera size={28} color="var(--text-tertiary)" />
            <div className="drop-title">Drop your product photo here</div>
            <div className="drop-hint">or <span className="drop-link">browse files</span> — JPG/PNG, min 800x800px</div>
          </div>
        ) : (
          <div className="drop-zone filled">
            <div className="file-row">
              <img src={anchorPreview} alt="Anchor" className="file-thumb" />
              <div>
                <div className="file-name">{anchorFile.name}</div>
                <div className="file-ok">Accepted</div>
              </div>
              <button className="file-remove" onClick={() => { setAnchorFile(null); setAnchorPreview(null) }}>
                <X size={14} /> Remove
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mode toggle */}
      {anchorFile && (
        <>
          <div className="mode-toggle">
            <button className={`mode-btn ${mode === 'upload' ? 'active' : ''}`} onClick={() => setMode('upload')}>
              <UploadIcon size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
              I have catalog images
            </button>
            <button className={`mode-btn ${mode === 'generate' ? 'active' : ''}`} onClick={() => setMode('generate')}>
              <Sparkles size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
              Generate with Anchor
            </button>
          </div>

          {mode === 'upload' ? (
            <div className="card">
              <div className="card-title">Catalog images</div>
              <div className="card-desc">
                Upload 4–6 images: front, back, side, closeup, and lifestyle shots.
                From any source — your photographer, a third-party tool, or AI generated.
              </div>

              {/* Uploaded thumbs */}
              {catalogPreviews.length > 0 && (
                <div className="catalog-grid" style={{ marginBottom: 16 }}>
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
                  className="drop-zone"
                  style={{ padding: '24px 16px' }}
                  onClick={() => catalogRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('over') }}
                  onDragLeave={e => e.currentTarget.classList.remove('over')}
                  onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('over'); pickFile(e.dataTransfer.files[0], 'catalog') }}
                >
                  <input ref={catalogRef} type="file" accept="image/*" hidden onChange={e => pickFile(e.target.files[0], 'catalog')} />
                  <UploadIcon size={20} color="var(--text-tertiary)" />
                  <div className="drop-title" style={{ fontSize: 13 }}>
                    Add catalog image ({catalogPreviews.length}/6)
                  </div>
                  <div className="drop-hint">3:4 portrait, 1080x1440px minimum, JPEG recommended</div>
                </div>
              )}

              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 8 }}>
                Required: front, back, side, closeup. Product must fill 85%+ of frame.
              </div>
            </div>
          ) : (
            <div className="info-box">
              We'll generate 5 catalog images (front, back, side, fabric closeup, lifestyle) using your anchor photo as reference,
              following Myntra's specifications: 3:4 portrait, 1080x1440px, light grey background, model-on shots.
            </div>
          )}
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
        <button className="btn btn-ghost" onClick={() => nav('/')}>Back</button>
        <button className="btn btn-primary" disabled={!canGo} onClick={() => nav('/new-listing/details')}>
          Continue to details
        </button>
      </div>
    </div>
  )
}
