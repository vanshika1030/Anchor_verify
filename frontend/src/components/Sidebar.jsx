import { useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Package, PlusCircle, BarChart3, CreditCard, Settings, ShieldCheck, Anchor, Sparkles } from 'lucide-react'
import { useApp } from '../AppContext'

const NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Package, label: 'My Listings', path: null },
  { icon: PlusCircle, label: 'Create Listing', path: '/new-listing' },
  { icon: BarChart3, label: 'Analytics', path: null },
  { icon: CreditCard, label: 'Payments', path: null },
  { icon: Settings, label: 'Settings', path: null },
]

export default function Sidebar() {
  const loc = useLocation()
  const nav = useNavigate()
  const { seller } = useApp()
  const isNew = loc.pathname.startsWith('/new-listing')

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">
          <Anchor size={22} />
        </div>
        <div className="sidebar-brand-copy">
          <h1>Anchor <span>Studio</span></h1>
          <p>Seller workspace</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(item => {
          const Icon = item.icon
          const active = item.path && (item.path === '/new-listing' ? isNew : loc.pathname === item.path)
          return (
            <button
              type="button"
              key={item.label}
              className={`nav-link ${active ? 'active' : ''} ${!item.path ? 'disabled' : ''}`}
              onClick={() => item.path && nav(item.path)}
              disabled={!item.path}
              aria-current={active ? 'page' : undefined}
            >
              <Icon className="icon" size={16} />
              <span className="nav-label">{item.label}</span>
            </button>
          )
        })}

        <div className="nav-section">Quality tools</div>

        <button
          type="button"
          className={`nav-link ${loc.pathname === '/anchor-intro' ? 'active' : ''}`}
          onClick={() => nav('/anchor-intro')}
          aria-current={loc.pathname === '/anchor-intro' ? 'page' : undefined}
        >
          <ShieldCheck className="icon" size={16} />
          <span className="nav-label">Anchor Verification</span>
          <span className="nav-badge">New</span>
        </button>
      </nav>

      <div className="sidebar-insight">
        <Sparkles size={15} />
        <div>
          <strong>Quality, made simple</strong>
          <span>Proof-backed listings shoppers can trust.</span>
        </div>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-avatar">{seller?.business_name?.substring(0, 2).toUpperCase() || 'SK'}</div>
        <div className="sidebar-user-meta">
          <div className="sidebar-user-name">{seller?.business_name || 'StyleKraft'}</div>
          <div className="sidebar-user-role">Seller account</div>
        </div>
      </div>
    </aside>
  )
}
