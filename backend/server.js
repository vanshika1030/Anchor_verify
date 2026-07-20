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
import { initDB } from './services/database.js'

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

console.log('✅ Local AI models: ViT (6 attributes, 89% acc) + CLIP (zero-shot) + pHash + Segmentation')
console.log('📦 Architecture: 5-Layer Hierarchical — ZERO API calls for verification')

// ─── Middleware ──────────────────────────────────────────────────────
app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Serve uploaded images statically (for verification comparison UI)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    architecture: '5-layer-hierarchical',
    layers: {
      'Layer 1': 'CLIP + pHash (local visual gate)',
      'Layer 2': 'ViT + CLIP zero-shot (local attribute extraction)',
      'Layer 3': 'Deterministic comparison (synonym matching)',
      'Layer 4': 'Bayesian mathematical fusion',
      'Layer 5': 'Text-only LLM (Groq → Gemini → template)',
    },
    api_calls_for_verify: 0,
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
app.listen(PORT, () => {
  console.log(`Anchor backend running on http://localhost:${PORT}`)
  console.log(`API endpoints:`)
  console.log(`  POST /api/extract/anchor   — extract attributes from anchor images`)
  console.log(`  POST /api/verify            — single-prompt verification pipeline`)
  console.log(`  GET  /api/csv/template      — download Myntra CSV template`)
  console.log(`  POST /api/csv/upload        — upload seller CSV`)
  console.log(`  GET  /api/csv/:id           — get CSV data`)
  console.log(`  GET  /api/csv/:id/download/:stage — download CSV at stage`)
})
