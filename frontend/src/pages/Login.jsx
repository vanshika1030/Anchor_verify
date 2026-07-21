import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { LogIn, ShieldCheck, Sparkles, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('seller@myntra.com');
  const [password, setPassword] = useState('demo123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const { login } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    setTimeout(() => setMounted(true), 100);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }
      
      login(data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes login-gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes login-float-1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -40px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
        @keyframes login-float-2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(-40px, 30px) scale(1.05); }
          66% { transform: translate(25px, -35px) scale(0.9); }
        }
        @keyframes login-float-3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(20px, -20px) scale(1.08); }
        }
        .login-input:focus {
          border-color: #ff3f6c !important;
          box-shadow: 0 0 0 3px rgba(255, 63, 108, 0.1) !important;
          outline: none;
        }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 25px rgba(255, 63, 108, 0.35) !important;
        }
        .login-btn:active:not(:disabled) {
          transform: translateY(0);
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(-45deg, #1a1d26, #282c3f, #3a1c3b, #1e293b, #282c3f)',
        backgroundSize: '400% 400%',
        animation: 'login-gradient-shift 15s ease infinite',
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Floating gradient orbs */}
        <div style={{
          position: 'absolute', width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 63, 108, 0.15) 0%, transparent 70%)',
          top: '-10%', right: '-5%', animation: 'login-float-1 18s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', width: '350px', height: '350px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(168, 85, 247, 0.12) 0%, transparent 70%)',
          bottom: '-5%', left: '-5%', animation: 'login-float-2 22s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', width: '250px', height: '250px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.1) 0%, transparent 70%)',
          top: '40%', left: '30%', animation: 'login-float-3 15s ease-in-out infinite',
          pointerEvents: 'none',
        }} />

        {/* Login Card */}
        <div style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '24px',
          padding: '48px 40px',
          width: '100%',
          maxWidth: '440px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          position: 'relative',
          zIndex: 10,
          opacity: mounted ? 1 : 0,
          transform: mounted ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.96)',
          transition: 'opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
          {/* Myntra Logo */}
          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            <span style={{
              fontSize: '20px', fontWeight: '800', letterSpacing: '6px',
              color: '#282c3f', fontFamily: "'Inter', sans-serif",
            }}>MYNTRA</span>
          </div>

          {/* Anchor Verify Branding */}
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                width: '44px', height: '44px',
                background: 'linear-gradient(135deg, #ff3f6c, #f77062)',
                borderRadius: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 15px rgba(255, 63, 108, 0.3)',
              }}>
                <ShieldCheck size={24} color="#fff" />
              </div>
              <div>
                <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#282c3f', margin: 0, lineHeight: 1.2 }}>
                  Anchor <span style={{
                    background: 'linear-gradient(135deg, #ff3f6c, #f77062)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                  }}>Verify</span>
                </h1>
              </div>
            </div>
          </div>

          <p style={{ color: '#94969f', fontSize: '14px', fontWeight: '500', textAlign: 'center', marginBottom: '32px' }}>
            Seller Verification Portal
          </p>

          {/* Feature pills */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '28px', flexWrap: 'wrap' }}>
            {[
              { icon: <ShieldCheck size={12} />, text: '5-Layer AI' },
              { icon: <Sparkles size={12} />, text: 'Catalog Gen' },
              { icon: <Eye size={12} />, text: 'Zero API Verify' },
            ].map((pill, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '4px 10px', borderRadius: '100px',
                background: 'rgba(255, 63, 108, 0.06)',
                border: '1px solid rgba(255, 63, 108, 0.12)',
                fontSize: '11px', fontWeight: '600', color: '#ff3f6c',
              }}>
                {pill.icon} {pill.text}
              </div>
            ))}
          </div>

          {error && (
            <div style={{
              background: 'rgba(220, 38, 38, 0.06)', border: '1px solid rgba(220, 38, 38, 0.15)',
              color: '#dc2626', padding: '12px 16px', borderRadius: '10px',
              fontSize: '13px', marginBottom: '20px', textAlign: 'center', fontWeight: '500',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '18px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#282c3f', marginBottom: '6px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Email</label>
              <input className="login-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" required
                style={{ width: '100%', padding: '13px 16px', fontSize: '14px', border: '1.5px solid #e2e4ea', borderRadius: '10px', background: '#f8f9fb', color: '#282c3f', fontFamily: "'Inter', sans-serif", transition: 'all 0.2s ease', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#282c3f', marginBottom: '6px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input className="login-input" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required
                  style={{ width: '100%', padding: '13px 48px 13px 16px', fontSize: '14px', border: '1.5px solid #e2e4ea', borderRadius: '10px', background: '#f8f9fb', color: '#282c3f', fontFamily: "'Inter', sans-serif", transition: 'all 0.2s ease', boxSizing: 'border-box' }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#94969f', display: 'flex' }}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" className="login-btn" disabled={loading}
              style={{
                width: '100%', padding: '14px', fontSize: '15px', fontWeight: '700', borderRadius: '12px',
                background: 'linear-gradient(135deg, #ff3f6c 0%, #f77062 100%)',
                border: 'none', color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: '0 4px 15px rgba(255, 63, 108, 0.25)', transition: 'all 0.3s ease',
                fontFamily: "'Inter', sans-serif", letterSpacing: '0.3px', opacity: loading ? 0.7 : 1,
              }}>
              {loading ? <span className="spinner" style={{ width: '18px', height: '18px' }}></span> : <><LogIn size={18} /> Sign In to Seller Portal</>}
            </button>
          </form>

          <div style={{ marginTop: '28px', textAlign: 'center', paddingTop: '20px', borderTop: '1px solid #f0f1f4' }}>
            <p style={{ fontSize: '12px', color: '#94969f', margin: 0 }}>
              Powered by <span style={{ fontWeight: '700', color: '#282c3f' }}>Anchor AI</span> — Myntra Seller Tools
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
