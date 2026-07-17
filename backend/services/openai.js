import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

let openai = null
const MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

export function initOpenAI(apiKey) {
  openai = new OpenAI({
    apiKey,
    baseURL: 'https://api.groq.com/openai/v1'
  })
}

// ─── Parse JSON robustly ─────────────────────────────────────────────

function parseJSON(text) {
  let cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim()
  const firstObj = cleaned.indexOf('{')
  const firstArr = cleaned.indexOf('[')
  const first = (firstObj >= 0 && firstArr >= 0) ? Math.min(firstObj, firstArr)
    : firstObj >= 0 ? firstObj : firstArr >= 0 ? firstArr : -1
  const last = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'))
  if (first >= 0 && last > first) return JSON.parse(cleaned.substring(first, last + 1))
  return JSON.parse(cleaned)
}

// ─── Resize + encode image (token-efficient) ─────────────────────────

async function fileToImage(filePath) {
  const resized = await sharp(filePath)
    .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 55 })
    .toBuffer()
  return {
    type: 'image_url',
    image_url: { url: `data:image/jpeg;base64,${resized.toString('base64')}` }
  }
}

// ─── Call LLM with auto-retry on 429 ─────────────────────────────────

async function callLLM(messages, maxTokens = 3000) {
  if (!openai) throw new Error('LLM not initialized')
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await openai.chat.completions.create({
        model: MODEL, messages, max_tokens: maxTokens, temperature: 0.1,
      })
      return res.choices[0].message.content
    } catch (err) {
      if (err.status === 429 && attempt < 2) {
        const wait = (parseInt(err.headers?.get?.('retry-after') || '18', 10) + 3) * 1000
        console.log(`Rate limited. Waiting ${wait / 1000}s before retry ${attempt + 2}/3...`)
        await new Promise(r => setTimeout(r, wait))
        continue
      }
      throw err
    }
  }
}


// ═════════════════════════════════════════════════════════════════════
//  1. EXTRACT ATTRIBUTES FROM IMAGES (LLM does what it's good at)
// ═════════════════════════════════════════════════════════════════════

const EXTRACT_PROMPT = `You are a garment attribute detection system for Myntra (Indian fashion e-commerce).

Analyze the provided image(s) and extract these attributes. For each:
- "value": be specific (e.g. "Elbow length" not "Medium", "Below knee" not "Long")
- "confidence": "HIGH" (clearly visible), "MEDIUM" (inferred), "LOW" (uncertain)

If you cannot determine an attribute, set value to "Not determinable".

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
  "structural_features": {"value": "", "confidence": ""}
}`

