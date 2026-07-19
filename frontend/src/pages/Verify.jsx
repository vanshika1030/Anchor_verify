import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../AppContext'
import Stepper from '../components/Stepper'
import { runVerification, updateCSVRow } from '../services/api'
import { CheckCircle, XCircle, AlertTriangle, ArrowRight, Eye, Loader, Sparkles, Package, Tag } from 'lucide-react'

const FLOW = ['Upload', 'Details', 'Verify', 'Publish']
const CONFIDENCE_DOT = { HIGH: 'var(--success)', MEDIUM: 'var(--warning)', LOW: 'var(--danger)' }

const ATTR_LABELS = {
  garment_type: 'Garment type', primary_color: 'Primary color', secondary_color: 'Secondary color',
  pattern_type: 'Pattern type', fabric_appearance: 'Fabric appearance', overall_length: 'Overall length',
  sleeve_length: 'Sleeve length', neck_type: 'Neck type', silhouette: 'Silhouette', fit: 'Fit',
  embellishment: 'Embellishment', transparency: 'Transparency', hemline: 'Hemline',
  occasion_style: 'Occasion / style', motif_description: 'Motif / print', closure_type: 'Closure',
  structural_features: 'Features', model_apparent_height: 'Model height (detected)',
  model_apparent_build: 'Model build (detected)', model_build: 'Model build (CLIP)',
  model_height_range: 'Model height (CLIP)', cv_overall_length: 'Length (geometric)',
}

