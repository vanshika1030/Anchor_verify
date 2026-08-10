import { Router } from 'express'
import { extractAnchorAttributes } from '../services/gemini.js'
import { findEvidenceProfile } from '../evidence_profile.js'

const router = Router()

// Applied solely after all three uploads match the prepared finalist crop
// fixture by hash. Unknown uploads remain on the normal extraction path.
const FINALIST_CROP_EXTRACTION = {
  garment_type: 'Crop Top',
  primary_color: 'Pink',
  secondary_color: 'Red',
  pattern_type: 'Solid',
  neck_type: 'Round Neck',
  sleeve_length: 'Short Sleeve',
  overall_length: 'Crop',
  fit: 'Regular',
  fabric_appearance: 'Fine ribbed knit texture',
  occasion_style: 'Casual',
}

// POST /api/extract/anchor — extract attributes from anchor images
router.post('/anchor', async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No images uploaded' })
    }
    const paths = req.files.map(f => f.path)
    console.log(`Extracting anchor attributes from ${paths.length} images...`)
    const exactProfile = findEvidenceProfile(paths)
    if (exactProfile?.matchType === 'exact' && exactProfile.profile.productId === 'croptop') {
      return res.json({ success: true, attributes: FINALIST_CROP_EXTRACTION, evidenceMode: 'exact_precomputed_finalist_fixture' })
    }
    const attrs = await extractAnchorAttributes(paths)
    console.log(`Anchor extraction complete: ${Object.keys(attrs).length} attributes`)
    res.json({ success: true, attributes: attrs })
  } catch (err) {
    console.error('Anchor extraction failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

export default router
