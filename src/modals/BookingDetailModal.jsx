import { useState, useContext } from 'react'
import StatusBadge from '../components/StatusBadge'
import { formatCurrency, formatDate, formatDateTime, formatSlot, VENUE_LABELS, KITCHEN_LABELS, shortId } from '../utils/formatters'
import { ToastContext } from '../App'
import { markCompleted } from '../services/bookingService'
import { computeBookingTotals } from '../utils/statusCalc'
import { downloadReceipt, viewReceipt } from '../utils/receiptGenerator'
import { downloadBill, viewBill } from '../utils/billGenerator'
import IncidentalsModal from './IncidentalsModal'

export default function BookingDetailModal({ booking, onClose, onEdit, onPayment, onCancel, onPostpone, onCommitments, user, onRefresh, onPatch, eventsView = false }) {
  const [completing, setCompleting] = useState(false)
  const [showIncidentals, setShowIncidentals] = useState(false)
  const [billLoading, setBillLoading] = useState('')
  const showToast = useContext(ToastContext)
  const payments = booking.payments || []
  const slots = booking.booking_slots || []
  const amendments = (booking.amendments || []).sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at))
  const commitment = (booking.commitments || [])[0] || null
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0)

  const { lawnRental, roomCharges, chargeRooms, depositAmount, banquetRevenue, totalBookingValue, totalToCollect, advanceTarget } = computeBookingTotals(booking)
  const balance = totalToCollect - totalPaid
  const isBanquet = booking.booking_category === 'banquet'

  const perms = user?.permissions || []
  const canEdit = !eventsView && perms.includes('edit')
  const canPayment = !eventsView && perms.includes('payment')
  const canCancel = !eventsView && perms.includes('cancel')
  const canPostpone = !eventsView && perms.includes('postpone')
  const canCommitments = perms.includes('commitments')
  const canComplete = perms.includes('complete')
  const canIncidentals = perms.includes('incidentals')
  const canBill = perms.includes('bill')
  const canViewCommitments = perms.includes('commitments') || perms.includes('commitments_read')

  async function handleComplete() {
    if (!window.confirm('Mark this booking as Completed?')) return
    setCompleting(true)
    onPatch?.(booking.id, { status: 'Completed' })
    try {
      await markCompleted(booking.id, user.id)
      showToast('Booking marked as completed', 'success')
      onRefresh(booking.id)
      onClose()
    } catch (err) {
      onPatch?.(booking.id, { status: booking.status })
      showToast(err.message || 'Failed', 'error')
    } finally {
      setCompleting(false)
    }
  }

  const isActive = booking.status !== 'Cancelled' && booking.status !== 'Completed'
  const isCancelled = booking.status === 'Cancelled'
  const isCompleted = booking.status === 'Completed'
  const hasIncidentals = (booking.incidental_items || []).length > 0
  const hasBillableContent = lawnRental > 0 || banquetRevenue > 0 || hasIncidentals
  const showBillButtons = canBill && !isCancelled && (isCompleted || hasBillableContent)

  return (
    <>
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="modal-header-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div className="modal-title">{booking.client}</div>
              <StatusBadge status={booking.status} />
            </div>
            <div className="modal-subtitle">
              {booking.event} · #{shortId(booking.id)}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* Action Buttons — active bookings */}
          {isActive && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {canPayment && <button className="btn btn-gold btn-sm" onClick={() => onPayment(booking)}>+ Payment</button>}
              {canEdit && <button className="btn btn-outline btn-sm" onClick={() => onEdit(booking)}>Edit</button>}
              {canPostpone && <button className="btn btn-outline btn-sm" onClick={() => onPostpone(booking)}>Postpone</button>}
              {canCommitments && <button className="btn btn-gold btn-sm" onClick={() => onCommitments(booking)}>📋 Commitments</button>}
              {canIncidentals && <button className="btn btn-sm btn-outline" onClick={() => setShowIncidentals(true)}>🧾 Incidentals</button>}
              {canComplete && <button className="btn btn-sm" style={{ background: '#f3e5f5', color: '#4a148c', border: '1px solid #ab47bc' }} onClick={handleComplete} disabled={completing}>
                {completing ? '…' : 'Mark Completed'}
              </button>}
              {canCancel && <button className="btn btn-sm" style={{ background: '#fce4ec', color: '#c62828', border: '1px solid #f48fb1' }} onClick={() => onCancel(booking)}>Cancel</button>}
            </div>
          )}
          {/* Action Buttons — completed bookings */}
          {isCompleted && canIncidentals && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              <button className="btn btn-sm btn-outline" onClick={() => setShowIncidentals(true)}>🧾 Incidentals</button>
            </div>
          )}

          <div className="booking-detail-grid">
            {/* Left */}
            <div>
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-title">Client Details</div>
                <div className="info-row"><span className="info-label">Client</span><span className="info-value">{booking.client}</span></div>
                <div className="info-row"><span className="info-label">Phone</span><span className="info-value">{booking.phone || '—'}</span></div>
                <div className="info-row"><span className="info-label">Email</span><span className="info-value">{booking.email || '—'}</span></div>
                <div className="info-row"><span className="info-label">Event</span><span className="info-value">{booking.event}</span></div>
                <div className="info-row"><span className="info-label">Type</span><span className="info-value">{booking.type}</span></div>
                <div className="info-row">
                  <span className="info-label">Booking</span>
                  <span className="info-value">
                    <span style={{ padding: '1px 8px', borderRadius: 10, fontSize: '0.78rem', fontWeight: 600, background: isBanquet ? '#f0faf0' : '#f0f4ff', color: isBanquet ? '#166534' : '#1e3a8a', border: `1px solid ${isBanquet ? '#86efac' : '#bfdbfe'}` }}>
                      {isBanquet ? 'Banquet' : 'Venue Rental'}
                    </span>
                  </span>
                </div>
                <div className="info-row"><span className="info-label">Guests</span><span className="info-value">{booking.guest_count || 0}</span></div>
                {!isBanquet && <div className="info-row"><span className="info-label">Catering</span><span className="info-value">{booking.catering}</span></div>}
                {booking.notes && (
                  <div style={{ marginTop: 8, padding: '8px 0', borderTop: '1px solid #eef3ee', fontSize: '0.85rem', color: '#555' }}>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>Notes</div>
                    {booking.notes}
                  </div>
                )}
              </div>

              <div className="card">
                <div className="card-title">Payment Summary</div>

                {/* Line items */}
                {isBanquet && banquetRevenue > 0 && (
                  <div className="info-row">
                    <span className="info-label">Banquet Revenue</span>
                    <span className="info-value" style={{ color: 'var(--grove)', fontWeight: 600 }}>{formatCurrency(banquetRevenue)}</span>
                  </div>
                )}
                {(lawnRental > 0 || !isBanquet) && (
                  <div className="info-row">
                    <span className="info-label">Lawn Rental</span>
                    <span className="info-value">{formatCurrency(lawnRental)}</span>
                  </div>
                )}
                {chargeRooms > 0 && (
                  <div className="info-row">
                    <span className="info-label">Room Charges ({chargeRooms} × ₹5,000)</span>
                    <span className="info-value">{formatCurrency(roomCharges)}</span>
                  </div>
                )}
                <div className="info-row" style={{ borderTop: '1px solid #eef3ee', paddingTop: 6, marginTop: 4 }}>
                  <span className="info-label" style={{ fontWeight: 600 }}>Total Booking Value</span>
                  <span className="info-value" style={{ fontWeight: 700, color: 'var(--forest)' }}>{formatCurrency(totalBookingValue)}</span>
                </div>
                {depositAmount > 0 && (
                  <div className="info-row">
                    <span className="info-label">Incidental Charges Deposit</span>
                    <span className="info-value">{formatCurrency(depositAmount)}</span>
                  </div>
                )}
                <div className="info-row" style={{ borderTop: '1px solid #eef3ee', paddingTop: 6, marginTop: 4 }}>
                  <span className="info-label" style={{ fontWeight: 600 }}>Total to be Collected</span>
                  <span className="info-value" style={{ fontWeight: 700, color: 'var(--forest)' }}>{formatCurrency(totalToCollect)}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Amount Paid</span>
                  <span className="info-value" style={{ color: 'var(--grove)', fontWeight: 700 }}>{formatCurrency(totalPaid)}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Balance</span>
                  <span className="info-value" style={{ color: balance > 0 ? '#e65100' : '#1b5e20', fontWeight: 700 }}>{formatCurrency(Math.abs(balance))}{balance < 0 ? ' (excess)' : ''}</span>
                </div>

                {/* Progress bar based on totalToCollect */}
                {totalToCollect > 0 && (
                  <div className="progress-bar-bg" style={{ marginTop: 8 }}>
                    <div
                      className={`progress-bar-fill ${totalPaid >= totalToCollect ? 'over' : ''}`}
                      style={{ width: `${Math.min(100, (totalPaid / totalToCollect) * 100)}%` }}
                    />
                  </div>
                )}

                {/* Advance target indicator */}
                {advanceTarget > 0 && (
                  <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 6 }}>
                    Advance target: {formatCurrency(advanceTarget)} ({isBanquet ? '50% of banquet revenue' : '50% of lawn rental'})
                    {totalPaid >= advanceTarget && <span style={{ color: '#1b5e20', fontWeight: 600, marginLeft: 6 }}>✓ Met</span>}
                  </div>
                )}

                {/* Deposit due date */}
                {depositAmount > 0 && booking.deposit_due_date && (
                  <div style={{ fontSize: '0.75rem', color: '#888', marginTop: 4 }}>
                    Deposit due: {formatDate(booking.deposit_due_date)}
                  </div>
                )}

                {payments.length > 0 && (
                  <div className="payment-history" style={{ marginTop: 12 }}>
                    <div className="payment-history-title">Payment History</div>
                    {payments.map(p => (
                      <div key={p.id} className="payment-history-item">
                        <div style={{ flex: 1 }}>
                          <div className="payment-amount">{formatCurrency(p.amount)}</div>
                          <div className="payment-meta">{formatDate(p.date)} · {p.mode} {p.reference ? `· Ref: ${p.reference}` : ''}</div>
                          {p.note && <div className="payment-meta">{p.note}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                          <button
                            className="btn btn-sm btn-outline"
                            style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                            onClick={() => downloadReceipt(booking, p, shortId(p.id))}
                            title="Download Receipt"
                          >⬇ PDF</button>
                          <button
                            className="btn btn-sm btn-outline"
                            style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                            onClick={() => viewReceipt(booking, p, shortId(p.id))}
                            title="Print Receipt"
                          >👁 View</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right */}
            <div>
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-title">Booking Slots</div>
                {slots.length === 0 ? <div className="text-muted text-sm">No slots</div> : slots.map((s, i) => {
                  const slotMeals = s.meals || []
                  const slotTotal = slotMeals.reduce((sum, m) => sum + (Number(m.pax || 0) + Number(m.extra_pax || 0)) * Number(m.rate || 0), 0)
                  return (
                    <div key={s.id || i} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: i < slots.length - 1 ? '1px solid #eef3ee' : 'none' }}>
                      <div style={{ fontWeight: 600, color: 'var(--forest)', marginBottom: 4 }}>
                        {formatDate(s.date)} — {formatSlot(s.slot)}
                      </div>
                      <div className="day-booking-venues">
                        {(s.venues || []).map(v => (
                          <span key={v} className="venue-tag">{VENUE_LABELS[v] || v}</span>
                        ))}
                        {s.kitchen && <span className="venue-tag" style={{ background: '#fff8e8', color: '#8a6c00' }}>{KITCHEN_LABELS[s.kitchen] || s.kitchen}</span>}
                      </div>
                      {isBanquet && slotMeals.length > 0 && (
                        <div style={{ marginTop: 8, paddingLeft: 4 }}>
                          {slotMeals.map((m, mi) => (
                            <div key={mi} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#555', padding: '2px 0' }}>
                              <span style={{ textTransform: 'capitalize' }}>
                                {m.meal_type} — {m.menu} × {m.pax || 0} pax
                                {Number(m.extra_pax) > 0 && <span style={{ color: '#b36a00' }}> +{m.extra_pax} extra</span>}
                              </span>
                              <span style={{ fontWeight: 500, color: 'var(--forest)' }}>₹{((Number(m.pax || 0) + Number(m.extra_pax || 0)) * (Number(m.rate) || 0)).toLocaleString('en-IN')}</span>
                            </div>
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600, color: 'var(--forest)', borderTop: '1px dashed #b2d8b4', marginTop: 4, paddingTop: 4 }}>
                            <span>Slot total</span>
                            <span>₹{slotTotal.toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Rooms — show if reserved or allotted */}
              {((booking.rooms_required || 0) > 0 || (booking.room_bookings || []).length > 0) && (() => {
                const reserved = booking.rooms_required || 0
                const allotted = (booking.room_bookings || []).slice().sort((a, b) => a.room_number - b.room_number)
                const keysIssued = allotted.filter(rb => rb.key_issued_at).length
                return (
                  <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-title">Rooms</div>

                    {/* Reserved vs allotted summary row */}
                    <div style={{ display: 'flex', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--forest)', lineHeight: 1 }}>{reserved}</div>
                        <div style={{ fontSize: '0.68rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>Reserved</div>
                      </div>
                      <div style={{ color: '#ddd', alignSelf: 'center', fontSize: '1.2rem' }}>→</div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: allotted.length > 0 ? '#1565c0' : '#ccc', lineHeight: 1 }}>{allotted.length}</div>
                        <div style={{ fontSize: '0.68rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>Allotted</div>
                      </div>
                      <div style={{ color: '#ddd', alignSelf: 'center', fontSize: '1.2rem' }}>·</div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 700, color: keysIssued > 0 ? '#059669' : '#ccc', lineHeight: 1 }}>{keysIssued}</div>
                        <div style={{ fontSize: '0.68rem', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.04em', marginTop: 2 }}>Keys Out</div>
                      </div>
                    </div>

                    {/* Allotted room numbers with key status */}
                    {allotted.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                        {allotted.map(rb => (
                          <span
                            key={rb.id}
                            style={{
                              padding: '3px 9px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600,
                              background: rb.key_issued_at ? '#d1fae5' : '#e3f2fd',
                              color:      rb.key_issued_at ? '#065f46'  : '#1565c0',
                              border: `1px solid ${rb.key_issued_at ? '#6ee7b7' : '#90caf9'}`,
                            }}
                            title={rb.key_issued_at ? 'Key issued' : 'Key not yet issued'}
                          >
                            {rb.key_issued_at ? '🔑' : '🚪'} Room {rb.room_number}
                          </span>
                        ))}
                      </div>
                    ) : reserved > 0 ? (
                      <div style={{ fontSize: '0.78rem', color: '#f59e0b', fontWeight: 600, marginBottom: 8 }}>
                        ⚠ Room numbers not yet assigned — pending allotment
                      </div>
                    ) : null}

                    {/* Notes from allotment */}
                    {allotted[0]?.notes && (
                      <div style={{ fontSize: '0.78rem', color: '#666', fontStyle: 'italic', marginBottom: 6 }}>
                        📝 {allotted[0].notes}
                      </div>
                    )}

                    {/* Room charges */}
                    <div style={{ fontSize: '0.82rem', color: '#555', borderTop: '1px solid #eef3ee', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{chargeRooms} room{chargeRooms !== 1 ? 's' : ''} × ₹5,000</span>
                      <span style={{ fontWeight: 700, color: 'var(--forest)' }}>{formatCurrency(roomCharges)}</span>
                    </div>
                  </div>
                )
              })()}

              {commitment && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="card-title">Commitments</div>
                  {commitment.extra_services && (
                    <div className="commitment-section">
                      <div className="commitment-section-header">Extra Services</div>
                      <div className="commitment-section-body">{commitment.extra_services}</div>
                    </div>
                  )}
                  {commitment.discount > 0 && (
                    <div className="commitment-section">
                      <div className="commitment-section-header">Discount</div>
                      <div className="commitment-section-body">{formatCurrency(commitment.discount)} {commitment.discount_note ? `— ${commitment.discount_note}` : ''}</div>
                    </div>
                  )}
                  {commitment.food_promises && (
                    <div className="commitment-section">
                      <div className="commitment-section-header">Food Promises</div>
                      <div className="commitment-section-body">{commitment.food_promises}</div>
                    </div>
                  )}
                  {commitment.venue_arrangements && (
                    <div className="commitment-section">
                      <div className="commitment-section-header">Venue Arrangements</div>
                      <div className="commitment-section-body">{commitment.venue_arrangements}</div>
                    </div>
                  )}
                  {commitment.timing_access && (
                    <div className="commitment-section">
                      <div className="commitment-section-header">Timing & Access</div>
                      <div className="commitment-section-body">{commitment.timing_access}</div>
                    </div>
                  )}
                  {commitment.complimentary_rooms && (
                    <div className="commitment-section">
                      <div className="commitment-section-header">Complimentary Rooms</div>
                      <div className="commitment-section-body">{commitment.complimentary_rooms}</div>
                    </div>
                  )}
                  {commitment.other_notes && (
                    <div className="commitment-section">
                      <div className="commitment-section-header">Other Notes</div>
                      <div className="commitment-section-body">{commitment.other_notes}</div>
                    </div>
                  )}
                </div>
              )}

              {amendments.length > 0 && (
                <div className="card">
                  <div className="card-title">Audit Trail</div>
                  <div className="amendment-list">
                    {amendments.slice(0, 10).map(a => (
                      <div key={a.id} className="amendment-item">
                        <div className="amendment-type">{a.type} — {a.changed_field}</div>
                        {a.reason && <div className="amendment-detail">Reason: {a.reason}</div>}
                        {a.old_value && a.new_value && (
                          <div className="amendment-detail" style={{ fontSize: '0.75rem', color: '#888' }}>
                            {a.old_value} → {a.new_value}
                          </div>
                        )}
                        <div className="amendment-meta">{formatDateTime(a.changed_at)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <div style={{ fontSize: '0.75rem', color: '#aaa', flex: 1 }}>
            Created {formatDateTime(booking.created_at)}
          </div>
          {showBillButtons && (
            <>
              {!isCompleted && (
                <span style={{ fontSize: '0.72rem', color: '#b36a00', fontWeight: 600, alignSelf: 'center' }}>ESTIMATE</span>
              )}
              <button
                className="btn btn-sm btn-outline"
                disabled={!!billLoading}
                onClick={async () => { setBillLoading('download'); try { await downloadBill(booking, isCompleted) } finally { setBillLoading('') } }}
              >{billLoading === 'download' ? '⏳…' : '⬇ Bill PDF'}</button>
              <button
                className="btn btn-sm btn-outline"
                disabled={!!billLoading}
                onClick={async () => { setBillLoading('print'); try { await viewBill(booking, isCompleted) } finally { setBillLoading('') } }}
              >{billLoading === 'print' ? '⏳…' : '👁 View Bill'}</button>
            </>
          )}
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>

    {showIncidentals && (
      <IncidentalsModal
        booking={booking}
        user={user}
        onClose={() => setShowIncidentals(false)}
        onSuccess={id => {
          setShowIncidentals(false)
          onRefresh(id)
        }}
      />
    )}
    </>
  )
}
