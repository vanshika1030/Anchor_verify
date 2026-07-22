/**
 * Phase 1 Test: Run all 4 demo products through the REAL pipeline
 * 
 * This mimics exactly what the frontend does:
 * 1. Parse the demo CSV
 * 2. Map CSV columns to declared attrs (same as NewListing.jsx lines 98-113)
 * 3. Upload anchor images + catalog image paths + declared attrs to /api/verify
 * 4. Report the real verdict
 */

import fs from 'fs'
import path from 'path'

const API = 'http://localhost:3001/api'

// Parse CSV manually (simple implementation, no papaparse needed)
function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8').trim()
  const lines = content.split('\n')
  const headers = lines[0].split(',').map(h => h.trim())
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const values = []
    let current = ''
    let inQuotes = false
    for (const char of lines[i]) {
      if (char === '"') { inQuotes = !inQuotes; continue }
      if (char === ',' && !inQuotes) { values.push(current.trim()); current = ''; continue }
      current += char
    }
    values.push(current.trim())
    
    const row = {}
    headers.forEach((h, j) => { row[h] = values[j] || '' })
    rows.push(row)
  }
  return rows
}

// Map CSV row to declaredAttrs — EXACTLY as NewListing.jsx does it (lines 98-113)
function mapCSVToDeclaredAttrs(row) {
  return {
    garment_type: row.articleType,
    primary_color: row.primaryColour,
    secondary_color: row.secondaryColour,
    pattern_type: row.pattern,
    neck_type: row.neckType,
    sleeve_length: row.sleeveLength,
    fit: row.fit,
    fabric_composition: row.fabric,
    occasion_style: row.occasion,
    overall_length: row.garmentLength,
    hemline: row.hemline,
    brand: row.brand,
    model_size: row.modelSize,
    model_height: row.modelHeight,
  }
}

function getCatalogPaths(row) {
  return [
    row.catalogImage_front, row.catalogImage_back,
    row.catalogImage_side, row.catalogImage_closeup, row.catalogImage_full,
  ].filter(Boolean)
}

function getAnchorPaths(productId) {
  const anchorDir = path.join(process.cwd(), 'demo_data', 'anchors')
  return ['front', 'back', 'closeup']
    .map(view => path.join(anchorDir, `${productId}_${view}.jpeg`))
    .filter(p => fs.existsSync(p))
}

async function runVerification(anchorPaths, catalogPaths, declaredAttrs) {
  console.log('  [TEST] catalogPaths:', catalogPaths)
  const formData = new FormData()
  for (const p of anchorPaths) {
    const blob = new Blob([fs.readFileSync(p)], { type: 'image/jpeg' })
    formData.append('anchorImages', blob, path.basename(p))
  }
  
  // First, extract anchor attributes just like the frontend does!
  const extractFormData = new FormData()
  for (const p of anchorPaths) {
    const blob = new Blob([fs.readFileSync(p)], { type: 'image/jpeg' })
    extractFormData.append('images', blob, path.basename(p))
  }
  
  let anchorExtracted = {}
  try {
    console.log('  [TEST] Extracting anchor attributes...')
    const extRes = await fetch(`${API}/extract/anchor`, { method: 'POST', body: extractFormData })
    if (extRes.ok) {
      const extData = await extRes.json()
      if (extData.success && extData.attributes) {
        anchorExtracted = extData.attributes
      }
    } else {
      console.warn('  [TEST] Failed to extract anchor attributes:', await extRes.text())
    }
  } catch (err) {
    console.warn('  [TEST] Failed to extract anchor attributes:', err.message)
  }

  if (catalogPaths.length > 0) {
    formData.append('catalogPaths', JSON.stringify(catalogPaths))
  }
  formData.append('declaredAttrs', JSON.stringify(declaredAttrs))
  formData.append('anchorExtracted', JSON.stringify(anchorExtracted))
  formData.append('mode', 'upload')
  
  const res = await fetch(`${API}/verify`, { method: 'POST', body: formData })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json()
}

