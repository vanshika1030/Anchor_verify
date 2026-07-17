import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../AppContext'
import Stepper from '../components/Stepper'
import { extractCatalogAttributes, runVerification as runVerifyAPI, updateCSVRow } from '../services/api'
import { CheckCircle, XCircle, AlertTriangle, ArrowRight, Eye, Loader } from 'lucide-react'

const FLOW = ['Upload', 'Details', 'Verify', 'Publish']
const CONFIDENCE_DOT = { HIGH: 'var(--success)', MEDIUM: 'var(--warning)', LOW: 'var(--danger)' }

const ATTR_LABELS = {
  garment_type: 'Garment type', primary_color: 'Primary color', secondary_color: 'Secondary color',
  pattern_type: 'Pattern type', fabric_appearance: 'Fabric appearance', overall_length: 'Overall length',
  sleeve_length: 'Sleeve length', neck_type: 'Neck type', silhouette: 'Silhouette', fit: 'Fit',
  embellishment: 'Embellishment', transparency: 'Transparency', hemline: 'Hemline',
  occasion_style: 'Occasion / style', motif_description: 'Motif / print', closure_type: 'Closure',
  structural_features: 'Features', model_apparent_height: 'Model height (detected)',
  model_apparent_build: 'Model build (detected)',
}

