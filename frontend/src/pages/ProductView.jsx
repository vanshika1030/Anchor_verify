import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ShieldCheck, AlertTriangle, XCircle, ArrowLeft, Star } from 'lucide-react'

export default function ProductView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`http://localhost:3001/api/products/${id}`)
      .then(r => r.json())
      .then(data => { setProduct(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
        <div className="spinner spin" style={{ width: 32, height: 32, borderTopColor: 'var(--accent)' }}></div>
      </div>
    )
  }

  if (!product) {
    return (
      <div style={{ textAlign: 'center', padding: '100px' }}>
        <h2>Product not found</h2>
        <button className="btn btn-primary" onClick={() => navigate('/dashboard')} style={{ marginTop: 16 }}>
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
      </div>
    )
  }

  const attrs = product.attributes || {}
  const badge = product.verification_status === 'pass' || product.verification_status === 'verified'
    ? { icon: ShieldCheck, color: '#0D9F6E', bg: 'rgba(13,159,110,0.08)', label: 'Anchor Verified' }
    : product.verification_status === 'warning'
    ? { icon: AlertTriangle, color: '#D97706', bg: 'rgba(217,119,6,0.08)', label: 'Reviewed' }
    : { icon: XCircle, color: '#DC2626', bg: 'rgba(220,38,38,0.08)', label: 'Unverified' }

  const BadgeIcon = badge.icon

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 20px' }}>
      <button className="btn btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: 20 }}>
        <ArrowLeft size={16} /> Back
      </button>

      <div style={{ display: 'flex', gap: 40 }}>
        {/* Left: Product Image */}
        <div style={{ flex: '0 0 420px' }}>
          <div style={{
            aspectRatio: '3/4',
            borderRadius: 12,
            overflow: 'hidden',
            background: '#f5f5f6',
            border: '1px solid var(--border)',
            position: 'relative'
          }}>
            {product.anchor_image_url ? (
              <img src={product.anchor_image_url} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9CA0AE', fontSize: 16 }}>
                No Image
              </div>
            )}

            {/* Verification Badge */}
            <div style={{
              position: 'absolute', top: 12, left: 12,
              background: badge.bg,
              border: `1px solid ${badge.color}30`,
              padding: '6px 14px',
              borderRadius: 8,
              display: 'flex', alignItems: 'center', gap: 6,
              backdropFilter: 'blur(8px)',
            }}>
              <BadgeIcon size={16} color={badge.color} />
              <span style={{ fontSize: 12, fontWeight: 700, color: badge.color }}>{badge.label}</span>
            </div>
          </div>
        </div>

        {/* Right: Product Info */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: '#94969f', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
            {product.brand_name || 'Brand'}
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8, color: '#282c3f' }}>
            {product.title || attrs.garment_type || 'Product'}
          </h1>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: '#0D9F6E', color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: 13, fontWeight: 700 }}>
              4.2 <Star size={12} fill="white" />
            </div>
            <span style={{ color: '#94969f', fontSize: 13 }}>142 Ratings</span>
          </div>

          <div style={{ borderBottom: '1px solid #e2e4ea', paddingBottom: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: '#282c3f' }}>
                ₹{product.selling_price || product.mrp || '999'}
              </span>
              {product.mrp && product.selling_price && product.mrp > product.selling_price && (
                <>
                  <span style={{ fontSize: 16, color: '#94969f', textDecoration: 'line-through' }}>₹{product.mrp}</span>
                  <span style={{ fontSize: 14, color: '#ff905a', fontWeight: 600 }}>
                    ({Math.round((1 - product.selling_price / product.mrp) * 100)}% OFF)
                  </span>
                </>
              )}
            </div>
            <div style={{ fontSize: 13, color: '#03a685', fontWeight: 600, marginTop: 4 }}>inclusive of all taxes</div>
          </div>

          {/* Attributes */}
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#282c3f', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Product Details
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
              {Object.entries(attrs).filter(([k]) => !k.startsWith('cv_') && !k.startsWith('model_')).map(([key, val]) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f1f4' }}>
                  <span style={{ fontSize: 13, color: '#94969f', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#282c3f' }}>
                    {typeof val === 'object' ? val.value : val}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Verification Info */}
          <div style={{
            background: badge.bg,
            border: `1px solid ${badge.color}20`,
            borderRadius: 12,
            padding: 16
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <BadgeIcon size={18} color={badge.color} />
              <span style={{ fontSize: 14, fontWeight: 700, color: badge.color }}>
                {badge.label}
              </span>
            </div>
            <p style={{ fontSize: 13, color: '#5f6477', lineHeight: 1.6 }}>
              This product has been verified by Anchor's multi-layer AI verification system
              using visual analysis, attribute extraction, and cross-verification.
              {product.verification_score && (
                <> Confidence: <strong>{Math.round(product.verification_score)}%</strong></>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
