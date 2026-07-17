import { Router } from 'express'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import multer from 'multer'
import fs from 'fs'
import path from 'path'

const router = Router()
const csvUpload = multer({ dest: 'uploads/csv/', limits: { fileSize: 10 * 1024 * 1024 } })

// In-memory store (production: Redis/DB)
const csvStore = new Map()

// ─── Myntra Seller Portal Template ───────────────────────────────────
// Based on official Myntra Partner Portal DIY Template v8 (Apparel)
// Columns grouped by section as in the real template

const MYNTRA_TEMPLATE = {
  // Section 1: Business Information (Green header in template)
  business: [
    'styleId',
    'styleGroupId',
    'vendorSkuCode',
    'vendorArticleNumber',
    'brand',
    'CountryOfOrigin1',
    'CountryOfOrigin2',
    'CountryOfOrigin3',
    'CountryOfOrigin4',
    'CountryOfOrigin5',
    'articleType',
    'BrandSize',
    'StandardSize',
    'isStandardSizePresentOnLabel',
    'BrandColour',
    'GTIN',
    'HSN',
    'SKUCode',
    'MRP',
    'manufacturerName',
    'manufacturerAddress',
    'packerName',
    'packerAddress',
  ],
  // Section 2: Discoverability & Product Description (Pink header)
  discoverability: [
    'gender',
    'ageGroup',
    'fashionType',
    'mfnType',
    'Usage',
    'Year',
    'season',
    'ProductDetails',
    'styleNote',
    'materialCareDescription',
    'sizeAndFitDescription',
    'productDescription',
    'productDisplayName',
    'tags',
    'addedDate',
  ],
  // Section 3: Apparel-specific attributes
  apparel: [
    'ColorVariantGroup',
    'Fabric',
    'FabricComposition',
    'PrintOrPatternType',
    'NeckType',
    'SleeveLength',
    'SleeveStyling',
    'Fit',
    'Length',
    'Occasion',
    'Silhouette',
    'Hemline',
    'Embellishment',
    'Transparency',
    'DesignStyling',
    'Closure',
    'WashCare',
    'Type',
  ],
  // Section 4: Measurements (in inches)
  measurements: [
    'AcrossShoulder',
    'BustOrChest',
    'FrontLength',
    'SleeveLen',
    'ToFitBust',
    'Waist',
    'Hip',
  ],
  // Section 5: Model & Images
  model_images: [
    'modelHeight',
    'modelSizeWorn',
    'image1',
    'image2',
    'image3',
    'image4',
    'image5',
    'image6',
  ],
  // Section 6: Anchor verification (our addition)
  anchor: [
    'anchorVerificationStatus',
    'anchorSimilarityScore',
    'anchorMismatchCount',
    'anchorVerificationNotes',
    'anchorVerifiedAt',
  ],
}

const ALL_COLUMNS = [
  ...MYNTRA_TEMPLATE.business,
  ...MYNTRA_TEMPLATE.discoverability,
  ...MYNTRA_TEMPLATE.apparel,
  ...MYNTRA_TEMPLATE.measurements,
  ...MYNTRA_TEMPLATE.model_images,
  ...MYNTRA_TEMPLATE.anchor,
]

// Sample data row for Kurta (for template preview)
const SAMPLE_KURTA = {
  styleId: '', styleGroupId: 'KRT-GRP-001', vendorSkuCode: 'KRT-BLK-S',
  vendorArticleNumber: '1', brand: 'YourBrand',
  CountryOfOrigin1: 'India', CountryOfOrigin2: 'India',
  CountryOfOrigin3: 'India', CountryOfOrigin4: 'India', CountryOfOrigin5: 'India',
  articleType: 'Kurta', BrandSize: 'S', StandardSize: 'S',
  isStandardSizePresentOnLabel: 'Yes', BrandColour: 'Black',
  GTIN: '', HSN: '62114200', SKUCode: '', MRP: '1499',
  manufacturerName: 'Example Manufacturer Pvt Ltd',
  manufacturerAddress: '123 Industrial Area, Delhi, 110001',
  packerName: 'Example Manufacturer Pvt Ltd',
  packerAddress: '123 Industrial Area, Delhi, 110001',
  gender: 'Women', ageGroup: 'Adults-Women', fashionType: 'Fashion',
  mfnType: 'In', Usage: 'Casual', Year: '2025', season: 'Summer',
  ProductDetails: '', styleNote: '',
  materialCareDescription: 'Machine Wash Cold, Do Not Bleach',
  sizeAndFitDescription: 'Suitable for all body types. Model is wearing size S.',
  productDescription: 'Black printed kurta for women, comfortable cotton fabric with traditional motifs.',
  productDisplayName: 'YourBrand Black Printed Cotton Kurta',
  tags: 'kurta, black kurta, cotton kurta, printed kurta, women kurta',
  addedDate: '',
  ColorVariantGroup: '', Fabric: 'Cotton', FabricComposition: '100% Cotton',
  PrintOrPatternType: 'Printed', NeckType: 'Round Neck',
  SleeveLength: 'Three-Quarter Sleeve', SleeveStyling: 'Regular',
  Fit: 'Regular', Length: 'Calf Length', Occasion: 'Casual',
  Silhouette: 'A-Line', Hemline: 'Curved', Embellishment: 'No Embellishment',
  Transparency: 'Opaque', DesignStyling: 'Regular', Closure: 'Slip-On',
  WashCare: 'Machine Wash', Type: 'Ethnic',
  AcrossShoulder: '14', BustOrChest: '36', FrontLength: '46',
  SleeveLen: '18', ToFitBust: '34', Waist: '32', Hip: '38',
  modelHeight: "5'6\"", modelSizeWorn: 'S',
  image1: '', image2: '', image3: '', image4: '', image5: '', image6: '',
  anchorVerificationStatus: '', anchorSimilarityScore: '',
  anchorMismatchCount: '', anchorVerificationNotes: '', anchorVerifiedAt: '',
}

