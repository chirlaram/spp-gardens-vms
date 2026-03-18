import { useState } from 'react'
import { cancelBooking } from '../services/bookingService'

export default function CancelModal({ booking, onClose, onSuccess, user, onPatch }) {
  const [reason, setReason] = useState('')
  const [advanceForfeited, setAdvanceForfeited] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!reason.trim()) { setError('Please provide a cancellation reason'); return }
    setLoading(true)
    setError('')
    // Optimistic: immediately mark as cancelled in the list
    onPatch?.(booking.id, { status: 'Cancelled' })
    try {
      await cancelBooking(booking.id, { reason: reason.trim(), advanceForfeited }, user.id)
      onSuccess(booking.id)
    } catch (err) {
      // Rollback
      onPatch?.(booking.id, { status: booking.status })
      setError(err.message || 'Failed to cancel booking')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <div className="modal-header-content">
            <div className="modal-title">Cancel Booking</div>
            <div className="modal-subtitle">{booking.client} — {booking.event}</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ background: '#fce4ec', border: '1px solid #f48fb1', borderRadius: 'var(--radius-sm)', padding: 12, marginBottom: 16, fontSize: '0.85rem', color: '#880e4f' }}>
              ⚠ This action will permanently cancel the booking. This cannot be undone.
            </div>
            {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}
            <div className="form-group">
              <label className="form-label">Cancellation Reason *</label>
              <textarea
                className="form-control"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Reason for cancellation..."
                rows={3}
                required
                autoFocus
              />
            </div>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={advanceForfeited}
                onChange={e => setAdvanceForfeited(e.target.checked)}
              />
              Advance is forfeited (non-refundable)
            </label>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Go Back</button>
            <button type="submit" className="btn btn-danger" disabled={loading}>
              {loading ? 'Cancelling…' : 'Confirm Cancellation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
