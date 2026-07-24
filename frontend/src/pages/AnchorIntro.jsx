import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Cpu, ShieldCheck, Layers, Sparkles, ArrowRight, Zap, RefreshCw, Box, CheckCircle } from 'lucide-react';

export default function AnchorIntro() {
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => setMounted(true), 100);
  }, []);

  return (
    <div className="anchor-intro-container">
      <style>{`
        .anchor-intro-container {
          --intro-accent: #c76586;
          --intro-copper: #d18a68;
          --intro-plum: #78516c;
          position: relative;
          width: 100%;
          min-height: calc(100vh - 120px);
          background: #181218;
          border-radius: 32px;
          overflow: hidden;
          color: white;
          font-family: 'Manrope', 'Inter', sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 80px 20px;
        }

        .ambient-bg {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 10% 20%, rgba(199, 101, 134, 0.16) 0%, transparent 50%),
            radial-gradient(circle at 90% 80%, rgba(120, 81, 108, 0.18) 0%, transparent 50%),
            radial-gradient(circle at 50% 50%, rgba(209, 138, 104, 0.08) 0%, transparent 60%);
          z-index: 0;
        }

        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.7;
          animation: float 20s infinite ease-in-out alternate;
          z-index: 0;
        }

        .orb-1 { width: 500px; height: 500px; background: var(--intro-accent); top: -150px; left: -100px; animation-delay: 0s; }
        .orb-2 { width: 600px; height: 600px; background: var(--intro-plum); bottom: -200px; right: -150px; animation-delay: -5s; }
        .orb-3 { width: 400px; height: 400px; background: var(--intro-copper); top: 30%; left: 60%; transform: translate(-50%, -50%); animation-delay: -2s; }

        @keyframes float {
          0% { transform: translate(0, 0) scale(1) rotate(0deg); }
          50% { transform: translate(80px, -60px) scale(1.1) rotate(15deg); }
          100% { transform: translate(-40px, 40px) scale(0.9) rotate(-10deg); }
        }

        .grid-overlay {
          position: absolute;
          inset: 0;
          background-size: 40px 40px;
          background-image:
            linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
          mask-image: radial-gradient(circle at center, black 40%, transparent 80%);
          -webkit-mask-image: radial-gradient(circle at center, black 40%, transparent 80%);
          z-index: 1;
          pointer-events: none;
        }

        .glass-hero {
          position: relative;
          z-index: 10;
          max-width: 1100px;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          opacity: ${mounted ? 1 : 0};
          transform: ${mounted ? 'translateY(0)' : 'translateY(50px)'};
          transition: all 1.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .badge-pill {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: rgba(199, 101, 134, 0.15);
          border: 1px solid rgba(199, 101, 134, 0.4);
          color: #efb8ca;
          padding: 10px 20px;
          border-radius: 100px;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin-bottom: 40px;
          box-shadow: 0 0 25px rgba(199, 101, 134, 0.2);
          backdrop-filter: blur(10px);
          animation: pulse-glow 3s infinite alternate;
        }

        @keyframes pulse-glow {
          0% { box-shadow: 0 0 10px rgba(199, 101, 134, 0.2); }
          100% { box-shadow: 0 0 40px rgba(199, 101, 134, 0.55); }
        }

        .hero-title {
          font-family: 'Fraunces', Georgia, serif;
          font-size: 72px;
          font-weight: 600;
          text-align: center;
          margin-bottom: 30px;
          line-height: 1.05;
          letter-spacing: -2.5px;
          background: linear-gradient(135deg, #ffffff 20%, #efb8ca 60%, #c76586 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0px 4px 20px rgba(255,63,108,0.2));
        }

        .hero-subtitle {
          font-size: 22px;
          color: rgba(255,255,255,0.75);
          text-align: center;
          max-width: 800px;
          margin: 0 auto 64px;
          line-height: 1.6;
          font-weight: 400;
        }

        .hero-subtitle strong {
          color: #efb8ca;
          font-weight: 600;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
          width: 100%;
          margin-bottom: 80px;
        }

        .feature-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-radius: 24px;
          padding: 40px 30px;
          transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          position: relative;
          overflow: hidden;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.05);
        }

        .feature-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          background: radial-gradient(circle at top left, rgba(199, 101, 134, 0.15), transparent 70%);
          opacity: 0;
          transition: opacity 0.5s ease;
        }

        .feature-card:hover {
          transform: translateY(-12px) scale(1.02);
          border-color: rgba(199, 101, 134, 0.4);
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(199, 101, 134, 0.3);
        }

        .feature-card:hover::before {
          opacity: 1;
        }

        .feature-icon-wrapper {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: linear-gradient(135deg, rgba(199, 101, 134, 0.25), rgba(209, 138, 104, 0.15));
          border: 1px solid rgba(199, 101, 134, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
          color: var(--intro-accent);
          box-shadow: 0 8px 24px rgba(199, 101, 134, 0.2);
        }

        .feature-title {
          font-size: 22px;
          font-weight: 800;
          color: white;
          margin-bottom: 16px;
          letter-spacing: -0.5px;
        }

        .feature-desc {
          font-size: 16px;
          color: rgba(255, 255, 255, 0.65);
          line-height: 1.6;
        }

        .pipeline-container {
          width: 100%;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 32px;
          padding: 60px;
          position: relative;
          margin-bottom: 80px;
          overflow: hidden;
          backdrop-filter: blur(20px);
        }

        .pipeline-title {
          text-align: center;
          font-size: 24px;
          font-weight: 800;
          margin-bottom: 48px;
          color: white;
          letter-spacing: 1px;
        }

        .pipeline-track {
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: relative;
        }

        .pipeline-line {
          position: absolute;
          top: 50%;
          left: 50px;
          right: 50px;
          height: 3px;
          background: rgba(255,255,255,0.08);
          transform: translateY(-50%);
          z-index: 1;
        }

        .pipeline-line-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--intro-accent), var(--intro-plum), var(--intro-copper));
          width: 0%;
          animation: load-bar 2.5s 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          box-shadow: 0 0 15px rgba(199, 101, 134, 0.55);
        }

        @keyframes load-bar {
          100% { width: 100%; }
        }

        .pipeline-node {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          width: 140px;
        }

        .node-icon {
          width: 80px;
          height: 80px;
          background: #181218;
          border: 2px solid rgba(255,255,255,0.15);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 0 0 6px rgba(24, 18, 24, 1);
        }

        .pipeline-container:hover .node-icon {
          border-color: var(--intro-accent);
          box-shadow: 0 0 0 6px rgba(24, 18, 24, 1), 0 0 30px rgba(199, 101, 134, 0.45);
          transform: scale(1.15) rotate(5deg);
        }

        .node-label {
          font-size: 15px;
          font-weight: 700;
          color: rgba(255,255,255,0.9);
          text-align: center;
          opacity: 0;
          transform: translateY(15px);
          animation: fade-up 0.6s forwards;
          line-height: 1.4;
        }

        .node-icon svg { color: rgba(255,255,255,0.7); transition: color 0.4s; }
        .pipeline-container:hover .node-icon svg { color: white; }

        @keyframes fade-up {
          100% { opacity: 1; transform: translateY(0); }
        }

        .premium-btn {
          display: inline-flex;
          align-items: center;
          gap: 16px;
          padding: 24px 56px;
          font-size: 20px;
          font-weight: 800;
          color: white;
          background: linear-gradient(135deg, var(--intro-accent), var(--intro-copper));
          border: none;
          border-radius: 40px;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 15px 40px rgba(199, 101, 134, 0.34), inset 0 2px 0 rgba(255,255,255,0.3);
          text-decoration: none;
          position: relative;
          overflow: hidden;
          letter-spacing: 0.5px;
        }

        .premium-btn::after {
          content: '';
          position: absolute;
          top: -50%; left: -50%; width: 200%; height: 200%;
          background: radial-gradient(circle, rgba(255,255,255,0.4) 0%, transparent 70%);
          opacity: 0;
          transition: opacity 0.4s;
        }

        .premium-btn:hover {
          transform: translateY(-4px) scale(1.03);
          box-shadow: 0 25px 50px rgba(199, 101, 134, 0.52), inset 0 2px 0 rgba(255,255,255,0.4);
        }

        .premium-btn:hover::after {
          opacity: 1;
        }
      `}</style>

      {/* Background Elements */}
      <div className="ambient-bg" />
      <div className="grid-overlay" />
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      <div className="glass-hero">
        <div className="badge-pill">
          <ShieldCheck size={18} /> Consumer Trust Infrastructure
        </div>

        <h1 className="hero-title">What shoppers see<br/>should match what arrives.</h1>

        <p className="hero-subtitle">
          Anchor is a <strong>verification layer for fashion commerce</strong>. It checks seller claims against the physical garment, catalog views, model body type, and size chart before a listing reaches customers.
        </p>

        <div className="features-grid">
          <div className="feature-card" style={{ transitionDelay: '0.1s' }}>
            <div className="feature-icon-wrapper">
              <Zap size={28} />
            </div>
            <div className="feature-title">Three-source verification</div>
            <div className="feature-desc">Seller metadata, real-product anchor images, and catalog imagery are checked together for colour, print, construction, length, and fit consistency.</div>
          </div>
          
          <div className="feature-card" style={{ transitionDelay: '0.2s' }}>
            <div className="feature-icon-wrapper">
              <ShieldCheck size={28} />
            </div>
            <div className="feature-title">Trust that survives delivery</div>
            <div className="feature-desc">Catch missing back prints, misleading garment length, body-build mismatch, and size-chart contradictions before they become shopper disappointment.</div>
          </div>
          
          <div className="feature-card" style={{ transitionDelay: '0.3s' }}>
            <div className="feature-icon-wrapper">
              <Sparkles size={28} />
            </div>
            <div className="feature-title">Consistency Copilot</div>
            <div className="feature-desc">Evidence-backed suggestions help sellers repair inconsistent claims while preserving the original submitted data and a clear verification trail.</div>
          </div>
        </div>

        <div className="pipeline-container">
          <div className="pipeline-title">The 5-Layer AI Verification Pipeline</div>
          <div className="pipeline-track">
            <div className="pipeline-line">
              <div className="pipeline-line-fill" />
            </div>

            {[
              { icon: Camera, label: 'Visual Gate' },
              { icon: Cpu, label: 'ViT Extract' },
              { icon: ShieldCheck, label: 'pHash Check' },
              { icon: Layers, label: 'Math Fusion' },
              { icon: Sparkles, label: 'Trust Proof' }
            ].map((node, i) => (
              <div className="pipeline-node" key={i}>
                <div className="node-icon" style={{ transitionDelay: `${i * 0.15}s` }}>
                  <node.icon size={32} />
                </div>
                <div className="node-label" style={{ animationDelay: `${0.8 + (i * 0.25)}s` }}>{node.label}</div>
              </div>
            ))}
          </div>
        </div>

        <button className="premium-btn" onClick={() => navigate('/new-listing')}>
          Verify a New Listing <ArrowRight size={24} />
        </button>
      </div>
    </div>
  );
}
