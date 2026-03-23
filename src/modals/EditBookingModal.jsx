import { useState, useMemo, useEffect } from 'react'
import SlotBuilder from '../components/SlotBuilder'
import { editBooking } from '../services/bookingService'
import { formatDate } from '../utils/formatters'
import { EVENT_TYPES, TOTAL_ROOMS, ROOM_RATE, BOOKING_CATEGORY, VENUE_MIN_GUARANTEE } from '../utils/constants'

function BanquetRevenueSummary({ slots, roomsRequired }) {
  const banquetRevenue = slots.reduce((total, s) =>
    total + (s.meals || []).reduce((st, m) => st + (Number(m.pax || 0) * Number(m.rate || 0)), 0), 0)

  const slotsWithMeals = slots.filter(s => (s.meals || []).length > 0)
  if (slotsWithMeals.length === 0 && banquetRevenue === 0) return null

  return (
    <div className="banquet-revenue-card">
      <div className="banquet-revenue-card-title">Banquet Revenue Breakdown</div>
      {slotsWithMeals.map((s, idx) => {
        const origIdx = slots.indexOf(s)
        const slotRevenue = (s.meals || []).reduce((st, m) => st + (Number(m.pax || 0) * Number(m.rate || 0)), 0)
        const totalPax = (s.meals || []).reduce((sum, m) => sum + (Number(m.pax) || 0), 0)
        const minGuarantee = (s.venues || []).map(v => VENUE_MIN_GUARANTEE[v] || 0).reduce((max, g) => Math.max(max, g), 0)
        const meetsMin = minGuarantee === 0 || totalPax >= minGuarantee
        return (
          <div key={origIdx} className="banquet-slot-breakdown">
            <div className="banquet-slot-breakdown-title">
              Slot {origIdx + 1}: {formatDate(s.date)} — {s.slot === 'am' ? 'AM' : 'PM'}
            </div>
            {(s.meals || []).map((m, mi) => (
              <div key={mi} className="banquet-slot-meal-line">
                <span>{m.meal_type ? m.meal_type.charAt(0).toUpperCase() + m.meal_type.slice(1) : ''} — {m.menu} × {m.pax || 0} pax @ ₹{m.rate || 0}</span>
                <span>₹{((Number(m.pax) || 0) * (Number(m.rate) || 0)).toLocaleString('en-IN')}</span>
              </div>
            ))}
            <div className="banquet-slot-pax-summary">
              <span>Total: {totalPax} pax</span>
              {minGuarantee > 0 && (
                meetsMin
                  ? <span style={{ color: '#16a34a', fontWeight: 500 }}>✓ Meets {minGuarantee} pax minimum</span>
                  : <span style={{ color: '#dc2626', fontWeight: 500 }}>⚠ Below {minGuarantee} pax minimum</span>
              )}
            </div>
          </div>
        )
      })}
      <div className="banquet-revenue-total">
        <span>Total Banquet Revenue</span>
        <span>₹{banquetRevenue.toLocaleString('en-IN')}</span>
      </div>
    </div>
  )
}

