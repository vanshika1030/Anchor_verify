import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './AppContext'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewListing from './pages/NewListing'
import Upload from './pages/Upload'
import Details from './pages/Details'
import Verify from './pages/Verify'
import Success from './pages/Success'
import ProductView from './pages/ProductView'
import AuthGuard from './components/AuthGuard'
import './index.css'

function Breadcrumb() {
  const loc = useLocation()
  const map = {
    '/dashboard': 'Dashboard',
    '/new-listing': 'New Listing',
    '/new-listing/upload': 'Upload',
    '/new-listing/details': 'Details',
    '/new-listing/verify': 'Verification',
    '/new-listing/success': 'Published',
  }
  return (
    <div className="breadcrumb">
      Cataloging / <b>{map[loc.pathname] || 'Anchor'}</b>
    </div>
  )
}

function Layout() {
  const { isAuthenticated, logout, seller } = useApp()
  const loc = useLocation()
  
  if (!isAuthenticated && loc.pathname === '/login') {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
      </Routes>
    )
  }

  return (
    <div className="layout">
      {isAuthenticated && <Sidebar />}
      <div className="main">
        {isAuthenticated && (
          <header className="top-bar">
            <Breadcrumb />
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: '500' }}>
                {seller?.business_name || 'Seller'}
              </div>
              <button 
                onClick={logout}
                className="btn btn-ghost btn-sm"
                style={{ color: 'var(--text-secondary)' }}
              >
                Logout
              </button>
            </div>
          </header>
        )}
        <div className="content">
          <Routes>
            <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
            <Route path="/new-listing" element={<AuthGuard><NewListing /></AuthGuard>} />
            <Route path="/new-listing/upload" element={<AuthGuard><Upload /></AuthGuard>} />
            <Route path="/new-listing/details" element={<AuthGuard><Details /></AuthGuard>} />
            <Route path="/new-listing/verify" element={<AuthGuard><Verify /></AuthGuard>} />
            <Route path="/new-listing/success" element={<AuthGuard><Success /></AuthGuard>} />
            <Route path="/verify" element={<AuthGuard><Verify /></AuthGuard>} />
            <Route path="/publish" element={<AuthGuard><Success /></AuthGuard>} />
            <Route path="/product/:id" element={<ProductView />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Layout />
      </BrowserRouter>
    </AppProvider>
  )
}
