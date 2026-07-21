import { Router } from 'express'
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

const router = Router()

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

    if (catalogPaths.length === 0 && req.body.catalogPaths) {
      const parsedPaths = typeof req.body.catalogPaths === 'string' ? JSON.parse(req.body.catalogPaths) : req.body.catalogPaths
      catalogPaths = parsedPaths.map(p => {
        if (p.startsWith('http://localhost:3001/')) return p.replace('http://localhost:3001/', '')
        return p
      })
    }

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
      
      const anchorPath = anchorPaths[0]
      const catalogPath = catalogPaths[0]

      const [clipRes, phashRes] = await Promise.all([
        runClipSimilarity(anchorPath, catalogPath),
        runPhashSimilarity(anchorPath, catalogPath),
      ])

      clipResult = clipRes
      phashResult = phashRes
      
      if (!clipResult) {
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

      if (clipResult.similarity_score < 0.50) {
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
    if (!fabricResult && clipResult) {
      fabricResult = {
        fabric_matches_anchor: clipResult.similarity_score >= 0.70,
        confidence: 99,
        similarity_score: clipResult.similarity_score,
        issue: null,
        source: 'CLIP'
      }
    }

    // ── Layer 3.6: Body proportion checking (CLIP + Segmentation) ────
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
    if (req.body.sizeChartMeasurements) {
      try {
        const sizeChart = JSON.parse(req.body.sizeChartMeasurements)
        const declaredSize = parsedDeclared.model_size || ''
        const declaredLength = parsedDeclared.overall_length || ''
        const sizeKey = declaredSize.toUpperCase().replace(/[^A-Z]/g, '')
        
        if (sizeKey && sizeChart[sizeKey] && sizeChart[sizeKey].length) {
          const lengthVal = sizeChart[sizeKey].length
          let expected = []
          let fail = false
          
          if (lengthVal < 20) {
            expected = ['Crop']
            if (declaredLength.includes('Long') || declaredLength.includes('Maxi')) fail = true
          } else if (lengthVal >= 20 && lengthVal < 24) {
            expected = ['Crop', 'Hip Length']
          } else if (lengthVal >= 24 && lengthVal <= 28) {
            expected = ['Hip Length', 'Regular']
          } else if (lengthVal > 28 && lengthVal <= 34) {
            expected = ['Regular', 'Knee Length']
          } else {
            expected = ['Knee Length', 'Ankle Length', 'Maxi']
          }
          
          if (lengthVal > 26 && declaredLength.includes('Crop')) {
            fail = true
          }
          
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
              anchor: `${lengthVal} in`,
              catalog: `${lengthVal} in`,
              declared: declaredLength,
              status: 'mismatch',
              severity: 'HIGH',
              note: `Contradiction between size chart (${lengthVal} in) and declared length (${declaredLength}).`,
              source: 'SizeChart'
            })
          } else {
            console.log(`[LAYER 3.8] ✅ Size chart length ${lengthVal} aligns with declared '${declaredLength}'`)
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
    if (clipResult) {
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
        }
      } catch (metaErr) {
        console.warn('[LAYER 5] Enhanced Metadata generation failed:', metaErr.message)
        generatedMetadata = {}
      }

      // Image compositing (Local CV, independent of LLM rate limits)
      try {
        const sizeChartFile = (req.files || []).find(f => f.fieldname === 'sizeChart')
        const sizeChartPath = sizeChartFile ? sizeChartFile.path : null
        
        const imageUrl = await generateCatalogImage(anchorPaths, parsedDeclared, parsedAnchor.cv_overall_length, sizeChartPath)
        
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
          title: parsedDeclared.productTitle || '',
          description: parsedDeclared.description || '',
          tags: parsedDeclared.tags || ''
        };
        enhancedMetadata = await enhanceMetadataWithVision(anchorPaths[0], currentData);
        console.log(`[LAYER 5] CSV Enhanced Metadata ready: ${enhancedMetadata?.tags?.join(', ')}`);
      } catch (e) {
        console.warn('[LAYER 5] Failed to enhance CSV metadata:', e.message);
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
      generatedMetadata,
      enhancedMetadata,
    })

  } catch (err) {
    console.error('[VERIFY] Pipeline error:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