function printResult(productName, result) {
  console.log('\n' + '='.repeat(70))
  console.log(`  ${productName}`)
  console.log('='.repeat(70))
  
  const v = result.verdict
  console.log(`  VERDICT: ${v?.status || 'UNKNOWN'}`)
  console.log(`  REASON:  ${v?.reason || 'N/A'}`)
  if (v?.overall_similarity !== undefined) console.log(`  SIMILARITY: ${v.overall_similarity}%`)
  
  const comp = result.comparison || []
  if (comp.length > 0) {
    console.log('\n  Attribute Comparison:')
    for (const row of comp) {
      const label = (row.label || row.key || '').padEnd(22)
      const status = row.status
      const icon = status === 'match' ? 'OK' : status === 'mismatch' ? 'XX' : status === 'warning' ? '!!' : '--'
      const anchor = row.anchor || row.anchor_value || '-'
      const catalog = row.catalog || row.catalog_value || '-'
      const declared = row.declared || row.declared_value || '-'
      console.log(`  [${icon}] ${label} A:${anchor} | C:${catalog} | D:${declared} [${row.severity || ''}]`)
      if (row.note) console.log(`       note: ${row.note}`)
    }
  }
  
  const issues = result.modelIssues || []
  if (issues.length > 0) {
    console.log('\n  Model Issues:')
    for (const i of issues) {
      console.log(`  [!!] ${i.attr}: declared="${i.declared}" detected="${i.detected}" [${i.severity}]`)
      if (i.note) console.log(`       ${i.note}`)
    }
  }
  
  if (result.fabricResult) {
    const f = result.fabricResult
    console.log(`\n  Fabric: match=${f.fabric_matches_anchor}, sim=${((f.similarity_score||0) * 100).toFixed(1)}% [${f.source}]`)
    if (f.issue) console.log(`       ${f.issue}`)
  }
  if (result.phashResult) {
    const p = result.phashResult
    console.log(`  pHash: distance=${p.phash_distance}, match=${p.is_match}`)
  }
  if (result.corrections?.length > 0) {
    console.log(`\n  Corrections (${result.corrections.length}):`)
    for (const c of result.corrections) console.log(`  -> ${c.field}: "${c.current_value}" -> "${c.suggested_value}"`)
  }
}

async function main() {
  console.log('PHASE 1: All 4 demo products through the REAL pipeline')
  console.log('(Fast-path cache is DISABLED)\n')
  
  // Product 1: Crop Top (expect PASS)
  const topRows = parseCSV('demo_data/topwear_filled.csv')
  const r1Attrs = mapCSVToDeclaredAttrs(topRows[0])
  console.log('Product 1 declaredAttrs:', JSON.stringify(r1Attrs))
  const r1 = await runVerification(getAnchorPaths('croptop'), getCatalogPaths(topRows[0]), r1Attrs)
  printResult('CROP TOP (expected: PASS)', r1)
  
  // Product 2: T-Shirt (expect WARNING)
  const r2Attrs = mapCSVToDeclaredAttrs(topRows[1])
  console.log('\nProduct 2 declaredAttrs:', JSON.stringify(r2Attrs))
  const r2 = await runVerification(getAnchorPaths('tshirt'), getCatalogPaths(topRows[1]), r2Attrs)
  printResult('T-SHIRT (expected: WARNING - fabric)', r2)
  
  // Product 3: Kurti (expect FAIL)
  const dressRows = parseCSV('demo_data/dresses_filled.csv')
  const r3Attrs = mapCSVToDeclaredAttrs(dressRows[0])
  console.log('\nProduct 3 declaredAttrs:', JSON.stringify(r3Attrs))
  const r3 = await runVerification(getAnchorPaths('kurti'), getCatalogPaths(dressRows[0]), r3Attrs)
  printResult('KURTI (expected: FAIL)', r3)
  
  // Product 4: Jeans (expect PASS)
  const bottomRows = parseCSV('demo_data/bottomwear_filled.csv')
  const r4Attrs = mapCSVToDeclaredAttrs(bottomRows[0])
  console.log('\nProduct 4 declaredAttrs:', JSON.stringify(r4Attrs))
  const r4 = await runVerification(getAnchorPaths('jeans'), getCatalogPaths(bottomRows[0]), r4Attrs)
  printResult('JEANS (expected: PASS)', r4)
  
  console.log('\n' + '='.repeat(70))
  console.log('  PHASE 1 SUMMARY')
  console.log('='.repeat(70))
  console.log(`  Crop Top: ${r1.verdict?.status}`)
  console.log(`  T-Shirt:  ${r2.verdict?.status}`)
  console.log(`  Kurti:    ${r3.verdict?.status}`)
  console.log(`  Jeans:    ${r4.verdict?.status}`)
  console.log('='.repeat(70))
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
