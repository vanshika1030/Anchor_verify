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

/** Send catalog image files to backend for extraction */
export async function extractCatalogAttributes(files) {
  const form = new FormData()
  for (const f of files) {
    if (f instanceof File || f instanceof Blob) {
      form.append('images', f)
    }
  }
  return post('/extract/catalog', form, true)
}

// ─── Verify ──────────────────────────────────────────────────────────

/** Run full verification pipeline */
export async function runVerification({ anchorAttrs, catalogAttrs, declaredAttrs, modelHeight, modelSize, anchorCloseupFile, catalogImageFiles }) {
  const form = new FormData()
  form.append('anchorAttrs', JSON.stringify(anchorAttrs))
  form.append('catalogAttrs', JSON.stringify(catalogAttrs))
  form.append('declaredAttrs', JSON.stringify(declaredAttrs))
  form.append('modelHeight', modelHeight || '')
  form.append('modelSize', modelSize || '')

  if (anchorCloseupFile instanceof File) {
    form.append('anchorCloseup', anchorCloseupFile)
  }
  if (catalogImageFiles) {
    for (const f of catalogImageFiles) {
      if (f instanceof File) form.append('catalogImages', f)
    }
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
export function getTemplateURL() {
  return `${API}/csv/template`
}

/** Download CSV at stage */
export function getDownloadURL(sessionId, stage) {
  return `${API}/csv/${sessionId}/download/${stage}`
}

// ─── Health ──────────────────────────────────────────────────────────

export async function checkHealth() {
  return get('/health')
}
