import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Package, ShieldCheck, AlertTriangle, XCircle } from 'lucide-react';
import { useApp } from '../AppContext';

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { seller } = useApp();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/products', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error('Failed to fetch products', err);
    } finally {
      setLoading(false);
    }
  };

  const renderBadge = (status) => {
    const s = (status || '').toLowerCase();
    if (s === 'pass' || s === 'verified') {
      return (
        <div className="badge badge-pass" style={{ position: 'absolute', top: 8, right: 8 }}>
          <ShieldCheck size={12} /> PASS
        </div>
      );
    }
    if (s === 'warning') {
      return (
        <div className="badge badge-warn" style={{ position: 'absolute', top: 8, right: 8 }}>
          <AlertTriangle size={12} /> WARNING
        </div>
      );
    }
    return (
      <div className="badge badge-fail" style={{ position: 'absolute', top: 8, right: 8 }}>
        <XCircle size={12} /> FAIL
      </div>
    );
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      {/* Hero Section */}
      <div style={{
        background: 'linear-gradient(135deg, #282c3f 0%, #1a1d26 100%)',
        borderRadius: '16px',
        padding: '40px',
        color: 'white',
        marginBottom: '32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 10px 30px rgba(40, 44, 63, 0.15)'
      }}>
        <div style={{ maxWidth: '600px' }}>
          <h1 style={{ fontSize: '28px', fontWeight: '700', marginBottom: '12px' }}>
            Welcome back, {seller?.business_name || 'Seller'}!
          </h1>
          <p style={{ fontSize: '15px', color: '#9CA0AE', lineHeight: '1.6', marginBottom: '0' }}>
            Anchor is your intelligent cataloging assistant. Generate automated Myntra listings from simple photos, or upload your existing catalog for AI-powered verification against brand guidelines.
          </p>
        </div>
        <div>
          <button 
            onClick={() => navigate('/new-listing')}
            className="btn btn-primary"
            style={{ 
              padding: '14px 28px', 
              fontSize: '16px', 
              background: 'linear-gradient(to right, #ff3f6c, #f77062)',
              border: 'none',
              boxShadow: '0 4px 15px rgba(255, 63, 108, 0.3)'
            }}
          >
            <Plus size={20} /> Add New Listing
          </button>
        </div>
      </div>

      {/* Listings Section */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#282c3f', marginBottom: '4px' }}>
            My Listings
          </h2>
          <p style={{ color: '#5F6477', fontSize: '14px', margin: 0 }}>Manage and track your catalog uploads</p>
        </div>
        <div style={{ position: 'relative', width: '300px' }}>
          <input 
            type="text" 
            className="form-input" 
            placeholder="Search listings..." 
            style={{ width: '100%', padding: '10px 16px', borderRadius: '8px', border: '1px solid #E2E4EA' }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px' }}>
          <div className="spinner spin" style={{ width: '32px', height: '32px', borderTopColor: 'var(--accent)' }}></div>
        </div>
      ) : products.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
          {products.map(product => (
            <div key={product.id} className="card" onClick={() => navigate(`/product/${product.id}`)} style={{ padding: '0', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s' }}>
              <div style={{ position: 'relative', aspectRatio: '3/4', backgroundColor: '#f5f5f6' }}>
                <img 
                  src={product.anchor_image_url || 'https://via.placeholder.com/300x400?text=No+Image'} 
                  alt={product.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {renderBadge(product.verification_status || 'pass')}
              </div>
              <div style={{ padding: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {product.title}
                </h3>
                <div style={{ fontSize: '12px', color: '#5F6477', marginBottom: '12px' }}>
                  {product.category || 'Apparel'}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#282c3f' }}>
                    ₹{product.selling_price || product.mrp || '999'}
                  </div>
                  <button 
                    className="btn btn-outline" 
                    style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '4px' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/product/${product.id}`);
                    }}
                  >
                    View
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          background: 'white',
          borderRadius: '16px',
          border: '1px dashed #E2E4EA'
        }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#F7F8FA', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Package size={32} color="#9CA0AE" />
          </div>
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>No listings yet</h3>
          <p style={{ color: '#5F6477', fontSize: '14px', marginBottom: '24px' }}>
            You haven't uploaded any products to your catalog yet.
          </p>
          <button onClick={() => navigate('/new-listing')} className="btn btn-outline">
            Add Your First Listing
          </button>
        </div>
      )}
    </div>
  );
}
