import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Package, ShieldCheck, AlertTriangle, XCircle, Search,
  ArrowRight, CheckCircle2, Images, Zap, BadgeCheck, Trash2,
  Eye, X, Loader2,
} from 'lucide-react'
import { useApp } from '../AppContext'
import FASHION_EDITORIAL from '../assets/fashion-editorial-hero.png'

const API = 'http://localhost:3001/api'

export default function Dashboard() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [deleteCandidate, setDeleteCandidate] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [notice, setNotice] = useState('')
  const navigate = useNavigate()
  const { seller } = useApp()

  useEffect(() => {
    fetchProducts()
  }, [])

  useEffect(() => {
    if (!deleteCandidate) return undefined
    const closeOnEscape = event => {
      if (event.key === 'Escape' && !deletingId) setDeleteCandidate(null)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [deleteCandidate, deletingId])

  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(''), 3200)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API}/products`, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
      })
      if (res.ok) setProducts(await res.json())
    } catch (err) {
      console.error('Failed to fetch products', err)
    } finally {
      setLoading(false)
    }
  }

  const filteredProducts = products.filter(product => {
    const haystack = `${product.title || ''} ${product.category || ''}`.toLowerCase()
    return haystack.includes(query.trim().toLowerCase())
  })
  const verifiedProducts = products.filter(product => {
    const status = (product.verification_report?.verdict?.status || product.verification_status || '').toLowerCase()
    return ['pass', 'verified'].includes(status) || (status === 'published' && !product.verification_report?.verdict)
  }).length
  const reviewProducts = products.filter(product => {
    const status = (product.verification_report?.verdict?.status || product.verification_status || '').toLowerCase()
    return ['warning', 'fail', 'unverified'].includes(status)
  }).length
  const confidenceScores = products
    .map(product => Number(product.verification_score))
    .filter(Number.isFinite)
  const averageConfidence = confidenceScores.length
    ? `${(confidenceScores.reduce((sum, score) => sum + score, 0) / confidenceScores.length).toFixed(1)}%`
    : '—'

  const requestDelete = (event, product) => {
    event.stopPropagation()
    setDeleteError('')
    setDeleteCandidate(product)
  }

  const handleDelete = async () => {
    if (!deleteCandidate || deletingId) return
    setDeletingId(deleteCandidate.id)
    setDeleteError('')
    try {
      const response = await fetch(`${API}/products/${deleteCandidate.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not delete this listing')

      setProducts(current => current.filter(product => product.id !== deleteCandidate.id))
      setNotice(`“${deleteCandidate.title || 'Listing'}” was removed from seller and citizen catalogs.`)
      setDeleteCandidate(null)
    } catch (error) {
      setDeleteError(error.message)
    } finally {
      setDeletingId(null)
    }
  }

  const renderBadge = status => {
    const normalized = (status || '').toLowerCase()
    if (normalized === 'pass' || normalized === 'verified' || normalized === 'published') {
      return <div className="badge badge-pass" style={{ position: 'absolute', top: 10, right: 10 }}><ShieldCheck size={12} /> Verified</div>
    }
    if (normalized === 'warning') {
      return <div className="badge badge-warn" style={{ position: 'absolute', top: 10, right: 10 }}><AlertTriangle size={12} /> Review</div>
    }
    return <div className="badge badge-fail" style={{ position: 'absolute', top: 10, right: 10 }}><XCircle size={12} /> Needs fix</div>
  }

  return (
    <main className="dashboard-page page-shell">
      <section className="dashboard-hero">
        <div className="hero-copy">
          <div className="hero-eyebrow"><ShieldCheck size={13} /> Anchor Studio · Catalog assurance</div>
          <h1>
            Verify every product claim <em>before shoppers see it.</em>
          </h1>
          <p>
            Welcome back, {seller?.business_name || 'Seller'}. Anchor Studio compares seller metadata, physical-product
            evidence, catalog images, model fit, and sizing so the listing matches what customers receive.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={() => navigate('/new-listing')}>
              <Plus size={17} /> Verify a listing
            </button>
            <button className="btn btn-outline" onClick={() => navigate('/anchor-intro')}>
              Explore Anchor <ArrowRight size={16} />
            </button>
          </div>
          <div className="hero-trust">
            <span><CheckCircle2 size={14} /> Three-source consistency</span>
            <span><Images size={14} /> Print & length checks</span>
            <span><Zap size={14} /> Fit evidence for shoppers</span>
          </div>
        </div>

        <div className="hero-visual" aria-label="Generic fashion editorial with Anchor verification proof">
          <div className="floating-tag one">Multi-category · Inclusive</div>
          <div className="product-preview-card">
            <div className="preview-topline">
              <span>ANCHOR TRUST PREVIEW</span>
              <span className="preview-live">● EVIDENCE READY</span>
            </div>
            <img src={FASHION_EDITORIAL} alt="Contemporary women’s fashion editorial" />
            <div className="preview-caption">
              <div><strong>Fashion catalog proof</strong><small>Metadata · imagery · fit</small></div>
              <span className="preview-score">3-way</span>
            </div>
          </div>
          <div className="floating-tag two">Claims ↔ Product ↔ Catalog</div>
        </div>
      </section>

      <section className="metric-grid" aria-label="Catalog summary">
        <div className="metric-card">
          <div className="metric-icon"><Package size={20} /></div>
          <div><div className="metric-value">{verifiedProducts}</div><div className="metric-label">Evidence verified</div></div>
        </div>
        <div className="metric-card">
          <div className="metric-icon"><Images size={20} /></div>
          <div><div className="metric-value">{reviewProducts}</div><div className="metric-label">Need seller review</div></div>
        </div>
        <div className="metric-card">
          <div className="metric-icon"><BadgeCheck size={20} /></div>
          <div><div className="metric-value">{averageConfidence}</div><div className="metric-label">Average confidence</div></div>
        </div>
      </section>

      <section className="section-heading">
        <div>
          <div className="section-kicker">Catalog workspace</div>
          <h2>My listings</h2>
          <p>Manage every seller listing and its shopper-facing publication state.</p>
        </div>
        <label className="search-wrap">
          <Search size={17} />
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search by product or category"
            aria-label="Search listings"
          />
        </label>
      </section>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <div className="spinner spin" style={{ width: 32, height: 32, borderTopColor: 'var(--accent)' }} />
        </div>
      ) : filteredProducts.length > 0 ? (
        <section className="listing-grid">
          {filteredProducts.map(product => (
            <article key={product.id} className="card listing-card" onClick={() => navigate(`/product/${product.id}`)}>
              <div className="listing-card-media">
                <img
                  src={(product.catalog_images && product.catalog_images.length > 0)
                    ? (typeof product.catalog_images[0] === 'string' ? product.catalog_images[0] : product.catalog_images[0]?.url)
                    : (product.anchor_image_url || FASHION_EDITORIAL)}
                  alt={product.title || 'Catalog product'}
                />
                {renderBadge(product.verification_report?.verdict?.status || product.verification_status || 'unverified')}
              </div>
              <div className="listing-card-body">
                <div className="listing-card-meta">
                  <span>{product.brand_name || product.brand || 'Seller listing'}</span>
                  {product.style_code && <span>#{product.style_code}</span>}
                </div>
                <h3 title={product.title}>{product.title}</h3>
                <div className="listing-category">{product.category || 'Women · Apparel'}</div>
                <div className="listing-card-footer">
                  <div className="listing-price">
                    <small>Price</small>
                    <strong>₹{product.selling_price || product.mrp || '999'}</strong>
                  </div>
                  <div className="listing-actions">
                    <button
                      className="listing-view-btn"
                      onClick={event => { event.stopPropagation(); navigate(`/product/${product.id}`) }}
                    >
                      <Eye size={14} /> View
                    </button>
                    <button
                      className="listing-delete-btn"
                      onClick={event => requestDelete(event, product)}
                      aria-label={`Delete ${product.title || 'listing'}`}
                      title="Delete listing"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="empty-state">
          <div className="empty-graphic"><Package size={34} /></div>
          <h3 style={{ fontSize: 17, marginBottom: 7 }}>{query ? 'No matching listings' : 'Your catalog is ready for its first style'}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
            {query ? 'Try another product name or category.' : 'Upload product photos and Anchor will guide you through the rest.'}
          </p>
          {!query && <button onClick={() => navigate('/new-listing')} className="btn btn-primary"><Plus size={16} /> Add your first listing</button>}
        </section>
      )}

      {notice && (
        <div className="dashboard-toast" role="status">
          <CheckCircle2 size={18} />
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')} aria-label="Dismiss notification">
            <X size={15} />
          </button>
        </div>
      )}

      {deleteCandidate && (
        <div
          className="delete-modal-backdrop"
          role="presentation"
          onMouseDown={() => { if (!deletingId) setDeleteCandidate(null) }}
        >
          <div
            className="delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-listing-title"
            onMouseDown={event => event.stopPropagation()}
          >
            <div className="delete-modal-icon"><Trash2 size={20} /></div>
            <div className="delete-modal-copy">
              <div className="section-kicker">Catalog control</div>
              <h3 id="delete-listing-title">Delete this listing?</h3>
              <p>
                <strong>{deleteCandidate.title || 'This listing'}</strong> will be removed from My Listings
                and the citizen portal immediately. This action cannot be undone.
              </p>
            </div>
            {deleteError && <div className="delete-error" role="alert">{deleteError}</div>}
            <div className="delete-modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setDeleteCandidate(null)}
                disabled={Boolean(deletingId)}
              >
                Keep listing
              </button>
              <button
                type="button"
                className="btn delete-confirm-btn"
                onClick={handleDelete}
                disabled={Boolean(deletingId)}
              >
                {deletingId
                  ? <><Loader2 size={16} className="spin" /> Deleting…</>
                  : <><Trash2 size={16} /> Delete everywhere</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
