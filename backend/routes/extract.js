import { Router } from 'express'
import { extractAnchorAttributes } from '../services/gemini.js'

const router = Router()

// POST /api/extract/anchor — extract attributes from anchor images
router.post('/anchor', async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' })
    }
    const paths = req.files.map(f => f.path)
    console.log(`Extracting anchor attributes from ${paths.length} images...`)
    const attrs = await extractAnchorAttributes(paths)
    console.log(`Anchor extraction complete: ${Object.keys(attrs).length} attributes`)
    res.json({ success: true, attributes: attrs })
  } catch (err) {
    console.error('Anchor extraction failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
