import express from 'express'
import fs from 'fs'
import { callWithRetry } from '../services/gemini.js'

const router = express.Router()

router.post('/parse', async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded or invalid file format' })
    }

    const file = req.file
    const mimeType = file.mimetype
    
    // For CSV Files
    if (mimeType === 'text/csv' || file.originalname.endsWith('.csv') || mimeType === 'application/vnd.ms-excel') {
      const csvText = fs.readFileSync(file.path, 'utf-8')
      const lines = csvText.split(/\r?\n/).filter(line => line.trim())
      const measurements = {}
      
      if (lines.length > 1) {
        // Assume first row is header
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
        // Find column index for size, default to 0 if not found
        const sizeIndex = headers.findIndex(h => h === 'size' || h === 'sizes')
        const actualSizeIndex = sizeIndex > -1 ? sizeIndex : 0
        
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim())
          const size = cols[actualSizeIndex]
          
          if (size) {
            measurements[size] = {}
            headers.forEach((h, idx) => {
              if (idx !== actualSizeIndex && h) {
                const val = parseFloat(cols[idx])
                if (!isNaN(val)) {
                  measurements[size][h] = val
                }
              }
            })
          }
        }
      }
      
      return res.json({
        success: true,
        measurements,
        unit: 'inches'
      })
    }
    // For Image Files
    else if (mimeType.startsWith('image/')) {
      const prompt = "Analyze this size chart image. Extract all measurements for each size (S, M, L, XL, XXL etc). Return a JSON object with size as key and measurements (chest, waist, hip, length, shoulder, sleeve_length) in inches as values. Only return the JSON, no other text."
      
      const promptParts = [
        prompt,
        {
          inlineData: {
            data: fs.readFileSync(file.path).toString("base64"),
            mimeType: mimeType
          }
        }
      ]
      
      const responseText = await callWithRetry(promptParts)
      
      let cleaned = responseText.trim()
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
      }
      
      let measurements = {}
      try {
        measurements = JSON.parse(cleaned)
        // Adjust for root-level "measurements" if AI nested it
        if (measurements.measurements) {
          measurements = measurements.measurements
        }
      } catch (err) {
        console.warn('Failed to parse Gemini JSON:', err)
        return res.status(500).json({ success: false, error: 'Failed to parse AI response into JSON.' })
      }
      
      return res.json({
        success: true,
        measurements,
        unit: 'inches'
      })
    }
    // For PDF (Future proofing based on prompt mentions)
    else if (mimeType === 'application/pdf' || file.originalname.endsWith('.pdf')) {
      return res.status(501).json({ success: false, error: 'PDF parsing not yet implemented' })
    } 
    else {
      return res.status(400).json({ success: false, error: 'Unsupported file format' })
    }

  } catch (error) {
    console.error('Size chart parse error:', error)
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' })
  }
})

export default router
