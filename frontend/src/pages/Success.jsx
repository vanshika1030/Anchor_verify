import { useNavigate } from 'react-router-dom'
import { CheckCircle, ArrowRight, Clock, Hash, Shield, BarChart3 } from 'lucide-react'
import ExcelView from '../components/ExcelView'

export default function Success() {
  const nav = useNavigate()

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      {/* Celebration */}
      <div className="card" style={{ textAlign: 'center', padding: '44px 32px 36px' }}>
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          background: 'var(--success-bg)', border: '2px solid var(--success)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 18px',
        }}>
          <CheckCircle size={32} color="var(--success)" />
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 6 }}>
          Listing published
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24, lineHeight: 1.7 }}>
          Your listing has been verified by Anchor and submitted to Myntra QC.
          It will go live once approved by the catalog team.
        </p>

        {/* Summary grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, textAlign: 'left', marginBottom: 24 }}>
          <div style={{ padding: '12px 16px', background: 'var(--bg-page)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
              <Shield size={12} /> Verification
            </div>
            <span className="badge badge-pass" style={{ fontSize: 12, padding: '3px 10px' }}>Verified</span>
          </div>
          <div style={{ padding: '12px 16px', background: 'var(--bg-page)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
              <Clock size={12} /> QC Status
            </div>
            <span className="badge badge-warn" style={{ fontSize: 12, padding: '3px 10px' }}>Pending review</span>
          </div>
          <div style={{ padding: '12px 16px', background: 'var(--bg-page)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
              <BarChart3 size={12} /> Confidence
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--success)' }}>94%</div>
          </div>
          <div style={{ padding: '12px 16px', background: 'var(--bg-page)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
              <Hash size={12} /> Style ID
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>MYN-ANC-28491</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 24 }}>
          <span>Checks passed: 8/8</span>
          <span>|</span>
          <span>Images: 5/5</span>
          <span>|</span>
          <span>Verified: Just now</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button className="btn btn-outline" onClick={() => nav('/new-listing/upload')}>
            Create another listing
          </button>
          <button className="btn btn-primary" onClick={() => nav('/')}>
            Back to dashboard <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Excel view showing published state */}
      <ExcelView />
    </div>
  )
}
