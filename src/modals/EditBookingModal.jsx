import { useState } from 'react'
import SlotBuilder from '../components/SlotBuilder'
import { editBooking } from '../services/bookingService'
import { EVENT_TYPES } from '../utils/constants'

export default function EditBookingModal({ booking, onClose, onSuccess, user, bookings }) {
  const existingSlots = (booking.booking_slots || []).map(s => ({
    date: s.date,
    slot: s.slot,
    venues: s.venues || [],
    kitchen: s.kitchen || '',
  }))

  const [form, setForm] = useState({
    client: booking.client || '',
    phone: booking.phone || '',
    email: booking.email || '',
    event: booking.event || '',
    type: booking.type || 'Wedding',
    guest_count: booking.guest_count || '',
    catering: booking.catering || 'self',
    total: booking.total || '',
    advance_target: booking.advance_target || '',
    notes: booking.notes || '',
  })
  const [slots, setSlots] = useState(existingSlots)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function setField(f, v) { setForm(prev => ({ ...prev, [f]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!reason.trim()) { setError('Please enter a reason for this edit'); return }
    setLoading(true)
    setError('')
    try {
      const updates = {
        client: form.client.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        event: form.event.trim(),
        type: form.type,
        guest_count: Number(form.guest_count) || 0,
        catering: form.catering,
        total: Number(form.total) || 0,
        advance_target: Number(form.advance_target) || 0,
        notes: form.notes.trim(),
        slots,
      }
      await editBooking(booking.id, updates, user.id, reason)
      onSuccess(booking.id)
    } catch (err) {
      setError(err.message || 'Failed to save changes')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl">
        <div className="modal-header">
          <div className="modal-header-content">
            <div className="modal-title">Edit Booking</div>
            <div className="modal-subtitle">{booking.client} — {booking.event}</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--forest)', marginBottom: 14, fontSize: '1rem' }}>
                  Client Information
                </h4>
                <div className="form-group">
                  <label className="form-label">Client Name *</label>
                  <input className="form-control" value={form.client} onChange={e => setField('client', e.target.value)} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-control" value={form.phone} onChange={e => setField('phone', e.target.value)} type="tel" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input className="form-control" value={form.email} onChange={e => setField('email', e.target.value)} type="email" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Event Name *</label>
                  <input className="form-control" value={form.event} onChange={e => setField('event', e.target.value)} required />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Event Type</label>
                    <select className="form-control" value={form.type} onChange={e => setField('type', e.target.value)}>
                      {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Guest Count</label>
                    <input className="form-control" type="number" value={form.guest_count} onChange={e => setField('guest_count', e.target.value)} min="0" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Catering</label>
                  <select className="form-control" value={form.catering} onChange={e => setField('catering', e.target.value)}>
                    <option value="self">Self / Client Arranged</option>
                    <option value="outdoor">Outdoor Caterer</option>
                    <option value="in-house">In-House Catering</option>
                  </select>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Total (₹)</label>
                    <input className="form-control" type="number" value={form.total} onChange={e => setField('total', e.target.value)} min="0" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Advance Target (₹)</label>
                    <input className="form-control" type="number" value={form.advance_target} onChange={e => setField('advance_target', e.target.value)} min="0" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-control" value={form.notes} onChange={e => setField('notes', e.target.value)} rows={3} />
                </div>
                <div className="form-group" style={{ background: '#fff8e8', border: '1px solid var(--gold)', borderRadius: 'var(--radius-sm)', padding: 12 }}>
                  <label className="form-label" style={{ color: '#8a6c00' }}>Reason for Edit *</label>
                  <textarea
                    className="form-control"
                    value={reason}
                    onChange={e => setReason(e.target.value)}
                    placeholder="Why is this booking being edited?"
                    rows={2}
                    required
                  />
                </div>
              </div>
              <div>
                <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--forest)', marginBottom: 14, fontSize: '1rem' }}>
                  Booking Slots
                </h4>
                <SlotBuilder
                  slots={slots}
                  onChange={setSlots}
                  bookings={bookings}
                  excludeBookingId={booking.id}
                />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
