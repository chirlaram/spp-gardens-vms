import { useState } from 'react'
import { updateCommitments } from '../services/bookingService'

export default function CommitmentsModal({ booking, onClose, onSuccess, user }) {
  const existing = (booking.commitments || [])[0] || {}

  const [form, setForm] = useState({
    extra_services: existing.extra_services || '',
    discount: existing.discount || '',
    discount_note: existing.discount_note || '',
    food_promises: existing.food_promises || '',
    venue_arrangements: existing.venue_arrangements || '',
    timing_access: existing.timing_access || '',
    complimentary_rooms: existing.complimentary_rooms || '',
    other_notes: existing.other_notes || '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function setField(f, v) {
    setForm(prev => ({ ...prev, [f]: v }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const saved = await updateCommitments(booking.id, {
        extra_services: form.extra_services,
        discount: Number(form.discount) || 0,
        discount_note: form.discount_note,
        food_promises: form.food_promises,
        venue_arrangements: form.venue_arrangements,
        timing_access: form.timing_access,
        complimentary_rooms: form.complimentary_rooms,
        other_notes: form.other_notes,
      }, user.id)
      onSuccess(booking.id, saved)
    } catch (err) {
      setError(err.message || 'Failed to save commitments')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="modal-header-content">
            <div className="modal-title">Commitments & Notes</div>
            <div className="modal-subtitle">{booking.client} — {booking.event}</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <div className="form-group">
                  <label className="form-label">Extra Services</label>
                  <textarea className="form-control" value={form.extra_services} onChange={e => setField('extra_services', e.target.value)} placeholder="Additional services promised..." rows={3} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Discount (₹)</label>
                    <input className="form-control" type="number" value={form.discount} onChange={e => setField('discount', e.target.value)} min="0" placeholder="0" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Discount Note</label>
                    <input className="form-control" value={form.discount_note} onChange={e => setField('discount_note', e.target.value)} placeholder="Why discount?" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Food Promises</label>
                  <textarea className="form-control" value={form.food_promises} onChange={e => setField('food_promises', e.target.value)} placeholder="Food items promised, menu commitments..." rows={3} />
                </div>
                <div className="form-group">
                  <label className="form-label">Venue Arrangements</label>
                  <textarea className="form-control" value={form.venue_arrangements} onChange={e => setField('venue_arrangements', e.target.value)} placeholder="Stage, seating, decoration specifics..." rows={3} />
                </div>
              </div>
              <div>
                <div className="form-group">
                  <label className="form-label">Timing & Access</label>
                  <textarea className="form-control" value={form.timing_access} onChange={e => setField('timing_access', e.target.value)} placeholder="Entry/exit times, early access arrangements..." rows={3} />
                </div>
                <div className="form-group">
                  <label className="form-label">Complimentary Rooms</label>
                  <textarea className="form-control" value={form.complimentary_rooms} onChange={e => setField('complimentary_rooms', e.target.value)} placeholder="Room numbers, dates, any conditions..." rows={3} />
                </div>
                <div className="form-group">
                  <label className="form-label">Other Notes</label>
                  <textarea className="form-control" value={form.other_notes} onChange={e => setField('other_notes', e.target.value)} placeholder="Any other promises or important notes..." rows={4} />
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Save Commitments'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
