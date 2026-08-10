/**
 * Verification-network channel orchestrator.
 *
 * Fans a submission out to the measurement channels served by the local ML
 * worker, and converts each raw reading into three things the rest of the
 * system speaks: a comparison row (for the seller-facing matrix), an optional
 * model issue (for the verdict), and a likelihood ratio (for fusion).
 *
 * Channel independence is the design invariant: colour is colourimetry, print
 * geometry is signal processing, identity is the (single, collapsed) embedding
 * family. Each returns `lr: null` when it could not measure — never a fake
 * neutral — and fusion treats null as "no observation".
 *
 * Thresholds below are reasoned defaults validated against the demo set
 * (same-garment controls vs the known-mismatch striped dress). They are
 * deliberately conservative on the mismatch side; scripts/calibrate.py fits
 * them properly once labelled pairs exist.
 */

import { mlPost } from './ml_client.js'

// CIEDE2000 with kL=2 (textile mode). Bands validated on the demo set:
// same-garment controls land 0–4, the known-bad catalog lands ~9.4,
// different products land 8.5–14+.
const COLOR_BANDS = [
  { max: 3.5, lr: 5.0, label: 'colour-faithful' },
  { max: 6.5, lr: 1.6, label: 'consistent within lighting tolerance' },
  { max: 8.5, lr: 0.7, label: 'noticeably different tone' },
  { max: 12.0, lr: 0.22, label: 'shopper-visible colour difference' },
  { max: Infinity, lr: 0.08, label: 'reads as a different colour' },
]

// Stripe/print repeat measured in cycles per garment width — camera-distance
// invariant. Same-garment control ratio ≈ 0.95–1.05; the demo mismatch is 0.26.
const PERIOD_BANDS = [
  { maxDev: 0.18, lr: 3.5, label: 'print scale preserved' },
  { maxDev: 0.40, lr: 1.0, label: 'print scale uncertain' },
  { maxDev: 0.65, lr: 0.30, label: 'print scale altered' },
  { maxDev: Infinity, lr: 0.10, label: 'print scale substantially altered' },
]

function bandFor(bands, value, key = 'max') {
  return bands.find(band => value <= band[key])
}

export async function runColorChannel(anchorPaths, catalogPaths, garmentHint) {
  const reading = await mlPost('/channel/color', {
    anchor_paths: anchorPaths,
    catalog_paths: catalogPaths,
    garment_hint: garmentHint || null,
  })
  if (!reading?.success) {
    return { channel: 'color_fidelity', status: 'unavailable', lr: null, error: reading?.error || 'worker unavailable' }
  }
  const de = reading.delta_e_median
  const band = bandFor(COLOR_BANDS, de)
  const mismatch = de > 8.5
  const warning = !mismatch && de > 6.5
  return {
    channel: 'color_fidelity',
    status: 'measured',
    lr: band.lr,
    reading,
    row: {
      key: 'color_fidelity',
      label: 'Colour fidelity (ΔE2000)',
      anchor_value: 'Physical garment palette',
      catalog_value: `ΔE ${de} across ${reading.views_used} view pair(s)`,
      declared_value: 'Catalog shows the colour a shopper receives',
      status: mismatch ? 'mismatch' : warning ? 'warning' : 'match',
      severity: mismatch ? 'HIGH' : warning ? 'MEDIUM' : 'LOW',
      note: `${band.label}. Textile-standard CIEDE2000 (kL=2): under 3.5 is imperceptible, above 8.5 is a shopper-visible difference. Per view: ${reading.views.map(v => `${v.view}=${v.delta_e}`).join(', ')}.`,
      source: 'Colourimetry-ΔE2000',
    },
    issue: mismatch ? {
      attr: 'Catalog colour fidelity',
      declared: 'Catalog colour matches the physical garment',
      detected: `ΔE ${de} (median across views)`,
      confidence: 'HIGH',
      severity: 'HIGH',
      note: 'The catalog colour tone measurably differs from the physical anchors. Replace the catalog images with renders or photos that preserve the true colour.',
    } : null,
  }
}

