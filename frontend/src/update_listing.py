import re
import os

file_path = r'C:\Users\vansh\.gemini\antigravity\scratch\anchor\frontend\src\pages\NewListing.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update imports
content = re.sub(r'import \{ Download, Upload as UploadIcon, Sparkles, Check, ArrowRight, Camera, X, ShieldCheck, Clock3, Loader2 \} from \'lucide-react\';',
                 r'import { Download, Upload as UploadIcon, Sparkles, Check, ArrowRight, Camera, X, ShieldCheck, Clock3, Loader2, Plus, AlertTriangle, XCircle, Eye } from \'lucide-react\';', content)

content = re.sub(r'import \{ downloadTemplate, extractAnchorAttributes, uploadCSV \} from \'../services/api\';',
                 r'import { downloadTemplate, extractAnchorAttributes, uploadCSV } from \'../services/api\';\nimport FASHION_EDITORIAL from \'../assets/fashion-editorial-hero.png\';', content)

# 2. Add new state and hooks
new_state_code = '''
  // NEW STATE FOR TREE & FLOW
  const [treeOpen, setTreeOpen] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState(null);

  // NEW STATE FOR MY LISTINGS
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`http://localhost:3001/api/products`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
        });
        if (res.ok) setProducts(await res.json());
      } catch (err) {
        console.error('Failed to fetch products', err);
      } finally {
        setLoadingProducts(false);
      }
    };
    fetchProducts();
  }, []);

  const renderBadge = status => {
    const normalized = (status || '').toLowerCase();
    if (normalized === 'pass' || normalized === 'verified' || normalized === 'published') {
      return <div className="badge badge-pass" style={{ position: 'absolute', top: 10, right: 10 }}><ShieldCheck size={12} /> Verified</div>;
    }
    if (normalized === 'warning') {
      return <div className="badge badge-warn" style={{ position: 'absolute', top: 10, right: 10 }}><AlertTriangle size={12} /> Review</div>;
    }
    return <div className="badge badge-fail" style={{ position: 'absolute', top: 10, right: 10 }}><XCircle size={12} /> Needs fix</div>;
  };
'''

content = content.replace("  const [rightModelHeight, setRightModelHeight] = useState('5\\'4\"');", "  const [rightModelHeight, setRightModelHeight] = useState('5\\'4\"');\n" + new_state_code)

