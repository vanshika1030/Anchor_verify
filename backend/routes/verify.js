import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'
import sharp from 'sharp'
import {
  extractAnchorAttributes,
  extractCatalogAttributes,
  compareAttributesDeterministic,
  generateVerdict,
  checkModelProportions,
  generateListingMetadata,
  generateCatalogImage,
  generateCorrections,
  runClipSimilarity,
  runPhashSimilarity,
  enhanceMetadataWithVision
} from '../services/gemini.js'
import { calculateBayesianFusion } from '../services/fusion.js'
import { getDemoCachedResult } from '../demo_registry.js'

const router = Router()
const uploadsRoot = path.resolve(process.cwd(), 'uploads')
const remoteVerificationDir = path.join(uploadsRoot, 'verification-remote')
if (!fs.existsSync(remoteVerificationDir)) fs.mkdirSync(remoteVerificationDir, { recursive: true })

const attributeValue = value => (
  value && typeof value === 'object' && 'value' in value ? value.value : value
)

const COLOR_HUES = {
  red: 0, maroon: 350, orange: 28, yellow: 55, green: 120,
  teal: 175, blue: 210, navy: 225, purple: 275, pink: 335,
}

function rgbToHsv(r, g, b) {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const delta = max - min
  let hue = 0
  if (delta) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6)
    else if (max === green) hue = 60 * (((blue - red) / delta) + 2)
    else hue = 60 * (((red - green) / delta) + 4)
  }
  if (hue < 0) hue += 360
  return { hue, saturation: max ? delta / max : 0, value: max }
}

export async function analyzeCatalogGeometry(imagePath, declaredColor = '') {
  try {
    const { data, info } = await sharp(imagePath)
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })
    const { width, height, channels } = info
    if (!width || !height || channels < 3) return null

    const sampleSize = Math.max(4, Math.round(Math.min(width, height) * 0.025))
    const cornerOrigins = [
      [0, 0], [width - sampleSize, 0],
      [0, height - sampleSize], [width - sampleSize, height - sampleSize],
    ]
    let bgR = 0
    let bgG = 0
    let bgB = 0
    let bgCount = 0
    for (const [originX, originY] of cornerOrigins) {
      for (let y = originY; y < originY + sampleSize; y += 2) {
        for (let x = originX; x < originX + sampleSize; x += 2) {
          const index = (y * width + x) * channels
          bgR += data[index]
          bgG += data[index + 1]
          bgB += data[index + 2]
          bgCount++
        }
      }
    }
    bgR /= bgCount
    bgG /= bgCount
    bgB /= bgCount

    const normalizedColor = String(declaredColor || '').toLowerCase()
    const colorName = Object.keys(COLOR_HUES).find(name => normalizedColor.includes(name))
    const targetHue = colorName ? COLOR_HUES[colorName] : null
    const foregroundRows = new Array(height).fill(0)
    const garmentRows = new Array(height).fill(0)
    let textureSamples = 0
    let textureEdges = 0
    const startX = Math.round(width * 0.10)
    const endX = Math.round(width * 0.90)

    for (let y = 0; y < height; y += 2) {
      for (let x = startX; x < endX; x += 2) {
        const index = (y * width + x) * channels
        const r = data[index]
        const g = data[index + 1]
        const b = data[index + 2]
        const distance = Math.hypot(r - bgR, g - bgG, b - bgB)
        if (distance > 24) foregroundRows[y]++

        if (targetHue != null) {
          const hsv = rgbToHsv(r, g, b)
          const hueDistance = Math.min(
            Math.abs(hsv.hue - targetHue),
            360 - Math.abs(hsv.hue - targetHue)
          )
          if (hsv.saturation > 0.10 && hsv.value > 0.20 && hueDistance < 38) {
            garmentRows[y]++
            if (x + 2 < endX && y + 2 < height) {
              const rightIndex = index + (2 * channels)
              const belowIndex = index + (2 * width * channels)
              const brightness = (r + g + b) / 3
              const rightBrightness = (data[rightIndex] + data[rightIndex + 1] + data[rightIndex + 2]) / 3
              const belowBrightness = (data[belowIndex] + data[belowIndex + 1] + data[belowIndex + 2]) / 3
              textureSamples++
              if (Math.max(
                Math.abs(brightness - rightBrightness),
                Math.abs(brightness - belowBrightness)
              ) > 18) {
                textureEdges++
              }
            }
          }
        }
      }
    }

    const rowThreshold = Math.max(5, Math.round(width * 0.008))
    const garmentThreshold = Math.max(
      rowThreshold,
      Math.round(Math.max(...garmentRows) * 0.20)
    )
    const foregroundY = foregroundRows
      .map((count, y) => ({ count, y }))
      .filter(row => row.count >= rowThreshold)
      .map(row => row.y)
    const garmentY = garmentRows
      .map((count, y) => ({ count, y }))
      .filter(row => row.count >= garmentThreshold)
      .map(row => row.y)
    if (foregroundY.length < 10 || garmentY.length < 10) return null

    const bodyTop = Math.min(...foregroundY)
    const bodyBottom = Math.max(...foregroundY)
    const bodyHeight = Math.max(1, bodyBottom - bodyTop)
    const garmentTop = Math.min(...garmentY)
    const garmentBottom = Math.max(...garmentY)
    const normalizedHem = (garmentBottom - bodyTop) / bodyHeight

    let lengthCategory = 'Regular'
    if (normalizedHem <= 0.60) lengthCategory = 'Short'
    else if (normalizedHem <= 0.70) lengthCategory = 'Hip Length'
    else if (normalizedHem <= 0.78) lengthCategory = 'Knee Length'
    else if (normalizedHem <= 0.92) lengthCategory = 'Calf Length'
    else lengthCategory = 'Ankle Length'

    const torsoStart = Math.round(bodyTop + bodyHeight * 0.18)
    const torsoEnd = Math.round(bodyTop + bodyHeight * 0.52)
    const torsoWidths = foregroundRows
      .slice(torsoStart, torsoEnd)
      .filter(count => count >= rowThreshold)
      .sort((a, b) => a - b)
    const medianWidth = torsoWidths.length
      ? torsoWidths[Math.floor(torsoWidths.length / 2)] * 2
      : 0
    const buildRatio = medianWidth / bodyHeight
    const build = buildRatio > 0.34
      ? 'Plus size curvy build model'
      : buildRatio < 0.30
        ? 'Slim petite build model'
        : 'Average regular build model'

    return {
      length_category: lengthCategory,
      normalized_hem: Number(normalizedHem.toFixed(3)),
      model_build: build,
      build_ratio: Number(buildRatio.toFixed(3)),
      texture_density: textureSamples
        ? Number((textureEdges / textureSamples).toFixed(3))
        : null,
      source: 'Sharp-Geometry',
    }
  } catch (error) {
    console.warn('[GEOMETRY] Catalog geometry analysis failed:', error.message)
    return null
  }
}

