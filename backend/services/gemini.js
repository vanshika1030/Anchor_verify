import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'
import path from 'path'

const MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite']
const MAX_RETRIES = 3
const BASE_DELAY_MS = 2000

let genAI = null

export function initGemini(apiKey) {
  genAI = new GoogleGenerativeAI(apiKey)
}

// ─── Retry with backoff + model fallback ─────────────────────────────

async function callWithRetry(promptParts, modelIdx = 0, attempt = 0) {
  if (!genAI) throw new Error('Gemini not initialized — call initGemini(apiKey) first')
  if (modelIdx >= MODELS.length) throw new Error('All models exhausted — check API key and quota')

  const modelName = MODELS[modelIdx]
  try {
    const model = genAI.getGenerativeModel({ model: modelName })
    const result = await model.generateContent(promptParts)
    return result.response.text()
  } catch (err) {
    const msg = err.message || ''

    // Model not available → try next model immediately
    if (msg.includes('404') || msg.includes('no longer available')) {
      console.warn(`Model ${modelName} unavailable, trying ${MODELS[modelIdx + 1]}`)
      return callWithRetry(promptParts, modelIdx + 1, 0)
    }

    // Rate limited → backoff and retry same model
    if (msg.includes('429') || msg.includes('quota')) {
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 1000
        console.warn(`Rate limited on ${modelName}, retrying in ${Math.round(delay)}ms (attempt ${attempt + 1}/${MAX_RETRIES})`)
        await new Promise(r => setTimeout(r, delay))
        return callWithRetry(promptParts, modelIdx, attempt + 1)
      }
      // Exhausted retries on this model → try next
      console.warn(`Exhausted retries on ${modelName}, trying ${MODELS[modelIdx + 1]}`)
      return callWithRetry(promptParts, modelIdx + 1, 0)
    }

    // Other error → throw
    throw err
  }
}

// ─── Parse JSON safely ───────────────────────────────────────────────

function parseJSON(text) {
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  }
  return JSON.parse(cleaned)
}

// ─── Convert file path to Gemini inline data ─────────────────────────

function fileToInlineData(filePath) {
  const data = fs.readFileSync(filePath)
  const ext = path.extname(filePath).toLowerCase()
  const mimeMap = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }
  return {
    inlineData: {
      data: data.toString('base64'),
      mimeType: mimeMap[ext] || 'image/jpeg',
    }
  }
}

function base64ToInlineData(dataUrl) {
  const [meta, data] = dataUrl.split(',')
  const mimeType = meta.match(/:(.*?);/)?.[1] || 'image/jpeg'
  return { inlineData: { data, mimeType } }
}

// ─── Prompts ─────────────────────────────────────────────────────────

const ANCHOR_PROMPT = `You are a garment attribute extraction system for Myntra (Indian fashion e-commerce).

You are given images of a REAL physical garment (flat-lay or handheld photos taken by the seller). These are the ground truth — the actual product.

Analyze ALL provided images together and extract these attributes. For each, give:
- "value": your best detection (be specific, e.g. "Elbow length" not just "Medium")
- "confidence": "HIGH" (clearly visible), "MEDIUM" (partially visible, inferring), "LOW" (cannot determine)

If you genuinely cannot determine an attribute, set value to "Not determinable" with confidence "LOW".

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

You are given CATALOG images — the images shoppers will see. They may be professional studio shots with a model.

Analyze ALL images together and extract attributes. For each, give value + confidence (HIGH/MEDIUM/LOW).

ALSO estimate the model's appearance (if visible):
- model_apparent_height: "petite (under 5'4)" / "average (5'4-5'7)" / "tall (5'8+)"
- model_apparent_build: "slim (XS-S)" / "average (S-M)" / "athletic (M-L)" / "plus-size (L-XXL)"
If no human model visible, set both to "No model visible".

Return ONLY valid JSON:
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

// ─── Public API ──────────────────────────────────────────────────────

export async function extractAnchorAttributes(imagePaths) {
  const parts = [ANCHOR_PROMPT]
  for (const p of imagePaths) {
    parts.push(fileToInlineData(p))
  }
  const text = await callWithRetry(parts)
  return parseJSON(text)
}

export async function extractCatalogAttributes(imagePaths) {
  const parts = [CATALOG_PROMPT]
  for (const p of imagePaths) {
    parts.push(fileToInlineData(p))
  }
  const text = await callWithRetry(parts)
  return parseJSON(text)
}

export async function compareAttributes(anchorAttrs, catalogAttrs, declaredAttrs) {
  const prompt = `You are a garment verification system. Compare attributes from a REAL PRODUCT (anchor) vs CATALOG IMAGE (catalog) vs SELLER-DECLARED values.

