const API = 'http://localhost:3001/api'

// ─── Helpers ─────────────────────────────────────────────────────────

async function post(url, body, isFormData = false) {
  const opts = { method: 'POST' }
  if (isFormData) {
    opts.body = body
  } else {
    opts.headers = { 'Content-Type': 'application/json' }
    opts.body = JSON.stringify(body)
  }
  const res = await fetch(`${API}${url}`, opts)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `API error: ${res.status}`)
  return data
}

async function get(url) {
  const res = await fetch(`${API}${url}`)
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || `API error: ${res.status}`)
  return data
}

async function downloadResource(url, fallbackName) {
  const res = await fetch(url)
  if (!res.ok) {
    let message = `Download failed: ${res.status}`
    try {
      const body = await res.json()
      message = body.error || message
    } catch {
      // Keep the status-based message when the response is not JSON.
    }
    throw new Error(message)
  }

  const blob = await res.blob()
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fallbackName
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
}

// ─── Extract ─────────────────────────────────────────────────────────

/** Send anchor image files to backend for extraction */
export async function extractAnchorAttributes(files) {
  const form = new FormData()
  for (const f of files) {
    if (f instanceof File || f instanceof Blob) {
      form.append('images', f)
    }
  }
  return post('/extract/anchor', form, true)
}

// ─── Verify (NEW — single-prompt architecture) ──────────────────────

/** Run full verification pipeline — sends ALL images to one LLM call */
export async function runVerification({ anchorFiles, catalogFiles, sizeChartFile, sizeChartMeasurements, declaredAttrs, anchorExtracted, mode }) {
  const form = new FormData()

  // Anchor images
  for (const f of (anchorFiles || [])) {
    if (f instanceof File) form.append('anchorImages', f)
  }

  // Catalog images (empty in generate mode)
  const catalogPaths = []
  for (const f of (catalogFiles || [])) {
    if (f instanceof File) form.append('catalogImages', f)
    else if (typeof f === 'string') catalogPaths.push(f)
  }
  if (catalogPaths.length > 0) {
    form.append('catalogPaths', JSON.stringify(catalogPaths))
  }

  if (sizeChartFile instanceof File) {
    form.append('sizeChart', sizeChartFile)
  }

  // Metadata
  form.append('declaredAttrs', JSON.stringify(declaredAttrs || {}))
  form.append('anchorExtracted', JSON.stringify(anchorExtracted || {}))
  form.append('mode', mode || 'upload')
  if (sizeChartMeasurements) {
    form.append('sizeChartMeasurements', JSON.stringify(sizeChartMeasurements))
  }

  return post('/verify', form, true)
}

// ─── CSV ─────────────────────────────────────────────────────────────

/** Upload a CSV file */
export async function uploadCSV(file, sessionId) {
  const form = new FormData()
  form.append('file', file)
  if (sessionId) form.append('sessionId', sessionId)
  return post('/csv/upload', form, true)
}

/** Get CSV data for a session */
export async function getCSVData(sessionId) {
  return get(`/csv/${sessionId}`)
}

/** Update a CSV row */
export async function updateCSVRow(sessionId, rowIndex, updates, stage) {
  return post(`/csv/${sessionId}/update`, { rowIndex, updates, stage })
}

/** Download CSV template */
export function getTemplateURL(category = 'Topwear') {
  return `${API}/csv/template?category=${category}`
}

/** Download a template without navigating away from the seller workspace. */
export async function downloadTemplate(category = 'Topwear') {
  const safeCategory = category || 'Topwear'
  return downloadResource(
    getTemplateURL(safeCategory),
    `${safeCategory.toLowerCase()}_template.csv`,
  )
}

/** Download CSV at stage */
export function getDownloadURL(sessionId, stage) {
  return `${API}/csv/${sessionId}/download/${stage}`
}

/** Download a processed CSV without navigating away from the current screen. */
export async function downloadCSVStage(sessionId, stage) {
  return downloadResource(
    getDownloadURL(sessionId, stage),
    `${stage || 'catalog'}_products.csv`,
  )
}

// ─── Health ──────────────────────────────────────────────────────────

export async function checkHealth() {
  return get('/health')
}