async function materializeCatalogReferences(references = []) {
  const diagnostics = []
  const paths = []

  for (const reference of references) {
    const value = String(reference || '').trim()
    if (!value) continue

    try {
      const parsed = new URL(value)
      if (['localhost', '127.0.0.1'].includes(parsed.hostname) && parsed.pathname.startsWith('/uploads/')) {
        const localPath = path.resolve(process.cwd(), parsed.pathname.replace(/^\/+/, ''))
        if (!localPath.startsWith(uploadsRoot) || !fs.existsSync(localPath)) {
          throw new Error('Local catalog asset is missing')
        }
        paths.push(localPath)
        diagnostics.push({ source: value, status: 'ready', path: localPath })
        continue
      }

      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Unsupported URL protocol')
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)
      try {
        const response = await fetch(parsed, {
          redirect: 'follow',
          signal: controller.signal,
          headers: { 'User-Agent': 'Anchor-Verification/1.0' },
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const contentType = response.headers.get('content-type') || ''
        if (!contentType.toLowerCase().startsWith('image/')) throw new Error('URL did not return an image')
        const buffer = Buffer.from(await response.arrayBuffer())
        if (!buffer.length || buffer.length > 15 * 1024 * 1024) throw new Error('Invalid image size')
        const extension = contentType.includes('png') ? '.png' : contentType.includes('webp') ? '.webp' : '.jpg'
        const filename = `${crypto.createHash('sha256').update(value).digest('hex').slice(0, 18)}${extension}`
        const localPath = path.join(remoteVerificationDir, filename)
        fs.writeFileSync(localPath, buffer)
        paths.push(localPath)
        diagnostics.push({ source: value, status: 'ready', path: localPath })
      } finally {
        clearTimeout(timeoutId)
      }
    } catch (error) {
      // Relative paths are accepted only when they resolve to an existing file
      // inside this project. A URL failure is reported as unavailable evidence.
      const localPath = path.resolve(process.cwd(), value)
      if (!/^https?:\/\//i.test(value) && fs.existsSync(localPath)) {
        paths.push(localPath)
        diagnostics.push({ source: value, status: 'ready', path: localPath })
      } else {
        diagnostics.push({ source: value, status: 'unavailable', error: error.message })
      }
    }
  }

  return { paths, diagnostics }
}

function buildSuggestionAgent(comparison, modelIssues, corrections, verdict) {
  const actions = []
  const evidenceOnlyFields = new Set([
    'catalog_size_chart_fit',
    'catalog_view_coverage',
    'back_print_preservation',
    'model_build_declared',
  ])
  for (const correction of corrections || []) {
    if (evidenceOnlyFields.has(correction.field) || String(correction.field).includes('model_build')) continue
    if (
      String(correction.current_value || '').trim().toLowerCase() ===
      String(correction.suggested_value || '').trim().toLowerCase()
    ) continue
    actions.push({
      field: correction.field,
      priority: correction.severity || 'MEDIUM',
      current_value: correction.current_value,
      suggested_value: correction.suggested_value,
      reason: correction.reason || correction.note || 'Align this field with the visual evidence.',
      consumer_impact: 'Prevents shoppers from receiving a misleading product expectation.',
    })
  }
  for (const issue of modelIssues || []) {
    if (actions.some(action => action.field === issue.attr)) continue
    const normalizedField = String(issue.attr || '').toLowerCase()
    let suggestedValue = issue.declared
    if (normalizedField.includes('catalog garment length')) {
      suggestedValue = `Replace or regenerate the catalog views so the garment visibly keeps the seller's ${issue.declared} length.`
    } else if (normalizedField.includes('model body build')) {
      suggestedValue = `Use a catalog model with the declared ${issue.declared} body build.`
    } else if (normalizedField.includes('model build vs size')) {
      suggestedValue = `Use a model whose visible proportions credibly represent size ${issue.declared}.`
    } else if (normalizedField.includes('size chart')) {
      suggestedValue = `Regenerate imagery to match ${issue.declared}.`
    } else if (normalizedField.includes('back print')) {
      suggestedValue = 'Replace the back view with one that preserves the anchor print placement and coverage.'
    } else if (normalizedField.includes('visual model')) {
      suggestedValue = 'Review the remaining local evidence and retry the global similarity check when available.'
    }
    actions.push({
      field: issue.attr,
      priority: issue.severity || 'MEDIUM',
      current_value: issue.detected,
      suggested_value: suggestedValue,
      reason: issue.note,
      consumer_impact: normalizedField.includes('size') || normalizedField.includes('fit')
        ? 'Reduces size and fit confusion before purchase.'
        : 'Keeps catalog imagery and product claims consistent.',
    })
  }

  return {
    name: 'Anchor Consistency Copilot',
    status: actions.length ? 'review-recommended' : 'consistent',
    summary: actions.length
      ? `${actions.length} evidence-backed improvement${actions.length === 1 ? '' : 's'} can make this listing more reliable for shoppers.`
      : 'Seller metadata, anchor evidence, and catalog imagery are mutually consistent.',
    publish_readiness: verdict?.status || 'UNVERIFIED',
    actions,
  }
}

/**
 * POST /api/verify — unified verification pipeline
 *
 * Hierarchical Architecture (5 Layers):
 *   Layer 1: CLIP + pHash visual gate (local, free)
 *   Layer 2: Local attribute extraction via ViT + CLIP zero-shot (local, free)
 *   Layer 2.5: Cross-verification of seller edits via CLIP binary (local, free)
 *   Layer 3: Deterministic comparison with synonym maps (pure code)
 *   Layer 3.5: Fabric verification via CLIP closeup comparison (local, free)
 *   Layer 3.6: Body proportion checking via CLIP + segmentation (local, free)
 *   Layer 3.7: CV length cross-validation anchor vs catalog (pure math)
 *   Layer 4: Bayesian mathematical fusion (pure math)
 *   Layer 5: Optional text-only LLM for listing generation (Groq/Gemini)
 *
 * ZERO paid API calls in verify mode.
 */
router.post('/', async (req, res) => {
  try {
    const { declaredAttrs, anchorExtracted, mode } = req.body

    const parsedDeclared = typeof declaredAttrs === 'string' ? JSON.parse(declaredAttrs) : (declaredAttrs || {})
    const parsedAnchor = typeof anchorExtracted === 'string' ? JSON.parse(anchorExtracted) : (anchorExtracted || {})

    const anchorFiles = (req.files || []).filter(f => f.fieldname === 'anchorImages')
    const catalogFiles = (req.files || []).filter(f => f.fieldname === 'catalogImages')
    const anchorPaths = anchorFiles.map(f => f.path)
    let catalogPaths = catalogFiles.map(f => f.path)
    let catalogEvidenceDiagnostics = catalogFiles.map(file => ({
      source: file.originalname,
      status: 'ready',
      path: file.path,
    }))

    if (catalogPaths.length === 0 && req.body.catalogPaths) {
      const parsedPaths = typeof req.body.catalogPaths === 'string' ? JSON.parse(req.body.catalogPaths) : req.body.catalogPaths
      const materialized = await materializeCatalogReferences(parsedPaths)
      catalogPaths = materialized.paths
      catalogEvidenceDiagnostics = materialized.diagnostics
    }

    // ══════════════════════════════════════════════════════════════════
    // FAST PATH: Check demo registry first
    // ══════════════════════════════════════════════════════════════════
    // CSV verification must inspect the seller's current evidence. Cached results
    // remain available only for the intentional AI-generation demo.
    const allowDemoCache = mode === 'generate' || req.body.useDemoCache === 'true'
    const cachedResult = allowDemoCache
      ? getDemoCachedResult(parsedDeclared, mode, catalogPaths, anchorPaths)
      : null
    if (cachedResult) {
      console.log(`[FAST PATH] ✅ Serving cached demo result (skipping all 5 layers)`)
      return res.json({
        ...cachedResult,
        catalogEvidenceDiagnostics,
        suggestionAgent: cachedResult.suggestionAgent || buildSuggestionAgent(
          cachedResult.comparison || [],
          cachedResult.modelIssues || [],
          cachedResult.corrections || [],
          cachedResult.verdict || {}
        ),
      })
    }
    console.log(`[FAST PATH] Cache missed — running live 5-layer pipeline`)

    const isGenerateMode = mode === 'generate'
    
    if (!isGenerateMode && catalogPaths.length === 0) {
      return res.status(400).json({ success: false, error: "Please upload catalog images to run verification." })
    }

    let catalogAttrs = {}
    let generatedMetadata = null
    let modelIssues = []

    // ══════════════════════════════════════════════════════════════════
    // LAYER 1: LOCAL VISUAL GATE (CLIP + pHash)
    // ══════════════════════════════════════════════════════════════════
    let clipResult = null
    let phashResult = null

    if (!isGenerateMode && anchorPaths.length > 0 && catalogPaths.length > 0) {
      console.log(`[LAYER 1] Visual gate: CLIP similarity + pHash structural match...`)
      
      const anchorPath = path.resolve(process.cwd(), anchorPaths[0])
      const catalogPath = path.resolve(process.cwd(), catalogPaths[0])

      const [clipRes, phashRes] = await Promise.all([
        runClipSimilarity(anchorPath, catalogPath),
        runPhashSimilarity(anchorPath, catalogPath),
      ])

      clipResult = clipRes
      phashResult = phashRes
      
      if (!clipResult && req.body.stopAtVisualGate === 'true') {
        console.warn(`[LAYER 1] CLIP gate failed to execute — returning UNVERIFIED`)
        return res.json({
          success: true,
          mode: 'verify',
          comparison: [],
          catalog_attributes: {},
          modelIssues: [],
          fabricResult: { fabric_matches_anchor: false, confidence: 0, issue: 'CLIP similarity check could not run. Visual gate unavailable.', source: 'CLIP' },
          phashResult: phashResult || null,
          fusionResult: null,
          verdict: { status: 'UNVERIFIED', reason: 'Visual similarity check failed to execute. Cannot verify.', critical_fails: 0, warnings: 1 },
          corrections: [],
          generatedMetadata: null
        })
      }

      if (!clipResult) {
        modelIssues.push({
          attr: 'Global visual model',
          declared: 'Anchor-to-catalog identity check',
          detected: 'Local CLIP service unavailable',
          confidence: 'LOW',
          severity: 'MEDIUM',
          note: 'Verification continued with image attribute extraction, angle coverage, seller metadata, and size-chart evidence.',
        })
        clipResult = { similarity_score: 0.50, unavailable: true }
      }

      if (clipResult.similarity_score < 0.50) {
        modelIssues.push({
          attr: 'Overall visual identity',
          declared: 'Same product as anchor',
          detected: `${(clipResult.similarity_score * 100).toFixed(1)}% visual similarity`,
          confidence: 'HIGH',
          severity: 'HIGH',
          note: 'The catalog image may not preserve the same garment shown in the anchor. Detailed checks below identify which claims or views need correction.',
        })
      }

      // Retained only as an opt-in compatibility switch. The normal verification
      // path continues after a low score so sellers can see the precise mismatches.
      if (clipResult.similarity_score < 0.50 && req.body.stopAtVisualGate === 'true') {
        console.log(`[LAYER 1] CLIP score critically low: ${(clipResult.similarity_score * 100).toFixed(1)}%. Hard fail.`)
        return res.json({
          success: true,
          mode: 'verify',
          comparison: [],
          catalog_attributes: {},
          modelIssues: [],
          fabricResult: {
            fabric_matches_anchor: false,
            confidence: 99,
            similarity_score: clipResult.similarity_score,
            issue: `These do not appear to be the same garment. Visual similarity is critically low (${(clipResult.similarity_score * 100).toFixed(1)}%).`,
            source: 'CLIP'
          },
          phashResult: phashResult || null,
          fusionResult: null,
          verdict: {
            status: 'FAIL',
            reason: 'Critical visual mismatch between anchor and catalog item.',
            critical_fails: 1,
            warnings: 0
          },
          corrections: [],
          generatedMetadata: null
        })
      }

      console.log(`[LAYER 1] ✅ CLIP gate passed: ${(clipResult.similarity_score * 100).toFixed(1)}% similarity`)
      if (phashResult && phashResult.is_match) {
        console.log(`[LAYER 1] ✅ pHash identical match (distance: ${phashResult.phash_distance})`)
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // LAYER 2: LOCAL ATTRIBUTE EXTRACTION (ViT + CLIP Zero-Shot)
    // No Gemini API calls. 100% local.
    // ══════════════════════════════════════════════════════════════════
    let aiAnchorAttrs = {}
    if (isGenerateMode) {
      // In Generate mode, parsedAnchor is actually the seller's manual inputs from the frontend.
      // We re-extract the actual AI truth to provide the Suggestion Copilot feedback!
      console.log(`[LAYER 2] Re-extracting anchor attributes locally for Suggestion Copilot...`)
      try {
        aiAnchorAttrs = await extractAnchorAttributes(anchorPaths)
      } catch (err) {
        console.error('[LAYER 2] Anchor extraction failed:', err.message)
      }
    } else if (catalogPaths.length > 0) {
      console.log(`[LAYER 2] Extracting catalog attributes locally (ViT + CLIP zero-shot)...`)
      try {
        catalogAttrs = await extractCatalogAttributes(catalogPaths, anchorPaths)
        console.log(`[LAYER 2] ✅ ${Object.keys(catalogAttrs).length} attributes extracted (0 API calls)`)
      } catch (err) {
        console.error('[LAYER 2] Catalog extraction failed:', err.message)
        catalogAttrs = {}
        modelIssues.push({ extractionFailed: true, reason: 'Local ML extraction failed.' })
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // LAYER 3: DETERMINISTIC COMPARISON (Synonym Matching)
    // In generate mode: compare AI-extracted vs seller-declared (parsedAnchor)
    // In verify mode: compare anchor-extracted vs catalog-extracted vs seller-declared
    // ══════════════════════════════════════════════════════════════════
    let catalogGeometry = null
    let anchorGeometry = null
    if (!isGenerateMode && catalogPaths[0]) {
      const declaredColor = attributeValue(parsedDeclared.primary_color) || attributeValue(parsedDeclared.brandColour)
      ;[anchorGeometry, catalogGeometry] = await Promise.all([
        anchorPaths[0] ? analyzeCatalogGeometry(anchorPaths[0], declaredColor) : Promise.resolve(null),
        analyzeCatalogGeometry(catalogPaths[0], declaredColor),
      ])
      if (anchorGeometry) {
        parsedAnchor.cv_overall_length ||= {
          value: anchorGeometry.length_category,
          confidence: 'MEDIUM',
          source: anchorGeometry.source,
        }
        parsedAnchor.overall_length ||= {
          value: anchorGeometry.length_category,
          confidence: 'MEDIUM',
          source: anchorGeometry.source,
        }
      }
      if (catalogGeometry) {
        catalogAttrs.cv_overall_length ||= {
          value: catalogGeometry.length_category,
          confidence: 'MEDIUM',
          source: catalogGeometry.source,
        }
        catalogAttrs.overall_length ||= {
          value: catalogGeometry.length_category,
          confidence: 'MEDIUM',
          source: catalogGeometry.source,
        }
        catalogAttrs.model_build ||= {
          value: catalogGeometry.model_build,
          confidence: 'MEDIUM',
          source: catalogGeometry.source,
        }
      }
    }

    console.log(`[LAYER 3] Deterministic comparison with synonym matching...`)
    
    const comparisonAnchor = isGenerateMode ? aiAnchorAttrs : parsedAnchor
    const comparisonCatalog = isGenerateMode ? aiAnchorAttrs : catalogAttrs
    // We treat the seller's manual inputs (parsedAnchor in generate mode) as the declared source!
    const comparisonDeclared = isGenerateMode ? parsedAnchor : parsedDeclared
    
    const comparison = compareAttributesDeterministic(
      comparisonAnchor,    // anchor attributes (actual AI extracted)
      comparisonCatalog,   // catalog attributes
      comparisonDeclared,  // seller declarations (manual inputs)
    )

    if (catalogGeometry && attributeValue(parsedDeclared.overall_length)) {
      const lengthFamily = value => {
        const normalized = String(value || '').toLowerCase()
        if (/(crop|short)/.test(normalized)) return 'short'
        if (/(hip|regular)/.test(normalized)) return 'regular'
        if (/(knee|calf|ankle|maxi|long)/.test(normalized)) return 'long'
        return normalized
      }
      const declaredLength = attributeValue(parsedDeclared.overall_length)
      if (lengthFamily(declaredLength) !== lengthFamily(catalogGeometry.length_category)) {
        const lengthRow = comparison.find(row => row.key === 'overall_length')
        if (lengthRow) {
          lengthRow.status = 'mismatch'
          lengthRow.severity = 'HIGH'
          lengthRow.note = `Catalog geometry places the hem at ${(catalogGeometry.normalized_hem * 100).toFixed(0)}% of visible body height, which reads as "${catalogGeometry.length_category}" rather than "${declaredLength}".`
          lengthRow.geometry_cross_validated = true
        }
        modelIssues.push({
          attr: 'Catalog garment length',
          declared: declaredLength,
          detected: catalogGeometry.length_category,
          confidence: 'MEDIUM',
          severity: 'HIGH',
          note: `The visible hem position contradicts the seller's "${declaredLength}" claim. Replace the generated catalog views or correct the listing before customers see it.`,
        })
      }
    }

    const readyCatalogViews = catalogEvidenceDiagnostics.filter(item => item.status === 'ready').length
    comparison.push({
      key: 'catalog_view_coverage',
      label: 'Catalog view coverage',
      anchor_value: anchorPaths.length ? `${anchorPaths.length} anchor view(s)` : 'No anchor views',
      catalog_value: `${readyCatalogViews} of 5 catalog views available`,
      declared_value: 'Front, Back, Side, Close-up, Full body',
      status: readyCatalogViews >= 5 ? 'match' : 'warning',
      severity: readyCatalogViews >= 5 ? 'LOW' : 'MEDIUM',
      note: readyCatalogViews >= 5
        ? 'All five required catalog views were loaded as verification evidence.'
        : 'Missing views reduce confidence and can hide print, construction, or fit inconsistencies.',
      source: 'CatalogEvidence',
    })
    if (readyCatalogViews < 5) {
      modelIssues.push({
        attr: 'Catalog view coverage',
        declared: '5 required views',
        detected: `${readyCatalogViews} usable view(s)`,
        confidence: 'HIGH',
        severity: 'MEDIUM',
        note: 'Provide Front, Back, Side, Close-up, and Full-body images before publishing.',
      })
    }

    // ── Layer 3.5: Fabric verification (CLIP closeup comparison) ─────
    let fabricResult = null
    if (!isGenerateMode && anchorPaths.length > 0 && catalogPaths.length > 0) {
      // Use closeup images if available (typically image 3 for anchor, image 4 for catalog)
      const anchorCloseup = anchorPaths.length >= 3 ? anchorPaths[2] : anchorPaths[0]
      const catalogCloseup = catalogPaths.length >= 4 ? catalogPaths[3] : catalogPaths[0]
      
      console.log(`[LAYER 3.5] Fabric verification: CLIP closeup comparison...`)
      const fabricClip = await runClipSimilarity(anchorCloseup, catalogCloseup)
      
      if (fabricClip) {
        const fabricMatches = fabricClip.similarity_score >= 0.55
        fabricResult = {
          fabric_matches_anchor: fabricMatches,
          confidence: 99,
          similarity_score: fabricClip.similarity_score,
          issue: !fabricMatches 
            ? `Fabric texture mismatch between anchor closeup and catalog (${(fabricClip.similarity_score * 100).toFixed(1)}% similarity). Please verify or provide a clearer fabric image.`
            : null,
          source: 'CLIP-Closeup',
          needs_fabric_image: fabricClip.similarity_score < 0.45, // Mandatory fabric image needed
        }
        
        if (!fabricMatches) {
          console.warn(`[LAYER 3.5] ⚠️ Fabric mismatch: ${(fabricClip.similarity_score * 100).toFixed(1)}% similarity`)
          modelIssues.push({
            attr: 'Fabric',
            declared: parsedDeclared.fabric_appearance || 'Not specified',
            detected: 'Fabric texture inconsistency',
            confidence: 'HIGH',
            severity: 'HIGH',
            note: fabricResult.issue
          })
        } else {
          console.log(`[LAYER 3.5] ✅ Fabric verified: ${(fabricClip.similarity_score * 100).toFixed(1)}% match`)
        }
      }
    }

    // If no fabric-specific check ran, use overall CLIP as fallback
    if (!fabricResult && clipResult && !clipResult.unavailable) {
      fabricResult = {
        fabric_matches_anchor: clipResult.similarity_score >= 0.70,
        confidence: 99,
        similarity_score: clipResult.similarity_score,
        issue: null,
        source: 'CLIP'
      }
    }

    // ── Layer 3.6: Body proportion checking (CLIP + Segmentation) ────
    // Check the corresponding back views independently. A good front-view score
    // must not hide a removed, shortened, or altered back print.
    const declaredPattern = String(attributeValue(parsedDeclared.pattern_type) || '').toLowerCase()
    if (!isGenerateMode && declaredPattern.includes('print') && anchorPaths[1] && catalogPaths[1]) {
      const backPrintClip = await runClipSimilarity(anchorPaths[1], catalogPaths[1])
      if (backPrintClip) {
        const backPrintMatches = backPrintClip.similarity_score >= 0.55
        comparison.push({
          key: 'back_print_preservation',
          label: 'Back print preservation',
          anchor_value: 'Printed back reference',
          catalog_value: backPrintMatches ? 'Back print visually preserved' : 'Back print differs or is missing',
          declared_value: attributeValue(parsedDeclared.pattern_type) || 'Printed',
          status: backPrintMatches ? 'match' : 'mismatch',
          severity: backPrintMatches ? 'LOW' : 'HIGH',
          note: backPrintMatches
            ? `Back-view similarity is ${(backPrintClip.similarity_score * 100).toFixed(1)}%.`
            : `Back-view similarity is only ${(backPrintClip.similarity_score * 100).toFixed(1)}%; print placement or coverage is not preserved.`,
          source: 'CLIP-BackView',
        })
        if (!backPrintMatches) {
          modelIssues.push({
            attr: 'Back print preservation',
            declared: attributeValue(parsedDeclared.pattern_type) || 'Printed',
            detected: 'Back print differs or is missing',
            confidence: 'HIGH',
            severity: 'HIGH',
            note: 'Regenerate or replace the back catalog image so the original print placement and coverage remain visible.',
          })
        }
      } else {
        const declaredColor = attributeValue(parsedDeclared.primary_color)
        const [anchorBackEvidence, catalogBackEvidence] = await Promise.all([
          analyzeCatalogGeometry(anchorPaths[1], declaredColor),
          analyzeCatalogGeometry(catalogPaths[1], declaredColor),
        ])
        if (anchorBackEvidence?.texture_density != null && catalogBackEvidence?.texture_density != null) {
          const anchorTexture = anchorBackEvidence.texture_density
          const catalogTexture = catalogBackEvidence.texture_density
          const coverageRatio = anchorTexture > 0 ? catalogTexture / anchorTexture : 1
          const backPrintMatches = coverageRatio >= 0.58
          comparison.push({
            key: 'back_print_preservation',
            label: 'Back print preservation',
            anchor_value: `Pattern density ${(anchorTexture * 100).toFixed(1)}%`,
            catalog_value: `Pattern density ${(catalogTexture * 100).toFixed(1)}%`,
            declared_value: attributeValue(parsedDeclared.pattern_type) || 'Printed',
            status: backPrintMatches ? 'match' : 'mismatch',
            severity: backPrintMatches ? 'LOW' : 'HIGH',
            note: backPrintMatches
              ? 'Back-view pattern coverage is retained according to local texture evidence.'
              : 'Catalog back-view texture coverage is substantially lower than the physical anchor, indicating a missing or simplified back print.',
            source: 'Sharp-BackTexture',
          })
          if (!backPrintMatches) {
            modelIssues.push({
              attr: 'Back print preservation',
              declared: 'Printed back matching the anchor',
              detected: `${Math.round((1 - coverageRatio) * 100)}% less visible pattern coverage`,
              confidence: 'MEDIUM',
              severity: 'HIGH',
              note: 'The local back-view texture check indicates that the original print coverage was not preserved.',
            })
          }
        }
      }
    }

    const modelHeight = parsedDeclared.model_height || ''
    const modelSize = parsedDeclared.model_size || ''
    
    // Existing deterministic proportion check
    if (!modelHeight || !modelSize) {
      console.log(`[LAYER 3.6] Missing model size/height. Failing verification.`)
      modelIssues.push({
        attr: 'Model Proportions',
        declared: 'Not provided',
        detected: 'N/A',
        confidence: 'HIGH',
        severity: 'HIGH',
        note: 'Model height and size must be provided to verify proportions and fit. Please update your listing details.'
      })
    } else {
      const proportionIssues = checkModelProportions(catalogAttrs, modelHeight, modelSize)
      modelIssues.push(...proportionIssues)
    }

    // NEW: Check catalog CLIP-detected body proportions against seller's declaration
    if (catalogAttrs.model_build && modelSize) {
      const detectedBuild = catalogAttrs.model_build.value || ''
      const declaredSize = modelSize.toUpperCase().replace(/[^A-Z]/g, '')
      
      const sizeToExpectedBuild = {
        'XS': ['Slim petite build model'],
        'S': ['Slim petite build model', 'Average regular build model'],
        'M': ['Average regular build model'],
        'L': ['Average regular build model', 'Plus size curvy build model'],
        'XL': ['Plus size curvy build model'],
        'XXL': ['Plus size curvy build model'],
      }
      
      const expectedBuilds = sizeToExpectedBuild[declaredSize] || []
      if (expectedBuilds.length > 0 && !expectedBuilds.includes(detectedBuild)) {
        console.log(`[LAYER 3.6] Body proportion mismatch: model looks "${detectedBuild}" but seller declared size "${declaredSize}"`)
        modelIssues.push({
          attr: 'Model build vs size',
          declared: modelSize,
          detected: detectedBuild,
          confidence: catalogAttrs.model_build.confidence || 'MEDIUM',
          severity: 'MEDIUM',
          note: `Catalog model appears to have "${detectedBuild}" build but declared size is "${modelSize}". This may mislead buyers about fit.`
        })
      }
    }

    // ── Layer 3.7: CV length cross-validation (anchor vs catalog) ────
    const declaredBuild = String(attributeValue(parsedDeclared.model_build) || '').trim()
    const detectedBuild = String(attributeValue(catalogAttrs.model_build) || '').trim()
    if (declaredBuild && detectedBuild) {
      const buildFamily = value => {
        const normalized = value.toLowerCase()
        if (/(plus|curvy|full)/.test(normalized)) return 'curvy'
        if (/(slim|petite|lean)/.test(normalized)) return 'slim'
        if (/(average|regular|medium)/.test(normalized)) return 'average'
        return normalized
      }
      const buildMatches = buildFamily(declaredBuild) === buildFamily(detectedBuild)
      comparison.push({
        key: 'model_build_declared',
        label: 'Model body build',
        anchor_value: declaredBuild,
        catalog_value: detectedBuild,
        declared_value: declaredBuild,
        status: buildMatches ? 'match' : 'mismatch',
        severity: buildMatches ? 'LOW' : 'HIGH',
        note: buildMatches
          ? 'The catalog model body type aligns with the seller declaration.'
          : `Seller declared "${declaredBuild}", but the catalog model appears "${detectedBuild}". This changes how shoppers perceive fit.`,
        source: 'CLIP-BodyBuild',
      })
      if (!buildMatches) {
        modelIssues.push({
          attr: 'Model body build',
          declared: declaredBuild,
          detected: detectedBuild,
          confidence: catalogAttrs.model_build?.confidence || 'MEDIUM',
          severity: 'HIGH',
          note: 'Use a model whose visible body build matches the seller metadata, or correct the declared model build.',
        })
      }
    }

    if (!isGenerateMode && parsedAnchor.cv_overall_length && catalogAttrs.cv_overall_length) {
      const anchorLen = parsedAnchor.cv_overall_length.value
      const catalogLen = catalogAttrs.cv_overall_length.value
      
      if (anchorLen && catalogLen && anchorLen !== catalogLen) {
        console.log(`[LAYER 3.7] ⚠️ CV length mismatch: anchor="${anchorLen}" vs catalog="${catalogLen}"`)
        
        // Find and upgrade the overall_length comparison row
        const lengthRow = comparison.find(r => r.key === 'overall_length')
        if (lengthRow) {
          lengthRow.status = 'mismatch'
          lengthRow.severity = 'HIGH'
          lengthRow.note = `Geometric analysis detected different garment lengths: anchor is "${anchorLen}" but catalog appears "${catalogLen}". This is a strong indicator of a different garment.`
          lengthRow.cv_cross_validated = true
        }
        
        modelIssues.push({
          attr: 'Garment length (CV)',
          declared: parsedDeclared.overall_length || 'Not specified',
          detected: `Anchor: ${anchorLen}, Catalog: ${catalogLen}`,
          confidence: 'HIGH',
          severity: 'HIGH',
          note: `Geometric measurement confirms the garments have different lengths (anchor="${anchorLen}", catalog="${catalogLen}"). Likely different products.`
        })
      } else if (anchorLen && catalogLen && anchorLen === catalogLen) {
        console.log(`[LAYER 3.7] ✅ CV length matches: both "${anchorLen}"`)
      }
    }

    // ── Layer 3.8: Size Chart Cross-Validation ────
    let sizeChartEvidence = null
    if (req.body.sizeChartMeasurements) {
      try {
        const sizeChart = typeof req.body.sizeChartMeasurements === 'string'
          ? JSON.parse(req.body.sizeChartMeasurements)
          : req.body.sizeChartMeasurements
        sizeChartEvidence = sizeChart
        const declaredSize = parsedDeclared.model_size || ''
        const declaredLength = String(attributeValue(parsedDeclared.overall_length) || '')
        const sizeKey = declaredSize.toUpperCase().replace(/[^A-Z]/g, '')
        
        if (sizeKey && sizeChart[sizeKey] && sizeChart[sizeKey].length) {
          const lengthVal = sizeChart[sizeKey].length
          let expected = []
          let fail = false
          
          if (lengthVal <= 21) {
            expected = ['Short', 'Crop']
          } else if (lengthVal <= 28) {
            expected = ['Short', 'Hip Length', 'Regular']
          } else if (lengthVal > 28 && lengthVal <= 34) {
            expected = ['Regular', 'Knee Length']
          } else {
            expected = ['Long', 'Knee Length', 'Ankle Length', 'Maxi']
          }

          const normalizedDeclaredLength = declaredLength.toLowerCase()
          const expectedMatches = expected.some(label => normalizedDeclaredLength.includes(label.toLowerCase()))
          fail = Boolean(normalizedDeclaredLength) && !expectedMatches
          
          if (fail) {
            console.log(`[LAYER 3.8] Size chart mismatch: length ${lengthVal} doesn't match declared '${declaredLength}'`)
            modelIssues.push({
              attr: 'Size Chart Length',
              declared: declaredLength,
              detected: `${lengthVal} inches (from size ${sizeKey})`,
              confidence: 'HIGH',
              severity: 'HIGH',
              note: `Size chart shows length ${lengthVal} for size ${sizeKey}, which contradicts the declared length '${declaredLength}'. Expected: ${expected.join(' or ')}.`
            })
            comparison.push({
              key: 'size_chart_length',
              label: 'Size Chart Length',
              anchor_value: `${lengthVal} in`,
              catalog_value: `${lengthVal} in`,
              declared_value: declaredLength,
              status: 'mismatch',
              severity: 'HIGH',
              note: `Contradiction between size chart (${lengthVal} in) and declared length (${declaredLength}).`,
              source: 'SizeChart'
            })
          } else {
            console.log(`[LAYER 3.8] ✅ Size chart length ${lengthVal} aligns with declared '${declaredLength}'`)
          }
        }

        const selectedMeasurement = sizeKey && sizeChart[sizeKey]
        if (catalogGeometry && selectedMeasurement?.length) {
          const lengthVal = Number(selectedMeasurement.length)
          const expectedFamily = lengthVal <= 21
            ? 'short'
            : lengthVal <= 28
              ? 'regular'
              : 'long'
          const catalogLength = catalogGeometry.length_category
          const catalogNormalized = catalogLength.toLowerCase()
          const detectedFamily = /(short|crop)/.test(catalogNormalized)
            ? 'short'
            : /(hip|regular)/.test(catalogNormalized)
              ? 'regular'
              : 'long'
          const catalogMatchesChart = expectedFamily === detectedFamily
          comparison.push({
            key: 'catalog_size_chart_fit',
            label: 'Catalog image vs size chart',
            anchor_value: `Size ${sizeKey}: ${lengthVal} in`,
            catalog_value: catalogLength,
            declared_value: expectedFamily === 'short' ? 'Short / Crop' : expectedFamily === 'regular' ? 'Hip / Regular' : 'Long',
            status: catalogMatchesChart ? 'match' : 'mismatch',
            severity: catalogMatchesChart ? 'LOW' : 'HIGH',
            note: catalogMatchesChart
              ? 'The visible catalog length is plausible for the selected size-chart measurement.'
              : `Size ${sizeKey} is listed at ${lengthVal} inches, but the catalog garment reads as "${catalogLength}".`,
            source: 'SizeChart+Sharp-Geometry',
          })
          if (!catalogMatchesChart) {
            modelIssues.push({
              attr: 'Catalog fit vs size chart',
              declared: `Size ${sizeKey}, ${lengthVal} in length`,
              detected: catalogLength,
              confidence: 'MEDIUM',
              severity: 'HIGH',
              note: 'The generated model image does not visually preserve the garment length implied by the seller size chart.',
            })
          }
        }
      } catch (err) {
        console.error('[LAYER 3.8] Failed to parse size chart measurements:', err)
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // LAYER 4: BAYESIAN MATHEMATICAL FUSION
    // Fuse ALL evidence BEFORE generating verdict (not after!)
    // ══════════════════════════════════════════════════════════════════
    let fusionResult = null
    if (clipResult && !clipResult.unavailable) {
      fusionResult = calculateBayesianFusion(
        clipResult.similarity_score,
        phashResult ? phashResult.phash_distance : null,
        comparison
      )
      console.log(`[LAYER 4] Bayesian Fusion Probability: ${fusionResult.probability}%`)
    }

    // ── Verdict (now incorporating fusion score) ─────────────────
    if (isGenerateMode) {
      // In generate mode, keep data quality issues but remove catalog model proportion checks
      // (since there's no catalog model yet — we're generating one)
      modelIssues = modelIssues.filter(i => 
        i.attr === 'Model Proportions' || // Keep: seller didn't provide height/size
        i.attr === 'Size Chart Length'     // Keep: size chart contradicts declared length
      );
    }
    const verdict = generateVerdict(comparison, modelIssues)
    
    // Attach fusion data to verdict so frontend can access it
    if (fusionResult) {
      verdict.fusionResult = fusionResult
      verdict.overall_similarity = parseFloat(fusionResult.probability)
    }

    // ══════════════════════════════════════════════════════════════════
    // LAYER 2.5: CROSS-VERIFIED CORRECTIONS
    // Uses CLIP binary to verify seller edits against anchor image
    // ══════════════════════════════════════════════════════════════════
    const anchorImageForVerify = anchorPaths.length > 0 ? anchorPaths[0] : null
    console.log(`[LAYER 2.5] Generating corrections with CLIP cross-verification...`)
    const corrections = await generateCorrections(comparison, modelIssues, anchorImageForVerify)
    console.log(`[LAYER 2.5] ${corrections.length} corrections generated`)
    const suggestionAgent = buildSuggestionAgent(comparison, modelIssues, corrections, verdict)

    // ══════════════════════════════════════════════════════════════════
    // LAYER 5: OPTIONAL TEXT-ONLY LLM (Generate mode only) & VISION METADATA ENHANCER
    // ══════════════════════════════════════════════════════════════════
    let enhancedMetadata = null;

    if (isGenerateMode) {
      console.log(`[LAYER 5] Generate mode — creating listing metadata and image...`)
      
      // AI Gen-Z Trend Metadata generation via Vision
      try {
        const baseData = { ...parsedAnchor, ...parsedDeclared };
        generatedMetadata = await enhanceMetadataWithVision(anchorPaths[0], baseData);
        if (generatedMetadata) {
          console.log(`[LAYER 5] Enhanced Metadata generated: "${generatedMetadata.title?.substring(0, 50)}..."`)
        } else {
          console.log(`[LAYER 5] Enhanced Metadata generation returned null (fallback).`)
          generatedMetadata = {
            title: baseData.productTitle || baseData.title || 'Enhanced AI Listing',
            description: baseData.description || 'This listing has been verified and optimized by AI.',
            category: baseData.category || baseData.articleType || '',
            tags: ['AI Verified', 'Trendy', 'Fashion']
          }
        }
      } catch (metaErr) {
        console.warn('[LAYER 5] Enhanced Metadata generation failed:', metaErr.message)
        generatedMetadata = {
            title: 'Enhanced AI Listing',
            tags: ['AI Verified']
        }
      }

      // Image compositing (Local CV, independent of LLM rate limits)
      try {
        const sizeChartFile = (req.files || []).find(f => f.fieldname === 'sizeChart')
        const sizeChartPath = sizeChartFile ? sizeChartFile.path : null
        
        const imageUrl = await generateCatalogImage(
          anchorPaths, 
          { ...parsedAnchor, ...parsedDeclared }, 
          comparison.find(c => c.key === 'overall_length')?.aiValue || '', 
          sizeChartPath, 
          null, 
          parsedDeclared
        )
        
        if (!generatedMetadata) {
          generatedMetadata = {}
        }
        generatedMetadata.generated_image_url = imageUrl
        
        console.log(`[LAYER 5] Catalog image generated successfully.`)
      } catch (imgErr) {
        console.error('[LAYER 5] Image generation failed:', imgErr.message)
      }
    } else if (anchorPaths.length > 0) {
      console.log(`[LAYER 5] Verify mode (CSV) — generating AI Enhanced trend metadata...`)
      try {
        const currentData = {
          title: parsedDeclared.productTitle || parsedDeclared.product_title || parsedDeclared.title || '',
          description: parsedDeclared.description || '',
          category: parsedDeclared.category || parsedDeclared.articleType || parsedDeclared.garment_type || '',
          tags: parsedDeclared.tags || ''
        };
        enhancedMetadata = await enhanceMetadataWithVision(anchorPaths[0], currentData);
        if (!enhancedMetadata) {
          console.warn('[LAYER 5] Using fallback metadata for CSV mode');
          enhancedMetadata = { ...currentData };
          if (typeof enhancedMetadata.tags === 'string') {
            enhancedMetadata.tags = enhancedMetadata.tags.split(',').map(t => t.trim()).filter(Boolean);
          }
        } else {
          console.log(`[LAYER 5] CSV Enhanced Metadata ready: ${enhancedMetadata?.tags?.join(', ')}`);
        }
      } catch (e) {
        console.warn('[LAYER 5] Failed to enhance CSV metadata:', e.message);
        enhancedMetadata = { 
          title: parsedDeclared.productTitle || parsedDeclared.product_title || parsedDeclared.title || 'Product', 
          tags: ['Trendy', 'Fashion'] 
        };
      }
    }

    // ══════════════════════════════════════════════════════════════════
    // RESPONSE
    // ══════════════════════════════════════════════════════════════════
    const matchCount = comparison.filter(r => r.status === 'match').length
    const mismatchCount = comparison.filter(r => r.status === 'mismatch').length
    const warnCount = comparison.filter(r => r.status === 'warning').length
    console.log(`[VERIFY] Done — ${verdict.status} | ${matchCount} match, ${warnCount} warn, ${mismatchCount} mismatch`)

    res.json({
      success: true,
      mode: isGenerateMode ? 'generate' : 'verify',
      comparison,
      catalog_attributes: catalogAttrs,
      modelIssues,
      fabricResult,
      phashResult: phashResult || null,
      fusionResult,
      verdict,
      corrections,
      suggestionAgent,
      catalogEvidenceDiagnostics,
      sizeChartEvidence,
      generatedMetadata,
      enhancedMetadata,
    })

  } catch (err) {
    console.error('[VERIFY] Pipeline error:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