// ─── Routes ──────────────────────────────────────────────────────────

// GET /api/csv/template — download empty Myntra template CSV with sample row
router.get('/template', (req, res) => {
  const csv = stringify([ALL_COLUMNS, Object.values(SAMPLE_KURTA)], { header: false })
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename=myntra_apparel_template.csv')
  res.send(csv)
})

// GET /api/csv/columns — get column structure for UI rendering
router.get('/columns', (req, res) => {
  res.json({
    success: true,
    sections: MYNTRA_TEMPLATE,
    allColumns: ALL_COLUMNS,
    sampleRow: SAMPLE_KURTA,
  })
})

// POST /api/csv/upload — upload a CSV file
router.post('/upload', csvUpload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    const content = fs.readFileSync(req.file.path, 'utf-8')
    let records
    try {
      records = parse(content, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true })
    } catch (parseErr) {
      // Try without header row (raw Myntra template has version row + section headers)
      const lines = content.split('\n').filter(l => l.trim())
      // Find the row that looks like headers (contains styleId or vendorSkuCode)
      let headerIdx = lines.findIndex(l => l.toLowerCase().includes('styleid') || l.toLowerCase().includes('vendorskucode'))
      if (headerIdx === -1) headerIdx = 0
      const cleaned = lines.slice(headerIdx).join('\n')
      records = parse(cleaned, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true })
    }

    const sessionId = req.body.sessionId || Date.now().toString()
    csvStore.set(sessionId, {
      original: records,
      current: JSON.parse(JSON.stringify(records)),
      generated: null,
      published: null,
      uploadedAt: new Date().toISOString(),
      filename: req.file.originalname,
    })

    fs.unlinkSync(req.file.path)

    res.json({
      success: true,
      sessionId,
      rowCount: records.length,
      columns: Object.keys(records[0] || {}),
      preview: records.slice(0, 10),
    })
  } catch (err) {
    console.error('CSV upload failed:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/csv/:sessionId — get CSV data
router.get('/:sessionId', (req, res) => {
  const data = csvStore.get(req.params.sessionId)
  if (!data) return res.status(404).json({ error: 'Session not found' })
  res.json({
    success: true,
    filename: data.filename,
    original: data.original,
    current: data.current,
    generated: data.generated,
    published: data.published,
  })
})

// POST /api/csv/:sessionId/update — update row with verification results
router.post('/:sessionId/update', (req, res) => {
  const data = csvStore.get(req.params.sessionId)
  if (!data) return res.status(404).json({ error: 'Session not found' })

  const { rowIndex, updates, stage } = req.body

  if (stage === 'generated') {
    if (!data.generated) data.generated = JSON.parse(JSON.stringify(data.current))
    const row = data.generated[rowIndex]
    if (row) Object.assign(row, updates)
  } else if (stage === 'published') {
    if (!data.published) data.published = JSON.parse(JSON.stringify(data.generated || data.current))
    const row = data.published[rowIndex]
    if (row) {
      Object.assign(row, updates)
      row.anchorVerificationStatus = updates.anchorVerificationStatus || 'Verified'
      row.anchorVerifiedAt = new Date().toISOString()
    }
  }

  csvStore.set(req.params.sessionId, data)
  res.json({ success: true })
})

// GET /api/csv/:sessionId/download/:stage
router.get('/:sessionId/download/:stage', (req, res) => {
  const data = csvStore.get(req.params.sessionId)
  if (!data) return res.status(404).json({ error: 'Session not found' })

  const stage = req.params.stage
  const rows = data[stage] || data.current
  if (!rows || rows.length === 0) return res.status(404).json({ error: `No data for stage: ${stage}` })

  const csv = stringify(rows, { header: true })
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename=myntra_${stage}_${Date.now()}.csv`)
  res.send(csv)
})

export default router
