import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_KEY)

// ─── Helpers ─────────────────────────────────────────────────────────

/** Convert a File/Blob to the format Gemini expects */
async function fileToGenerativePart(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result
      const [meta, data] = dataUrl.split(',')
      const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/jpeg'
      resolve({ inlineData: { data, mimeType } })
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/** Convert a base64 data URL to Gemini part */
function dataUrlToGenerativePart(dataUrl) {
  const [meta, data] = dataUrl.split(',')
  const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/jpeg'
  return { inlineData: { data, mimeType } }
}

/** Safe JSON parse from Gemini response (strips markdown fences if present) */
function parseJSON(text) {
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  }
  return JSON.parse(cleaned)
}

// ─── Attribute Extraction ────────────────────────────────────────────

const ANCHOR_PROMPT = `You are a garment attribute extraction system for Myntra (Indian fashion e-commerce).

You are given images of a REAL physical garment (flat-lay or handheld photos taken by the seller). These are the ground truth — the actual product.

Analyze ALL provided images together and extract these attributes. For each, give:
- "value": your best detection (be specific, e.g. "Elbow length" not just "Medium")
- "confidence": "HIGH" (clearly visible), "MEDIUM" (partially visible, inferring), "LOW" (cannot determine from these images)

If you genuinely cannot determine an attribute from the images, set value to "Not determinable" with confidence "LOW".

Return ONLY valid JSON (no markdown, no explanation):
{
  "garment_type": {"value": "", "confidence": ""},
  "primary_color": {"value": "", "confidence": ""},
  "secondary_color": {"value": "", "confidence": ""},
  "pattern_type": {"value": "", "confidence": ""},
  "fabric_appearance": {"value": "", "confidence": ""},
  "overall_length": {"value": "", "confidence": ""},
  "sleeve_length": {"value": "", "confidence": ""},
  "neck_type": {"value": "", "confidence": ""},
  "silhouette": {"value": "", "confidence": ""},
  "fit": {"value": "", "confidence": ""},
  "embellishment": {"value": "", "confidence": ""},
  "transparency": {"value": "", "confidence": ""},
  "hemline": {"value": "", "confidence": ""},
  "occasion_style": {"value": "", "confidence": ""},
  "motif_description": {"value": "", "confidence": ""},
  "closure_type": {"value": "", "confidence": ""},
  "structural_features": {"value": "", "confidence": ""}
}`

const CATALOG_PROMPT = `You are a garment attribute extraction system for Myntra (Indian fashion e-commerce).

You are given CATALOG/LISTING images of a garment — these are the images that shoppers will see. They may be professional studio shots with a model wearing the garment.

Analyze ALL provided images together and extract these attributes. For each, give:
- "value": your best detection (be specific)
- "confidence": "HIGH", "MEDIUM", or "LOW"

ALSO estimate the model's appearance (if a human model is visible):
- model_apparent_height: estimate as "petite (under 5'4)" or "average (5'4 to 5'7)" or "tall (5'8+)"
- model_apparent_build: estimate as "slim (XS-S)" or "average (S-M)" or "athletic (M-L)" or "plus-size (L-XXL)"

If no human model is visible (mannequin, flat-lay, ghost mannequin), set both model fields to "No model visible".

Return ONLY valid JSON (no markdown, no explanation):
{
  "garment_type": {"value": "", "confidence": ""},
  "primary_color": {"value": "", "confidence": ""},
  "secondary_color": {"value": "", "confidence": ""},
  "pattern_type": {"value": "", "confidence": ""},
  "fabric_appearance": {"value": "", "confidence": ""},
  "overall_length": {"value": "", "confidence": ""},
  "sleeve_length": {"value": "", "confidence": ""},
  "neck_type": {"value": "", "confidence": ""},
  "silhouette": {"value": "", "confidence": ""},
  "fit": {"value": "", "confidence": ""},
  "embellishment": {"value": "", "confidence": ""},
  "transparency": {"value": "", "confidence": ""},
  "hemline": {"value": "", "confidence": ""},
  "occasion_style": {"value": "", "confidence": ""},
  "motif_description": {"value": "", "confidence": ""},
  "closure_type": {"value": "", "confidence": ""},
  "structural_features": {"value": "", "confidence": ""},
  "model_apparent_height": {"value": "", "confidence": ""},
  "model_apparent_build": {"value": "", "confidence": ""}
}`

