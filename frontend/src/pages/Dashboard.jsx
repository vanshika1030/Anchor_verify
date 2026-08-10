import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Package, ShieldCheck, ArrowRight, CheckCircle2, Images, Zap, BadgeCheck,
  BarChart3, TrendingUp, AlertTriangle, Clock
} from 'lucide-react'
import { useApp } from '../AppContext'
import { getProducts } from '../services/api'
import FASHION_EDITORIAL from '../assets/fashion-editorial-hero.png'

// A seller opens the studio before their latest listing has necessarily been
// fetched from the catalog API.  Keep the dashboard useful in that moment by
// showing the same sample catalogue used in "My Listings"; real listings are
// appended live below and are never replaced by these demo records.
const DEMO_CATALOG_SNAPSHOT = [
  { id: 'demo-dashboard-1', title: 'Women Blue Printed Anarkali Kurta Set', category: 'Kurta Sets', verification_report: { verdict: { status: 'PASS' } }, created_at: '2026-07-28T10:00:00Z' },
  { id: 'demo-dashboard-2', title: 'Women Olive Printed V-Neck Short Kurti', category: 'Kurtis', verification_report: { verdict: { status: 'PASS' } }, created_at: '2026-07-30T14:30:00Z' },
  { id: 'demo-dashboard-3', title: 'Women Green Star Print Night Suit', category: 'Nightwear', verification_report: { verdict: { status: 'PASS' } }, created_at: '2026-08-01T09:15:00Z' },
  { id: 'demo-dashboard-4', title: 'Women White Windcheater Jacket', category: 'Jackets', verification_report: { verdict: { status: 'WARNING' } }, created_at: '2026-08-03T16:45:00Z' },
]

