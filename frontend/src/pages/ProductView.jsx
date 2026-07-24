import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ShieldCheck, AlertTriangle, XCircle, Star, ShoppingBag, Heart, Truck, ChevronRight } from 'lucide-react'

export default function ProductView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [product, setProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedSize, setSelectedSize] = useState('M')

  useEffect(() => {
    fetch(`http://localhost:3001/api/products/${id}`)
      .then(r => r.json())
      .then(data => {
        setProduct(data)
        setSelectedSize(data.seller_metadata?.modelSize || Object.keys(data.size_chart || {})[0] || 'M')
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
        <div className="spinner spin" style={{ width: 32, height: 32, borderTopColor: '#ff3f6c' }}></div>
      </div>
    )
  }

  if (!product) {
    return (
      <div style={{ textAlign: 'center', padding: '100px' }}>
        <h2>Product not found</h2>
        <button className="btn btn-primary" onClick={() => navigate('/myntra')} style={{ marginTop: 16 }}>
          Back to Store
        </button>
      </div>
    )
  }

  const attrs = product.attributes || {}
  const sellerMetadata = product.seller_metadata || {}
  const verificationReport = product.verification_report || {}
  const evidenceStatus = (
    verificationReport.verdict?.status ||
    product.verification_status ||
    ''
  ).toLowerCase()
  const isVerified = ['pass', 'verified'].includes(evidenceStatus) || (
    evidenceStatus === 'published' && !verificationReport.verdict
  )
  const isWarning = evidenceStatus === 'warning'
  const availableSizes = Object.keys(product.size_chart || {})
  const comparisonRows = verificationReport.comparison || []
  const verifiedChecks = comparisonRows.filter(row => row.status === 'match').length
  
  // Choose images: prefer catalog images, fallback to ai_model, then anchor
  let images = []
  if (product.catalog_images && product.catalog_images.length > 0) {
    images = product.catalog_images
  } else if (product.ai_model_images && product.ai_model_images.length > 0) {
    images = product.ai_model_images
  } else if (product.anchor_image_url) {
    images = [product.anchor_image_url]
  }

  // Normalize images to array of strings
  images = images.map(img => typeof img === 'string' ? img : img.url).filter(Boolean)

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: 'Inter, sans-serif' }}>
      {/* Top Navbar Clone */}
      <nav style={{
        padding: '0 40px', height: '80px', display: 'flex', alignItems: 'center',
        boxShadow: '0 4px 12px 0 rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 100,
        borderBottom: '2px solid #ff3f6c', background: '#fff'
      }}>
        <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '3px', color: '#282c3f', cursor: 'pointer', marginRight: 40 }} onClick={() => navigate('/myntra')}>
          MYNTRA
        </div>
      </nav>

      {/* Breadcrumbs */}
      <div style={{ padding: '20px 40px', fontSize: 14, color: '#282c3f', display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ cursor: 'pointer' }} onClick={() => navigate('/myntra')}>Home</span>
        {product.category ? (
          product.category.split('>').map((cat, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ChevronRight size={14} color="#696e79" />
              <span>{cat.trim()}</span>
            </span>
          ))
        ) : (
          <>
            <ChevronRight size={14} color="#696e79" /> <span>Women</span>
            <ChevronRight size={14} color="#696e79" /> <span>Clothing</span>
          </>
        )}
        <ChevronRight size={14} color="#696e79" /> 
        <span style={{ fontWeight: 600 }}>{product.brand_name || 'Brand'}</span>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px 60px', display: 'flex', gap: 60 }}>
        
        {/* Left: Image Grid */}
        <div style={{ flex: '0 0 58%', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {images.length > 0 ? (
            images.slice(0, Math.max(2, images.length)).map((img, i) => (
              <div key={i} style={{ aspectRatio: '3/4', background: '#f5f5f6', position: 'relative', overflow: 'hidden' }}>
                <img src={img} alt={`${product.title} view ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'contain', transition: 'transform 0.3s ease', background: '#fff' }} onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.03)'} onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'} />
              </div>
            ))
          ) : (
            <div style={{ aspectRatio: '3/4', background: '#f5f5f6', display: 'flex', alignItems: 'center', justifyContent: 'center', gridColumn: '1 / -1' }}>
              <span style={{ color: '#9CA0AE' }}>No images available</span>
            </div>
          )}
        </div>

        {/* Right: Product Details */}
        <div style={{ flex: 1, paddingRight: 20 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#282c3f', marginBottom: 8 }}>
            {product.brand_name || 'Brand'}
          </h1>
          <h2 style={{ fontSize: 20, color: '#535766', fontWeight: 400, marginBottom: 8 }}>
            {product.title || attrs.garment_type || 'Product'}
          </h2>
          
          {product.description && (
            <p style={{ fontSize: 16, color: '#282c3f', lineHeight: 1.5, margin: '0 0 16px 0' }}>
              {product.description}
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', border: '1px solid #eaeaec', borderRadius: 4, width: 'fit-content', marginBottom: 16, cursor: 'pointer' }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>4.2</span>
            <Star size={14} fill="#14958f" color="#14958f" />
            <div style={{ width: 1, height: 12, background: '#eaeaec', margin: '0 4px' }}></div>
            <span style={{ fontSize: 14, color: '#535766' }}>142 Ratings</span>
          </div>

          <div style={{ borderBottom: '1px solid #d4d5d9', paddingBottom: 24, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
              <span style={{ fontSize: 24, fontWeight: 700, color: '#282c3f' }}>
                ₹{product.selling_price || product.mrp || '999'}
              </span>
              {product.mrp && product.selling_price && product.mrp > product.selling_price && (
                <>
                  <span style={{ fontSize: 20, color: '#94969f', textDecoration: 'line-through' }}>MRP ₹{product.mrp}</span>
                  <span style={{ fontSize: 20, color: '#ff905a', fontWeight: 700 }}>
                    ({Math.round((1 - product.selling_price / product.mrp) * 100)}% OFF)
                  </span>
                </>
              )}
            </div>
            <div style={{ fontSize: 14, color: '#03a685', fontWeight: 700 }}>inclusive of all taxes</div>
          </div>

          {/* Size Selection */}
          <div style={{ marginBottom: 30 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#282c3f', textTransform: 'uppercase' }}>Select Size</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#ff3f6c', cursor: 'pointer' }}>SIZE CHART</span>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {(availableSizes.length ? availableSizes : ['XS', 'S', 'M', 'L', 'XL']).map(s => (
                <div 
                  key={s} 
                  onClick={() => setSelectedSize(s)}
                  style={{
                    width: 50, height: 50, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${selectedSize === s ? '#ff3f6c' : '#bfc0c6'}`,
                    color: selectedSize === s ? '#ff3f6c' : '#282c3f',
                    fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    background: '#fff',
                    transition: 'all 0.2s'
                  }}
                >
                  {s}
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 40 }}>
            <button style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              background: '#ff3f6c', color: '#fff', border: 'none', borderRadius: 4,
              padding: '16px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <ShoppingBag size={20} /> ADD TO BAG
            </button>
            <button style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
              background: '#fff', color: '#282c3f', border: '1px solid #d4d5d9', borderRadius: 4,
              padding: '16px', fontSize: 14, fontWeight: 700, cursor: 'pointer'
            }}>
              <Heart size={20} /> WISHLIST
            </button>
          </div>

          {/* Trust Marker / Verification */}
          <div style={{
            padding: 16, border: '1px solid #eaeaec', borderRadius: 8, marginBottom: 30,
            background: isVerified ? '#f4fbf9' : isWarning ? '#fffcf4' : '#fdf6f6'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              {isVerified ? <ShieldCheck size={20} color="#03a685" /> : isWarning ? <AlertTriangle size={20} color="#d97706" /> : <XCircle size={20} color="#dc2626" />}
              <span style={{ fontSize: 14, fontWeight: 700, color: '#282c3f' }}>
                {isVerified ? 'Anchor Verified Listing ✓' : isWarning ? 'Anchor Partially Verified' : 'Unverified Listing'}
              </span>
            </div>
            <p style={{ fontSize: 13, color: '#535766', lineHeight: 1.5, margin: 0 }}>
              This product’s attributes and images have been cross-checked by Anchor AI for authenticity against the seller's physical garment.
              <span style={{ display: 'block', marginTop: 6 }}>
                Seller claims, physical anchor imagery, catalog views, model fit, and sizing were checked before publication.
              </span>
              {product.verification_score != null && (
                <span style={{ display: 'block', marginTop: 8, fontWeight: 600, color: '#03a685' }}>
                  Evidence confidence: {Number(product.verification_score).toFixed(1)}% · {verifiedChecks}/{comparisonRows.length || verifiedChecks} checks matched
                </span>
              )}
            </p>
          </div>

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <div style={{ marginBottom: 30 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 16, fontWeight: 700, color: '#282c3f', marginBottom: 16, textTransform: 'uppercase' }}>
                Aesthetic Tags
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {product.tags.map(tag => (
                  <span key={tag} style={{ 
                    padding: '6px 12px', background: '#f5f5f6', color: '#282c3f', 
                    borderRadius: 16, fontSize: 13, fontWeight: 600 
                  }}>
                    #{tag.replace(/\s+/g, '')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Delivery */}
          <div style={{ marginBottom: 30 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 16, fontWeight: 700, color: '#282c3f', marginBottom: 16, textTransform: 'uppercase' }}>
              Delivery Options <Truck size={20} />
            </div>
            <div style={{ display: 'flex', border: '1px solid #d4d5d9', borderRadius: 4, overflow: 'hidden', width: 250, marginBottom: 16 }}>
              <input type="text" placeholder="Enter pincode" style={{ border: 'none', padding: '12px', outline: 'none', flex: 1, fontSize: 14 }} />
              <button style={{ background: 'none', border: 'none', color: '#ff3f6c', fontWeight: 700, padding: '0 16px', cursor: 'pointer' }}>Check</button>
            </div>
            <p style={{ fontSize: 13, color: '#535766' }}>Please enter PIN code to check delivery time & Pay on Delivery Availability</p>
          </div>

          {/* Size & Fit */}
          <div style={{ marginBottom: 30 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 16, fontWeight: 700, color: '#282c3f', marginBottom: 16, textTransform: 'uppercase' }}>
              Size & Fit
            </div>
            <p style={{ fontSize: 14, color: '#282c3f', margin: 0 }}>
              The model (height {sellerMetadata.modelHeight || product.attributes?.model_height || product.attributes?.height || "5'8\""}) is wearing size {sellerMetadata.modelSize || product.attributes?.model_size || product.attributes?.size || 'S'} with a {sellerMetadata.modelBuild || product.attributes?.model_build || 'seller-declared'} build.
            </p>
          </div>

          {product.size_chart && Object.keys(product.size_chart).length > 0 && (
            <div style={{ marginBottom: 30, borderTop: '1px solid #eaeaec', paddingTop: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#282c3f', marginBottom: 14, textTransform: 'uppercase' }}>
                Seller Size Chart
              </h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: '#f5f5f6', textAlign: 'left' }}>
                      <th style={{ padding: 10 }}>Size</th>
                      <th style={{ padding: 10 }}>Chest</th>
                      <th style={{ padding: 10 }}>Length</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(product.size_chart).map(([size, values]) => (
                      <tr key={size} style={{ borderBottom: '1px solid #eaeaec' }}>
                        <td style={{ padding: 10, fontWeight: 700 }}>{size}</td>
                        <td style={{ padding: 10 }}>{values.chest ?? '—'}{values.chest != null ? ' in' : ''}</td>
                        <td style={{ padding: 10 }}>{values.length ?? '—'}{values.length != null ? ' in' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {Object.keys(sellerMetadata).length > 0 && (
            <div style={{ marginBottom: 30, borderTop: '1px solid #eaeaec', paddingTop: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#282c3f', marginBottom: 6, textTransform: 'uppercase' }}>
                Seller-declared details
              </h3>
              <p style={{ fontSize: 12, color: '#7e818c', margin: '0 0 14px' }}>Shown exactly from the submitted catalog row.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
                {[
                  ['Colour', sellerMetadata.primaryColour || sellerMetadata.brandColour],
                  ['Fabric', sellerMetadata.fabric],
                  ['Pattern', sellerMetadata.pattern],
                  ['Fit', sellerMetadata.fit],
                  ['Garment length', sellerMetadata.garmentLength],
                  ['Occasion', sellerMetadata.occasion],
                  ['Sleeve', sellerMetadata.sleeveLength],
                  ['Wash care', sellerMetadata.washCare],
                ].filter(([, value]) => value).map(([label, value]) => (
                  <div key={label} style={{ borderBottom: '1px solid #eaeaec', paddingBottom: 8 }}>
                    <div style={{ fontSize: 12, color: '#7e818c', marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 14, color: '#282c3f' }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Product Details (Attributes) */}
          <div style={{ borderTop: '1px solid #eaeaec', paddingTop: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#282c3f', marginBottom: 16, textTransform: 'uppercase' }}>
              Product Details
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 24px' }}>
              {Object.entries(attrs).filter(([k]) => !k.startsWith('cv_') && !k.startsWith('model_')).map(([key, val]) => (
                <div key={key}>
                  <div style={{ fontSize: 12, color: '#7e818c', marginBottom: 4, textTransform: 'capitalize' }}>
                    {key.replace(/_/g, ' ')}
                  </div>
                  <div style={{ fontSize: 14, color: '#282c3f', borderBottom: '1px solid #eaeaec', paddingBottom: 8 }}>
                    {typeof val === 'object' ? (val?.value ?? JSON.stringify(val)) : String(val)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
