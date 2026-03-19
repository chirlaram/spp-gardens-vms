import { useState } from 'react'
import RoomSelector from '../components/RoomSelector'
import { saveRoomBookings } from '../services/roomService'
import { formatDate } from '../utils/formatters'
import { ROOM_RATE } from '../utils/constants'

export default function RoomAllotmentModal({ booking, onClose, onSuccess, allBookings, user }) {
  const existingRooms = (booking.room_bookings || [])
    .slice()
    .sort((a, b) => a.room_number - b.room_number)
    .map(rb => rb.room_number)

  const [selectedRooms, setSelectedRooms] = useState(existingRooms)
  const [notes, setNotes] = useState(booking.room_bookings?.[0]?.notes || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const slots = booking.booking_slots || []
  const isEdit = existingRooms.length > 0

  async function handleSave() {
    setLoading(true)
    setError('')
    try {
      await saveRoomBookings(booking.id, selectedRooms, user.id, notes.trim() || null)
      const msg = selectedRooms.length === 0
        ? 'Room allotment cleared'
        : `${selectedRooms.length} room${selectedRooms.length !== 1 ? 's' : ''} allotted for ${booking.client}`
      onSuccess(msg)
    } catch (e) {
      setError(e.message || 'Failed to save room allotment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-md">
        <div className="modal-header">
          <div className="modal-title">{isEdit ? 'Edit Room Allotment' : 'Allot Rooms'}</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Booking info card */}
          <div className="room-allot-booking-info">
            <div className="room-allot-client">{booking.client}</div>
            <div className="room-allot-meta">{booking.event} &middot; {booking.type}</div>
            <div className="room-allot-dates">
              {slots
                .slice()
                .sort((a, b) => a.date.localeCompare(b.date))
                .map(s => (
                  <span key={`${s.date}-${s.slot}`} className="room-date-tag">
                    {formatDate(s.date)}
                    <span style={{ opacity: 0.65, marginLeft: 3 }}>{s.slot.toUpperCase()}</span>
                  </span>
                ))
              }
            </div>
          </div>

          {/* Room selector */}
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--forest)', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Select Rooms to Allot</span>
              {selectedRooms.length > 0 && (
                <span style={{ fontWeight: 400, color: 'var(--grove)', fontSize: '0.78rem' }}>
                  {selectedRooms.length} room{selectedRooms.length !== 1 ? 's' : ''} &nbsp;·&nbsp;
                  ₹{(selectedRooms.length * ROOM_RATE).toLocaleString('en-IN')}
                </span>
              )}
            </div>
            <RoomSelector
              selectedRooms={selectedRooms}
              onChange={setSelectedRooms}
              allBookings={allBookings}
              slots={slots}
              excludeBookingId={booking.id}
            />
          </div>

          {/* Notes */}
          <div className="form-group" style={{ marginTop: 16 }}>
            <label className="form-label">Allotment Notes <span style={{ fontWeight: 400, color: '#aaa' }}>(optional)</span></label>
            <textarea
              className="form-control"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Early check-in, special requests, VIP instructions..."
              rows={2}
            />
          </div>

          {error && <div style={{ color: '#c62828', fontSize: '0.82rem', marginTop: 8 }}>{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading
              ? 'Saving…'
              : selectedRooms.length === 0 && isEdit
                ? 'Clear Allotment'
                : `Allot ${selectedRooms.length} Room${selectedRooms.length !== 1 ? 's' : ''}`
            }
          </button>
        </div>
      </div>
    </div>
  )
}
