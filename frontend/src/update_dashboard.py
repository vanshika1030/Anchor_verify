import re
import os

file_path = r'C:\Users\vansh\.gemini\antigravity\scratch\anchor\frontend\src\pages\Dashboard.jsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# We need to remove the "My listings" section entirely and the "fetchProducts" logic, but keep the "Dashboard-hero" and "metric-grid".
# Let's replace the whole Dashboard with a cleaner version.

new_dashboard = '''import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Package, ShieldCheck, ArrowRight, CheckCircle2, Images, Zap, BadgeCheck
} from 'lucide-react'
import { useApp } from '../AppContext'
import FASHION_EDITORIAL from '../assets/fashion-editorial-hero.png'

export default function Dashboard() {
  const navigate = useNavigate()
  const { seller } = useApp()

  // We keep mock metrics for the dashboard if needed, as the actual list moved to NewListing
  const verifiedProducts = 0;
  const reviewProducts = 0;
  const averageConfidence = '—';

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
      
      <section className="empty-state" style={{marginTop: '40px'}}>
        <div className="empty-graphic"><Package size={34} /></div>
        <h3 style={{ fontSize: 17, marginBottom: 7 }}>Your catalog list has moved</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
          You can now view and manage your listings in the New Listing tab.
        </p>
        <button onClick={() => navigate('/new-listing')} className="btn btn-primary"><ArrowRight size={16} /> Go to Listings</button>
      </section>
    </main>
  )
}
'''
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_dashboard)
print("Updated Dashboard.jsx")