/**
 * Extract attributes from anchor images (front, back, closeup).
 * Sends all images in one call so Gemini can cross-reference.
 */
export async function extractAnchorAttributes(anchorImages) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
  const parts = []
  for (const img of anchorImages) {
    if (!img) continue
    if (typeof img === 'string') {
      parts.push(dataUrlToGenerativePart(img))
    } else {
      parts.push(await fileToGenerativePart(img))
    }
  }
  if (parts.length === 0) throw new Error('No anchor images provided')

  const result = await model.generateContent([ANCHOR_PROMPT, ...parts])
  const text = result.response.text()
  return parseJSON(text)
}

/**
 * Extract attributes from catalog images.
 * Also detects model proportions if a human model is visible.
 */
export async function extractCatalogAttributes(catalogImages) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
  const parts = []
  for (const img of catalogImages) {
    if (!img) continue
    if (typeof img === 'string') {
      parts.push(dataUrlToGenerativePart(img))
    } else {
      parts.push(await fileToGenerativePart(img))
    }
  }
  if (parts.length === 0) throw new Error('No catalog images provided')

  const result = await model.generateContent([CATALOG_PROMPT, ...parts])
  const text = result.response.text()
  return parseJSON(text)
}

// ─── Three-Way Comparison ────────────────────────────────────────────

const COMPARE_ATTRS = [
  'garment_type', 'primary_color', 'secondary_color', 'pattern_type',
  'fabric_appearance', 'overall_length', 'sleeve_length', 'neck_type',
  'silhouette', 'fit', 'embellishment', 'transparency', 'hemline',
  'occasion_style', 'motif_description', 'closure_type', 'structural_features',
]

const HARD_ATTRS = new Set([
  'garment_type', 'primary_color', 'pattern_type', 'overall_length',
  'sleeve_length', 'embellishment', 'transparency', 'fabric_appearance',
  'motif_description',
])

const ATTR_LABELS = {
  garment_type: 'Garment type',
  primary_color: 'Primary color',
  secondary_color: 'Secondary color',
  pattern_type: 'Pattern type',
  fabric_appearance: 'Fabric appearance',
  overall_length: 'Overall length',
  sleeve_length: 'Sleeve length',
  neck_type: 'Neck type',
  silhouette: 'Silhouette',
  fit: 'Fit',
  embellishment: 'Embellishment',
  transparency: 'Transparency',
  hemline: 'Hemline',
  occasion_style: 'Occasion / style',
  motif_description: 'Motif / print detail',
  closure_type: 'Closure',
  structural_features: 'Structural features',
}

const CATEGORY_MAP = {
  garment_type: 'Structure', primary_color: 'Color', secondary_color: 'Color',
  pattern_type: 'Pattern', fabric_appearance: 'Material', overall_length: 'Structure',
  sleeve_length: 'Structure', neck_type: 'Structure', silhouette: 'Structure',
  fit: 'Structure', embellishment: 'Detail', transparency: 'Material',
  hemline: 'Structure', occasion_style: 'Metadata', motif_description: 'Pattern',
  closure_type: 'Structure', structural_features: 'Detail',
}

/**
 * Smart comparison using Gemini — sends both extractions and asks Gemini
 * to do the semantic comparison (handles synonyms, partial matches, etc.)
 */
