import { Router } from 'express'
import { parse } from 'csv-parse/sync'
import { stringify } from 'csv-stringify/sync'
import multer from 'multer'
import fs from 'fs'
import path from 'path'

const router = Router()

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
const csvUploadDir = path.join(process.cwd(), 'uploads', 'csv');
if (!fs.existsSync(csvUploadDir)) {
  fs.mkdirSync(csvUploadDir, { recursive: true });
}

const csvUpload = multer({ dest: csvUploadDir, limits: { fileSize: 10 * 1024 * 1024 } })

// In-memory store (production: Redis/DB)
const csvStore = new Map()

const CATEGORIES = {
  Topwear: {
    columns: [
      'styleId', 'productTitle', 'brand', 'brandColour', 'primaryColour', 'secondaryColour',
      'gender', 'articleType', 'neckType', 'sleeveLength', 'fabric', 'pattern', 'fit',
      'occasion', 'garmentLength', 'hemline', 'transparency', 'embellishment', 'washCare',
      'mrp', 'sellingPrice', 'description', 'sizeChart_S_chest', 'sizeChart_S_length',
      'sizeChart_M_chest', 'sizeChart_M_length', 'sizeChart_L_chest', 'sizeChart_L_length',
      'sizeChart_XL_chest', 'sizeChart_XL_length', 'catalogImage_front', 'catalogImage_back',
      'catalogImage_side', 'catalogImage_closeup', 'catalogImage_full',
      'modelSize', 'modelHeight', 'tags'
    ],
    sample: {
      styleId: 'AV-TS-001', productTitle: 'Men Graphic Print Cotton T-Shirt', brand: 'Roadster',
      brandColour: 'Navy Blue', primaryColour: 'Blue', secondaryColour: 'White', gender: 'Men',
      articleType: 'T-Shirt', neckType: 'Round Neck', sleeveLength: 'Short Sleeve', fabric: 'Cotton',
      pattern: 'Graphic Print', fit: 'Regular', occasion: 'Casual', garmentLength: 'Regular',
      hemline: 'Straight', transparency: 'Opaque', embellishment: 'None', washCare: 'Machine Wash',
      mrp: 999, sellingPrice: 699, description: 'Stylish graphic print t-shirt...',
      sizeChart_S_chest: 38, sizeChart_S_length: 26, sizeChart_M_chest: 40, sizeChart_M_length: 27,
      sizeChart_L_chest: 42, sizeChart_L_length: 28, sizeChart_XL_chest: 44, sizeChart_XL_length: 29,
      catalogImage_front: 'http://localhost:3001/uploads/catalog_front.jpg',
      catalogImage_back: 'http://localhost:3001/uploads/catalog_back.jpg',
      catalogImage_side: 'http://localhost:3001/uploads/catalog_side.jpg',
      catalogImage_closeup: 'http://localhost:3001/uploads/catalog_closeup.jpg',
      catalogImage_full: 'http://localhost:3001/uploads/catalog_full.jpg',
      modelSize: 'M',
      modelHeight: '6\'0"',
      tags: 'graphic tee, casual, summer'
    }
  },
  Bottomwear: {
    columns: [
      'styleId', 'productTitle', 'brand', 'brandColour', 'primaryColour', 'secondaryColour',
      'gender', 'articleType', 'waistRise', 'legStyle', 'fabric', 'pattern', 'fit', 'occasion',
      'garmentLength', 'closureType', 'stretch', 'washCare', 'mrp', 'sellingPrice', 'description',
      'sizeChart_28_waist', 'sizeChart_28_length', 'sizeChart_30_waist', 'sizeChart_30_length',
      'sizeChart_32_waist', 'sizeChart_32_length', 'sizeChart_34_waist', 'sizeChart_34_length',
      'catalogImage_front', 'catalogImage_back', 'catalogImage_side', 'catalogImage_closeup',
      'catalogImage_full', 'modelSize', 'modelHeight', 'tags'
    ],
    sample: {
      styleId: 'AV-JN-001', productTitle: 'Men Slim Fit Stretchable Jeans', brand: 'Wrangler',
      brandColour: 'Dark Blue', primaryColour: 'Blue', secondaryColour: '', gender: 'Men',
      articleType: 'Jeans', waistRise: 'Mid Rise', legStyle: 'Slim', fabric: 'Denim', pattern: 'Solid',
      fit: 'Slim Fit', occasion: 'Casual', garmentLength: 'Full Length', closureType: 'Zip',
      stretch: 'Stretchable', washCare: 'Machine Wash', mrp: 2999, sellingPrice: 1499,
      description: 'Comfortable slim fit stretchable jeans...',
      sizeChart_28_waist: 28, sizeChart_28_length: 40, sizeChart_30_waist: 30, sizeChart_30_length: 41,
      sizeChart_32_waist: 32, sizeChart_32_length: 42, sizeChart_34_waist: 34, sizeChart_34_length: 43,
      catalogImage_front: 'http://localhost:3001/uploads/catalog_front.jpg',
      catalogImage_back: 'http://localhost:3001/uploads/catalog_back.jpg',
      catalogImage_side: 'http://localhost:3001/uploads/catalog_side.jpg',
      catalogImage_closeup: 'http://localhost:3001/uploads/catalog_closeup.jpg',
      catalogImage_full: 'http://localhost:3001/uploads/catalog_full.jpg',
      modelSize: '32',
      modelHeight: '6\'1"',
      tags: 'denim, slim fit, casual wear'
    }
  },
  Dresses: {
    columns: [
      'styleId', 'productTitle', 'brand', 'brandColour', 'primaryColour', 'secondaryColour',
      'gender', 'articleType', 'neckType', 'sleeveLength', 'fabric', 'pattern', 'fit', 'occasion',
      'garmentLength', 'hemline', 'transparency', 'embellishment', 'dupatta', 'washCare', 'mrp',
      'sellingPrice', 'description', 'sizeChart_S_chest', 'sizeChart_S_length', 'sizeChart_M_chest',
      'sizeChart_XL_length', 'catalogImage_front', 'catalogImage_back', 'catalogImage_side',
      'catalogImage_closeup', 'catalogImage_full', 'modelSize', 'modelHeight', 'tags'
    ],
    sample: {
      styleId: 'AV-KT-001', productTitle: 'Women Printed Cotton Kurti', brand: 'Libas',
      brandColour: 'Pink', primaryColour: 'Pink', secondaryColour: 'Gold', gender: 'Women',
      articleType: 'Kurti', neckType: 'V-Neck', sleeveLength: 'Three-Quarter', fabric: 'Cotton',
      pattern: 'Printed', fit: 'Regular', occasion: 'Festive', garmentLength: 'Knee Length',
      hemline: 'Curved', transparency: 'Opaque', embellishment: 'Zari', dupatta: 'Without Dupatta',
      washCare: 'Hand Wash', mrp: 1999, sellingPrice: 899, description: 'Beautiful printed kurti...',
      sizeChart_S_chest: 36, sizeChart_S_length: 42, sizeChart_M_chest: 38, sizeChart_M_length: 42,
      sizeChart_L_chest: 40, sizeChart_L_length: 44, sizeChart_XL_chest: 42, sizeChart_XL_length: 44,
      catalogImage_front: 'http://localhost:3001/uploads/catalog_front.jpg',
      catalogImage_back: 'http://localhost:3001/uploads/catalog_back.jpg',
      catalogImage_side: 'http://localhost:3001/uploads/catalog_side.jpg',
      catalogImage_closeup: 'http://localhost:3001/uploads/catalog_closeup.jpg',
      catalogImage_full: 'http://localhost:3001/uploads/catalog_full.jpg',
      modelSize: 'S',
      modelHeight: '5\'6"',
      tags: 'ethnic wear, traditional, printed kurti'
    }
  },
  Footwear: {
    columns: [
      'styleId', 'productTitle', 'brand', 'brandColour', 'primaryColour', 'secondaryColour',
      'gender', 'articleType', 'material', 'soleMaterial', 'toeShape', 'heelHeight', 'occasion',
      'closureType', 'washCare', 'mrp', 'sellingPrice', 'description', 'sizeChart_6', 'sizeChart_7',
      'sizeChart_8', 'sizeChart_9', 'sizeChart_10', 'catalogImage_front', 'catalogImage_back',
      'catalogImage_side', 'catalogImage_closeup', 'catalogImage_full', 'tags'
    ],
    sample: {
      styleId: 'AV-FW-001', productTitle: 'Men Casual White Sneakers', brand: 'Puma',
      brandColour: 'White', primaryColour: 'White', secondaryColour: 'Black', gender: 'Men',
      articleType: 'Sneakers', material: 'Synthetic Leather', soleMaterial: 'Rubber', toeShape: 'Round',
      heelHeight: 'Flat', occasion: 'Casual', closureType: 'Lace-Up', washCare: 'Wipe with clean cloth',
      mrp: 3999, sellingPrice: 2499, description: 'Classic white sneakers...',
      sizeChart_6: 25, sizeChart_7: 26, sizeChart_8: 27, sizeChart_9: 28, sizeChart_10: 29,
      catalogImage_front: 'http://localhost:3001/uploads/catalog_front.jpg',
      catalogImage_back: 'http://localhost:3001/uploads/catalog_back.jpg',
      catalogImage_side: 'http://localhost:3001/uploads/catalog_side.jpg',
      catalogImage_closeup: 'http://localhost:3001/uploads/catalog_closeup.jpg',
      catalogImage_full: 'http://localhost:3001/uploads/catalog_full.jpg',
      tags: 'sneakers, white shoes, casual'
    }
  }
};

