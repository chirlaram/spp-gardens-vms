import { useState } from 'react'
import SlotBuilder from '../components/SlotBuilder'
import { postponeBooking } from '../services/bookingService'
import { todayISO } from '../utils/formatters'

export default function PostponeModal({ booking, onClose, onSuccess, user, bookings }) {
  const existingSlots = (booking.booking_slots || []).map(s => ({
    date: s.date,
    slot: s.slot,
    venues: s.venues || [],
    kitchen: s.kitchen || '',
  }))

  const [slots, setSlots] = useState(existingSlots)
  const [reason, setReason] = useState('')
  const [dateChangeFee, setDateChangeFee] = useState({ amount: '', date: todayISO(), mode: 'cash', reference: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (!reason.trim()) { setError('Please provide a reason for postponement'); return }
    const validSlots = slots.filter(s => s.date && (s.venues.length > 0 || s.kitchen))
    if (validSlots.length === 0) { setError('At least one slot with venues/kitchen is required'); return }

    setLoading(true)
    setError('')
    try {
      await postponeBooking(booking.id, {
        newSlots: validSlots,
        reason: reason.trim(),
        dateChangeFee: dateChangeFee.amount ? {
          amount: Number(dateChangeFee.amount),
          date: dateChangeFee.date,
          mode: dateChangeFee.mode,
          reference: dateChangeFee.reference,
        } : null,
      }, user.id)
      onSuccess(booking.id)
    } catch (err) {
      setError(err.message || 'Failed to postpone booking')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="modal-header-content">
            <div className="modal-title">Postpone Booking</div>
            <div className="modal-subtitle">{booking.client} — {booking.event}</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

            <div className="form-group">
              <label className="form-label">Reason for Postponement *</label>
              <textarea
                className="form-control"
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Why is the booking being postponed?"
                rows={2}
                required
                autoFocus
              />
            </div>

            <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--forest)', marginBottom: 12, fontSize: '1rem' }}>
              New Dates
            </h4>
            <SlotBuilder
              slots={slots}
              onChange={setSlots}
              bookings={bookings}
              excludeBookingId={booking.id}
            />

            <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--forest)', marginBottom: 12, marginTop: 16, fontSize: '1rem' }}>
              Date Change Fee (Optional)
            </h4>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Amount (₹)</label>
                <input
                  className="form-control"
                  type="number"
                  value={dateChangeFee.amount}
                  onChange={e => setDateChangeFee(p => ({ ...p, amount: e.target.value }))}
                  placeholder="0"
                  min="0"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input
                  className="form-control"
                  type="date"
                  value={dateChangeFee.date}
                  onChange={e => setDateChangeFee(p => ({ ...p, date: e.target.value }))}
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Mode</label>
                <select className="form-control" value={dateChangeFee.mode} onChange={e => setDateChangeFee(p => ({ ...p, mode: e.target.value }))}>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Reference</label>
                <input
                  className="form-control"
                  value={dateChangeFee.reference}
                  onChange={e => setDateChangeFee(p => ({ ...p, reference: e.target.value }))}
                  placeholder="Optional reference"
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Postpone Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
