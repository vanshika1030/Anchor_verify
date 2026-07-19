import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';
import { LogIn } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('seller@myntra.com');
  const [password, setPassword] = useState('demo123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const { login } = useApp();
  const navigate = useNavigate();

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
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #ff3f6c 0%, #f77062 100%)',
      padding: '20px'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        borderRadius: '16px',
        padding: '40px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
        border: '1px solid rgba(255, 255, 255, 0.2)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: '800', 
            color: '#282c3f',
            marginBottom: '8px'
          }}>
            Welcome to <span style={{ color: '#ff3f6c' }}>Anchor</span>
          </h1>
          <p style={{ color: '#94969f', fontSize: '14px', fontWeight: '500' }}>
            Myntra Seller Verification Portal
          </p>
        </div>

        {error && (
          <div style={{
            background: 'var(--danger-bg)',
            border: '1px solid var(--danger-border)',
            color: 'var(--danger)',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '20px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label" style={{ color: '#282c3f' }}>Email Address</label>
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              style={{ padding: '12px', fontSize: '14px' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label" style={{ color: '#282c3f' }}>Password</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              style={{ padding: '12px', fontSize: '14px' }}
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
            style={{ 
              width: '100%', 
              padding: '12px', 
              fontSize: '15px',
              borderRadius: '8px',
              background: 'linear-gradient(to right, #ff3f6c, #f77062)',
              border: 'none'
            }}
          >
            {loading ? <span className="spinner"></span> : <><LogIn size={18} /> Sign In</>}
          </button>
        </form>

        <div style={{
          marginTop: '24px',
          textAlign: 'center',
          fontSize: '12px',
          color: '#94969f',
          padding: '12px',
          background: '#f5f5f6',
          borderRadius: '6px'
        }}>
          Demo Credentials:<br/>
          <strong>seller@myntra.com</strong> / <strong>demo123</strong>
        </div>
      </div>
    </div>
  );
}
