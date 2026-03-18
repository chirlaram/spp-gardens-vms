import { getTakenRooms } from '../services/roomService'

const ROOM_RATE = 5000
const TOTAL_ROOMS = 18

/**
 * 18-room grid selector.
 * Rooms that are already booked for the selected date+slot combinations
 * are shown as "Unavailable" and cannot be selected.
 *
 * Props:
 *   selectedRooms    — array of room numbers (integers) currently selected
 *   onChange         — callback(newSelectedRooms)
 *   allBookings      — full bookings list (with room_bookings + booking_slots)
 *   slots            — current form slots [{date, slot}, ...]
 *   excludeBookingId — skip this booking when checking conflicts (for edits)
 */
export default function RoomSelector({ selectedRooms, onChange, allBookings = [], slots = [], excludeBookingId = null }) {
  const takenRooms = getTakenRooms(allBookings, slots, excludeBookingId)

  function toggleRoom(num) {
    if (takenRooms.has(num)) return
    const isSelected = selectedRooms.includes(num)
    onChange(isSelected ? selectedRooms.filter(r => r !== num) : [...selectedRooms, num])
  }

  const total = selectedRooms.length * ROOM_RATE

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: 6,
      }}>
        {Array.from({ length: TOTAL_ROOMS }, (_, i) => i + 1).map(num => {
          const isTaken = takenRooms.has(num)
          const isSelected = selectedRooms.includes(num)
          return (
            <button
              key={num}
              type="button"
              onClick={() => toggleRoom(num)}
              style={{
                padding: '7px 4px',
                borderRadius: 6,
                border: isSelected
                  ? '2px solid var(--grove)'
                  : isTaken
                    ? '1px solid #e0e0e0'
                    : '1px solid #c8d8c8',
                background: isTaken
                  ? '#f9f9f9'
                  : isSelected
                    ? '#e8f5e9'
                    : '#fff',
                color: isTaken ? '#bbb' : isSelected ? 'var(--forest)' : '#444',
                cursor: isTaken ? 'not-allowed' : 'pointer',
                fontSize: '0.78rem',
                fontWeight: isSelected ? 700 : 400,
                textAlign: 'center',
                lineHeight: 1.3,
              }}
            >
              <div>{num}</div>
              <div style={{ fontSize: '0.6rem', color: isTaken ? '#ccc' : isSelected ? 'var(--grove)' : '#888' }}>
                {isTaken ? 'Taken' : isSelected ? '✓ Sel.' : 'Free'}
              </div>
            </button>
          )
        })}
      </div>

      {selectedRooms.length > 0 && (
        <div style={{
          marginTop: 10,
          padding: '8px 12px',
          background: '#f0f7f0',
          borderRadius: 6,
          fontSize: '0.85rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span>
            Rooms: <strong>{selectedRooms.slice().sort((a, b) => a - b).join(', ')}</strong>
          </span>
          <span>
            <strong>{selectedRooms.length}</strong> × ₹5,000 = <strong>₹{(total).toLocaleString('en-IN')}</strong>
          </span>
        </div>
      )}
    </div>
  )
}
