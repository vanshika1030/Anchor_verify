import { useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Package, PlusCircle, BarChart3, CreditCard, Settings, ShieldCheck } from 'lucide-react'
import { useApp } from '../AppContext'

const NAV = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Package, label: 'My Listings', path: null },
  { icon: PlusCircle, label: 'Add New Listing', path: '/new-listing' },
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
        <h1><span>m</span>yntra</h1>
        <p>Partner Portal</p>
      </div>

      <nav className="sidebar-nav">
        {NAV.map(item => {
          const Icon = item.icon
          const active = item.path && (item.path === '/new-listing' ? isNew : loc.pathname === item.path)
          return (
            <div
              key={item.label}
              className={`nav-link ${active ? 'active' : ''} ${!item.path ? 'disabled' : ''}`}
              onClick={() => item.path && nav(item.path)}
            >
              <Icon className="icon" size={16} />
              {item.label}
            </div>
          )
        })}

        <div className="nav-section">Quality tools</div>

        <div
          className={`nav-link ${loc.pathname === '/verify' ? 'active' : ''}`}
          onClick={() => nav('/verify')}
        >
          <ShieldCheck className="icon" size={16} />
          Anchor Verification
          <span className="nav-badge">New</span>
        </div>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-avatar">{seller?.business_name?.substring(0, 2).toUpperCase() || 'SK'}</div>
        <div>
          <div className="sidebar-user-name">{seller?.business_name || 'StyleKraft'}</div>
          <div className="sidebar-user-role">Seller account</div>
        </div>
      </div>
    </aside>
  )
}
