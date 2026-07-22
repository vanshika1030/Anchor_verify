import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
dotenv.config({ path: path.join(process.cwd(), 'backend', '.env') })

import { initGemini } from './backend/services/gemini.js'
import { generateCatalogImage } from './backend/services/gemini.js'
import { extractAnchorAttributes } from './backend/services/gemini.js'

async function run() {
  const keysStr = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY
  const keys = keysStr.split(',').map(k => k.trim())
  initGemini(keys)

  const products = [
    {
      id: 'croptop',
      anchor: 'pregenerated/prod_crop/front.jpeg',
      chart: 'pregenerated/prod_crop/size_chart.png',
      type: 'Crop Top'
    },
    {
      id: 'tshirt',
      anchor: 'pregenerated/prod_tshirt/front.jpeg',
      chart: 'pregenerated/prod_tshirt/size-chart.png',
      type: 'T-shirt'
    },
    {
      id: 'kurti',
      anchor: 'pregenerated/prod_kurti/front.jpeg',
      chart: 'pregenerated/prod_kurti/size-chart.png',
      type: 'Kurti'
    },
    {
      id: 'jeans',
      anchor: 'pregenerated/prod_jeans/front_jeans.jpeg',
      chart: 'pregenerated/prod_jeans/size-chart.png',
      type: 'Jeans'
    }
  ]

  for (const p of products) {
    console.log(`\n\n--- Generating Base Image for ${p.id} ---`)
    const anchorPath = path.resolve(process.cwd(), p.anchor)
    const chartPath = path.resolve(process.cwd(), p.chart)
    
    // First get basic attributes
    console.log('Extracting attributes...')
    const attrs = await extractAnchorAttributes([anchorPath])
    attrs.garment_type = { value: p.type } // Force the type
    attrs.model_size = 'M'
    attrs.model_height = "5'6"
    
    console.log('Generating catalog image composite...')
    const result = await generateCatalogImage([anchorPath], attrs, null, chartPath)
    console.log('Result:', result)
  }
}

run().catch(console.error)