Rules:
- Synonyms: "Round neck" = "Crew neck", "Short sleeve" = "Half sleeve", "Printed" = "Print" — these MATCH.
- Close colors: "Navy Blue" vs "Navy" = MATCH. "Dark Blue" vs "Navy" = MATCH.
- If anchor shows "Not determinable", skip that attribute (status: "skip").
- Be STRICT on: garment_type, primary_color, pattern_type, overall_length, sleeve_length, embellishment, transparency, fabric_appearance, motif_description
- Be LENIENT on: occasion_style, hemline, secondary_color, structural_features

ANCHOR: ${JSON.stringify(anchorAttrs)}
CATALOG: ${JSON.stringify(catalogAttrs)}
SELLER: ${JSON.stringify(declaredAttrs)}

Return ONLY a valid JSON array:
[{
  "key": "attribute_key",
  "anchor_value": "", "catalog_value": "", "declared_value": "",
  "status": "match" | "mismatch" | "warning" | "skip",
  "severity": "HIGH" | "MEDIUM" | "LOW",
  "anchor_confidence": "HIGH/MEDIUM/LOW",
  "catalog_confidence": "HIGH/MEDIUM/LOW",
  "note": "why this is a mismatch, if applicable"
}]`

  const text = await callWithRetry([prompt])
  return parseJSON(text)
}

export async function verifyFabric(anchorCloseupPath, catalogPaths, declaredFabric) {
  const parts = [
    `You are verifying fabric between a real product closeup and catalog images.
Image 1: CLOSEUP of real fabric. Remaining: catalog photos.
Declared fabric: "${declaredFabric || 'Not declared'}"

Return ONLY valid JSON:
{
  "fabric_identifiable_in_catalog": true/false,
  "fabric_matches_anchor": true/false,
  "declared_fabric_plausible": true/false,
  "anchor_fabric_appearance": "",
  "catalog_fabric_appearance": "",
  "issue": "description or null",
  "confidence": "HIGH/MEDIUM/LOW"
}`,
  ]
  if (anchorCloseupPath) parts.push(fileToInlineData(anchorCloseupPath))
  for (const p of catalogPaths) {
    parts.push(fileToInlineData(p))
  }
  const text = await callWithRetry(parts)
  return parseJSON(text)
}

export function checkModelProportions(catalogAttrs, declaredHeight, declaredSize) {
  const issues = []
  const h = catalogAttrs?.model_apparent_height
  const b = catalogAttrs?.model_apparent_build
  if (!h || !b || h.value === 'No model visible') return issues

  const hv = h.value.toLowerCase()
  const dh = (declaredHeight || '').toLowerCase()
  if ((dh.includes("5'0") || dh.includes("5'1") || dh.includes("5'2") || dh.includes("5'3")) && !hv.includes('petite')) {
    issues.push({ attr: 'Model height', declared: declaredHeight, detected: h.value, confidence: h.confidence, severity: 'HIGH', note: `Declared ${declaredHeight} (petite) but model appears ${h.value}` })
  }
  if ((dh.includes("5'8") || dh.includes("5'9") || dh.includes("5'10") || dh.includes("5'11") || dh.includes("6'")) && !hv.includes('tall')) {
    issues.push({ attr: 'Model height', declared: declaredHeight, detected: h.value, confidence: h.confidence, severity: 'HIGH', note: `Declared ${declaredHeight} (tall) but model appears ${h.value}` })
  }

  const bv = b.value.toLowerCase()
  const ds = (declaredSize || '').toUpperCase()
  if ((ds === 'XS' || ds === 'S') && (bv.includes('plus') || bv.includes('l-xxl'))) {
    issues.push({ attr: 'Model size', declared: declaredSize, detected: b.value, confidence: b.confidence, severity: 'HIGH', note: `Declared size ${declaredSize} but model appears ${b.value}` })
  }
  if ((ds === 'XL' || ds === 'XXL') && (bv.includes('slim') || bv.includes('xs-s'))) {
    issues.push({ attr: 'Model size', declared: declaredSize, detected: b.value, confidence: b.confidence, severity: 'HIGH', note: `Declared size ${declaredSize} but model appears ${b.value}` })
  }
  return issues
}

export function generateVerdict(rows, modelIssues) {
  const highFails = rows.filter(r => r.status === 'mismatch' && r.severity === 'HIGH')
  const medFails = rows.filter(r => r.status === 'mismatch' && r.severity !== 'HIGH')
  const warnings = rows.filter(r => r.status === 'warning')
  const passes = rows.filter(r => r.status === 'match')

  const failCount = highFails.length + modelIssues.length
  const warnCount = medFails.length + warnings.length

  let status, reason
  if (failCount > 0) {
    status = 'FAIL'
    reason = `${failCount} critical mismatch${failCount > 1 ? 'es' : ''} detected`
  } else if (warnCount > 0) {
    status = 'WARNING'
    reason = `${warnCount} warning${warnCount > 1 ? 's' : ''} detected`
  } else {
    status = 'PASS'
    reason = `All ${passes.length} checks passed — listing verified`
  }

  return { status, reason, counts: { fail: failCount, warn: warnCount, pass: passes.length } }
}