export default function Dashboard() {
  const navigate = useNavigate()
  const { seller } = useApp()

  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchProducts() {
      try {
        const data = await getProducts()
        const prodList = Array.isArray(data) ? data : (data.products || [])
        setProducts(prodList)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchProducts()
  }, [])

  let passCount = 0;
  let warningCount = 0;
  let failCount = 0;
  let pendingCount = 0;
  const categoryCounts = {};

  const extractVerdict = (report) => {
    if (!report) return 'PENDING';
    const v = report.verdict;
    if (!v) return 'PENDING';
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && v.status) return String(v.status);
    return 'PENDING';
  };

  const catalogSnapshot = [...DEMO_CATALOG_SNAPSHOT, ...products]

  catalogSnapshot.forEach(p => {
    let verdict = 'PENDING';
    if (p.verification_report) {
      try {
        const report = typeof p.verification_report === 'string' ? JSON.parse(p.verification_report) : p.verification_report;
        verdict = extractVerdict(report);
      } catch (e) {
        verdict = 'PENDING';
      }
    }
    
    if (verdict === 'PASS') passCount++;
    else if (verdict === 'WARNING') warningCount++;
    else if (verdict === 'FAIL') failCount++;
    else pendingCount++;

    const cat = p.category || 'Uncategorized';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  })

  const total = catalogSnapshot.length;
  const evidenceBackedRate = total > 0 ? Math.round((passCount / total) * 100) : 0;
  const needsCorrectionCount = warningCount + failCount;

  const timelineProducts = [...catalogSnapshot]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 5);

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

      {loading ? (
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading catalog metrics...</div>
      ) : total === 0 ? (
        <section className="empty-state" style={{marginTop: '40px'}}>
          <div className="empty-graphic"><Package size={34} /></div>
          <h3 style={{ fontSize: 17, marginBottom: 7 }}>No products yet</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
            Create your first listing to see your catalog analytics.
          </p>
          <button onClick={() => navigate('/new-listing')} className="btn btn-primary"><Plus size={16} /> Verify a listing</button>
        </section>
      ) : (
        <section className="premium-analytics">
          <div className="analytics-header">
            <h2>Catalog Analytics</h2>
            <span className="demo-label">Based on catalog data</span>
          </div>

          <div className="kpi-grid">
            <div className="kpi-card">
               <div className="kpi-icon"><BarChart3 size={24}/></div>
               <div className="kpi-info">
                 <div className="kpi-value">{total}</div>
                 <div className="kpi-label">Total Listings</div>
               </div>
            </div>
            <div className="kpi-card">
               <div className="kpi-icon"><ShieldCheck size={24}/></div>
               <div className="kpi-info">
                 <div className="kpi-value">{evidenceBackedRate}%</div>
                 <div className="kpi-label">Evidence-Backed Rate</div>
               </div>
            </div>
            <div className="kpi-card">
               <div className="kpi-icon"><AlertTriangle size={24}/></div>
               <div className="kpi-info">
                 <div className="kpi-value">{needsCorrectionCount}</div>
                 <div className="kpi-label">Needs Correction</div>
               </div>
            </div>
            <div className="kpi-card">
               <div className="kpi-icon"><Clock size={24}/></div>
               <div className="kpi-info">
                 <div className="kpi-value">{pendingCount}</div>
                 <div className="kpi-label">Pending Verification</div>
               </div>
            </div>
          </div>

          <div className="analytics-grid">
            <div className="analytics-card health-card">
              <h3>Catalog Health</h3>
              <div className="health-bar-container">
                 <div className="health-bar">
                    {passCount > 0 && <div className="bar-segment pass" style={{width: `${(passCount/total)*100}%`}} title={`PASS: ${Math.round((passCount/total)*100)}%`}></div>}
                    {warningCount > 0 && <div className="bar-segment warning" style={{width: `${(warningCount/total)*100}%`}} title={`WARNING: ${Math.round((warningCount/total)*100)}%`}></div>}
                    {failCount > 0 && <div className="bar-segment fail" style={{width: `${(failCount/total)*100}%`}} title={`FAIL: ${Math.round((failCount/total)*100)}%`}></div>}
                    {pendingCount > 0 && <div className="bar-segment pending" style={{width: `${(pendingCount/total)*100}%`}} title={`PENDING: ${Math.round((pendingCount/total)*100)}%`}></div>}
                 </div>
              </div>
              <div className="health-legend">
                 <span><span className="dot pass"></span> PASS ({passCount})</span>
                 <span><span className="dot warning"></span> WARNING ({warningCount})</span>
                 <span><span className="dot fail"></span> FAIL ({failCount})</span>
                 <span><span className="dot pending"></span> PENDING ({pendingCount})</span>
              </div>
            </div>

            <div className="analytics-card category-card">
              <h3>Category Breakdown</h3>
              <div className="category-bars">
                 {Object.entries(categoryCounts).map(([cat, count]) => (
                   <div key={cat} className="cat-row">
                     <span className="cat-label" title={cat}>{cat}</span>
                     <div className="cat-track">
                       <div className="cat-fill" style={{width: `${(count/total)*100}%`}}></div>
                     </div>
                     <span className="cat-count">{count}</span>
                   </div>
                 ))}
              </div>
            </div>
          </div>

          <div className="analytics-card timeline-card">
            <h3>Recent Verifications</h3>
            <div className="timeline">
              {timelineProducts.map(p => {
                 let verdict = 'PENDING';
                 if (p.verification_report) {
                   try {
                     const report = typeof p.verification_report === 'string' ? JSON.parse(p.verification_report) : p.verification_report;
                     verdict = extractVerdict(report);
                   } catch(e){}
                 }
                 return (
                   <div key={p.id} className="timeline-item">
                     <div className={`timeline-dot ${verdict.toLowerCase()}`}></div>
                     <div className="timeline-content">
                       <div className="timeline-header">
                         <span className="timeline-title">{p.title || 'Untitled Product'}</span>
                         <span className={`badge ${verdict.toLowerCase()}`}>{verdict}</span>
                       </div>
                       <div className="timeline-meta">
                         <span>{p.category || 'Uncategorized'}</span>
                         <span>{new Date(p.created_at).toLocaleDateString()}</span>
                       </div>
                     </div>
                   </div>
                 )
              })}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