const CATALOG_PROMPT = `You are a garment attribute detection system for Myntra.

Analyze the catalog/listing image(s). These are professional model shots showing the garment on a person.

Extract attributes + estimate the model's body:
- model_apparent_height: "petite (under 5'4)" / "average (5'4-5'7)" / "tall (5'8+)" / "No model visible"
- model_apparent_build: "slim (XS-S)" / "average (S-M)" / "athletic (M-L)" / "plus-size (L-XXL)" / "No model visible"

PAY SPECIAL ATTENTION to overall_length — where does the garment end on the model's body? Be very specific:
- "Above waist" / "Waist length" / "Hip length" / "Above knee" / "Knee length" / "Below knee" / "Calf length" / "Ankle length" / "Floor length"

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

/** Extract from anchor images (max 3 images → under 5-image limit) */
export async function extractAnchorAttributes(imagePaths) {
  const paths = imagePaths.slice(0, 3)
  const content = [{ type: 'text', text: EXTRACT_PROMPT }]
  const images = await Promise.all(paths.map(p => fileToImage(p)))
  content.push(...images)
  console.log(`  → Sending ${paths.length} anchor images to LLM...`)
  const text = await callLLM([{ role: 'user', content }])
  return parseJSON(text)
}

/** Extract from catalog images (max 2 images → under 5-image limit) */
export async function extractCatalogAttributes(imagePaths) {
  const paths = imagePaths.slice(0, 2)
  const content = [{ type: 'text', text: CATALOG_PROMPT }]
  const images = await Promise.all(paths.map(p => fileToImage(p)))
  content.push(...images)
  console.log(`  → Sending ${paths.length} catalog images to LLM...`)
  const text = await callLLM([{ role: 'user', content }])
  return parseJSON(text)
}


// ═════════════════════════════════════════════════════════════════════
//  2. DETERMINISTIC COMPARISON (code, not LLM — zero hallucinations)
// ═════════════════════════════════════════════════════════════════════

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
    formal: ['office', 'work', 'professional', 'business', 'formal wear'],
    party:  ['party wear', 'evening', 'cocktail', 'celebration', 'wedding'],
  },
  pattern: {
    floral:   ['floral print', 'flower', 'flowers', 'floral pattern', 'botanical'],
    printed:  ['print', 'prints', 'all-over print', 'allover print', 'graphic print'],
    solid:    ['plain', 'single color', 'self'],
    striped:  ['stripes', 'stripe', 'pinstripe'],
    checked:  ['check', 'checkered', 'plaid', 'gingham'],
    polka:    ['polka dot', 'polka dots', 'dots', 'dotted'],
    abstract: ['geometric', 'abstract print'],
    ethnic:   ['ethnic print', 'block print', 'bandhani', 'ikat', 'ajrakh', 'kalamkari'],
  },
  length: {
    short:   ['short kurti', 'hip length', 'above waist', 'crop', 'cropped', 'waist length', 'above hip'],
    regular: ['regular length', 'above knee', 'mid-thigh', 'knee length'],
    long:    ['long kurti', 'below knee', 'calf length', 'midi', 'ankle length', 'maxi', 'floor length', 'full length'],
  },
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
    overall_length: 'length',
  }
  return map[key] || null
}

function fuzzyMatch(val1, val2, category) {
  if (!val1 || !val2) return 'skip'
  const v1 = val1.toLowerCase().trim()
  const v2 = val2.toLowerCase().trim()

  // Exact match
  if (v1 === v2) return 'match'

  // One contains the other
  if (v1.includes(v2) || v2.includes(v1)) return 'match'

  // Synonym check
  const map = SYNONYMS[category]
  if (map) {
    for (const [, syns] of Object.entries(map)) {
      const allTerms = [Object.keys(map).find(k => map[k] === syns), ...syns].filter(Boolean)
      // Rebuild: key + its synonyms
      const v1Match = syns.some(t => v1.includes(t) || t.includes(v1))
      const v2Match = syns.some(t => v2.includes(t) || t.includes(v2))
      // Check if key itself matches
      const keyForSyns = Object.entries(map).find(([, s]) => s === syns)?.[0]
      const v1MatchKey = keyForSyns && (v1.includes(keyForSyns) || keyForSyns.includes(v1))
      const v2MatchKey = keyForSyns && (v2.includes(keyForSyns) || keyForSyns.includes(v2))

      if ((v1Match || v1MatchKey) && (v2Match || v2MatchKey)) return 'match'
    }
  }

  // Special: "None" vs "None" or both empty-ish
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

/**
 * Deterministic three-way comparison. No LLM involved — pure code.
 * Compares anchor-extracted, catalog-extracted, and seller-declared attributes
 * using synonym maps to avoid false positives.
 */
export function compareAttributesDeterministic(anchorAttrs, catalogAttrs, declaredAttrs) {
  return ATTR_CONFIG.map(({ key, severity, strict }) => {
    const anchorVal = getAttrValue(anchorAttrs, key)
    const catalogVal = getAttrValue(catalogAttrs, key)
    const declaredVal = getAttrValue(declaredAttrs, key)
    const category = getSynonymCategory(key)

    const anchorConf = getAttrConfidence(anchorAttrs, key)
    const catalogConf = getAttrConfidence(catalogAttrs, key)

    // Skip if nothing to compare
    if (!anchorVal && !catalogVal && !declaredVal) {
      return { key, anchor_value: null, catalog_value: null, declared_value: null,
               status: 'skip', severity: 'LOW', anchor_confidence: null, catalog_confidence: null, note: '' }
    }

    // Determine the best comparison pairs
    const acResult = fuzzyMatch(anchorVal, catalogVal, category)  // anchor vs catalog
    const adResult = fuzzyMatch(anchorVal, declaredVal, category) // anchor vs declared
    const cdResult = fuzzyMatch(catalogVal, declaredVal, category) // catalog vs declared

    let status = 'match'
    let note = ''

    // CRITICAL: anchor vs catalog mismatch (this catches the short kurti vs long dress)
    if (acResult === 'mismatch' && anchorVal && catalogVal) {
      status = 'mismatch'
      note = `Anchor shows "${anchorVal}" but catalog shows "${catalogVal}"`
      if (strict) {
        // Keep HIGH severity
      } else {
        severity = 'MEDIUM'
      }
    }
    // Anchor vs declared mismatch
    else if (adResult === 'mismatch' && anchorVal && declaredVal) {
      // If catalog agrees with anchor, trust anchor over declared → warning only
      if (acResult === 'match') {
        status = 'warning'
        severity = strict ? 'MEDIUM' : 'LOW'
        note = `Both images show "${anchorVal}" but seller declared "${declaredVal}"`
      } else {
        status = 'warning'
        severity = strict ? 'MEDIUM' : 'LOW'
        note = `Anchor shows "${anchorVal}" but seller declared "${declaredVal}"`
      }
    }
    // Catalog vs declared mismatch (anchor unavailable)
    else if (cdResult === 'mismatch' && catalogVal && declaredVal && !anchorVal) {
      status = 'warning'
      severity = 'MEDIUM'
      note = `Catalog shows "${catalogVal}" but seller declared "${declaredVal}"`
    }
    // All skip
    else if (acResult === 'skip' && adResult === 'skip' && cdResult === 'skip') {
      status = 'skip'
    }

    return {
      key,
      anchor_value: anchorVal,
      catalog_value: catalogVal,
      declared_value: declaredVal,
      status,
      severity,
      anchor_confidence: anchorConf,
      catalog_confidence: catalogConf,
      note,
    }
  })
}


// ═════════════════════════════════════════════════════════════════════
//  3. DETERMINISTIC VERDICT (pure code)
// ═════════════════════════════════════════════════════════════════════

export function generateVerdict(comparison, modelIssues = []) {
  const highFails = comparison.filter(r => r.status === 'mismatch' && r.severity === 'HIGH')
  const medFails = comparison.filter(r => r.status === 'mismatch' && r.severity !== 'HIGH')
  const warnings = comparison.filter(r => r.status === 'warning')
  const passes = comparison.filter(r => r.status === 'match')

  const criticalCount = highFails.length + modelIssues.length
  let status = 'PASS'
  let reason = 'All checks passed — product matches catalog attributes closely.'

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


// ═════════════════════════════════════════════════════════════════════
//  4. MODEL PROPORTION CHECK (deterministic)
// ═════════════════════════════════════════════════════════════════════

export function checkModelProportions(catalogAttrs, declaredHeight, declaredSize) {
  const issues = []
  const h = catalogAttrs?.model_apparent_height
  const b = catalogAttrs?.model_apparent_build
  if (!h || !b) return issues
  const hv = (typeof h === 'string' ? h : h.value || '').toLowerCase()
  if (hv === 'no model visible' || !hv) return issues

  const dh = (declaredHeight || '').toLowerCase()
  let totalInches = null
  const cmMatch = dh.match(/(\d+(?:\.\d+)?)\s*cm/)
  if (cmMatch) totalInches = parseFloat(cmMatch[1]) / 2.54
  else {
    const ftMatch = dh.match(/(\d+)\s*(?:'|ft|foot|feet)\s*(?:(\d+)\s*(?:"|in|inches)?)?/)
    if (ftMatch) totalInches = parseInt(ftMatch[1]) * 12 + parseInt(ftMatch[2] || '0')
  }

  if (totalInches !== null) {
    if (totalInches < 64 && !hv.includes('petite'))
      issues.push({ attr: 'Model height', declared: declaredHeight, detected: typeof h === 'string' ? h : h.value, severity: 'HIGH', note: `Declared ${declaredHeight} (petite range) but model appears ${typeof h === 'string' ? h : h.value}` })
    else if (totalInches > 67 && !hv.includes('tall'))
      issues.push({ attr: 'Model height', declared: declaredHeight, detected: typeof h === 'string' ? h : h.value, severity: 'HIGH', note: `Declared ${declaredHeight} (tall range) but model appears ${typeof h === 'string' ? h : h.value}` })
  }

  const bv = (typeof b === 'string' ? b : b.value || '').toLowerCase()
  const ds = (declaredSize || '').toUpperCase().replace(/[^A-Z]/g, '')
  if ((ds === 'XS' || ds === 'S') && (bv.includes('plus') || bv.includes('l-xxl')))
    issues.push({ attr: 'Model size', declared: declaredSize, detected: typeof b === 'string' ? b : b.value, severity: 'HIGH', note: `Declared size ${declaredSize} but model appears ${typeof b === 'string' ? b : b.value}` })

  return issues
}


// ═════════════════════════════════════════════════════════════════════
//  5. GENERATE LISTING METADATA (LLM — good for creative text)
// ═════════════════════════════════════════════════════════════════════

export async function generateListingMetadata(imagePaths, confirmedAttrs) {
  const attrs = JSON.stringify(confirmedAttrs || {}, null, 2)
  const prompt = `You are a Myntra listing specialist. Generate a complete, professional product listing.

CONFIRMED ATTRIBUTES:
${attrs}

Return ONLY valid JSON:
{
  "title": "Professional Myntra-style title (e.g., 'Women Blue Floral Printed Cotton A-Line Kurta')",
  "description": "2-3 sentence product description",
  "key_features": ["feature 1", "feature 2", "feature 3", "feature 4", "feature 5"],
  "care_instructions": "wash care text",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "category_path": "Women > Category > Subcategory",
  "ideal_for": "occasion/use",
  "fabric_details": "material details",
  "size_fit_note": "sizing recommendation"
}`

  const content = [{ type: 'text', text: prompt }]
  // Only send 1 image for metadata to save tokens
  if (imagePaths.length > 0) {
    const img = await fileToImage(imagePaths[0])
    content.push(img)
  }
  console.log('  → Generating listing metadata...')
  const text = await callLLM([{ role: 'user', content }], 2000)
  return parseJSON(text)
}
