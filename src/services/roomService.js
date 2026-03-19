import { supabase } from './supabase'

/**
 * Replace all room bookings for a booking (delete + re-insert).
 * Called from the Room Allotment module after the pre-event meeting.
 */
export async function saveRoomBookings(bookingId, roomNumbers, userId, notes = null) {
  await supabase.from('room_bookings').delete().eq('booking_id', bookingId)

  if (!roomNumbers || roomNumbers.length === 0) return []

  const rows = roomNumbers.map(n => ({
    booking_id: bookingId,
    room_number: n,
    created_by: userId,
    notes,
  }))

  const { data, error } = await supabase
    .from('room_bookings')
    .insert(rows)
    .select()

  if (error) throw error
  return data || []
}

/**
 * Mark a single room key as issued by housekeeping.
 */
export async function issueRoomKey(roomBookingId, userId) {
  const { error } = await supabase
    .from('room_bookings')
    .update({ key_issued_by: userId, key_issued_at: new Date().toISOString() })
    .eq('id', roomBookingId)
  if (error) throw error
}

/**
 * Revoke a previously-issued room key record.
 */
export async function revokeRoomKey(roomBookingId) {
  const { error } = await supabase
    .from('room_bookings')
    .update({ key_issued_by: null, key_issued_at: null })
    .eq('id', roomBookingId)
  if (error) throw error
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
