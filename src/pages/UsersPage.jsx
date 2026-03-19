import { useState, useEffect, useContext } from 'react'
import { useAuth } from '../hooks/useAuth'
import { getUsers, deleteUser } from '../services/userManagementService'
import UserFormModal from '../modals/UserFormModal'
import { ToastContext } from '../App'

const ROLE_COLORS = {
  management:  { bg: '#f0faf0', color: '#166534', border: '#86efac' },
  accounts:    { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
  sales:       { bg: '#fef9c3', color: '#854d0e', border: '#fde68a' },
  events:      { bg: '#fdf4ff', color: '#6b21a8', border: '#e9d5ff' },
  housekeeping:{ bg: '#fff7ed', color: '#9a3412', border: '#fed7aa' },
}

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const showToast = useContext(ToastContext)
  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [modal, setModal]       = useState(null) // null | { type: 'create' } | { type: 'edit', user }
  const [deleting, setDeleting] = useState(null)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setUsers(await getUsers())
    } catch (err) {
      setError(err.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleDelete(u) {
    if (u.id === currentUser.id) {
      showToast("You can't delete your own account", 'error')
      return
    }
    if (!window.confirm(`Delete user "${u.display_name}" (${u.username})? This cannot be undone.`)) return
    setDeleting(u.id)
    try {
      await deleteUser(u.id)
      showToast('User deleted', 'success')
      setUsers(prev => prev.filter(x => x.id !== u.id))
    } catch (err) {
      showToast(err.message || 'Failed to delete', 'error')
    } finally {
      setDeleting(null)
    }
  }

  function handleSuccess(msg) {
    showToast(msg, 'success')
    setModal(null)
    load()
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
      <div className="spinner" style={{ margin: '0 auto 12px', width: 32, height: 32, borderWidth: 3 }} />
      Loading…
    </div>
  )

  if (error) return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚠</div>
      <div style={{ color: '#c62828', fontWeight: 600, marginBottom: 8 }}>Failed to load users</div>
      <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: 20 }}>{error}</div>
      <button className="btn btn-primary" onClick={load}>Retry</button>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>User Management</h2>
          <div className="page-header-sub">{users.length} staff account{users.length !== 1 ? 's' : ''}</div>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({ type: 'create' })}>
          + Add User
        </button>
      </div>

      {users.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👤</div>
          <div className="empty-state-text">No users yet</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table" style={{ marginBottom: 0 }}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Username</th>
                <th>Role</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => {
                const rc = ROLE_COLORS[u.role] || ROLE_COLORS.accounts
                const isSelf = u.id === currentUser.id
                return (
                  <tr key={u.id} style={isSelf ? { background: '#f9fbf9' } : {}}>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--forest)' }}>{u.display_name}</div>
                      {isSelf && <div style={{ fontSize: '0.72rem', color: '#aaa' }}>You</div>}
                    </td>
                    <td style={{ color: '#555', fontFamily: 'monospace', fontSize: '0.88rem' }}>
                      {u.username}
                    </td>
                    <td>
                      <span style={{
                        padding: '2px 10px', borderRadius: 10, fontSize: '0.75rem', fontWeight: 600,
                        background: rc.bg, color: rc.color, border: `1px solid ${rc.border}`,
                        textTransform: 'capitalize',
                      }}>
                        {u.role}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => setModal({ type: 'edit', user: u })}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm"
                          style={{ background: '#fce4ec', color: '#c62828', border: '1px solid #f48fb1' }}
                          onClick={() => handleDelete(u)}
                          disabled={deleting === u.id || isSelf}
                          title={isSelf ? "Can't delete your own account" : 'Delete user'}
                        >
                          {deleting === u.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {(modal?.type === 'create' || modal?.type === 'edit') && (
        <UserFormModal
          user={modal.type === 'edit' ? modal.user : null}
          onClose={() => setModal(null)}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  )
}
