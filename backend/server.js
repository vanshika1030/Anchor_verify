import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import { fileURLToPath } from 'url'
import { initGemini } from './services/gemini.js'
import extractRoutes from './routes/extract.js'
import verifyRoutes from './routes/verify.js'
import csvRoutes from './routes/csv.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

// ─── Init Gemini ─────────────────────────────────────────────────────
if (!process.env.GEMINI_API_KEY) {
  console.error('GEMINI_API_KEY not set in .env')
  process.exit(1)
}
initGemini(process.env.GEMINI_API_KEY)
console.log('Gemini initialized with model fallback chain: gemini-2.0-flash > gemini-1.5-flash > gemini-2.0-flash-lite')

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
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    cb(null, allowed.includes(file.mimetype))
  },
})

// ─── Routes ──────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', models: ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.0-flash-lite'] })
})

// Extract routes — accepts multiple images
app.use('/api/extract', upload.array('images', 6), extractRoutes)

// Verify route — accepts mixed files
app.use('/api/verify', upload.any(), verifyRoutes)

// CSV routes
app.use('/api/csv', csvRoutes)

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
  console.log(`  POST /api/extract/catalog   — extract attributes from catalog images`)
  console.log(`  POST /api/verify            — run full verification pipeline`)
  console.log(`  GET  /api/csv/template      — download Myntra CSV template`)
  console.log(`  POST /api/csv/upload        — upload seller CSV`)
  console.log(`  GET  /api/csv/:id           — get CSV data`)
  console.log(`  GET  /api/csv/:id/download/:stage — download CSV at stage`)
})
