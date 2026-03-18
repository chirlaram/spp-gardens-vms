import { useState, useContext } from 'react'
import { useAuth } from '../hooks/useAuth'
import { ToastContext } from '../App'

export default function LoginScreen() {
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { login } = useAuth()
  const showToast = useContext(ToastContext)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!username.trim() || !pin.trim()) {
      setError('Please enter both username and PIN')
      return
    }
    setLoading(true)
    setError('')
    try {
      await login(username, pin)
      showToast && showToast('Welcome back!', 'success')
    } catch (err) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img src="/spp-logo-dark.webp" alt="SPP Gardens" style={{ width: '100%', maxWidth: 220, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
          <p>Venue Management System</p>
        </div>
        {error && <div className="login-error">{error}</div>}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              type="text"
              className="form-control"
              placeholder="Enter your username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label className="form-label">PIN</label>
            <input
              type="password"
              className="form-control pin-input"
              placeholder="••••"
              value={pin}
              onChange={e => setPin(e.target.value)}
              maxLength={8}
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={loading}
            style={{ marginTop: '8px' }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.75rem', color: '#bbb' }}>
          SPP Gardens · Venue Management
        </p>
      </div>
    </div>
  )
}
