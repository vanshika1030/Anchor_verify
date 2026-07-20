import { GoogleGenerativeAI } from '@google/generative-ai'
import { GoogleGenAI } from '@google/genai'
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
const MAX_RETRIES = 1
const BASE_DELAY_MS = 2000

let apiKeys = []
let currentKeyIndex = 0

function getNextKey() {
  if (apiKeys.length === 0) return process.env.GEMINI_API_KEY
  const key = apiKeys[currentKeyIndex]
  currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length
  return key
}

// --- SDK BUG FIX ---
const originalFetch = global.fetch
global.fetch = async (url, options) => {
  if (url.toString().includes('generativelanguage.googleapis.com')) {
    const apiKey = getNextKey()
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

export function initGemini(keys) {
  if (Array.isArray(keys) && keys.length > 0) {
    apiKeys = keys
    console.log(`[GEMINI] Initialized with ${apiKeys.length} API key(s), first key starts: ${apiKeys[0]?.substring(0,8)}...`)
  }
}

export function getGenAI() {
  return new GoogleGenerativeAI(getNextKey() || process.env.GEMINI_API_KEY)
}

// ─── Async Queue for Rate Limit Prevention ─────────────────────
const CONCURRENCY_LIMIT = 1;
const QUEUE_DELAY_MS = 5000;
let activeCalls = 0;
const callQueue = [];

function processQueue() {
  if (activeCalls >= CONCURRENCY_LIMIT || callQueue.length === 0) return;
  
  activeCalls++;
  const { resolve, reject, task } = callQueue.shift();
  
  task()
    .then(resolve)
    .catch(reject)
    .finally(() => {
      setTimeout(() => {
        activeCalls--;
        processQueue();
      }, QUEUE_DELAY_MS);
    });
}

function enqueueCall(task) {
  return new Promise((resolve, reject) => {
    callQueue.push({ resolve, reject, task });
    processQueue();
  });
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

export async function callWithRetry(promptParts, modelIdx = 0, attempt = 0) {
  const cacheKey = getCacheKey(promptParts)
  const cacheFile = path.join(CACHE_DIR, `${cacheKey}.json`)
  
  // SMART FIX: If we have seen these images before, return instantly from cache!
  // (We do this BEFORE the queue so cache hits are instant and don't block)
  if (fs.existsSync(cacheFile)) {
    console.log('[CACHE] ⚡ Cache hit! Bypassing API to save quota.')
    return fs.readFileSync(cacheFile, 'utf-8')
  }

  // Wrap the actual API call logic inside the queue
  return enqueueCall(async () => {
     return _executeCallWithRetry(promptParts, cacheFile, modelIdx, attempt);
  });
}

async function _executeCallWithRetry(promptParts, cacheFile, modelIdx = 0, attempt = 0) {
  if (modelIdx >= MODELS.length) {
    throw new Error('All Gemini models exhausted — API rate limit reached. Please wait 60 seconds and try again.')
  }

  const modelName = MODELS[modelIdx]
  try {
    const currentGenAI = getGenAI()
    const model = currentGenAI.getGenerativeModel({ 
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
      return _executeCallWithRetry(promptParts, cacheFile, modelIdx + 1, 0)
    }

    if (msg.includes('429') || msg.includes('quota')) {
      if (attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt)
        console.warn(`Rate limit on ${modelName}, retrying in ${delay}ms (Attempt ${attempt + 1}/${MAX_RETRIES})`)
        await new Promise(r => setTimeout(r, delay))
        return _executeCallWithRetry(promptParts, cacheFile, modelIdx, attempt + 1)
      }
      console.warn(`Exhausted retries on ${modelName}, trying ${MODELS[modelIdx + 1]}`)
      return _executeCallWithRetry(promptParts, cacheFile, modelIdx + 1, 0)
    }

    console.warn(`Unknown error on ${modelName}:`, msg, 'falling back to next model')
    return _executeCallWithRetry(promptParts, cacheFile, modelIdx + 1, 0)
  }
}

function parseJSON(text) {
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  }
  return JSON.parse(cleaned)
}

async function fileToInlineData(filePath) {
  try {
    // Compress and resize the image before sending to Gemini to prevent Token Exhaustion
    const data = await sharp(filePath)
      .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer()
    
    return {
      inlineData: {
        data: data.toString('base64'),
        mimeType: 'image/webp',
      }
    }
  } catch (err) {
    console.warn(`[SHARP] Compression failed for ${filePath}, falling back to raw:`, err.message)
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
- "confidence": <integer between 0 and 100> (representing your confidence in this extraction)

Return ONLY valid JSON (no markdown):
{
${Object.keys(ENUMS).map(k => `  "${k}": {"value": "", "confidence": 0}`).join(',\n')}
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
${Object.keys(ENUMS).map(k => `  "${k}": {"value": "", "confidence": 0}`).join(',\n')},
  "model_apparent_height": {"value": "", "confidence": 0},
  "model_apparent_build": {"value": "", "confidence": 0}
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

/**
 * Normalize confidence from any format to "HIGH"/"MEDIUM"/"LOW" string.
 * ViT/CLIP return floats (0-1), seller edits use strings, Gemini uses integers (0-100).
 */
function normalizeConfidence(conf) {
  if (typeof conf === 'string') return conf.toUpperCase()
  // Float 0-1 (ViT/CLIP)
  if (typeof conf === 'number' && conf <= 1) {
    if (conf >= 0.80) return 'HIGH'
    if (conf >= 0.55) return 'MEDIUM'
    return 'LOW'
  }
  // Integer 0-100 (Gemini)
  if (typeof conf === 'number') {
    if (conf >= 80) return 'HIGH'
    if (conf >= 55) return 'MEDIUM'
    return 'LOW'
  }
  return 'MEDIUM'
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

    if (status === 'mismatch' && anchorConf === 'HIGH' && declaredVal) {
      severity = 'HIGH'
      note = note ? note + ' AI detected with HIGH confidence, overriding to critical severity.' : 'AI detected with HIGH confidence, overriding to critical severity.'
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
  const skipped = comparison.filter(r => r.status === 'skip')

  const criticalCount = highFails.length + modelIssues.length
  let status = 'PASS'
  let reason = 'All checks passed - product matches catalog attributes closely.'

  if (modelIssues.find(i => i.extractionFailed)) {
    return {
      status: 'UNVERIFIED',
      reason: 'Could not complete check. Missing or failed catalog attribute extraction.',
      critical_fails: 0,
      warnings: 0
    }
  }

  // If ALL attributes are skipped, this is NOT a pass
  if (skipped.length === comparison.length) {
    status = 'UNVERIFIED'
    reason = 'No attributes could be extracted or compared. Upload better images or fill in metadata.'
  } else if (skipped.length > comparison.length * 0.7) {
    status = 'WARNING'
    reason = `Only ${passes.length}/${comparison.length} attributes verified. ${skipped.length} could not be checked - provide more metadata.`
  } else if (criticalCount > 0) {
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
      skipped: skipped.length,
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
    const response = await fetch('http://localhost:8100/segment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_path: imagePath })
    })
    const result = await response.json()
    if (result.success) {
      return { 
        ratio: Number(result.ratio).toFixed(2), 
        length_category: result.length_category,
        cutout_path: result.cutout_path
      }
    } else {
      console.warn("Segmentation API returned error:", result.error)
      return null
    }
  } catch (err) {
    console.warn("Could not calculate aspect ratio via API:", err.message)
    return null
  }
}

// ─── The Correction Co-Pilot ────────────────────────────────────────

/**
 * Generates actionable corrections for the seller based on mismatches.
 * Uses CLIP binary cross-verification to avoid suggesting wrong corrections.
 * 
 * @param {Array} comparisonResult - comparison rows
 * @param {Array} modelIssues - body proportion issues
 * @param {string} anchorImagePath - path to anchor image for cross-verification
 */
export async function generateCorrections(comparisonResult, modelIssues = [], anchorImagePath = null) {
  const corrections = []

  // Collect attributes that need cross-verification
  const toVerify = comparisonResult.filter(row =>
    (row.status === 'mismatch' || row.status === 'warning') && row.declared_value && row.anchor_value
  )

  // Batch cross-verify: ONE API call, ALL checks
  let crossVerifyResults = {}
  if (anchorImagePath && toVerify.length > 0) {
    console.log(`[CORRECTIONS] Cross-verifying ${toVerify.length} attributes using CLIP binary-batch API...`)
    const pairs = toVerify.map(row => ({
      key: row.key,
      a: row.anchor_value,
      b: row.declared_value
    }))

    try {
      const response = await fetch('http://localhost:8100/clip/binary-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_path: anchorImagePath, pairs })
      })
      const result = await response.json()
      if (result.success) {
        crossVerifyResults = result.results
      }
    } catch (err) {
      console.warn('[CORRECTIONS] Batch cross-verification via API failed:', err.message)
    }
    console.log(`[CORRECTIONS] Cross-verification complete: ${Object.keys(crossVerifyResults).length} attributes checked`)
  }

  // Generate corrections only when cross-verification supports it
  comparisonResult.forEach(row => {
    if ((row.status === 'mismatch' || row.status === 'warning') && row.declared_value) {
      const visualTruth = row.anchor_value || row.catalog_value
      if (!visualTruth) return

      const crossCheck = crossVerifyResults[row.key]
      
      if (crossCheck) {
        if (crossCheck.winner === row.declared_value) {
          // CLIP agrees with seller — seller is RIGHT, AI was wrong
          console.log(`[CORRECTIONS] ${row.key}: Seller "${row.declared_value}" confirmed by CLIP (AI was wrong: "${visualTruth}")`)
          return // Don't suggest a correction
        } else if (crossCheck.winner === 'uncertain') {
          corrections.push({
            field: row.key,
            current_value: row.declared_value,
            suggested_value: visualTruth,
            confidence: 'LOW',
            needs_review: true,
            cross_verified: 'uncertain',
            reason: `Our AI and your input disagree on "${row.key}". AI detected "${visualTruth}" but you entered "${row.declared_value}". Please double-check.`
          })
          return
        }
        // CLIP agrees with AI — suggest correction
      }

      corrections.push({
        field: row.key,
        current_value: row.declared_value,
        suggested_value: visualTruth,
        confidence: crossCheck ? 'HIGH' : (row.anchor_confidence || 'MEDIUM'),
        needs_review: !crossCheck || row.anchor_confidence !== 'HIGH',
        cross_verified: crossCheck ? 'ai_confirmed' : 'not_verified',
        reason: crossCheck
          ? `Our visual analysis confirms this is "${visualTruth}" rather than "${row.declared_value}" (cross-verified). Updating this improves search accuracy.`
          : `Our visual analysis thinks this is "${visualTruth}" rather than "${row.declared_value}". Could you confirm?`
      })
    }
  })

  modelIssues.forEach(issue => {
    const match = issue.note?.match(/model appears (.*)/)
    if (match) {
      corrections.push({
        field: issue.attr.toLowerCase().replace(' ', '_'),
        current_value: issue.declared,
        suggested_value: match[1],
        confidence: issue.confidence || 'MEDIUM',
        needs_review: issue.confidence !== 'HIGH',
        cross_verified: 'not_verified',
        reason: `The catalog model seems to match a "${match[1]}" profile. Could you confirm?`
      })
    }
  })

  return corrections
}

// ─── Public API Exports ─────────────────────────────────────────────

/**
 * Run CLIP zero-shot attribute extraction locally.
 * Returns an object like { pattern_type: { value: 'Floral', confidence: 0.87 }, ... }
 */
export async function runClipZeroShot(imagePath) {
  try {
    const response = await fetch('http://localhost:8100/clip/zero-shot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_path: imagePath })
    })
    const result = await response.json()
    if (result.success) {
      return result.attributes
    } else {
      console.warn('[CLIP-ZS] API Zero-shot returned error:', result.error)
      return null
    }
  } catch (err) {
    console.warn('[CLIP-ZS] API Zero-shot failed:', err.message)
    return null
  }
}

/**
 * Extract anchor attributes using 100% LOCAL AI.
 * Layer 1: Custom ViT (6 core attributes)
 * Layer 2: CLIP zero-shot (11 supplementary attributes)
 * Layer 3: Segmentation CV (length verification)
 * NO Gemini API calls.
 */
export async function extractAnchorAttributes(imagePaths) {
  if (!imagePaths || imagePaths.length === 0) return {}
  const primaryPath = imagePaths[0]

  console.log(`[EXTRACT] Running extraction on ${imagePaths.length} anchor images...`)

  // ══════════════════════════════════════════════════════════════
  // PRIMARY: Gemini Vision (accurate, understands fashion)
  // ══════════════════════════════════════════════════════════════
  let geminiAttrs = null
  if (apiKeys.length > 0) {
    try {
      console.log('[EXTRACT] Phase 1: Gemini Vision (primary extractor)...')
      const inlineImages = await Promise.all(
        imagePaths.slice(0, 3).map(p => fileToInlineData(p))
      )

      const enumSection = buildEnumPromptSection()
      const prompt = `You are an expert fashion product analyst for an Indian e-commerce platform (like Myntra/Ajio).

Analyze the garment shown in the provided image(s) and extract ALL of the following attributes. Be extremely precise — if the garment is a crop top, say "Crop" not "Hip Length". If it's half sleeve, say "Short Sleeve" not "Full Sleeve".

For each attribute, you MUST choose ONLY from the allowed values listed below:

${enumSection}

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{
  "garment_type": "value",
  "primary_color": "value",
  "secondary_color": "value or None",
  "pattern_type": "value",
  "fabric_appearance": "value",
  "overall_length": "value",
  "sleeve_length": "value",
  "neck_type": "value",
  "silhouette": "value",
  "fit": "value",
  "embellishment": "value or None",
  "transparency": "value",
  "hemline": "value",
  "occasion_style": "value",
  "motif_description": "value or None",
  "closure_type": "value",
  "structural_features": "value or None"
}

CRITICAL RULES:
- Look at the ACTUAL garment, not what you think it might be
- For color: identify the dominant color as seen in the photo. "Pink" not "Multi" if it's clearly pink.
- For length: compare garment to model's body. Crop = above waist. Hip Length = covers hips. Knee Length = at knees.
- For sleeves: Sleeveless = no sleeves at all. Short Sleeve = above elbow. Full Sleeve = to wrist.
- For fabric: if you can't determine fabric type from the image, say "Not determinable"
- DO NOT guess. If something is not visible or determinable, use "Not determinable".`

      const promptParts = [
        ...inlineImages,
        { text: prompt }
      ]

      const rawText = await callWithRetry(promptParts)
      geminiAttrs = parseJSON(rawText)
      console.log(`[EXTRACT] Gemini Vision extracted ${Object.keys(geminiAttrs).length} attributes`)
    } catch (err) {
      console.warn('[EXTRACT] Gemini Vision failed:', err.message, '— falling back to local models')
    }
  } else {
    console.log('[EXTRACT] No Gemini API key — using local models only')
  }

  // ══════════════════════════════════════════════════════════════
  // SECONDARY: ViT + CLIP zero-shot (local, for cross-validation)
  // ══════════════════════════════════════════════════════════════
  console.log('[EXTRACT] Phase 2: Local ViT + CLIP (cross-validation)...')
  const [vitResult, clipZsResult, cvRatio] = await Promise.all([
    runVitInference(primaryPath),
    runClipZeroShot(primaryPath),
    getGarmentBoundingBoxRatio(primaryPath)
  ])

  // ══════════════════════════════════════════════════════════════
  // MERGE: Gemini primary → ViT/CLIP fills gaps + cross-validates
  // ══════════════════════════════════════════════════════════════
  const attrs = {}

  if (geminiAttrs) {
    // Use Gemini as primary source for all attributes
    for (const [key, value] of Object.entries(geminiAttrs)) {
      if (value && value !== 'None' && value !== 'Not determinable') {
        attrs[key] = {
          value: value,
          confidence: 'HIGH',
          source: 'Gemini-Vision'
        }
      }
    }

    // Cross-validate with ViT — if ViT disagrees on a core attribute, add note
    if (vitResult) {
      const VIT_MAP = {
        garment_type: 'garment_type',
        sleeve_length: 'sleeve_length',
        neck_type: 'neck_type',
        overall_length: 'overall_length',
        fabric_type: 'fabric_appearance',
        primary_color: 'primary_color',
      }
      for (const [vitKey, canonKey] of Object.entries(VIT_MAP)) {
        if (vitResult[vitKey] && attrs[canonKey]) {
          const vitVal = vitResult[vitKey].value
          const geminiVal = attrs[canonKey].value
          if (vitVal && vitVal !== geminiVal) {
            attrs[canonKey].cross_check = `ViT says "${vitVal}" (conf: ${vitResult[vitKey].confidence?.toFixed(2)})`
            // If ViT has very high confidence (>0.95) and Gemini disagrees, flag for review
            if (vitResult[vitKey].confidence > 0.95) {
              attrs[canonKey].confidence = 'MEDIUM'
              attrs[canonKey].needs_review = true
            }
          }
        }
      }
      console.log(`[EXTRACT] ViT cross-validation complete`)
    }

    // Use CLIP zero-shot to fill any remaining gaps
    if (clipZsResult) {
      let clipFilled = 0
      for (const [key, val] of Object.entries(clipZsResult)) {
        if (!attrs[key] && val.value) {
          attrs[key] = {
            value: val.value,
            confidence: normalizeConfidence(val.confidence),
            source: 'CLIP-ZeroShot'
          }
          clipFilled++
        }
      }
      if (clipFilled > 0) console.log(`[EXTRACT] CLIP filled ${clipFilled} gaps`)
    }
  } else {
    // FALLBACK: No Gemini — use ViT + CLIP as before
    console.log('[EXTRACT] Using ViT + CLIP as primary (Gemini unavailable)')
    
    if (vitResult) {
      const VIT_MAP = {
        garment_type: 'garment_type', sleeve_length: 'sleeve_length',
        neck_type: 'neck_type', overall_length: 'overall_length',
        fabric_type: 'fabric_appearance', primary_color: 'primary_color',
      }
      for (const [vitKey, canonKey] of Object.entries(VIT_MAP)) {
        if (vitResult[vitKey]) {
          attrs[canonKey] = {
            value: vitResult[vitKey].value,
            confidence: normalizeConfidence(vitResult[vitKey].confidence),
            source: 'ViT'
          }
        }
      }
    }

    if (clipZsResult) {
      for (const [key, val] of Object.entries(clipZsResult)) {
        if (!attrs[key]) {
          attrs[key] = {
            value: val.value,
            confidence: normalizeConfidence(val.confidence),
            source: 'CLIP-ZeroShot'
          }
        }
      }
    }
  }

  // CV length verification (independent geometric signal)
  if (cvRatio && attrs.overall_length) {
    attrs.cv_overall_length = {
      value: cvRatio.length_category,
      confidence: 'HIGH',
      ratio: cvRatio.ratio
    }
  }

  console.log(`[EXTRACT] Extraction complete: ${Object.keys(attrs).length} attributes`)
  console.log(`[EXTRACT] Sources: ${[...new Set(Object.values(attrs).map(a => a.source))].join(' + ')}`)
  return attrs
}

/**
 * Extract catalog attributes using 100% LOCAL AI.
 * Same as anchor extraction — ViT + CLIP zero-shot.
 * NO Gemini API calls.
 */
export async function extractCatalogAttributes(catalogPaths, anchorPaths = []) {
  if (!catalogPaths || catalogPaths.length === 0) return {}
  const primaryPath = catalogPaths[0]

  console.log(`[EXTRACT-CATALOG] Running local extraction on ${catalogPaths.length} catalog images...`)
  console.log(`[EXTRACT-CATALOG] Primary image: ${primaryPath}`)

  // Run ViT + CLIP zero-shot + segmentation in parallel
  const [vitResult, clipZsResult, cvRatio] = await Promise.all([
    runVitInference(primaryPath),
    runClipZeroShot(primaryPath),
    getGarmentBoundingBoxRatio(primaryPath),
  ])

  console.log(`[EXTRACT-CATALOG] ViT result: ${vitResult ? Object.keys(vitResult).length + ' attributes' : 'FAILED'}`)
  console.log(`[EXTRACT-CATALOG] CLIP-ZS result: ${clipZsResult ? Object.keys(clipZsResult).length + ' attributes' : 'FAILED'}`)
  console.log(`[EXTRACT-CATALOG] CV segmentation: ${cvRatio ? cvRatio.length_category : 'FAILED'}`)

  const attrs = {}

  // Layer 1: ViT predictions (6 core attributes)
  if (vitResult) {
    const VIT_TO_CANONICAL = {
      garment_type: 'garment_type',
      sleeve_length: 'sleeve_length',
      neck_type: 'neck_type',
      overall_length: 'overall_length',
      fabric_type: 'fabric_appearance',
      primary_color: 'primary_color',
    }
    for (const [vitKey, canonicalKey] of Object.entries(VIT_TO_CANONICAL)) {
      if (vitResult[vitKey]) {
        const raw = vitResult[vitKey]
        attrs[canonicalKey] = {
          value: raw.value,
          confidence: normalizeConfidence(raw.confidence),
          source: 'ViT'
        }
      }
    }
    console.log(`[EXTRACT-CATALOG] ViT extracted: ${Object.keys(attrs).map(k => `${k}=${attrs[k].value}`).join(', ')}`)
  } else {
    console.warn('[EXTRACT-CATALOG] ViT FAILED — check if model_best.safetensors exists and Python environment has timm+torch')
  }

  // Layer 2: CLIP zero-shot predictions (supplementary)
  if (clipZsResult) {
    let clipAdded = 0
    for (const [key, val] of Object.entries(clipZsResult)) {
      if (!attrs[key]) {
        attrs[key] = {
          value: val.value,
          confidence: normalizeConfidence(val.confidence),
          source: 'CLIP-ZeroShot'
        }
        clipAdded++
      }
    }
    console.log(`[EXTRACT-CATALOG] CLIP zero-shot added ${clipAdded} supplementary attributes`)
  } else {
    console.warn('[EXTRACT-CATALOG] CLIP zero-shot FAILED — check if open_clip is installed')
  }

  // Layer 3: CV length verification on catalog too
  if (cvRatio) {
    attrs.cv_overall_length = {
      value: cvRatio.length_category,
      confidence: 'HIGH',
      ratio: cvRatio.ratio,
      source: 'CV-Segmentation'
    }
  }

  console.log(`[EXTRACT-CATALOG] Catalog extraction complete: ${Object.keys(attrs).length} attributes (0 API calls)`)
  return attrs
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
  // ── Tier 1: Try Groq (text-only, fastest, most reliable) ──
  try {
    const { isGroqAvailable, groqGenerateListingMetadata } = await import('./groq.js')
    if (isGroqAvailable()) {
      console.log('[GENERATE] Using Groq (text-only) for listing metadata...')
      const result = await groqGenerateListingMetadata(attributes)
      if (result && result.title) return result
    }
  } catch (groqErr) {
    console.warn('[GENERATE] Groq failed:', groqErr.message)
  }

  // ── Tier 2: Try Gemini text-only (no images!) ──
  try {
    if (apiKeys.length > 0) {
      console.log('[GENERATE] Falling back to Gemini (text-only) for listing metadata...')
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
      // TEXT ONLY — no images sent to Gemini
      const text = await callWithRetry([{ text: promptText }])
      return parseJSON(text)
    }
  } catch (geminiErr) {
    console.warn('[GENERATE] Gemini text-only also failed:', geminiErr.message)
  }

  // ── Tier 3: Deterministic template (zero API calls, always works) ──
  console.log('[GENERATE] Using deterministic template (no API available)')
  const gt = attributes.garment_type?.value || attributes.garment_type || 'Garment'
  const color = attributes.primary_color?.value || attributes.primary_color || ''
  const fabric = attributes.fabric_appearance?.value || attributes.fabric || ''
  const neck = attributes.neck_type?.value || attributes.neck_type || ''
  const sleeve = attributes.sleeve_length?.value || attributes.sleeve_length || ''
  const pattern = attributes.pattern_type?.value || attributes.pattern_type || 'Solid'

  return {
    title: `${color} ${pattern} ${fabric} ${gt} for Women`.replace(/\s+/g, ' ').trim().substring(0, 60),
    description: `A stylish ${color.toLowerCase()} ${gt.toLowerCase()} crafted from ${fabric.toLowerCase() || 'premium'} fabric. Features a ${neck.toLowerCase() || 'classic'} neckline with ${sleeve.toLowerCase() || 'regular'} sleeves. Perfect for casual and semi-formal occasions.`,
    bullets: [
      `Material: ${fabric || 'Premium fabric'}`,
      `Pattern: ${pattern}`,
      `Neck: ${neck || 'Classic neckline'}`,
    ],
    key_features: [
      `${fabric || 'Quality'} fabric for comfort`,
      `${pattern} pattern design`,
      `${neck || 'Stylish'} neckline`,
      `${sleeve || 'Regular'} sleeves`,
    ],
    tags: [gt.toLowerCase(), color.toLowerCase(), fabric.toLowerCase(), pattern.toLowerCase(), 'women'].filter(Boolean),
    category_path: `Women > Clothing > ${gt}`,
    ideal_for: 'Women',
    fabric_details: fabric || 'Not specified',
    care_instructions: 'Machine wash cold. Do not bleach. Tumble dry low.',
    size_fit_note: 'Regular fit. Refer to size chart for accurate measurements.',
  }
}

/**
 * Generate 5 AI catalog model images using Gemini image generation.
 * Each image shows the garment on an AI model with proper proportions.
 * Falls back to compositing if Gemini image gen is unavailable.
 */
export async function generateCatalogImage(imagePaths, attributes, cvOverallLength, sizeChartPath = null) {
  if (!imagePaths || imagePaths.length === 0) return null
  
  const anchorPath = imagePaths[0]
  const parsedPath = path.parse(anchorPath)
  
  const imageBytes = fs.readFileSync(anchorPath)
  const contentHash = crypto.createHash('md5').update(imageBytes.slice(0, 10240)).digest('hex').substring(0, 12)
  const pregeneratedDir = path.join(process.cwd(), 'uploads', 'pregenerated')
  
  // Build garment description from ALL extracted attributes
  const gt = attributes.garment_type?.value || attributes.garment_type || 'garment'
  const color = attributes.primary_color?.value || attributes.primary_color || ''
  const secColor = attributes.secondary_color?.value || attributes.secondary_color || ''
  const fabric = attributes.fabric_appearance?.value || attributes.fabric || ''
  const pattern = attributes.pattern_type?.value || attributes.pattern_type || 'Solid'
  const neck = attributes.neck_type?.value || attributes.neck_type || ''
  const sleeve = attributes.sleeve_length?.value || attributes.sleeve_length || ''
  const fit = attributes.fit?.value || attributes.fit || 'Regular'
  const silhouette = attributes.silhouette?.value || attributes.silhouette || ''
  const embellishment = attributes.embellishment?.value || attributes.embellishment || 'None'
  const hemline = attributes.hemline?.value || attributes.hemline || ''
  const length = attributes.overall_length?.value || attributes.overall_length || ''
  const occasion = attributes.occasion_style?.value || attributes.occasion_style || ''
  const motif = attributes.motif_description?.value || attributes.motif_description || ''
  const modelHeight = attributes.model_height || '5\'7"'
  const modelSize = attributes.model_size || 'M'

  const garmentDesc = [
    color && `${color} colored`,
    secColor && secColor !== 'None' && `with ${secColor} accents`,
    pattern !== 'Solid' && `${pattern} pattern`,
    fabric && `${fabric} fabric`,
    gt,
    fit !== 'Regular' && `(${fit} fit)`,
    silhouette && `with ${silhouette} silhouette`,
    neck && `featuring ${neck} neckline`,
    sleeve && `${sleeve} sleeves`,
    length && `${length}`,
    hemline && hemline !== 'None' && `${hemline} hemline`,
    embellishment && embellishment !== 'None' && `with ${embellishment}`,
    motif && motif !== 'None' && `${motif} motif`,
  ].filter(Boolean).join(', ')

  // Size to body description mapping
  const sizeToBody = {
    'XS': 'petite, slim build',
    'S': 'slim, lean build',
    'M': 'average, regular build',
    'L': 'slightly curvy, regular-to-full build',
    'XL': 'full-figured, curvy build',
    'XXL': 'plus-size, full-figured build',
  }
  const bodyDesc = sizeToBody[modelSize?.toUpperCase()] || 'average build'

  const VIEWS = [
    {
      name: 'front',
      prompt: `Professional Myntra e-commerce catalog photo. An Indian female fashion model (height ${modelHeight}, ${bodyDesc}, size ${modelSize}) wearing: ${garmentDesc}. FRONT VIEW, full body from head to toe. The garment MUST show: ${fit} fit draping naturally on the body, ${length} length visible. White studio background, soft professional lighting, model standing straight facing camera. Photo-realistic, high resolution, e-commerce product photography style.`
    },
    {
      name: 'back',
      prompt: `Professional Myntra e-commerce catalog photo. Same Indian female model (height ${modelHeight}, ${bodyDesc}) wearing the exact same garment: ${garmentDesc}. BACK VIEW, full body. Show the back design, any back prints or patterns, and how the garment falls from behind. White studio background, professional lighting.`
    },
    {
      name: 'side',
      prompt: `Professional Myntra e-commerce catalog photo. Same Indian female model (height ${modelHeight}, ${bodyDesc}) wearing: ${garmentDesc}. SIDE PROFILE VIEW showing the garment's silhouette and how it drapes on the body. Show the ${fit} fit and ${length} clearly. White studio background, professional lighting.`
    },
    {
      name: 'closeup',
      prompt: `Close-up detail shot of the garment: ${garmentDesc}. Focus on the ${neck} neckline area and ${fabric} fabric texture. Show ${embellishment !== 'None' ? embellishment : 'stitching details'}. On the same Indian model. White background, macro-style e-commerce photography, sharp focus on fabric weave and construction details.`
    },
    {
      name: 'full',
      prompt: `Full-length editorial style Myntra catalog photo. Indian female model (${modelHeight}, ${bodyDesc}, size ${modelSize}) wearing: ${garmentDesc}. Styled for ${occasion || 'casual'} wear. Show the complete garment from a slightly angled perspective. Model in a natural, confident pose. White studio background, professional editorial lighting.`
    },
  ]

  const generatedImages = []

  // Try Gemini image generation first
  if (apiKeys.length > 0) {
    console.log(`[IMAGE-GEN] Generating 5 AI model catalog images via Gemini...`)
    
    const IMAGE_MODELS = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image', 'gemini-3.1-flash-lite-image']
    const IMAGE_MAX_RETRIES = 1

    for (let i = 0; i < VIEWS.length; i++) {
      const view = VIEWS[i]
      const outputFile = path.join(process.cwd(), 'uploads', `gen_${parsedPath.name}_${view.name}.png`)
      
      // Check content-hash pregenerated cache first
      let pregenFound = false
      const pythonHeight = modelHeight.replace(/"/g, '');
      const sizeHash = `${modelSize}_${pythonHeight}`;
      const pregenFileSize = path.join(pregeneratedDir, `${contentHash}_${sizeHash}_${view.name}.png`);
      const pregenFileBase = path.join(pregeneratedDir, `${contentHash}_${view.name}.png`);
      
      const checkPregen = (filePath, sourceFolder = '') => {
        if (fs.existsSync(filePath)) {
          console.log(`[IMAGE-GEN] Using pregenerated ${view.name} view ${sourceFolder ? `from ${sourceFolder}` : ''} (content-hash match)`);
          fs.copyFileSync(filePath, outputFile);
          generatedImages.push({
            view: view.name,
            url: `http://localhost:3001/uploads/gen_${parsedPath.name}_${view.name}.png`
          });
          return true;
        }
        return false;
      };

      if (checkPregen(pregenFileSize) || checkPregen(pregenFileBase)) {
        pregenFound = true;
      } else if (fs.existsSync(pregeneratedDir)) {
        // Also check subfolders
        const subfolders = fs.readdirSync(pregeneratedDir, { withFileTypes: true }).filter(d => d.isDirectory())
        for (const folder of subfolders) {
          const subFileSize = path.join(pregeneratedDir, folder.name, `${contentHash}_${sizeHash}_${view.name}.png`);
          const subFileBase = path.join(pregeneratedDir, folder.name, `${contentHash}_${view.name}.png`);
          if (checkPregen(subFileSize, folder.name) || checkPregen(subFileBase, folder.name)) {
            pregenFound = true;
            break;
          }
        }
      }
      
      if (pregenFound) continue;

      // Check cache
      if (fs.existsSync(outputFile)) {
        console.log(`[IMAGE-GEN] Using cached ${view.name} view`)
        generatedImages.push({
          view: view.name,
          url: `http://localhost:3001/uploads/gen_${parsedPath.name}_${view.name}.png`
        })
        continue
      }

      let imageGenerated = false

      for (let modelIdx = 0; modelIdx < IMAGE_MODELS.length; modelIdx++) {
        if (imageGenerated) break;
        const modelName = IMAGE_MODELS[modelIdx]

        for (let attempt = 0; attempt <= IMAGE_MAX_RETRIES; attempt++) {
          try {
            console.log(`[IMAGE-GEN] Trying ${modelName} for ${view.name} view (Attempt ${attempt + 1})...`)
            const apiKey = getNextKey() || process.env.GEMINI_API_KEY
            const ai = new GoogleGenAI({ apiKey: apiKey })
            const anchorInlineData = await fileToInlineData(anchorPath)

            const promptParts = [anchorInlineData]
            if (sizeChartPath) {
              promptParts.push(await fileToInlineData(sizeChartPath))
              promptParts.push({ text: `Analyze the attached size chart to determine the accurate bodily proportions and length for size ${modelSize}. Apply these proportions to the generated model image.` })
            }
            promptParts.push({ text: `Using the garment shown in the reference image above, ${view.prompt}` })

            const response = await ai.models.generateContent({
              model: modelName,
              contents: [
                {
                  parts: promptParts
                }
              ],
              config: { responseModalities: ['TEXT', 'IMAGE'] }
            })

            // Extract generated image from response
            if (response.candidates?.[0]?.content?.parts) {
              for (const part of response.candidates[0].content.parts) {
                if (part.inlineData || part.inline_data) {
                  const inlineData = part.inlineData || part.inline_data
                  const imgBuffer = Buffer.from(inlineData.data, 'base64')
                  fs.writeFileSync(outputFile, imgBuffer)
                  generatedImages.push({
                    view: view.name,
                    url: `http://localhost:3001/uploads/gen_${parsedPath.name}_${view.name}.png`
                  })
                  imageGenerated = true
                  console.log(`[IMAGE-GEN] ✅ ${view.name} view generated using ${modelName}`)
                  break
                }
              }
            }

            if (!imageGenerated) {
              console.warn(`[IMAGE-GEN] ${view.name} view: no image in response from ${modelName}`)
              break // Break out of retry loop, try next model
            } else {
              break // Success, break out of retry loop
            }
          } catch (err) {
            console.warn(`[IMAGE-GEN] ${view.name} view failed on ${modelName}: ${err.message}`)
            const msg = err.message || ''
            
            if (msg.includes('404') || msg.includes('not found') || msg.includes('does not exist')) {
              break // Break out of retry loop, try next model
            }
            
            if (msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED')) {
              if (attempt < IMAGE_MAX_RETRIES) {
                const delay = BASE_DELAY_MS * Math.pow(2, attempt)
                console.warn(`[IMAGE-GEN] Rate limit on ${modelName}, retrying in ${delay}ms...`)
                await new Promise(r => setTimeout(r, delay))
                continue
              } else {
                break // Exhausted retries, try next model
              }
            }
            
            // Unknown error, try next model
            break 
          }
        }
      }

      // Rate limit prevention: 10 second delay between generations
      if (i < VIEWS.length - 1 && imageGenerated) {
        await new Promise(resolve => setTimeout(resolve, 10000))
      }
    }
  }

  // If Gemini generated at least some images, return them
  if (generatedImages.length > 0) {
    console.log(`[IMAGE-GEN] Generated ${generatedImages.length}/5 AI model images`)
    return generatedImages
  }

  // Fallback: compositing (garment on white canvas)
  console.log('[IMAGE-GEN] Falling back to compositing (no AI model images)')
  const outputPath = path.join(process.cwd(), 'uploads', `gen_${parsedPath.name}.png`)
  
  try {
    let sourceBuffer
    if (cvOverallLength && cvOverallLength.cutout_path && fs.existsSync(cvOverallLength.cutout_path)) {
      sourceBuffer = fs.readFileSync(cvOverallLength.cutout_path)
    } else {
      try {
        const response = await fetch('http://localhost:8100/segment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_path: anchorPath })
        })
        const segResult = await response.json()
        if (segResult.success && segResult.cutout_path) {
          sourceBuffer = fs.readFileSync(segResult.cutout_path)
        } else {
          sourceBuffer = fs.readFileSync(anchorPath)
        }
      } catch {
        sourceBuffer = fs.readFileSync(anchorPath)
      }
    }
    
    const resizedGarment = await sharp(sourceBuffer)
      .resize(500, 700, { fit: 'inside', withoutEnlargement: false })
      .png()
      .toBuffer()
    
    const garmentMeta = await sharp(resizedGarment).metadata()
    const canvasW = 600
    const canvasH = 800
    const left = Math.round((canvasW - garmentMeta.width) / 2)
    const top = Math.round((canvasH - garmentMeta.height) / 2)
    
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
    const response = await fetch('http://localhost:8100/clip/similarity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anchor_path: anchorPath, catalog_path: catalogPath })
    })
    const result = await response.json()
    if (result.success) {
      return result
    } else {
      console.warn("CLIP API returned error:", result.error)
      return null
    }
  } catch (err) {
    console.warn("Could not calculate CLIP similarity via API:", err.message)
    return null
  }
}

export async function runVitInference(imagePath) {
  try {
    const response = await fetch('http://localhost:8100/vit/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_path: imagePath })
    })
    return await response.json()
  } catch (err) {
    console.warn("ViT Inference API failed:", err.message)
    return null
  }
}

export async function runPhashSimilarity(anchorPath, catalogPath) {
  try {
    const response = await fetch('http://localhost:8100/phash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anchor_path: anchorPath, catalog_path: catalogPath })
    })
    const result = await response.json()
    return result.success ? result : null
  } catch (err) {
    console.warn("pHash API failed:", err.message)
    return null
  }
}

