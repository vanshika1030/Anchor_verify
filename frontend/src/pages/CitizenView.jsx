import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ShoppingBag, Heart, User, ShieldCheck, ChevronRight } from 'lucide-react';

export default function CitizenView() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch products
    fetch('http://localhost:3001/api/products/all')
      .then(res => {
        if (!res.ok) {
           throw new Error('Failed to fetch products');
        }
        return res.json();
      })
      .then(data => {
        setProducts(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner spin" style={{ width: 40, height: 40, borderTopColor: '#ff3f6c' }}></div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: 'Inter, sans-serif' }}>
      {/* Myntra Navbar Clone */}
      <nav style={{
        background: '#fff',
        padding: '0 40px',
        height: '80px',
        display: 'flex',
        alignItems: 'center',
        boxShadow: '0 4px 12px 0 rgba(0,0,0,0.05)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        borderBottom: '2px solid #ff3f6c'
      }}>
        <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '3px', color: '#282c3f', cursor: 'pointer', marginRight: 40 }} onClick={() => navigate('/myntra')}>
          MYNTRA
        </div>
        <div style={{ display: 'flex', gap: 30, fontWeight: 600, fontSize: 14, color: '#282c3f', flex: 1, letterSpacing: '0.3px', height: '100%' }}>
          <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>MEN</div>
          <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', borderBottom: '4px solid #ff3f6c', color: '#ff3f6c' }}>WOMEN</div>
          <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>KIDS</div>
          <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>HOME & LIVING</div>
          <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>BEAUTY</div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', background: '#f5f5f6', padding: '10px 16px', borderRadius: 4, width: '400px', marginRight: 40 }}>
          <Search size={18} color="#696e79" style={{ marginRight: 12 }} />
          <input 
            type="text" 
            placeholder="Search for products, brands and more" 
            style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: 14 }}
          />
        </div>

        <div style={{ display: 'flex', gap: 24, color: '#000' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
            <User size={20} />
            <span style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>Profile</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
            <Heart size={20} />
            <span style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>Wishlist</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
            <ShoppingBag size={20} />
            <span style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>Bag</span>
          </div>
        </div>
      </nav>

      {/* Breadcrumbs */}
      <div style={{ padding: '20px 40px', fontSize: 14, color: '#282c3f', display: 'flex', gap: 6, alignItems: 'center' }}>
        <span>Home</span> <ChevronRight size={14} color="#696e79" /> 
        <span>Women</span> <ChevronRight size={14} color="#696e79" /> 
        <span style={{ fontWeight: 600 }}>All Products</span>
      </div>

      <div style={{ display: 'flex', padding: '0 40px', gap: '30px', marginBottom: '40px' }}>
        {/* Sidebar Filter Panel */}
        <aside style={{ width: '250px', flexShrink: 0, borderRight: '1px solid #eaeaec', paddingRight: '20px' }}>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>FILTERS</div>
          
          <div style={{ borderTop: '1px solid #eaeaec', paddingTop: 20, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 15 }}>CATEGORIES</div>
            {['Tops', 'Dresses', 'Kurtis', 'Jeans', 'T-Shirts'].map(cat => (
              <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 14, color: '#282c3f', cursor: 'pointer' }}>
                <input type="checkbox" style={{ accentColor: '#ff3f6c' }} />
                {cat}
              </label>
            ))}
          </div>

          <div style={{ borderTop: '1px solid #eaeaec', paddingTop: 20, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 15 }}>PRICE</div>
            {['Rs. 499 to Rs. 999', 'Rs. 999 to Rs. 1499', 'Rs. 1499 to Rs. 1999'].map(price => (
              <label key={price} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 14, color: '#282c3f', cursor: 'pointer' }}>
                <input type="checkbox" style={{ accentColor: '#ff3f6c' }} />
                {price}
              </label>
            ))}
          </div>

          <div style={{ borderTop: '1px solid #eaeaec', paddingTop: 20, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 15 }}>COLOR</div>
            {[
              { name: 'Black', hex: '#000000' },
              { name: 'White', hex: '#FFFFFF' },
              { name: 'Red', hex: '#FF0000' },
              { name: 'Blue', hex: '#0000FF' },
              { name: 'Pink', hex: '#FFC0CB' }
            ].map(color => (
              <label key={color.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, fontSize: 14, color: '#282c3f', cursor: 'pointer' }}>
                <input type="checkbox" style={{ accentColor: '#ff3f6c' }} />
                <div style={{ width: 15, height: 15, borderRadius: '50%', background: color.hex, border: '1px solid #d4d5d9' }}></div>
                {color.name}
              </label>
            ))}
          </div>

          <div style={{ borderTop: '1px solid #eaeaec', paddingTop: 20, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 15 }}>SIZE</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {['S', 'M', 'L', 'XL', 'XXL'].map(size => (
                <div key={size} style={{ border: '1px solid #d4d5d9', borderRadius: 4, padding: '4px 8px', fontSize: 12, cursor: 'pointer', color: '#282c3f' }}>
                  {size}
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Product Grid */}
        <main style={{ flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '30px 20px' }}>
            {products.map((product) => {
              const generated = product.verification_status === 'generated';
              const isVerified = product.verification_status === 'verified' || product.verification_status === 'pass';
              
              let imageUrl = product.anchor_image_url;
              if (generated && product.ai_model_images && product.ai_model_images.length > 0) {
                imageUrl = typeof product.ai_model_images[0] === 'string' ? product.ai_model_images[0] : product.ai_model_images[0]?.url;
              } else if (product.catalog_images && product.catalog_images.length > 0) {
                imageUrl = typeof product.catalog_images[0] === 'string' ? product.catalog_images[0] : product.catalog_images[0]?.url;
              }

              return (
                <div 
                  key={product.id} 
                  style={{ position: 'relative', cursor: 'pointer', transition: 'box-shadow 0.2s', paddingBottom: '12px' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 16px 4px rgba(40,44,63,0.07)';
                    const overlay = e.currentTarget.querySelector('.wishlist-overlay');
                    if (overlay) overlay.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                    const overlay = e.currentTarget.querySelector('.wishlist-overlay');
                    if (overlay) overlay.style.opacity = '0';
                  }}
                  onClick={() => navigate(`/product/${product.id}`)}
                >
                  <div style={{ position: 'relative', aspectRatio: '3/4', overflow: 'hidden', backgroundColor: '#f5f5f6', marginBottom: 12 }}>
                    {imageUrl ? (
                      <img src={imageUrl} alt={product.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#a0a0a0' }}>No Image</div>
                    )}
                    
                    {/* Hover Wishlist Button overlay */}
                    <div className="wishlist-overlay" style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0, 
                      background: '#fff', padding: '10px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      borderTop: '1px solid #f5f5f6',
                      fontWeight: 700, fontSize: 14, color: '#282c3f',
                      opacity: 0, transition: 'opacity 0.2s', boxShadow: '0 -2px 4px rgba(0,0,0,0.05)'
                    }}>
                      <Heart size={18} /> WISHLIST
                    </div>
                  </div>

                  <div style={{ padding: '0 8px' }}>
                    <div style={{ fontWeight: 700, fontSize: 16, color: '#282c3f', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {product.brand_name || 'Brand'}
                    </div>
                    <div style={{ fontSize: 14, color: '#535766', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {product.title}
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: '#282c3f' }}>
                        Rs. {product.selling_price || product.mrp || '999'}
                      </span>
                      {product.mrp && product.selling_price && product.mrp > product.selling_price && (
                        <>
                          <span style={{ fontSize: 12, color: '#7e818c', textDecoration: 'line-through' }}>
                            Rs. {product.mrp}
                          </span>
                          <span style={{ fontSize: 12, color: '#ff905a', fontWeight: 700 }}>
                            ({Math.round((1 - product.selling_price / product.mrp) * 100)}% OFF)
                          </span>
                        </>
                      )}
                    </div>
                    
                    {isVerified && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#e6f6f2', padding: '2px 6px', borderRadius: 2 }}>
                        <ShieldCheck size={12} color="#03a685" />
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#03a685' }}>Anchor Verified ✓</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}