export default function Verify() {
  const nav = useNavigate()
  const {
    anchorFront, anchorCloseup,
    catalogFiles, catalogPreviews, mode, confirmedAttrs,
    anchorExtracted, catalogExtracted, setCatalogExtracted,
    comparisonResult, setComparisonResult,
    fabricResult, setFabricResult,
    verdict, setVerdict,
    modelIssues, setModelIssues,
    csvSessionId, csvRowIndex,
  } = useApp()

  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState(null)
  const [selectedCat, setSelectedCat] = useState(0)
  const [expandedRow, setExpandedRow] = useState(null)

  useEffect(() => {
    if (comparisonResult && verdict) {
      setLoading(false)
      return
    }
    doVerification()
  }, [])

  async function doVerification() {
    setLoading(true)
    setError(null)
    try {
      // Step 1: Extract catalog attributes via backend
      setProgress('Analyzing catalog images...')
      if (catalogFiles.length === 0 && mode !== 'generate') {
        throw new Error('No catalog images to verify')
      }

      let catAttrs = catalogExtracted
      if (!catAttrs && catalogFiles.length > 0) {
        const catResult = await extractCatalogAttributes(catalogFiles)
        catAttrs = catResult.attributes
        setCatalogExtracted(catAttrs)
      }

      // Step 2: Run full verification pipeline on backend
      setProgress('Running verification pipeline...')
      const result = await runVerifyAPI({
        anchorAttrs: anchorExtracted,
        catalogAttrs: catAttrs || {},
        declaredAttrs: confirmedAttrs || {},
        modelHeight: confirmedAttrs?.model_height,
        modelSize: confirmedAttrs?.model_size,
        anchorCloseupFile: anchorCloseup?.file,
        catalogImageFiles: catalogFiles,
      })

      setComparisonResult(result.comparison)
      setModelIssues(result.modelIssues || [])
      setFabricResult(result.fabricResult)
      setVerdict(result.verdict)

    } catch (err) {
      console.error('Verification failed:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePublish = async () => {
    if (csvSessionId && csvRowIndex !== null && v) {
      const updates = {
        anchorVerificationStatus: v.status,
        anchorSimilarityScore: v.overall_similarity !== undefined ? `${v.overall_similarity}%` : '',
        anchorMismatchCount: v.structural_mismatches?.length || 0,
        anchorVerificationNotes: v.reason || '',
      }
      try {
        await updateCSVRow(csvSessionId, csvRowIndex, updates, 'published')
      } catch (err) {
        console.error('Failed to update CSV row:', err)
      }
    }
    nav('/new-listing/success')
  }

  // ── Loading state ──
  if (loading) {
    return (
      <div style={{ maxWidth: 500, margin: '80px auto', textAlign: 'center' }}>
        <Stepper steps={FLOW} current={2} />
        <div className="card" style={{ padding: '48px 32px' }}>
          <Loader size={32} color="var(--accent)" className="spin" style={{ marginBottom: 16 }} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Verifying your listing</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
            {progress}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            This takes 10-15 seconds — Gemini is analyzing your images
          </div>
        </div>
      </div>
    )
  }

  // ── Error state ──
  if (error) {
    return (
      <div style={{ maxWidth: 500, margin: '80px auto', textAlign: 'center' }}>
        <Stepper steps={FLOW} current={2} />
        <div className="card" style={{ padding: '32px' }}>
          <XCircle size={28} color="var(--danger)" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6, color: 'var(--danger)' }}>Verification failed</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>{error}</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-outline" onClick={() => nav('/new-listing/upload')}>Go back</button>
            <button className="btn btn-primary" onClick={runVerification}>Retry verification</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Results ──
  const rows = comparisonResult || []
  const failCount = rows.filter(r => r.status === 'mismatch' && r.severity === 'HIGH').length + modelIssues.length
  const warnCount = rows.filter(r => r.status === 'mismatch' && r.severity !== 'HIGH').length + rows.filter(r => r.status === 'warning').length
  const passCount = rows.filter(r => r.status === 'match').length
  const v = verdict || { status: 'PASS', reason: 'Completed', counts: { fail: 0, warn: 0, pass: 0 } }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <Stepper steps={FLOW} current={2} />

      {/* Verdict banner */}
      <div className={`verdict-bar ${v.status.toLowerCase()}`}>
        {v.status === 'PASS' && <CheckCircle size={20} color="var(--success)" />}
        {v.status === 'FAIL' && <XCircle size={20} color="var(--danger)" />}
        {v.status === 'WARNING' && <AlertTriangle size={20} color="var(--warning)" />}
        <div style={{ flex: 1 }}>
          <div className="verdict-title">{v.reason}</div>
          <div className="verdict-sub">
            {v.status === 'FAIL' ? 'Fix the issues below before publishing' :
             v.status === 'WARNING' ? 'Review warnings below. You can still publish.' :
             'Your listing is ready to publish.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 12, fontWeight: 600 }}>
          <span style={{ color: 'var(--danger)' }}>{failCount} failed</span>
          <span style={{ color: 'var(--warning)' }}>{warnCount} warnings</span>
          <span style={{ color: 'var(--success)' }}>{passCount} passed</span>
        </div>
      </div>

      {/* Catalog image strip */}
      {catalogPreviews.length > 0 && (
        <div className="card">
          <div className="card-title">Catalog images under verification</div>
          <div className="catalog-grid">
            {catalogPreviews.map((p, i) => (
              <div key={i} className={`catalog-thumb ${selectedCat === i ? 'selected' : ''}`} onClick={() => setSelectedCat(i)}>
                <img src={p} alt={`Catalog ${i + 1}`} />
                <div className="catalog-thumb-label">Image {i + 1}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Side-by-side comparison */}
      <div className="img-compare">
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="img-card-label">Anchor (real product)</div>
          {anchorFront?.preview ? (
            <img src={anchorFront.preview} alt="Anchor" style={{ aspectRatio: '3/4', objectFit: 'cover', maxHeight: 360 }} />
          ) : (
            <div className="img-placeholder">Anchor photo</div>
          )}
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="img-card-label">Catalog image</div>
          {catalogPreviews[selectedCat] ? (
            <img src={catalogPreviews[selectedCat]} alt="Catalog" style={{ aspectRatio: '3/4', objectFit: 'cover', maxHeight: 360 }} />
          ) : (
            <div className="img-placeholder">No catalog image</div>
          )}
        </div>
      </div>

      {/* Model proportion issues */}
      {modelIssues.length > 0 && (
        <div className="card" style={{ borderLeft: '3px solid var(--danger)' }}>
          <div className="card-title" style={{ fontSize: 14, color: 'var(--danger)' }}>
            Model proportion mismatches
          </div>
          {modelIssues.map((issue, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: i < modelIssues.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{issue.attr}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Declared: <strong>{issue.declared}</strong> — Detected: <strong>{issue.detected}</strong>
              </div>
              <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 3 }}>{issue.note}</div>
            </div>
          ))}
        </div>
      )}

      {/* Attribute comparison table — REAL DATA */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="card-title" style={{ fontSize: 14, marginBottom: 0 }}>
            Attribute comparison ({rows.length} attributes checked)
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Click a row to see details</div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Attribute</th>
              <th>Anchor (detected)</th>
              <th>Catalog (detected)</th>
              <th>Seller (declared)</th>
              <th style={{ width: 130 }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <React.Fragment key={r.key || i}>
                <tr
                  className={r.status === 'mismatch' ? (r.severity === 'HIGH' ? 'row-fail' : 'row-warn') : r.status === 'warning' ? 'row-warn' : ''}
                  onClick={() => setExpandedRow(expandedRow === i ? null : i)}
                  style={{ cursor: r.note ? 'pointer' : 'default' }}
                >
                  <td style={{ fontWeight: 500 }}>{ATTR_LABELS[r.key] || r.key}</td>
                  <td>
                    {r.anchor_value || '—'}
                    {r.anchor_confidence && (
                      <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: CONFIDENCE_DOT[r.anchor_confidence], marginLeft: 4, verticalAlign: 1 }} />
                    )}
                  </td>
                  <td>
                    {r.catalog_value || '—'}
                    {r.catalog_confidence && (
                      <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: CONFIDENCE_DOT[r.catalog_confidence], marginLeft: 4, verticalAlign: 1 }} />
                    )}
                  </td>
                  <td style={{ color: !r.declared_value || r.declared_value === '—' ? 'var(--text-tertiary)' : 'inherit' }}>
                    {r.declared_value || '—'}
                  </td>
                  <td>
                    <span className={`badge ${r.status === 'match' ? 'badge-pass' : r.status === 'mismatch' ? (r.severity === 'HIGH' ? 'badge-fail' : 'badge-warn') : r.status === 'warning' ? 'badge-warn' : 'badge-neutral'}`}>
                      {r.status === 'match' ? 'Match' :
                       r.status === 'mismatch' ? `Mismatch \u00B7 ${r.severity}` :
                       r.status === 'warning' ? `Warning \u00B7 ${r.severity || 'LOW'}` :
                       'Skipped'}
                    </span>
                  </td>
                </tr>
                {expandedRow === i && r.note && (
                  <tr style={{ background: r.status === 'mismatch' && r.severity === 'HIGH' ? 'var(--danger-bg)' : r.status === 'warning' || r.status === 'mismatch' ? 'var(--warning-bg)' : 'var(--bg-page)' }}>
                    <td colSpan={5} style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '8px 14px 12px', borderBottom: '1px solid var(--border)' }}>
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

      {/* Fabric verification */}
      {fabricResult && (
        <div className="card">
          <div className="card-title" style={{ fontSize: 14 }}>Fabric verification</div>
          {fabricResult.fabric_matches_anchor === true || fabricResult.fabric_matches_anchor === undefined ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--success)' }}>
              <CheckCircle size={14} />
              {fabricResult.issue ? fabricResult.issue : 'Fabric appearance is consistent between anchor and catalog'}
            </div>
          ) : (
            <>
              <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8, lineHeight: 1.6 }}>
                <XCircle size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                {fabricResult.issue || 'Fabric appearance differs between anchor and catalog'}
              </div>
              {fabricResult.anchor_fabric_appearance && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  <strong>Anchor:</strong> {fabricResult.anchor_fabric_appearance}
                </div>
              )}
              {fabricResult.catalog_fabric_appearance && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  <strong>Catalog:</strong> {fabricResult.catalog_fabric_appearance}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Action bar */}
      <div className="action-bar mt-20" style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: v.status === 'FAIL' ? 'var(--danger)' : v.status === 'PASS' ? 'var(--success)' : 'var(--warning)' }}>
          {v.status === 'FAIL' && `${failCount} issue${failCount > 1 ? 's' : ''} must be resolved before publishing`}
          {v.status === 'PASS' && `All checks passed`}
          {v.status === 'WARNING' && `${warnCount} warning${warnCount > 1 ? 's' : ''} — publishing is allowed`}
        </div>
        <div className="action-btns">
          <button className="btn btn-outline btn-sm" onClick={() => nav('/new-listing/upload')}>
            Replace images
          </button>
          {v.status === 'FAIL' ? (
            <button className="btn btn-primary btn-sm" disabled>Publish (blocked)</button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={handlePublish}>
              Publish listing <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
