import { supabase } from './supabase'

/**
 * Get all payments with booking info
 */
export async function getAllPayments() {
  const { data, error } = await supabase
    .from('payments')
    .select(`
      *,
      bookings(id, client, event, status, total)
    `)
    .order('recorded_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Get payments for a specific booking
 */
export async function getPaymentsByBooking(bookingId) {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('booking_id', bookingId)
    .order('date', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Delete a payment
 */
export async function deletePayment(paymentId) {
  const { error } = await supabase.from('payments').delete().eq('id', paymentId)
  if (error) throw error
  return true
}
