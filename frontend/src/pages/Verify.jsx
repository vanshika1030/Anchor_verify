import React, { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../AppContext'
import Stepper from '../components/Stepper'
import ProcessingOverlay from '../components/ProcessingOverlay'
import { CheckCircle, XCircle, AlertTriangle, ArrowRight, Eye, ZoomIn } from 'lucide-react'

const FLOW = ['Upload', 'Details', 'Verify', 'Publish']
const CATALOG_LABELS = ['Front', 'Back', 'Side', 'Fabric closeup', 'Lifestyle']

// ── Realistic, comprehensive attribute list ──────────────────────────
// This is what a real Gemini extraction would return and compare.
// Covers every visual + structural attribute Myntra QC cares about.

const SCENARIOS = {
  fail: {
    status: 'FAIL',
    reason: '8 structural mismatches detected — this is a different product',
    sub: 'The catalog image does not represent the actual product. Fix all issues before publishing.',
    sim: 0.31,
    rows: [
      // ── HARD attributes (any mismatch = instant FAIL) ──
      { attr: 'Garment Type', anchor: 'Kurta', catalog: 'Anarkali Kurta', declared: 'Kurta', st: 'fail', sev: 'HIGH', cat: 'Structure', note: 'Anchor is a straight kurta; catalog shows flared anarkali silhouette' },
      { attr: 'Primary Color', anchor: 'Black + Red', catalog: 'Black + White', declared: 'Black', st: 'fail', sev: 'HIGH', cat: 'Color', note: 'Motif color is red/maroon in anchor but white in catalog' },
      { attr: 'Pattern Type', anchor: 'Printed (block print)', catalog: 'Embroidered (chikankari)', declared: 'Printed', st: 'fail', sev: 'HIGH', cat: 'Pattern', note: 'Anchor shows screen/block printed motifs; catalog shows raised threadwork embroidery' },
      { attr: 'Fabric', anchor: 'Cotton (opaque, matte)', catalog: 'Georgette (sheer, glossy)', declared: 'Cotton', st: 'fail', sev: 'HIGH', cat: 'Material', note: 'Anchor fabric is opaque cotton; catalog shows semi-transparent georgette with visible sheerness at sleeves' },
      { attr: 'Overall Length', anchor: 'Short / Above-knee', catalog: 'Full length / Maxi', declared: 'Regular', st: 'fail', sev: 'HIGH', cat: 'Structure', note: 'Anchor garment is above-knee length; catalog shows floor-length maxi' },
      { attr: 'Sleeve Length', anchor: 'Short sleeve / Cap', catalog: 'Three-quarter', declared: 'Short', st: 'fail', sev: 'HIGH', cat: 'Structure', note: 'Anchor has short/cap sleeves; catalog shows 3/4 length with lace trim' },
      { attr: 'Embellishment', anchor: 'None', catalog: 'Sequins + Thread embroidery', declared: 'None', st: 'fail', sev: 'HIGH', cat: 'Detail', note: 'Catalog shows sequin and threadwork embellishment; anchor product has none' },
      { attr: 'Transparency', anchor: 'Opaque', catalog: 'Semi-sheer (sleeves, lower body)', declared: 'Opaque', st: 'fail', sev: 'HIGH', cat: 'Material', note: 'Catalog fabric is visibly semi-transparent at sleeves; anchor is fully opaque' },

      // ── SOFT attributes ──
      { attr: 'Neck Type', anchor: 'Round (could not verify — flat lay)', catalog: 'Round', declared: 'Round', st: 'match', cat: 'Structure' },
      { attr: 'Silhouette', anchor: 'Straight (flat lay)', catalog: 'Flared / A-line', declared: 'A-Line', st: 'fail', sev: 'MEDIUM', cat: 'Structure', note: 'Anchor appears straight-cut; catalog shows heavily flared silhouette' },
      { attr: 'Fit', anchor: 'Regular', catalog: 'Fitted at yoke, flared below', declared: 'Regular', st: 'warn', sev: 'MEDIUM', cat: 'Structure', note: 'Catalog shows empire waist with flare — not a standard "regular" fit' },
      { attr: 'Hemline', anchor: 'Straight (not visible — folded)', catalog: 'Curved / Asymmetric', declared: '—', st: 'warn', sev: 'LOW', cat: 'Structure' },
      { attr: 'Occasion', anchor: 'Casual / Daily', catalog: 'Festive / Party', declared: 'Casual', st: 'warn', sev: 'MEDIUM', cat: 'Metadata', note: 'Catalog styling suggests festive wear; anchor product is clearly casual daily-wear' },
      { attr: 'Motif / Print', anchor: 'Paisley / Buta (red on black)', catalog: 'Floral chikankari (white on black)', declared: 'Ethnic', st: 'fail', sev: 'HIGH', cat: 'Pattern', note: 'Completely different motif design — anchor has geometric buta; catalog has floral chikankari' },

      // ── Things that match ──
      { attr: 'Base Color', anchor: 'Black', catalog: 'Black', declared: 'Black', st: 'match', cat: 'Color' },
      { attr: 'Closure', anchor: 'None visible', catalog: 'None visible', declared: '—', st: 'match', cat: 'Structure' },
    ],
    fabric: { ok: false, issue: 'Fabric mismatch detected: anchor shows opaque cotton with matte finish and visible weave texture. Catalog shows semi-transparent georgette with glossy finish. These are fundamentally different materials — a shopper expecting cotton will receive georgette.' },
    recs: [
      { p: 'high', t: 'Wrong product in catalog', d: 'The catalog images show a completely different garment (embroidered georgette anarkali) than the actual product (printed cotton kurta). The listing cannot be published with these images.' },
      { p: 'high', t: 'Color mismatch in motif', d: 'Anchor motifs are red/maroon; catalog motifs are white. This is a different design, not just a color-grading issue.' },
      { p: 'high', t: 'Pattern type mismatch', d: 'Anchor has screen-printed/block-printed patterns. Catalog shows raised chikankari embroidery. These are completely different techniques.' },
      { p: 'high', t: 'Fabric type mismatch', d: 'Anchor is opaque cotton. Catalog is semi-sheer georgette. Fabric closeup required — add a real macro photo of your actual fabric.' },
      { p: 'high', t: 'Length mismatch', d: 'Anchor is short/above-knee. Catalog is full-length/maxi. Size chart will not match the product customers receive.' },
      { p: 'medium', t: 'Embellishment declared as none', d: 'Catalog shows sequins and threadwork but declared metadata says no embellishment. If using these catalog images, metadata must be updated.' },
      { p: 'medium', t: 'Occasion styling inconsistency', d: 'Anchor is casual daily-wear. Catalog is styled as festive/party. This affects search ranking and customer expectations.' },
    ],
    overlays: [
      { x: 5, y: 5, w: 90, h: 25, tip: 'Embroidery pattern: chikankari vs block print' },
      { x: 5, y: 25, w: 45, h: 45, tip: 'Sleeve: 3/4 length vs short; fabric: sheer georgette vs opaque cotton' },
      { x: 50, y: 30, w: 45, h: 40, tip: 'Silhouette: flared anarkali vs straight cut' },
      { x: 10, y: 65, w: 80, h: 30, tip: 'Length: full-length maxi vs above-knee kurta' },
    ],
  },
  pass: {
    status: 'PASS',
    reason: 'All 16 checks passed — listing verified',
    sub: 'Your listing accurately represents your real product and is ready to publish.',
    sim: 0.94,
    rows: [
      { attr: 'Garment Type', anchor: 'Kurta', catalog: 'Kurta', declared: 'Kurta', st: 'match', cat: 'Structure' },
      { attr: 'Primary Color', anchor: 'Black + Red', catalog: 'Black + Red', declared: 'Black, Red', st: 'match', cat: 'Color' },
      { attr: 'Pattern Type', anchor: 'Printed (block print)', catalog: 'Printed (block print)', declared: 'Printed', st: 'match', cat: 'Pattern' },
      { attr: 'Fabric', anchor: 'Cotton (opaque, matte)', catalog: 'Cotton (opaque, matte)', declared: 'Cotton', st: 'match', cat: 'Material' },
      { attr: 'Overall Length', anchor: 'Above-knee', catalog: 'Above-knee', declared: 'Regular', st: 'match', cat: 'Structure' },
      { attr: 'Sleeve Length', anchor: 'Short', catalog: 'Short', declared: 'Short', st: 'match', cat: 'Structure' },
      { attr: 'Embellishment', anchor: 'None', catalog: 'None', declared: 'None', st: 'match', cat: 'Detail' },
      { attr: 'Transparency', anchor: 'Opaque', catalog: 'Opaque', declared: 'Opaque', st: 'match', cat: 'Material' },
      { attr: 'Neck Type', anchor: 'Round', catalog: 'Round', declared: 'Round', st: 'match', cat: 'Structure' },
      { attr: 'Silhouette', anchor: 'Straight', catalog: 'Straight', declared: 'Straight', st: 'match', cat: 'Structure' },
      { attr: 'Fit', anchor: 'Regular', catalog: 'Regular', declared: 'Regular', st: 'match', cat: 'Structure' },
      { attr: 'Hemline', anchor: 'Straight', catalog: 'Straight', declared: '—', st: 'match', cat: 'Structure' },
      { attr: 'Occasion', anchor: 'Casual', catalog: 'Casual', declared: 'Casual', st: 'match', cat: 'Metadata' },
      { attr: 'Motif / Print', anchor: 'Paisley buta', catalog: 'Paisley buta', declared: 'Ethnic', st: 'match', cat: 'Pattern' },
      { attr: 'Base Color', anchor: 'Black', catalog: 'Black', declared: 'Black', st: 'match', cat: 'Color' },
      { attr: 'Closure', anchor: 'None', catalog: 'None', declared: '—', st: 'match', cat: 'Structure' },
    ],
    fabric: { ok: true, issue: null },
    recs: [],
    overlays: [],
  },
  warning: {
    status: 'WARNING',
    reason: '2 soft warnings detected',
    sub: 'Review the issues below. You can still publish but we recommend fixing them.',
    sim: 0.79,
    rows: [
      { attr: 'Garment Type', anchor: 'Kurta', catalog: 'Kurta', declared: 'Kurta', st: 'match', cat: 'Structure' },
      { attr: 'Primary Color', anchor: 'Black + Red', catalog: 'Black + Maroon', declared: 'Black, Red', st: 'warn', sev: 'LOW', cat: 'Color', note: 'Red vs maroon — could be lighting/camera white-balance difference' },
      { attr: 'Pattern Type', anchor: 'Printed', catalog: 'Printed', declared: 'Printed', st: 'match', cat: 'Pattern' },
      { attr: 'Fabric', anchor: 'Cotton', catalog: 'Cotton', declared: 'Cotton', st: 'match', cat: 'Material' },
      { attr: 'Overall Length', anchor: 'Above-knee', catalog: 'Above-knee', declared: 'Regular', st: 'match', cat: 'Structure' },
      { attr: 'Sleeve Length', anchor: 'Short', catalog: 'Short', declared: 'Short', st: 'match', cat: 'Structure' },
      { attr: 'Embellishment', anchor: 'None', catalog: 'None', declared: 'None', st: 'match', cat: 'Detail' },
      { attr: 'Transparency', anchor: 'Opaque', catalog: 'Opaque', declared: 'Opaque', st: 'match', cat: 'Material' },
      { attr: 'Neck Type', anchor: 'Round', catalog: 'Round', declared: 'Round', st: 'match', cat: 'Structure' },
      { attr: 'Silhouette', anchor: 'Straight', catalog: 'Straight', declared: 'Straight', st: 'match', cat: 'Structure' },
      { attr: 'Fit', anchor: 'Regular', catalog: 'Regular', declared: 'Regular', st: 'match', cat: 'Structure' },
      { attr: 'Hemline', anchor: 'Straight', catalog: 'Straight', declared: '—', st: 'match', cat: 'Structure' },
      { attr: 'Occasion', anchor: 'Casual', catalog: 'Casual / Ethnic', declared: 'Casual', st: 'warn', sev: 'MEDIUM', cat: 'Metadata', note: 'Catalog styling leans ethnic — confirm occasion tag' },
      { attr: 'Motif / Print', anchor: 'Paisley buta', catalog: 'Paisley buta', declared: 'Ethnic', st: 'match', cat: 'Pattern' },
      { attr: 'Base Color', anchor: 'Black', catalog: 'Black', declared: 'Black', st: 'match', cat: 'Color' },
      { attr: 'Closure', anchor: 'None', catalog: 'None', declared: '—', st: 'match', cat: 'Structure' },
    ],
    fabric: { ok: true, issue: null },
    recs: [
      { p: 'medium', t: 'Secondary color shade difference', d: 'Anchor motifs appear red; catalog motifs appear maroon/burgundy. This may be a camera white-balance issue. If the actual product is red, ensure the catalog image color is corrected.' },
      { p: 'medium', t: 'Occasion tag may be wrong', d: 'Catalog styling with ethnic backdrop suggests "ethnic" occasion. Current declared tag is "casual". Verify which is correct for search ranking.' },
    ],
    overlays: [
      { x: 15, y: 20, w: 70, h: 50, tip: 'Color shade: red vs maroon — may be lighting difference' },
    ],
  },
}

// Attribute category grouping for clean display
const CATEGORY_ORDER = ['Structure', 'Color', 'Pattern', 'Material', 'Detail', 'Metadata']

export default function Verify() {
  const nav = useNavigate()
  const { anchorPreview, catalogPreviews, mode } = useApp()
  const [processing, setProcessing] = useState(true)
  const [scenario, setScenario] = useState('fail')
  const [hoveredOv, setHoveredOv] = useState(null)
  const [selectedCat, setSelectedCat] = useState(0)
  const [showGenReview, setShowGenReview] = useState(mode === 'generate')
  const [expandedRow, setExpandedRow] = useState(null)

  const d = SCENARIOS[scenario]
  const circ = 2 * Math.PI * 38
  const off = circ * (1 - d.sim)
  const simClr = d.sim >= 0.7 ? 'var(--success)' : d.sim >= 0.55 ? 'var(--warning)' : 'var(--danger)'

  const failCount = d.rows.filter(r => r.st === 'fail').length
  const warnCount = d.rows.filter(r => r.st === 'warn').length
  const passCount = d.rows.filter(r => r.st === 'match').length

  const done = useCallback(() => setProcessing(false), [])

  if (processing) return <ProcessingOverlay onComplete={done} />

  const hasCatalogImages = mode === 'upload' && catalogPreviews.length > 0

  // ── Generation review gate (shows generated images before verification) ──
  if (showGenReview) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <Stepper steps={FLOW} current={2} />

        <div className="card" style={{ textAlign: 'center', padding: '28px 24px' }}>
          <div className="card-title" style={{ fontSize: 18 }}>Generated catalog images</div>
          <div className="card-desc" style={{ marginBottom: 20 }}>
            Review the 5 images generated from your anchor photo. These follow Myntra specs: 3:4 portrait, 1080x1440px, light grey background, model-on shots.
            Once you approve, they will automatically go through verification.
          </div>

          <div className="catalog-grid" style={{ marginBottom: 20 }}>
            {CATALOG_LABELS.map((label, i) => (
              <div
                key={label}
                className={`catalog-thumb ${selectedCat === i ? 'selected' : ''}`}
                onClick={() => setSelectedCat(i)}
              >
                <div className="img-placeholder" style={{ aspectRatio: '3/4', fontSize: 11, flexDirection: 'column', gap: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontWeight: 600 }}>{label}</span>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>1080 x 1440</span>
                </div>
                <div className="catalog-thumb-label">{label}</div>
              </div>
            ))}
          </div>

          {/* Selected image preview */}
          <div className="card" style={{ background: 'var(--bg-page)', marginBottom: 20 }}>
            <div style={{ display: 'flex', gap: 20 }}>
              <div style={{ flex: 1 }}>
                <div className="img-card-label">Anchor (reference)</div>
                {anchorPreview ? (
                  <img src={anchorPreview} alt="Anchor" style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                ) : (
                  <div className="img-placeholder">Anchor photo</div>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div className="img-card-label">Generated — {CATALOG_LABELS[selectedCat]}</div>
                <div className="img-placeholder" style={{ aspectRatio: '3/4', flexDirection: 'column', gap: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ZoomIn size={24} color="var(--text-tertiary)" />
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{CATALOG_LABELS[selectedCat]} view</span>
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>Generated from anchor + confirmed attributes</span>
                  <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>3:4 · 1080x1440 · JPEG · Light grey BG</span>
                </div>
              </div>
            </div>
          </div>

          <div className="info-box" style={{ textAlign: 'left', fontSize: 12, marginBottom: 20 }}>
            <strong>Specs applied:</strong> Model height matches declared ({'"'}5{"'"}6{'"'} / M), garment attributes locked to your confirmed values, 
            light grey studio background, product fills 85%+ of frame. If the generation looks wrong, go back and fix your attributes.
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <button className="btn btn-outline" onClick={() => nav('/new-listing/details')}>
              Go back and edit
            </button>
            <button className="btn btn-primary" onClick={() => setShowGenReview(false)}>
              Approve and run verification <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Main verification results ──
  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <Stepper steps={FLOW} current={2} />

      {/* Demo toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <div className="demo-bar">
          <span className="demo-label">Demo scenario:</span>
          {['pass', 'fail', 'warning'].map(s => (
            <button key={s} className={`demo-btn ${scenario === s ? `on-${s}` : ''}`} onClick={() => setScenario(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Verdict banner */}
      <div className={`verdict-bar ${d.status.toLowerCase()}`}>
        {d.status === 'PASS' && <CheckCircle size={20} color="var(--success)" />}
        {d.status === 'FAIL' && <XCircle size={20} color="var(--danger)" />}
        {d.status === 'WARNING' && <AlertTriangle size={20} color="var(--warning)" />}
        <div style={{ flex: 1 }}>
          <div className="verdict-title">{d.reason}</div>
          <div className="verdict-sub">{d.sub}</div>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 12, fontWeight: 600 }}>
          <span style={{ color: 'var(--danger)' }}>{failCount} failed</span>
          <span style={{ color: 'var(--warning)' }}>{warnCount} warnings</span>
          <span style={{ color: 'var(--success)' }}>{passCount} passed</span>
        </div>
      </div>

      {/* Catalog image strip */}
      {(mode === 'generate' || hasCatalogImages) && (
        <div className="card">
          <div className="card-title">{mode === 'generate' ? 'Generated catalog images' : 'Uploaded catalog images'}</div>
          <div className="card-desc">
            {mode === 'generate'
              ? '5 images generated. Click any image to compare against your anchor.'
              : `${catalogPreviews.length} image${catalogPreviews.length > 1 ? 's' : ''} uploaded. Click to select for comparison.`
            }
          </div>
          <div className="catalog-grid">
            {(mode === 'generate' ? CATALOG_LABELS : catalogPreviews).map((item, i) => (
              <div
                key={i}
                className={`catalog-thumb ${selectedCat === i ? 'selected' : ''}`}
                onClick={() => setSelectedCat(i)}
              >
                {mode === 'generate' ? (
                  <div className="img-placeholder" style={{ aspectRatio: '3/4', fontSize: 11 }}>{item}</div>
                ) : (
                  <img src={item} alt={`Catalog ${i + 1}`} />
                )}
                <div className="catalog-thumb-label">
                  {CATALOG_LABELS[i] || `Image ${i + 1}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Side-by-side comparison */}
      <div className="img-compare">
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="img-card-label">Anchor (real product)</div>
          {anchorPreview ? (
            <img src={anchorPreview} alt="Anchor" style={{ aspectRatio: '3/4', objectFit: 'cover' }} />
          ) : (
            <div className="img-placeholder">Anchor photo</div>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>Source: Seller upload</div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="img-card-label">Catalog image (under verification)</div>
          <div style={{ position: 'relative' }}>
            {hasCatalogImages && catalogPreviews[selectedCat] ? (
              <img src={catalogPreviews[selectedCat]} alt="Catalog" style={{ aspectRatio: '3/4', objectFit: 'cover', width: '100%', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
            ) : (
              <div className="img-placeholder">
                {mode === 'generate' ? `Generated: ${CATALOG_LABELS[selectedCat]}` : 'Catalog image'}
              </div>
            )}
            {d.overlays.map((ov, i) => (
              <div
                key={i} className="mismatch-box"
                style={{ left: `${ov.x}%`, top: `${ov.y}%`, width: `${ov.w}%`, height: `${ov.h}%` }}
                onMouseEnter={() => setHoveredOv(i)} onMouseLeave={() => setHoveredOv(null)}
              >
                {hoveredOv === i && <div className="mismatch-tip">{ov.tip}</div>}
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 6 }}>
            Source: {mode === 'generate' ? 'Anchor generation' : 'Seller upload'}
          </div>
        </div>
      </div>

      {/* Attribute comparison — grouped by category */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="card-title" style={{ fontSize: 14, marginBottom: 0 }}>Attribute comparison ({d.rows.length} attributes checked)</div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Click a row to see details</div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 80 }}>Category</th>
              <th>Attribute</th>
              <th>Anchor (detected)</th>
              <th>Catalog (detected)</th>
              <th>Seller (declared)</th>
              <th style={{ width: 120 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {d.rows.map((r, i) => (
              <React.Fragment key={r.attr}>
                <tr
                  className={r.st === 'fail' ? 'row-fail' : r.st === 'warn' ? 'row-warn' : ''}
                  onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                  style={{ cursor: r.note ? 'pointer' : 'default' }}
                >
                  <td><span className="badge badge-neutral" style={{ fontSize: 9 }}>{r.cat}</span></td>
                  <td style={{ fontWeight: 500 }}>{r.attr}</td>
                  <td>{r.anchor}</td>
                  <td>{r.catalog}</td>
                  <td style={{ color: r.declared === '—' ? 'var(--text-tertiary)' : 'inherit' }}>{r.declared}</td>
                  <td>
                    <span className={`badge ${r.st === 'match' ? 'badge-pass' : r.st === 'fail' ? 'badge-fail' : 'badge-warn'}`}>
                      {r.st === 'match' ? 'Match' : r.st === 'fail' ? `Mismatch${r.sev ? ' \u00B7 ' + r.sev : ''}` : `Warning${r.sev ? ' \u00B7 ' + r.sev : ''}`}
                    </span>
                  </td>
                </tr>
                {expandedRow === i && r.note && (
                  <tr key={`${r.attr}-note`} style={{ background: r.st === 'fail' ? 'var(--danger-bg)' : r.st === 'warn' ? 'var(--warning-bg)' : 'var(--bg-page)' }}>
                    <td colSpan={6} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 14px 12px', borderBottom: '1px solid var(--border)' }}>
                      <Eye size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                      {r.note}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Fabric + similarity */}
      <div className="cols-auto">
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-title" style={{ fontSize: 14 }}>Fabric verification</div>
          {d.fabric.ok ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--success)' }}>
              <CheckCircle size={14} /> Fabric texture verified — identifiable and matches anchor
            </div>
          ) : (
            <>
              <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8, lineHeight: 1.6 }}>
                <XCircle size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                {d.fabric.issue}
              </div>
              <div className="info-box" style={{ fontSize: 12 }}>
                Recommendation: Add a real fabric closeup (macro photo) as the 2nd image in your product carousel. This helps shoppers identify the actual material.
              </div>
            </>
          )}
        </div>

        <div className="card" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: 150 }}>
          <div className="sim-wrap">
            <div className="sim-ring">
              <svg width="88" height="88" viewBox="0 0 88 88">
                <circle className="sim-bg" cx="44" cy="44" r="38" />
                <circle className="sim-fill" cx="44" cy="44" r="38" stroke={simClr}
                  strokeDasharray={circ} strokeDashoffset={off} />
              </svg>
              <div className="sim-val" style={{ color: simClr }}>{Math.round(d.sim * 100)}%</div>
            </div>
            <span className="sim-label">Visual similarity</span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>MobileNetV2</span>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {d.recs.length > 0 && (
        <div className="card mt-20">
          <div className="card-title" style={{ fontSize: 14 }}>Recommendations ({d.recs.length})</div>
          {d.recs.map((r, i) => (
            <div className="rec-item" key={i}>
              <div className={`rec-dot ${r.p}`} />
              <div>
                <div className="rec-title">{r.t}</div>
                <div className="rec-detail">{r.d}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {d.status === 'PASS' && (
        <div className="card mt-20" style={{ textAlign: 'center', padding: 24, color: 'var(--success)', fontSize: 14 }}>
          <CheckCircle size={18} style={{ verticalAlign: -3, marginRight: 6 }} />
          No issues found. All {d.rows.length} attribute checks passed. Listing is ready.
        </div>
      )}

      {/* Action bar */}
      <div className="action-bar mt-20" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: d.status === 'FAIL' ? 'var(--danger)' : d.status === 'PASS' ? 'var(--success)' : 'var(--warning)' }}>
          {d.status === 'FAIL' && `${failCount} issues must be resolved before publishing`}
          {d.status === 'PASS' && `All ${d.rows.length} checks passed`}
          {d.status === 'WARNING' && `${warnCount} warning${warnCount > 1 ? 's' : ''} — publishing is allowed`}
        </div>
        <div className="action-btns">
          {d.status === 'FAIL' && (
            <>
              <button className="btn btn-outline btn-sm" onClick={() => nav('/new-listing/upload')}>
                Replace catalog images
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => nav('/new-listing/details')}>
                Fix attributes
              </button>
              <button className="btn btn-primary btn-sm" disabled>Publish</button>
            </>
          )}
          {d.status === 'PASS' && (
            <button className="btn btn-primary" onClick={() => nav('/new-listing/success')}>
              Publish listing <ArrowRight size={14} />
            </button>
          )}
          {d.status === 'WARNING' && (
            <>
              <button className="btn btn-outline btn-sm" onClick={() => nav('/new-listing/details')}>Review and fix</button>
              <button className="btn btn-primary btn-sm" onClick={() => nav('/new-listing/success')}>Publish anyway</button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
