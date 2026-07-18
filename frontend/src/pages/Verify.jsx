import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../AppContext'
import Stepper from '../components/Stepper'
import { runVerification, updateCSVRow } from '../services/api'
import { CheckCircle, XCircle, AlertTriangle, ArrowRight, Eye, Loader, Sparkles, Package, Tag } from 'lucide-react'

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
    anchorFront, anchorBack, anchorCloseup,
    catalogFiles, catalogPreviews, mode, confirmedAttrs,
    anchorExtracted, setCatalogExtracted,
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
  const [generatedMetadata, setGeneratedMetadata] = useState(null)
  const [corrections, setCorrections] = useState(null)

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
      // Collect ALL anchor files
      const anchorFiles = [anchorFront?.file, anchorBack?.file, anchorCloseup?.file].filter(Boolean)

      if (anchorFiles.length === 0) {
        throw new Error('No anchor images found — go back and upload your product photos')
      }

      setProgress(mode === 'generate'
        ? 'Generating listing metadata & running self-check...'
        : 'Running AI visual verification — comparing all images...'
      )

      // ONE API call — sends all images to the single-prompt pipeline
      const result = await runVerification({
        anchorFiles,
        catalogFiles: catalogFiles || [],
        declaredAttrs: confirmedAttrs || {},
        anchorExtracted: anchorExtracted || {},
        mode: mode,
      })

      setComparisonResult(result.comparison || [])
      setCatalogExtracted(result.catalog_attributes || null)
      setModelIssues(result.modelIssues || [])
      setFabricResult(result.fabricResult || null)
      setVerdict(result.verdict || { status: 'PASS', reason: 'Completed', critical_issues: [] })
      if (result.generatedMetadata) setGeneratedMetadata(result.generatedMetadata)
      if (result.corrections) setCorrections(result.corrections)

    } catch (err) {
      console.error('Verification failed:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePublish = async () => {
    const v = verdict
    if (csvSessionId && csvRowIndex !== null && v) {
      const updates = {
        anchorVerificationStatus: v.status,
        anchorMismatchCount: (comparisonResult || []).filter(r => r.status === 'mismatch').length,
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
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            {mode === 'generate' ? 'Generating your listing' : 'Verifying your listing'}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
            {progress}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            This takes 10-20 seconds — AI is analyzing all your images in one pass
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
            <button className="btn btn-primary" onClick={doVerification}>Retry verification</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Results ──
  const rows = comparisonResult || []
  const failCount = rows.filter(r => r.status === 'mismatch' && r.severity === 'HIGH').length + (modelIssues?.length || 0)
  const warnCount = rows.filter(r => r.status === 'mismatch' && r.severity !== 'HIGH').length + rows.filter(r => r.status === 'warning').length
  const passCount = rows.filter(r => r.status === 'match').length
  const v = verdict || { status: 'PASS', reason: 'Completed', critical_issues: [] }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <Stepper steps={FLOW} current={2} />

      {/* Verdict banner */}
      <div className={`verdict-bar ${v.status.toLowerCase()}`}>
        {v.status === 'PASS' && <CheckCircle size={20} color="var(--success)" />}
        {v.status === 'FAIL' && <XCircle size={20} color="var(--danger)" />}
        {v.status === 'WARNING' && <AlertTriangle size={20} color="var(--warning)" />}
        {v.status === 'UNVERIFIED' && <AlertTriangle size={20} color="var(--text-tertiary)" />}
        <div style={{ flex: 1 }}>
          <div className="verdict-title">{v.reason}</div>
          <div className="verdict-sub">
            {v.status === 'FAIL' ? 'Fix the issues below before publishing' :
             v.status === 'WARNING' ? 'Review warnings below. You can still publish.' :
             v.status === 'UNVERIFIED' ? 'Verification could not complete. Please retry or check your setup.' :
             mode === 'generate' ? 'Your listing metadata is ready to publish.' :
             'Your listing is ready to publish.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, fontSize: 12, fontWeight: 600 }}>
          <span style={{ color: 'var(--danger)' }}>{failCount} failed</span>
          <span style={{ color: 'var(--warning)' }}>{warnCount} warnings</span>
          <span style={{ color: 'var(--success)' }}>{passCount} passed</span>
        </div>
      </div>

      {/* 🚀 AI CORRECTION CO-PILOT */}
      {corrections && corrections.length > 0 && (
        <div className="card" style={{ borderLeft: '4px solid var(--accent)', marginTop: 20, animation: 'fadeIn 0.5s ease' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <Sparkles size={20} color="var(--accent)" />
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>AI Correction Co-Pilot</div>
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 16 }}>
            We noticed some discrepancies between your inputs and our visual analysis. Applying these fixes will improve your listing's search ranking and reduce returns.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {corrections.map((c, i) => (
              <div key={i} style={{ background: '#f8f9fa', borderRadius: 8, padding: 12, border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 13, fontWeight: 600, textTransform: 'capitalize', color: 'var(--text-secondary)', marginBottom: 4 }}>
                  {c.field.replace('_', ' ')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <div style={{ textDecoration: 'line-through', color: 'var(--danger)', fontSize: 14 }}>{c.current_value}</div>
                  <ArrowRight size={14} color="var(--text-secondary)" />
                  <div style={{ fontWeight: 600, color: 'var(--success)', fontSize: 14 }}>{c.suggested_value}</div>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {c.reason}
                </div>
                <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => {
                     // In a real app, this would automatically update the seller's input
                     alert(`Accepted fix for ${c.field}`)
                  }}>
                    Accept Fix
                  </button>
                  <button className="btn btn-outline" style={{ padding: '6px 12px', fontSize: 12 }}>
                    Ignore
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ✨ GENERATED METADATA (generate mode only) ✨ */}
      {generatedMetadata && (
        <div className="card" style={{ borderLeft: '3px solid var(--accent)', marginTop: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Sparkles size={18} color="var(--accent)" />
            <div className="card-title" style={{ fontSize: 15, marginBottom: 0, color: 'var(--accent)' }}>
              Generated AI Catalog
            </div>
          </div>

          {generatedMetadata.generated_image_url && (
            <div style={{ marginBottom: 20, textAlign: 'center', background: '#f5f5f5', borderRadius: 8, padding: 8 }}>
              <img 
                src={generatedMetadata.generated_image_url} 
                alt="Generated AI Model" 
                style={{ width: '100%', maxWidth: '300px', height: 'auto', borderRadius: 6 }} 
              />
            </div>
          )}

          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, lineHeight: 1.4 }}>
            {generatedMetadata.title}
          </div>

          {/* Description */}
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.6 }}>
            {generatedMetadata.description}
          </div>

          {/* Key features */}
          {generatedMetadata.key_features?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Package size={12} /> Key Features
              </div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                {generatedMetadata.key_features.map((f, i) => <li key={i}>{f}</li>)}
              </ul>
            </div>
          )}

          {/* Tags */}
          {generatedMetadata.tags?.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Tag size={12} /> Tags
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {generatedMetadata.tags.map((t, i) => (
                  <span key={i} style={{ background: 'var(--bg-highlight)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 8px', fontSize: 11, color: 'var(--text-secondary)' }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Metadata grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
            {generatedMetadata.category_path && (
              <div><strong>Category:</strong> {generatedMetadata.category_path}</div>
            )}
            {generatedMetadata.ideal_for && (
              <div><strong>Ideal for:</strong> {generatedMetadata.ideal_for}</div>
            )}
            {generatedMetadata.fabric_details && (
              <div><strong>Fabric:</strong> {generatedMetadata.fabric_details}</div>
            )}
            {generatedMetadata.care_instructions && (
              <div><strong>Care:</strong> {generatedMetadata.care_instructions}</div>
            )}
            {generatedMetadata.size_fit_note && (
              <div style={{ gridColumn: '1 / -1' }}><strong>Size & Fit:</strong> {generatedMetadata.size_fit_note}</div>
            )}
          </div>
        </div>
      )}

      {/* Catalog image strip (verify mode only) */}
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
          <div className="img-card-label">
            {mode === 'generate' ? 'Anchor (back view)' : 'Catalog image'}
          </div>
          {mode === 'generate' ? (
            anchorBack?.preview ? (
              <img src={anchorBack.preview} alt="Anchor Back" style={{ aspectRatio: '3/4', objectFit: 'cover', maxHeight: 360 }} />
            ) : (
              <div className="img-placeholder">No back view</div>
            )
          ) : (
            catalogPreviews[selectedCat] ? (
              <img src={catalogPreviews[selectedCat]} alt="Catalog" style={{ aspectRatio: '3/4', objectFit: 'cover', maxHeight: 360 }} />
            ) : (
              <div className="img-placeholder">No catalog image</div>
            )
          )}
        </div>
      </div>

      {/* Model proportion issues */}
      {modelIssues?.length > 0 && (
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

      {/* Math scores from hybrid pipeline */}
      {v.math_proportions && (
        <div className="card" style={{ borderLeft: '3px solid var(--accent)' }}>
          <div className="card-title" style={{ fontSize: 14, color: 'var(--accent)' }}>
            Mathematical Proportion Check (MediaPipe)
          </div>
          <div style={{ fontSize: 13 }}>
            Detected Hemline: <strong style={{ textTransform: 'capitalize' }}>{v.math_proportions.mathematical_length_category?.replace('_', ' ')}</strong>
            <br />
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Shoulder: {v.math_proportions.landmarks?.shoulder_y} | Hip: {v.math_proportions.landmarks?.hip_y} | Knee: {v.math_proportions.landmarks?.knee_y} | Hemline: {v.math_proportions.detected_hemline_y}
            </span>
          </div>
        </div>
      )}

      {/* Attribute comparison table */}
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
              <th>{mode === 'generate' ? 'Self-check' : 'Catalog (detected)'}</th>
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
                    {r.anchor_confidence && r.anchor_confidence !== 'N/A' && (
                      <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: CONFIDENCE_DOT[r.anchor_confidence], marginLeft: 4, verticalAlign: 1 }} />
                    )}
                  </td>
                  <td>
                    {r.catalog_value || '—'}
                    {r.catalog_confidence && r.catalog_confidence !== 'N/A' && (
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
          <div className="card-title" style={{ fontSize: 14 }}>Fabric verification (CLIP)</div>

          {v.math_fabric_score !== undefined && (
            <div style={{ fontSize: 12, marginBottom: 8, padding: '4px 8px', background: 'var(--bg-highlight)', borderRadius: 4, display: 'inline-block', border: '1px solid var(--border)' }}>
              <strong>CLIP Similarity Score:</strong> {(v.math_fabric_score * 100).toFixed(1)}%
            </div>
          )}

          {fabricResult.fabric_matches_anchor === true || fabricResult.fabric_matches_anchor === undefined ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--success)' }}>
              <CheckCircle size={14} />
              {fabricResult.issue ? fabricResult.issue : 'Fabric appearance is consistent between anchor and catalog'}
            </div>
          ) : (
            <div style={{ color: 'var(--danger)', fontSize: 13, lineHeight: 1.6 }}>
              <XCircle size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
              {fabricResult.issue || 'Fabric appearance differs between anchor and catalog'}
            </div>
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
          {(v.status === 'FAIL' || v.status === 'UNVERIFIED') ? (
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
