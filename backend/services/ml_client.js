/**
 * Local ML worker client (ai_server.py, FastAPI).
 *
 * Every Layer 1–3.7 signal comes from this process, so its failure modes have
 * to be visible instead of silently degrading into an empty result.
 *
 * Two things this module exists to fix:
 *   1. Host consistency. The worker binds IPv4 (0.0.0.0). "localhost" resolves
 *      to ::1 first on a lot of machines, which produced ECONNREFUSED /
 *      "fetch failed" even with the worker running. We always use an explicit
 *      IPv4 loopback unless ANCHOR_ML_URL says otherwise.
 *   2. Timeouts. A hung worker used to hold an Express request open forever
 *      because none of the fetch calls passed a signal.
 */

export const ML_SERVICE_URL = (process.env.ANCHOR_ML_URL || 'http://127.0.0.1:8100').replace(/\/+$/, '')

const DEFAULT_TIMEOUT_MS = Number(process.env.ANCHOR_ML_TIMEOUT_MS || 30000)
const HEALTH_TIMEOUT_MS = Number(process.env.ANCHOR_ML_HEALTH_TIMEOUT_MS || 2000)

/**
 * POST JSON to the ML worker. Returns the parsed body, or null when the worker
 * is unreachable, times out, or replies with a non-2xx / non-JSON response.
 * Callers already treat null as "signal unavailable".
 */
export async function mlPost(endpoint, payload, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${ML_SERVICE_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    if (!response.ok) {
      console.warn(`[ML] ${endpoint} returned HTTP ${response.status}`)
      return null
    }
    return await response.json()
  } catch (err) {
    const reason = err.name === 'AbortError' ? `timed out after ${timeoutMs}ms` : err.message
    console.warn(`[ML] ${endpoint} unavailable: ${reason}`)
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Ask the worker what it actually has loaded.
 *
 * The previous availability probe hit /openapi.json, which FastAPI serves even
 * when CLIP and the ViT failed to load — so a worker with no models looked
 * healthy and every downstream layer returned nothing. /health reports per-model
 * state; if an older worker is running without that route we fall back to the
 * reachability-only answer and say so.
 */
export async function getMlServiceHealth({ timeoutMs = HEALTH_TIMEOUT_MS } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${ML_SERVICE_URL}/health`, { signal: controller.signal })
    if (response.ok) {
      const body = await response.json()
      return {
        reachable: true,
        url: ML_SERVICE_URL,
        clip_loaded: Boolean(body.clip_loaded),
        vit_loaded: Boolean(body.vit_loaded),
        dino_loaded: Boolean(body.dino_loaded),
        capabilities: body.capabilities || null,
        clip_model: body.clip_model || null,
        vit_labels: body.vit_labels || null,
        device: body.device || null,
        detail: body.status || 'ok',
      }
    }
    if (response.status !== 404) {
      return { reachable: true, url: ML_SERVICE_URL, clip_loaded: false, vit_loaded: false, detail: `worker replied HTTP ${response.status}` }
    }
  } catch (err) {
    clearTimeout(timer)
    const reason = err.name === 'AbortError' ? `no response within ${timeoutMs}ms` : err.message
    return { reachable: false, url: ML_SERVICE_URL, clip_loaded: false, vit_loaded: false, detail: reason }
  } finally {
    clearTimeout(timer)
  }

  // /health missing — older worker build. Fall back to a reachability probe and
  // be explicit that model state is unknown rather than assuming it is fine.
  const fallback = new AbortController()
  const fallbackTimer = setTimeout(() => fallback.abort(), timeoutMs)
  try {
    const response = await fetch(`${ML_SERVICE_URL}/openapi.json`, { signal: fallback.signal })
    return {
      reachable: response.ok,
      url: ML_SERVICE_URL,
      clip_loaded: null,
      vit_loaded: null,
      detail: response.ok
        ? 'worker reachable but exposes no /health route — model load state unknown'
        : `worker replied HTTP ${response.status}`,
    }
  } catch (err) {
    return { reachable: false, url: ML_SERVICE_URL, clip_loaded: false, vit_loaded: false, detail: err.message }
  } finally {
    clearTimeout(fallbackTimer)
  }
}
