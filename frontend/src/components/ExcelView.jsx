import { useState, useRef, useEffect } from 'react'
import { Upload, Download, FileSpreadsheet, Eye, ArrowRight, ChevronLeft, ChevronRight, Play } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../AppContext'
import { uploadCSV, getCSVData, getTemplateURL, getDownloadURL } from '../services/api'

const STAGE_TABS = [
  { key: 'original', label: 'Current Sheet', color: 'var(--text-primary)' },
  { key: 'generated', label: 'After Generation', color: 'var(--warning)' },
  { key: 'published', label: 'After Publishing', color: 'var(--success)' },
]

// Column sections with colors matching real Myntra template
const SECTION_COLORS = {
  business: '#E8F5E9',       // Green (like real template)
  discoverability: '#FCE4EC', // Pink
  apparel: '#FFF3E0',         // Orange-ish
  measurements: '#E3F2FD',    // Blue
  model_images: '#F3E5F5',    // Purple
  anchor: '#FFF9C4',          // Yellow (our addition)
}

export default function ExcelView() {
  const nav = useNavigate()
  const { csvSessionId, setCsvSessionId, setCsvRowIndex, setConfirmedAttrs } = useApp()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('original')
  const [scrollPos, setScrollPos] = useState(0)
  const fileRef = useRef(null)
  const tableRef = useRef(null)

  useEffect(() => {
    if (csvSessionId && !data && !loading) {
      setLoading(true)
      getCSVData(csvSessionId)
        .then(full => setData(full))
        .catch(err => console.error('Failed to load CSV:', err))
        .finally(() => setLoading(false))
    }
  }, [csvSessionId])

  const handleUpload = async (file) => {
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const result = await uploadCSV(file, csvSessionId)
      setCsvSessionId(result.sessionId)
      // Fetch full data
      const full = await getCSVData(result.sessionId)
      setData(full)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const rows = data?.[activeTab] || data?.current || []
  const columns = rows.length > 0 ? Object.keys(rows[0]) : []

  const scrollTable = (dir) => {
    if (tableRef.current) {
      const newPos = scrollPos + (dir * 400)
      tableRef.current.scrollLeft = Math.max(0, newPos)
      setScrollPos(Math.max(0, newPos))
    }
  }

  const handleVerifyRow = (rowIndex, rowData) => {
    setCsvRowIndex(rowIndex)
    // Pre-fill confirmedAttrs from the CSV row!
    setConfirmedAttrs({
      fabric_composition: rowData.FabricComposition || rowData.Fabric || '',
      model_height: rowData.modelHeight || '',
      model_size: rowData.modelSizeWorn || '',
      garment_type: rowData.articleType || '',
      primary_color: rowData.BrandColour || '',
      pattern_type: rowData.PrintOrPatternType || '',
      overall_length: rowData.Length || '',
      sleeve_length: rowData.SleeveLength || '',
      neck_type: rowData.NeckType || '',
      fit: rowData.Fit || '',
    })
    nav('/new-listing')
  }

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileSpreadsheet size={16} color="var(--accent)" />
          <span style={{ fontSize: 14, fontWeight: 600 }}>Product Sheet</span>
          {data && (
            <span style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg-tag)', padding: '2px 8px', borderRadius: 4 }}>
              {data.filename} • {rows.length} products
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={getTemplateURL()} download style={{ textDecoration: 'none' }}>
            <button className="btn btn-outline btn-sm" style={{ fontSize: 11 }}>
              <Download size={12} /> Template
            </button>
          </a>
          <button className="btn btn-outline btn-sm" style={{ fontSize: 11 }} onClick={() => fileRef.current?.click()}>
            <Upload size={12} /> Upload CSV
          </button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" hidden onChange={e => { handleUpload(e.target.files[0]); e.target.value = '' }} />
          {csvSessionId && (
            <a href={getDownloadURL(csvSessionId, activeTab)} download style={{ textDecoration: 'none' }}>
              <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }}>
                <Download size={12} /> Download {STAGE_TABS.find(t => t.key === activeTab)?.label}
              </button>
            </a>
          )}
        </div>
      </div>

      {/* Stage tabs */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {STAGE_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            disabled={!data?.[tab.key] && tab.key !== 'original' && tab.key !== 'current'}
            style={{
              padding: '6px 14px', fontSize: 12, fontWeight: activeTab === tab.key ? 600 : 400,
              border: 'none', background: activeTab === tab.key ? 'var(--accent-light)' : 'transparent',
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-secondary)',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: data?.[tab.key] || tab.key === 'original' ? 'pointer' : 'not-allowed',
              opacity: data?.[tab.key] || tab.key === 'original' ? 1 : 0.4,
              borderRadius: '4px 4px 0 0', transition: 'all 0.15s',
            }}
          >
            {tab.label}
            {!data?.[tab.key] && tab.key !== 'original' && (
              <span style={{ fontSize: 10, marginLeft: 4, color: 'var(--text-tertiary)' }}>(pending)</span>
            )}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger)', fontSize: 12, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Empty state */}
      {!data && !loading && (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <FileSpreadsheet size={32} color="var(--text-tertiary)" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>No product sheet loaded</div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 }}>
            Upload your Myntra seller template CSV, or download our template to get started.
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <a href={getTemplateURL()} download style={{ textDecoration: 'none' }}>
              <button className="btn btn-outline btn-sm">Download template</button>
            </a>
            <button className="btn btn-primary btn-sm" onClick={() => fileRef.current?.click()}>
              Upload your CSV
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '30px' }}>
          <span className="spinner" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>Parsing CSV...</div>
        </div>
      )}

      {/* Table */}
      {data && rows.length > 0 && (
        <>
          {/* Scroll controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
            <button onClick={() => scrollTable(-1)} className="btn btn-ghost btn-sm" style={{ padding: '2px 6px' }}>
              <ChevronLeft size={14} />
            </button>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              {columns.length} columns • scroll horizontally
            </span>
            <button onClick={() => scrollTable(1)} className="btn btn-ghost btn-sm" style={{ padding: '2px 6px' }}>
              <ChevronRight size={14} />
            </button>
          </div>

          <div ref={tableRef} style={{ overflowX: 'auto', maxHeight: 400, border: '1px solid var(--border)', borderRadius: 6 }}>
            <table className="tbl" style={{ fontSize: 11, whiteSpace: 'nowrap', minWidth: columns.length * 120 }}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, background: '#f8f9fa', zIndex: 2, width: 70, textAlign: 'center' }}>Action</th>
                  <th style={{ background: '#f8f9fa', width: 30 }}>#</th>
                  {columns.map((col, i) => (
                    <th key={i} style={{ fontSize: 10, padding: '6px 8px', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }} title={col}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, ri) => (
                  <tr key={ri} style={{ background: '#fff' }}>
                    <td style={{ position: 'sticky', left: 0, background: '#fff', zIndex: 1, borderRight: '1px solid var(--border)' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        style={{ padding: '2px 8px', fontSize: 10, width: '100%' }}
                        onClick={() => handleVerifyRow(ri, row)}
                      >
                        <Play size={10} style={{ marginRight: 4 }} /> Verify
                      </button>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-tertiary)', fontSize: 10 }}>{ri + 1}</td>
                    {columns.map((col, ci) => {
                      const val = row[col] || ''
                      const isAnchor = col.startsWith('anchor')
                      const isChanged = activeTab !== 'original' && data.original?.[ri]?.[col] !== val && val !== ''
                      return (
                        <td
                          key={ci}
                          style={{
                            padding: '4px 8px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis',
                            background: isChanged ? 'rgba(13,159,110,0.08)' : isAnchor ? '#FFFDE7' : undefined,
                            fontWeight: isChanged ? 600 : 400,
                            color: isAnchor && val.includes('FAIL') ? 'var(--danger)' : isAnchor && val.includes('PASS') ? 'var(--success)' : undefined,
                          }}
                          title={val}
                        >
                          {val || <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
