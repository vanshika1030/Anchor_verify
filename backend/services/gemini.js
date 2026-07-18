import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import crypto from 'crypto'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const CACHE_DIR = path.join(process.cwd(), '.cache')
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR)

const MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite']
const MAX_RETRIES = 3
const BASE_DELAY_MS = 2000

let genAI = null

// --- SDK BUG FIX ---
const originalFetch = global.fetch
global.fetch = async (url, options) => {
  if (url.toString().includes('generativelanguage.googleapis.com')) {
    const apiKey = process.env.GEMINI_API_KEY
    if (apiKey && !url.toString().includes('key=')) {
      if (options?.headers) {
        delete options.headers['Authorization']
        delete options.headers.Authorization
      }
      const sep = url.toString().includes('?') ? '&' : '?'
      url = `${url}${sep}key=${apiKey}`
    }
  }
  return originalFetch(url, options)
}

export function initGemini(apiKey) {
  genAI = new GoogleGenerativeAI(apiKey)
}

// ─── Retry with backoff, model fallback & CACHING ────────────────

function getCacheKey(promptParts) {
  const hash = crypto.createHash('sha256')
  for (const p of promptParts) {
    if (p.text) hash.update(p.text)
    if (p.inlineData) hash.update(p.inlineData.data) // Hash FULL image data — no truncation
  }
  return hash.digest('hex')
}

