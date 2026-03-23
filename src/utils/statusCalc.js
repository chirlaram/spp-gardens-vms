/**
 * Auto-calculates booking status based on payments and totals.
 * Never overrides 'Cancelled' or 'Completed'.
 */
export function deriveStatus(currentStatus, payments, totalToCollect, advanceTarget) {
  if (currentStatus === 'Cancelled' || currentStatus === 'Completed') return currentStatus
  const paid = (payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0)
  const totalNum = Number(totalToCollect) || 0
  if (totalNum <= 0) return 'Token Advance'
  if (paid >= totalNum) return '100% Payment'
  const target = Number(advanceTarget) || 0
  if (target > 0 && paid >= target) return 'Confirmed - 50% Advance'
  return 'Token Advance'
}

export const STATUS_COLORS = {
  'Token Advance': { bg: '#fff8e1', text: '#b36a00', border: '#f5c842' },
  'Confirmed - 50% Advance': { bg: '#e8f5e9', text: '#1b5e20', border: '#66bb6a' },
  '100% Payment': { bg: '#e3f2fd', text: '#0d47a1', border: '#42a5f5' },
  'Cancelled': { bg: '#fce4ec', text: '#880e4f', border: '#f48fb1' },
  'Completed': { bg: '#f3e5f5', text: '#4a148c', border: '#ab47bc' },
}

/**
 * Compute banquet revenue from all meals across all slots.
 */
export function computeBanquetRevenue(booking) {
  return (booking.booking_slots || []).reduce((total, slot) => {
    return total + (slot.meals || []).reduce((slotTotal, meal) => {
      return slotTotal + (Number(meal.pax || 0) + Number(meal.extra_pax || 0)) * Number(meal.rate || 0)
    }, 0)
  }, 0)
}

/**
 * Compute all financial totals for a booking object.
 * Works whether room_bookings (allotted) or rooms_required (reserved) is available.
 */
export function computeBookingTotals(booking) {
  const lawnRental = Number(booking.lawn_rental || 0)
  const chargeRooms = (booking.room_bookings && booking.room_bookings.length > 0)
    ? booking.room_bookings.length
    : (booking.rooms_required || 0)
  const roomCharges = chargeRooms * 5000
  const depositAmount = Number(booking.deposit_amount || 0)
  const banquetRevenue = booking.booking_category === 'banquet'
    ? computeBanquetRevenue(booking)
    : 0
  const totalBookingValue = banquetRevenue + lawnRental + roomCharges
  const gst = Math.round((totalBookingValue + depositAmount) * 0.18)
  const totalToCollect = totalBookingValue + depositAmount + gst
  const advanceTarget = Number(booking.advance_target || 0)
  return { lawnRental, roomCharges, chargeRooms, depositAmount, banquetRevenue, totalBookingValue, gst, totalToCollect, advanceTarget }
}