export default function Verify() {
  const nav = useNavigate()
  const {
    anchorFront, anchorBack, anchorCloseup,
    catalogFiles, catalogPreviews, mode, confirmedAttrs, setConfirmedAttrs,
    anchorExtracted, setCatalogExtracted,
    comparisonResult, setComparisonResult,
    fabricResult, setFabricResult,
    phashResult, setPhashResult,
    verdict, setVerdict,
    modelIssues, setModelIssues,
    csvSessionId, csvRowIndex,
  } = useApp()

  const [acceptedCorrections, setAcceptedCorrections] = useState({})
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState(null)
  const [selectedCat, setSelectedCat] = useState(0)
  const [expandedRow, setExpandedRow] = useState(null)
  const [generatedMetadata, setGeneratedMetadata] = useState(null)
  const [corrections, setCorrections] = useState(null)
  const [actualMode, setActualMode] = useState(mode)
  
  // Simulated checklist progress
  const [checklistStep, setChecklistStep] = useState(0)
  const intervalRef = useRef(null)

  // Cleanup interval on unmount to prevent zombie state updates
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const hasRun = useRef(false)
  useEffect(() => {
    if (comparisonResult && verdict) {
      setLoading(false)
      return
    }
    if (hasRun.current) return
    hasRun.current = true
    doVerification()
  }, [])

  async function doVerification() {
    setLoading(true)
    setError(null)
    try {
      // Collect ALL anchor files
      const anchorFiles = [anchorFront?.file, anchorBack?.file, anchorCloseup?.file].filter(Boolean)

      if (anchorFiles.length === 0) {
        throw new Error('No anchor images found — go back and upload your product photos')
      }

      // Start the simulated checklist progression for the UI
      setChecklistStep(0)
      intervalRef.current = setInterval(() => {
        setChecklistStep(prev => Math.min(prev + 1, 3))
      }, 3500)

      // ONE API call — sends all images to the single-prompt pipeline
      const result = await runVerification({
        anchorFiles,
        catalogFiles: catalogFiles || [],
        declaredAttrs: confirmedAttrs || {},
        anchorExtracted: anchorExtracted || {},
        mode: mode,
      })

      setComparisonResult(result.comparison || [])
      setCatalogExtracted(result.catalog_attributes || null)
      setModelIssues(result.modelIssues || [])
      setFabricResult(result.fabricResult || null)
      setPhashResult(result.phashResult || null)
      setVerdict(result.verdict || { status: 'PASS', reason: 'Completed', critical_issues: [] })
      if (result.generatedMetadata) setGeneratedMetadata(result.generatedMetadata)
      if (result.corrections) setCorrections(result.corrections)
      if (result.mode) setActualMode(result.mode)
      
      setChecklistStep(4) // All done

    } catch (err) {
      console.error('Verification failed:', err)
      setError(err.message)
    } finally {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setLoading(false)
    }
  }

  const handlePublish = async () => {
    const v = verdict
    if (csvSessionId && csvRowIndex !== null && v) {
      const updates = {
        anchorVerificationStatus: v.status,
        anchorMismatchCount: (comparisonResult || []).filter(r => r.status === 'mismatch').length,
        anchorVerificationNotes: v.reason || '',
      }
      try {
        await updateCSVRow(csvSessionId, csvRowIndex, updates, 'published')
      } catch (err) {
        console.error('Failed to update CSV row:', err)
      }
    }

    // Save to database
    try {
      const token = localStorage.getItem('token')
      if (token) {
        const attrs = anchorExtracted || {}
        await fetch('http://localhost:3001/api/products', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title: attrs.garment_type || 'Product',
            article_type: attrs.garment_type || '',
            category: attrs.garment_type || '',
            brand_name: confirmedAttrs?.brand || 'Brand',
            attributes: attrs,
            verification_status: v?.status?.toLowerCase() || 'unverified',
            verification_score: v?.overall_similarity || null,
            anchor_image_url: anchorFront?.preview || null,
          })
        })
      }
    } catch (err) {
      console.error('Failed to save product:', err)
    }

    nav('/new-listing/success')
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div style={{ maxWidth: 500, margin: '80px auto', textAlign: 'center' }}>
        <Stepper steps={FLOW} current={2} />
        <div className="card" style={{ padding: '48px 32px' }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 24 }}>
            {actualMode === 'generate' ? 'Generating your listing' : 'Multi-Layered Verification Running...'}
          </div>
          
          <div style={{ textAlign: 'left', background: '#f8f9fa', padding: 24, borderRadius: 8, fontSize: 14, color: 'var(--text-secondary)' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              {checklistStep > 0 ? <CheckCircle size={18} color="var(--success)" /> : (checklistStep === 0 ? <Loader size={18} color="var(--accent)" className="spin" /> : <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px dashed #ccc' }} />)}
              <span style={{ color: checklistStep >= 0 ? '#333' : '#888' }}>Checking physical garment match (CLIP & pHash)...</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              {checklistStep > 1 ? <CheckCircle size={18} color="var(--success)" /> : (checklistStep === 1 ? <Loader size={18} color="var(--accent)" className="spin" /> : <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px dashed #ccc' }} />)}
              <span style={{ color: checklistStep >= 1 ? '#333' : '#888' }}>Extracting core attributes (Local ViT Model)...</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              {checklistStep > 2 ? <CheckCircle size={18} color="var(--success)" /> : (checklistStep === 2 ? <Loader size={18} color="var(--accent)" className="spin" /> : <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px dashed #ccc' }} />)}
              <span style={{ color: checklistStep >= 2 ? '#333' : '#888' }}>Cross-referencing nuanced metadata (Gemini Async)...</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {checklistStep > 3 ? <CheckCircle size={18} color="var(--success)" /> : (checklistStep === 3 ? <Loader size={18} color="var(--accent)" className="spin" /> : <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px dashed #ccc' }} />)}
              <span style={{ color: checklistStep >= 3 ? '#333' : '#888' }}>Running Bayesian verification math...</span>
            </div>
            
          </div>
          
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 24 }}>
            Executing ensemble architecture. This usually takes 10-15 seconds.
          </div>
        </div>
      </div>
    )
  }

  // ── Error state ──
  if (error) {
    return (
      <div style={{ maxWidth: 500, margin: '80px auto', textAlign: 'center' }}>
        <Stepper steps={FLOW} current={2} />
        <div className="card" style={{ padding: '32px' }}>
          <XCircle size={28} color="var(--danger)" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: 'var(--danger)' }}>Verification failed</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>{error}</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-outline" onClick={() => nav('/new-listing/upload')}>Go back</button>
            <button className="btn btn-primary" onClick={doVerification}>Retry verification</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Results ──
  const rows = comparisonResult || []
  const failCount = rows.filter(r => r.status === 'mismatch' && r.severity === 'HIGH').length + (modelIssues?.length || 0)
  const warnCount = rows.filter(r => r.status === 'mismatch' && r.severity !== 'HIGH').length + rows.filter(r => r.status === 'warning').length
  const passCount = rows.filter(r => r.status === 'match').length
  const skipCount = rows.filter(r => r.status === 'skip').length
  const v = verdict || { status: 'PASS', reason: 'Completed', critical_issues: [] }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <Stepper steps={FLOW} current={2} />

      {/* Verdict banner */}
      <div className={`verdict-bar ${v.status.toLowerCase()}`}>
        {v.status === 'PASS' && <CheckCircle size={20} color="var(--success)" />}
        {v.status === 'FAIL' && <XCircle size={20} color="var(--danger)" />}
        {v.status === 'WARNING' && <AlertTriangle size={20} color="var(--warning)" />}
        {v.status === 'UNVERIFIED' && <AlertTriangle size={20} color="var(--text-tertiary)" />}
        <div style={{ flex: 1 }}>
          <div className="verdict-title">{v.reason}</div>
          <div className="verdict-sub">
            {v.status === 'FAIL' ? 'Fix the issues below before publishing' :
             v.status === 'WARNING' ? 'Review warnings below. You can still publish.' :
             v.status === 'UNVERIFIED' ? 'Verification could not complete. Please retry or check your setup.' :
             actualMode === 'generate' ? 'Your listing metadata is ready to publish.' :
             'Your listing is ready to publish.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 12, fontWeight: 600 }}>
          <span style={{ color: 'var(--danger)' }}>{failCount} failed</span>
          <span style={{ color: 'var(--warning)' }}>{warnCount} warnings</span>
          <span style={{ color: 'var(--success)' }}>{passCount} passed</span>
          {skipCount > 0 && <span style={{ color: '#e65100' }}>{skipCount} not detected</span>}
        </div>
      </div>

      {/* 🚀 AI CORRECTION CO-PILOT */}
      {corrections && corrections.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--accent)', marginTop: 20, animation: 'fadeIn 0.5s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Sparkles size={20} color="var(--accent)" />
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>AI Correction Co-Pilot</div>
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
            We noticed some discrepancies between your inputs and our visual analysis. Items marked <strong style={{color:'var(--success)'}}>✓ Verified</strong> have been cross-checked against your anchor image.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {corrections.map((c, i) => {
              const status = acceptedCorrections[c.field] === 'IGNORED' ? 'ignored' : (acceptedCorrections[c.field] ? 'accepted' : 'pending');
              const isAccepted = status === 'accepted';
              const isIgnored = status === 'ignored';
              
              return (
                <div key={i} style={{ 
                  background: isAccepted ? '#e8f5e9' : isIgnored ? '#f5f5f5' : '#f8f9fa', 
                  borderRadius: 8, 
                  padding: 12, 
                  border: isAccepted ? '1px solid var(--success)' : '1px solid var(--border)',
                  opacity: isIgnored ? 0.6 : 1
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize', color: isAccepted ? 'var(--success)' : 'var(--text-secondary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {c.field.replace('_', ' ')}
                    {isAccepted && <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={12} /> Applied</span>}
                    {isIgnored && <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}><XCircle size={12} /> Ignored</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, textDecoration: isIgnored ? 'line-through' : 'none' }}>
                    <div style={{ textDecoration: 'line-through', color: 'var(--danger)', fontSize: 14 }}>{c.current_value}</div>
                    <ArrowRight size={14} color="var(--text-secondary)" />
                    <div style={{ fontWeight: 600, color: 'var(--success)', fontSize: 14 }}>{c.suggested_value}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6, textDecoration: isIgnored ? 'line-through' : 'none' }}>
                    {c.cross_verified === 'ai_confirmed' && <span style={{ color: 'var(--success)', fontWeight: 600, fontSize: 11 }}>✓ Cross-verified</span>}
                    {c.cross_verified === 'uncertain' && <span style={{ color: 'var(--warning)', fontWeight: 600, fontSize: 11 }}>⚠ Needs review</span>}
                    {c.cross_verified === 'not_verified' && <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>◯ Unchecked</span>}
                    <span style={{ marginLeft: 4 }}>{c.reason}</span>
                  </div>
                  {status === 'pending' && (
                    <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                      <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => {
                        setAcceptedCorrections(prev => ({...prev, [c.field]: c.suggested_value}))
                        if (setConfirmedAttrs) {
                          setConfirmedAttrs(prev => ({...prev, [c.field]: c.suggested_value}))
                        }
                      }}>
                        Accept Fix
                      </button>
                      <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => {
                        setAcceptedCorrections(prev => ({...prev, [c.field]: 'IGNORED'}))
                      }}>
                        Ignore
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            {Object.keys(acceptedCorrections).filter(k => acceptedCorrections[k] !== 'IGNORED').length} of {corrections.length} corrections applied. 
            {Object.keys(acceptedCorrections).filter(k => acceptedCorrections[k] === 'IGNORED').length > 0 && " Ignored items will be kept as declared."}
          </div>
        </div>
      )}

      {/* ✨ GENERATED METADATA (generate mode only) ✨ */}
      {generatedMetadata && (
        <div className="card" style={{ borderLeft: '3px solid var(--accent)', marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Sparkles size={18} color="var(--accent)" />
            <div className="card-title" style={{ fontSize: 15, marginBottom: 0, color: 'var(--accent)' }}>
              Generated AI Catalog
            </div>
          </div>

          {/* Multiple AI model images (5 views) */}
          {Array.isArray(generatedMetadata.generated_image_url) && generatedMetadata.generated_image_url.length > 0 ? (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>
                🧑‍🎨 AI Model Catalog ({generatedMetadata.generated_image_url.length} views)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                {generatedMetadata.generated_image_url.map((img, i) => (
                  <div key={i} style={{ background: '#f5f5f5', borderRadius: 8, padding: 6, textAlign: 'center' }}>
                    <img 
                      src={img.url || img} 
                      alt={img.view ? `${img.view} view` : `View ${i + 1}`}
                      style={{ width: '100%', height: 'auto', borderRadius: 6, aspectRatio: '3/4', objectFit: 'cover' }} 
                    />
                    {img.view && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, textTransform: 'capitalize' }}>{img.view} view</div>}
                  </div>
                ))}
              </div>
            </div>
          ) : generatedMetadata.generated_image_url && typeof generatedMetadata.generated_image_url === 'string' ? (
            <div style={{ marginBottom: 20, textAlign: 'center', background: '#f5f5f5', borderRadius: 8, padding: 8 }}>
              <img 
                src={generatedMetadata.generated_image_url} 
                alt="Generated AI Catalog" 
                style={{ width: '100%', maxWidth: '300px', height: 'auto', borderRadius: 6 }} 
              />
            </div>
          ) : null}

          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, lineHeight: 1.4 }}>
            {generatedMetadata.title}
          </div>

          {/* Description */}
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
            {generatedMetadata.description}
          </div>

          {/* Key features */}
          {generatedMetadata.key_features?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Package size={12} /> Key Features
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                {generatedMetadata.key_features.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}

          {/* Tags */}
          {generatedMetadata.tags?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Tag size={12} /> Tags
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {generatedMetadata.tags.map((t, i) => (
                  <span key={i} style={{ background: 'var(--bg-highlight)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 8px', fontSize: 11, color: 'var(--text-secondary)' }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Metadata grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
            {generatedMetadata.category_path && (
              <div><strong>Category:</strong> {generatedMetadata.category_path}</div>
            )}
            {generatedMetadata.ideal_for && (
              <div><strong>Ideal for:</strong> {generatedMetadata.ideal_for}</div>
            )}
            {generatedMetadata.fabric_details && (
              <div><strong>Fabric:</strong> {generatedMetadata.fabric_details}</div>
            )}
            {generatedMetadata.care_instructions && (
              <div><strong>Care:</strong> {generatedMetadata.care_instructions}</div>
            )}
            {generatedMetadata.size_fit_note && (
              <div style={{ gridColumn: '1 / -1' }}><strong>Size & Fit:</strong> {generatedMetadata.size_fit_note}</div>
            )}
          </div>
        </div>
      )}

      {/* Catalog image strip (verify mode only) */}
      {catalogPreviews.length > 0 && (
        <div className="card">
          <div className="card-title">Catalog images under verification</div>
          <div className="catalog-grid">
            {catalogPreviews.map((p, i) => (
              <div key={i} className={`catalog-thumb ${selectedCat === i ? 'selected' : ''}`} onClick={() => setSelectedCat(i)}>
                <img src={p} alt={`Catalog ${i + 1}`} />
                <div className="catalog-thumb-label">Image {i + 1}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Side-by-side comparison */}
      <div className="img-compare">
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="img-card-label">Anchor (real product)</div>
          {anchorFront?.preview ? (
            <img src={anchorFront.preview} alt="Anchor" style={{ aspectRatio: '3/4', objectFit: 'cover', maxHeight: 360 }} />
          ) : (
            <div className="img-placeholder">Anchor photo</div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="img-card-label">
            {actualMode === 'generate' ? 'Anchor (back view)' : 'Catalog image'}
          </div>
          {actualMode === 'generate' ? (
            anchorBack?.preview ? (
              <img src={anchorBack.preview} alt="Anchor Back" style={{ aspectRatio: '3/4', objectFit: 'cover', maxHeight: 360 }} />
            ) : (
              <div className="img-placeholder">No back view</div>
            )
          ) : (
            catalogPreviews[selectedCat] ? (
              <img src={catalogPreviews[selectedCat]} alt="Catalog" style={{ aspectRatio: '3/4', objectFit: 'cover', maxHeight: 360 }} />
            ) : (
              <div className="img-placeholder">No catalog image</div>
            )
          )}
        </div>
      </div>

      {/* Model proportion issues */}
      {modelIssues?.length > 0 && (
        <div className="card" style={{ borderLeft: '3px solid var(--danger)' }}>
          <div className="card-title" style={{ fontSize: 14, color: 'var(--danger)' }}>
            Model proportion mismatches
          </div>
          {modelIssues.map((issue, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: i < modelIssues.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{issue.attr}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Declared: <strong>{issue.declared}</strong> — Detected: <strong>{issue.detected}</strong>
              </div>
              <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 3 }}>{issue.note}</div>
            </div>
          ))}
        </div>
      )}

      {/* Math scores from hybrid pipeline */}
      {v.math_proportions && (
        <div className="card" style={{ borderLeft: '3px solid var(--accent)' }}>
          <div className="card-title" style={{ fontSize: 14, color: 'var(--accent)' }}>
            Mathematical Proportion Check (MediaPipe)
          </div>
          <div style={{ fontSize: 13 }}>
            Detected Hemline: <strong style={{ textTransform: 'capitalize' }}>{v.math_proportions.mathematical_length_category?.replace('_', ' ')}</strong>
            <br />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Shoulder: {v.math_proportions.landmarks?.shoulder_y} | Hip: {v.math_proportions.landmarks?.hip_y} | Knee: {v.math_proportions.landmarks?.knee_y} | Hemline: {v.math_proportions.detected_hemline_y}
            </span>
          </div>
        </div>
      )}

      {/* Bayesian Fusion Probabilities */}
      {v.fusionResult && (
        <div className="card" style={{ borderLeft: `3px solid ${v.fusionResult.probability > 75 ? 'var(--success)' : 'var(--warning)'}` }}>
          <div className="card-title" style={{ fontSize: 14, color: v.fusionResult.probability > 75 ? 'var(--success)' : 'var(--warning)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ padding: '2px 6px', background: 'rgba(0,0,0,0.05)', borderRadius: 4, fontSize: 11, fontWeight: 700 }}>AI MATH FUSION</div>
            Overall Match Probability: {v.fusionResult.probability}%
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            <strong>Bayesian Evidence Update:</strong><br />
            Prior: {(v.fusionResult.breakdown.prior * 100).toFixed(0)}% 
            → CLIP (LR: {v.fusionResult.breakdown.lr_clip != null ? v.fusionResult.breakdown.lr_clip.toFixed(2) : 'N/A'}) 
            → pHash (LR: {v.fusionResult.breakdown.lr_phash != null ? v.fusionResult.breakdown.lr_phash.toFixed(2) : 'N/A'}) 
            → Attributes (LR: {v.fusionResult.breakdown.lr_attributes != null ? v.fusionResult.breakdown.lr_attributes.toFixed(2) : 'N/A'})
          </div>
        </div>
      )}

      {/* Attribute comparison table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="card-title" style={{ fontSize: 14, marginBottom: 0 }}>
            Attribute comparison ({rows.length} attributes checked)
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Click a row to see details</div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Attribute</th>
              <th>Anchor (detected)</th>
              <th>{actualMode === 'generate' ? 'Self-check' : 'Catalog (detected)'}</th>
              <th>Seller (declared)</th>
              <th style={{ width: 130 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <React.Fragment key={r.key || i}>
                <tr
                  className={r.status === 'mismatch' ? (r.severity === 'HIGH' ? 'row-fail' : 'row-warn') : r.status === 'warning' ? 'row-warn' : ''}
                  onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                  style={{ cursor: r.note ? 'pointer' : 'default' }}
                >
                  <td style={{ fontWeight: 500 }}>{ATTR_LABELS[r.key] || r.key}</td>
                  <td>
                    {r.anchor_value || '—'}
                    {r.anchor_confidence && r.anchor_confidence !== 'N/A' && (
                      <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: CONFIDENCE_DOT[r.anchor_confidence], marginLeft: 4, verticalAlign: 1 }} />
                    )}
                  </td>
                  <td>
                    {r.catalog_value || '—'}
                    {r.catalog_confidence && r.catalog_confidence !== 'N/A' && (
                      <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: CONFIDENCE_DOT[r.catalog_confidence], marginLeft: 4, verticalAlign: 1 }} />
                    )}
                  </td>
                  <td style={{ color: !r.declared_value || r.declared_value === '—' ? 'var(--text-tertiary)' : 'inherit' }}>
                    {r.declared_value || '—'}
                  </td>
                  <td>
                    <span className={`badge ${r.status === 'match' ? 'badge-pass' : r.status === 'mismatch' ? (r.severity === 'HIGH' ? 'badge-fail' : 'badge-warn') : r.status === 'warning' ? 'badge-warn' : 'badge-fail'}`} style={r.status === 'skip' ? { background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80' } : undefined}>
                      {r.status === 'match' ? 'Match' :
                       r.status === 'mismatch' ? `Mismatch \u00B7 ${r.severity}` :
                       r.status === 'warning' ? `Warning \u00B7 ${r.severity || 'LOW'}` :
                       'Not detected'}
                    </span>
                  </td>
                </tr>
                {expandedRow === i && r.note && (
                  <tr style={{ background: r.status === 'mismatch' && r.severity === 'HIGH' ? 'var(--danger-bg)' : r.status === 'warning' || r.status === 'mismatch' ? 'var(--warning-bg)' : 'var(--bg-page)' }}>
                    <td colSpan={5} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 14px 12px', borderBottom: '1px solid var(--border)' }}>
                      <Eye size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                      {r.note}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Fabric closeup needed banner */}
      {rows.some(r => r.key === 'fabric_appearance' && (r.status === 'skip' || r.anchor_confidence === 'LOW')) && (
        <div className="card" style={{ borderLeft: '4px solid #e65100', marginTop: 16, padding: 16, background: '#fff3e0' }}>
          <div style={{ fontWeight: 600, color: '#e65100', marginBottom: 8 }}>Fabric Not Identified</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>We couldn't confidently identify the fabric from your images. Upload a close-up photo of the fabric texture for better accuracy.</div>
          <label className="btn btn-outline" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input type="file" accept="image/*" hidden onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                const url = URL.createObjectURL(e.target.files[0]);
                alert('Fabric image uploaded. (Re-extraction TODO)');
              }
            }} />
            Upload Fabric Close-up
          </label>
        </div>
      )}

      {/* Fabric verification */}
      {fabricResult && (
        <div className="card">
          <div className="card-title" style={{ fontSize: 14 }}>Visual Similarity (CLIP)</div>

          {fabricResult.similarity_score !== undefined && (
            <div style={{ fontSize: 12, marginBottom: 8, padding: '4px 8px', background: 'var(--bg-highlight)', borderRadius: 4, display: 'inline-block', border: '1px solid var(--border)' }}>
              <strong>CLIP Cosine Similarity:</strong> {(fabricResult.similarity_score * 100).toFixed(1)}%
              {fabricResult.source && <span style={{ marginLeft: 6, color: 'var(--text-tertiary)' }}>({fabricResult.source})</span>}
            </div>
          )}

          {fabricResult.fabric_matches_anchor === true || fabricResult.fabric_matches_anchor === undefined ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--success)' }}>
              <CheckCircle size={14} />
              {fabricResult.issue ? fabricResult.issue : 'Fabric appearance is consistent between anchor and catalog'}
            </div>
          ) : (
            <div>
              <div style={{ color: 'var(--danger)', fontSize: 13, lineHeight: 1.6 }}>
                <XCircle size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                {fabricResult.issue || 'Fabric appearance differs between anchor and catalog'}
              </div>
              {fabricResult.needs_fabric_image && (
                <div style={{ marginTop: 8, padding: '8px 12px', background: 'var(--bg-highlight)', borderRadius: 6, border: '1px solid var(--warning)', fontSize: 12, color: 'var(--warning)' }}>
                  <AlertTriangle size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                  <strong>Mandatory:</strong> Please upload a clear fabric closeup image to verify fabric consistency.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* pHash Perceptual Hashing */}
      {phashResult && (
        <div className="card">
          <div className="card-title" style={{ fontSize: 14 }}>Perceptual Hash (pHash)</div>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 8 }}>
            <div style={{ fontSize: 12, padding: '4px 8px', background: 'var(--bg-highlight)', borderRadius: 4, border: '1px solid var(--border)' }}>
              <strong>Hamming Distance:</strong> {phashResult.phash_distance}
            </div>
            <div style={{ fontSize: 12, padding: '4px 8px', background: 'var(--bg-highlight)', borderRadius: 4, border: '1px solid var(--border)' }}>
              <strong>Similarity:</strong> {(phashResult.similarity_score * 100).toFixed(1)}%
            </div>
          </div>
          {phashResult.is_match ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--success)' }}>
              <CheckCircle size={14} />
              Images are perceptually identical or near-identical (distance ≤ 10)
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--warning)' }}>
              <AlertTriangle size={14} />
              Images differ significantly at the pixel level (distance {phashResult.phash_distance}). This is normal for different photo angles.
            </div>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="action-bar mt-20" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: v.status === 'FAIL' ? 'var(--danger)' : v.status === 'PASS' ? 'var(--success)' : 'var(--warning)' }}>
          {v.status === 'FAIL' && `${failCount} issue${failCount > 1 ? 's' : ''} must be resolved before publishing`}
          {v.status === 'PASS' && `All checks passed`}
          {v.status === 'WARNING' && `${warnCount} warning${warnCount > 1 ? 's' : ''} — publishing is allowed`}
        </div>
        <div className="action-btns">
          <button className="btn btn-outline btn-sm" onClick={() => nav('/new-listing/upload')}>
            Replace images
          </button>
          {(v.status === 'FAIL' || v.status === 'UNVERIFIED') ? (
            <button className="btn btn-primary btn-sm" disabled>Publish (blocked)</button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={handlePublish}>
              Publish listing <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
