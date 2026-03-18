/**
 * Check if a given venue/kitchen key is already booked for a specific date+slot.
 * Returns array of conflicting booking IDs.
 *
 * @param {Array} bookings - all bookings with their slots
 * @param {string} date - ISO date string YYYY-MM-DD
 * @param {string} slot - 'am' | 'pm'
 * @param {string} resourceKey - venue key or kitchen key
 * @param {string} [excludeBookingId] - booking to exclude (for edits)
 */
export function checkConflict(bookings, date, slot, resourceKey, excludeBookingId = null) {
  const conflicts = []
  for (const booking of bookings) {
    if (booking.status === 'Cancelled') continue
    if (excludeBookingId && booking.id === excludeBookingId) continue
    for (const s of (booking.booking_slots || [])) {
      if (s.date !== date) continue
      if (s.slot !== slot) continue
      const venues = s.venues || []
      if (venues.includes(resourceKey) || s.kitchen === resourceKey) {
        conflicts.push(booking.id)
        break
      }
    }
  }
  return conflicts
}

/**
 * Get all conflicts for a set of slots being built.
 * Returns map: { 'fcl:2024-01-01:am': [bookingId, ...] }
 */
export function getSlotConflicts(bookings, slots, excludeBookingId = null) {
  const result = {}
  for (const slot of slots) {
    const resources = [...(slot.venues || []), ...(slot.kitchen ? [slot.kitchen] : [])]
    for (const res of resources) {
      const key = `${res}:${slot.date}:${slot.slot}`
      const conflicts = checkConflict(bookings, slot.date, slot.slot, res, excludeBookingId)
      if (conflicts.length > 0) result[key] = conflicts
    }
  }
  return result
}
