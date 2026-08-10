import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import { initGemini } from './services/gemini.js'
import { initGroq } from './services/groq.js'
import extractRoutes from './routes/extract.js'
import verifyRoutes from './routes/verify.js'
import csvRoutes from './routes/csv.js'
import authRoutes from './routes/auth.js'
import productRoutes from './routes/products.js'
import sizechartRoutes from './routes/sizechart.js'
import { initDB, getDB } from './services/database.js'
import { getMlServiceHealth, ML_SERVICE_URL } from './services/ml_client.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

initDB()

// 🚀 Init LLMs (both OPTIONAL — only used for text generation in Layer 5)
if (process.env.GROQ_API_KEY) {
  initGroq(process.env.GROQ_API_KEY)
  console.log('✅ Groq initialized (primary text generation via llama-3.3-70b)')
} else {
  console.warn('⚠️  GROQ_API_KEY not set — Groq will not be available')
}

if (process.env.GEMINI_API_KEYS && process.env.GEMINI_API_KEYS.trim()) {
  const keys = process.env.GEMINI_API_KEYS.split(',').map(k => k.trim()).filter(Boolean)
  initGemini(keys)
  console.log(`✅ Gemini initialized with ${keys.length} keys`)
} else if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
  initGemini([process.env.GEMINI_API_KEY.trim()])
  console.log('✅ Gemini initialized (text-only fallback for listing generation)')
} else {
  console.warn('⚠️  GEMINI_API_KEY not set — Gemini will not be available')
}

console.log('📦 Verification: hash-bound fixture evidence; new inputs require the live visual-analysis worker')

// ─── Middleware ──────────────────────────────────────────────────────
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'], credentials: true }))
app.use(express.json({ limit: '500mb' }))
app.use(express.urlencoded({ extended: true, limit: '500mb' }))

// Serve uploaded images statically (for verification comparison UI)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
app.use('/demo-assets', express.static(path.join(__dirname, '..', 'demo_data', 'catalog')))

// ─── File upload config ──────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
})
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB per file
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'text/csv', 'application/pdf', 'application/vnd.ms-excel']
    if (file.originalname.endsWith('.csv')) allowed.push(file.mimetype)
    cb(null, allowed.includes(file.mimetype) || file.originalname.endsWith('.csv'))
  },
})

// ─── Routes ──────────────────────────────────────────────────────────

// Health check.
//
// This used to be a static `status: 'ok'` that reported success no matter what
// was actually running — including the failure mode that broke verification
// most often, the Python ML worker not being started. It now probes each
// dependency and returns 503 when a decision-critical one is down, so a red
// health check is a real signal rather than decoration.
app.get('/api/health', async (req, res) => {
  const ml = await getMlServiceHealth()

  let database = { ok: false, detail: 'not initialized' }
  try {
    getDB().prepare('SELECT 1').get()
    database = { ok: true, detail: 'reachable' }
  } catch (err) {
    database = { ok: false, detail: err.message }
  }

  // Layers 1–4 are local and decision-critical. Layer 5 (text generation) is
  // enhancement-only, so a missing LLM key degrades but never fails the check.
  // A worker in math-only mode (no torch stack) still serves colour ΔE and
  // FFT print geometry — decision-grade evidence — so it counts as degraded,
  // not down.
  const mathChannels = ml.capabilities?.color_delta_e === true
  const criticalOk = database.ok && ml.reachable && (ml.clip_loaded !== false || mathChannels)
  const degraded = criticalOk && (ml.vit_loaded === false || ml.clip_loaded !== true)

  res.status(criticalOk ? 200 : 503).json({
    status: criticalOk ? (degraded ? 'degraded' : 'ok') : 'unhealthy',
    checks: {
      database,
      ml_worker: {
        ok: ml.reachable && (ml.clip_loaded !== false || mathChannels),
        url: ml.url,
        reachable: ml.reachable,
        clip_loaded: ml.clip_loaded,
        vit_loaded: ml.vit_loaded,
        dino_loaded: ml.dino_loaded ?? null,
        capabilities: ml.capabilities || null,
        device: ml.device || null,
        detail: ml.detail,
      },
      llm_text_generation: {
        // Enhancement only — Layer 5. Never gates the overall status.
        ok: true,
        groq_key_present: Boolean(process.env.GROQ_API_KEY),
        gemini_key_present: Boolean(
          (process.env.GEMINI_API_KEYS && process.env.GEMINI_API_KEYS.trim()) ||
          (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim())
        ),
        detail: 'Optional. Only used for Layer 5 listing text; absence does not affect verification.',
      },
    },
    verification: {
      exact_fixture: 'Hash-bound evidence observations are rechecked against the current seller claims.',
      new_inputs: 'A live visual-analysis worker is required; unavailable inputs remain UNVERIFIED.',
    },
    generation: 'Only the exact pre-rendered finalist fixture is available without a render worker.',
  })
})

// Auth routes
app.use('/api/auth', authRoutes)

// Extract routes — accepts multiple images
app.use('/api/extract', upload.array('images', 6), extractRoutes)

// Verify route — accepts mixed files
app.use('/api/verify', upload.any(), verifyRoutes)

// CSV routes
app.use('/api/csv', csvRoutes)

// Products routes
app.use('/api/products', productRoutes)

// Size chart routes
app.use('/api/sizechart', upload.single('file'), sizechartRoutes)

// ─── Error handler ───────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

// ─── Start ───────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`Anchor backend running on http://localhost:${PORT}`)

  // Boot-time self-check. The ML worker is a separate process that has to be
  // started by hand; forgetting it used to surface only as empty verification
  // results much later, because the Node log looked perfectly healthy.
  const ml = await getMlServiceHealth()
  if (!ml.reachable) {
    console.warn(`⛔ ML worker unreachable at ${ML_SERVICE_URL} (${ml.detail})`)
    console.warn('   Verification of new anchors will return EVIDENCE_PENDING until it is running.')
    console.warn('   Start it with:  python services/ai_server.py')
  } else if (ml.clip_loaded === false) {
    console.warn(`⚠️  ML worker is up at ${ML_SERVICE_URL} but CLIP is NOT loaded (${ml.detail})`)
  } else if (ml.vit_loaded === false) {
    console.warn(`⚠️  ML worker is up at ${ML_SERVICE_URL}, CLIP loaded, but the ViT is NOT loaded — attribute extraction will be CLIP-only`)
  } else if (ml.clip_loaded === null) {
    console.warn(`⚠️  ML worker at ${ML_SERVICE_URL} has no /health route — model load state unknown`)
  } else {
    console.log(`✅ ML worker healthy at ${ML_SERVICE_URL} (CLIP + ViT loaded, device: ${ml.device || 'cpu'})`)
  }

  console.log(`API endpoints:`)
  console.log(`  GET  /api/health            — dependency health (503 when a critical one is down)`)
  console.log(`  POST /api/extract/anchor   — extract attributes from anchor images`)
  console.log(`  POST /api/verify            — single-prompt verification pipeline`)
  console.log(`  GET  /api/csv/template      — download Myntra CSV template`)
  console.log(`  POST /api/csv/upload        — upload seller CSV`)
  console.log(`  GET  /api/csv/:id           — get CSV data`)
  console.log(`  GET  /api/csv/:id/download/:stage — download CSV at stage`)
})

// trigger restart
