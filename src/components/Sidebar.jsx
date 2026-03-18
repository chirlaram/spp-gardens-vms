import { NavLink } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const NAV_ITEMS = [
  { to: '/dashboard', icon: '⊞', label: 'Dashboard', perm: 'dashboard' },
  { to: '/calendar', icon: '⊟', label: 'Calendar', perm: 'view_all' },
  { to: '/payments', icon: '₹', label: 'Payments', perm: 'payment' },
  { to: '/cancelled', icon: '✕', label: 'Cancelled', perm: 'view_all' },
]

// Special nav for housekeeping: only kitchen view
const HOUSEKEEPING_NAV = [
  { to: '/calendar', icon: '⊟', label: 'Kitchen View', perm: 'view_kitchen' },
]

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout, hasPermission } = useAuth()

  const navItems = user?.role === 'housekeeping' ? HOUSEKEEPING_NAV : NAV_ITEMS

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'open' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <img src="/spp-logo.webp" alt="SPP Gardens" style={{ width: '100%', maxWidth: 180, objectFit: 'contain', display: 'block', margin: '0 auto 6px' }} />
          <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Venue Management</span>
        </div>

        <nav className="sidebar-nav">
          {navItems
            .filter(item => hasPermission(item.perm))
            .map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
              </NavLink>
            ))}
        </nav>

        <div className="sidebar-footer">
          {user && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: 2 }}>
                Signed in as
              </div>
              <div style={{ fontSize: '0.875rem', color: '#fff', fontWeight: 500 }}>
                {user.displayName}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', textTransform: 'capitalize' }}>
                {user.role}
              </div>
            </div>
          )}
          <button className="logout-btn" onClick={() => { logout(); onClose() }}>
            <span>⊗</span> Sign Out
          </button>
        </div>
      </aside>
    </>
  )
}
