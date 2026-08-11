import React, { useEffect, Component } from 'react'
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { AppProvider, useApp } from './AppContext'
import Sidebar from './components/Sidebar'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewListing from './pages/NewListing'
import Verify from './pages/Verify'
import Success from './pages/Success'
import ProductView from './pages/ProductView'
import CitizenView from './pages/CitizenView'
import AnchorIntro from './pages/AnchorIntro'
import AuthGuard from './components/AuthGuard'
import './index.css'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
    this.setState({ errorInfo })
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: 'Inter, sans-serif', maxWidth: 700, margin: '0 auto' }}>
          <h2 style={{ color: '#e53e3e' }}>⚠️ Something went wrong</h2>
          <pre style={{ background: '#1a1a2e', color: '#ff6b6b', padding: 20, borderRadius: 8, overflow: 'auto', fontSize: 13, lineHeight: 1.6 }}>
            {this.state.error?.toString()}
            {'\n\n'}
            {this.state.errorInfo?.componentStack}
          </pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '10px 24px', background: '#ff3f6c', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}


function Breadcrumb() {
  const loc = useLocation()
  const map = {
    '/dashboard': { title: 'Overview', subtitle: 'Your catalog at a glance' },
    '/new-listing': { title: 'Create listing', subtitle: 'Build a trusted product page' },
    '/new-listing/verify': { title: 'Verification', subtitle: 'Review catalog evidence' },
    '/new-listing/success': { title: 'Published', subtitle: 'Listing sent for quality review' },
    '/verify': { title: 'Verification', subtitle: 'Review catalog evidence' },
    '/anchor-intro': { title: 'Anchor intelligence', subtitle: 'How product trust is built' },
    '/publish': { title: 'Published', subtitle: 'Listing sent for quality review' },
  }
  const page = map[loc.pathname] || { title: 'Anchor Verify', subtitle: 'Listing verification' }

  return (
    <div className="breadcrumb">
      <span className="breadcrumb-overline">Anchor Verify</span>
      <span className="breadcrumb-copy">
        <b>{page.title}</b>
        <span>{page.subtitle}</span>
      </span>
    </div>
  )
}

function Layout() {
  const { isAuthenticated, logout, seller } = useApp()
  const loc = useLocation()
  const isCitizenRoute = loc.pathname.startsWith('/myntra') || loc.pathname.startsWith('/product/')

  useEffect(() => {
    const content = document.querySelector('.seller-shell .content')
    if (content) content.scrollTop = 0
    document.title = isCitizenRoute
      ? 'Anchor — Myntra Partner Portal'
      : 'Anchor Verify — Myntra Listing Verification'
  }, [isCitizenRoute, loc.pathname])

  if (!isAuthenticated && loc.pathname === '/login') {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
      </Routes>
    )
  }

  return (
    <div className={isCitizenRoute ? '' : 'layout seller-shell'}>
      {isAuthenticated && !isCitizenRoute && <Sidebar />}
      <div className={isCitizenRoute ? '' : 'main'}>
        {isAuthenticated && !isCitizenRoute && (
          <header className="top-bar">
            <Breadcrumb />
            <div className="topbar-actions">
              <div className="sync-pill" aria-label="Catalog services online">
                <span className="sync-dot" /> Catalog sync live
              </div>
              <div className="topbar-user">
                <div className="topbar-avatar">
                  {(seller?.business_name || 'Seller').substring(0, 2).toUpperCase()}
                </div>
                <div className="topbar-user-name" style={{ fontSize: '12px', fontWeight: '700' }}>
                  {seller?.business_name || 'Seller'}
                </div>
              </div>
              <button 
                onClick={logout}
                className="btn btn-ghost btn-sm topbar-logout"
              >
                Sign out
              </button>
            </div>
          </header>
        )}
        <div className={isCitizenRoute ? '' : 'content'}>
          <Routes>
            <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
            <Route path="/myntra" element={<CitizenView />} />
            <Route path="/myntra/:id" element={<CitizenView />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
            <Route path="/new-listing" element={<AuthGuard><NewListing /></AuthGuard>} />
            <Route path="/new-listing/verify" element={<AuthGuard><Verify /></AuthGuard>} />
            <Route path="/new-listing/success" element={<AuthGuard><Success /></AuthGuard>} />
            <Route path="/verify" element={<AuthGuard><Verify /></AuthGuard>} />
            <Route path="/anchor-intro" element={<AuthGuard><AnchorIntro /></AuthGuard>} />
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
    <ErrorBoundary>
      <AppProvider>
        <BrowserRouter>
          <Layout />
        </BrowserRouter>
      </AppProvider>
    </ErrorBoundary>
  )
}
