import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Anchor, ArrowRight, CheckCircle2, Eye, EyeOff, Images, ShieldCheck, Sparkles,
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
        @keyframes login-rise {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes login-drift {
          0%, 100% { transform: translate3d(0, 0, 0) rotate(0deg); }
          50% { transform: translate3d(12px, -16px, 0) rotate(4deg); }
        }

        .login-page-wrapper {
          --login-ink: #211820;
          --login-plum: #793451;
          --login-rose: #bd5878;
          --login-copper: #d48a65;
          min-height: 100vh;
          width: 100%;
          display: grid;
          grid-template-columns: minmax(0, 1.08fr) minmax(430px, .92fr);
          overflow: hidden;
          background: #f6f1ec;
          color: var(--login-ink);
          font-family: 'Manrope', 'Inter', sans-serif;
        }

        .login-story {
          position: relative;
          isolation: isolate;
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-height: 100vh;
          padding: clamp(52px, 8vw, 112px);
          overflow: hidden;
          color: white;
          background:
            radial-gradient(circle at 88% 18%, rgba(212, 138, 101, .26), transparent 22rem),
            radial-gradient(circle at 18% 92%, rgba(189, 88, 120, .26), transparent 28rem),
            linear-gradient(145deg, #181218 0%, #2a1b27 58%, #4a2438 100%);
        }

        .login-story::before,
        .login-story::after {
          content: '';
          position: absolute;
          z-index: -1;
          border: 1px solid rgba(255,255,255,.09);
          border-radius: 50%;
          pointer-events: none;
        }
        .login-story::before { width: 430px; height: 430px; right: -210px; top: -170px; }
        .login-story::after { width: 250px; height: 250px; right: -70px; top: -70px; }

        .login-brand {
          display: inline-flex;
          align-items: center;
          gap: 11px;
          width: fit-content;
          margin-bottom: clamp(46px, 8vh, 82px);
          font-size: 17px;
          font-weight: 800;
          letter-spacing: -.02em;
        }

        .login-brand-mark {
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255,255,255,.24);
          border-radius: 14px;
          background: linear-gradient(145deg, var(--login-rose), var(--login-copper));
          box-shadow: 0 14px 30px rgba(0,0,0,.28);
          transform: rotate(-4deg);
        }

        .login-brand span span { color: #efb4c6; }
        .login-brand small {
          display: block;
          margin-top: 2px;
          color: rgba(255,255,255,.46);
          font-size: 8px;
          font-weight: 700;
          letter-spacing: .17em;
          text-transform: uppercase;
        }

        .login-story-copy {
          max-width: 670px;
          opacity: ${mounted ? 1 : 0};
          transform: ${mounted ? 'translateY(0)' : 'translateY(24px)'};
          transition: opacity .8s ease, transform .8s cubic-bezier(.16,1,.3,1);
        }

        .login-kicker {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-bottom: 18px;
          color: #efb4c6;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .15em;
          text-transform: uppercase;
        }

        .login-story h1 {
          max-width: 650px;
          margin: 0 0 22px;
          font-family: 'Fraunces', Georgia, serif;
          font-size: clamp(44px, 6.4vw, 78px);
          font-weight: 620;
          line-height: .98;
          letter-spacing: -.045em;
        }

        .login-story h1 em {
          color: #e8a4b8;
          font-style: italic;
          font-weight: 520;
        }

        .login-story-copy > p {
          max-width: 590px;
          color: rgba(255,255,255,.62);
          font-size: 14px;
          line-height: 1.8;
        }

        .login-proof-row {
          display: flex;
          flex-wrap: wrap;
          gap: 18px;
          margin-top: 30px;
          color: rgba(255,255,255,.72);
          font-size: 11px;
          font-weight: 650;
        }
        .login-proof-row span { display: inline-flex; align-items: center; gap: 7px; }
        .login-proof-row svg { color: #dca1b4; }

        .login-artboard {
          position: relative;
          width: min(500px, 92%);
          height: 122px;
          margin-top: 54px;
        }

        .login-sheet-card,
        .login-score-card {
          position: absolute;
          border: 1px solid rgba(255,255,255,.15);
          background: rgba(255,255,255,.095);
          box-shadow: 0 22px 42px rgba(0,0,0,.22);
          backdrop-filter: blur(18px);
        }
        .login-sheet-card {
          inset: 0 82px 0 0;
          display: grid;
          grid-template-columns: 72px 1fr;
          gap: 15px;
          align-items: center;
          padding: 14px;
          border-radius: 20px;
          transform: rotate(-1.5deg);
        }
        .login-sheet-thumb {
          height: 92px;
          display: grid;
          place-items: center;
          border-radius: 14px;
          color: #e6aabd;
          background: linear-gradient(145deg, rgba(189,88,120,.23), rgba(212,138,101,.16));
        }
        .login-sheet-lines { display: grid; gap: 9px; }
        .login-sheet-lines i { display: block; height: 6px; border-radius: 999px; background: rgba(255,255,255,.12); }
        .login-sheet-lines i:nth-child(1) { width: 52%; background: rgba(255,255,255,.38); }
        .login-sheet-lines i:nth-child(2) { width: 87%; }
        .login-sheet-lines i:nth-child(3) { width: 72%; }
        .login-sheet-lines strong { color: rgba(255,255,255,.82); font-size: 10px; }
        .login-score-card {
          right: 0;
          bottom: 12px;
          width: 116px;
          padding: 13px;
          border-radius: 16px;
          color: white;
          animation: login-drift 7s ease-in-out infinite;
        }
        .login-score-card small { display: block; color: rgba(255,255,255,.48); font-size: 8px; letter-spacing: .1em; text-transform: uppercase; }
        .login-score-card strong { display: block; margin: 3px 0; font-size: 22px; font-weight: 800; }
        .login-score-card span { color: #bfe8d8; font-size: 9px; font-weight: 750; }

        .login-form-side {
          position: relative;
          display: grid;
          place-items: center;
          min-height: 100vh;
          padding: clamp(32px, 6vw, 76px);
          background:
            linear-gradient(rgba(255,255,255,.52), rgba(255,255,255,.52)),
            repeating-linear-gradient(90deg, transparent 0 47px, rgba(121,52,81,.035) 48px),
            #f6f1ec;
        }

        .login-form-side::after {
          content: 'ANCHOR / SELLER STUDIO';
          position: absolute;
          right: 22px;
          top: 50%;
          color: rgba(33,24,32,.2);
          font-size: 8px;
          font-weight: 800;
          letter-spacing: .22em;
          transform: translateY(-50%) rotate(90deg);
        }

        .login-panel {
          width: min(430px, 100%);
          padding: clamp(28px, 4vw, 46px);
          border: 1px solid rgba(50,32,43,.09);
          border-radius: 26px;
          background: rgba(255,255,255,.82);
          box-shadow: 0 28px 70px rgba(48,29,41,.12);
          backdrop-filter: blur(18px);
          opacity: ${mounted ? 1 : 0};
          transform: ${mounted ? 'translateY(0)' : 'translateY(24px)'};
          transition: opacity .8s .12s ease, transform .8s .12s cubic-bezier(.16,1,.3,1);
        }

        .login-panel-kicker {
          color: var(--login-rose);
          font-size: 9px;
          font-weight: 800;
          letter-spacing: .15em;
          text-transform: uppercase;
        }
        .login-panel h2 {
          margin: 8px 0 8px;
          font-family: 'Fraunces', Georgia, serif;
          font-size: 36px;
          font-weight: 620;
          line-height: 1.08;
          letter-spacing: -.035em;
        }
        .login-panel-subtitle {
          margin-bottom: 30px;
          color: #776c73;
          font-size: 12px;
          line-height: 1.65;
        }

        .login-input-group { position: relative; margin-bottom: 19px; }
        .login-input-label {
          display: block;
          margin-bottom: 7px;
          color: #665a62;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: .09em;
          text-transform: uppercase;
        }
        .login-input {
          width: 100%;
          min-height: 52px;
          padding: 13px 15px;
          border: 1px solid #ded4d9;
          border-radius: 13px;
          outline: none;
          background: rgba(255,255,255,.9);
          color: var(--login-ink);
          font: inherit;
          font-size: 13px;
          transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
        }
        .login-input:hover { border-color: #cbbbc3; }
        .login-input:focus { border-color: var(--login-rose); box-shadow: 0 0 0 4px rgba(189,88,120,.1); }
        .login-password-input { padding-right: 48px; }

        .login-password-toggle {
          position: absolute;
          right: 10px;
          bottom: 9px;
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: #8d8088;
          cursor: pointer;
        }
        .login-password-toggle:hover { background: #f5edf0; color: var(--login-plum); }
        .login-password-toggle:focus-visible,
        .login-submit:focus-visible { outline: 3px solid rgba(189,88,120,.22); outline-offset: 2px; }

        .login-error {
          display: flex;
          align-items: flex-start;
          gap: 9px;
          margin-bottom: 18px;
          padding: 11px 12px;
          border: 1px solid rgba(180,56,72,.18);
          border-radius: 11px;
          background: #fff2f3;
          color: #a62f41;
          font-size: 11px;
          line-height: 1.5;
        }

        .login-submit {
          width: 100%;
          min-height: 52px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          margin-top: 8px;
          border: 0;
          border-radius: 13px;
          background: linear-gradient(115deg, var(--login-plum), var(--login-rose));
          color: white;
          box-shadow: 0 12px 28px rgba(121,52,81,.25);
          font: inherit;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          transition: transform .18s ease, box-shadow .18s ease;
        }
        .login-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 16px 34px rgba(121,52,81,.32); }
        .login-submit:disabled { opacity: .65; cursor: wait; }

        .login-demo-note {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          margin-top: 19px;
          color: #94868e;
          font-size: 9px;
          font-weight: 650;
        }
        .login-demo-note svg { color: #3d9d76; }

        @media (max-width: 920px) {
          .login-page-wrapper { grid-template-columns: 1fr; }
          .login-story { min-height: auto; padding: 44px 32px 54px; }
          .login-story h1 { max-width: 720px; font-size: clamp(42px, 9vw, 68px); }
          .login-brand { margin-bottom: 44px; }
          .login-artboard { display: none; }
          .login-form-side { min-height: auto; padding: 48px 24px 70px; }
          .login-form-side::after { display: none; }
        }

        @media (max-width: 540px) {
          .login-story { padding: 32px 22px 42px; }
          .login-story-copy > p { font-size: 13px; }
          .login-proof-row { gap: 10px 16px; }
          .login-form-side { padding: 30px 14px 44px; }
          .login-panel { padding: 28px 22px; border-radius: 21px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .login-score-card { animation: none; }
          .login-story-copy, .login-panel { transition-duration: .01ms; }
        }
      `}</style>

      <main className="login-page-wrapper">
        <section className="login-story" aria-label="Anchor Studio seller experience">
          <div className="login-brand">
            <span className="login-brand-mark"><Anchor size={22} /></span>
            <span>Anchor <span>Studio</span><small>Myntra seller workspace</small></span>
          </div>

          <div className="login-story-copy">
            <div className="login-kicker"><Sparkles size={13} /> A calmer way to catalog</div>
            <h1>Beautiful cataloging. <em>Serious proof.</em></h1>
            <p>
              Turn product evidence into polished, trustworthy listings—with guided workflows,
              clear quality checks, and less guesswork for your team.
            </p>

            <div className="login-proof-row">
              <span><CheckCircle2 size={14} /> Guided seller workflow</span>
              <span><ShieldCheck size={14} /> Evidence-backed verification</span>
              <span><Images size={14} /> Catalog-ready imagery</span>
            </div>

            <div className="login-artboard" aria-hidden="true">
              <div className="login-sheet-card">
                <div className="login-sheet-thumb"><Images size={28} /></div>
                <div className="login-sheet-lines">
                  <strong>CATALOG PROOF / STYLE 028</strong>
                  <i /><i /><i />
                </div>
              </div>
              <div className="login-score-card">
                <small>Trust score</small>
                <strong>94%</strong>
                <span>● Ready to review</span>
              </div>
            </div>
          </div>
        </section>

        <section className="login-form-side">
          <div className="login-panel">
            <div className="login-panel-kicker">Myntra seller account</div>
            <h2>Sign in to Anchor Studio.</h2>
            <p className="login-panel-subtitle">
              Use your Myntra seller account to prepare, verify, and publish your next product story.
            </p>

            {error && (
              <div className="login-error" role="alert">
                <ShieldCheck size={15} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin}>
              <div className="login-input-group">
                <label className="login-input-label" htmlFor="seller-email">Email address</label>
                <input
                  id="seller-email"
                  type="email"
                  className="login-input"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="seller@myntra.com"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="login-input-group">
                <label className="login-input-label" htmlFor="seller-password">Password</label>
                <input
                  id="seller-password"
                  type={showPassword ? 'text' : 'password'}
                  className="login-input login-password-input"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(current => !current)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <button type="submit" className="login-submit" disabled={loading}>
                {loading ? 'Opening your workspace…' : <>Continue to studio <ArrowRight size={16} /></>}
              </button>
            </form>

            <div className="login-demo-note">
              <CheckCircle2 size={12} /> Demo credentials are ready to use
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
