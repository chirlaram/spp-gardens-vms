import { useState, useEffect } from 'react'
import SlotBuilder from '../components/SlotBuilder'
import RoomSelector from '../components/RoomSelector'
import { createBooking } from '../services/bookingService'
import { todayISO, VENUE_LABELS, KITCHEN_LABELS } from '../utils/formatters'
import { getSlotConflicts } from '../utils/conflictCheck'
import { EVENT_TYPES, PAYMENT_MODES, ROOM_RATE } from '../utils/constants'

function depositDueDateFromSlots(slots) {
  const dates = slots.map(s => s.date).filter(Boolean).sort()
  if (dates.length === 0) return ''
  const d = new Date(dates[0] + 'T00:00:00')
  d.setMonth(d.getMonth() - 1)
  return d.toISOString().slice(0, 10)
}

const INDIAN_MOBILE = /^[6-9]\d{9}$/

function FieldError({ msg }) {
  if (!msg) return null
  return <div style={{ color: '#c62828', fontSize: '0.78rem', marginTop: 3 }}>{msg}</div>
}

export default function NewBookingModal({ onClose, onSuccess, user, bookings, prefillDate }) {
  const initialSlot = { date: prefillDate || todayISO(), slot: 'pm', venues: [], kitchen: '' }
  const [form, setForm] = useState({
    client: '', phone: '', email: '',
    event: '', type: 'Wedding',
    guest_count: '', catering: 'self',
    total: '', advance_target: '',
    deposit_amount: '', deposit_due_date: '',
    notes: '',
  })
  const [slots, setSlots] = useState([initialSlot])
  const [selectedRooms, setSelectedRooms] = useState([])
  const [initPayment, setInitPayment] = useState({ amount: '', date: todayISO(), mode: 'cash', reference: '', note: '' })

  // Auto-compute deposit due date (1 month before earliest event date) when slots change
  useEffect(() => {
    const computed = depositDueDateFromSlots(slots)
    if (computed) setForm(prev => ({ ...prev, deposit_due_date: computed }))
  }, [slots])
  const [loading, setLoading] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [errors, setErrors] = useState({})
  const [slotErrors, setSlotErrors] = useState([])

  function setField(f, v) {
    setForm(prev => {
      const next = { ...prev, [f]: v }
      if (f === 'total') {
        const half = Math.round((Number(v) || 0) * 0.5)
        next.advance_target = half > 0 ? String(half) : ''
      }
      return next
    })
    // Clear error on change
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

    const total = Number(form.total)
    if (!form.total || total <= 0) errs.total = 'Total amount must be greater than ₹0'

    const guestCount = Number(form.guest_count)
    if (!form.guest_count || guestCount <= 0) errs.guest_count = 'Guest count must be greater than 0'

    if (initPayment.amount && Number(initPayment.amount) > total) {
      errs.initPayment = 'Initial payment cannot exceed the total amount'
    }

    // Validate each slot — basic checks first
    const sErrs = slots.map((s, i) => {
      if (!s.date) return `Slot ${i + 1}: date is required`
      if (s.date < today) return `Slot ${i + 1}: date cannot be in the past`
      if (!s.slot) return `Slot ${i + 1}: time slot is required`
      if ((s.venues || []).length === 0) return `Slot ${i + 1}: select at least one venue`
      return ''
    })

    // Check for booking conflicts
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
        client: form.client.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        event: form.event.trim(),
        type: form.type,
        guest_count: Number(form.guest_count) || 0,
        catering: form.catering,
        total: Number(form.total) || 0,
        advance_target: Number(form.advance_target) || 0,
        deposit_amount: Number(form.deposit_amount) || 0,
        deposit_due_date: form.deposit_due_date || null,
        deposit_status: 'Pending',
        notes: form.notes.trim(),
        slots,
        roomNumbers: selectedRooms,
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* Left: Client + Event Info */}
              <div>
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

                <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--forest)', marginBottom: 14, marginTop: 16, fontSize: '1rem' }}>
                  Event Details
                </h4>
                <div className="form-group">
                  <label className="form-label">Event Name *</label>
                  <input
                    className={`form-control ${errors.event ? 'input-error' : ''}`}
                    value={form.event}
                    onChange={e => setField('event', e.target.value)}
                    placeholder="e.g. Sharma Wedding"
                  />
                  <FieldError msg={errors.event} />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Event Type *</label>
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
                  <label className="form-label">Catering</label>
                  <select className="form-control" value={form.catering} onChange={e => setField('catering', e.target.value)}>
                    <option value="self">Self / Client Arranged</option>
                    <option value="outdoor">Outdoor Caterer</option>
                    <option value="in-house">In-House Catering</option>
                  </select>
                </div>

                <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--forest)', marginBottom: 14, marginTop: 16, fontSize: '1rem' }}>
                  Pricing
                </h4>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Total Amount (₹) *</label>
                    <input
                      className={`form-control ${errors.total ? 'input-error' : ''}`}
                      type="number"
                      value={form.total}
                      onChange={e => setField('total', e.target.value)}
                      placeholder="0"
                      min="1"
                    />
                    <FieldError msg={errors.total} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Advance Target (₹)</label>
                    <input className="form-control" type="number" value={form.advance_target} onChange={e => setField('advance_target', e.target.value)} placeholder="0" min="0" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Security Deposit (₹)</label>
                    <input className="form-control" type="number" value={form.deposit_amount} onChange={e => setField('deposit_amount', e.target.value)} placeholder="0" min="0" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Deposit Due Date</label>
                    <input className="form-control" type="date" value={form.deposit_due_date} onChange={e => setField('deposit_due_date', e.target.value)} />
                    <div style={{ fontSize: '0.72rem', color: '#888', marginTop: 2 }}>Auto: 1 month before event</div>
                  </div>
                </div>

                <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--forest)', marginBottom: 14, marginTop: 16, fontSize: '1rem' }}>
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

                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <textarea className="form-control" value={form.notes} onChange={e => setField('notes', e.target.value)} placeholder="Additional notes..." rows={3} />
                </div>
              </div>

              {/* Right: Slots + Rooms */}
              <div>
                <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--forest)', marginBottom: 14, fontSize: '1rem' }}>
                  Booking Slots
                </h4>
                <SlotBuilder
                  slots={slots}
                  onChange={setSlots}
                  bookings={bookings}
                  slotErrors={slotErrors}
                />

                <h4 style={{ fontFamily: 'var(--font-heading)', color: 'var(--forest)', marginBottom: 10, marginTop: 20, fontSize: '1rem' }}>
                  Room Bookings
                  {selectedRooms.length > 0 && (
                    <span style={{ fontSize: '0.8rem', color: 'var(--grove)', marginLeft: 8, fontWeight: 400 }}>
                      ({selectedRooms.length} room{selectedRooms.length > 1 ? 's' : ''} × ₹5,000 = ₹{(selectedRooms.length * ROOM_RATE).toLocaleString('en-IN')})
                    </span>
                  )}
                </h4>
                <div style={{ fontSize: '0.78rem', color: '#888', marginBottom: 8 }}>
                  Rooms are booked for the same date/slot as the venue. Rate: ₹5,000 per room.
                </div>
                <RoomSelector
                  selectedRooms={selectedRooms}
                  onChange={setSelectedRooms}
                  allBookings={bookings}
                  slots={slots}
                />
              </div>
            </div>
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
