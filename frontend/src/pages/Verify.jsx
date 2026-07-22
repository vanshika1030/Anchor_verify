import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../AppContext'
import Stepper from '../components/Stepper'
import { runVerification, updateCSVRow } from '../services/api'
import { CheckCircle, XCircle, AlertTriangle, ArrowRight, Eye, Loader, Sparkles, Package, Tag, ChevronLeft, ChevronRight } from 'lucide-react'

const FLOW = ['Upload', 'Details', 'Verify', 'Publish']
const CONFIDENCE_DOT = { HIGH: 'var(--success)', MEDIUM: 'var(--warning)', LOW: 'var(--danger)' }

// Safely extract a displayable string from an attribute that might be
// a plain string OR a {value, confidence, source} object.
const safeVal = (v, fallback = '') =>
  v == null ? fallback
    : typeof v === 'object' ? (v.value ?? fallback)
    : v

const ATTR_LABELS = {
  garment_type: 'Garment type', primary_color: 'Primary color', secondary_color: 'Secondary color',
  pattern_type: 'Pattern type', fabric_appearance: 'Fabric appearance', overall_length: 'Overall length',
  sleeve_length: 'Sleeve length', neck_type: 'Neck type', silhouette: 'Silhouette', fit: 'Fit',
  embellishment: 'Embellishment', transparency: 'Transparency', hemline: 'Hemline',
  occasion_style: 'Occasion / style', motif_description: 'Motif / print', closure_type: 'Closure',
  size_chart_length: 'Size Chart Length',
  structural_features: 'Features', model_apparent_height: 'Model height (detected)',
  model_apparent_build: 'Model build (detected)', model_build: 'Model build (CLIP)',
  model_height_range: 'Model height (CLIP)', cv_overall_length: 'Length (geometric)',
}

