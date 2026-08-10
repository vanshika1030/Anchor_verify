import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../AppContext'
import Stepper from '../components/Stepper'
import { runVerification, updateCSVRow, recheckVerification } from '../services/api'
import { CheckCircle, XCircle, AlertTriangle, ArrowRight, Eye, Loader, Sparkles, Package, Tag, Plus, ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react'

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

const ENUMS = {
  sleeveLength: ['Sleeveless', 'Cap Sleeve', 'Short Sleeve', 'Elbow Length', 'Three-Quarter', 'Full Sleeve'],
  neckType: ['Round Neck', 'V-Neck', 'Square Neck', 'Boat Neck', 'Mandarin Collar', 'Collar', 'Sweetheart', 'Halter'],
  pattern: ['Solid', 'Printed', 'Striped', 'Checked', 'Floral', 'Graphic', 'Ribbed', 'Embroidered'],
  fit: ['Slim', 'Regular', 'Relaxed', 'Oversized', 'Bodycon'],
  garmentLength: ['Crop', 'Short', 'Hip Length', 'Knee Length', 'Calf Length', 'Ankle Length', 'Maxi'],
  occasion: ['Casual', 'Formal', 'Party', 'Festive', 'Sports', 'Ethnic']
}

const CLAIM_FIELDS = [
  { key: 'articleType', label: 'Product / Category', type: 'text' },
  { key: 'primaryColour', label: 'Primary Colour', type: 'text' },
  { key: 'secondaryColour', label: 'Secondary Colour', type: 'text' },
  { key: 'pattern', label: 'Pattern / Print', type: 'select', options: ENUMS.pattern },
  { key: 'neckType', label: 'Neckline', type: 'select', options: ENUMS.neckType },
  { key: 'sleeveLength', label: 'Sleeve Length', type: 'select', options: ENUMS.sleeveLength },
  { key: 'garmentLength', label: 'Garment Length', type: 'select', options: ENUMS.garmentLength },
  { key: 'fit', label: 'Fit / Silhouette', type: 'select', options: ENUMS.fit },
  { key: 'hemline', label: 'Hemline', type: 'text' },
  { key: 'occasion', label: 'Occasion / Style', type: 'select', options: ENUMS.occasion },
]

const EDITABLE_EVIDENCE_FIELDS = new Set([
  'articleType', 'primaryColour', 'secondaryColour', 'pattern', 'neckType',
  'sleeveLength', 'garmentLength', 'fit', 'hemline', 'occasion', 'fabric',
  'modelSize', 'modelHeight', 'modelBuild',
])

const EVIDENCE_TO_CSV_FIELD = {
  garment_type: 'articleType',
  primary_color: 'primaryColour',
  secondary_color: 'secondaryColour',
  pattern_type: 'pattern',
  neck_type: 'neckType',
  sleeve_length: 'sleeveLength',
  overall_length: 'garmentLength',
  fit: 'fit',
  hemline: 'hemline',
  occasion_style: 'occasion',
  fabric_composition: 'fabric',
  model_size: 'modelSize',
  model_height: 'modelHeight',
}

function buildEditableEvidenceClaims(sellerListing, claims) {
  const editable = {}
  for (const [key, value] of Object.entries(sellerListing || {})) {
    if (EDITABLE_EVIDENCE_FIELDS.has(key) || key.startsWith('sizeChart_')) editable[key] = value
  }
  for (const claim of claims || []) {
    const csvKey = EVIDENCE_TO_CSV_FIELD[claim.key]
    if (csvKey && (editable[csvKey] === undefined || editable[csvKey] === '')) {
      editable[csvKey] = claim.sellerValue === '(not declared)' ? '' : claim.sellerValue
    }
  }
  return editable
}

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

const SOURCE_LABELS = {
  front: 'Front anchor',
  back: 'Back anchor',
  closeup: 'Close-up anchor',
  size_chart: 'Size chart rule',
  catalog: 'Catalog image',
}

const tagKey = tag => String(typeof tag === 'object' ? tag?.tag : tag || '')
  .replace(/^#/, '')
  .trim()
  .toLowerCase()

function catalogEvidenceForClaim(claim, catalogPreviews = [], diagnostics = []) {
  const catalogEvidence = claim.catalogEvidence || claim.catalog_evidence
  if (claim.key === 'model_size' && claim.verdict === 'evidence_required') {
    return {
      value: `Catalog presentation appears inconsistent with listed size ${claim.sellerValue || 'S'}`,
      detail: 'Review the size disclosure against the studio record.',
      status: 'observed',
    }
  }
  if (claim.key === 'model_height' && claim.verdict === 'evidence_required') {
    return {
      value: `No reliable height reference for listed ${claim.sellerValue || 'height'}`,
      detail: 'Review the height disclosure against the studio record.',
      status: 'observed',
    }
  }
  const directObservation = claim.catalogObservation || claim.catalog_observation ||
    claim.catalogValue || claim.catalog_value ||
    (typeof catalogEvidence === 'object' ? (catalogEvidence.observation || catalogEvidence.value || catalogEvidence.summary) : catalogEvidence)

  if (directObservation && typeof directObservation !== 'object') {
    const catalogStatus = catalogEvidence?.status || claim.catalogStatus
    const isReferenceOnly = ['unavailable', 'reference_only', 'reference_unavailable', 'not_supplied', 'not_independently_verifiable'].includes(catalogStatus)
    return {
      value: String(directObservation),
      detail: catalogEvidence?.detail || (isReferenceOnly ? 'URL is attached but not independently read in this evidence pass' : 'Visual catalog observation'),
      status: isReferenceOnly ? 'pending' : 'observed',
    }
  }

  const suppliedCount = Math.max(
    catalogPreviews?.length || 0,
    diagnostics?.filter(item => item?.source)?.length || 0,
  )
  if (suppliedCount) {
    const readyCount = diagnostics?.filter(item => item?.status === 'ready').length || 0
    return {
      value: `${suppliedCount} catalog image URL${suppliedCount === 1 ? '' : 's'} supplied`,
      detail: readyCount
        ? `${readyCount} image${readyCount === 1 ? '' : 's'} available to the visual checker`
        : 'No per-attribute catalog reading was returned for this fixture',
      status: readyCount ? 'provided' : 'pending',
    }
  }

  return {
    value: 'No catalog image supplied',
    detail: 'Catalog comparison cannot be run without a catalog view',
    status: 'missing',
  }
}

/**
 * Render a Bayesian likelihood ratio. A null/undefined ratio means the signal
 * was never observed — which is not the same as a ratio of 0, and must not be
 * displayed as one.
 */
function formatLikelihoodRatio(ratio, label) {
  if (ratio === null || ratio === undefined || Number.isNaN(Number(ratio))) {
    return `${label} — not measured`
  }
  return `${label} LR ${Number(ratio).toFixed(2)}`
}

function sourceLabelsForClaim(claim) {
  const sources = Array.isArray(claim.evidenceSource)
    ? claim.evidenceSource
    : String(claim.evidenceSource || '').split(',').filter(Boolean)
  return sources.map(source => SOURCE_LABELS[source] || source.replace(/_/g, ' '))
}

function anchorEvidenceForClaim(claim) {
  const anchorEvidence = claim.anchorEvidence || claim.anchor_evidence
  if (typeof anchorEvidence === 'string') return anchorEvidence
  if (anchorEvidence && typeof anchorEvidence === 'object') {
    return anchorEvidence.observation || anchorEvidence.value || anchorEvidence.summary || claim.anchorObservation
  }
  return claim.anchorObservation
}

function compactCorrectionCopy(correction) {
  const key = String(correction.claimKey || correction.evidenceKey || correction.field || '').toLowerCase()
  const current = String(correction.current_value || '').trim()

  if (key === 'catalog_visual_match') {
    return { issue: 'Catalog colour and stripe scale do not match the item.', action: 'Replace the catalog images.' }
  }
  if (key.includes('fabric')) {
    return { issue: current ? `Fabric is listed as ${current}.` : 'Fabric claim needs verification.', action: 'Add a label or supplier spec — or remove the claim.' }
  }
  if (key === 'model_size') {
    return { issue: current ? `Catalog presentation looks inconsistent with listed size ${current}.` : 'Model-size disclosure needs review.', action: 'Verify with the studio record — or remove it.' }
  }
  if (key === 'model_height') {
    return { issue: current ? `Catalog image does not substantiate height ${current}.` : 'Model-height disclosure needs review.', action: 'Verify with the studio record — or remove it.' }
  }
  if (key.includes('size_chart') || key.includes('overall_length')) {
    return { issue: 'Listing length does not match the item.', action: 'Update the length and size chart.' }
  }
  if (key.includes('back_print')) {
    return { issue: 'Back-view print does not match the item.', action: 'Replace the back catalog image.' }
  }
  if (key.includes('garment_type')) {
    return { issue: 'Catalog shows a different product type.', action: 'Replace the catalog images.' }
  }
  if (key.includes('color') || key.includes('colour')) {
    return { issue: 'Catalog colour does not match the listing.', action: 'Replace the images or update the colour.' }
  }
  if (/(pattern|sleeve|neck|fit|hemline|occasion)/.test(key)) {
    return { issue: 'Catalog detail does not match the listing.', action: 'Update the listing or replace the catalog image.' }
  }
  return {
    issue: 'Listing detail does not match the item.',
    action: 'Update the listing or replace the catalog image.',
  }
}

function fallbackAestheticSuggestions(claims = []) {
  const verified = claims.filter(claim => claim.verdict === 'evidence_backed')
  const valueFor = key => String(verified.find(claim => claim.key === key)?.anchorObservation || '').toLowerCase()
  const garment = valueFor('garment_type')
  const pattern = valueFor('pattern_type')
  const colour = valueFor('primary_color')
  const occasion = valueFor('occasion_style')
  const suggestions = []
  const add = (tag, explanation, evidenceUsed) => suggestions.push({ tag, explanation, evidenceUsed })

  if (/kurti|ethnic|suit|anarkali/.test(garment)) {
    add('#IndianCasual', 'Easy ethnic styling for everyday plans.', ['garment_type'])
    add('#DesiCore', 'A Gen-Z discovery label for contemporary Indian silhouettes.', ['garment_type'])
    add('#CampusEthnic', 'A college-friendly ethnic outfit cue.', ['garment_type'])
  }
  if (/printed|floral|motif/.test(pattern)) {
    add('#PrintPlay', 'Pattern-led styling for a more expressive casual look.', ['pattern_type'])
    add('#EverydayStatement', 'A searchable label for an outfit with visible print detail.', ['pattern_type'])
  }
  if (/blue|indigo/.test(colour)) {
    add('#BlueMood', 'Colour-story discovery tag for blue-toned edits.', ['primary_color'])
  }
  if (/festive|ethnic/.test(occasion)) {
    add('#LowKeyFestive', 'For understated ethnic occasions; seller approval required.', ['occasion_style'])
  }

  return suggestions
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

  // Evidence Matrix State
  const [profileId, setProfileId] = useState(null)
  const [profileLabel, setProfileLabel] = useState('')
  const [evidenceClaims, setEvidenceClaims] = useState([])
  const [evidenceSummary, setEvidenceSummary] = useState(null)
  const [evidenceTags, setEvidenceTags] = useState(null)
  const [evidenceBinding, setEvidenceBinding] = useState(null)
  const [editedClaims, setEditedClaims] = useState({})
  const [originalClaims, setOriginalClaims] = useState({})
  const [isRechecking, setIsRechecking] = useState(false)
  const [tagRejections, setTagRejections] = useState({})
  const [tagApprovals, setTagApprovals] = useState({})
  const [pipelineStatus, setPipelineStatus] = useState(null)
  const [nextAction, setNextAction] = useState(null)
  const [demoNotice, setDemoNotice] = useState(null)
  const [showOnlyIssues, setShowOnlyIssues] = useState(true)
  const [channelReport, setChannelReport] = useState(null)
  // Drives the score-ring fill transition after first paint.
  const [ringReady, setRingReady] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setRingReady(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  
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
      setPipelineStatus(result.status || null)
      setNextAction(result.nextAction || null)
      setDemoNotice(result.demoNotice || null)
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
      if (result.channelReport) setChannelReport(result.channelReport)
      if (result.catalogEvidenceDiagnostics) setCatalogEvidenceDiagnostics(result.catalogEvidenceDiagnostics)
      if (result.sizeChartEvidence) setSizeChartEvidence(result.sizeChartEvidence)
      if (result.mode) setActualMode(result.mode)
      setCurrentSlide(0)

      if (result.profileId) {
        setProfileId(result.profileId)
        setProfileLabel(result.profileLabel)
        setEvidenceClaims(result.claims || [])
        setEvidenceSummary(result.summary)
        setEvidenceTags(result.tags)
        setEvidenceBinding(result.evidenceBinding || null)

        const initialClaims = buildEditableEvidenceClaims(sellerListing, result.claims)
        setEditedClaims(initialClaims)
        setOriginalClaims(initialClaims)
      } else {
        setProfileId(null)
        setProfileLabel('')
        setEvidenceClaims([])
        setEvidenceSummary(null)
        setEvidenceTags(null)
        setEvidenceBinding(null)
      }

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

  const handleRecheck = async (claimsToCheck = editedClaims) => {
    if (!evidenceBinding) {
      setError('The anchor evidence binding is missing. Please verify the current anchor images again before re-checking.')
      return
    }
    setIsRechecking(true)
    try {
      const result = await recheckVerification({
        editedClaims: claimsToCheck,
        profileId,
        sizeChart: sizeChartMeasurements || null,
        evidenceBinding,
        verificationMode: actualMode === 'generate' ? 'generate' : 'csv',
      })
      if (result.success) {
        setEvidenceClaims(result.claims)
        setEvidenceSummary(result.summary)
        setEvidenceTags(result.tags)
        setCorrections(result.corrections || [])
        setSuggestionAgent(result.suggestionAgent || null)
        if (result.verdict) setVerdict(result.verdict)
      }
    } catch (err) {
      console.error(err)
      setError(err.message || 'Re-check failed. Verify the current anchor images again.')
    } finally {
      setIsRechecking(false)
    }
  }

  const applyCorrection = correction => {
    const evidenceKey = correction.claimKey || correction.evidenceKey
    const field = correction.field

    // A physical-length disagreement is intentionally not auto-written into a
    // size chart: a seller needs to enter the real measured values. Marking it
    // reviewed is useful, but it must not silently alter measurements.
    if (evidenceKey === 'size_chart_physical_length' || correction.action === 'review_catalog') {
      setAcceptedCorrections(previous => ({ ...previous, [field]: 'REVIEWED' }))
      return
    }

    const nextClaims = { ...editedClaims, [field]: correction.suggested_value }
    setAcceptedCorrections(previous => ({ ...previous, [field]: correction.suggested_value }))
    setEditedClaims(nextClaims)
    setConfirmedAttrs(previous => ({ ...(previous || {}), [field]: correction.suggested_value }))
    // Applying a factual fix should be visibly meaningful: re-run the same
    // hash-bound evidence comparison immediately, without changing the
    // submitted anchors or trusting a stale green report.
    void handleRecheck(nextClaims)
  }

  const decideAestheticTag = (tag, decision) => {
    const key = tagKey(tag)
    if (!key) return
    if (decision === 'accept') {
      setTagApprovals(previous => ({ ...previous, [key]: true }))
      setTagRejections(previous => ({ ...previous, [key]: false }))
      const rawLabel = typeof tag === 'object' ? tag.tag : tag
      const visibleTag = String(rawLabel || key).startsWith('#') ? String(rawLabel) : `#${rawLabel}`
      setConfirmedAttrs(previous => {
        const existing = toTagList(previous?.tags)
        return { ...(previous || {}), tags: [...new Set([...existing, visibleTag])] }
      })
      // Generated listings publish their editable metadata, so an approved
      // discovery tag must be added there as well as to the audit record.
      if (actualMode === 'generate') {
        setGeneratedMetadata(previous => ({
          ...(previous || {}),
          tags: [...new Set([...(previous?.tags || []), visibleTag])],
        }))
      }
    } else {
      setTagRejections(previous => ({ ...previous, [key]: true }))
      setTagApprovals(previous => ({ ...previous, [key]: false }))
    }
  }

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
      // A correction is not cosmetic: use the seller-confirmed/re-checked
      // value first when creating the published object.  The raw CSV is still
      // retained inside the audit report, but it must not overwrite a fix.
      const confirmedValue = (csvKey, normalizedKey) =>
        safeVal(confirmedAttrs?.[csvKey]) || safeVal(confirmedAttrs?.[normalizedKey]) || ''
      const effectiveSeller = {
        ...seller,
        productTitle: confirmedValue('productTitle', 'product_title') || seller.productTitle,
        articleType: confirmedValue('articleType', 'garment_type') || seller.articleType,
        primaryColour: confirmedValue('primaryColour', 'primary_color') || seller.primaryColour,
        secondaryColour: confirmedValue('secondaryColour', 'secondary_color') || seller.secondaryColour,
        pattern: confirmedValue('pattern', 'pattern_type') || seller.pattern,
        neckType: confirmedValue('neckType', 'neck_type') || seller.neckType,
        sleeveLength: confirmedValue('sleeveLength', 'sleeve_length') || seller.sleeveLength,
        garmentLength: confirmedValue('garmentLength', 'overall_length') || seller.garmentLength,
        fit: confirmedValue('fit', 'fit') || seller.fit,
        hemline: confirmedValue('hemline', 'hemline') || seller.hemline,
        occasion: confirmedValue('occasion', 'occasion_style') || seller.occasion,
        fabric: confirmedValue('fabric', 'fabric_composition') || seller.fabric,
        modelSize: confirmedValue('modelSize', 'model_size') || seller.modelSize,
        modelHeight: confirmedValue('modelHeight', 'model_height') || seller.modelHeight,
        modelBuild: confirmedValue('modelBuild', 'model_build') || seller.modelBuild,
      }
      const sellerTitle = effectiveSeller.productTitle || safeVal(confirmedAttrs?.garment_type) || 'Product'
      const sellerDescription = effectiveSeller.description || safeVal(confirmedAttrs?.description)
      const sellerTags = [...new Set([
        ...toTagList(seller.tags),
        ...toTagList(confirmedAttrs?.tags),
      ])]
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
          style_code: effectiveSeller.styleId || safeVal(confirmedAttrs?.style_id) || null,
          title: publishEnhanced && finalMetadata?.title ? finalMetadata.title : sellerTitle,
          description: publishEnhanced && finalMetadata?.description ? finalMetadata.description : sellerDescription,
          tags: publishEnhanced && finalMetadata?.tags?.length ? finalMetadata.tags : sellerTags,
          article_type: effectiveSeller.articleType || '',
          category: publishEnhanced && (finalMetadata?.category_path || finalMetadata?.category)
            ? (finalMetadata.category_path || finalMetadata.category)
            : [effectiveSeller.gender, effectiveSeller.category, effectiveSeller.articleType].filter(Boolean).join(' > '),
          brand_name: effectiveSeller.brand || safeVal(confirmedAttrs?.brand) || 'Brand',
          mrp: Number(effectiveSeller.mrp || safeVal(confirmedAttrs?.mrp)) || null,
          selling_price: Number(effectiveSeller.sellingPrice || safeVal(confirmedAttrs?.selling_price)) || null,
          attributes: { ...(confirmedAttrs || {}) },
          size_chart: sizeChartEvidence || sizeChartMeasurements || null,
          verification_status: 'published',
          verification_score: v?.overall_similarity || null,
          anchor_image_url: base64Anchor || anchorFront?.preview || null,
          catalog_images: catalogImages,
          ai_model_images: actualMode === 'generate' ? catalogImages : [],
          seller_metadata: effectiveSeller,
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
          tags: sellerTags.join(', '),
        }
        // Persist the seller's current reviewed claims to the export as well;
        // otherwise the visual result and the downloaded CSV could diverge.
        Object.entries(editedClaims || {}).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') updates[key] = value
        })
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
            {actualMode === 'generate' ? 'Preparing your catalog candidate' : 'Preparing your evidence check'}
          </div>
          
          <div style={{ textAlign: 'left', background: '#f8f9fa', padding: 24, borderRadius: 8, fontSize: 14, color: 'var(--text-secondary)' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              {checklistStep > 0 ? <CheckCircle size={18} color="var(--success)" /> : (checklistStep === 0 ? <Loader size={18} color="var(--accent)" className="spin" /> : <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px dashed #ccc' }} />)}
              <span style={{ color: checklistStep >= 0 ? '#333' : '#888' }}>Binding the submitted front, back, and close-up anchors...</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              {checklistStep > 1 ? <CheckCircle size={18} color="var(--success)" /> : (checklistStep === 1 ? <Loader size={18} color="var(--accent)" className="spin" /> : <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px dashed #ccc' }} />)}
              <span style={{ color: checklistStep >= 1 ? '#333' : '#888' }}>Reading seller-confirmed claims and size-chart measurements...</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              {checklistStep > 2 ? <CheckCircle size={18} color="var(--success)" /> : (checklistStep === 2 ? <Loader size={18} color="var(--accent)" className="spin" /> : <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px dashed #ccc' }} />)}
              <span style={{ color: checklistStep >= 2 ? '#333' : '#888' }}>Resolving the available catalog-evidence source...</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {checklistStep > 3 ? <CheckCircle size={18} color="var(--success)" /> : (checklistStep === 3 ? <Loader size={18} color="var(--accent)" className="spin" /> : <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px dashed #ccc' }} />)}
              <span style={{ color: checklistStep >= 3 ? '#333' : '#888' }}>Producing the publish decision and corrections...</span>
            </div>
            
          </div>
          
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 24 }}>
            Exact finalist fixtures return immediately from their hash-bound evidence record. New assets show a clear processing state until the production worker completes.
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
  const hasEvidenceProfile = Boolean(profileId && evidenceSummary)
  const evidenceFailCount = evidenceSummary?.criticalMismatches || 0
  const evidenceRequiredCount = evidenceSummary?.evidenceRequired || 0
  const evidenceWarnCount = Math.max(0, (evidenceSummary?.mismatches || 0) - (evidenceSummary?.criticalMismatchClaims || evidenceFailCount))
  const evidencePassCount = evidenceSummary?.evidenceBacked || 0
  const failCount = hasEvidenceProfile
    ? evidenceFailCount
    : rows.filter(r => r.status === 'mismatch' && r.severity === 'HIGH').length + criticalModelIssues.length
  const warnCount = hasEvidenceProfile
    ? evidenceWarnCount
    : rows.filter(r => r.status === 'mismatch' && r.severity !== 'HIGH').length +
      rows.filter(r => r.status === 'warning').length + warningModelIssues.length
  const passCount = hasEvidenceProfile
    ? evidencePassCount
    : rows.filter(r => r.status === 'match').length
  const skipCount = hasEvidenceProfile
    ? (evidenceSummary?.sellerDeclared || 0) + (evidenceSummary?.insufficientEvidence || 0)
    : rows.filter(r => r.status === 'skip').length
  const catalogAnchorMappings = [
    { label: 'Front', anchor: anchorFront, anchorLabel: 'Front anchor', note: 'Front catalog compared with front anchor' },
    { label: 'Back', anchor: anchorBack, anchorLabel: 'Back anchor', note: 'Back catalog compared with back anchor' },
    { label: 'Side', anchor: anchorFront, anchorLabel: 'Front anchor', note: 'Side catalog compared with front anchor' },
    { label: 'Close-up', anchor: anchorCloseup, anchorLabel: 'Close-up anchor', note: 'Close-up catalog compared with close-up anchor' },
    { label: 'Full body', anchor: anchorFront, anchorLabel: 'Front anchor', note: 'Full-body catalog compared with front anchor' },
  ]
  const activeCatalogMapping = catalogAnchorMappings[selectedCat] || catalogAnchorMappings[0]

  // Dynamically update verdict status based on un-fixed issues
  let v = verdict ? JSON.parse(JSON.stringify(verdict)) : { status: 'PASS', reason: 'Completed', critical_issues: [] }
  
  // Removed: a client-side "+15 points per resolved row" boost applied straight
  // to the Bayesian posterior. It inflated a number the backend computed from
  // evidence using an arbitrary constant, and because `probability` arrives as
  // a string it was doing string concatenation before Math.min coerced it back
  // — so the displayed figure was neither the model's nor the intended boost.
  // The score shown is now the server-computed one; editing claims and running
  // Re-check recomputes it with the same math on the backend.
  if (v.fusionResult) {
    const origFailCount = (comparisonResult || []).filter(r => r.status === 'mismatch' || r.status === 'warning').length;
    const currentFailCount = rows.filter(r => r.status === 'mismatch' || r.status === 'warning').length;
    v.fusionResultStale = currentFailCount !== origFailCount;
  }

  if (hasEvidenceProfile) {
    // The exact evidence record is authoritative. Never let empty legacy
    // comparison rows turn an evidence FAIL into a superficial green PASS.
    v = {
      ...v,
      status: evidenceSummary.overallVerdict,
      reason: evidenceSummary.overallReason,
      evidenceDriven: true,
      critical_fails: evidenceFailCount,
      warnings: evidenceWarnCount,
    }
  } else if (v.status !== 'UNVERIFIED') {
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
  const hasUsableEvidence = hasEvidenceProfile
    ? evidenceClaims.some(claim => ['evidence_backed', 'mismatch', 'seller_declared', 'insufficient_evidence', 'evidence_required'].includes(claim.verdict))
    : rows.some(row => ['match', 'mismatch', 'warning'].includes(row.status))
  // Low-confidence style differences remain in the audit trail as reviews.
  // Only consumer-critical evidence blocks a listing from publication.
  const evidenceProfileBlocked = hasEvidenceProfile && evidenceFailCount > 0
  const publishGate = {
    blocked: evidenceProfileBlocked || (!hasEvidenceProfile && (v.status === 'FAIL' || v.status === 'UNVERIFIED' || !hasUsableEvidence)),
    message: evidenceProfileBlocked
      ? evidenceSummary.overallReason
      : !hasUsableEvidence || v.status === 'UNVERIFIED'
      ? 'Verification produced no usable evidence. Retry verification before publishing.'
      : hasCatalogImageConflict && hasSizeConflict
        ? 'Publishing is blocked. Fix or replace the catalog images first. The size/length evidence also conflicts, so update the listing metadata or size chart, or replace the catalog image, then verify again.'
        : hasCatalogImageConflict
          ? 'Publishing is blocked because the catalog images are not consistent with the anchor. Fix or replace the catalog images, then verify again.'
          : hasSizeConflict
            ? 'Publishing is blocked by a size or length conflict. Update the listing metadata or size chart, or replace the catalog image, then verify again.'
            : 'Publishing is blocked until every critical verification finding is resolved.',
  }

  const suppliedAestheticTags = Array.isArray(evidenceTags?.aestheticSuggestions)
    ? evidenceTags.aestheticSuggestions
    : []
  const aestheticSuggestions = [...suppliedAestheticTags, ...fallbackAestheticSuggestions(evidenceClaims)]
    .filter((tag, index, all) => {
      const key = tagKey(tag)
      const mismatchUsed = tag?.evidenceUsed?.some(evidenceKey =>
        evidenceClaims.find(claim => claim.key === evidenceKey)?.verdict === 'mismatch'
      )
      return key && !mismatchUsed && all.findIndex(candidate => tagKey(candidate) === key) === index
    })

  const evidenceCorrections = evidenceClaims
    .filter(claim => claim.verdict === 'mismatch' && claim.sellerValue && claim.anchorObservation)
    .map(claim => ({
      field: EVIDENCE_TO_CSV_FIELD[claim.key] || claim.key,
      displayField: claim.label,
      current_value: claim.sellerValue,
      suggested_value: claim.anchorObservation,
      reason: claim.verdictExplanation || claim.explanation || 'The seller declaration conflicts with the uploaded anchors.',
      cross_verified: 'ai_confirmed',
      evidenceKey: claim.key,
      action: 'update_declaration',
    }))

  const modelCorrections = (modelIssues || []).map(issue => ({
    field: `model-${String(issue.attr || 'evidence').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    displayField: issue.attr || 'Catalog representation',
    current_value: issue.declared || 'Seller declaration',
    suggested_value: issue.detected || 'Review catalog image',
    reason: issue.note || 'The catalog representation may mislead shoppers about fit or garment proportions.',
    cross_verified: issue.confidence === 'LOW' ? 'uncertain' : 'ai_confirmed',
    action: 'review_catalog',
  }))

  const allCorrections = [...(Array.isArray(corrections) ? corrections : []), ...evidenceCorrections, ...modelCorrections]
    .filter((correction, index, all) => {
      const identity = correction.claimKey || correction.evidenceKey || `${correction.field}|${correction.suggested_value}`
      return all.findIndex(candidate => (candidate.claimKey || candidate.evidenceKey || `${candidate.field}|${candidate.suggested_value}`) === identity) === index
    })
  const priorityEvidenceKeys = new Set(['catalog_visual_match', 'fabric_composition', 'model_size', 'model_height', 'model_build', 'size_chart_physical_length', 'back_print_coverage'])
  const correctionsToShow = hasEvidenceProfile
    ? allCorrections.filter(correction => {
        const key = correction.claimKey || correction.evidenceKey
        return priorityEvidenceKeys.has(key) && !(profileId === 'kurti' && key === 'model_build')
      })
    : allCorrections
  const catalogInputCount = Math.max(
    catalogPreviews?.length || 0,
    catalogEvidenceDiagnostics?.filter(item => item?.source)?.length || 0,
  )

  return (
    <main className="verify-page page-shell">
      <div className="verify-heading">
        <div>
          <div className="section-kicker">Final quality check</div>
          <h1>{actualMode === 'generate' ? 'Review your catalog candidate' : 'Review your verified listing'}</h1>
          <p>{actualMode === 'generate'
            ? 'Confirm the candidate imagery, seller-confirmed details, and evidence boundaries before publishing.'
            : 'Compare seller metadata, catalog evidence, physical anchors, and size-chart measurements before publishing.'}</p>
        </div>
        <div className="verify-assurance"><ShieldCheck size={15} /> Anchor protected</div>
      </div>
      <Stepper steps={FLOW} current={2} />

      {(pipelineStatus === 'EVIDENCE_PENDING' || pipelineStatus === 'GENERATION_PENDING') && (
        <section className="card" role="status" style={{ borderLeft: '4px solid var(--warning)', marginTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <AlertTriangle size={20} color="var(--warning)" style={{ marginTop: 2 }} />
            <div>
              <div className="card-title" style={{ marginBottom: 5 }}>
                {pipelineStatus === 'GENERATION_PENDING' ? 'Catalog candidate pending' : 'Evidence processing pending'}
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.55, margin: 0 }}>
                {v.reason}
              </p>
              {nextAction && <p style={{ color: 'var(--text-secondary)', fontSize: 12, margin: '8px 0 0' }}><strong>Next step:</strong> {nextAction}</p>}
            </div>
          </div>
        </section>
      )}

      {/* Verdict hero — one place that answers "can I publish, and why not" */}
      {(() => {
        const status = v.status
        const scoreValue = v.overall_similarity != null && !Number.isNaN(Number(v.overall_similarity))
          ? Math.max(0, Math.min(100, Number(v.overall_similarity)))
          : null
        // The score's provenance matters: fixture results replay a stored
        // evidence record (estimate), live runs measure the images in front
        // of them. Say which one this is instead of showing a bare number.
        const scoreLabel = hasEvidenceProfile
          ? 'Estimated from the stored evidence record'
          : v.fusionResult
            ? 'Measured live from your images'
            : null
        const RING_R = 44
        const circumference = 2 * Math.PI * RING_R
        const ringOffset = scoreValue == null ? circumference : circumference * (1 - (ringReady ? scoreValue : 0) / 100)
        const scoreTone = scoreValue == null ? '' : scoreValue > 80 ? 'good' : scoreValue > 50 ? 'mid' : 'low'
        const headline = status === 'FAIL'
          ? `${failCount || 'Critical'} issue${failCount === 1 ? '' : 's'} must be fixed before this listing goes live`
          : status === 'WARNING'
            ? `Publishable — ${warnCount} thing${warnCount === 1 ? '' : 's'} worth reviewing first`
            : status === 'UNVERIFIED'
              ? 'Verification could not complete'
              : 'Everything checks out'
        return (
          <section className={`verify-hero is-${status.toLowerCase()}`}>
            <div className="verify-hero-main">
              <div className="verify-hero-status">
                {status === 'PASS' && <CheckCircle size={26} />}
                {status === 'FAIL' && <XCircle size={26} />}
                {status === 'WARNING' && <AlertTriangle size={26} />}
                {status === 'UNVERIFIED' && <AlertTriangle size={26} />}
                <span>{status === 'PASS' ? 'Verified' : status === 'FAIL' ? 'Blocked' : status === 'WARNING' ? 'Needs review' : 'Unverified'}</span>
              </div>
              <h2 className="verify-hero-headline">{headline}</h2>
              <p className="verify-hero-reason">{v.reason}</p>
              <div className="verify-hero-chips">
                {failCount > 0 && <span className="verify-chip is-fail"><XCircle size={14} /> {failCount} failed</span>}
                {warnCount > 0 && <span className="verify-chip is-warn"><AlertTriangle size={14} /> {warnCount} to review</span>}
                <span className="verify-chip is-pass"><CheckCircle size={14} /> {passCount} passed</span>
                {skipCount > 0 && <span className="verify-chip is-skip">{skipCount} not measurable</span>}
              </div>
            </div>
            {scoreValue != null && (
              <div className="verify-hero-score">
                <svg viewBox="0 0 104 104" role="img" aria-label={`Consistency score ${scoreValue.toFixed(0)} percent`}>
                  <circle className="verify-ring-track" cx="52" cy="52" r={RING_R} />
                  <circle
                    className={`verify-ring-fill is-${scoreTone}`}
                    cx="52" cy="52" r={RING_R}
                    strokeDasharray={circumference}
                    strokeDashoffset={ringOffset}
                  />
                </svg>
                <div className="verify-hero-score-number">
                  <strong>{scoreValue.toFixed(0)}<em>%</em></strong>
                  <span>consistent</span>
                </div>
                {scoreLabel && <p className="verify-hero-score-label">{scoreLabel}</p>}
              </div>
            )}
          </section>
        )
      })()}

      {/* The evidence workspace intentionally keeps each source separate: seller claim,
          catalog input, and the hash-bound physical anchors. */}
      {profileId && evidenceSummary && (
        <section className="anchor-evidence-workspace">
          <div className="anchor-evidence-summary">
            <div>
              <div className="section-kicker">Hash-bound evidence record</div>
              <h2>What Anchor checked — and what it did not</h2>
              <p>{profileLabel}. The physical-anchor record is reused when a seller edits a claim; it is never selected by product title.</p>
            </div>
            <div className={`anchor-evidence-overall anchor-evidence-overall--${String(evidenceSummary.overallVerdict || 'WARNING').toLowerCase()}`}>
              <strong>{evidenceSummary.overallVerdict}</strong>
              {/* The full reason already leads the page in the verdict hero —
                  repeating the same sentence here was pure noise. */}
              <span>{evidenceSummary.overallVerdict === 'PASS'
                ? 'Every supported claim is consistent with the anchors.'
                : 'Details and fixes are in the list below.'}</span>
            </div>
          </div>
          <div className="anchor-evidence-stats">
            <span className="anchor-evidence-stat pass"><CheckCircle size={15} /><b>{evidenceSummary.evidenceBacked || 0}</b> evidence-backed</span>
            <span className="anchor-evidence-stat fail"><XCircle size={15} /><b>{evidenceSummary.criticalMismatches || 0}</b> must resolve</span>
            {evidenceRequiredCount > 0 && <span className="anchor-evidence-stat warn"><AlertTriangle size={15} /><b>{evidenceRequiredCount}</b> proof required</span>}
            <span className="anchor-evidence-stat warn"><AlertTriangle size={15} /><b>{Math.max(0, (evidenceSummary.mismatches || 0) - (evidenceSummary.criticalMismatchClaims || evidenceSummary.criticalMismatches || 0))}</b> review</span>
            <span className="anchor-evidence-stat neutral"><Package size={15} /><b>{catalogInputCount}</b> catalog URLs attached</span>
            {pipelineStatus === 'EVIDENCE_AVAILABLE' && <span className="anchor-evidence-stat neutral"><ShieldCheck size={15} /> exact evidence record active</span>}
          </div>
          
          {actualMode !== 'generate' && (
          <details className="anchor-evidence-card anchor-evidence-editor">
            <summary className="anchor-evidence-editor-summary"><ShieldCheck size={20} /><span><strong>Review imported CSV claims</strong><small>CSV values are unverified until evidence supports them.</small></span></summary>
            <p className="anchor-evidence-copy">
              Change an imported claim and re-check it against the same front, back and close-up anchors. Fabric and model disclosures need documentary evidence; image pixels alone cannot prove them.
            </p>
            
            <div className="anchor-evidence-editor-inner">
              <div className="anchor-evidence-editor-fields">
                {Object.keys(editedClaims).map(key => {
                  if (key === 'id' || key === 'productId' || key === 'verification_status' || (profileId === 'kurti' && key === 'modelBuild')) return null;
                  const isSizeChart = key.startsWith('sizeChart_');
                  const fieldDef = CLAIM_FIELDS.find(f => f.key === key);
                  const isChanged = editedClaims[key] !== originalClaims[key];
                  
                  return (
                    <div key={key} className={`anchor-evidence-editor-field${isChanged ? ' is-changed' : ''}`}>
                      <label>{fieldDef?.label || key.replace(/([A-Z])/g, ' $1')}</label>
                      {fieldDef?.type === 'select' ? (
                        <select 
                          value={editedClaims[key] || ''}
                          onChange={e => setEditedClaims(previous => ({ ...previous, [key]: e.target.value }))}
                        >
                          <option value="">Select…</option>
                          {fieldDef.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input 
                          type={isSizeChart ? 'number' : 'text'}
                          value={editedClaims[key] || ''}
                          onChange={e => setEditedClaims(previous => ({ ...previous, [key]: e.target.value }))}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="anchor-evidence-editor-actions">
                <button type="button" className="btn btn-outline" onClick={() => setEditedClaims(originalClaims)}>
                  Reset imported values
                </button>
                <button type="button" className="btn btn-primary" onClick={handleRecheck} disabled={isRechecking}>
                  {isRechecking ? <Loader className="spin" size={16} /> : <CheckCircle size={16} />} {isRechecking ? 'Re-checking evidence…' : 'Re-check against anchors'}
                </button>
              </div>
            </div>
          </details>
          )}

        </section>
      )}


      {/* THE fix list — the one place issues live. The consistency copilot's
          summary folds into this header; it no longer gets a second card that
          restates the same problems in different words. */}
      {correctionsToShow.length > 0 && actualMode !== 'generate' && (
        <div id="ai-correction-copilot" className="card fix-list">
          <div className="fix-list-head">
            <div className="fix-list-title">
              <Sparkles size={20} />
              <div>
                <strong>What to fix, and how</strong>
                <p>{correctionsToShow.length} issue{correctionsToShow.length === 1 ? '' : 's'} standing between this listing and publication</p>
              </div>
            </div>
            {suggestionAgent && (
              <span className={`badge ${suggestionAgent.status === 'consistent' ? 'badge-pass' : 'badge-warn'}`}>
                {suggestionAgent.status === 'consistent' ? 'Consumer-ready' : 'Review recommended'}
              </span>
            )}
          </div>
          <div className="fix-list-items">
            {correctionsToShow.map((c, i) => {
              const copy = compactCorrectionCopy(c)
              const status = acceptedCorrections[c.field] === 'IGNORED' ? 'ignored' : (acceptedCorrections[c.field] ? 'accepted' : 'pending');
              const isAccepted = status === 'accepted';
              const isIgnored = status === 'ignored';
              const declared = c.current_value && String(c.current_value).trim()
              const evidenceShows = c.suggested_value && String(c.suggested_value).trim()
              // Some corrections carry an instruction ("Update the size chart…")
              // rather than an observed value. Instructions live in "How to fix";
              // showing them under "Evidence shows" would misstate what was seen.
              const looksLikeInstruction = evidenceShows
                && (/^(update|verify|replace|add|review|attach|remove|use|regenerate|upload|mark)\b/i.test(evidenceShows) || evidenceShows.startsWith('('))
              const showPair = declared && evidenceShows && !looksLikeInstruction
                && declared.toLowerCase() !== evidenceShows.toLowerCase()

              return (
                <article key={i} className={`fix-item is-${status}${c.severity === 'HIGH' || c.severity === 'CRITICAL' ? ' is-critical' : ''}`}>
                  <div className="fix-item-head">
                    <span className="fix-item-field">{c.displayField || c.label || c.field.replace(/_/g, ' ')}</span>
                    {isAccepted && <span className="fix-item-state is-accepted"><CheckCircle size={13} /> Applied</span>}
                    {isIgnored && <span className="fix-item-state is-ignored"><XCircle size={13} /> Kept your value</span>}
                    {!isAccepted && !isIgnored && (c.severity === 'HIGH' || c.severity === 'CRITICAL')
                      ? <span className="fix-item-state is-blocker">Blocks publishing</span> : null}
                  </div>
                  {showPair && (
                    <div className="fix-item-pair">
                      <div className="fix-item-value is-declared">
                        <span>Your listing says</span>
                        <strong>{declared}</strong>
                      </div>
                      <ArrowRight size={16} className="fix-item-arrow" />
                      <div className="fix-item-value is-evidence">
                        <span>Evidence shows</span>
                        <strong>{evidenceShows}</strong>
                      </div>
                    </div>
                  )}
                  <p className="fix-item-why"><b>Why it matters:</b> {copy.issue}</p>
                  <p className="fix-item-how"><b>How to fix it:</b> {copy.action}</p>
                  {status === 'pending' && c.action === 'attach_evidence' && (
                    <span className="anchor-copilot-proof">Proof required — attach a document or remove the claim</span>
                  )}
                  {status === 'pending' && c.action !== 'attach_evidence' && (
                    <div className="fix-item-actions">
                      <button className="btn btn-primary btn-sm" onClick={() => applyCorrection(c)}>
                        {c.claimKey === 'size_chart_physical_length' ? 'Mark for chart update' : c.action === 'review_catalog' ? 'Mark for catalog review' : 'Apply the fix'}
                      </button>
                      <button className="btn btn-outline btn-sm" onClick={() => {
                        setIgnoreConfirm(c)
                      }}>
                        Keep my value
                      </button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
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
              Catalog Model Candidate · 5 Angles
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
              Model size and height identify the selected render configuration; Anchor does not infer shopper fit from this image.
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
          {actualMode === 'generate' && aestheticSuggestions.length > 0 && (
            <div className="generation-discovery-tags">
              <div className="generation-discovery-tags-heading">
                <Tag size={15} />
                <div><strong>Discovery tags</strong><small>Style recommendations for search and discovery. They are not presented as verified product facts.</small></div>
              </div>
              <div className="generation-discovery-tag-list">
                {aestheticSuggestions.map((tag, index) => {
                  const key = tagKey(tag)
                  const label = typeof tag === 'object' ? tag.tag : tag
                  const accepted = Boolean(tagApprovals[key])
                  return (
                    <button
                      key={`${key}-${index}`}
                      type="button"
                      className={`generation-discovery-tag${accepted ? ' is-added' : ''}`}
                      onClick={() => decideAestheticTag(tag, accepted ? 'reject' : 'accept')}
                    >
                      {accepted ? <CheckCircle size={13} /> : <Plus size={13} />} {String(label).startsWith('#') ? label : `#${label}`}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            <label className="form-label">Editable product & discovery tags</label>
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

      {generatedMetadata && actualMode !== 'generate' && (
        <div className="card">
          <div className="card-title">Listing Metadata / Details</div>
          <div className="card-desc" style={{ marginBottom: 16 }}>Review imported catalog copy before publishing. The evidence matrix above shows what Anchor can independently support.</div>
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

      {false && generatedMetadata && (() => {
        const verification = generatedMetadata.verification || {}
        return (
          <div className="card" style={{ borderLeft: '4px solid var(--success)' }}>
            <div className="card-title">Catalog Candidate Status</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 14 }}>
              <div style={{ padding: 14, borderRadius: 9, background: 'var(--success-bg)' }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Candidate status</div>
                <div style={{ color: 'var(--success)', fontWeight: 800, marginTop: 5 }}>{verification.match_status || 'Candidate available'}</div>
              </div>
              <div style={{ padding: 14, borderRadius: 9, background: 'var(--bg-page)', gridColumn: 'span 2' }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}>Evidence scope</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 5 }}>{verification.evidence_scope || 'See the evidence matrix for the publish decision.'}</div>
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

      {v.fusionResult && (
        <section className="bayesian-confidence-card">
          <div className="bayesian-confidence-heading">
            <div>
              <span className="section-kicker">How the score was computed</span>
              <h2>{Number(v.fusionResult.probability).toFixed(1)}% — measured, not guessed</h2>
              <p>Each independent check nudges the score up or down from an even starting point. Every nudge below is inspectable.</p>
            </div>
            <span className={`badge ${Number(v.fusionResult.probability) >= 75 ? 'badge-pass' : 'badge-warn'}`}>Live measurement</span>
          </div>
          <div className="bayesian-confidence-breakdown">
            <div><span>Base likelihood</span><strong>{(Number(v.fusionResult.breakdown?.prior || 0) * 100).toFixed(0)}%</strong></div>
            {/* A missing signal has a null likelihood ratio. Rendering that as
                "0.00" read as overwhelming evidence AGAINST a match, which is
                the opposite of "we did not observe this". */}
            <div><span>Identity</span><strong>{formatLikelihoodRatio(v.fusionResult.breakdown?.lr_identity ?? v.fusionResult.breakdown?.lr_clip, 'Embed')}</strong></div>
            {v.fusionResult.breakdown?.lr_color !== undefined && (
              <div><span>Colour ΔE2000</span><strong>{formatLikelihoodRatio(v.fusionResult.breakdown?.lr_color, 'Colour')}</strong></div>
            )}
            {v.fusionResult.breakdown?.lr_print !== undefined && (
              <div><span>Print geometry</span><strong>{formatLikelihoodRatio(v.fusionResult.breakdown?.lr_print, 'FFT')}</strong></div>
            )}
            <div><span>View consistency</span><strong>{formatLikelihoodRatio(v.fusionResult.breakdown?.lr_phash, 'pHash')}</strong></div>
            <div><span>Claim consistency</span><strong>{formatLikelihoodRatio(v.fusionResult.breakdown?.lr_attributes, 'Attribute')}</strong></div>
          </div>
          {v.fusionResult.confidence_tier === 'partial' && (
            <p className="bayesian-confidence-note">
              Partial confidence: this score used {(v.fusionResult.signals_used || []).length} of{' '}
              {(v.fusionResult.signals_used || []).length + (v.fusionResult.signals_missing || []).length} evidence signals.
              Unavailable: {(v.fusionResult.signals_missing || []).join(', ') || 'none'}.
            </p>
          )}
          {v.fusionResultStale && (
            <p className="bayesian-confidence-note">
              Claims have been edited since this score was computed. Run Re-check to recompute it against the evidence.
            </p>
          )}
        </section>
      )}

      {/* Catalog image strip (verify mode only) */}
      {catalogPreviews.length > 0 && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div>
              <div className="card-title" style={{ marginBottom: 2 }}>Catalog evidence under verification</div>
              {hasEvidenceProfile && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Previewed from the exact CSV URL set; the original seller URLs remain bound to this evidence record.</div>}
            </div>
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
          {actualMode !== 'generate' && (
            <div className="comparison-view-selector" aria-label="Catalog and anchor comparison views">
              <div><strong>Compare a matched view</strong><span>{activeCatalogMapping.note}</span></div>
              <div className="comparison-view-tabs">
                {catalogPreviews.map((_, index) => (
                  <button key={index} type="button" className={selectedCat === index ? 'is-active' : ''} onClick={() => setSelectedCat(index)}>
                    {catalogAnchorMappings[index]?.label || `View ${index + 1}`}
                  </button>
                ))}
              </div>
            </div>
          )}
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
                Model: {safeVal(confirmedAttrs?.model_size, 'Not provided')} · {safeVal(confirmedAttrs?.model_height, 'Height not provided')}{profileId !== 'kurti' && <> · {safeVal(confirmedAttrs?.model_build, 'Build not provided')}</>}
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
          <div className="img-card-label">{actualMode === 'generate' ? 'Anchor (real product)' : activeCatalogMapping.anchorLabel}</div>
          {(actualMode === 'generate' ? anchorFront : activeCatalogMapping.anchor)?.preview ? (
            <img src={(actualMode === 'generate' ? anchorFront : activeCatalogMapping.anchor).preview} alt="Physical garment anchor" style={{ aspectRatio: '3/4', objectFit: 'cover', maxHeight: 360 }} />
          ) : (
            <div className="img-placeholder">Anchor photo unavailable</div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="img-card-label">
            {actualMode === 'generate' ? 'Anchor (back view)' : `Catalog ${activeCatalogMapping.label}`}
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

      {/* Superseded by the seller-friendly Bayesian confidence card above. */}
      {false && v.fusionResult && (
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

      {/* Live comparison table — general uploads get the same three-source
          reading and the same focus toggle the fixture matrix has. */}
      {!hasEvidenceProfile && actualMode !== 'generate' && rows.length > 0 && (() => {
        const isIssueRow = r => r.status === 'mismatch' || r.status === 'warning' || r.status === 'skip'
        const issueRows = rows.filter(isIssueRow)
        const visibleRows = showOnlyIssues ? issueRows : rows
        return <div id="verification-findings" className="card verify-findings">
        <div className="verify-findings-head">
          <div>
            <div className="card-title" style={{ marginBottom: 2 }}>What Anchor compared</div>
            <p className="verify-findings-sub">{rows.length} attributes read from your anchors, catalog images and declared values. Click a row for the reasoning.</p>
          </div>
          <button type="button" className={`anchor-focus-toggle ${showOnlyIssues ? 'is-active' : ''}`} aria-pressed={showOnlyIssues} onClick={() => setShowOnlyIssues(value => !value)}>
            <span className="anchor-focus-toggle-knob" aria-hidden="true" />
            <span><strong>Focus on issues</strong><small>{showOnlyIssues ? `Showing ${issueRows.length} issue${issueRows.length === 1 ? '' : 's'}` : 'Showing everything'}</small></span>
          </button>
        </div>
        {showOnlyIssues && issueRows.length === 0 ? (
          <div className="anchor-evidence-all-clear"><CheckCircle size={28} /><div><strong>No issues found</strong><p>Every compared attribute is consistent. Switch off Focus on issues to see the full comparison.</p></div><button type="button" className="btn btn-outline btn-sm" onClick={() => setShowOnlyIssues(false)}>View everything</button></div>
        ) : (
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
            {visibleRows.map((r, i) => (
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
                    <td colSpan={5} className="verify-findings-note">
                      <Eye size={13} style={{ verticalAlign: -2, marginRight: 5 }} />
                      {r.note}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        )}
      </div>})()}

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

      {/* Raw signal detail — one quiet drawer instead of a stack of jargon
          cards. The verdict and fix list above already say what matters; this
          exists for the reviewer who wants to see the instruments. */}
      {(fabricResult || phashResult || (channelReport && channelReport.length > 0)) && actualMode !== 'generate' && (
        <details className="card verify-tech">
          <summary>
            <ShieldCheck size={17} />
            <span><strong>Measurement detail</strong><small>The raw signals behind the score — for reviewers, not required reading</small></span>
          </summary>
          <div className="verify-tech-body">
            {channelReport && channelReport.length > 0 && (
              <div className="verify-tech-row">
                <span className="verify-tech-label">Channels</span>
                <div className="verify-tech-chips">
                  {channelReport.map(c => (
                    <span key={c.channel} className={`verify-tech-chip is-${c.status}`}>
                      {c.channel.replace(/_/g, ' ')}
                      {c.status === 'measured' ? ` · LR ${Number(c.lr).toFixed(2)}` : ` · ${c.status.replace(/_/g, ' ')}`}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {fabricResult && (
              <div className="verify-tech-row">
                <span className="verify-tech-label">Fabric (CLIP)</span>
                <p className={fabricResult.fabric_matches_anchor === false ? 'is-bad' : 'is-good'}>
                  {fabricResult.similarity_score !== undefined && <b>{(fabricResult.similarity_score * 100).toFixed(1)}% similarity · </b>}
                  {fabricResult.fabric_matches_anchor === false
                    ? (fabricResult.issue || 'Fabric appearance differs between anchor and catalog.')
                    : 'Fabric appearance is consistent between anchor and catalog.'}
                </p>
              </div>
            )}
            {phashResult && (
              <div className="verify-tech-row">
                <span className="verify-tech-label">Structure (pHash)</span>
                <p>
                  <b>Distance {phashResult.phash_distance} · </b>
                  {phashResult.is_match
                    ? 'Images are near-identical at the pixel level.'
                    : 'Images differ at the pixel level — normal for different photo angles.'}
                </p>
              </div>
            )}
          </div>
        </details>
      )}

      {/* ─── EVIDENCE MATRIX (moved to bottom for clarity) ─── */}
      {profileId && evidenceClaims.length > 0 && (
        <section className="anchor-evidence-workspace" style={{ marginTop: 24 }}>
          <div className="anchor-evidence-card anchor-evidence-matrix-card">
            <div className="anchor-evidence-matrix-head">
              <div>
                <div className="anchor-evidence-card-title"><Package size={20} /> Evidence record</div>
                <p className="anchor-evidence-copy">Full three-lens comparison. Rows with issues are highlighted — everything else passed.</p>
              </div>
              <div className="anchor-evidence-head-actions">
                <button type="button" className={`anchor-focus-toggle ${showOnlyIssues ? 'is-active' : ''}`} aria-pressed={showOnlyIssues} onClick={() => setShowOnlyIssues(value => !value)}>
                  <span className="anchor-focus-toggle-knob" aria-hidden="true" />
                  <span><strong>Focus on issues</strong><small>{showOnlyIssues ? 'Showing fixes only' : 'Showing full record'}</small></span>
                </button>
                <span className="anchor-evidence-click-hint">Click a row for details</span>
              </div>
            </div>
            <div className="anchor-evidence-source-key">
              <span><i className="seller" /> Listing value</span>
              <span><i className="catalog" /> Catalog reading</span>
              <span><i className="anchor" /> Physical anchor</span>
            </div>
            {(() => {
              const matrixEvidenceClaims = evidenceClaims.filter(claim =>
                claim.key !== 'catalog_visual_match' && !(profileId === 'kurti' && claim.key === 'model_build')
              )
              const issueClaims = matrixEvidenceClaims.filter(claim => ['mismatch', 'needs_review', 'evidence_required'].includes(claim.verdict))
              if (showOnlyIssues && !issueClaims.length) {
                return <div className="anchor-evidence-all-clear"><CheckCircle size={28} /><div><strong>No action needed</strong><p>Every supported comparison passed. Switch off Focus on issues whenever you want the complete evidence record.</p></div><button type="button" className="btn btn-outline btn-sm" onClick={() => setShowOnlyIssues(false)}>View full record</button></div>
              }
              return <div className="anchor-evidence-table-wrap">
            <table className="anchor-evidence-table">
              <thead>
                <tr>
                  <th>Attribute</th>
                  <th>Listing value</th>
                  <th>Catalog-image evidence</th>
                  <th>Anchor-image evidence</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const matrixClaims = matrixEvidenceClaims.filter(claim => !showOnlyIssues || ['mismatch', 'needs_review', 'evidence_required'].includes(claim.verdict))
                  return matrixClaims.map((claim, index) => {
                  const matrixKey = `matrix-${claim.key}-${index}`
                  const catalogEvidence = catalogEvidenceForClaim(claim, catalogPreviews, catalogEvidenceDiagnostics)
                  const anchorEvidence = anchorEvidenceForClaim(claim)
                  const anchorEvidenceStatus = typeof claim.anchorEvidence === 'object'
                    ? claim.anchorEvidence?.status
                    : ''
                  const sources = sourceLabelsForClaim(claim)
                  const sellerValue = typeof claim.sellerDeclared === 'object'
                    ? claim.sellerDeclared?.value
                    : (claim.sellerDeclared || claim.sellerValue || 'Not declared')
                  const isIssue = ['mismatch', 'needs_review', 'evidence_required'].includes(claim.verdict)
                  const isModelDisclosure = ['model_size', 'model_height'].includes(claim.key)
                  return (
                    <React.Fragment key={matrixKey}>
                      <tr className={`anchor-evidence-row is-${claim.verdict}${isIssue ? ' is-highlighted-issue' : ''}`} onClick={() => setExpandedRow(expandedRow === matrixKey ? null : matrixKey)}>
                        <td><strong>{claim.label}</strong><small>{claim.severity === 'HIGH' ? 'Publishing blocker' : 'Review'}</small></td>
                        <td><span className="anchor-evidence-value seller">{sellerValue}</span></td>
                        <td><span className={`anchor-evidence-value catalog is-${catalogEvidence.status}`}>{catalogEvidence.status === 'provided' ? 'Catalog views attached' : catalogEvidence.value}</span></td>
                        <td>
                          <span className={'anchor-evidence-value anchor' + (anchorEvidenceStatus ? ' is-' + anchorEvidenceStatus : '')}>{anchorEvidence || 'No anchor observation'}</span>
                          {expandedRow === matrixKey && !isModelDisclosure && sources.length > 0 && <div className="anchor-evidence-source-chips">{sources.map(source => <span key={source}>{source}</span>)}</div>}
                        </td>
                        <td><span className={`anchor-evidence-verdict is-${claim.verdict}`}>{String(claim.verdict || 'unverified').replace(/_/g, ' ')}</span></td>
                      </tr>
                      {expandedRow === matrixKey && (
                        <tr className="anchor-evidence-rationale-row">
                          <td colSpan={5}>
                            <div className="anchor-evidence-rationale"><AlertTriangle size={16} /><div><strong>Why Anchor made this decision</strong><p>{claim.verdictExplanation || claim.explanation || 'No detailed explanation was returned.'}</p>{claim.explanation && claim.verdictExplanation && <p>{claim.explanation}</p>}</div></div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                  })
                })()}
              </tbody>
            </table>
          </div>
            })()}
          </div>

          {actualMode !== 'generate' && (evidenceTags || aestheticSuggestions.length > 0) && (
            <div className="anchor-evidence-card anchor-tag-card">
              <div className="anchor-evidence-matrix-head">
                <div>
                  <div className="anchor-evidence-card-title"><Tag size={20} /> Discovery tags with evidence boundaries</div>
                  <p className="anchor-evidence-copy">Verified descriptors describe the product. Style tags are optional, searchable discovery cues.</p>
                </div>
              </div>

              <div className="anchor-tag-tier anchor-tag-tier--verified">
                <div className="anchor-tag-tier-heading"><span>1</span><div><strong>Verified descriptors</strong><small>Only shown when the anchor evidence supports the attribute.</small></div></div>
                <div className="anchor-tag-list">
                  {(evidenceTags?.verifiedDescriptors || []).map((tag, index) => (
                    <span className="anchor-tag-chip is-verified" key={`${tag.tag}-${index}`}><CheckCircle size={13} /> {tag.tag}</span>
                  ))}
                  {!(evidenceTags?.verifiedDescriptors || []).length && <span className="anchor-tag-empty">No product descriptors are independently supported yet.</span>}
                </div>
              </div>

              <div className="anchor-tag-tier anchor-tag-tier--aesthetic">
                <div className="anchor-tag-tier-heading"><span>2</span><div><strong>Gen-Z style discovery</strong><small>Explainable vibe tags such as Indian casual, Desi-core, streetwear, or cottagecore.</small></div></div>
                <div className="anchor-tag-suggestions">
                  {aestheticSuggestions.length ? aestheticSuggestions.map((tag, index) => {
                    const key = tagKey(tag)
                    const accepted = Boolean(tagApprovals[key])
                    const rejected = Boolean(tagRejections[key])
                    const label = typeof tag === 'object' ? tag.tag : tag
                    return (
                      <article className={`anchor-style-suggestion${accepted ? ' is-accepted' : ''}${rejected ? ' is-rejected' : ''}`} key={`${key}-${index}`}>
                        <div>
                          <strong>{String(label).startsWith('#') ? label : `#${label}`}</strong>
                          <p>{tag.explanation || 'Suggested from the verified visual attributes above.'}</p>
                        </div>
                        <div className="anchor-style-actions">
                          {accepted ? <span className="anchor-tag-decision is-accepted"><CheckCircle size={13} /> Added to listing</span>
                            : rejected ? <span className="anchor-tag-decision is-rejected">Not added</span>
                            : <>
                              <button type="button" className="btn btn-outline btn-sm" onClick={() => decideAestheticTag(tag, 'reject')}>Skip</button>
                              <button type="button" className="btn btn-primary btn-sm" onClick={() => decideAestheticTag(tag, 'accept')}>Add tag</button>
                            </>}
                        </div>
                      </article>
                    )
                  }) : <span className="anchor-tag-empty">No style tag is suggested until Anchor has enough verified attributes.</span>}
                </div>
              </div>

              <div className="anchor-tag-tier anchor-tag-tier--seasonal">
                <div className="anchor-tag-tier-heading"><span>3</span><div><strong>Seasonal recommendations</strong><small>Optional styling contexts, never presented as verified facts or live trend data.</small></div></div>
                <div className="anchor-tag-list">
                  {(evidenceTags?.seasonalSuggestions || []).map((tag, index) => <span className="anchor-tag-chip is-seasonal" key={`${tag.tag}-${index}`}>{tag.tag}</span>)}
                  {!(evidenceTags?.seasonalSuggestions || []).length && <span className="anchor-tag-empty">No seasonal recommendation for the supported attributes.</span>}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Action bar */}
      <div className="action-bar mt-20" style={{ marginBottom: 20 }}>
        <>
          <div className={publishGate.blocked ? 'publish-readiness is-blocked' : 'publish-readiness'}>
            <strong>{publishGate.blocked ? 'Not ready to publish' : 'Ready to publish'}</strong>
            <span>
              {publishGate.blocked
                ? `Resolve the ${failCount > 0 ? `${failCount} blocking issue${failCount === 1 ? '' : 's'}` : 'blocking issues'} in the fix list to unlock publishing.`
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
                  const targetId = correctionsToShow.length ? 'ai-correction-copilot' : 'verification-findings'
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
