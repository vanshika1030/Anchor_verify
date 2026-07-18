import { Router } from 'express'
import fs from 'fs'
import axios from 'axios'
import FormData from 'form-data'
import {
  extractCatalogAttributes,
  compareAttributesDeterministic,
  generateVerdict,
  checkModelProportions,
  generateListingMetadata,
  generateCorrections,
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

    const isGenerateMode = mode === 'generate' || catalogPaths.length === 0

    let catalogAttrs = {}
    let generatedMetadata = null

    // ── Step 1: Extract catalog attributes ──────────────────────────
    if (!isGenerateMode && catalogPaths.length > 0) {
      console.log(`[VERIFY] Extracting catalog attributes from ${catalogPaths.length} images...`)
      try {
        catalogAttrs = await extractCatalogAttributes(catalogPaths)
        console.log(`[VERIFY] Catalog extraction done: ${Object.keys(catalogAttrs).length} attributes`)
      } catch (err) {
        console.error('[VERIFY] Catalog extraction failed:', err.message)
        catalogAttrs = {}
      }
    }

    // ── Step 2: Deterministic comparison (NO LLM) ───────────────────
    console.log(`[VERIFY] Running deterministic comparison with synonym matching...`)
    const comparison = compareAttributesDeterministic(
      parsedAnchor,   // anchor attributes (extracted on Upload page)
      catalogAttrs,    // catalog attributes (just extracted above)
      parsedDeclared,  // seller declarations (from Details page)
    )

    // ── Step 3: Model proportion check (deterministic) ──────────────
    const modelHeight = parsedDeclared.model_height || ''
    const modelSize = parsedDeclared.model_size || ''
    const modelIssues = checkModelProportions(catalogAttrs, modelHeight, modelSize)

    // ── Step 4: Deterministic verdict ───────────────────────────────
    const verdict = generateVerdict(comparison, modelIssues)

    // ── Step 5: Generate listing metadata + image (generate mode only)
    if (isGenerateMode) {
      console.log(`[VERIFY] Generate mode — creating listing metadata...`)
      try {
        generatedMetadata = await generateListingMetadata(anchorPaths, parsedDeclared)
        console.log(`[VERIFY] Metadata generated: "${generatedMetadata?.title?.substring(0, 50)}..."`)
        
        // Actually generate a visual image!
        const imageUrl = await generateCatalogImage(parsedDeclared)
        generatedMetadata.generated_image_url = imageUrl
        console.log(`[VERIFY] Catalog image generated: ${imageUrl}`)
      } catch (metaErr) {
        console.warn('[VERIFY] Generation failed (non-critical):', metaErr.message)
        generatedMetadata = null
      }
    }

    // ── Step 6 (optional): Python hybrid enhancement ────────────────
    const pythonUrl = 'http://localhost:8000'
    let mathScores = {}

    if (anchorPaths.length > 0 && catalogPaths.length > 0) {
      // CLIP fabric similarity
      try {
        const form = new FormData()
        form.append('anchor_image', fs.createReadStream(anchorPaths[0]))
        form.append('catalog_image', fs.createReadStream(catalogPaths[0]))
        const fabRes = await axios.post(`${pythonUrl}/analyze/fabric`, form, {
          headers: form.getHeaders(), timeout: 5000,
        })
        if (fabRes.data?.success) {
          mathScores.fabric = fabRes.data
          console.log(`[VERIFY] CLIP fabric similarity: ${(fabRes.data.similarity_score * 100).toFixed(1)}%`)
        }
      } catch (err) {
        // Silently skip — Python service is optional
      }

      // MediaPipe proportions
      try {
        const form = new FormData()
        form.append('catalog_image', fs.createReadStream(catalogPaths[0]))
        const propRes = await axios.post(`${pythonUrl}/analyze/proportions`, form, {
          headers: form.getHeaders(), timeout: 5000,
        })
        if (propRes.data?.success) {
          mathScores.proportions = propRes.data.data
          console.log(`[VERIFY] MediaPipe: hemline at ${mathScores.proportions.mathematical_length_category}`)
        }
      } catch (err) {
        // Silently skip
      }
    }

    // Attach math scores to verdict
    if (mathScores.fabric) verdict.math_fabric_score = mathScores.fabric.similarity_score
    if (mathScores.proportions) verdict.math_proportions = mathScores.proportions

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
      fabricResult: mathScores.fabric ? {
        fabric_matches_anchor: mathScores.fabric.is_match,
        confidence: 'HIGH',
        similarity_score: mathScores.fabric.similarity_score,
        issue: mathScores.fabric.is_match ? null : `CLIP similarity ${(mathScores.fabric.similarity_score * 100).toFixed(1)}% below threshold`,
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