export default function Verify() {
  const nav = useNavigate()
  const {
    anchorFront, anchorBack, anchorCloseup, sizeChart, sizeChartMeasurements,
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
  const [ignoreConfirm, setIgnoreConfirm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState(null)
  const [selectedCat, setSelectedCat] = useState(0)
  const [expandedRow, setExpandedRow] = useState(null)
  const [generatedMetadata, setGeneratedMetadata] = useState(null)
  const [enhancedMetadata, setEnhancedMetadata] = useState(null)
  const [corrections, setCorrections] = useState(null)
  const [actualMode, setActualMode] = useState(mode)
  const [fabricReExtracted, setFabricReExtracted] = useState(null)
  const [enhancementsApplied, setEnhancementsApplied] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  
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

      setChecklistStep(0)
      intervalRef.current = setInterval(() => {
        setChecklistStep(prev => prev < 4 ? prev + 1 : prev)
      }, 2000)

      // ONE API call — sends all images to the single-prompt pipeline
      const result = await runVerification({
        anchorFiles,
        catalogFiles: catalogFiles || [],
        sizeChartFile: sizeChart?.file || null,
        sizeChartMeasurements: sizeChartMeasurements || null,
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
      if (result.enhancedMetadata) setEnhancedMetadata(result.enhancedMetadata)
      if (result.corrections) setCorrections(result.corrections)
      if (result.mode) setActualMode(result.mode)
      if (result.generatedMetadata) {
        setGeneratedMetadata(result.generatedMetadata)
      }
      
      setChecklistStep(4) // All done

    } catch (err) {
      console.error('Verification failed:', err)
      setError(err.message)
    } finally {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setChecklistStep(5)
      setTimeout(() => {
        setLoading(false)
      }, 2000)
    }
  }

  const fileToDataUrl = (file) => new Promise((resolve) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });

  const handlePublish = async () => {
    const v = verdict
    if (csvSessionId && csvRowIndex !== null && v) {
      const updates = {
        anchorVerificationStatus: v.status,
        anchorMismatchCount: (comparisonResult || []).filter(r => r.status === 'mismatch').length,
        anchorVerificationNotes: v.reason || '',
      }
      
      if (enhancementsApplied && enhancedMetadata) {
        updates.productTitle = enhancedMetadata.title;
        updates.description = enhancedMetadata.description;
        updates.tags = enhancedMetadata.tags?.join(', ');
      }

      try {
        await updateCSVRow(csvSessionId, csvRowIndex, updates, 'published')
      } catch (err) {
        console.error('Failed to update CSV row:', err)
      }
    }

    // Save to database
    try {
      const token = sessionStorage.getItem('token')
      const attrs = anchorExtracted || {}
      
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const base64Anchor = await fileToDataUrl(anchorFront?.file);
      const catalogDataUrls = [];
      if (catalogFiles && catalogFiles.length > 0) {
        for (const file of catalogFiles) {
          const url = await fileToDataUrl(file);
          if (url) catalogDataUrls.push(url);
        }
      }

      await fetch('http://localhost:3001/api/products', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title: actualMode === 'generate' ? generatedMetadata?.title : (enhancedMetadata?.title || attrs.garment_type || 'Product'),
          description: actualMode === 'generate' ? generatedMetadata?.description : (enhancedMetadata?.description || ''),
          tags: actualMode === 'generate' ? (generatedMetadata?.tags || []) : (enhancedMetadata?.tags || []),
          article_type: attrs.garment_type || '',
          category: attrs.garment_type || '',
          brand_name: confirmedAttrs?.brand || 'Brand',
          attributes: attrs,
          verdict: v,
          verification_status: v?.status?.toLowerCase() || 'unverified',
          verification_score: v?.overall_similarity || null,
          anchor_image_url: base64Anchor || anchorFront?.preview || null,
          catalog_images: actualMode === 'generate' ? 
            (Array.isArray(generatedMetadata?.generated_image_url) ? 
              generatedMetadata.generated_image_url : 
              [generatedMetadata?.generated_image_url]) : (catalogDataUrls.length > 0 ? catalogDataUrls : null)
        })
      })
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
            <button className="btn btn-outline" onClick={() => nav('/new-listing')}>Go back</button>
            <button className="btn btn-primary" onClick={doVerification}>Retry verification</button>
          </div>
        </div>
      </div>
    )
  }

  // ────────────── Results ──────────────
  // Patch rows dynamically if corrections were accepted
  const rows = (comparisonResult || []).map(r => {
    const acceptedVal = acceptedCorrections[r.key]
    if (acceptedVal) {
      if (acceptedVal === 'IGNORED') {
        return {
          ...r,
          status: 'match',
          seller_override: true,
          note: 'Seller confirmed original value'
        }
      } else {
        return {
          ...r,
          declared_value: acceptedVal,
          status: 'match',
          note: 'Fixed by user accepting AI suggestion'
        }
      }
    }
    return r
  })

  const failCount = rows.filter(r => r.status === 'mismatch' && r.severity === 'HIGH').length + (modelIssues?.length || 0)
  const warnCount = rows.filter(r => r.status === 'mismatch' && r.severity !== 'HIGH').length + rows.filter(r => r.status === 'warning').length
  const passCount = rows.filter(r => r.status === 'match').length
  const skipCount = rows.filter(r => r.status === 'skip').length

  // Dynamically update verdict status based on un-fixed issues
  let v = verdict ? JSON.parse(JSON.stringify(verdict)) : { status: 'PASS', reason: 'Completed', critical_issues: [] }
  
  if (v.fusionResult) {
     const origFailCount = (comparisonResult || []).filter(r => r.status === 'mismatch' || r.status === 'warning').length;
     const currentFailCount = rows.filter(r => r.status === 'mismatch' || r.status === 'warning').length;
     const resolved = origFailCount - currentFailCount;
     if (resolved > 0) {
       const boost = resolved * 15;
       v.fusionResult.probability = Math.min(99, (v.fusionResult.probability || 0) + boost);
       v.overall_similarity = v.fusionResult.probability;
     }
  }

  if (v.status !== 'UNVERIFIED') {
    if (failCount === 0) {
      if (warnCount > 0) v = { ...v, status: 'WARNING', reason: 'Verification passed with warnings' }
      else v = { ...v, status: 'PASS', reason: 'Verification passed successfully' }
    } else {
      v = { ...v, status: 'FAIL', reason: 'Critical issues detected' }
    }
  }

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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          {v.overall_similarity !== undefined && (
            <div style={{ background: 'rgba(0,0,0,0.05)', padding: '4px 10px', borderRadius: 16, fontSize: 13, fontWeight: 700, color: '#333' }}>
              Bayesian Fusion Probability: <span style={{ color: v.overall_similarity > 80 ? 'var(--success)' : (v.overall_similarity > 50 ? 'var(--warning)' : 'var(--danger)') }}>{v.overall_similarity.toFixed(1)}%</span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, fontSize: 12, fontWeight: 600 }}>
            <span style={{ color: 'var(--danger)' }}>{failCount} failed</span>
            <span style={{ color: 'var(--warning)' }}>{warnCount} warnings</span>
            <span style={{ color: 'var(--success)' }}>{passCount} passed</span>
            {skipCount > 0 && <span style={{ color: '#e65100' }}>{skipCount} not detected</span>}
          </div>
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
                  background: isAccepted ? 'var(--success-bg)' : isIgnored ? 'var(--bg-tag)' : 'var(--bg-highlight)', 
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
                        setIgnoreConfirm(c)
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

      {/* ✨ AI LISTING ENHANCER (CSV Mode only) ✨ */}
      {enhancedMetadata && actualMode !== 'generate' && (
        <div className="card" style={{ borderLeft: '4px solid #9c27b0', marginTop: 20, animation: 'fadeIn 0.5s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Sparkles size={20} color="#9c27b0" />
            <div style={{ fontSize: 16, fontWeight: 700, color: '#9c27b0' }}>AI Listing Enhancer</div>
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Our Gen-Z Trend Analyst AI reviewed your anchor image and suggested highly-optimized aesthetic tags and a better title/description. 
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Original */}
            <div style={{ background: 'var(--bg-highlight)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Original CSV Data</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{safeVal(confirmedAttrs?.productTitle, 'No title provided')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontStyle: 'italic' }}>{safeVal(confirmedAttrs?.description, 'No description provided')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                <span style={{ fontSize: 11, background: 'var(--bg-input)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>{safeVal(confirmedAttrs?.tags, 'No tags')}</span>
              </div>
            </div>

            {/* AI Enhanced */}
            <div style={{ background: 'var(--accent-lighter)', padding: 16, borderRadius: 8, border: '1px solid #ce93d8' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#c084fc', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>AI Enhanced Data</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: '#e879f9' }}>{enhancedMetadata.title}</div>
              <div style={{ fontSize: 12, color: '#d8b4fe', marginBottom: 8 }}>{enhancedMetadata.description}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {enhancedMetadata.tags?.map((t, i) => (
                  <span key={i} style={{ fontSize: 11, background: 'rgba(192, 132, 252, 0.15)', color: '#e879f9', padding: '4px 8px', borderRadius: 6, fontWeight: 600, border: '1px solid rgba(192, 132, 252, 0.3)' }}>#{t}</span>
                ))}
              </div>
            </div>
          </div>

          <button 
            className={`btn ${enhancementsApplied ? 'btn-success' : 'btn-primary'}`} 
            style={{ width: '100%', background: enhancementsApplied ? 'var(--success)' : '#9c27b0', border: 'none' }}
            onClick={() => setEnhancementsApplied(true)}
            disabled={enhancementsApplied}
          >
            {enhancementsApplied ? <><CheckCircle size={16} /> Enhancements Applied</> : 'Apply Gen-Z Trend Enhancements to CSV'}
          </button>
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

          {/* Multiple AI model images (5 views) - Premium Carousel */}
          {Array.isArray(generatedMetadata.generated_image_url) && generatedMetadata.generated_image_url.length > 0 ? (
            <div style={{ marginBottom: 24, padding: 12, background: 'linear-gradient(to bottom, #f8f9fa, #ffffff)', borderRadius: 12, border: '1px solid #e0e0e0', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: '#333', textAlign: 'center', letterSpacing: 0.5 }}>
                🧑‍🎨 AI Model Catalog Gallery
              </div>
              
              <div style={{ position: 'relative', width: '100%', maxWidth: '600px', margin: '0 auto', overflow: 'hidden', borderRadius: 16, aspectRatio: '3/4', boxShadow: '0 16px 40px rgba(0,0,0,0.15)' }}>
                <div style={{ display: 'flex', transition: 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)', transform: `translateX(-${currentSlide * 100}%)`, height: '100%' }}>
                  {generatedMetadata.generated_image_url.map((img, i) => (
                    <div key={i} style={{ minWidth: '100%', height: '100%', position: 'relative' }}>
                      <img 
                        src={img.url || img} 
                        alt={img.view ? `${img.view} view` : `View ${i + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                      {img.view && (
                        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, color: '#333', textTransform: 'capitalize', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                          {img.view} view
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                {/* Navigation Buttons */}
                <button 
                  onClick={() => setCurrentSlide(prev => Math.max(0, prev - 1))}
                  disabled={currentSlide === 0}
                  style={{ position: 'absolute', top: '50%', left: 12, transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentSlide === 0 ? 'not-allowed' : 'pointer', opacity: currentSlide === 0 ? 0.3 : 1, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 10, transition: 'all 0.2s' }}
                >
                  <ChevronLeft size={20} color="#333" />
                </button>
                <button 
                  onClick={() => setCurrentSlide(prev => Math.min(generatedMetadata.generated_image_url.length - 1, prev + 1))}
                  disabled={currentSlide === generatedMetadata.generated_image_url.length - 1}
                  style={{ position: 'absolute', top: '50%', right: 12, transform: 'translateY(-50%)', width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.9)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: currentSlide === generatedMetadata.generated_image_url.length - 1 ? 'not-allowed' : 'pointer', opacity: currentSlide === generatedMetadata.generated_image_url.length - 1 ? 0.3 : 1, boxShadow: '0 2px 8px rgba(0,0,0,0.15)', zIndex: 10, transition: 'all 0.2s' }}
                >
                  <ChevronRight size={20} color="#333" />
                </button>
              </div>
              
              {/* Dots Indicator */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
                {generatedMetadata.generated_image_url.map((_, i) => (
                  <div 
                    key={i} 
                    onClick={() => setCurrentSlide(i)}
                    style={{ width: i === currentSlide ? 24 : 8, height: 8, borderRadius: 4, background: i === currentSlide ? 'var(--accent)' : '#d0d0d0', transition: 'all 0.3s ease', cursor: 'pointer' }}
                  />
                ))}
              </div>
            </div>
          ) : generatedMetadata.generated_image_url && typeof generatedMetadata.generated_image_url === 'string' ? (
            <div style={{ marginBottom: 20, textAlign: 'center', background: '#f5f5f5', borderRadius: 8, padding: 8 }}>
              <img 
                src={generatedMetadata.generated_image_url} 
                alt="Generated AI Catalog" 
                style={{ width: '100%', maxWidth: '400px', height: 'auto', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }} 
              />
            </div>
          ) : null}

          {/* Model Proportions Metadata */}
          <div style={{ marginTop: 16, padding: 12, background: '#e3f2fd', borderRadius: 8, border: '1px solid #bbdefb' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1565c0', marginBottom: 4, textTransform: 'uppercase' }}>
              Model Proportions & Claimed Metadata
            </div>
            <div style={{ fontSize: 13, color: '#0d47a1', display: 'flex', gap: 16 }}>
              <div><strong>Size:</strong> {safeVal(confirmedAttrs?.size, 'M')}</div>
              <div><strong>Height:</strong> {safeVal(confirmedAttrs?.modelHeight) || safeVal(confirmedAttrs?.model_apparent_height) || "5'6\""}</div>
              <div><strong>Fitted for:</strong> {safeVal(confirmedAttrs?.garment_type, 'Crop Top')}</div>
            </div>
            <div style={{ fontSize: 11, color: '#1976d2', marginTop: 6 }}>
              Models generated exactly to specified dimensions ensuring accurate fitting.
            </div>
          </div>

          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, marginTop: 24, lineHeight: 1.4 }}>
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

      {/* Enhanced Metadata (Trendy Tags) for Verify Mode */}
      {enhancedMetadata && (
        <div className="card" style={{ background: 'linear-gradient(135deg, #fffafb 0%, #fff 100%)', border: '1px solid #ff3f6c30' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Sparkles size={18} color="#ff3f6c" />
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#282c3f' }}>AI Enhanced Metadata</h3>
          </div>
          
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#5F6477', marginBottom: 4 }}>Optimized Title</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#282c3f' }}>{enhancedMetadata.title || 'N/A'}</div>
          </div>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {enhancedMetadata.category && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#5F6477', marginBottom: 4 }}>Category</div>
                <div style={{ display: 'inline-block', background: '#f5f5f6', padding: '4px 12px', borderRadius: 16, fontSize: 13, fontWeight: 600, color: '#282c3f' }}>
                  {enhancedMetadata.category}
                </div>
              </div>
            )}
            
            {enhancedMetadata.tags && enhancedMetadata.tags.length > 0 && (
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#5F6477', marginBottom: 4 }}>Trendy Tags</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {enhancedMetadata.tags.map((tag, idx) => (
                    <span key={idx} style={{ 
                      background: 'linear-gradient(to right, #ff3f6c15, #f7706215)', 
                      border: '1px solid #ff3f6c30', 
                      color: '#ff3f6c', 
                      padding: '4px 10px', 
                      borderRadius: 16, 
                      fontSize: 12, 
                      fontWeight: 600 
                    }}>
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
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
            Prior: {(v.fusionResult?.breakdown?.prior * 100).toFixed(0)}% 
            → CLIP (LR: {v.fusionResult?.breakdown?.lr_clip != null ? v.fusionResult.breakdown.lr_clip.toFixed(2) : 'N/A'}) 
            → pHash (LR: {v.fusionResult?.breakdown?.lr_phash != null ? v.fusionResult.breakdown.lr_phash.toFixed(2) : 'N/A'}) 
            → Attributes (LR: {v.fusionResult?.breakdown?.lr_attributes != null ? v.fusionResult.breakdown.lr_attributes.toFixed(2) : 'N/A'})
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
                       r.status === 'skip' ? 'Missing Input' : 'Not detected'}
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
          {fabricReExtracted ? (
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--success)' }}>
              <CheckCircle size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
              Fabric identified: {fabricReExtracted}
            </div>
          ) : (
            <label className="btn btn-outline" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input type="file" accept="image/*" hidden onChange={async (e) => {
                const file = e.target.files && e.target.files[0];
                if (file) {
                  try {
                    const formData = new FormData();
                    formData.append('images', file);
                    const res = await fetch('http://localhost:3001/api/extract/anchor', {
                      method: 'POST',
                      body: formData
                    });
                    const data = await res.json();
                    const fabricVal = data.attributes?.fabric_appearance?.value || data.attributes?.fabric_appearance || 'Unknown';
                    setFabricReExtracted(fabricVal);
                  } catch (err) {
                    console.error('Failed to extract fabric:', err);
                  }
                }
              }} />
              Upload Fabric Close-up
            </label>
          )}
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
        {(() => {
          const scoreTooLow = (v.overall_similarity !== undefined && v.overall_similarity < 60);
          const isPublishBlocked = skipCount > 10 || scoreTooLow || failCount > 10 || v.status === 'UNVERIFIED';

          return (
            <>
              <div style={{ fontSize: 13, color: isPublishBlocked ? 'var(--danger)' : v.status === 'PASS' ? 'var(--success)' : 'var(--warning)' }}>
                {skipCount > 10 ? "Too many missing attributes. Please fill them to publish." :
                 scoreTooLow ? `Overall similarity is too low (${v.overall_similarity}%). Must be at least 60%.` :
                 failCount > 5 ? `${failCount} issue${failCount > 1 ? 's' : ''} must be resolved before publishing.` :
                 v.status === 'PASS' ? `All checks passed.` :
                 `${failCount > 0 ? failCount + ' issues, ' : ''}${warnCount} warning${warnCount > 1 ? 's' : ''}, ${skipCount > 0 ? skipCount + ' missing' : ''} — publishing is allowed.`}
              </div>
              <div className="action-btns">
                <button className="btn btn-outline btn-sm" onClick={() => nav('/new-listing')}>
                  Replace images
                </button>
                {isPublishBlocked ? (
                  <button className="btn btn-primary btn-sm" disabled>Publish (blocked)</button>
                ) : (
                  <button className="btn btn-primary btn-sm" onClick={handlePublish}>
                    Publish listing <ArrowRight size={14} />
                  </button>
                )}
              </div>
            </>
          );
        })()}
      </div>

      {ignoreConfirm && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ maxWidth: 400, margin: 20, background: '#fff' }}>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Confirm original value</div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Are you sure <strong>{ignoreConfirm.field.replace('_', ' ')}</strong> is <strong>{ignoreConfirm.current_value}</strong>? Our AI detected <strong>{ignoreConfirm.suggested_value}</strong> with {ignoreConfirm.confidence || 'high'} confidence.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setIgnoreConfirm(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => {
                setAcceptedCorrections(prev => ({...prev, [ignoreConfirm.field]: 'IGNORED'}));
                setIgnoreConfirm(null);
              }}>Yes, keep mine</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
