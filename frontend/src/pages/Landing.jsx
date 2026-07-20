import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Image, FileText, ArrowRight, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import ExcelView from '../components/ExcelView'

const STEPS = [
  { icon: Image, title: 'AI Extraction', desc: 'Automatically extract attributes from raw product photos' },
  { icon: ShieldCheck, title: 'Smart Verification', desc: 'Compare your catalog data against physical reality' },
  { icon: FileText, title: 'Catalog Generation', desc: 'Auto-generate Myntra-compliant catalog entries' },
]

const RECENT = [
  { name: 'Printed Cotton Kurta', time: '2 hours ago', status: 'Verified', color: 'pass' },
  { name: 'Slim Fit Denim Jacket', time: '5 hours ago', status: 'Verified', color: 'pass' },
  { name: 'Floral Chiffon Dupatta', time: 'Yesterday', status: 'Failed', color: 'fail' },
  { name: 'Embroidered Anarkali Set', time: 'Yesterday', status: 'Warning', color: 'warn' },
  { name: 'Cotton Polo T-Shirt', time: '2 days ago', status: 'Verified', color: 'pass' },
]

export default function Landing() {
  const nav = useNavigate()

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Hero */}
      <div style={{ 
        textAlign: 'center', 
        padding: '60px 40px',
        background: 'linear-gradient(135deg, #282c3f 0%, #1a1d26 100%)',
        borderRadius: '16px',
        color: 'white',
        marginBottom: '32px',
        boxShadow: '0 12px 32px rgba(0,0,0,0.1)'
      }}>
        <ShieldCheck size={48} color="var(--accent)" style={{ marginBottom: 16 }} />
        <h2 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 12 }}>
          Anchor Verification
        </h2>
        <p style={{ color: '#9CA0AE', maxWidth: 540, margin: '0 auto 28px', lineHeight: 1.7, fontSize: 16 }}>
          Every listing is verified before going live. Anchor checks that your catalog images
          and metadata accurately represent your real product.
        </p>
        <button className="btn btn-primary" onClick={() => nav('/new-listing')} style={{ minWidth: 220, padding: '14px 28px', fontSize: 16 }}>
          Start Listing <ArrowRight size={16} />
        </button>
      </div>

      {/* How it works */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 20 }}>
        {STEPS.map((s, i) => {
          const Icon = s.icon
          return (
            <div className="card" key={s.title} style={{ textAlign: 'center', padding: 18, position: 'relative' }}>
              <Icon size={22} color="var(--accent)" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{s.desc}</div>
              {i < STEPS.length - 1 && (
                <ArrowRight size={14} color="var(--text-tertiary)" style={{ position: 'absolute', right: -10, top: '50%', transform: 'translateY(-50%)', zIndex: 1 }} />
              )}
            </div>
          )
        })}
      </div>

      {/* Excel view */}
      <ExcelView />

      {/* Recent */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', fontWeight: 600, fontSize: 14 }}>
          Recent listings
        </div>
        {RECENT.map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 14, padding: '10px 20px',
            borderBottom: i < RECENT.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 6, background: 'var(--bg-page)', border: '1px solid var(--border)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{item.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{item.time}</div>
            </div>
            <span className={`badge badge-${item.color}`}>
              {item.color === 'pass' && <CheckCircle size={11} />}
              {item.color === 'fail' && <XCircle size={11} />}
              {item.color === 'warn' && <AlertTriangle size={11} />}
              {' '}{item.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
