import React, { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Sidebar from './components/Sidebar'
import LoginScreen from './components/LoginScreen'
import Toast from './components/Toast'
import LoadingOverlay from './components/LoadingOverlay'
import Dashboard from './pages/Dashboard'
import Calendar from './pages/Calendar'
import Payments from './pages/Payments'
import Cancelled from './pages/Cancelled'

export const ToastContext = React.createContext(null)

function App() {
  const { user, loading, hasPermission } = useAuth()
  const [toast, setToast] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  if (loading) return <LoadingOverlay />

  if (!user) return (
    <ToastContext.Provider value={showToast}>
      <LoginScreen />
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </ToastContext.Provider>
  )

  return (
    <ToastContext.Provider value={showToast}>
      <div className="app-layout">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="main-area">
          <div className="topbar">
            <button
              className="hamburger"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <span /><span /><span />
            </button>
            <div className="topbar-title">SPP Gardens</div>
            <div className="topbar-user">
              <span className="user-role-badge">{user.role}</span>
              <span className="user-name">{user.displayName}</span>
            </div>
          </div>
          <div className="page-content">
            <Routes>
              <Route path="/" element={<Navigate to={hasPermission('dashboard') ? '/dashboard' : '/calendar'} replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/calendar" element={
                hasPermission('view_all') || hasPermission('view_kitchen')
                  ? <Calendar />
                  : <Navigate to="/dashboard" replace />
              } />
              <Route path="/payments" element={
                hasPermission('payment') ? <Payments /> : <Navigate to="/dashboard" replace />
              } />
              <Route path="/cancelled" element={
                hasPermission('view_all') ? <Cancelled /> : <Navigate to="/dashboard" replace />
              } />
              <Route path="*" element={<Navigate to={hasPermission('dashboard') ? '/dashboard' : '/calendar'} replace />} />
            </Routes>
          </div>
        </div>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </ToastContext.Provider>
  )
}

export default App
