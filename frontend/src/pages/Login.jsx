import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Anchor, ArrowRight, Eye, EyeOff, ShieldCheck, ScanLine, Fingerprint, CheckCircle2, Layers, BarChart3,
} from 'lucide-react'
import { useApp } from '../AppContext'

export default function Login() {
  const [email, setEmail] = useState('seller@myntra.com')
  const [password, setPassword] = useState('demo123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showPassword, setShowPassword] = useState(false)
  const [mounted, setMounted] = useState(false)

  const { login } = useApp()
  const navigate = useNavigate()

  useEffect(() => {
    const timer = window.setTimeout(() => setMounted(true), 80)
    return () => window.clearTimeout(timer)
  }, [])

  const handleLogin = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'Login failed')

      login(data.token)
      navigate('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        /* ───────── FULL LOGIN MAKEOVER ───────── */
        .login-shell {
          min-height: 100vh;
          width: 100%;
          display: grid;
          grid-template-columns: 1fr 1fr;
          font-family: 'Manrope', 'Inter', sans-serif;
          overflow: hidden;
          background: #0a0a0c;
        }

        /* ── LEFT: Immersive Story ── */
        .login-immersive {
          position: relative;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 100vh;
          padding: clamp(40px, 5vw, 72px);
          color: #fff;
          overflow: hidden;
          isolation: isolate;
        }

        /* Mesh gradient background */
        .login-mesh {
          position: absolute;
          inset: 0;
          z-index: -2;
          background:
            conic-gradient(from 120deg at 20% 80%, #1a0a12 0%, #2d1424 25%, #0d0d14 50%, #1a0e14 75%, #1a0a12 100%);
        }

        /* Animated gradient blobs */
        .login-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(120px);
          z-index: -1;
          animation: blob-drift 18s infinite ease-in-out;
        }
        .login-blob-1 {
          width: 600px; height: 600px;
          background: radial-gradient(circle, rgba(255,63,108,0.25), transparent 70%);
          top: -20%; left: -10%;
        }
        .login-blob-2 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(168,70,108,0.2), transparent 70%);
          bottom: -15%; right: -15%;
          animation-delay: -6s;
          animation-direction: reverse;
        }
        .login-blob-3 {
          width: 350px; height: 350px;
          background: radial-gradient(circle, rgba(255,126,103,0.12), transparent 70%);
          top: 40%; left: 50%;
          animation-delay: -3s;
        }

        @keyframes blob-drift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(60px, -40px) scale(1.1); }
          50% { transform: translate(-30px, 50px) scale(0.95); }
          75% { transform: translate(40px, 20px) scale(1.05); }
        }

        /* Noise texture overlay */
        .login-noise {
          position: absolute;
          inset: 0;
          z-index: -1;
          opacity: 0.03;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
          pointer-events: none;
        }

        /* Grid lines */
        .login-grid {
          position: absolute;
          inset: 0;
          z-index: -1;
          pointer-events: none;
          background-size: 60px 60px;
          background-image:
            linear-gradient(to right, rgba(255,255,255,.02) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255,255,255,.02) 1px, transparent 1px);
          mask-image: radial-gradient(ellipse at 30% 70%, black 20%, transparent 65%);
          -webkit-mask-image: radial-gradient(ellipse at 30% 70%, black 20%, transparent 65%);
        }

        /* Top bar */
        .login-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          opacity: ${mounted ? 1 : 0};
          transform: ${mounted ? 'translateY(0)' : 'translateY(-10px)'};
          transition: all 0.8s 0.1s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .login-logo {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .login-logo-icon {
          width: 42px; height: 42px;
          border-radius: 13px;
          display: grid;
          place-items: center;
          background: linear-gradient(135deg, rgba(255,63,108,0.2), rgba(255,126,103,0.15));
          border: 1px solid rgba(255,255,255,0.08);
          box-shadow: 0 0 28px rgba(255,63,108,0.15);
        }

        .login-logo-text {
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .login-logo-text span {
          display: block;
          font-size: 8px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.35);
          margin-top: 2px;
        }

        .login-version-pill {
          padding: 5px 12px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.07);
          background: rgba(255,255,255,0.03);
          color: rgba(255,255,255,0.4);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
        }

        /* Main Hero */
        .login-hero-content {
          max-width: 580px;
          opacity: ${mounted ? 1 : 0};
          transform: ${mounted ? 'translateY(0)' : 'translateY(30px)'};
          transition: all 1s 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .login-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 14px;
          border-radius: 999px;
          background: rgba(255,63,108,0.08);
          border: 1px solid rgba(255,63,108,0.15);
          color: #ff8fa6;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-bottom: 28px;
        }

        .login-hero-badge::before {
          content: '';
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #ff3f6c;
          box-shadow: 0 0 10px rgba(255,63,108,0.6);
          animation: glow-dot 2s ease-in-out infinite;
        }

        @keyframes glow-dot {
          0%, 100% { opacity: 1; box-shadow: 0 0 10px rgba(255,63,108,0.6); }
          50% { opacity: 0.5; box-shadow: 0 0 20px rgba(255,63,108,0.8); }
        }

        .login-hero-heading {
          font-family: 'Fraunces', Georgia, serif;
          font-size: clamp(44px, 5.5vw, 64px);
          font-weight: 600;
          line-height: 1.02;
          letter-spacing: -0.04em;
          margin-bottom: 24px;
        }

        .login-hero-heading em {
          font-style: normal;
          display: block;
          background: linear-gradient(135deg, #ff3f6c 0%, #ff7e67 40%, #ffb534 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          filter: drop-shadow(0 0 24px rgba(255,63,108,0.2));
        }

        .login-hero-desc {
          font-size: 15px;
          color: rgba(255,255,255,0.45);
          line-height: 1.8;
          max-width: 500px;
          margin-bottom: 36px;
        }

        .login-hero-desc strong {
          color: rgba(255,255,255,0.75);
          font-weight: 600;
        }

        /* Pipeline Mini */
        .login-pipeline-strip {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 40px;
        }

        .login-pipe-node {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 8px 12px;
          border-radius: 10px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          font-size: 11px;
          font-weight: 650;
          color: rgba(255,255,255,0.55);
          transition: all 0.3s ease;
        }

        .login-pipe-node:hover {
          background: rgba(255,63,108,0.06);
          border-color: rgba(255,63,108,0.15);
          color: rgba(255,255,255,0.8);
        }

        .login-pipe-node svg {
          color: rgba(255,63,108,0.6);
        }

        .login-pipe-arrow {
          color: rgba(255,255,255,0.12);
          font-size: 14px;
        }

        /* Stats bar */
        .login-stats-row {
          display: flex;
          gap: 32px;
          padding-top: 32px;
          border-top: 1px solid rgba(255,255,255,0.06);
        }

        .login-stat {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .login-stat-value {
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.03em;
          background: linear-gradient(135deg, #fff, rgba(255,255,255,0.6));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .login-stat-label {
          font-size: 11px;
          color: rgba(255,255,255,0.3);
          font-weight: 600;
        }

        /* ── RIGHT: Login Form ── */
        .login-form-area {
          position: relative;
          display: grid;
          place-items: center;
          min-height: 100vh;
          padding: clamp(32px, 5vw, 60px);
          background: #faf8f6;
          overflow: hidden;
        }

        /* Decorative corner gradient */
        .login-form-area::before {
          content: '';
          position: absolute;
          top: 0; right: 0;
          width: 400px; height: 400px;
          background: radial-gradient(circle at top right, rgba(255,63,108,0.04), transparent 70%);
          pointer-events: none;
        }

        .login-form-area::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0;
          width: 300px; height: 300px;
          background: radial-gradient(circle at bottom left, rgba(255,126,103,0.03), transparent 70%);
          pointer-events: none;
        }

        .login-card {
          position: relative;
          width: min(420px, 100%);
          padding: clamp(32px, 4vw, 48px);
          border-radius: 28px;
          background: white;
          border: 1px solid rgba(0,0,0,0.05);
          box-shadow:
            0 1px 2px rgba(0,0,0,0.04),
            0 4px 12px rgba(0,0,0,0.03),
            0 24px 64px rgba(0,0,0,0.06);
          opacity: ${mounted ? 1 : 0};
          transform: ${mounted ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.98)'};
          transition: all 0.9s 0.15s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .login-card-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px;
          border-radius: 999px;
          background: #fff0f3;
          color: #e0435d;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 18px;
        }

        .login-card h2 {
          font-family: 'Fraunces', Georgia, serif;
          font-size: 30px;
          font-weight: 620;
          letter-spacing: -0.03em;
          color: #1a1218;
          margin-bottom: 8px;
          line-height: 1.1;
        }

        .login-card-sub {
          color: #8a7e85;
          font-size: 13px;
          line-height: 1.6;
          margin-bottom: 32px;
        }

        .login-field { margin-bottom: 20px; }
        .login-field-label {
          display: block;
          margin-bottom: 7px;
          color: #6b5f66;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .login-field-wrap { position: relative; }

        .login-field-input {
          width: 100%;
          min-height: 50px;
          padding: 14px 16px;
          border: 1.5px solid #e8e0e3;
          border-radius: 14px;
          outline: none;
          background: #fdfbfa;
          color: #1a1218;
          font: inherit;
          font-size: 14px;
          transition: all 0.25s ease;
        }
        .login-field-input:hover { border-color: #d8c8ce; }
        .login-field-input:focus {
          border-color: #ff3f6c;
          background: #fff;
          box-shadow: 0 0 0 4px rgba(255,63,108,0.06), 0 2px 12px rgba(255,63,108,0.06);
        }
        .login-field-input-pw { padding-right: 50px; }

        .login-eye-btn {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          width: 36px; height: 36px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: #a89aa0;
          cursor: pointer;
          transition: all 0.2s;
        }
        .login-eye-btn:hover { background: #f5edf0; color: #6b3a4a; }

        .login-error-msg {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 18px;
          padding: 11px 14px;
          border-radius: 12px;
          background: #fff1f2;
          border: 1px solid rgba(220,38,38,0.12);
          color: #b91c2c;
          font-size: 12px;
          font-weight: 600;
          animation: shake-x 0.4s ease;
        }

        @keyframes shake-x {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(5px); }
          60% { transform: translateX(-3px); }
          80% { transform: translateX(2px); }
        }

        .login-cta {
          width: 100%;
          min-height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 8px;
          border: 0;
          border-radius: 14px;
          background: linear-gradient(135deg, #ff3f6c 0%, #ff7e67 100%);
          color: white;
          font: inherit;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          position: relative;
          overflow: hidden;
          box-shadow: 0 8px 28px rgba(255,63,108,0.25);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .login-cta::before {
          content: '';
          position: absolute;
          top: 0; left: -100%; width: 100%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
          transition: left 0.6s ease;
        }

        .login-cta:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 14px 36px rgba(255,63,108,0.35);
        }
        .login-cta:hover:not(:disabled)::before { left: 100%; }
        .login-cta:active:not(:disabled) { transform: translateY(0) scale(0.98); }
        .login-cta:disabled { opacity: 0.6; cursor: wait; }

        .login-demo-hint {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 22px;
          font-size: 11px;
          color: #a89aa0;
          font-weight: 600;
        }

        .login-demo-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #22c55e;
          box-shadow: 0 0 8px rgba(34,197,94,0.4);
          animation: glow-dot 2s ease-in-out infinite;
        }

        .login-footer-text {
          position: absolute;
          bottom: 28px;
          left: 50%;
          transform: translateX(-50%);
          font-size: 10px;
          color: #c4babe;
          font-weight: 600;
          text-align: center;
          white-space: nowrap;
        }

        /* ── Responsive ── */
        @media (max-width: 960px) {
          .login-shell { grid-template-columns: 1fr; }
          .login-immersive {
            min-height: auto;
            padding: 40px 28px 48px;
          }
          .login-hero-heading { font-size: clamp(36px, 8vw, 52px); }
          .login-stats-row { gap: 24px; }
          .login-form-area { min-height: auto; padding: 40px 20px 60px; }
          .login-footer-text { position: static; margin-top: 24px; transform: none; }
        }

        @media (max-width: 540px) {
          .login-immersive { padding: 28px 20px 36px; }
          .login-pipeline-strip { display: none; }
          .login-stats-row { flex-wrap: wrap; gap: 16px; }
          .login-card { padding: 28px 22px; border-radius: 22px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .login-blob { animation: none; }
          .login-hero-content, .login-card, .login-topbar { transition-duration: 0.01ms; }
        }
      `}</style>

      <main className="login-shell">
        {/* ── LEFT PANEL ── */}
        <section className="login-immersive">
          <div className="login-mesh" />
          <div className="login-blob login-blob-1" />
          <div className="login-blob login-blob-2" />
          <div className="login-blob login-blob-3" />
          <div className="login-noise" />
          <div className="login-grid" />

          {/* Top bar */}
          <div className="login-topbar">
            <div className="login-logo">
              <div className="login-logo-icon"><Anchor size={20} color="white" /></div>
              <div className="login-logo-text">
                Anchor
                <span>Myntra Listing Verification</span>
              </div>
            </div>
            <div className="login-version-pill">v2.0 • HackerRamp</div>
          </div>

          {/* Hero */}
          <div className="login-hero-content">
            <div className="login-hero-badge">
              Listing integrity engine
            </div>

            <h1 className="login-hero-heading">
              Verify before<br/>
              <em>shoppers see it.</em>
            </h1>

            <p className="login-hero-desc">
              One real photo. Every claim checked. Anchor runs <strong>7 independent AI checks</strong> on seller metadata, 
              product imagery, model fit, and size charts — catching mismatches <strong>before listings go live</strong>.
            </p>

            {/* Mini pipeline visualization */}
            <div className="login-pipeline-strip">
              <div className="login-pipe-node"><ScanLine size={14} /> Visual Gate</div>
              <span className="login-pipe-arrow">→</span>
              <div className="login-pipe-node"><Fingerprint size={14} /> ViT Extract</div>
              <span className="login-pipe-arrow">→</span>
              <div className="login-pipe-node"><Layers size={14} /> Fusion</div>
              <span className="login-pipe-arrow">→</span>
              <div className="login-pipe-node"><ShieldCheck size={14} /> Verdict</div>
            </div>

            {/* Stats */}
            <div className="login-stats-row">
              <div className="login-stat">
                <div className="login-stat-value">7</div>
                <div className="login-stat-label">Verification layers</div>
              </div>
              <div className="login-stat">
                <div className="login-stat-value">19</div>
                <div className="login-stat-label">Attributes checked</div>
              </div>
              <div className="login-stat">
                <div className="login-stat-value">89%</div>
                <div className="login-stat-label">ViT accuracy</div>
              </div>
              <div className="login-stat">
                <div className="login-stat-value">0</div>
                <div className="login-stat-label">APIs for verification</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── RIGHT PANEL ── */}
        <section className="login-form-area">
          <div className="login-card">
            <div className="login-card-eyebrow"><Anchor size={11} /> Seller Portal</div>
            <h2>Welcome back.</h2>
            <p className="login-card-sub">
              Sign in to verify listings, review AI-detected mismatches, and publish with confidence.
            </p>

            {error && (
              <div className="login-error-msg" role="alert">
                <ShieldCheck size={15} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin}>
              <div className="login-field">
                <label className="login-field-label" htmlFor="login-email">Email</label>
                <div className="login-field-wrap">
                  <input
                    id="login-email"
                    type="email"
                    className="login-field-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seller@myntra.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="login-field">
                <label className="login-field-label" htmlFor="login-pw">Password</label>
                <div className="login-field-wrap">
                  <input
                    id="login-pw"
                    type={showPassword ? 'text' : 'password'}
                    className="login-field-input login-field-input-pw"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="login-eye-btn"
                    onClick={() => setShowPassword(v => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="login-cta" disabled={loading}>
                {loading ? 'Signing in…' : <>Sign in <ArrowRight size={16} /></>}
              </button>
            </form>

            <div className="login-demo-hint">
              <span className="login-demo-dot" />
              Demo credentials pre-filled — just click sign in
            </div>
          </div>

          <div className="login-footer-text">
            Built for Myntra HackerRamp · ⚓ Trust shouldn't be optional
          </div>
        </section>
      </main>
    </>
  )
}
