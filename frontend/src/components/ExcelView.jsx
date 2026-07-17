import { useState } from 'react'

const COLUMNS = ['Style ID', 'Garment Type', 'Color', 'Fabric', 'Sleeve', 'Neck', 'Pattern', 'Fit', 'Length', 'Images', 'Status']

const BEFORE_DATA = [
  ['MYN-28491', 'Kurta', 'Navy Blue', '—', '—', '—', '—', '—', '—', '0 / 5', 'Empty'],
  ['MYN-28492', 'T-Shirt', 'Black', 'Cotton', 'Short', 'Round', 'Solid', 'Regular', 'Regular', '4 / 5', 'Partial'],
  ['MYN-28493', 'Dress', 'Red', '—', '—', '—', '—', '—', '—', '0 / 5', 'Empty'],
]

const AFTER_GEN = [
  ['MYN-28491', 'Kurta', 'Navy Blue', '100% Cotton', 'Elbow', 'Round', 'Printed', 'Regular', 'Regular', '5 / 5', 'Ready for QC'],
  ['MYN-28492', 'T-Shirt', 'Black', 'Cotton', 'Short', 'Round', 'Solid', 'Regular', 'Regular', '5 / 5', 'Ready for QC'],
  ['MYN-28493', 'Dress', 'Red', '—', '—', '—', '—', '—', '—', '0 / 5', 'Empty'],
]

const AFTER_PUB = [
  ['MYN-28491', 'Kurta', 'Navy Blue', '100% Cotton', 'Elbow', 'Round', 'Printed', 'Regular', 'Regular', '5 / 5', 'Verified & Published'],
  ['MYN-28492', 'T-Shirt', 'Black', 'Cotton', 'Short', 'Round', 'Solid', 'Regular', 'Regular', '5 / 5', 'Verified & Published'],
  ['MYN-28493', 'Dress', 'Red', '—', '—', '—', '—', '—', '—', '0 / 5', 'Empty'],
]

const TABS = [
  { key: 'before', label: 'Current sheet', data: BEFORE_DATA },
  { key: 'after', label: 'After generation', data: AFTER_GEN },
  { key: 'published', label: 'After publishing', data: AFTER_PUB },
]

export default function ExcelView() {
  const [tab, setTab] = useState('before')
  const current = TABS.find(t => t.key === tab)

  return (
    <div className="card">
      <div className="excel-header">
        <div>
          <div className="card-title">Myntra DIY Template</div>
          <div className="card-desc" style={{ marginBottom: 0 }}>Excel sheet showing product attributes and catalog status</div>
        </div>
      </div>

      <div className="excel-tabs" style={{ marginBottom: 12 }}>
        {TABS.map(t => (
          <div
            key={t.key}
            className={`excel-tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </div>
        ))}
      </div>

      <div className="excel-wrap">
        <table className="excel-tbl">
          <thead>
            <tr>
              {COLUMNS.map(c => <th key={c}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {current.data.map((row, ri) => {
              const before = BEFORE_DATA[ri]
              return (
                <tr key={ri}>
                  {row.map((cell, ci) => {
                    const wasEmpty = before[ci] === '—' && cell !== '—'
                    const changed = before[ci] !== cell && !wasEmpty && ci > 0
                    const isStatus = ci === COLUMNS.length - 1
                    return (
                      <td
                        key={ci}
                        className={tab !== 'before' && wasEmpty ? 'cell-new' : tab !== 'before' && changed ? 'cell-changed' : ''}
                      >
                        {isStatus ? (
                          <span className={`badge ${
                            cell === 'Verified & Published' ? 'badge-pass' :
                            cell === 'Ready for QC' ? 'badge-warn' :
                            cell === 'Partial' ? 'badge-neutral' : 'badge-neutral'
                          }`}>
                            {cell}
                          </span>
                        ) : cell}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {tab !== 'before' && (
        <div style={{ marginTop: 10, display: 'flex', gap: 16, fontSize: 11, color: 'var(--text-tertiary)' }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'rgba(13,159,110,0.15)', border: '1px solid rgba(13,159,110,0.3)', borderRadius: 2, marginRight: 4 }} />Auto-filled by Anchor</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'rgba(255,63,108,0.1)', border: '1px solid rgba(255,63,108,0.2)', borderRadius: 2, marginRight: 4 }} />Changed</span>
        </div>
      )}
    </div>
  )
}
