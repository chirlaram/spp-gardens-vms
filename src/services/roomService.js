import { supabase } from './supabase'

/**
 * Replace all room bookings for a booking (delete + re-insert).
 * Rooms inherit the booking's dates/slots — no separate dates stored.
 */
export async function saveRoomBookings(bookingId, roomNumbers, userId) {
  await supabase.from('room_bookings').delete().eq('booking_id', bookingId)

  if (!roomNumbers || roomNumbers.length === 0) return []

  const rows = roomNumbers.map(n => ({
    booking_id: bookingId,
    room_number: n,
    created_by: userId,
  }))

  const { data, error } = await supabase
    .from('room_bookings')
    .insert(rows)
    .select()

  if (error) throw error
  return data || []
}

/**
 * Client-side helper: compute which room numbers are unavailable
 * for a given set of date+slot combinations, using already-loaded bookings.
 *
 * @param {Array} allBookings - all bookings with room_bookings and booking_slots
 * @param {Array} slots - [{date, slot}, ...] — the slots being planned
 * @param {string} [excludeBookingId] - skip this booking (for edits)
 * @returns {Set<number>} set of taken room numbers
 */
export function getTakenRooms(allBookings, slots, excludeBookingId = null) {
  const taken = new Set()
  if (!slots || slots.length === 0) return taken

  for (const b of allBookings) {
    if (b.id === excludeBookingId) continue
    if (b.status === 'Cancelled') continue

    const roomBookings = b.room_bookings || []
    if (roomBookings.length === 0) continue

    // Check if this booking overlaps with any of our target slots
    const hasOverlap = (b.booking_slots || []).some(bs =>
      slots.some(s => s.date === bs.date && s.slot === bs.slot)
    )
    if (hasOverlap) {
      for (const rb of roomBookings) {
        taken.add(rb.room_number)
      }
    }
  }
  return taken
}
