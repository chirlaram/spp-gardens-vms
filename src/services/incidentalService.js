import { supabase } from './supabase'

/**
 * Fetch all incidental line items for a booking, ordered by category + sort_order.
 */
export async function getIncidentals(bookingId) {
  const { data, error } = await supabase
    .from('incidental_items')
    .select('*')
    .eq('booking_id', bookingId)
    .order('category')
    .order('sort_order')
    .order('created_at')

  if (error) throw error
  return data || []
}

/**
 * Save all incidental items for a booking (full replace) and update bill meta on the booking.
 * items: [{category, description, qty, rate}, ...]
 * billMeta: {venue_gst_percent, incidental_discount, incidental_gst_percent, prepared_by, checked_by}
 */
export async function saveIncidentals(bookingId, items, billMeta, userId) {
  // Full replace: delete then insert
  const { error: delError } = await supabase
    .from('incidental_items')
    .delete()
    .eq('booking_id', bookingId)
  if (delError) throw delError

  if (items.length > 0) {
    const rows = items.map((item, i) => ({
      booking_id: bookingId,
      category: item.category,
      description: item.description,
      qty: Number(item.qty) || 0,
      rate: Number(item.rate) || 0,
      amount: (Number(item.qty) || 0) * (Number(item.rate) || 0),
      sort_order: i,
      created_by: userId,
    }))

    const { error: insError } = await supabase.from('incidental_items').insert(rows)
    if (insError) throw insError
  }

  // Save bill meta to bookings row
  const { error: metaError } = await supabase
    .from('bookings')
    .update({
      venue_gst_percent: billMeta.venue_gst_percent ?? 18,
      incidental_discount: Number(billMeta.incidental_discount) || 0,
      incidental_gst_percent: billMeta.incidental_gst_percent ?? 18,
      prepared_by: billMeta.prepared_by || null,
      checked_by: billMeta.checked_by || null,
    })
    .eq('id', bookingId)
  if (metaError) throw metaError

  return true
}
