import { Router } from 'express'
import {
  compareAttributes, verifyFabric, checkModelProportions, generateVerdict
} from '../services/gemini.js'

const router = Router()

// POST /api/verify — full verification pipeline
// Body: { anchorAttrs, catalogAttrs, declaredAttrs, modelHeight, modelSize }
// Files: anchorCloseup (optional), catalogImages[]
router.post('/', async (req, res) => {
  try {
    const { anchorAttrs, catalogAttrs, declaredAttrs, modelHeight, modelSize } = req.body

    if (!anchorAttrs || !catalogAttrs) {
      return res.status(400).json({ error: 'Both anchorAttrs and catalogAttrs are required' })
    }

    const parsedAnchor = typeof anchorAttrs === 'string' ? JSON.parse(anchorAttrs) : anchorAttrs
    const parsedCatalog = typeof catalogAttrs === 'string' ? JSON.parse(catalogAttrs) : catalogAttrs
    const parsedDeclared = typeof declaredAttrs === 'string' ? JSON.parse(declaredAttrs) : (declaredAttrs || {})

    // Step 1: Three-way comparison
    const comparison = await compareAttributes(parsedAnchor, parsedCatalog, parsedDeclared)

    // Step 2: Model proportion check
    const modelIssues = checkModelProportions(parsedCatalog, modelHeight, modelSize)

    // Step 3: Fabric verification (if closeup uploaded)
    let fabricResult = null
    const closeupFile = req.files?.find(f => f.fieldname === 'anchorCloseup')
    const catalogFiles = req.files?.filter(f => f.fieldname === 'catalogImages') || []
    if (closeupFile && catalogFiles.length > 0) {
      try {
        fabricResult = await verifyFabric(
          closeupFile.path,
          catalogFiles.map(f => f.path),
          parsedDeclared.fabric_composition
        )
      } catch (fabErr) {
        console.warn('Fabric verification failed:', fabErr.message)
        fabricResult = { issue: 'Could not verify fabric', confidence: 'LOW' }
      }
    }

    // Step 4: Generate verdict
    const verdict = generateVerdict(comparison, modelIssues)

    res.json({
      success: true,
      comparison,
      modelIssues,
      fabricResult,
      verdict,
    })
  } catch (err) {
    console.error('Verification failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