export async function runTextureChannel(anchorPath, catalogPath) {
  const reading = await mlPost('/channel/texture', {
    anchor_path: anchorPath,
    catalog_path: catalogPath,
  })
  if (!reading?.success) {
    return { channel: 'print_geometry', status: 'unavailable', lr: null, error: reading?.error || 'worker unavailable' }
  }

  // Both surfaces solid: the channel truthfully has nothing to add. This is
  // an "honest not-applicable", not a pass — LR null keeps it out of fusion.
  if (!reading.applicable) {
    return {
      channel: 'print_geometry',
      status: 'not_applicable',
      lr: null,
      reading,
      row: {
        key: 'print_geometry',
        label: 'Print geometry (FFT)',
        anchor_value: 'No periodic print structure',
        catalog_value: 'No periodic print structure',
        declared_value: '—',
        status: 'skip',
        severity: 'LOW',
        note: 'Both garment surfaces are solid; print-scale analysis does not apply. Colour, silhouette and attribute channels carry this verification.',
        source: 'FFT-PrintGeometry',
      },
    }
  }

  if (reading.structure_mismatch) {
    return {
      channel: 'print_geometry',
      status: 'measured',
      lr: 0.15,
      reading,
      row: {
        key: 'print_geometry',
        label: 'Print geometry (FFT)',
        anchor_value: reading.anchor_periodic ? 'Regular print structure present' : 'No periodic structure',
        catalog_value: reading.catalog_periodic ? 'Regular print structure present' : 'No periodic structure',
        declared_value: 'Print structure preserved',
        status: 'mismatch',
        severity: 'HIGH',
        note: 'One side shows regular print structure the other lacks — the print was simplified, removed, or invented between the physical garment and the catalog.',
        source: 'FFT-PrintGeometry',
      },
      issue: {
        attr: 'Print structure',
        declared: 'Catalog preserves the physical print',
        detected: reading.anchor_periodic ? 'Catalog lost the periodic print' : 'Catalog invented periodic structure',
        confidence: 'HIGH',
        severity: 'HIGH',
        note: 'Frequency analysis finds periodic print structure on one side only. Replace the catalog view so the real print survives.',
      },
    }
  }

  const deviation = Math.abs(1 - reading.period_ratio)
  const band = bandFor(PERIOD_BANDS, deviation, 'maxDev')
  const mismatch = deviation > 0.40
  return {
    channel: 'print_geometry',
    status: 'measured',
    lr: band.lr,
    reading,
    row: {
      key: 'print_geometry',
      label: 'Print geometry (FFT)',
      anchor_value: `${reading.anchor.cycles_per_garment_width} repeats per garment width`,
      catalog_value: `${reading.catalog.cycles_per_garment_width} repeats per garment width (ratio ${reading.period_ratio})`,
      declared_value: 'Print scale preserved',
      status: mismatch ? 'mismatch' : deviation > 0.18 ? 'warning' : 'match',
      severity: mismatch ? 'HIGH' : deviation > 0.18 ? 'MEDIUM' : 'LOW',
      note: `${band.label}. The repeat is measured in cycles per garment width, so camera distance cannot fake it. Orientation delta ${reading.orientation_delta_deg}°.`,
      source: 'FFT-PrintGeometry',
    },
    issue: mismatch ? {
      attr: 'Print scale',
      declared: 'Catalog preserves the physical print scale',
      detected: `Catalog repeat is ${Math.round(reading.period_ratio * 100)}% of the physical repeat`,
      confidence: 'HIGH',
      severity: 'HIGH',
      note: `The catalog print repeats ${reading.period_ratio < 1 ? 'far fewer' : 'far more'} times across the garment than the physical fabric does — the pattern a shopper sees is not the pattern they receive.`,
    } : null,
  }
}

export async function runIdentityChannel(anchorPath, catalogPath) {
  const reading = await mlPost('/channel/identity', {
    anchor_path: anchorPath,
    catalog_path: catalogPath,
  })
  if (!reading?.success) {
    return { channel: 'identity', status: 'unavailable', lr: null, error: reading?.error || 'worker unavailable' }
  }

  const familyScore = reading.family_similarity
  const spread = reading.family_spread || 0
  // Base LR from the family score…
  let lr
  if (familyScore >= 0.80) lr = 8.0
  else if (familyScore >= 0.68) lr = 3.0
  else if (familyScore >= 0.55) lr = 1.0
  else if (familyScore >= 0.42) lr = 0.3
  else lr = 0.08
  // …dampened toward neutral when the models disagree. Cousins arguing is a
  // reason for caution, not for averaging their confidence.
  if (reading.models_used > 1 && spread > 0.15) {
    lr = 1 + (lr - 1) * 0.4
  }

  const mismatch = lr < 0.5
  return {
    channel: 'identity',
    status: 'measured',
    lr,
    reading,
    row: {
      key: 'identity_embedding',
      label: 'Identity (embedding family)',
      anchor_value: 'Physical garment reference',
      catalog_value: `family similarity ${familyScore}${reading.models_used > 1 ? ` (spread ${spread})` : ''}`,
      declared_value: 'Same physical garment',
      status: mismatch ? 'mismatch' : lr < 1.5 ? 'warning' : 'match',
      severity: mismatch ? 'HIGH' : 'LOW',
      note: reading.models_used > 1
        ? `DINOv2 (same-object) ${reading.dino_similarity} and CLIP (same-category) ${reading.clip_similarity} fused as one channel; disagreement dampens confidence rather than averaging it away.`
        : 'Single embedding model available — identity confidence capped accordingly.',
      source: 'DINOv2+CLIP',
    },
    issue: mismatch ? {
      attr: 'Garment identity',
      declared: 'Catalog shows the anchored garment',
      detected: `Embedding family similarity ${familyScore}`,
      confidence: 'HIGH',
      severity: 'HIGH',
      note: 'The catalog image does not read as the same physical object as the anchors.',
    } : null,
  }
}

/**
 * Run every channel the worker offers for this submission. Channels run
 * concurrently; each degrades independently. `channels` preserves per-channel
 * detail for the UI; `rows`/`issues`/`ratios` feed the existing pipeline.
 */
export async function runVerificationNetwork({ anchorPaths = [], catalogPaths = [], garmentHint = null }) {
  const anchorFront = anchorPaths[0]
  const catalogFront = catalogPaths[0]
  const tasks = []

  if (anchorPaths.length && catalogPaths.length) {
    tasks.push(runColorChannel(anchorPaths, catalogPaths, garmentHint))
    tasks.push(runTextureChannel(anchorFront, catalogFront))
    tasks.push(runIdentityChannel(anchorFront, catalogFront))
  }

  const settled = await Promise.all(tasks)
  const channels = settled.filter(Boolean)
  return {
    channels,
    rows: channels.map(c => c.row).filter(Boolean),
    issues: channels.map(c => c.issue).filter(Boolean),
    ratios: Object.fromEntries(channels.map(c => [c.channel, c.lr])),
  }
}
