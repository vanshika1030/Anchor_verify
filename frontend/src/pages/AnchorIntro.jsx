import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Cpu, ShieldCheck, Layers, Sparkles, ArrowRight } from 'lucide-react';

export default function AnchorIntro() {
  const navigate = useNavigate();

  return (
    <div className="anchor-intro-container">
      <style>{`
        .anchor-intro-container {
          position: relative;
          width: 100%;
          min-height: calc(100vh - 120px);
          background: #0f172a;
          border-radius: 24px;
          overflow: hidden;
          color: white;
          font-family: var(--font);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.2);
        }

        .orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.5;
          animation: float 10s infinite ease-in-out alternate;
        }

        .orb-1 {
          width: 400px;
          height: 400px;
          background: #ff3f6c;
          top: -100px;
          left: -100px;
          animation-delay: 0s;
        }

        .orb-2 {
          width: 500px;
          height: 500px;
          background: #7c3aed;
          bottom: -150px;
          right: -100px;
          animation-delay: -5s;
        }

        .orb-3 {
          width: 300px;
          height: 300px;
          background: #0ea5e9;
          top: 40%;
          left: 50%;
          transform: translate(-50%, -50%);
          animation-delay: -2s;
        }

        @keyframes float {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(30px, -50px) scale(1.1); }
        }

        .glass-card {
          background: rgba(255, 255, 255, 0.15);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 16px;
          padding: 48px;
          position: relative;
          z-index: 10;
          max-width: 900px;
          width: 100%;
          box-shadow: 0 24px 40px rgba(0,0,0,0.1);
        }

        .hero-title {
          font-size: 48px;
          font-weight: 800;
          background: linear-gradient(to right, #fff, #e2e8f0);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin-bottom: 24px;
          text-align: center;
          letter-spacing: -1px;
        }

        .hero-subtitle {
          font-size: 18px;
          color: rgba(255,255,255,0.85);
          text-align: center;
          max-width: 650px;
          margin: 0 auto 48px;
          line-height: 1.6;
        }

        .pipeline-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 60px 0;
          position: relative;
        }

        .pipeline-line {
          position: absolute;
          top: 32px;
          left: 40px;
          right: 40px;
          height: 2px;
          background: rgba(255,255,255,0.1);
          z-index: 1;
        }

        .pipeline-line-fill {
          height: 100%;
          background: linear-gradient(90deg, #ff3f6c, #7c3aed, #0ea5e9);
          width: 100%;
          animation: load 2s ease-out forwards;
        }

        @keyframes load {
          0% { width: 0%; }
          100% { width: 100%; }
        }

        .pipeline-step {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          flex: 1;
        }

        .pipeline-icon {
          width: 64px;
          height: 64px;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(255,255,255,0.2);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(8px);
          transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
        }

        .pipeline-step:hover .pipeline-icon {
          transform: translateY(-5px);
          border-color: #ff3f6c;
          box-shadow: 0 10px 20px rgba(255, 63, 108, 0.2);
        }

        .pipeline-label {
          font-size: 14px;
          font-weight: 600;
          color: rgba(255,255,255,0.9);
          text-align: center;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
          margin-bottom: 48px;
        }

        .stat-card {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px;
          padding: 24px 16px;
          text-align: center;
          transition: background 0.3s ease, transform 0.3s ease;
        }

        .stat-card:hover {
          background: rgba(255,255,255,0.1);
          transform: translateY(-2px);
        }

        .stat-value {
          font-size: 36px;
          font-weight: 800;
          color: white;
          margin-bottom: 8px;
          text-shadow: 0 2px 10px rgba(255,255,255,0.2);
        }

        .stat-label {
          font-size: 13px;
          color: rgba(255,255,255,0.7);
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .cta-container {
          text-align: center;
          margin-top: 32px;
        }

        .premium-btn {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          padding: 16px 48px;
          font-size: 18px;
          font-weight: 700;
          color: white;
          background: linear-gradient(135deg, #ff3f6c, #f77062);
          border: none;
          border-radius: 30px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 10px 20px rgba(255, 63, 108, 0.3);
          text-decoration: none;
        }

        .premium-btn:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 15px 30px rgba(255, 63, 108, 0.4);
        }
          
        .premium-btn:active {
          transform: translateY(1px);
        }

        .particles {
          position: absolute;
          inset: 0;
          overflow: hidden;
          z-index: 1;
        }

        .particle {
          position: absolute;
          background: white;
          border-radius: 50%;
          opacity: 0.3;
          animation: float-particle linear infinite;
        }

        @keyframes float-particle {
          0% { transform: translateY(100vh) scale(0); opacity: 0; }
          20% { opacity: 0.5; }
          80% { opacity: 0.5; }
          100% { transform: translateY(-100px) scale(1); opacity: 0; }
        }
      `}</style>

      {/* Background elements */}
      <div className="orb orb-1"></div>
      <div className="orb orb-2"></div>
      <div className="orb orb-3"></div>
      
      <div className="particles">
        {[...Array(24)].map((_, i) => (
          <div 
            key={i} 
            className="particle"
            style={{
              left: `${Math.random() * 100}%`,
              width: `${Math.random() * 4 + 2}px`,
              height: `${Math.random() * 4 + 2}px`,
              animationDuration: `${Math.random() * 10 + 15}s`,
              animationDelay: `${Math.random() * 5}s`
            }}
          />
        ))}
      </div>

      <div className="glass-card">
        <h1 className="hero-title">Anchor Verification</h1>
        <p className="hero-subtitle">
          Experience Myntra's next-generation AI pipeline. Ensure catalog accuracy, prevent costly returns, 
          and generate stunning AI models from your raw product photos in seconds.
        </p>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">5</div>
            <div className="stat-label">AI Layers</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">0</div>
            <div className="stat-label">API Calls</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">89%</div>
            <div className="stat-label">ViT Accuracy</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">99%</div>
            <div className="stat-label">Confidence</div>
          </div>
        </div>

        <div className="pipeline-container">
          <div className="pipeline-line">
            <div className="pipeline-line-fill"></div>
          </div>
          
          <div className="pipeline-step">
            <div className="pipeline-icon">
              <Camera size={28} color="#e2e8f0" />
            </div>
            <div className="pipeline-label">Visual Gate</div>
          </div>
          
          <div className="pipeline-step">
            <div className="pipeline-icon">
              <Cpu size={28} color="#e2e8f0" />
            </div>
            <div className="pipeline-label">Local AI</div>
          </div>
          
          <div className="pipeline-step">
            <div className="pipeline-icon">
              <ShieldCheck size={28} color="#e2e8f0" />
            </div>
            <div className="pipeline-label">Deterministic</div>
          </div>
          
          <div className="pipeline-step">
            <div className="pipeline-icon">
              <Layers size={28} color="#e2e8f0" />
            </div>
            <div className="pipeline-label">Bayesian Fusion</div>
          </div>
          
          <div className="pipeline-step">
            <div className="pipeline-icon">
              <Sparkles size={28} color="#e2e8f0" />
            </div>
            <div className="pipeline-label">AI Generation</div>
          </div>
        </div>

        <div className="cta-container">
          <button className="premium-btn" onClick={() => navigate('/new-listing')}>
            Experience Anchor <ArrowRight size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}