async function callWithRetry(promptParts, modelIdx = 0, attempt = 0) {
  const cacheKey = getCacheKey(promptParts)
  const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`)
  
  // SMART FIX: If we have seen these images before, return instantly from cache!
  if (fs.existsSync(cacheFile)) {
    console.log('[CACHE] ⚡ Cache hit! Bypassing API to save quota.')
    return fs.readFileSync(cacheFile, 'utf-8')
  }

  if (modelIdx >= MODELS.length) {
    throw new Error('All Gemini models exhausted — API rate limit reached. Please wait 60 seconds and try again.')
  }

  const modelName = MODELS[modelIdx]
  try {
    const model = genAI.getGenerativeModel({ 
      model: modelName,
      generationConfig: { temperature: 0 }  // Maximum consistency
    })
    const result = await model.generateContent(promptParts)
    const text = result.response.text()
    
    // Save successful API response to cache
    fs.writeFileSync(cacheFile, text, 'utf-8')
    return text
  } catch (err) {
    const msg = err.message || ''

    if (msg.includes('404') || msg.includes('not found')) {
      console.warn(`Model ${modelName} not available, falling back to ${MODELS[modelIdx + 1]}`)
      return callWithRetry(promptParts, modelIdx + 1, 0)
    }

    if (msg.includes('429') || msg.includes('quota')) {
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt)
        console.warn(`Rate limit on ${modelName}, retrying in ${delay}ms (Attempt ${attempt + 1}/${MAX_RETRIES})`)
        await new Promise(r => setTimeout(r, delay))
        return callWithRetry(promptParts, modelIdx, attempt + 1)
      }
      console.warn(`Exhausted retries on ${modelName}, trying ${MODELS[modelIdx + 1]}`)
      return callWithRetry(promptParts, modelIdx + 1, 0)
    }

    console.warn(`Unknown error on ${modelName}:`, msg, 'falling back to next model')
    return callWithRetry(promptParts, modelIdx + 1, 0)
  }
}

function parseJSON(text) {
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  }
  return JSON.parse(cleaned)
}

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

// ─── Strict Enum Lists (forces consistent terminology) ────────────

const ENUMS = {
  garment_type: ['Kurti', 'Kurta', 'Dress', 'Top', 'Shirt', 'Blouse', 'Tunic', 'Saree', 'Lehenga', 'Dupatta', 'Palazzo', 'Skirt', 'Trousers', 'Jeans', 'Shorts', 'Jumpsuit', 'Co-ord Set', 'Shrug', 'Jacket', 'Sweater', 'T-shirt', 'Gown', 'Kaftan', 'Sharara', 'Churidar', 'Salwar', 'Nehru Jacket', 'Other'],
  primary_color: ['Black', 'White', 'Navy Blue', 'Red', 'Pink', 'Green', 'Yellow', 'Orange', 'Purple', 'Brown', 'Grey', 'Beige', 'Maroon', 'Teal', 'Turquoise', 'Coral', 'Peach', 'Lavender', 'Mustard', 'Olive', 'Cream', 'Rust', 'Gold', 'Silver', 'Multi-color', 'Other'],
  secondary_color: ['None', 'Black', 'White', 'Navy Blue', 'Red', 'Pink', 'Green', 'Yellow', 'Orange', 'Purple', 'Brown', 'Grey', 'Beige', 'Maroon', 'Gold', 'Silver', 'Multi-color', 'Other'],
  pattern_type: ['Solid', 'Floral', 'Striped', 'Checked', 'Polka Dot', 'Geometric', 'Abstract', 'Paisley', 'Animal Print', 'Tribal', 'Ikat', 'Bandhani', 'Block Print', 'Ethnic Motif', 'Graphic', 'Colorblocked', 'Ombre', 'Embroidered', 'Self-design', 'Not determinable'],
  fabric_appearance: ['Cotton', 'Silk', 'Georgette', 'Chiffon', 'Crepe', 'Rayon', 'Polyester', 'Linen', 'Denim', 'Velvet', 'Satin', 'Net', 'Lace', 'Knit', 'Jersey', 'Wool', 'Khadi', 'Chanderi', 'Banarasi', 'Organza', 'Not determinable'],
  overall_length: ['Crop', 'Waist Length', 'Hip Length', 'Knee Length', 'Below Knee', 'Calf Length', 'Ankle Length', 'Floor Length', 'Not determinable'],
  sleeve_length: ['Sleeveless', 'Cap Sleeve', 'Short Sleeve', 'Elbow Length', '3/4 Sleeve', 'Full Sleeve', 'Not determinable'],
  neck_type: ['Round Neck', 'V-Neck', 'Mandarin Collar', 'Shirt Collar', 'Square Neck', 'Boat Neck', 'Keyhole', 'Sweetheart', 'Halter', 'Off-Shoulder', 'Stand Collar', 'Cowl Neck', 'Tie-Up', 'Not determinable'],
  silhouette: ['A-Line', 'Straight', 'Fit and Flare', 'Bodycon', 'Peplum', 'Asymmetric', 'Wrap', 'Tent', 'Sheath', 'Not determinable'],
  fit: ['Slim', 'Regular', 'Relaxed', 'Oversized', 'Not determinable'],
  embellishment: ['None', 'Embroidery', 'Sequins', 'Beadwork', 'Mirror Work', 'Zari', 'Lace Trim', 'Tassels', 'Buttons', 'Patchwork', 'Not determinable'],
  transparency: ['Opaque', 'Semi-Sheer', 'Sheer', 'Not determinable'],
  hemline: ['Straight', 'Curved', 'Asymmetric', 'High-Low', 'Scalloped', 'Ruffled', 'Not determinable'],
  occasion_style: ['Casual', 'Formal', 'Party', 'Ethnic', 'Festive', 'Office', 'Lounge', 'Bridal', 'Not determinable'],
  motif_description: ['None', 'Floral', 'Paisley', 'Geometric', 'Animal', 'Abstract', 'Tribal', 'Mandala', 'Botanical', 'Birds', 'Not determinable'],
  closure_type: ['Slip On', 'Button', 'Zip', 'Tie-Up', 'Hook and Eye', 'Drawstring', 'Wrap', 'Not determinable'],
  structural_features: ['None', 'Pleats', 'Gathers', 'Pintucks', 'Darts', 'Side Slits', 'Pockets', 'Belt/Sash', 'Layered', 'Not determinable'],
}

function buildEnumPromptSection() {
  return Object.entries(ENUMS).map(([key, values]) => 
    `  "${key}": MUST be one of: ${JSON.stringify(values)}`
  ).join('\n')
}

// ─── Prompts (with Strict Enums) ─────────────────────────────

const ANCHOR_PROMPT = `You are a garment attribute extraction system for Myntra (Indian fashion e-commerce).
You are given images of a REAL physical garment (flat-lay or handheld photos taken by the seller).

CRITICAL RULES:
1. Each attribute value MUST be chosen from the allowed list below. Do NOT invent new values.
2. FLAT-LAY LENGTH: If the garment is folded or not worn, set overall_length to "Not determinable".
3. PATTERN: Do NOT default to "Solid" unless you are certain there is no print, texture, or motif.
4. PRINTS VS EMBELLISHMENTS: Printed patterns are NOT embellishments. If the fabric is printed, embellishment is "None".

ALLOWED VALUES:
${buildEnumPromptSection()}

For each attribute, return:
- "value": chosen from the allowed list above
- "confidence": "HIGH" | "MEDIUM" | "LOW"

Return ONLY valid JSON (no markdown):
{
${Object.keys(ENUMS).map(k => `  "${k}": {"value": "", "confidence": ""}`).join(',\n')}
}`

const CATALOG_PROMPT_JOINT = `You are a garment attribute extraction system for Myntra.

You are given TWO sets of images of the SAME garment:
- ANCHOR images (flat-lay photos of the real product) — these appear FIRST
- CATALOG images (studio/model shots for the listing) — these appear AFTER

Your job: extract attributes from the CATALOG images.
Because these are the SAME garment, use EXACTLY the same terminology for both.
If the anchor looks "Floral", the catalog MUST also say "Floral", not "Printed".

CRITICAL RULES:
1. Each attribute value MUST be chosen from the allowed list below.
2. Use the SAME value as you would for the anchor images, since it is the same garment.
3. PRINTS VS EMBELLISHMENTS: Printed fabric is NOT an embellishment.

ALLOWED VALUES:
${buildEnumPromptSection()}

ALSO estimate the model's appearance (if visible):
- model_apparent_height: MUST be one of: ["petite (under 5'4)", "average (5'4-5'7)", "tall (5'8+)", "No model visible"]
- model_apparent_build: MUST be one of: ["slim (XS-S)", "average (S-M)", "athletic (M-L)", "plus-size (L-XXL)", "No model visible"]

Return ONLY valid JSON:
{
${Object.keys(ENUMS).map(k => `  "${k}": {"value": "", "confidence": ""}`).join(',\n')},
  "model_apparent_height": {"value": "", "confidence": ""},
  "model_apparent_build": {"value": "", "confidence": ""}
}`

// ─── Deterministic Comparison Engine ─────────────────────────────

const SYNONYMS = {
  fabric: {
    cotton:     ['woven', 'woven cotton', 'cotton blend', 'pure cotton', 'cotton fabric', 'handloom cotton'],
    georgette:  ['sheer', 'chiffon', 'chiffon-like'],
    polyester:  ['synthetic', 'poly', 'poly blend'],
    silk:       ['satin', 'silky', 'silk blend', 'art silk'],
    linen:      ['linen blend', 'linen cotton'],
    rayon:      ['viscose', 'rayon blend', 'modal'],
    crepe:      ['crepe fabric'],
    denim:      ['denim fabric', 'jean'],
    knit:       ['knitted', 'jersey', 'stretch'],
  },
  color: {
    blue:   ['navy', 'navy blue', 'dark blue', 'light blue', 'sky blue', 'royal blue', 'cobalt', 'indigo', 'teal blue'],
    red:    ['maroon', 'burgundy', 'wine', 'crimson', 'scarlet', 'cherry'],
    green:  ['olive', 'dark green', 'emerald', 'sage', 'forest green', 'teal', 'mint'],
    pink:   ['rose', 'blush', 'salmon', 'magenta', 'fuchsia', 'baby pink', 'hot pink', 'dusty pink'],
    white:  ['off-white', 'cream', 'ivory', 'off white', 'snow white', 'pearl'],
    black:  ['jet black', 'charcoal black'],
    yellow: ['mustard', 'golden', 'gold', 'amber', 'ochre', 'lemon'],
    orange: ['rust', 'burnt orange', 'tangerine', 'peach', 'coral'],
    purple: ['violet', 'lavender', 'plum', 'mauve', 'lilac'],
    brown:  ['tan', 'beige', 'khaki', 'chocolate', 'camel', 'coffee', 'taupe'],
    grey:   ['gray', 'charcoal', 'silver', 'ash'],
    multi:  ['multicolor', 'multicolored', 'multi-color', 'multi color'],
  },
  neck: {
    round:     ['round neck', 'crew neck', 'crew', 'u-neck', 'u neck'],
    'v-neck':  ['v neck', 'v-shape', 'v shape', 'deep v'],
    mandarin:  ['mandarin collar', 'band collar', 'stand collar', 'chinese collar'],
    collar:    ['shirt collar', 'collared', 'spread collar', 'peter pan'],
    square:    ['square neck', 'straight neck'],
    keyhole:   ['keyhole neck'],
    boat:      ['boat neck', 'bateau'],
  },
  sleeve: {
    short:       ['short sleeve', 'half sleeve', 'short sleeves', 'half sleeves'],
    elbow:       ['elbow length', 'elbow sleeve', '3/4 sleeve', 'three quarter', '3/4', 'three-quarter'],
    long:        ['long sleeve', 'full sleeve', 'full sleeves', 'long sleeves', 'wrist length'],
    sleeveless:  ['no sleeve', 'strapless', 'without sleeve', 'no sleeves'],
    cap:         ['cap sleeve', 'cap sleeves'],
    flutter:     ['flutter sleeve', 'bell sleeve', 'flared sleeve'],
  },
  fit: {
    loose:   ['relaxed', 'flare', 'flared', 'a-line', 'free flowing', 'breezy', 'oversized', 'comfort'],
    regular: ['standard', 'normal', 'classic', 'straight'],
    fitted:  ['slim', 'slim fit', 'body-hugging', 'bodycon', 'tailored', 'form-fitting', 'snug'],
  },
  occasion: {
    casual: ['daily', 'daily wear', 'everyday', 'informal', 'casual wear'],
    ethnic: ['indian', 'traditional', 'festive', 'cultural', 'ethnic wear', 'puja', 'pooja'],
  },
  transparency: {
    opaque: ['not transparent', 'solid', 'non-transparent', 'not sheer'],
    sheer: ['transparent', 'see-through', 'translucent'],
  }
}

function getAttrValue(attrs, key) {
  if (!attrs) return null
  const entry = attrs[key]
  if (!entry) return null
  const val = typeof entry === 'string' ? entry : entry.value
  if (!val || val === 'Not determinable' || val === 'Not detected' || val === 'N/A' || val === 'None' || val === '') return null
  return val
}

function getAttrConfidence(attrs, key) {
  if (!attrs) return null
  const entry = attrs[key]
  if (!entry) return null
  return typeof entry === 'string' ? 'HIGH' : (entry.confidence || 'MEDIUM')
}

function getSynonymCategory(key) {
  const map = {
    primary_color: 'color', secondary_color: 'color',
    fabric_appearance: 'fabric',
    neck_type: 'neck', sleeve_length: 'sleeve',
    fit: 'fit', silhouette: 'fit',
    occasion_style: 'occasion',
    pattern_type: 'pattern', motif_description: 'pattern',
    overall_length: 'length', transparency: 'transparency',
  }
  return map[key] || null
}

function fuzzyMatch(val1, val2, category) {
  if (!val1 || !val2) return 'skip'
  const v1 = val1.toLowerCase().trim()
  const v2 = val2.toLowerCase().trim()

  if (v1 === v2) return 'match'
  if (v1.includes(v2) || v2.includes(v1)) return 'match'

  const map = SYNONYMS[category]
  if (map) {
    for (const [, syns] of Object.entries(map)) {
      const v1Match = syns.some(t => v1.includes(t) || t.includes(v1))
      const v2Match = syns.some(t => v2.includes(t) || t.includes(v2))
      const keyForSyns = Object.entries(map).find(([, s]) => s === syns)?.[0]
      const v1MatchKey = keyForSyns && (v1.includes(keyForSyns) || keyForSyns.includes(v1))
      const v2MatchKey = keyForSyns && (v2.includes(keyForSyns) || keyForSyns.includes(v2))

      if ((v1Match || v1MatchKey) && (v2Match || v2MatchKey)) return 'match'
    }
  }

  if (['none', 'no', 'not applicable', 'n/a', 'na'].includes(v1) &&
      ['none', 'no', 'not applicable', 'n/a', 'na'].includes(v2)) return 'match'

  return 'mismatch'
}

const ATTR_CONFIG = [
  { key: 'garment_type',       severity: 'HIGH',   strict: true  },
  { key: 'primary_color',      severity: 'HIGH',   strict: true  },
  { key: 'secondary_color',    severity: 'LOW',    strict: false },
  { key: 'pattern_type',       severity: 'HIGH',   strict: true  },
  { key: 'fabric_appearance',  severity: 'MEDIUM', strict: false },
  { key: 'overall_length',     severity: 'HIGH',   strict: true  },
  { key: 'sleeve_length',      severity: 'HIGH',   strict: true  },
  { key: 'neck_type',          severity: 'MEDIUM', strict: false },
  { key: 'silhouette',         severity: 'LOW',    strict: false },
  { key: 'fit',                severity: 'LOW',    strict: false },
  { key: 'embellishment',      severity: 'HIGH',   strict: true  },
  { key: 'transparency',       severity: 'HIGH',   strict: true  },
  { key: 'hemline',            severity: 'LOW',    strict: false },
  { key: 'occasion_style',     severity: 'LOW',    strict: false },
  { key: 'motif_description',  severity: 'LOW',    strict: false },
  { key: 'closure_type',       severity: 'LOW',    strict: false },
  { key: 'structural_features',severity: 'LOW',    strict: false },
]

export function compareAttributesDeterministic(anchorAttrs, catalogAttrs, declaredAttrs) {
  return ATTR_CONFIG.map(({ key, severity, strict }) => {
    const anchorVal = getAttrValue(anchorAttrs, key)
    const catalogVal = getAttrValue(catalogAttrs, key)
    const declaredVal = getAttrValue(declaredAttrs, key)
    const category = getSynonymCategory(key)

    let anchorConf = getAttrConfidence(anchorAttrs, key)
    let catalogConf = getAttrConfidence(catalogAttrs, key)

    if (!anchorVal && !catalogVal && !declaredVal) {
      return { key, anchor_value: null, catalog_value: null, declared_value: null,
               status: 'skip', severity: 'LOW', anchor_confidence: null, catalog_confidence: null, note: '' }
    }

    const acResult = fuzzyMatch(anchorVal, catalogVal, category)
    const adResult = fuzzyMatch(anchorVal, declaredVal, category)
    const cdResult = fuzzyMatch(catalogVal, declaredVal, category)

    let status = 'match'
    let note = ''
    
    // Cross-check LLM length with CV length
    if (key === 'overall_length' && anchorAttrs.cv_overall_length) {
      const cvVal = anchorAttrs.cv_overall_length.value
      const llmCvMatch = fuzzyMatch(anchorVal, cvVal, category)
      if (llmCvMatch === 'mismatch' && anchorVal !== 'Not determinable') {
        note = `Visual AI estimated "${anchorVal}" but Geometric check says "${cvVal}". Please confirm.`
        status = 'warning'
        severity = 'HIGH'
        anchorConf = 'LOW' // Disagreement lowers confidence
        return {
          key, anchor_value: anchorVal, catalog_value: catalogVal, declared_value: declaredVal,
          status, severity, anchor_confidence: anchorConf, catalog_confidence: catalogConf, note,
          needs_review: true, suggested_fallback: cvVal
        }
      }
    }

    if (acResult === 'mismatch' && anchorVal && catalogVal) {
      status = 'mismatch'
      note = `Anchor shows "${anchorVal}" but catalog shows "${catalogVal}"`
      if (!strict) severity = 'MEDIUM'
    } else if (adResult === 'mismatch' && anchorVal && declaredVal) {
      if (acResult === 'match') {
        status = 'warning'
        severity = strict ? 'MEDIUM' : 'LOW'
        note = `Both images show "${anchorVal}" but seller declared "${declaredVal}"`
      } else {
        status = 'warning'
        severity = strict ? 'MEDIUM' : 'LOW'
        note = `Anchor shows "${anchorVal}" but seller declared "${declaredVal}"`
      }
    } else if (cdResult === 'mismatch' && catalogVal && declaredVal && !anchorVal) {
      status = 'warning'
      severity = 'MEDIUM'
      note = `Catalog shows "${catalogVal}" but seller declared "${declaredVal}"`
    } else if (acResult === 'skip' && adResult === 'skip' && cdResult === 'skip') {
      status = 'skip'
    }

    return {
      key, anchor_value: anchorVal, catalog_value: catalogVal, declared_value: declaredVal,
      status, severity, anchor_confidence: anchorConf, catalog_confidence: catalogConf, note,
    }
  })
}

export function generateVerdict(comparison, modelIssues = []) {
  const highFails = comparison.filter(r => r.status === 'mismatch' && r.severity === 'HIGH')
  const medFails = comparison.filter(r => r.status === 'mismatch' && r.severity !== 'HIGH')
  const warnings = comparison.filter(r => r.status === 'warning')
  const passes = comparison.filter(r => r.status === 'match')

  const criticalCount = highFails.length + modelIssues.length
  let status = 'PASS'
  let reason = 'All checks passed — product matches catalog attributes closely.'

  if (modelIssues.find(i => i.extractionFailed)) {
    return {
      status: 'UNVERIFIED',
      reason: 'Could not complete check. Missing or failed catalog attribute extraction.',
      critical_fails: 0,
      warnings: 0
    }
  }

  if (criticalCount > 0) {
    status = 'FAIL'
    const issues = [...highFails.map(f => f.key), ...modelIssues.map(m => m.attr)]
    reason = `Critical mismatches in: ${issues.join(', ')}`
  } else if (medFails.length > 0 || warnings.length > 0) {
    status = 'WARNING'
    const warnKeys = [...medFails, ...warnings].map(f => f.key)
    reason = `Approved with warnings: minor differences in ${warnKeys.join(', ')}`
  }

  return {
    status,
    reason,
    critical_issues: highFails.map(f => f.note),
    summary: {
      total: comparison.length,
      matches: passes.length,
      warnings: warnings.length + medFails.length,
      mismatches: highFails.length,
    }
  }
}

// ─── Computer Vision: Flat-Lay Aspect Ratio Check ────────────────

/**
 * Mathematically calculate aspect ratio of non-transparent garment mask.
 * Does not require a body/pose, completely deterministic CV.
 */
export async function getGarmentBoundingBoxRatio(imagePath) {
  try {
    const pythonScript = path.join(process.cwd(), 'services', 'segmentation_cli.py')
    
    // Call python script via execFile for security (no shell injection)
    const { stdout } = await execFileAsync('python', [pythonScript, imagePath], { maxBuffer: 1024 * 1024 * 10 })
    
    const result = JSON.parse(stdout)
    if (result.success) {
      return { 
        ratio: result.ratio.toFixed(2), 
        length_category: result.length_category,
        cutout_path: result.cutout_path
      }
    } else {
      console.warn("Segmentation CLI returned error:", result.error)
      return null
    }
  } catch (err) {
    console.warn("Could not calculate aspect ratio using rembg:", err.message)
    return null
  }
}

// ─── The Correction Co-Pilot ────────────────────────────────────────

/**
 * Generates actionable corrections for the seller based on mismatches.
 */
export function generateCorrections(comparisonResult, modelIssues = []) {
  const corrections = []

  // Iterate over mismatches/warnings to suggest seller fixes
  comparisonResult.forEach(row => {
    if ((row.status === 'mismatch' || row.status === 'warning') && row.declared_value) {
      // The AI detected a visual truth that conflicts with seller's input
      const visualTruth = row.anchor_value || row.catalog_value
      if (visualTruth) {
        corrections.push({
          field: row.key,
          current_value: row.declared_value,
          suggested_value: visualTruth,
          confidence: row.anchor_confidence || 'MEDIUM',
          needs_review: row.needs_review || (row.anchor_confidence !== 'HIGH'),
          reason: row.needs_review 
            ? row.note 
            : `Our visual analysis thinks this is "${visualTruth}" rather than "${row.declared_value}". Could you confirm? Updating this improves search accuracy.`
        })
      }
    }
  })

  modelIssues.forEach(issue => {
    const match = issue.note.match(/model appears (.*)/)
    if (match) {
      corrections.push({
        field: issue.attr.toLowerCase().replace(' ', '_'),
        current_value: issue.declared,
        suggested_value: match[1],
        confidence: issue.confidence || 'MEDIUM',
        needs_review: issue.confidence !== 'HIGH',
        reason: `The catalog model seems to match a "${match[1]}" profile. Could you confirm? Updating this ensures your item appears in the right fit filters.`
      })
    }
  })

  return corrections
}

// ─── Public API Exports ─────────────────────────────────────────────

export async function extractAnchorAttributes(imagePaths) {
  const parts = [ANCHOR_PROMPT]
  for (const p of imagePaths) { parts.push(fileToInlineData(p)) }
  const text = await callWithRetry(parts)
  const attrs = parseJSON(text)

  // Inject the deterministic CV flat-lay length verification
  if (imagePaths.length > 0) {
    const cvRatio = await getGarmentBoundingBoxRatio(imagePaths[0])
    if (cvRatio && attrs.overall_length) {
      // DO NOT blindly overwrite the LLM. Keep it as an independent signal.
      attrs.cv_overall_length = {
        value: cvRatio.length_category,
        confidence: "HIGH",
        ratio: cvRatio.ratio
      }
    }
  }
  
  return attrs
}

export async function extractCatalogAttributes(catalogPaths, anchorPaths = []) {
  // JOINT PROMPTING: feed anchor images first for context, then catalog images
  const parts = [{ text: CATALOG_PROMPT_JOINT }]
  // Anchor images first (context)
  for (const p of anchorPaths) { parts.push(fileToInlineData(p)) }
  // Then catalog images (what we're extracting from)
  for (const p of catalogPaths) { parts.push(fileToInlineData(p)) }
  const text = await callWithRetry(parts)
  return parseJSON(text)
}

export async function verifyFabric(anchorCloseupPath, catalogPaths, declaredFabric) {
  const parts = [`You are verifying fabric between a real product closeup and catalog images.
Image 1: CLOSEUP of real fabric. Remaining: catalog photos.
Declared fabric: "${declaredFabric || 'Not declared'}"
Return ONLY valid JSON:
{ "fabric_identifiable_in_catalog": true/false, "fabric_matches_anchor": true/false, "declared_fabric_plausible": true/false, "anchor_fabric_appearance": "", "catalog_fabric_appearance": "", "issue": "description or null", "confidence": "HIGH/MEDIUM/LOW" }`]
  if (anchorCloseupPath) parts.push(fileToInlineData(anchorCloseupPath))
  for (const p of catalogPaths) { parts.push(fileToInlineData(p)) }
  const text = await callWithRetry(parts)
  return parseJSON(text)
}

export function checkModelProportions(catalogAttrs, declaredHeight, declaredSize) {
  const issues = [];
  const h = catalogAttrs?.model_apparent_height;
  const b = catalogAttrs?.model_apparent_build;
  if (!h || !b || h.value === 'No model visible') return issues;

  const hv = h.value.toLowerCase();
  const dh = (declaredHeight || '').toLowerCase();
  
  let totalInches = null;
  const cmMatch = dh.match(/(\d+(?:\.\d+)?)\s*cm/);
  if (cmMatch) { totalInches = parseFloat(cmMatch[1]) / 2.54; }
  else {
    const ftMatch = dh.match(/(\d+)\s*(?:'|ft|foot|feet)\s*(?:(\d+)\s*(?:"|in|inches)?)?/);
    if (ftMatch) {
      const feet = parseInt(ftMatch[1]);
      const inches = parseInt(ftMatch[2] || '0');
      totalInches = feet * 12 + inches;
    }
  }

  if (totalInches !== null) {
    if (totalInches < 64 && !hv.includes('petite')) issues.push({ attr: 'Model height', declared: declaredHeight, detected: h.value, confidence: h.confidence, severity: 'HIGH', note: `Declared ${declaredHeight} (petite) but model appears ${h.value}` });
    else if (totalInches >= 64 && totalInches <= 67 && (hv.includes('petite') || hv.includes('tall'))) issues.push({ attr: 'Model height', declared: declaredHeight, detected: h.value, confidence: h.confidence, severity: 'MEDIUM', note: `Declared ${declaredHeight} (average) but model appears ${h.value}` });
    else if (totalInches > 67 && !hv.includes('tall')) issues.push({ attr: 'Model height', declared: declaredHeight, detected: h.value, confidence: h.confidence, severity: 'HIGH', note: `Declared ${declaredHeight} (tall) but model appears ${h.value}` });
  }

  const bv = b.value.toLowerCase();
  const ds = (declaredSize || '').toUpperCase().replace(/[^A-Z]/g, '');
  
  if ((ds === 'XS' || ds === 'S') && (bv.includes('plus') || bv.includes('l-xxl'))) issues.push({ attr: 'Model size', declared: declaredSize, detected: b.value, confidence: b.confidence, severity: 'HIGH', note: `Declared size ${declaredSize} but model appears ${b.value}` });
  else if ((ds === 'M' || ds === 'L') && (bv.includes('slim') || bv.includes('xs-s') || bv.includes('plus'))) issues.push({ attr: 'Model size', declared: declaredSize, detected: b.value, confidence: b.confidence, severity: 'MEDIUM', note: `Declared size ${declaredSize} but model appears ${b.value}` });
  else if ((ds === 'XL' || ds === 'XXL' || ds.includes('X')) && (bv.includes('slim') || bv.includes('xs-s') || bv.includes('average'))) issues.push({ attr: 'Model size', declared: declaredSize, detected: b.value, confidence: b.confidence, severity: 'HIGH', note: `Declared size ${declaredSize} but model appears ${b.value}` });
  
  return issues;
}

export async function generateListingMetadata(imagePaths, attributes) {
  const promptText = `You are a Myntra listing generator. Generate a complete product listing based on these verified attributes: ${JSON.stringify(attributes)}.

Return ONLY valid JSON with these exact keys:
{
  "title": "Product title, max 60 chars, SEO-optimized for Myntra search",
  "description": "2-3 sentence product description highlighting key features",
  "bullets": ["Bullet 1", "Bullet 2", "Bullet 3"],
  "key_features": ["Feature 1", "Feature 2", "Feature 3", "Feature 4"],
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "category_path": "Women > Ethnic Wear > Kurtis",
  "ideal_for": "Women",
  "fabric_details": "Fabric composition",
  "care_instructions": "Wash care instructions",
  "size_fit_note": "Size and fit note for the buyer"
}`
  
  const parts = [{ text: promptText }]
  if (imagePaths && imagePaths.length > 0) {
    parts.push(fileToInlineData(imagePaths[0]))
  }
  
  const text = await callWithRetry(parts)
  return parseJSON(text)
}

export async function generateCatalogImage(imagePaths, attributes, cvOverallLength) {
  // Real compositing: segment the garment and place it on a clean e-commerce background.
  if (!imagePaths || imagePaths.length === 0) return null
  
  const anchorPath = imagePaths[0]
  const parsedPath = path.parse(anchorPath)
  const outputPath = path.join(process.cwd(), 'uploads', `gen_${parsedPath.name}.png`)
  
  try {
    // Step 1: Get segmented cutout (real garment, no background)
    let sourceBuffer
    if (cvOverallLength && cvOverallLength.cutout_path && fs.existsSync(cvOverallLength.cutout_path)) {
      sourceBuffer = fs.readFileSync(cvOverallLength.cutout_path)
    } else {
      // Try to segment on the fly
      try {
        const pythonScript = path.join(process.cwd(), 'services', 'segmentation_cli.py')
        const { stdout } = await execFileAsync('python', [pythonScript, anchorPath], { maxBuffer: 1024 * 1024 * 10 })
        const segResult = JSON.parse(stdout)
        if (segResult.success && segResult.cutout_path) {
          sourceBuffer = fs.readFileSync(segResult.cutout_path)
        } else {
          sourceBuffer = fs.readFileSync(anchorPath)
        }
      } catch {
        sourceBuffer = fs.readFileSync(anchorPath)
      }
    }
    
    // Step 2: Resize the garment to fit within the canvas, preserving aspect ratio
    const resizedGarment = await sharp(sourceBuffer)
      .resize(500, 700, { fit: 'inside', withoutEnlargement: false })
      .png()
      .toBuffer()
    
    // Step 3: Create a clean white canvas and composite the garment centered on it
    const garmentMeta = await sharp(resizedGarment).metadata()
    const canvasW = 600
    const canvasH = 800
    const left = Math.round((canvasW - garmentMeta.width) / 2)
    const top = Math.round((canvasH - garmentMeta.height) / 2)
    
    // Create SVG border that matches the canvas exactly
    const borderSvg = `<svg width="${canvasW}" height="${canvasH}"><rect x="4" y="4" width="${canvasW - 8}" height="${canvasH - 8}" fill="none" stroke="#e0e0e0" stroke-width="2" rx="8"/></svg>`
    
    await sharp({
      create: { width: canvasW, height: canvasH, channels: 4, background: { r: 248, g: 248, b: 248, alpha: 1 } }
    })
    .composite([
      { input: resizedGarment, top, left },
      { input: Buffer.from(borderSvg), top: 0, left: 0 }
    ])
    .png()
    .toFile(outputPath)
      
    return `http://localhost:3001/uploads/gen_${parsedPath.name}.png`
  } catch (err) {
    console.error("Failed to composite catalog image:", err)
    return null
  }
}

export async function runClipSimilarity(anchorPath, catalogPath) {
  try {
    const pythonScript = path.join(process.cwd(), 'services', 'clip_similarity_cli.py')
    const { stdout } = await execFileAsync('python', [pythonScript, anchorPath, catalogPath], { maxBuffer: 1024 * 1024 * 10 })
    
    const result = JSON.parse(stdout)
    if (result.success) {
      return result
    } else {
      console.warn("CLIP CLI returned error:", result.error)
      return null
    }
  } catch (err) {
    console.warn("Could not calculate CLIP similarity:", err.message)
    return null
  }
}

