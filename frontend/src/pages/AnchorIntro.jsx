import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight, Camera, Sparkles, CheckCircle } from 'lucide-react';

export default function AnchorIntro() {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{ 
          width: '64px', height: '64px', background: 'var(--success-bg)', 
          borderRadius: '16px', display: 'flex', alignItems: 'center', 
          justifyContent: 'center', margin: '0 auto 20px',
          border: '1px solid var(--success-border)'
        }}>
          <ShieldCheck size={32} color="var(--success)" />
        </div>
        <h1 style={{ fontSize: '32px', fontWeight: '800', color: '#282c3f', marginBottom: '16px' }}>
          What is Anchor Verification?
        </h1>
        <p style={{ fontSize: '16px', color: '#5F6477', lineHeight: '1.6', maxWidth: '600px', margin: '0 auto' }}>
          Anchor Verification is Myntra's next-generation AI tool that ensures catalog accuracy and generates stunning AI models from your raw product photos.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '40px' }}>
        <div className="card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Camera size={24} color="var(--accent)" />
            <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Automated Verification</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '20px' }}>
            Upload a quick photo of your actual garment (the "Anchor"). Our AI compares it against your catalog images and metadata to catch sizing, color, or pattern mismatches before they go live.
          </p>
          <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#282c3f' }}><CheckCircle size={16} color="var(--success)" /> Prevents costly returns</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#282c3f' }}><CheckCircle size={16} color="var(--success)" /> Ensures brand guidelines</li>
          </ul>
        </div>

        <div className="card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <Sparkles size={24} color="var(--accent)" />
            <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>AI Catalog Generation</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '20px' }}>
            No budget for a photoshoot? Just upload your anchor photos and a size chart. We'll generate high-quality, professional catalog images of AI models wearing your exact garment.
          </p>
          <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#282c3f' }}><CheckCircle size={16} color="var(--success)" /> Instant professional shoots</li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#282c3f' }}><CheckCircle size={16} color="var(--success)" /> Guaranteed 100% accuracy</li>
          </ul>
        </div>
      </div>

      <div style={{ textAlign: 'center', background: 'white', padding: '32px', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '12px' }}>Ready to get started?</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
          Anchor Verification is integrated directly into the listing creation process.
        </p>
        <button 
          className="btn btn-primary" 
          style={{ padding: '14px 32px', fontSize: '16px', background: 'linear-gradient(to right, #ff3f6c, #f77062)', border: 'none' }}
          onClick={() => navigate('/new-listing')}
        >
          Add New Listing <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
