import { Router } from 'express'
import {
  extractCatalogAttributes,
  compareAttributesDeterministic,
  generateVerdict,
  checkModelProportions,
  generateListingMetadata,
  generateCatalogImage,
  generateCorrections,
  runClipSimilarity
} from '../services/gemini.js'

const router = Router()

/**
 * POST /api/verify — unified verification pipeline
 *
 * Architecture:
 *   1. LLM extracts catalog attributes (what it's good at — describing images)
 *   2. Deterministic code compares attributes with synonym maps (no hallucinations)
 *   3. Deterministic code generates verdict (no hallucinations)
 *   4. Optional: Python microservice for CLIP fabric score + MediaPipe proportions
 */
router.post('/', async (req, res) => {
  try {
    const { declaredAttrs, anchorExtracted, mode } = req.body

    const parsedDeclared = typeof declaredAttrs === 'string' ? JSON.parse(declaredAttrs) : (declaredAttrs || {})
    const parsedAnchor = typeof anchorExtracted === 'string' ? JSON.parse(anchorExtracted) : (anchorExtracted || {})

    const anchorFiles = (req.files || []).filter(f => f.fieldname === 'anchorImages')
    const catalogFiles = (req.files || []).filter(f => f.fieldname === 'catalogImages')
    const anchorPaths = anchorFiles.map(f => f.path)
    const catalogPaths = catalogFiles.map(f => f.path)

    const isGenerateMode = mode === 'generate'
    
    if (!isGenerateMode && catalogPaths.length === 0) {
      return res.status(400).json({ success: false, error: "Please upload catalog images to run verification." })
    }

    let catalogAttrs = {}
    let generatedMetadata = null
    let modelIssues = []

    // ── Step 1: Mandatory CLIP Similarity Check (NO LLM) ────────────
    let clipResult = null
    if (!isGenerateMode && anchorPaths.length > 0 && catalogPaths.length > 0) {
      console.log(`[VERIFY] Running CLIP visual similarity check...`)
      clipResult = await runClipSimilarity(anchorPaths[0], catalogPaths[0])
      
      if (!clipResult) {
        // CLIP failed to run entirely — return UNVERIFIED, never silently pass
        console.warn(`[VERIFY] CLIP gate failed to execute — returning UNVERIFIED`)
        return res.json({
          success: true,
          mode: 'verify',
          comparison: [],
          catalog_attributes: {},
          modelIssues: [],
          fabricResult: { fabric_matches_anchor: false, confidence: 'LOW', issue: 'CLIP similarity check could not run. Visual gate unavailable.' },
          verdict: { status: 'UNVERIFIED', reason: 'Visual similarity check failed to execute. Cannot verify.', critical_fails: 0, warnings: 1 },
          corrections: [],
          generatedMetadata: null
        })
      }

      if (!clipResult.is_match) {
        console.log(`[VERIFY] CLIP check failed: similarity is ${(clipResult.similarity_score * 100).toFixed(1)}%`)
        return res.json({
          success: true,
          mode: 'verify',
          comparison: [],
          catalog_attributes: {},
          modelIssues: [],
          fabricResult: {
            fabric_matches_anchor: false,
            confidence: 'HIGH',
            similarity_score: clipResult.similarity_score,
            issue: `These do not appear to be the same garment. Visual similarity is only ${(clipResult.similarity_score * 100).toFixed(1)}%.`
          },
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

      console.log(`[VERIFY] CLIP gate passed: ${(clipResult.similarity_score * 100).toFixed(1)}% similarity`)
    }

    // ── Step 2: Extract catalog attributes ──────────────────────────
    if (!isGenerateMode && catalogPaths.length > 0) {
      console.log(`[VERIFY] Extracting catalog attributes from ${catalogPaths.length} images...`)
      try {
        catalogAttrs = await extractCatalogAttributes(catalogPaths, anchorPaths)
        console.log(`[VERIFY] Catalog extraction done: ${Object.keys(catalogAttrs).length} attributes`)
      } catch (err) {
        console.error('[VERIFY] Catalog extraction failed:', err.message)
        catalogAttrs = {}
        modelIssues.push({ extractionFailed: true })
      }
    }

    // ── Step 3: Deterministic comparison (NO LLM) ───────────────────
    console.log(`[VERIFY] Running deterministic comparison with synonym matching...`)
    const comparison = compareAttributesDeterministic(
      parsedAnchor,   // anchor attributes (extracted on Upload page)
      catalogAttrs,    // catalog attributes (just extracted above)
      parsedDeclared,  // seller declarations (from Details page)
    )

    // ── Step 4: Model proportion check (deterministic) ──────────────
    const modelHeight = parsedDeclared.model_height || ''
    const modelSize = parsedDeclared.model_size || ''
    const proportionIssues = checkModelProportions(catalogAttrs, modelHeight, modelSize)
    modelIssues.push(...proportionIssues)

    // ── Step 5: Deterministic verdict ───────────────────────────────
    const verdict = generateVerdict(comparison, modelIssues)

    // ── Step 6: Generate listing metadata + image (generate mode only)
    if (isGenerateMode) {
      console.log(`[VERIFY] Generate mode — creating listing metadata and image...`)
      
      // Metadata generation (LLM dependent, can fail on rate limit)
      try {
        generatedMetadata = await generateListingMetadata(anchorPaths, parsedDeclared)
        console.log(`[VERIFY] Metadata generated: "${generatedMetadata?.title?.substring(0, 50)}..."`)
      } catch (metaErr) {
        console.warn('[VERIFY] Metadata generation failed (rate limit?):', metaErr.message)
        generatedMetadata = {} // Ensure we have an object to attach the image URL to
      }

      // Image compositing (Local CV, independent of LLM rate limits)
      try {
        const imageUrl = await generateCatalogImage(anchorPaths, parsedDeclared, parsedAnchor.cv_overall_length)
        if (generatedMetadata) generatedMetadata.generated_image_url = imageUrl
        console.log(`[VERIFY] Catalog image generated: ${imageUrl}`)
      } catch (imgErr) {
        console.error('[VERIFY] Image generation failed:', imgErr.message)
      }
    }

    // Remove the old python call (Step 6 optional) entirely, since we replaced it with local CLI
    // and just use the clipResult directly.

    // ── Response ────────────────────────────────────────────────────
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
      fabricResult: clipResult ? {
        fabric_matches_anchor: clipResult.is_match,
        confidence: 'HIGH',
        similarity_score: clipResult.similarity_score,
        issue: null,
      } : null,
      verdict,
      corrections: generateCorrections(comparison, modelIssues),
      generatedMetadata,
    })

  } catch (err) {
    console.error('[VERIFY] Pipeline error:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
