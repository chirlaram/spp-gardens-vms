import { supabase } from './supabase'
import { deriveStatus } from '../utils/statusCalc'

/** Convert raw slot objects to the shape required by booking_slots insert */
function buildSlotRows(bookingId, slots) {
  return slots.map(s => ({
    booking_id: bookingId,
    date: s.date,
    slot: s.slot,
    venues: s.venues || [],
    kitchen: s.kitchen || null,
    meals: s.meals || [],
  }))
}

/** Insert a single amendment record */
function logAmendment(bookingId, type, field, oldVal, newVal, reason, userId) {
  return supabase.from('amendments').insert({
    booking_id: bookingId,
    type,
    changed_field: field,
    old_value: String(oldVal ?? ''),
    new_value: String(newVal ?? ''),
    reason: reason || null,
    changed_by: userId,
  })
}

/**
 * Fetch a single booking with all related data by ID
 */
export async function getBookingById(id) {
  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      booking_slots(*),
      payments(*),
      commitments(*),
      amendments(*),
      room_bookings(*),
      incidental_items(*)
    `)
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

/**
 * Fetch all bookings with related data
 */
export async function getBookings() {
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(`
      *,
      booking_slots(*),
      payments(*),
      commitments(*),
      amendments(*),
      room_bookings(*),
      incidental_items(*)
    `)
    .order('created_at', { ascending: false })

  if (error) throw error
  return bookings || []
}

/**
 * Create a new booking with slots and optional initial payment
 */
export async function createBooking(data, userId) {
  const { slots, initialPayment, commitmentData, ...bookingData } = data

  // Insert booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      ...bookingData,
      created_by: userId,
      status: 'Token Advance',
    })
    .select()
    .single()

  if (bookingError) throw bookingError

  // Insert slots
  if (slots && slots.length > 0) {
    const { error: slotsError } = await supabase.from('booking_slots').insert(buildSlotRows(booking.id, slots))
    if (slotsError) throw slotsError
  }

  // Insert initial payment if provided
  let payments = []
  if (initialPayment && initialPayment.amount > 0) {
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        booking_id: booking.id,
        date: initialPayment.date,
        amount: initialPayment.amount,
        mode: initialPayment.mode || 'cash',
        reference: initialPayment.reference || null,
        note: initialPayment.note || null,
        recorded_by: userId,
      })
      .select()
      .single()

    if (paymentError) throw paymentError
    payments = [payment]
  }

  // Calculate and update status
  const _lawnRental = Number(booking.lawn_rental || 0)
  const _roomCharges = (Number(booking.rooms_required) || 0) * 5000
  const _deposit = Number(booking.deposit_amount || 0)
  // For banquet bookings, compute revenue from the slots we just inserted
  const _banquetRevenue = booking.booking_category === 'banquet'
    ? (slots || []).reduce((t, s) => t + (s.meals || []).reduce((st, m) => st + (Number(m.pax || 0) * Number(m.rate || 0)), 0), 0)
    : 0
  const _totalToCollect = _banquetRevenue + _lawnRental + _roomCharges + _deposit
  const _advanceTarget = Number(booking.advance_target || 0)
  const newStatus = deriveStatus('Token Advance', payments, _totalToCollect, _advanceTarget)
  if (newStatus !== 'Token Advance') {
    await supabase.from('bookings').update({ status: newStatus }).eq('id', booking.id)
  }

  // Insert commitments if provided
  if (commitmentData) {
    await supabase.from('commitments').insert({
      booking_id: booking.id,
      ...commitmentData,
      updated_by: userId,
    })
  }

  return booking
}

/**
 * Edit a booking and log amendment
 */
export async function editBooking(id, updates, userId, reason) {
  const { slots, ...bookingUpdates } = updates

  // Get current booking for amendment log
  const { data: current } = await supabase.from('bookings').select('*').eq('id', id).single()

  // Update booking fields
  const { error } = await supabase
    .from('bookings')
    .update(bookingUpdates)
    .eq('id', id)

  if (error) throw error

  // Log amendments for changed fields
  const amendmentInserts = []
  for (const [field, newVal] of Object.entries(bookingUpdates)) {
    if (current && current[field] !== newVal) {
      amendmentInserts.push({
        booking_id: id,
        type: 'edit',
        changed_field: field,
        old_value: String(current[field] ?? ''),
        new_value: String(newVal ?? ''),
        reason: reason || null,
        changed_by: userId,
      })
    }
  }
  if (amendmentInserts.length > 0) {
    await supabase.from('amendments').insert(amendmentInserts)
  }

  // Update slots if provided
  if (slots) {
    await supabase.from('booking_slots').delete().eq('booking_id', id)
    const rows = buildSlotRows(id, slots)
    if (rows.length > 0) await supabase.from('booking_slots').insert(rows)
    await logAmendment(id, 'edit', 'slots', 'previous slots', 'updated slots', reason, userId)
  }

  return true
}

/**
 * Cancel a booking
 */
export async function cancelBooking(id, cancelData, userId) {
  const { reason, advanceForfeited } = cancelData

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'Cancelled' })
    .eq('id', id)

  if (error) throw error

  await logAmendment(id, 'cancel', 'status', 'active', 'Cancelled', reason, userId)
  if (advanceForfeited) {
    await logAmendment(id, 'cancel', 'advance_forfeited', 'false', 'true', 'Advance forfeited on cancellation', userId)
  }

  return true
}

/**
 * Postpone a booking to new dates
 */
export async function postponeBooking(id, postponeData, userId) {
  const { newSlots, reason, dateChangeFee } = postponeData

  // Replace slots
  await supabase.from('booking_slots').delete().eq('booking_id', id)
  const rows = buildSlotRows(id, newSlots)
  if (rows.length > 0) await supabase.from('booking_slots').insert(rows)

  // Log amendment
  await logAmendment(id, 'postpone', 'slots', 'original dates', newSlots.map(s => `${s.date} ${s.slot}`).join(', '), reason, userId)

  // Record date change fee if applicable
  if (dateChangeFee && dateChangeFee.amount > 0) {
    await supabase.from('payments').insert({
      booking_id: id,
      date: dateChangeFee.date,
      amount: dateChangeFee.amount,
      mode: dateChangeFee.mode || 'cash',
      reference: dateChangeFee.reference || null,
      note: 'Date change fee',
      recorded_by: userId,
    })
  }

  // Recalculate status
  await recalculateStatus(id)

  return true
}

/**
 * Mark a booking as completed
 */
export async function markCompleted(id, userId) {
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'Completed' })
    .eq('id', id)

  if (error) throw error

  await logAmendment(id, 'complete', 'status', 'active', 'Completed', null, userId)

  return true
}

/**
 * Record a payment and update booking status
 */
export async function recordPayment(bookingId, paymentData, userId) {
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      booking_id: bookingId,
      date: paymentData.date,
      amount: paymentData.amount,
      mode: paymentData.mode || 'cash',
      reference: paymentData.reference || null,
      note: paymentData.note || null,
      recorded_by: userId,
    })
    .select()
    .single()

  if (paymentError) throw paymentError

  await recalculateStatus(bookingId)
  return payment
}

/**
 * Recalculate and update booking status based on payments
 */
export async function recalculateStatus(bookingId) {
  const { data: booking } = await supabase
    .from('bookings')
    .select('*, payments(*), room_bookings(*), booking_slots(*)')
    .eq('id', bookingId)
    .single()

  if (!booking) return

  const _chargeRooms = (booking.room_bookings && booking.room_bookings.length > 0)
    ? booking.room_bookings.length : (booking.rooms_required || 0)
  const _banquetRevenue = booking.booking_category === 'banquet'
    ? (booking.booking_slots || []).reduce((t, s) => t + (s.meals || []).reduce((st, m) => st + (Number(m.pax || 0) * Number(m.rate || 0)), 0), 0)
    : 0
  const _totalToCollect = _banquetRevenue + (Number(booking.lawn_rental) || 0) + _chargeRooms * 5000 + (Number(booking.deposit_amount) || 0)
  const _advanceTarget = Number(booking.advance_target) || 0
  const newStatus = deriveStatus(booking.status, booking.payments, _totalToCollect, _advanceTarget)
  if (newStatus !== booking.status) {
    await supabase.from('bookings').update({ status: newStatus }).eq('id', bookingId)
  }
}

/**
 * Save extra_pax values back to booking_slots meals JSONB.
 * slotsWithExtraPax = [{ id, meals: [{...mealFields, extra_pax: number}] }]
 */
export async function saveExtraPlates(bookingId, slotsWithExtraPax) {
  for (const slot of slotsWithExtraPax) {
    const { error } = await supabase
      .from('booking_slots')
      .update({ meals: slot.meals })
      .eq('id', slot.id)
    if (error) throw error
  }
  return true
}

/**
 * Update commitments for a booking
 */
export async function updateCommitments(bookingId, commitmentData, userId) {
  const { data: existing } = await supabase
    .from('commitments')
    .select('id')
    .eq('booking_id', bookingId)
    .maybeSingle()

  const payload = {
    ...commitmentData,
    booking_id: bookingId,
    updated_by: userId,
    updated_at: new Date().toISOString(),
  }

  if (existing) {
    const { data, error } = await supabase
      .from('commitments')
      .update(payload)
      .eq('booking_id', bookingId)
      .select()
      .single()
    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('commitments')
      .insert(payload)
      .select()
      .single()
    if (error) throw error
    return data
  }
}

