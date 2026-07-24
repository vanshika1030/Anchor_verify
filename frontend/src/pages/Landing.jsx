import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Image, FileText, ArrowRight, CheckCircle, XCircle, AlertTriangle, Zap, Sparkles } from 'lucide-react'
import ExcelView from '../components/ExcelView'

const STEPS = [
  { icon: Image, title: 'Collect the evidence', desc: 'Bring seller metadata, physical-product anchors, five catalog views, and the size chart into one review.' },
  { icon: ShieldCheck, title: 'Verify every claim', desc: 'Cross-check colour, print, construction, garment length, model body type, sizing, and visual identity.' },
  { icon: FileText, title: 'Publish with proof', desc: 'Send the exact seller listing and its verification trail to a customer-ready Myntra storefront.' },
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
    <>
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes floatHero {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-15px) scale(1.02); }
        }
        @keyframes floatDoodle {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(15px, -20px) rotate(10deg); }
          66% { transform: translate(-10px, 15px) rotate(-10deg); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(255, 63, 108, 0.4); }
          50% { box-shadow: 0 0 40px rgba(255, 63, 108, 0.8), 0 0 80px rgba(255, 63, 108, 0.2); }
        }
        .hero-banner {
          position: relative;
          text-align: center;
          padding: 80px 40px;
          background: linear-gradient(-45deg, #282c3f, #1a1d26, #3a1c3b, #1a1d26);
          background-size: 300% 300%;
          animation: gradientShift 15s ease infinite;
          border-radius: 24px;
          color: white;
          margin-bottom: 40px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.2);
          overflow: hidden;
        }
        .hero-glass {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 40px;
          position: relative;
          z-index: 2;
        }
        .start-btn {
          background: linear-gradient(135deg, #ff3f6c 0%, #f77062 100%);
          border: none;
          min-width: 240px;
          padding: 16px 32px;
          font-size: 16px;
          font-weight: 700;
          color: white;
          border-radius: 50px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          animation: pulseGlow 3s infinite;
        }
        .start-btn:hover {
          transform: translateY(-4px) scale(1.05);
          box-shadow: 0 15px 30px rgba(255, 63, 108, 0.5);
        }
        .feature-card {
          background: rgba(255, 255, 255, 0.8);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 63, 108, 0.1);
          border-radius: 20px;
          padding: 24px;
          text-align: left;
          position: relative;
          transition: all 0.4s ease;
          box-shadow: 0 10px 30px rgba(0,0,0,0.03);
          overflow: hidden;
        }
        .feature-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 40px rgba(255, 63, 108, 0.12);
          border-color: rgba(255, 63, 108, 0.3);
        }
        .feature-icon-wrapper {
          width: 50px;
          height: 50px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(255, 63, 108, 0.1), rgba(247, 112, 98, 0.1));
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          transition: transform 0.3s ease;
        }
        .feature-card:hover .feature-icon-wrapper {
          transform: scale(1.1) rotate(5deg);
          background: linear-gradient(135deg, #ff3f6c, #f77062);
        }
        .feature-card:hover .feature-icon {
          stroke: white !important;
        }
        .bg-doodle {
          position: absolute;
          opacity: 0.15;
          animation: floatDoodle 12s infinite ease-in-out;
          pointer-events: none;
        }
      `}</style>

      <div style={{ maxWidth: 960, margin: '0 auto', paddingBottom: '60px' }}>
        
        {/* Animated Hero Section */}
        <div className="hero-banner">
          
          {/* Background Decorative Doodles */}
          <Sparkles className="bg-doodle" size={40} color="#ff3f6c" style={{ top: '15%', left: '10%' }} />
          <div className="bg-doodle" style={{ bottom: '20%', right: '10%', animationDelay: '2s' }}>
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#f77062" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.38 3.46L16 2L11.62 3.46C10.66 3.78 10 4.68 10 5.69V11.23C10 12.35 10.64 13.37 11.64 13.79L16 15.65L20.36 13.79C21.36 13.37 22 12.35 22 11.23V5.69C22 4.68 21.34 3.78 20.38 3.46Z" />
            </svg>
          </div>
          <div className="bg-doodle" style={{ top: '25%', right: '15%', animationDelay: '4s' }}>
            <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 13V12C6 8.68629 8.68629 6 12 6V6C15.3137 6 18 8.68629 18 12V13M6 13H18M6 13H5C4.44772 13 4 13.4477 4 14V20C4 20.5523 4.44772 21 5 21H19C19.5523 21 20 20.5523 20 20V14C20 13.4477 19.5523 13 19 13H18M10 3V6M14 3V6" />
            </svg>
          </div>

          <div className="hero-glass" style={{ animation: 'floatHero 6s ease-in-out infinite' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{ background: 'linear-gradient(135deg, #ff3f6c, #f77062)', padding: '16px', borderRadius: '50%', boxShadow: '0 10px 25px rgba(255, 63, 108, 0.4)' }}>
                <Zap size={36} color="white" fill="white" />
              </div>
            </div>
            
            <h2 style={{ fontSize: 42, fontWeight: 900, letterSpacing: '-0.03em', marginBottom: 16, background: 'linear-gradient(135deg, #fff, #e2e8f0)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              The Trust Layer for Fashion Catalogs
            </h2>
            <p style={{ color: '#cbd5e1', maxWidth: 640, margin: '0 auto 36px', lineHeight: 1.6, fontSize: 18, fontWeight: 400 }}>
              Make sure <strong style={{ color: 'white' }}>what shoppers see matches what arrives.</strong>{' '}
              Anchor checks listing claims, product imagery, model fit, and sizing before publication.
            </p>
            <button className="start-btn" onClick={() => nav('/new-listing')}>
              Verify a Listing <ArrowRight size={20} />
            </button>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 40 }}>
          {STEPS.map((s, i) => {
            const Icon = s.icon
            return (
              <div className="feature-card" key={s.title}>
                <div className="feature-icon-wrapper">
                  <Icon className="feature-icon" size={24} color="#ff3f6c" />
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8, color: '#1e293b' }}>{s.title}</div>
                <div style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>{s.desc}</div>
                {i < STEPS.length - 1 && (
                  <ArrowRight size={18} color="#cbd5e1" style={{ position: 'absolute', right: -12, top: '50%', transform: 'translateY(-50%)', zIndex: 1 }} />
                )}
              </div>
            )
          })}
        </div>

        {/* Excel / Data View */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', margin: 0 }}>Bulk Upload Status</h3>
            <span style={{ background: '#ff3f6c15', color: '#ff3f6c', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>BETA</span>
          </div>
          <div style={{ background: 'white', borderRadius: 24, padding: 24, boxShadow: '0 10px 40px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9' }}>
            <ExcelView />
          </div>
        </div>

        {/* Recent Activity List */}
        <div style={{ background: 'white', borderRadius: 24, padding: 0, boxShadow: '0 10px 40px rgba(0,0,0,0.04)', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', background: '#f8fafc' }}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1e293b', margin: 0 }}>Recent Verifications</h3>
          </div>
          {RECENT.map((item, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 16, padding: '16px 24px',
              borderBottom: i < RECENT.length - 1 ? '1px solid #f1f5f9' : 'none',
              transition: 'background 0.2s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
            >
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#f1f5f9', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Image size={20} color="#94a3b8" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#334155', marginBottom: 2 }}>{item.name}</div>
                <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>{item.time}</div>
              </div>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: item.color === 'pass' ? '#ecfdf5' : item.color === 'fail' ? '#fef2f2' : '#fffbeb',
                color: item.color === 'pass' ? '#059669' : item.color === 'fail' ? '#dc2626' : '#d97706',
                border: `1px solid ${item.color === 'pass' ? '#a7f3d0' : item.color === 'fail' ? '#fecaca' : '#fde68a'}`
              }}>
                {item.color === 'pass' && <CheckCircle size={14} />}
                {item.color === 'fail' && <XCircle size={14} />}
                {item.color === 'warn' && <AlertTriangle size={14} />}
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
