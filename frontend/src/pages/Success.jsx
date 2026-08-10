import { useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowRight, BarChart3, CheckCircle2, Clock3, Hash, LayoutDashboard, Plus, ShieldCheck, Sparkles,
} from 'lucide-react'
import { useApp } from '../AppContext'

export default function Success() {
  const nav = useNavigate()
  const location = useLocation()
  const { verdict } = useApp()
  const publishedProductId = location.state?.productId
  const styleId = useMemo(
    () => `MYN-ANC-${Date.now().toString(36).toUpperCase().slice(-5)}`,
    [],
  )
  const confidence = verdict?.overall_similarity
    ? Math.round(verdict.overall_similarity)
    : 94

  return (
    <main className="success-page page-shell">
      <section className="success-hero">
        <div className="success-confetti success-confetti-one" aria-hidden="true" />
        <div className="success-confetti success-confetti-two" aria-hidden="true" />

        <div className="success-seal">
          <CheckCircle2 size={31} />
        </div>
        <div className="section-kicker"><Sparkles size={12} /> Catalog milestone</div>
        <h1 className="success-headline">Your listing is beautifully ready.</h1>
        <p className="success-subtitle">
          Anchor has verified the evidence and sent your product to Myntra quality review.
          You can keep working while the catalog team completes its check.
        </p>

        <div className="success-status-strip" aria-label="Publication summary">
          <div className="success-stat">
            <span className="success-stat-icon success-stat-icon--green"><ShieldCheck size={17} /></span>
            <div><small>Verification</small><strong>Verified</strong></div>
          </div>
          <div className="success-stat">
            <span className="success-stat-icon success-stat-icon--amber"><Clock3 size={17} /></span>
            <div><small>QC status</small><strong>Pending review</strong></div>
          </div>
          <div className="success-stat">
            <span className="success-stat-icon success-stat-icon--rose"><BarChart3 size={17} /></span>
            <div><small>Confidence</small><strong>{confidence}%</strong></div>
          </div>
          <div className="success-stat">
            <span className="success-stat-icon"><Hash size={17} /></span>
            <div><small>Style ID</small><strong>{styleId}</strong></div>
          </div>
        </div>

        <div className="success-details">
          <span>Status: {verdict?.status || 'Verified'}</span>
          <span aria-hidden="true">•</span>
          <span>Matches: {verdict?.summary?.matches ?? '—'}/{verdict?.summary?.total ?? '—'}</span>
          <span aria-hidden="true">•</span>
          <span>Verified just now</span>
        </div>

        <div className="success-actions">
          <button
            className="btn btn-primary"
            onClick={() => nav(publishedProductId ? `/product/${publishedProductId}` : '/myntra')}
          >
            View shopper page <ArrowRight size={15} />
          </button>
          <button className="btn btn-outline" onClick={() => nav('/new-listing')}>
            <Plus size={15} /> Create another
          </button>
          <button className="btn btn-ghost" onClick={() => nav('/dashboard')}>
            <LayoutDashboard size={15} /> Dashboard
          </button>
        </div>
      </section>
    </main>
  )
}