export async function compareWithGemini(anchorAttrs, catalogAttrs, declaredAttrs) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const prompt = `You are a garment verification system. Compare attributes extracted from a REAL PRODUCT (anchor) vs a CATALOG IMAGE (catalog) vs SELLER-DECLARED values.

For each attribute below, determine if they match or mismatch. Consider:
- Synonyms: "Round neck" = "Crew neck", "Short sleeve" = "Half sleeve", "Printed" = "Print"
- Partial matches: "Navy Blue" vs "Navy" = MATCH. "Dark Blue" vs "Navy" = MATCH.
- Context: A flat-lay photo may show "Not determinable" for some attributes — skip these, don't count as mismatch.
- Be strict on structural attributes (garment type, sleeve length, pattern type, fabric, overall length) — these matter to shoppers.
- Be lenient on soft attributes (occasion, hemline) — these are somewhat subjective.

ANCHOR (from real product photos):
${JSON.stringify(anchorAttrs, null, 2)}

CATALOG (from listing images):
${JSON.stringify(catalogAttrs, null, 2)}

SELLER DECLARED:
${JSON.stringify(declaredAttrs, null, 2)}

Return ONLY valid JSON array. For each attribute:
{
  "key": "attribute_key",
  "anchor_value": "what anchor shows",
  "catalog_value": "what catalog shows",
  "declared_value": "what seller said",
  "status": "match" or "mismatch" or "warning" or "skip",
  "severity": "HIGH" or "MEDIUM" or "LOW" (only if mismatch/warning),
  "anchor_confidence": "HIGH/MEDIUM/LOW",
  "catalog_confidence": "HIGH/MEDIUM/LOW",
  "note": "brief explanation of WHY this is a mismatch, if applicable"
}

Only include attributes where at least one source has a meaningful value (skip "Not determinable" vs "Not determinable").`

  const result = await model.generateContent(prompt)
  return parseJSON(result.response.text())
}

/**
 * Check if declared model height/size matches what Gemini detected.
 */
export function checkModelProportions(catalogAttrs, declaredHeight, declaredSize) {
  const issues = []
  const heightAttr = catalogAttrs.model_apparent_height
  const buildAttr = catalogAttrs.model_apparent_build

  if (!heightAttr || !buildAttr) return issues
  if (heightAttr.value === 'No model visible') return issues

  // Height check
  const h = heightAttr.value.toLowerCase()
  const dh = declaredHeight || ''
  if (dh.includes("5'2") || dh.includes("5'3") || dh.includes("5'0") || dh.includes("5'1")) {
    // Declared petite
    if (!h.includes('petite')) {
      issues.push({
        attr: 'Model height',
        declared: declaredHeight,
        detected: heightAttr.value,
        confidence: heightAttr.confidence,
        severity: 'HIGH',
        note: `Seller declared model height as ${declaredHeight} (petite) but the model in catalog appears ${heightAttr.value}`,
      })
    }
  } else if (dh.includes("5'8") || dh.includes("5'9") || dh.includes("5'10") || dh.includes("5'11") || dh.includes("6'")) {
    if (!h.includes('tall')) {
      issues.push({
        attr: 'Model height',
        declared: declaredHeight,
        detected: heightAttr.value,
        confidence: heightAttr.confidence,
        severity: 'HIGH',
        note: `Seller declared model height as ${declaredHeight} (tall) but the model in catalog appears ${heightAttr.value}`,
      })
    }
  }

  // Size check
  const b = buildAttr.value.toLowerCase()
  const ds = (declaredSize || '').toUpperCase()
  if ((ds === 'XS' || ds === 'S') && (b.includes('plus') || b.includes('l-xxl') || b.includes('athletic'))) {
    issues.push({
      attr: 'Model size worn',
      declared: declaredSize,
      detected: buildAttr.value,
      confidence: buildAttr.confidence,
      severity: 'HIGH',
      note: `Seller declared model wearing size ${declaredSize} but the model appears to be ${buildAttr.value}`,
    })
  } else if ((ds === 'XL' || ds === 'XXL') && (b.includes('slim') || b.includes('xs-s'))) {
    issues.push({
      attr: 'Model size worn',
      declared: declaredSize,
      detected: buildAttr.value,
      confidence: buildAttr.confidence,
      severity: 'HIGH',
      note: `Seller declared model wearing size ${declaredSize} but the model appears to be ${buildAttr.value}`,
    })
  }

  return issues
}

