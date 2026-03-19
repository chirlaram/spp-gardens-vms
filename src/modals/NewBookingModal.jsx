import { useState, useEffect, useMemo, useRef } from 'react'
import SlotBuilder from '../components/SlotBuilder'
import { createBooking } from '../services/bookingService'
import { todayISO, VENUE_LABELS, KITCHEN_LABELS, formatDate } from '../utils/formatters'
import { getSlotConflicts } from '../utils/conflictCheck'
import { EVENT_TYPES, PAYMENT_MODES, TOTAL_ROOMS, ROOM_RATE, BOOKING_CATEGORY, VENUE_MIN_GUARANTEE } from '../utils/constants'

const INDIAN_MOBILE = /^[6-9]\d{9}$/

function FieldError({ msg }) {
  if (!msg) return null
  return <div style={{ color: '#c62828', fontSize: '0.78rem', marginTop: 3 }}>{msg}</div>
}

function BanquetRevenueSummary({ slots, lawnRental, roomsRequired }) {
  const banquetRevenue = slots.reduce((total, s) =>
    total + (s.meals || []).reduce((st, m) => st + (Number(m.pax || 0) * Number(m.rate || 0)), 0), 0)

  const slotsWithMeals = slots.filter(s => (s.meals || []).length > 0)
  if (slotsWithMeals.length === 0 && banquetRevenue === 0) return null

  const roomCharges = roomsRequired * ROOM_RATE

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

export default function NewBookingModal({ onClose, onSuccess, user, bookings, prefillDate }) {
  const initialSlot = { date: prefillDate || todayISO(), slot: 'pm', venues: [], kitchen: '', meals: [] }
  const [bookingCategory, setBookingCategory] = useState(BOOKING_CATEGORY.VENUE_RENTAL)
  const [form, setForm] = useState({
    client: '', phone: '', email: '',
    event: '', type: 'Wedding',
    guest_count: '', catering: 'self',
    lawn_rental: '', advance_target: '',
    deposit_amount: '',
    notes: '',
  })
  const [slots, setSlots] = useState([initialSlot])
  const [roomsRequired, setRoomsRequired] = useState(0)
  const [initPayment, setInitPayment] = useState({ amount: '', date: todayISO(), mode: 'cash', reference: '', note: '' })

  // Room availability
  const roomAvailability = useMemo(() => {
    const dates = [...new Set(slots.map(s => s.date).filter(Boolean))]
    if (dates.length === 0) return { minAvailable: TOTAL_ROOMS, byDate: [] }
    const byDate = dates.map(date => {
      let used = 0
      for (const b of bookings) {
        if (b.status === 'Cancelled') continue
        const hasDate = (b.booking_slots || []).some(s => s.date === date)
        if (hasDate) used += (b.rooms_required || 0)
      }
      return { date, used, available: Math.max(0, TOTAL_ROOMS - used) }
    })
    const minAvailable = Math.min(...byDate.map(d => d.available))
    return { minAvailable, byDate }
  }, [slots, bookings])

  useEffect(() => {
    if (roomsRequired > roomAvailability.minAvailable) {
      setRoomsRequired(roomAvailability.minAvailable)
    }
  }, [roomAvailability.minAvailable])

  const isBanquet = bookingCategory === BOOKING_CATEGORY.BANQUET

  // Computed banquet revenue for display
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
  const totalToCollect = (isBanquet ? banquetRevenue : 0) + lawnRentalNum + roomCharges + depositNum

  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [errors, setErrors] = useState({})
  const [slotErrors, setSlotErrors] = useState([])
  const eventManuallyEdited = useRef(false)

  function autoEventName(client, type) {
    const name = (client || '').trim()
    if (!name) return ''
    return `${type} Function of ${name}`
  }

  function setField(f, v) {
    setForm(prev => {
      const next = { ...prev, [f]: v }
      if (!isBanquet && f === 'lawn_rental') {
        const half = Math.round((Number(v) || 0) * 0.5)
        next.advance_target = half > 0 ? String(half) : ''
      }
      // Auto-generate event name when client or type changes, unless manually edited
      if ((f === 'client' || f === 'type') && !eventManuallyEdited.current) {
        const client = f === 'client' ? v : prev.client
        const type   = f === 'type'   ? v : prev.type
        next.event = autoEventName(client, type)
      }
      return next
    })
    if (errors[f]) setErrors(prev => ({ ...prev, [f]: '' }))
  }

  function validate() {
    const errs = {}
    const today = todayISO()

    if (!form.client.trim()) errs.client = 'Client name is required'

    if (!form.phone.trim()) {
      errs.phone = 'Phone number is required'
    } else if (!INDIAN_MOBILE.test(form.phone.replace(/\s+/g, ''))) {
      errs.phone = 'Enter a valid 10-digit Indian mobile number (starts with 6–9)'
    }

    if (!form.event.trim()) errs.event = 'Event name is required'

    const guestCount = Number(form.guest_count)
    if (!form.guest_count || guestCount <= 0) errs.guest_count = 'Guest count must be greater than 0'

    if (!isBanquet) {
      const total = Number(form.lawn_rental)
      if (!form.lawn_rental || total <= 0) errs.lawn_rental = 'Lawn rental amount must be greater than ₹0'
      if (initPayment.amount && Number(initPayment.amount) > total) {
        errs.initPayment = 'Initial payment cannot exceed the total amount'
      }
    }

    if (roomsRequired > 0 && roomsRequired > roomAvailability.minAvailable) {
      errs.rooms = `Only ${roomAvailability.minAvailable} rooms available — cannot reserve ${roomsRequired}`
    }

    const sErrs = slots.map((s, i) => {
      if (!s.date) return `Slot ${i + 1}: date is required`
      if (s.date < today) return `Slot ${i + 1}: date cannot be in the past`
      if (!s.slot) return `Slot ${i + 1}: time slot is required`
      if ((s.venues || []).length === 0) return `Slot ${i + 1}: select at least one venue`
      if (isBanquet && (s.meals || []).length === 0) return `Slot ${i + 1}: add at least one meal for banquet`
      return ''
    })

    const conflictMap = getSlotConflicts(bookings, slots)
    for (const key of Object.keys(conflictMap)) {
      const [resKey, date, slot] = key.split(':')
      const resName = VENUE_LABELS[resKey] || KITCHEN_LABELS[resKey] || resKey
      const idx = slots.findIndex(s => s.date === date && s.slot === slot)
      if (idx >= 0 && !sErrs[idx]) {
        sErrs[idx] = `This slot is already booked for ${resName}`
      }
    }

    setErrors(errs)
    setSlotErrors(sErrs)

    return Object.values(errs).every(v => !v) && sErrs.every(v => !v)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    setSubmitError('')
    try {
      const payload = {
        booking_category: bookingCategory,
        client: form.client.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        event: form.event.trim(),
        type: form.type,
        guest_count: Number(form.guest_count) || 0,
        catering: isBanquet ? 'in-house' : form.catering,
        lawn_rental: Number(form.lawn_rental) || 0,
        advance_target: Number(form.advance_target) || 0,
        deposit_amount: Number(form.deposit_amount) || 0,
        notes: form.notes.trim(),
        rooms_required: roomsRequired,
        slots,
        initialPayment: initPayment.amount ? {
          amount: Number(initPayment.amount),
          date: initPayment.date,
          mode: initPayment.mode,
          reference: initPayment.reference,
          note: initPayment.note,
        } : null,
      }
      const created = await createBooking(payload, user.id)
      onSuccess(created.id)
    } catch (err) {
      setSubmitError(err.message || 'Failed to create booking')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl">
        <div className="modal-header">
          <div className="modal-header-content">
            <div className="modal-title">New Booking</div>
            <div className="modal-subtitle">Create a new venue booking</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} noValidate>
          <div className="modal-body">
            {submitError && <div className="login-error" style={{ marginBottom: 16 }}>{submitError}</div>}

            {/* ── Booking Category Toggle ── */}
            <div className="booking-category-toggle">
              <label className={`cat-option ${bookingCategory === BOOKING_CATEGORY.VENUE_RENTAL ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="booking_category"
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
                  name="booking_category"
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
                <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--forest)', marginBottom: 14, fontSize: '1rem' }}>
                  Client Information
                </h4>
                <div className="form-group">
                  <label className="form-label">Client Name *</label>
                  <input
                    className={`form-control ${errors.client ? 'input-error' : ''}`}
                    value={form.client}
                    onChange={e => setField('client', e.target.value)}
                    placeholder="Full name"
                  />
                  <FieldError msg={errors.client} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Phone *</label>
                    <input
                      className={`form-control ${errors.phone ? 'input-error' : ''}`}
                      value={form.phone}
                      onChange={e => setField('phone', e.target.value)}
                      placeholder="9999999999"
                      type="tel"
                    />
                    <FieldError msg={errors.phone} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Email</label>
                    <input className="form-control" value={form.email} onChange={e => setField('email', e.target.value)} placeholder="email@example.com" type="email" />
                  </div>
                </div>
              </div>{/* /nbf-client */}

              {/* ── Event Details ── */}
              <div className="nbf-event">
                <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--forest)', marginBottom: 14, fontSize: '1rem' }}>
                  Event Details
                </h4>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Event Type</label>
                    <select className="form-control" value={form.type} onChange={e => setField('type', e.target.value)}>
                      {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Guest Count *</label>
                    <input
                      className={`form-control ${errors.guest_count ? 'input-error' : ''}`}
                      type="number"
                      value={form.guest_count}
                      onChange={e => setField('guest_count', e.target.value)}
                      placeholder="500"
                      min="1"
                    />
                    <FieldError msg={errors.guest_count} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Event Name *</label>
                  <input
                    className={`form-control ${errors.event ? 'input-error' : ''}`}
                    value={form.event}
                    onChange={e => { eventManuallyEdited.current = true; setField('event', e.target.value) }}
                    placeholder="e.g. Sharma Wedding"
                  />
                  <FieldError msg={errors.event} />
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
                <SlotBuilder
                  slots={slots}
                  onChange={setSlots}
                  bookings={bookings}
                  slotErrors={slotErrors}
                  banquetMode={isBanquet}
                />

                {/* Rooms Required */}
                <div style={{ marginTop: 20 }}>
                  <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--forest)', marginBottom: 6, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    Rooms Required
                    {roomAvailability.byDate.length > 0 && (
                      <span style={{
                        fontSize: '0.75rem', fontWeight: 500, padding: '2px 8px', borderRadius: 10,
                        background: roomAvailability.minAvailable === 0 ? '#fee2e2' : roomAvailability.minAvailable <= 3 ? '#fef3c7' : '#dcfce7',
                        color: roomAvailability.minAvailable === 0 ? '#b91c1c' : roomAvailability.minAvailable <= 3 ? '#92400e' : '#166534',
                      }}>
                        {roomAvailability.minAvailable} of {TOTAL_ROOMS} available
                      </span>
                    )}
                  </h4>
                  {roomAvailability.byDate.length > 1 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                      {roomAvailability.byDate.map(({ date, available }) => (
                        <span key={date} style={{
                          fontSize: '0.7rem', padding: '2px 7px', borderRadius: 8, fontWeight: 500,
                          background: available === 0 ? '#fee2e2' : available <= 3 ? '#fef3c7' : '#f0faf0',
                          color: available === 0 ? '#b91c1c' : available <= 3 ? '#92400e' : '#166534',
                        }}>
                          {new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}:&nbsp;
                          <strong>{available}</strong> free
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
                  {errors.rooms && <div style={{ color: '#c62828', fontSize: '0.78rem', marginTop: 4 }}>{errors.rooms}</div>}
                  <div style={{ marginTop: 8, fontSize: '0.73rem', color: '#aaa' }}>
                    Specific room numbers are assigned after the pre-event meeting via the Rooms module.
                  </div>
                </div>
              </div>{/* /nbf-slots */}

              {/* ── Pricing ── */}
              <div className="nbf-pricing">
                <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--forest)', marginBottom: 14, fontSize: '1rem' }}>Pricing</h4>

                {isBanquet && (
                  <BanquetRevenueSummary slots={slots} lawnRental={lawnRentalNum} roomsRequired={roomsRequired} />
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      Lawn Rental (₹) {!isBanquet && '*'}
                      {isBanquet && <span style={{ fontSize: '0.72rem', color: '#888', marginLeft: 4 }}>(if below min guarantee)</span>}
                    </label>
                    <input
                      className={`form-control ${errors.lawn_rental ? 'input-error' : ''}`}
                      type="number"
                      value={form.lawn_rental}
                      onChange={e => setField('lawn_rental', e.target.value)}
                      placeholder="0"
                      min="0"
                    />
                    <FieldError msg={errors.lawn_rental} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Advance Target (₹)</label>
                    <input className="form-control" type="number" value={form.advance_target} onChange={e => setField('advance_target', e.target.value)} placeholder="0" min="0" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Incidental Charges Deposit (₹)</label>
                  <input className="form-control" type="number" value={form.deposit_amount} onChange={e => setField('deposit_amount', e.target.value)} placeholder="0" min="0" />
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
                    <div className="banquet-total-row grand-total">
                      <span>Total to Collect</span>
                      <span>₹{totalToCollect.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                )}
              </div>{/* /nbf-pricing */}

              {/* ── Initial Payment ── */}
              <div className="nbf-payment">
                <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--forest)', marginBottom: 14, fontSize: '1rem' }}>
                  Initial Payment
                </h4>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Amount (₹)</label>
                    <input
                      className={`form-control ${errors.initPayment ? 'input-error' : ''}`}
                      type="number"
                      value={initPayment.amount}
                      onChange={e => { setInitPayment(p => ({ ...p, amount: e.target.value })); setErrors(prev => ({ ...prev, initPayment: '' })) }}
                      placeholder="0"
                      min="0"
                    />
                    <FieldError msg={errors.initPayment} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date</label>
                    <input className="form-control" type="date" value={initPayment.date} onChange={e => setInitPayment(p => ({ ...p, date: e.target.value }))} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Mode</label>
                    <select className="form-control" value={initPayment.mode} onChange={e => setInitPayment(p => ({ ...p, mode: e.target.value }))}>
                      {PAYMENT_MODES.map(m => <option key={m} value={m}>{m.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Reference</label>
                    <input className="form-control" value={initPayment.reference} onChange={e => setInitPayment(p => ({ ...p, reference: e.target.value }))} placeholder="Cheque no, UTR, etc." />
                  </div>
                </div>
              </div>{/* /nbf-payment */}

              <div className="nbf-notes">
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-control" value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Additional notes..." rows={3} />
                </div>
              </div>{/* /nbf-notes */}
            </div>{/* /nbf-grid */}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating…' : 'Create Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
