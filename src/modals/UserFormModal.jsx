import { useState } from 'react'
import { createUser, updateUser } from '../services/userManagementService'

const ROLES = [
  { value: 'management',  label: 'Management' },
  { value: 'accounts',    label: 'Accounts' },
  { value: 'sales',       label: 'Sales' },
  { value: 'events',      label: 'Events' },
  { value: 'housekeeping', label: 'Housekeeping' },
]

export default function UserFormModal({ user, onClose, onSuccess }) {
  const isEdit = !!user
  const [form, setForm] = useState({
    username:     user?.username     || '',
    display_name: user?.display_name || '',
    role:         user?.role         || 'accounts',
    pin:          '',
    pin_confirm:  '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.username.trim()) return setError('Username is required')
    if (!form.display_name.trim()) return setError('Display name is required')
    if (!/^[a-z0-9_]+$/i.test(form.username.trim())) return setError('Username: letters, numbers and underscores only')
    if (!isEdit && !form.pin.trim()) return setError('PIN is required')
    if (form.pin && form.pin.length < 4) return setError('PIN must be at least 4 characters')
    if (form.pin && form.pin !== form.pin_confirm) return setError('PINs do not match')

    setSaving(true)
    try {
      if (isEdit) {
        await updateUser(user.id, form)
      } else {
        await createUser(form)
      }
      onSuccess(isEdit ? 'User updated' : 'User created')
    } catch (err) {
      setError(err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <div className="modal-header-content">
            <div className="modal-title">{isEdit ? 'Edit User' : 'Create User'}</div>
            <div className="modal-subtitle">{isEdit ? `Editing ${user.username}` : 'Add a new staff member'}</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && (
            <div style={{ background: '#fce4ec', color: '#c62828', padding: '8px 12px', borderRadius: 6, marginBottom: 16, fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          <form id="user-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                className="form-control"
                value={form.username}
                onChange={e => set('username', e.target.value)}
                placeholder="e.g. john_accounts"
                autoComplete="off"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Display Name</label>
              <input
                className="form-control"
                value={form.display_name}
                onChange={e => set('display_name', e.target.value)}
                placeholder="e.g. John Smith"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Role</label>
              <select
                className="form-control"
                value={form.role}
                onChange={e => set('role', e.target.value)}
              >
                {ROLES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">{isEdit ? 'New PIN' : 'PIN'} {isEdit && <span style={{ fontWeight: 400, color: '#aaa' }}>(leave blank to keep)</span>}</label>
                <input
                  className="form-control pin-input"
                  type="password"
                  value={form.pin}
                  onChange={e => set('pin', e.target.value)}
                  placeholder="••••"
                  maxLength={8}
                  autoComplete="new-password"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Confirm PIN</label>
                <input
                  className="form-control pin-input"
                  type="password"
                  value={form.pin_confirm}
                  onChange={e => set('pin_confirm', e.target.value)}
                  placeholder="••••"
                  maxLength={8}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </form>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" form="user-form" type="submit" disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  )
}
