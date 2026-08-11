import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Cpu, ShieldCheck, Layers, Sparkles, ArrowRight, Zap, Scissors, Ruler, GitMerge, CheckCircle } from 'lucide-react';

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
          background: rgba(199, 101, 134, 0.12);
          border: 1px solid rgba(199, 101, 134, 0.3);
          color: #efb8ca;
          padding: 10px 22px;
          border-radius: 100px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          margin-bottom: 40px;
          box-shadow: 0 0 30px rgba(199, 101, 134, 0.15);
          backdrop-filter: blur(10px);
          animation: pulse-glow 3s infinite alternate;
        }

        @keyframes pulse-glow {
          0% { box-shadow: 0 0 10px rgba(199, 101, 134, 0.15); }
          100% { box-shadow: 0 0 40px rgba(199, 101, 134, 0.4); }
        }

        .hero-title {
          font-family: 'Fraunces', Georgia, serif;
          font-size: 68px;
          font-weight: 600;
          text-align: center;
          margin-bottom: 30px;
          line-height: 1.05;
          letter-spacing: -2.5px;
          background: linear-gradient(135deg, #ffffff 20%, #efb8ca 60%, #c76586 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0px 4px 20px rgba(199,101,134,0.15));
        }

        .hero-subtitle {
          font-size: 20px;
          color: rgba(255,255,255,0.7);
          text-align: center;
          max-width: 780px;
          margin: 0 auto 60px;
          line-height: 1.65;
          font-weight: 400;
        }

        .hero-subtitle strong {
          color: #efb8ca;
          font-weight: 600;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          width: 100%;
          margin-bottom: 72px;
        }

        .feature-card {
          background: rgba(255, 255, 255, 0.025);
          border: 1px solid rgba(255, 255, 255, 0.07);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-radius: 22px;
          padding: 36px 28px;
          transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          position: relative;
          overflow: hidden;
        }

        .feature-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; width: 100%; height: 100%;
          background: radial-gradient(circle at top left, rgba(199, 101, 134, 0.12), transparent 70%);
          opacity: 0;
          transition: opacity 0.5s ease;
        }

        .feature-card:hover {
          transform: translateY(-8px) scale(1.01);
          border-color: rgba(199, 101, 134, 0.35);
          box-shadow: 0 24px 48px rgba(0, 0, 0, 0.4), inset 0 0 0 1px rgba(199, 101, 134, 0.2);
        }

        .feature-card:hover::before {
          opacity: 1;
        }

        .feature-icon-wrapper {
          width: 52px;
          height: 52px;
          border-radius: 15px;
          background: linear-gradient(135deg, rgba(199, 101, 134, 0.2), rgba(209, 138, 104, 0.12));
          border: 1px solid rgba(199, 101, 134, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 22px;
          color: var(--intro-accent);
          box-shadow: 0 6px 20px rgba(199, 101, 134, 0.15);
          transition: all 0.4s ease;
        }

        .feature-card:hover .feature-icon-wrapper {
          transform: scale(1.1) rotate(5deg);
          box-shadow: 0 10px 30px rgba(199, 101, 134, 0.3);
        }

        .feature-title {
          font-size: 20px;
          font-weight: 800;
          color: white;
          margin-bottom: 14px;
          letter-spacing: -0.3px;
        }

        .feature-desc {
          font-size: 14px;
          color: rgba(255, 255, 255, 0.55);
          line-height: 1.65;
        }

        .pipeline-container {
          width: 100%;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 28px;
          padding: 52px 36px;
          position: relative;
          margin-bottom: 72px;
          overflow: hidden;
          backdrop-filter: blur(20px);
        }

        .pipeline-container::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(199,101,134,0.3), transparent);
        }

        .pipeline-title-section {
          text-align: center;
          margin-bottom: 44px;
        }

        .pipeline-count-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 999px;
          background: rgba(199,101,134,0.12);
          border: 1px solid rgba(199,101,134,0.2);
          color: #efb8ca;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 14px;
        }

        .pipeline-title {
          font-size: 22px;
          font-weight: 800;
          color: white;
          letter-spacing: -0.3px;
        }

        .pipeline-subtitle {
          color: rgba(255,255,255,0.4);
          font-size: 13px;
          margin-top: 8px;
        }

        .pipeline-track {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 8px;
          position: relative;
        }

        .pipeline-line {
          position: absolute;
          top: 36px;
          left: 40px;
          right: 40px;
          height: 2px;
          background: rgba(255,255,255,0.06);
          z-index: 1;
        }

        .pipeline-line-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--intro-accent), var(--intro-plum), var(--intro-copper));
          width: 0%;
          animation: load-bar 3s 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          box-shadow: 0 0 12px rgba(199, 101, 134, 0.4);
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
          gap: 14px;
        }

        .node-icon {
          width: 72px;
          height: 72px;
          background: #181218;
          border: 2px solid rgba(255,255,255,0.1);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 0 0 5px rgba(24, 18, 24, 1);
        }

        .pipeline-node:hover .node-icon {
          border-color: var(--intro-accent);
          box-shadow: 0 0 0 5px rgba(24, 18, 24, 1), 0 0 28px rgba(199, 101, 134, 0.45);
          transform: scale(1.12);
          background: rgba(199,101,134,0.08);
        }

        .node-num {
          position: absolute;
          top: -6px;
          right: calc(50% - 44px);
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--intro-accent), var(--intro-copper));
          color: white;
          font-size: 10px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 3px 10px rgba(199,101,134,0.4);
          opacity: 0;
          animation: fade-up 0.5s forwards;
        }

        .node-label {
          font-size: 12px;
          font-weight: 700;
          color: rgba(255,255,255,0.85);
          text-align: center;
          opacity: 0;
          transform: translateY(10px);
          animation: fade-up 0.6s forwards;
          line-height: 1.35;
          max-width: 110px;
        }

        .node-sublabel {
          font-size: 10px;
          color: rgba(255,255,255,0.35);
          text-align: center;
          margin-top: -8px;
          opacity: 0;
          animation: fade-up 0.6s forwards;
        }

        .node-icon svg { color: rgba(255,255,255,0.6); transition: color 0.4s; }
        .pipeline-node:hover .node-icon svg { color: var(--intro-accent); }

        @keyframes fade-up {
          100% { opacity: 1; transform: translateY(0); }
        }

        .pipeline-footer {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin-top: 36px;
          flex-wrap: wrap;
        }

        .pipeline-stat {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
          font-size: 11px;
          font-weight: 600;
          color: rgba(255,255,255,0.6);
        }

        .pipeline-stat svg { color: #4ade80; }

        .premium-btn {
          display: inline-flex;
          align-items: center;
          gap: 14px;
          padding: 22px 52px;
          font-size: 18px;
          font-weight: 800;
          color: white;
          background: linear-gradient(135deg, var(--intro-accent), var(--intro-copper));
          border: none;
          border-radius: 36px;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: 0 14px 40px rgba(199, 101, 134, 0.3), inset 0 1px 0 rgba(255,255,255,0.25);
          text-decoration: none;
          position: relative;
          overflow: hidden;
          letter-spacing: 0.3px;
        }

        .premium-btn::before {
          content: '';
          position: absolute;
          top: 0; left: -100%; width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          transition: left 0.6s ease;
        }

        .premium-btn:hover {
          transform: translateY(-3px) scale(1.02);
          box-shadow: 0 22px 50px rgba(199, 101, 134, 0.45), inset 0 1px 0 rgba(255,255,255,0.3);
        }

        .premium-btn:hover::before {
          left: 100%;
        }

        @media (max-width: 900px) {
          .features-grid { grid-template-columns: 1fr; }
          .pipeline-track { grid-template-columns: repeat(4, 1fr); gap: 16px; }
          .hero-title { font-size: 44px; }
        }
        @media (max-width: 600px) {
          .pipeline-track { grid-template-columns: repeat(3, 1fr); gap: 16px; }
          .hero-title { font-size: 36px; }
          .anchor-intro-container { padding: 48px 16px; }
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
          <ShieldCheck size={16} /> 7-Layer Verification Engine
        </div>

        <h1 className="hero-title">What shoppers see<br/>should match what arrives.</h1>

        <p className="hero-subtitle">
          Anchor is a <strong>verification layer for fashion commerce</strong>. It checks seller claims against the physical garment, catalog views, model body type, and size chart before a listing reaches customers.
        </p>

        <div className="features-grid">
          <div className="feature-card" style={{ transitionDelay: '0.1s' }}>
            <div className="feature-icon-wrapper">
              <Zap size={24} />
            </div>
            <div className="feature-title">Three-source verification</div>
            <div className="feature-desc">Seller metadata, real-product anchor images, and catalog imagery are checked together for colour, print, construction, length, and fit consistency.</div>
          </div>
          
          <div className="feature-card" style={{ transitionDelay: '0.2s' }}>
            <div className="feature-icon-wrapper">
              <ShieldCheck size={24} />
            </div>
            <div className="feature-title">Trust that survives delivery</div>
            <div className="feature-desc">Catch missing back prints, misleading garment length, body-build mismatch, and size-chart contradictions before they become shopper disappointment.</div>
          </div>
          
          <div className="feature-card" style={{ transitionDelay: '0.3s' }}>
            <div className="feature-icon-wrapper">
              <Sparkles size={24} />
            </div>
            <div className="feature-title">Consistency Copilot</div>
            <div className="feature-desc">Evidence-backed suggestions help sellers repair inconsistent claims while preserving the original submitted data and a clear verification trail.</div>
          </div>
        </div>

        <div className="pipeline-container">
          <div className="pipeline-title-section">
            <div className="pipeline-count-badge"><Layers size={13} /> Seven independent checks</div>
            <div className="pipeline-title">The 7-Layer AI Verification Pipeline</div>
            <div className="pipeline-subtitle">Layers 1–6 run fully offline — zero external API calls</div>
          </div>
          <div className="pipeline-track">
            <div className="pipeline-line">
              <div className="pipeline-line-fill" />
            </div>

            {[
              { icon: Camera, label: 'Visual Gate', sub: 'CLIP + pHash', num: 1 },
              { icon: Cpu, label: 'ViT Extract', sub: '19 attributes', num: 2 },
              { icon: Scissors, label: 'Segmentation', sub: 'Garment isolation', num: 3 },
              { icon: Layers, label: 'Fabric Check', sub: 'Texture verify', num: 4 },
              { icon: Ruler, label: 'Size Validation', sub: 'Chart cross-ref', num: 5 },
              { icon: GitMerge, label: 'Bayesian Fusion', sub: '3-source merge', num: 6 },
              { icon: ShieldCheck, label: 'Trust Verdict', sub: 'Final decision', num: 7 },
            ].map((node, i) => (
              <div className="pipeline-node" key={i}>
                <div className="node-num" style={{ animationDelay: `${0.8 + (i * 0.2)}s` }}>{node.num}</div>
                <div className="node-icon" style={{ transitionDelay: `${i * 0.1}s` }}>
                  <node.icon size={28} />
                </div>
                <div className="node-label" style={{ animationDelay: `${0.8 + (i * 0.2)}s` }}>{node.label}</div>
                <div className="node-sublabel" style={{ animationDelay: `${1.0 + (i * 0.2)}s` }}>{node.sub}</div>
              </div>
            ))}
          </div>

          <div className="pipeline-footer">
            <div className="pipeline-stat"><CheckCircle size={14} /> Layers 1–6 run locally</div>
            <div className="pipeline-stat"><CheckCircle size={14} /> Zero API calls for verification</div>
            <div className="pipeline-stat"><CheckCircle size={14} /> Custom ViT 89% accuracy</div>
          </div>
        </div>

        <button className="premium-btn" onClick={() => navigate('/new-listing')}>
          Verify a New Listing <ArrowRight size={22} />
        </button>
      </div>
    </div>
  );
}