# 3. Replace the return block
parts = content.split("  return (\n    <main className=\"listing-page page-shell\" style={{ position: 'relative' }}>")
if len(parts) == 2:
    top_part = parts[0]
    
    # Extract left col
    left_col_match = re.search(r'(<section className=\"listing-panel listing-panel--manual\"[^>]*>.*?)</section>\s*\{\/\* === VERTICAL DIVIDER === \*\/\}', parts[1], re.DOTALL)
    left_col = left_col_match.group(1) + '</section>' if left_col_match else ''
    
    # Extract right col
    right_col_match = re.search(r'(<section className={`listing-panel listing-panel--ai.*?</section>)', parts[1], re.DOTALL)
    right_col = right_col_match.group(1) if right_col_match else ''
    
    # Clean up right col logic
    right_col = re.sub(r'className=\{`listing-panel listing-panel--ai.*?\}`\}', 'className="listing-panel listing-panel--ai"', right_col, flags=re.DOTALL)
    right_col = re.sub(r'style=\{\{.*?\}\} onClick=\{.*?\}', 'style={{ flex: "1 1 0%", padding: "24px", background: "linear-gradient(to bottom, #fff, var(--bg-highlight))", borderRadius: "16px", border: "1px solid var(--accent-light)" }}', right_col, flags=re.DOTALL)
    right_col = re.sub(r'\{\!isRightPanelCollapsed && \(\s*<button.*?Collapse Panel\s*</button>\s*\)\}', '', right_col, flags=re.DOTALL)
    right_col = re.sub(r'\{isRightPanelCollapsed \? \(.*?\) : \(\s*<div style=\{\{.*?\}\}>\s*(.*?)\s*</div>\s*\)\}', r'\1', right_col, flags=re.DOTALL)
    
    new_return = '''  return (
    <main className="listing-page page-shell" style={{ position: 'relative' }}>
      <section className="workflow-intro">
        <div className="workflow-intro-copy">
          <div className="section-kicker">Create a Myntra-ready listing</div>
          <h1>Choose the workflow that fits your catalog.</h1>
          <p>Upload an existing sheet or let Anchor build the listing from your product photos.</p>
        </div>
        <div className="workflow-benefits" aria-label="Workflow benefits">
          <span><ShieldCheck size={13} color="var(--success)" /> Anchor-verified</span>
          <span><Sparkles size={13} color="var(--accent)" /> 5 model angles</span>
          <span><Clock3 size={13} color="#dd8a00" /> Guided setup</span>
        </div>
      </section>

      <div className="new-listing-cta-container">
        <button className="btn btn-primary new-listing-cta-btn" onClick={() => setTreeOpen(!treeOpen)}>
          <Plus size={20} /> Create New Listing
        </button>
        <div className={`tree-container ${treeOpen ? 'open' : ''}`}>
          <div className="tree-stem"></div>
          <div className="tree-branches">
            <div className="tree-branch">
              <div 
                className={`tree-card ${selectedFlow === 'csv' ? 'active' : ''}`}
                onClick={() => setSelectedFlow('csv')}
              >
                <div className="tree-card-title">Upload CSV & Verify Listing</div>
                <div className="tree-card-desc">Upload a completed CSV, download the template if needed, add anchor/catalog evidence, review claims, and publish only after verification.</div>
              </div>
            </div>
            <div className="tree-branch">
              <div 
                className={`tree-card ${selectedFlow === 'ai' ? 'active' : ''}`}
                onClick={() => setSelectedFlow('ai')}
              >
                <div className="tree-card-title">Generate Catalog Images & Verify</div>
                <div className="tree-card-desc">Upload garment anchors and details, receive a catalog-image candidate, verify it against Anchor evidence, then prepare the listing.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedFlow && (
        <div className="workflow-grid" style={{ display: 'flex', gap: '40px', position: 'relative', marginTop: '40px', animation: 'slideUp 0.4s ease' }}>
          {selectedFlow === 'csv' && (
''' + f'            {left_col}' + '''
          )}
          {selectedFlow === 'ai' && (
''' + f'            {right_col}' + '''
          )}
        </div>
      )}

      <section className="my-listings-section">
        <h2 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '8px' }}>My Listings</h2>
        {loadingProducts ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <div className="spinner spin" style={{ width: 32, height: 32, borderTopColor: 'var(--accent)' }} />
          </div>
        ) : products.length > 0 ? (
          <div className="my-listings-grid">
            {products.map(product => (
              <article key={product.id} className="card listing-card" style={{cursor: 'pointer'}} onClick={() => navigate(`/product/${product.id}`)}>
                <div className="listing-card-media" style={{position: 'relative'}}>
                  <img
                    style={{width: '100%', height: '200px', objectFit: 'cover', borderRadius: '12px'}}
                    src={(product.catalog_images && product.catalog_images.length > 0)
                      ? (typeof product.catalog_images[0] === 'string' ? product.catalog_images[0] : product.catalog_images[0]?.url)
                      : (product.anchor_image_url || FASHION_EDITORIAL)}
                    alt={product.title || 'Catalog product'}
                  />
                  {renderBadge(product.verification_report?.verdict?.status || product.verification_status || 'unverified')}
                </div>
                <div className="listing-card-body" style={{padding: '16px 0 0 0'}}>
                  <div className="listing-card-meta" style={{display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)'}}>
                    <span>{product.brand_name || product.brand || 'Seller listing'}</span>
                    {product.style_code && <span>#{product.style_code}</span>}
                  </div>
                  <h3 style={{fontSize: '16px', fontWeight: '600', margin: '4px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}} title={product.title}>{product.title || 'Untitled'}</h3>
                  <div className="listing-category" style={{fontSize: '13px', color: 'var(--text-secondary)'}}>{product.category || 'Women · Apparel'}</div>
                  <div className="listing-card-footer" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px'}}>
                    <div className="listing-price">
                      <small style={{display: 'block', fontSize: '10px', color: 'var(--text-tertiary)'}}>Price</small>
                      <strong>₹{product.selling_price || product.mrp || '999'}</strong>
                    </div>
                    <div className="listing-actions">
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={event => { event.stopPropagation(); navigate(`/product/${product.id}`) }}
                      >
                        <Eye size={14} /> View
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--text-secondary)' }}>No listings found. Create one above!</div>
        )}
      </section>
    </main>
  );
}
'''
    final_content = top_part + new_return
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(final_content)
    print("Successfully replaced NewListing.jsx")
else:
    print("Could not find return block marker")