export default function EditBookingModal({ booking, onClose, onSuccess, user, bookings }) {
  const existingSlots = (booking.booking_slots || []).map(s => ({
    date: s.date,
    slot: s.slot,
    venues: s.venues || [],
    kitchen: s.kitchen || '',
    meals: s.meals || [],
  }))

  const [bookingCategory, setBookingCategory] = useState(booking.booking_category || BOOKING_CATEGORY.VENUE_RENTAL)
  const [form, setForm] = useState({
    client: booking.client || '',
    phone: booking.phone || '',
    alt_phone: booking.alt_phone || '',
    email: booking.email || '',
    event: booking.event || '',
    type: booking.type || 'Wedding',
    guest_count: booking.guest_count || '',
    catering: booking.catering || 'self',
    lawn_rental: booking.lawn_rental || '',
    advance_target: booking.advance_target || '',
    deposit_amount: booking.deposit_amount || '',
    notes: booking.notes || '',
    rooms_notes: booking.rooms_notes || '',
  })
  const [slots, setSlots] = useState(existingSlots)
  const [roomsRequired, setRoomsRequired] = useState(booking.rooms_required || 0)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isBanquet = bookingCategory === BOOKING_CATEGORY.BANQUET

  // Room availability — exclude this booking's own rooms_required from the count
  const roomAvailability = useMemo(() => {
    const dates = [...new Set(slots.map(s => s.date).filter(Boolean))]
    if (dates.length === 0) return { minAvailable: TOTAL_ROOMS, byDate: [] }

    const byDate = dates.map(date => {
      let used = 0
      for (const b of bookings) {
        if (b.id === booking.id) continue
        if (b.status === 'Cancelled') continue
        const hasDate = (b.booking_slots || []).some(s => s.date === date)
        if (hasDate) used += (b.rooms_required || 0)
      }
      return { date, used, available: Math.max(0, TOTAL_ROOMS - used) }
    })
    const minAvailable = Math.min(...byDate.map(d => d.available))
    return { minAvailable, byDate }
  }, [slots, bookings, booking.id])

  useEffect(() => {
    if (roomsRequired > roomAvailability.minAvailable) {
      setRoomsRequired(roomAvailability.minAvailable)
    }
  }, [roomAvailability.minAvailable])

  // Computed banquet revenue
  const banquetRevenue = useMemo(() => {
    if (!isBanquet) return 0
    return slots.reduce((total, s) =>
      total + (s.meals || []).reduce((st, m) => st + (Number(m.pax || 0) * Number(m.rate || 0)), 0), 0)
  }, [slots, isBanquet])

  // Auto-set advance target to 50% of banquet revenue when in banquet mode
  useEffect(() => {
    if (!isBanquet) return
    const half = Math.round(banquetRevenue * 0.5)
    setForm(prev => ({ ...prev, advance_target: half > 0 ? String(half) : '' }))
  }, [banquetRevenue, isBanquet])

  const lawnRentalNum = Number(form.lawn_rental) || 0
  const roomCharges = roomsRequired * ROOM_RATE
  const depositNum = Number(form.deposit_amount) || 0
  const bookingValueNum = (isBanquet ? banquetRevenue : 0) + lawnRentalNum + roomCharges
  const gstNum = Math.round((bookingValueNum + depositNum) * 0.18)
  const totalToCollect = bookingValueNum + depositNum + gstNum

  function setField(f, v) { setForm(prev => ({ ...prev, [f]: v })) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!reason.trim()) { setError('Please enter a reason for this edit'); return }
    setLoading(true)
    setError('')
    try {
      const updates = {
        booking_category: bookingCategory,
        client: form.client.trim(),
        phone: form.phone.trim(),
        alt_phone: form.alt_phone.trim(),
        email: form.email.trim(),
        event: form.event.trim(),
        type: form.type,
        guest_count: Number(form.guest_count) || 0,
        catering: isBanquet ? 'in-house' : form.catering,
        lawn_rental: Number(form.lawn_rental) || 0,
        advance_target: Number(form.advance_target) || 0,
        deposit_amount: Number(form.deposit_amount) || 0,
        notes: form.notes.trim(),
        rooms_notes: form.rooms_notes.trim(),
        rooms_required: roomsRequired,
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

            {/* ── Booking Category Toggle ── */}
            <div className="booking-category-toggle">
              <label className={`cat-option ${bookingCategory === BOOKING_CATEGORY.VENUE_RENTAL ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="booking_category_edit"
                  value={BOOKING_CATEGORY.VENUE_RENTAL}
                  checked={bookingCategory === BOOKING_CATEGORY.VENUE_RENTAL}
                  onChange={() => setBookingCategory(BOOKING_CATEGORY.VENUE_RENTAL)}
                />
                <div className="cat-option-text">
                  <span className="cat-option-title">Venue Rental</span>
                  <span className="cat-option-desc">Client arranges their own catering</span>
                </div>
              </label>
              <label className={`cat-option ${bookingCategory === BOOKING_CATEGORY.BANQUET ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="booking_category_edit"
                  value={BOOKING_CATEGORY.BANQUET}
                  checked={bookingCategory === BOOKING_CATEGORY.BANQUET}
                  onChange={() => setBookingCategory(BOOKING_CATEGORY.BANQUET)}
                />
                <div className="cat-option-text">
                  <span className="cat-option-title">Banquet Booking</span>
                  <span className="cat-option-desc">In-house catering by SPP Gardens</span>
                </div>
              </label>
            </div>

            <div className="nbf-grid">
              {/* ── Client Information ── */}
              <div className="nbf-client">
                <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--forest)', marginBottom: 14, fontSize: '1rem' }}>Client Information</h4>
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
                    <label className="form-label">Additional Phone</label>
                    <input className="form-control" value={form.alt_phone} onChange={e => setField('alt_phone', e.target.value)} placeholder="9999999999" type="tel" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-control" value={form.email} onChange={e => setField('email', e.target.value)} type="email" />
                </div>
              </div>{/* /nbf-client */}

              {/* ── Event Details ── */}
              <div className="nbf-event">
                <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--forest)', marginBottom: 14, fontSize: '1rem' }}>Event Details</h4>
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
                {!isBanquet && (
                  <div className="form-group">
                    <label className="form-label">Catering</label>
                    <select className="form-control" value={form.catering} onChange={e => setField('catering', e.target.value)}>
                      <option value="self">Self / Client Arranged</option>
                      <option value="outdoor">Outdoor Caterer</option>
                      <option value="in-house">In-House Catering</option>
                    </select>
                  </div>
                )}
              </div>{/* /nbf-event */}

              {/* ── Booking Slots + Rooms ── */}
              <div className="nbf-slots">
                <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--forest)', marginBottom: 14, fontSize: '1rem' }}>
                  Booking Slots {isBanquet && <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#666' }}>— add meals per slot below</span>}
                </h4>
                <SlotBuilder slots={slots} onChange={setSlots} bookings={bookings} excludeBookingId={booking.id} banquetMode={isBanquet} />
                <div style={{ marginTop: 20 }}>
                  <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--forest)', marginBottom: 6, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    Rooms Required
                    {roomAvailability.byDate.length > 0 && (
                      <span style={{ fontSize: '0.75rem', fontWeight: 500, padding: '2px 8px', borderRadius: 10, background: roomAvailability.minAvailable === 0 ? '#fee2e2' : roomAvailability.minAvailable <= 3 ? '#fef3c7' : '#dcfce7', color: roomAvailability.minAvailable === 0 ? '#b91c1c' : roomAvailability.minAvailable <= 3 ? '#92400e' : '#166534' }}>
                        {roomAvailability.minAvailable} of {TOTAL_ROOMS} available
                      </span>
                    )}
                  </h4>
                  {roomAvailability.byDate.length > 1 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      {roomAvailability.byDate.map(({ date, available }) => (
                        <span key={date} style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: 8, fontWeight: 500, background: available === 0 ? '#fee2e2' : available <= 3 ? '#fef3c7' : '#f0faf0', color: available === 0 ? '#b91c1c' : available <= 3 ? '#92400e' : '#166534' }}>
                          {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}:&nbsp;<strong>{available}</strong> free
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="room-count-control">
                      <button type="button" className="room-count-btn" onClick={() => setRoomsRequired(r => Math.max(0, r - 1))} disabled={roomsRequired === 0}>−</button>
                      <span className="room-count-value">{roomsRequired}</span>
                      <button type="button" className="room-count-btn" onClick={() => setRoomsRequired(r => Math.min(roomAvailability.minAvailable, r + 1))} disabled={roomsRequired >= roomAvailability.minAvailable}>+</button>
                    </div>
                    <span style={{ fontSize: '0.82rem', color: '#666' }}>
                      {roomsRequired === 0 ? 'No rooms needed' : `room${roomsRequired !== 1 ? 's' : ''} · ₹${(roomsRequired * ROOM_RATE).toLocaleString('en-IN')}`}
                    </span>
                  </div>
                  <div style={{ marginTop: 8, fontSize: '0.73rem', color: '#aaa' }}>Specific room numbers are assigned after the pre-event meeting via the Rooms module.</div>
                  {roomsRequired > 0 && (
                    <div className="form-group" style={{ marginTop: 10 }}>
                      <label className="form-label">Rooms Notes</label>
                      <textarea className="form-control" value={form.rooms_notes} onChange={e => setField('rooms_notes', e.target.value)} placeholder="e.g. 2 HRP Lawn Rooms, ground floor preferred..." rows={2} />
                    </div>
                  )}
                </div>
              </div>{/* /nbf-slots */}

              {/* ── Pricing ── */}
              <div className="nbf-pricing">
                <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--forest)', marginBottom: 14, fontSize: '1rem' }}>Pricing</h4>

                {isBanquet && (
                  <BanquetRevenueSummary slots={slots} roomsRequired={roomsRequired} />
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      Lawn Rental (₹)
                      {isBanquet && <span style={{ fontSize: '0.72rem', color: '#888', marginLeft: 4 }}>(if below min guarantee)</span>}
                    </label>
                    <input className="form-control" type="number" value={form.lawn_rental} onChange={e => setField('lawn_rental', e.target.value)} min="0" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Advance Target (₹)</label>
                    <input className="form-control" type="number" value={form.advance_target} onChange={e => setField('advance_target', e.target.value)} min="0" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Incidental Charges Deposit (₹)</label>
                  <input className="form-control" type="number" value={form.deposit_amount} onChange={e => setField('deposit_amount', e.target.value)} min="0" placeholder="0" />
                </div>

                {isBanquet && totalToCollect > 0 && (
                  <div className="banquet-total-summary">
                    {banquetRevenue > 0 && (
                      <div className="banquet-total-row">
                        <span>Banquet Revenue</span>
                        <span>₹{banquetRevenue.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {lawnRentalNum > 0 && (
                      <div className="banquet-total-row">
                        <span>Lawn Rental</span>
                        <span>₹{lawnRentalNum.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {roomsRequired > 0 && (
                      <div className="banquet-total-row">
                        <span>Rooms ({roomsRequired} × ₹{ROOM_RATE.toLocaleString('en-IN')})</span>
                        <span>₹{roomCharges.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {depositNum > 0 && (
                      <div className="banquet-total-row">
                        <span>Incidental Deposit</span>
                        <span>₹{depositNum.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    {gstNum > 0 && (
                      <div className="banquet-total-row" style={{ color: '#5c6bc0' }}>
                        <span>GST (18%)</span>
                        <span>₹{gstNum.toLocaleString('en-IN')}</span>
                      </div>
                    )}
                    <div className="banquet-total-row grand-total">
                      <span>Total to Collect</span>
                      <span>₹{totalToCollect.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                )}
              </div>{/* /nbf-pricing */}

              {/* ── Notes + Reason ── */}
              <div className="nbf-notes">
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-control" value={form.notes} onChange={e => setField('notes', e.target.value)} rows={3} />
                </div>
                <div className="form-group" style={{ background: '#fff8e8', border: '1px solid var(--gold)', borderRadius: 'var(--radius-sm)', padding: 12 }}>
                  <label className="form-label" style={{ color: '#8a6c00' }}>Reason for Edit *</label>
                  <textarea className="form-control" value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this booking being edited?" rows={2} required />
                </div>
              </div>{/* /nbf-notes */}
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