// ─── Routes ──────────────────────────────────────────────────────────

// GET /api/csv/template — download empty template CSV with sample row for specific category
router.get('/template', (req, res) => {
  const categoryName = req.query.category || 'Topwear';
  const category = CATEGORIES[categoryName] || CATEGORIES['Topwear'];

  const csv = stringify([category.sample], { header: true, columns: category.columns })
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename=${categoryName.toLowerCase()}_template.csv`)
  res.send(csv)
})

// GET /api/csv/columns — get column structure for UI rendering
router.get('/columns', (req, res) => {
  const categoryName = req.query.category || 'Topwear';
  const category = CATEGORIES[categoryName] || CATEGORIES['Topwear'];

  res.json({
    success: true,
    allColumns: category.columns,
    sampleRow: category.sample,
  })
})

// POST /api/csv/upload — upload a CSV file
router.post('/upload', csvUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    const content = fs.readFileSync(req.file.path, 'utf-8')
    let records
    try {
      records = parse(content, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true })
    } catch (parseErr) {
      const lines = content.split('\n').filter(l => l.trim())
      let headerIdx = lines.findIndex(l => l.toLowerCase().includes('styleid'))
      if (headerIdx === -1) headerIdx = 0
      const cleaned = lines.slice(headerIdx).join('\n')
      records = parse(cleaned, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true })
    }

    const sessionId = req.body.sessionId || Date.now().toString()

    // Download images for each record if they start with catalogImage_
    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      for (const key of Object.keys(row)) {
        if (key.startsWith('catalogImage_') && row[key]) {
          const url = row[key];
          if (url.startsWith('http://') || url.startsWith('https://')) {
            const view = key.replace('catalogImage_', '');
            const filename = `csv_${sessionId}_row${i}_${view}.jpg`;
            const localPath = path.join(uploadsDir, filename);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            try {
              const response = await fetch(url, { signal: controller.signal });
              if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                fs.writeFileSync(localPath, buffer);
                row[key] = `http://localhost:3001/uploads/${filename}`; // Full URL for frontend
              } else {
                console.warn(`Failed to download ${url}: ${response.statusText}`);
              }
            } catch (e) {
              console.warn(`Failed to download ${url}: ${e.message}`);
            } finally {
              clearTimeout(timeoutId);
            }
          }
        }
      }
    }

    csvStore.set(sessionId, {
      original: JSON.parse(JSON.stringify(records)),
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
  res.setHeader('Content-Disposition', `attachment; filename=${stage}_${Date.now()}.csv`)
  res.send(csv)
})

export default router
