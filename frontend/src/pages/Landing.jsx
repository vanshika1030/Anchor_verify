import { useNavigate } from 'react-router-dom'
import { ShieldCheck, Image, FileText, ArrowRight, CheckCircle, XCircle, AlertTriangle, Zap, Sparkles, Layers } from 'lucide-react'
import ExcelView from '../components/ExcelView'

const STEPS = [
  { icon: Image, title: 'Collect the evidence', desc: 'Bring seller metadata, physical-product anchors, five catalog views, and the size chart into one review.' },
  { icon: ShieldCheck, title: 'Verify every claim', desc: 'Cross-check colour, print, construction, garment length, model body type, sizing, and visual identity through 7 AI layers.' },
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
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes floatDoodle {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(15px, -20px) rotate(10deg); }
          66% { transform: translate(-10px, 15px) rotate(-10deg); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 20px rgba(168, 70, 108, 0.3); }
          50% { box-shadow: 0 0 40px rgba(168, 70, 108, 0.6), 0 0 80px rgba(168, 70, 108, 0.15); }
        }
        @keyframes shimmerBtn {
          0% { left: -100%; }
          100% { left: 200%; }
        }
        @keyframes listItemIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .landing-hero-banner {
          position: relative;
          text-align: center;
          padding: 72px 40px;
          background: linear-gradient(-45deg, #211820, #1e1524, #2d1a2b, #3a1f33);
          background-size: 300% 300%;
          animation: gradientShift 18s ease infinite;
          border-radius: 26px;
          color: white;
          margin-bottom: 32px;
          box-shadow: 0 24px 58px rgba(52,32,44,.2);
          overflow: hidden;
        }
        .landing-hero-banner::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 20% 30%, rgba(199,101,134,0.12), transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(210,119,98,0.1), transparent 50%);
          pointer-events: none;
        }
        .landing-hero-glass {
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 22px;
          padding: 44px;
          position: relative;
          z-index: 2;
          animation: floatHero 8s ease-in-out infinite;
        }
        .landing-hero-icon-wrap {
          width: 64px;
          height: 64px;
          margin: 0 auto 20px;
          border-radius: 20px;
          display: grid;
          place-items: center;
          background: linear-gradient(145deg, rgba(168,70,108,0.3), rgba(210,119,98,0.2));
          border: 1px solid rgba(255,255,255,0.1);
          box-shadow: 0 12px 30px rgba(168,70,108,0.3);
        }
        .landing-hero-title {
          font-family: 'Fraunces', Georgia, serif;
          font-size: 40px;
          font-weight: 620;
          letter-spacing: -0.03em;
          margin-bottom: 16px;
          background: linear-gradient(135deg, #fff, #efb8ca);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          line-height: 1.1;
        }
        .landing-hero-sub {
          color: rgba(255,255,255,0.6);
          max-width: 620px;
          margin: 0 auto 32px;
          line-height: 1.7;
          font-size: 15px;
        }
        .landing-hero-sub strong { color: rgba(255,255,255,0.9); }
        .landing-start-btn {
          background: linear-gradient(135deg, #a8466c 0%, #d27762 100%);
          border: none;
          min-width: 220px;
          padding: 16px 32px;
          font-size: 15px;
          font-weight: 800;
          color: white;
          border-radius: 40px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          animation: pulseGlow 3s infinite;
          position: relative;
          overflow: hidden;
        }
        .landing-start-btn::after {
          content: '';
          position: absolute;
          top: 0; left: -100%; width: 50%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
        }
        .landing-start-btn:hover {
          transform: translateY(-3px) scale(1.03);
          box-shadow: 0 18px 40px rgba(168, 70, 108, 0.4);
        }
        .landing-start-btn:hover::after {
          animation: shimmerBtn 0.6s ease forwards;
        }
        .landing-feature-card {
          background: rgba(255, 253, 251, 0.95);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(68,47,59,0.08);
          border-radius: 22px;
          padding: 28px 24px;
          text-align: left;
          position: relative;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 10px 30px rgba(68,47,59,0.04);
          overflow: hidden;
        }
        .landing-feature-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; width: 100%; height: 3px;
          background: linear-gradient(90deg, transparent, rgba(168,70,108,0.2), transparent);
          opacity: 0;
          transition: opacity 0.4s ease;
        }
        .landing-feature-card:hover {
          transform: translateY(-6px);
          box-shadow: 0 20px 48px rgba(68,47,59,0.1);
          border-color: rgba(168,70,108,0.18);
        }
        .landing-feature-card:hover::before { opacity: 1; }
        .landing-feature-icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: linear-gradient(135deg, rgba(168,70,108,0.1), rgba(210,119,98,0.08));
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 18px;
          transition: all 0.3s ease;
        }
        .landing-feature-card:hover .landing-feature-icon-wrapper {
          transform: scale(1.1) rotate(5deg);
          background: linear-gradient(135deg, #a8466c, #d27762);
          box-shadow: 0 8px 20px rgba(168,70,108,0.25);
        }
        .landing-feature-card:hover .landing-feature-icon {
          stroke: white !important;
        }
        .bg-doodle {
          position: absolute;
          opacity: 0.1;
          animation: floatDoodle 12s infinite ease-in-out;
          pointer-events: none;
        }
        .landing-recent-item {
          animation: listItemIn 0.4s ease both;
        }
      `}</style>

      <div style={{ maxWidth: 960, margin: '0 auto', paddingBottom: '60px' }}>
        
        {/* Animated Hero Section */}
        <div className="landing-hero-banner">
          
          {/* Background Decorative Doodles */}
          <Sparkles className="bg-doodle" size={36} color="rgba(199,101,134,0.5)" style={{ top: '15%', left: '10%' }} />
          <Layers className="bg-doodle" size={30} color="rgba(210,119,98,0.4)" style={{ bottom: '20%', right: '10%', animationDelay: '2s' }} />
          <ShieldCheck className="bg-doodle" size={28} color="rgba(255,255,255,0.3)" style={{ top: '25%', right: '15%', animationDelay: '4s' }} />

          <div className="landing-hero-glass">
            <div className="landing-hero-icon-wrap">
              <Zap size={30} color="white" fill="rgba(255,255,255,0.3)" />
            </div>
            
            <h2 className="landing-hero-title">
              The Trust Layer for Fashion Catalogs
            </h2>
            <p className="landing-hero-sub">
              Make sure <strong>what shoppers see matches what arrives.</strong>{' '}
              Anchor checks listing claims, product imagery, model fit, and sizing through a 7-layer AI pipeline before publication.
            </p>
            <button className="landing-start-btn" onClick={() => nav('/new-listing')}>
              Verify a Listing <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* Feature Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 36 }}>
          {STEPS.map((s, i) => {
            const Icon = s.icon
            return (
              <div className="landing-feature-card" key={s.title}>
                <div className="landing-feature-icon-wrapper">
                  <Icon className="landing-feature-icon" size={22} color="#a8466c" />
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8, color: '#2a2228', letterSpacing: '-0.01em' }}>{s.title}</div>
                <div style={{ fontSize: 13, color: '#6d6269', lineHeight: 1.65 }}>{s.desc}</div>
                {i < STEPS.length - 1 && (
                  <ArrowRight size={16} color="#d8c9ce" style={{ position: 'absolute', right: -10, top: '50%', transform: 'translateY(-50%)', zIndex: 1 }} />
                )}
              </div>
            )
          })}
        </div>

        {/* Excel / Data View */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <h3 style={{ fontSize: 20, fontWeight: 800, color: '#2a2228', margin: 0, letterSpacing: '-0.02em' }}>Bulk Upload Status</h3>
            <span style={{ background: 'rgba(168,70,108,0.08)', color: '#a8466c', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700, border: '1px solid rgba(168,70,108,0.12)' }}>BETA</span>
          </div>
          <div style={{ background: 'rgba(255,253,251,0.95)', borderRadius: 22, padding: 22, boxShadow: '0 12px 36px rgba(68,47,59,0.06)', border: '1px solid rgba(68,47,59,0.08)' }}>
            <ExcelView />
          </div>
        </div>

        {/* Recent Activity List */}
        <div style={{ background: 'rgba(255,253,251,0.95)', borderRadius: 22, padding: 0, boxShadow: '0 12px 36px rgba(68,47,59,0.06)', border: '1px solid rgba(68,47,59,0.08)', overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(68,47,59,0.06)', background: 'rgba(246,242,237,0.5)' }}>
            <h3 style={{ fontSize: 17, fontWeight: 800, color: '#2a2228', margin: 0, letterSpacing: '-0.01em' }}>Recent Verifications</h3>
          </div>
          {RECENT.map((item, i) => (
            <div key={i}
              className="landing-recent-item"
              style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 24px',
                borderBottom: i < RECENT.length - 1 ? '1px solid rgba(68,47,59,0.05)' : 'none',
                transition: 'background 0.2s ease',
                cursor: 'pointer',
                animationDelay: `${i * 0.08}s`,
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(246,242,237,0.5)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{
                width: 42, height: 42, borderRadius: 13,
                background: 'linear-gradient(135deg, rgba(168,70,108,0.06), rgba(210,119,98,0.04))',
                border: '1px solid rgba(68,47,59,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.3s ease',
              }}>
                <Image size={18} color="#9b8e95" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#2a2228', marginBottom: 2 }}>{item.name}</div>
                <div style={{ fontSize: 11, color: '#9b8e95', fontWeight: 500 }}>{item.time}</div>
              </div>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 11px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                background: item.color === 'pass' ? 'rgba(16,185,129,0.08)' : item.color === 'fail' ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                color: item.color === 'pass' ? '#0b9468' : item.color === 'fail' ? '#dc2626' : '#b47d0a',
                border: `1px solid ${item.color === 'pass' ? 'rgba(16,185,129,0.15)' : item.color === 'fail' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)'}`
              }}>
                {item.color === 'pass' && <CheckCircle size={13} />}
                {item.color === 'fail' && <XCircle size={13} />}
                {item.color === 'warn' && <AlertTriangle size={13} />}
                {item.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
