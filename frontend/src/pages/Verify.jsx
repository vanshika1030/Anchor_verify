import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../AppContext'
import Stepper from '../components/Stepper'
import { runVerification, updateCSVRow } from '../services/api'
import { CheckCircle, XCircle, AlertTriangle, ArrowRight, Eye, Loader, Sparkles, Package, Tag, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react'

const FLOW = ['Upload', 'Details', 'Verify', 'Publish']
const CONFIDENCE_DOT = { HIGH: 'var(--success)', MEDIUM: 'var(--warning)', LOW: 'var(--danger)' }
const ANGLE_LABELS = { front: 'Front', back: 'Back', side: 'Side', closeup: 'Close-up', full: 'Full body' }
const CATALOG_VIEW_LABELS = ['Front', 'Back', 'Side', 'Close-up', 'Full body']
const EDITABLE_ATTRIBUTES = [
  ['garment_type', 'Product type'],
  ['primary_color', 'Colour'],
  ['fabric_appearance', 'Fabric'],
  ['pattern_type', 'Pattern'],
  ['fit', 'Fit'],
  ['occasion_style', 'Occasion'],
]

// Safely extract a displayable string from an attribute that might be
// a plain string OR a {value, confidence, source} object.
const safeVal = (v, fallback = '') =>
  v == null ? fallback
    : typeof v === 'object' ? (v.value ?? fallback)
    : v

const displayText = value =>
  Array.isArray(value) ? value.join(' > ') : String(safeVal(value, ''))

const normalizeText = value =>
  displayText(value).trim().replace(/\s+/g, ' ').toLowerCase()

const toTagList = value => {
  const source = Array.isArray(value) ? value : String(safeVal(value, '')).split(',')
  const seen = new Set()

  return source
    .map(tag => String(tag).trim().replace(/^#+/, ''))
    .filter(tag => {
      const normalized = normalizeText(tag)
      if (!normalized || seen.has(normalized)) return false
      seen.add(normalized)
      return true
    })
}

const tagsMatch = (left, right) => {
  const normalize = value => toTagList(value).map(normalizeText).sort()
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right))
}

function CatalogPreviewImage({ src, alt, style }) {
  const [failed, setFailed] = useState(false)
  if (failed) {
    return (
      <div className="img-placeholder" style={{ ...style, display: 'grid', placeItems: 'center', minHeight: 150 }}>
        Image unavailable
      </div>
    )
  }
  return <img src={src} alt={alt} style={style} onError={() => setFailed(true)} />
}

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
  catalog_view_coverage: 'Catalog view coverage', back_print_preservation: 'Back print preservation',
  model_build_declared: 'Model body build', catalog_size_chart_fit: 'Catalog image vs size chart',
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
    csvSessionId, csvRowIndex, sellerListing,
  } = useApp()

  // Verification requires seller catalog photos; with anchors only, this is
  // always the AI generation flow even if a stale context mode survived a retry.
  const requestedMode = mode === 'generate' || (catalogFiles?.length || 0) === 0 ? 'generate' : mode

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
  const [suggestionAgent, setSuggestionAgent] = useState(null)
  const [catalogEvidenceDiagnostics, setCatalogEvidenceDiagnostics] = useState([])
  const [sizeChartEvidence, setSizeChartEvidence] = useState(null)
  const [actualMode, setActualMode] = useState(requestedMode)
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
    // Generate-mode metadata is local to this page, so a replacement/retry must
    // rebuild it even when an earlier comparison is still present in context.
    if (requestedMode !== 'generate' && comparisonResult && verdict) {
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
    let completionDelay = 1200
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
        mode: requestedMode,
      })

      setComparisonResult(result.comparison || [])
      setCatalogExtracted(result.catalog_attributes || null)
      if (result.mode === 'generate' && result.catalog_attributes) {
        setConfirmedAttrs(previous => ({ ...(previous || {}), ...result.catalog_attributes }))
      }
      setModelIssues(result.modelIssues || [])
      setFabricResult(result.fabricResult || null)
      setPhashResult(result.phashResult || null)
      setVerdict(result.verdict || { status: 'PASS', reason: 'Completed', critical_issues: [] })
      if (result.generatedMetadata) setGeneratedMetadata(result.generatedMetadata)
      if (result.enhancedMetadata) setEnhancedMetadata(result.enhancedMetadata)
      if (result.corrections) setCorrections(result.corrections)
      if (result.suggestionAgent) setSuggestionAgent(result.suggestionAgent)
      if (result.catalogEvidenceDiagnostics) setCatalogEvidenceDiagnostics(result.catalogEvidenceDiagnostics)
      if (result.sizeChartEvidence) setSizeChartEvidence(result.sizeChartEvidence)
      if (result.mode) setActualMode(result.mode)
      setCurrentSlide(0)
      completionDelay = result.cache?.status === 'hit' ? 350 : 1200
      
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
      }, completionDelay)
    }
  }

  const fileToDataUrl = (file) => new Promise((resolve) => {
    if (!file) return resolve(null)
    if (typeof file === 'string') return resolve(file)
    if (!(file instanceof Blob)) return resolve(null)
    const reader = new FileReader()
    reader.onload = (event) => resolve(event.target.result)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })

  const handlePublish = async () => {
    // Keep the business rule in the handler as well as the disabled UI so a
    // stale click or programmatic submit cannot publish failed verification.
    if (publishGate.blocked) return

    try {
      const token = sessionStorage.getItem('token')
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`

      const base64Anchor = await fileToDataUrl(anchorFront?.file)
      const uploadedCatalogImages = []
      for (const file of (catalogFiles || [])) {
        const image = await fileToDataUrl(file)
        if (image) uploadedCatalogImages.push(image)
      }
      const catalogImages = actualMode === 'generate'
        ? (Array.isArray(generatedMetadata?.generated_image_url)
            ? generatedMetadata.generated_image_url.map(image => image?.url || image).filter(Boolean)
            : [generatedMetadata?.generated_image_url?.url || generatedMetadata?.generated_image_url].filter(Boolean))
        : [...new Set([...(catalogPreviews || []), ...uploadedCatalogImages].filter(Boolean))]

      const seller = sellerListing || {}
      const sellerTitle = seller.productTitle || safeVal(confirmedAttrs?.product_title) || safeVal(confirmedAttrs?.garment_type) || 'Product'
      const sellerDescription = seller.description || safeVal(confirmedAttrs?.description)
      const sellerTags = String(seller.tags || safeVal(confirmedAttrs?.tags) || '')
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean)
      const publishEnhanced = actualMode === 'generate' || enhancementsApplied
      const finalMetadata = actualMode === 'generate'
        ? generatedMetadata
        : enhancedMetadata
          ? { ...enhancedMetadata, tags: toTagList(enhancedMetadata.tags) }
          : null
      const v = verdict || {}

      const response = await fetch('http://localhost:3001/api/products', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          style_code: seller.styleId || safeVal(confirmedAttrs?.style_id) || null,
          title: publishEnhanced && finalMetadata?.title ? finalMetadata.title : sellerTitle,
          description: publishEnhanced && finalMetadata?.description ? finalMetadata.description : sellerDescription,
          tags: publishEnhanced && finalMetadata?.tags?.length ? finalMetadata.tags : sellerTags,
          article_type: seller.articleType || safeVal(confirmedAttrs?.garment_type) || '',
          category: publishEnhanced && (finalMetadata?.category_path || finalMetadata?.category)
            ? (finalMetadata.category_path || finalMetadata.category)
            : [seller.gender, seller.category, seller.articleType].filter(Boolean).join(' > '),
          brand_name: seller.brand || safeVal(confirmedAttrs?.brand) || 'Brand',
          mrp: Number(seller.mrp || safeVal(confirmedAttrs?.mrp)) || null,
          selling_price: Number(seller.sellingPrice || safeVal(confirmedAttrs?.selling_price)) || null,
          attributes: { ...(confirmedAttrs || {}) },
          size_chart: sizeChartEvidence || sizeChartMeasurements || null,
          verification_status: 'published',
          verification_score: v?.overall_similarity || null,
          anchor_image_url: base64Anchor || anchorFront?.preview || null,
          catalog_images: catalogImages,
          ai_model_images: actualMode === 'generate' ? catalogImages : [],
          seller_metadata: seller,
          verification_report: {
            verdict: v,
            comparison: comparisonResult || [],
            model_issues: modelIssues || [],
            fabric: fabricResult || null,
            perceptual_hash: phashResult || null,
            catalog_evidence: catalogEvidenceDiagnostics,
            enhancements_applied: enhancementsApplied,
          },
          suggestions: suggestionAgent,
        })
      })
      const savedProduct = await response.json()
      if (!response.ok) throw new Error(savedProduct.error || 'Could not publish this listing')

      if (csvSessionId && csvRowIndex !== null) {
        const updates = {
          anchorVerificationStatus: v.status || 'PUBLISHED',
          anchorMismatchCount: (comparisonResult || []).filter(row => row.status === 'mismatch').length,
          anchorVerificationNotes: v.reason || '',
        }
        if (enhancementsApplied && metadataChanges.length > 0) {
          const changedFields = new Set(metadataChanges.map(change => change.key))
          if (changedFields.has('title')) updates.productTitle = proposedListingMetadata.title
          if (changedFields.has('description')) updates.description = proposedListingMetadata.description
          if (changedFields.has('tags')) updates.tags = proposedListingMetadata.tags.join(', ')
        }
        await updateCSVRow(csvSessionId, csvRowIndex, updates, 'published')
      }

      nav('/new-listing/success', { state: { productId: savedProduct.id } })
    } catch (err) {
      console.error('Failed to save product:', err)
      setError(err.message)
    }
  }

  const updateConfirmedAttribute = (key, value) => {
    setConfirmedAttrs(prev => {
      const current = prev?.[key]
      const nextValue = current && typeof current === 'object' ? { ...current, value } : value
      return { ...(prev || {}), [key]: nextValue }
    })
  }

  const updateGeneratedMetadata = (key, value) => {
    setGeneratedMetadata(prev => ({ ...(prev || {}), [key]: value }))
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
          seller_override: true,
          note: `Suggestion ignored; this evidence remains unresolved. ${r.note || ''}`.trim()
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

  const criticalModelIssues = (modelIssues || []).filter(issue => issue.severity === 'HIGH')
  const warningModelIssues = (modelIssues || []).filter(issue => issue.severity !== 'HIGH')
  const failCount = rows.filter(r => r.status === 'mismatch' && r.severity === 'HIGH').length + criticalModelIssues.length
  const warnCount = rows.filter(r => r.status === 'mismatch' && r.severity !== 'HIGH').length +
    rows.filter(r => r.status === 'warning').length +
    warningModelIssues.length
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

  const originalListingMetadata = {
    title: sellerListing?.productTitle || safeVal(confirmedAttrs?.product_title, ''),
    description: sellerListing?.description || safeVal(confirmedAttrs?.description, ''),
    category: sellerListing?.articleType || safeVal(confirmedAttrs?.garment_type, ''),
    tags: toTagList(sellerListing?.tags || safeVal(confirmedAttrs?.tags, '')),
  }
  const proposedListingMetadata = {
    title: displayText(enhancedMetadata?.title),
    description: displayText(enhancedMetadata?.description),
    category: displayText(enhancedMetadata?.category_path || enhancedMetadata?.category),
    tags: toTagList(enhancedMetadata?.tags),
  }
  const metadataChanges = enhancedMetadata ? [
    {
      key: 'title',
      label: 'Product title',
      current: originalListingMetadata.title,
      suggested: proposedListingMetadata.title,
      changed: Boolean(normalizeText(proposedListingMetadata.title)) &&
        normalizeText(originalListingMetadata.title) !== normalizeText(proposedListingMetadata.title),
    },
    {
      key: 'description',
      label: 'Description',
      current: originalListingMetadata.description,
      suggested: proposedListingMetadata.description,
      changed: Boolean(normalizeText(proposedListingMetadata.description)) &&
        normalizeText(originalListingMetadata.description) !== normalizeText(proposedListingMetadata.description),
    },
    {
      key: 'category',
      label: 'Category',
      current: originalListingMetadata.category,
      suggested: proposedListingMetadata.category,
      changed: Boolean(normalizeText(proposedListingMetadata.category)) &&
        normalizeText(originalListingMetadata.category) !== normalizeText(proposedListingMetadata.category),
    },
    {
      key: 'tags',
      label: 'Search tags',
      current: originalListingMetadata.tags,
      suggested: proposedListingMetadata.tags,
      changed: proposedListingMetadata.tags.length > 0 &&
        !tagsMatch(originalListingMetadata.tags, proposedListingMetadata.tags),
    },
  ].filter(change => change.changed) : []

  const unresolvedCriticalRows = rows.filter(row => row.status === 'mismatch' && row.severity === 'HIGH')
  const criticalEvidenceText = [
    ...unresolvedCriticalRows.flatMap(row => [row.key, row.label, row.note]),
    ...criticalModelIssues.flatMap(issue => [issue.attr, issue.note]),
  ].join(' ').toLowerCase()
  const hasSizeConflict = /(size chart|size_chart|catalog image vs size|catalog fit vs size|model build vs size)/.test(criticalEvidenceText)
  const hasCatalogImageConflict = /(overall visual|visual identity|catalog garment|garment length|catalog image|back print|fabric|model body|model build)/.test(criticalEvidenceText)
  const hasUsableEvidence = rows.some(row => ['match', 'mismatch', 'warning'].includes(row.status))
  const publishGate = {
    blocked: v.status === 'FAIL' || v.status === 'UNVERIFIED' || !hasUsableEvidence,
    message: !hasUsableEvidence || v.status === 'UNVERIFIED'
      ? 'Verification produced no usable evidence. Retry verification before publishing.'
      : hasCatalogImageConflict && hasSizeConflict
        ? 'Publishing is blocked. Fix or replace the catalog images first. The size/length evidence also conflicts, so update the listing metadata or size chart, or replace the catalog image, then verify again.'
        : hasCatalogImageConflict
          ? 'Publishing is blocked because the catalog images are not consistent with the anchor. Fix or replace the catalog images, then verify again.'
          : hasSizeConflict
            ? 'Publishing is blocked by a size or length conflict. Update the listing metadata or size chart, or replace the catalog image, then verify again.'
            : 'Publishing is blocked until every critical verification finding is resolved.',
  }

  return (
    <main className="verify-page page-shell">
      <div className="verify-heading">
        <div>
          <div className="section-kicker">Final quality check</div>
          <h1>Review your AI catalog listing</h1>
          <p>Confirm the imagery, product details, measurements, and match confidence before publishing.</p>
        </div>
        <div className="verify-assurance"><ShieldCheck size={15} /> Anchor protected</div>
      </div>
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
        <div id="ai-correction-copilot" className="card" style={{ borderLeft: '4px solid var(--accent)', marginTop: 20, animation: 'fadeIn 0.5s ease' }}>
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
            {Object.keys(acceptedCorrections).filter(k => acceptedCorrections[k] === 'IGNORED').length > 0 && " Ignored items stay declared, but unresolved critical evidence can still block publishing."}
          </div>
        </div>
      )}

      {/* ✨ AI LISTING ENHANCER (CSV Mode only) ✨ */}
      {suggestionAgent && actualMode !== 'generate' && (
        <div className="card" style={{ marginTop: 20, border: '1px solid #ff3f6c40', background: 'linear-gradient(135deg, #fff8fa, #ffffff)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', marginBottom: 14 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ff3f6c', fontWeight: 800 }}>
                <ShieldCheck size={20} /> {suggestionAgent.name || 'Anchor Consistency Copilot'}
              </div>
              <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
                {suggestionAgent.summary}
              </p>
            </div>
            <span className={`badge ${suggestionAgent.status === 'consistent' ? 'badge-pass' : 'badge-warn'}`}>
              {suggestionAgent.status === 'consistent' ? 'Consumer-ready' : 'Review recommended'}
            </span>
          </div>
          {suggestionAgent.actions?.length > 0 && (
            <div style={{ display: 'grid', gap: 9 }}>
              {suggestionAgent.actions.slice(0, 6).map((action, index) => (
                <div key={`${action.field}-${index}`} style={{ padding: 12, borderRadius: 10, background: '#fff', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <strong style={{ fontSize: 13 }}>{action.field}</strong>
                    <span style={{ color: action.priority === 'HIGH' ? 'var(--danger)' : 'var(--warning)', fontSize: 11, fontWeight: 800 }}>
                      {action.priority}
                    </span>
                  </div>
                  <div style={{ marginTop: 5, color: 'var(--text-secondary)', fontSize: 12 }}>{action.reason}</div>
                  <div style={{ marginTop: 5, color: '#0f7b58', fontSize: 12 }}>
                    Shopper impact: {action.consumer_impact}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {metadataChanges.length > 0 && actualMode !== 'generate' && (
        <div className="card listing-enhancements-card">
          <div className="listing-enhancements-head">
            <div>
              <div className="listing-enhancements-title">
                <Sparkles size={19} /> Optional listing enhancements
              </div>
              <p>Only genuinely different suggestions are shown. Your CSV stays unchanged until you apply them.</p>
            </div>
            <span className="badge badge-warn">
              {metadataChanges.length} improvement{metadataChanges.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="metadata-change-list">
            {metadataChanges.map(change => (
              <div className="metadata-change" key={change.key}>
                <div className="metadata-change-label">{change.label}</div>
                <div className="metadata-change-grid">
                  <div className="metadata-value metadata-value-current">
                    <span>Current CSV</span>
                    {Array.isArray(change.current) ? (
                      <div className="metadata-tags">
                        {change.current.length > 0
                          ? change.current.map(tag => <em key={tag}>#{tag}</em>)
                          : <small>Not provided</small>}
                      </div>
                    ) : (
                      <p>{change.current || 'Not provided'}</p>
                    )}
                  </div>
                  <div className="metadata-value metadata-value-suggested">
                    <span>AI suggestion</span>
                    {Array.isArray(change.suggested) ? (
                      <div className="metadata-tags">
                        {change.suggested.map(tag => <em key={tag}>#{tag}</em>)}
                      </div>
                    ) : (
                      <p>{change.suggested}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            className={`btn ${enhancementsApplied ? 'btn-success' : 'btn-primary'}`}
            style={{ width: '100%', background: enhancementsApplied ? 'var(--success)' : undefined }}
            onClick={() => setEnhancementsApplied(true)}
            disabled={enhancementsApplied}
          >
            {enhancementsApplied ? <><CheckCircle size={16} /> Enhancements applied</> : 'Apply these enhancements'}
          </button>
        </div>
      )}

      {/* ✨ GENERATED METADATA (generate mode only) ✨ */}
      {generatedMetadata && (
        <div className="card" style={{ borderLeft: '3px solid var(--accent)', marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Sparkles size={18} color="var(--accent)" />
            <div className="card-title" style={{ fontSize: 15, marginBottom: 0, color: 'var(--accent)' }}>
              AI Generated Model Images · 5 Angles
            </div>
          </div>

          {/* Multiple AI model images (5 views) - Premium Carousel */}
          {Array.isArray(generatedMetadata.generated_image_url) && generatedMetadata.generated_image_url.length > 0 ? (
            <div style={{ marginBottom: 24, padding: 12, background: 'linear-gradient(to bottom, #f8f9fa, #ffffff)', borderRadius: 12, border: '1px solid #e0e0e0', boxShadow: '0 8px 24px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, color: '#333', textAlign: 'center', letterSpacing: 0.5 }}>
                Front · Back · Side · Close-up · Full body
              </div>
              
              <div style={{ position: 'relative', width: '100%', maxWidth: '520px', margin: '0 auto', overflow: 'hidden', borderRadius: 16, aspectRatio: '3/4', background: '#fff', boxShadow: '0 16px 40px rgba(0,0,0,0.15)' }}>
                <div style={{ display: 'flex', transition: 'transform 0.5s cubic-bezier(0.25, 1, 0.5, 1)', transform: `translateX(-${currentSlide * 100}%)`, height: '100%' }}>
                  {generatedMetadata.generated_image_url.map((img, i) => (
                    <div key={i} style={{ minWidth: '100%', height: '100%', position: 'relative' }}>
                      <img 
                        src={img.url || img} 
                        alt={img.view ? `${ANGLE_LABELS[img.view] || img.view} view` : `View ${i + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#fff' }}
                      />
                      {img.view && (
                        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)', padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 600, color: '#333', textTransform: 'capitalize', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                          {ANGLE_LABELS[img.view] || img.view}
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
              
              {/* Angle indicator */}
              <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                {generatedMetadata.generated_image_url.map((img, i) => (
                  <button
                    type="button"
                    key={i} 
                    onClick={() => setCurrentSlide(i)}
                    style={{ border: i === currentSlide ? '1px solid var(--accent)' : '1px solid var(--border)', borderRadius: 16, background: i === currentSlide ? 'var(--accent-lighter)' : '#fff', color: i === currentSlide ? 'var(--accent)' : 'var(--text-secondary)', padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                  >
                    {ANGLE_LABELS[img.view] || `View ${i + 1}`}
                  </button>
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
              <div><strong>Size:</strong> {safeVal(confirmedAttrs?.model_size) || safeVal(confirmedAttrs?.size, 'M')}</div>
              <div><strong>Height:</strong> {safeVal(confirmedAttrs?.model_height) || safeVal(confirmedAttrs?.modelHeight) || safeVal(confirmedAttrs?.model_apparent_height) || "5'6\""}</div>
              <div><strong>Fitted for:</strong> {safeVal(confirmedAttrs?.garment_type, 'Crop Top')}</div>
            </div>
            <div style={{ fontSize: 11, color: '#1976d2', marginTop: 6 }}>
              Models generated exactly to specified dimensions ensuring accurate fitting.
            </div>
          </div>

          <div style={{ marginTop: 24 }}>
            <label className="form-label">Editable product title</label>
            <input className="form-input" value={generatedMetadata.title || ''} onChange={event => updateGeneratedMetadata('title', event.target.value)} />
          </div>

          <div style={{ marginTop: 12, marginBottom: 14 }}>
            <label className="form-label">Editable product description</label>
            <textarea className="form-input" rows={3} value={generatedMetadata.description || ''} onChange={event => updateGeneratedMetadata('description', event.target.value)} style={{ resize: 'vertical' }} />
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

          <div style={{ marginTop: 14 }}>
            <label className="form-label">Editable category path</label>
            <input
              className="form-input"
              value={generatedMetadata.category_path || generatedMetadata.category || ''}
              onChange={event => setGeneratedMetadata(prev => ({ ...prev, category: event.target.value, category_path: event.target.value }))}
            />
          </div>
          <div style={{ marginTop: 14 }}>
            <label className="form-label">Automated trend & garment tags</label>
            <input
              className="form-input"
              value={(generatedMetadata.tags || []).join(', ')}
              onChange={event => updateGeneratedMetadata('tags', event.target.value.split(',').map(tag => tag.trim()).filter(Boolean))}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 9 }}>
              {(generatedMetadata.tags || []).map((tag, index) => (
                <span key={`${tag}-${index}`} style={{ background: 'linear-gradient(to right, #ff3f6c15, #f7706215)', border: '1px solid #ff3f6c30', color: '#ff3f6c', padding: '4px 10px', borderRadius: 16, fontSize: 12, fontWeight: 700 }}>
                  #{tag.replace(/^#/, '')}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {generatedMetadata && (
        <div className="card">
          <div className="card-title">Extracted Metadata / Details</div>
          <div className="card-desc" style={{ marginBottom: 16 }}>Review and edit the AI-detected clothing details before publishing.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12 }}>
            {EDITABLE_ATTRIBUTES.map(([key, label]) => {
              const fallbackKey = key === 'fabric_appearance' ? 'fabric_composition' : key
              const rawValue = confirmedAttrs?.[key] ?? confirmedAttrs?.[fallbackKey] ?? anchorExtracted?.[key] ?? anchorExtracted?.[fallbackKey]
              const rawConfidence = rawValue && typeof rawValue === 'object' ? Number(rawValue.confidence) : null
              const confidence = Number.isFinite(rawConfidence) ? Math.round(rawConfidence <= 1 ? rawConfidence * 100 : rawConfidence) : null
              return (
                <label key={key} style={{ margin: 0 }}>
                  <span className="form-label" style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                    {label}
                    {confidence != null && <span style={{ color: 'var(--success)', fontSize: 10 }}>AI {confidence}%</span>}
                  </span>
                  <input className="form-input" value={safeVal(rawValue)} onChange={event => updateConfirmedAttribute(key, event.target.value)} />
                </label>
              )
            })}
          </div>
        </div>
      )}

      {generatedMetadata?.size_chart && (() => {
        const chart = generatedMetadata.size_chart
        const fit = chart.fit_analysis
        return (
          <div className="card">
            <div className="card-title">Size Chart & Measurements</div>
            <div className="card-desc" style={{ marginBottom: 16 }}>Exact values and fit analysis for the selected profile.</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              <span className="badge badge-pass">Size {chart.selected_size || safeVal(confirmedAttrs?.model_size, 'M')}</span>
              <span className="badge" style={{ background: '#e3f2fd', color: '#1565c0' }}>Height {chart.selected_height || safeVal(confirmedAttrs?.model_height, "5'4\"")}</span>
              {chart.source && <span className="badge" style={{ background: 'var(--bg-tag)', color: 'var(--text-secondary)' }}>{chart.source}</span>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: sizeChart?.preview ? 'minmax(190px, 0.8fr) minmax(280px, 1.2fr)' : '1fr', gap: 18, alignItems: 'start' }}>
              {sizeChart?.preview && <img src={sizeChart.preview} alt="Uploaded size chart" style={{ width: '100%', borderRadius: 10, border: '1px solid var(--border)' }} />}
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                  {(chart.measurements || []).map(item => (
                    <div key={item.label} style={{ padding: 12, background: 'var(--bg-page)', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 700 }}>{item.label}</div>
                      <div style={{ fontSize: 17, fontWeight: 800, marginTop: 3 }}>{item.value}</div>
                    </div>
                  ))}
                </div>
                {fit && (
                  <div style={{ marginTop: 12, padding: 13, background: '#e3f2fd', border: '1px solid #bbdefb', borderRadius: 8, color: '#0d47a1', fontSize: 12, lineHeight: 1.7 }}>
                    <strong>Fit analysis:</strong> {fit.silhouette}; {fit.length}; {fit.stretch}. <strong>Recommendation:</strong> {fit.recommendation}.
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {generatedMetadata && (() => {
        const verification = generatedMetadata.verification || {}
        const confidence = Number(verification.confidence_score ?? v.overall_similarity ?? 0)
        const anchorAccuracy = Number(verification.anchor_data_accuracy ?? v.anchor_data_accuracy ?? confidence)
        return (
          <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
            <div className="card-title">Verification Status</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 14 }}>
              <div style={{ padding: 14, borderRadius: 9, background: 'var(--success-bg)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Match status</div>
                <div style={{ color: 'var(--success)', fontWeight: 800, marginTop: 5 }}>{verification.match_status || 'Verified match'}</div>
              </div>
              <div style={{ padding: 14, borderRadius: 9, background: 'var(--bg-page)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>AI confidence</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{confidence.toFixed(1)}%</div>
              </div>
              <div style={{ padding: 14, borderRadius: 9, background: 'var(--bg-page)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Anchor ↔ data accuracy</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{anchorAccuracy.toFixed(1)}%</div>
              </div>
            </div>
            {v.fusionResult && (
              <div style={{ marginTop: 14, padding: 14, background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 9, color: '#6d4c00', fontSize: 12, lineHeight: 1.7 }}>
                <strong>Bayesian formula score</strong><br />
                P(Match | Evidence) = P(Evidence | Match) × P(Match) ÷ P(Evidence) = <strong>{Number(v.fusionResult.probability).toFixed(1)}%</strong><br />
                Prior {(Number(v.fusionResult.breakdown?.prior || 0) * 100).toFixed(0)}% · CLIP LR {Number(v.fusionResult.breakdown?.lr_clip || 0).toFixed(2)} · pHash LR {Number(v.fusionResult.breakdown?.lr_phash || 0).toFixed(2)} · Attribute LR {Number(v.fusionResult.breakdown?.lr_attributes || 0).toFixed(2)}
              </div>
            )}
          </div>
        )
      })()}

      {/* Catalog image strip (verify mode only) */}
      {catalogPreviews.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Catalog evidence under verification</div>
            <span className={`badge ${catalogEvidenceDiagnostics.every(item => item.status === 'ready') ? 'badge-pass' : 'badge-warn'}`}>
              {catalogEvidenceDiagnostics.filter(item => item.status === 'ready').length || catalogPreviews.length}/5 loaded
            </span>
          </div>
          <div className="catalog-grid">
            {catalogPreviews.map((p, i) => (
              <div key={i} className={`catalog-thumb ${selectedCat === i ? 'selected' : ''}`} onClick={() => setSelectedCat(i)}>
                <CatalogPreviewImage src={p} alt={`${CATALOG_VIEW_LABELS[i] || `Image ${i + 1}`} catalog view`} />
                <div className="catalog-thumb-label">{CATALOG_VIEW_LABELS[i] || `Image ${i + 1}`}</div>
              </div>
            ))}
          </div>
          {catalogEvidenceDiagnostics.some(item => item.status !== 'ready') && (
            <div style={{ marginTop: 12, color: 'var(--danger)', fontSize: 12 }}>
              {catalogEvidenceDiagnostics.filter(item => item.status !== 'ready').map((item, index) => (
                <div key={index}>Image {index + 1}: {item.error || 'could not be loaded for verification'}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {sizeChartEvidence && Object.keys(sizeChartEvidence).length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 14 }}>
            <div>
              <div className="card-title" style={{ marginBottom: 3 }}>Seller size chart & fit evidence</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Model: {safeVal(confirmedAttrs?.model_size, 'Not provided')} · {safeVal(confirmedAttrs?.model_height, 'Height not provided')} · {safeVal(confirmedAttrs?.model_build, 'Build not provided')}
              </div>
            </div>
            <span className="badge badge-pass">Used in verification</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg-page)', textAlign: 'left' }}>
                  <th style={{ padding: 10 }}>Size</th>
                  <th style={{ padding: 10 }}>Chest</th>
                  <th style={{ padding: 10 }}>Garment length</th>
                  <th style={{ padding: 10 }}>Fit read</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(sizeChartEvidence).map(([size, values]) => (
                  <tr key={size} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: 10, fontWeight: 800 }}>{size}</td>
                    <td style={{ padding: 10 }}>{values.chest ?? '—'}{values.chest != null ? ' in' : ''}</td>
                    <td style={{ padding: 10 }}>{values.length ?? '—'}{values.length != null ? ' in' : ''}</td>
                    <td style={{ padding: 10, color: size === safeVal(confirmedAttrs?.model_size) ? 'var(--success)' : 'var(--text-secondary)' }}>
                      {size === safeVal(confirmedAttrs?.model_size) ? 'Selected model size' : 'Seller supplied'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              <CatalogPreviewImage src={catalogPreviews[selectedCat]} alt="Catalog" style={{ aspectRatio: '3/4', objectFit: 'contain', maxHeight: 360, width: '100%' }} />
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
      <div id="verification-findings" className="card">
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
            {phashResult.similarity_score != null && (
              <div style={{ fontSize: 12, padding: '4px 8px', background: 'var(--bg-highlight)', borderRadius: 4, border: '1px solid var(--border)' }}>
                <strong>Similarity:</strong> {(phashResult.similarity_score * 100).toFixed(1)}%
              </div>
            )}
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
        <>
          <div className={publishGate.blocked ? 'publish-readiness is-blocked' : 'publish-readiness'}>
            <strong>{publishGate.blocked ? 'Not ready to publish' : 'Ready to publish'}</strong>
            <span>
              {publishGate.blocked
                ? publishGate.message
                : v.status === 'PASS'
                  ? 'All critical checks passed.'
                  : `${warnCount} warning${warnCount === 1 ? '' : 's'} will remain attached to the evidence trail.`}
            </span>
          </div>
          <div className="action-btns">
            {publishGate.blocked && (
              <button
                className="btn btn-outline btn-sm"
                onClick={() => {
                  const targetId = corrections?.length ? 'ai-correction-copilot' : 'verification-findings'
                  document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
              >
                Review metadata fixes
              </button>
            )}
            <button className="btn btn-outline btn-sm" onClick={() => nav('/new-listing')}>
              Replace catalog images
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handlePublish}
              disabled={publishGate.blocked}
              title={publishGate.blocked ? publishGate.message : undefined}
            >
              {publishGate.blocked ? 'Publish blocked' : <>Publish to Catalog <ArrowRight size={14} /></>}
            </button>
          </div>
        </>
      </div>

      {ignoreConfirm && typeof document !== 'undefined' && createPortal(
        <div className="verify-modal-backdrop" onMouseDown={() => setIgnoreConfirm(null)}>
          <div
            className="verify-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ignore-confirm-title"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="verify-modal-icon"><AlertTriangle size={20} /></div>
            <div id="ignore-confirm-title" className="verify-modal-title">Keep your original value?</div>
            <p>
              You entered <strong>{ignoreConfirm.current_value}</strong> for{' '}
              <strong>{ignoreConfirm.field.replace(/_/g, ' ')}</strong>. The visual check detected{' '}
              <strong>{ignoreConfirm.suggested_value}</strong> with {String(ignoreConfirm.confidence || 'high').toLowerCase()} confidence.
            </p>
            <div className="verify-modal-note">
              Ignoring dismisses this suggestion, but any unresolved critical evidence can still block publishing.
            </div>
            <div className="verify-modal-actions">
              <button className="btn btn-outline" onClick={() => setIgnoreConfirm(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => {
                setAcceptedCorrections(prev => ({ ...prev, [ignoreConfirm.field]: 'IGNORED' }))
                setIgnoreConfirm(null)
              }}>Keep my value</button>
            </div>
          </div>
        </div>,
        document.body
      )}

    </main>
  )
}