// ─── Verdict Generation ──────────────────────────────────────────────

export function generateVerdict(comparisonRows, modelIssues, similarity) {
  const highMismatches = comparisonRows.filter(r => r.status === 'mismatch' && r.severity === 'HIGH')
  const medMismatches = comparisonRows.filter(r => r.status === 'mismatch' && r.severity === 'MEDIUM')
  const warnings = comparisonRows.filter(r => r.status === 'warning')
  const matches = comparisonRows.filter(r => r.status === 'match')

  let status = 'PASS'
  let reason = ''

  if (highMismatches.length > 0 || modelIssues.length > 0) {
    status = 'FAIL'
    const total = highMismatches.length + modelIssues.length
    reason = `${total} critical mismatch${total > 1 ? 'es' : ''} detected`
  } else if (medMismatches.length > 0 || warnings.length > 0) {
    status = 'WARNING'
    const total = medMismatches.length + warnings.length
    reason = `${total} warning${total > 1 ? 's' : ''} detected`
  } else {
    reason = `All ${matches.length} checks passed — listing verified`
  }

  return {
    status,
    reason,
    counts: {
      fail: highMismatches.length + modelIssues.length,
      warn: medMismatches.length + warnings.length,
      pass: matches.length,
    },
  }
}

// ─── Catalog Generation ──────────────────────────────────────────────

export async function generateCatalogImage(anchorDataUrl, attributes, angle = 'front') {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const prompt = `You are helping generate a product listing description for a Myntra catalog image.

Based on the garment in this anchor photo and the confirmed attributes below, write a detailed prompt that could be used to generate a professional catalog photo of this exact garment on a model.

The photo must follow these Myntra specifications:
- 3:4 portrait orientation
- Light grey studio background
- Full-body model shot, gender-matched
- Product fills 85% of frame
- Angle: ${angle} view

Confirmed attributes:
${JSON.stringify(attributes, null, 2)}

Return a single detailed image generation prompt (1 paragraph, no JSON).`

  const parts = [prompt]
  if (anchorDataUrl) {
    parts.push(dataUrlToGenerativePart(anchorDataUrl))
  }

  const result = await model.generateContent(parts)
  return result.response.text()
}

// ─── Fabric Verification ─────────────────────────────────────────────

export async function verifyFabric(anchorCloseup, catalogImages, declaredFabric) {
  if (!anchorCloseup) return { identifiable: true, issue: null, note: 'No closeup provided — skipping fabric verification' }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

  const parts = [
    `You are verifying fabric consistency between a real product and its catalog listing.

Image 1 is a CLOSEUP of the real fabric (anchor).
Remaining images are CATALOG photos of the garment.
Seller declared the fabric as: "${declaredFabric || 'Not declared'}"

Determine:
1. Can a shopper identify the fabric type from the catalog images? (texture, weave, sheen visible?)
2. Does the catalog fabric appearance match the real fabric in the closeup?
3. Is the declared fabric plausible given what you see?

Return ONLY valid JSON:
{
  "fabric_identifiable_in_catalog": true/false,
  "fabric_matches_anchor": true/false,
  "declared_fabric_plausible": true/false,
  "anchor_fabric_appearance": "description of what the real fabric looks like",
  "catalog_fabric_appearance": "description of what the catalog fabric looks like",
  "issue": "description of any problem, or null if all good",
  "confidence": "HIGH/MEDIUM/LOW"
}`,
  ]

  if (typeof anchorCloseup === 'string') {
    parts.push(dataUrlToGenerativePart(anchorCloseup))
  }
  for (const img of catalogImages) {
    if (!img) continue
    if (typeof img === 'string') {
      parts.push(dataUrlToGenerativePart(img))
    }
  }

  const result = await model.generateContent(parts)
  return parseJSON(result.response.text())
}
