import { useState, useContext } from 'react'
import StatusBadge from '../components/StatusBadge'
import { formatCurrency, formatDate, formatDateTime, formatSlot, VENUE_LABELS, KITCHEN_LABELS, shortId } from '../utils/formatters'
import { ToastContext } from '../App'
import { markCompleted, updateDepositStatus } from '../services/bookingService'
import { downloadReceipt, viewReceipt } from '../utils/receiptGenerator'
import { downloadBill, viewBill } from '../utils/billGenerator'
import IncidentalsModal from './IncidentalsModal'

function DepositCard({ booking, canPayment, depositLoading, setDepositLoading, onRefresh, showToast, user }) {
  const depAmt = Number(booking.deposit_amount) || 0
  if (depAmt <= 0) return null

  const depStatus = booking.deposit_status || 'Pending'
  const depDue = booking.deposit_due_date
  const today = new Date().toISOString().slice(0, 10)
  const daysUntilDue = depDue ? Math.ceil((new Date(depDue) - new Date(today)) / 86400000) : null

  const statusStyle = depStatus === 'Collected'
    ? { bg: '#e8f5e9', text: '#1b5e20', border: '#66bb6a' }
    : depStatus === 'Refunded'
      ? { bg: '#e3f2fd', text: '#0d47a1', border: '#42a5f5' }
      : daysUntilDue !== null && daysUntilDue < 0
        ? { bg: '#fce4ec', text: '#c62828', border: '#f48fb1' }
        : { bg: '#fff8e1', text: '#b36a00', border: '#f5c842' }

  async function markStatus(newStatus, loadingKey) {
    setDepositLoading(loadingKey)
    try {
      await updateDepositStatus(booking.id, newStatus, user.id)
      showToast(`Deposit marked as ${newStatus.toLowerCase()}`, 'success')
      onRefresh(booking.id)
    } catch (err) {
      showToast(err.message || 'Failed', 'error')
    } finally {
      setDepositLoading('')
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">Security Deposit</div>
      <div className="info-row">
        <span className="info-label">Amount</span>
        <span className="info-value" style={{ fontWeight: 700 }}>{formatCurrency(depAmt)}</span>
      </div>
      {depDue && (
        <div className="info-row">
          <span className="info-label">Due Date</span>
          <span className="info-value">
            {formatDate(depDue)}
            {depStatus === 'Pending' && daysUntilDue !== null && (
              <span style={{ marginLeft: 8, fontSize: '0.75rem', color: daysUntilDue < 0 ? '#c62828' : daysUntilDue <= 7 ? '#b36a00' : '#888' }}>
                {daysUntilDue < 0 ? `${Math.abs(daysUntilDue)}d overdue` : daysUntilDue === 0 ? 'Due today' : `${daysUntilDue}d remaining`}
              </span>
            )}
          </span>
        </div>
      )}
      <div className="info-row" style={{ alignItems: 'center' }}>
        <span className="info-label">Status</span>
        <span style={{
          background: statusStyle.bg, color: statusStyle.text,
          border: `1px solid ${statusStyle.border}`,
          padding: '2px 10px', borderRadius: 12, fontSize: '0.75rem', fontWeight: 700,
        }}>{depStatus}</span>
      </div>
      {canPayment && depStatus === 'Pending' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className="btn btn-sm" style={{ background: '#e8f5e9', color: '#1b5e20', border: '1px solid #66bb6a' }}
            disabled={!!depositLoading} onClick={() => markStatus('Collected', 'collect')}>
            {depositLoading === 'collect' ? '…' : 'Mark Collected'}
          </button>
          <button className="btn btn-sm" style={{ background: '#e3f2fd', color: '#0d47a1', border: '1px solid #42a5f5' }}
            disabled={!!depositLoading} onClick={() => markStatus('Refunded', 'refund')}>
            {depositLoading === 'refund' ? '…' : 'Mark Refunded'}
          </button>
        </div>
      )}
      {canPayment && depStatus === 'Collected' && (
        <div style={{ marginTop: 10 }}>
          <button className="btn btn-sm" style={{ background: '#e3f2fd', color: '#0d47a1', border: '1px solid #42a5f5' }}
            disabled={!!depositLoading} onClick={() => markStatus('Refunded', 'refund')}>
            {depositLoading === 'refund' ? '…' : 'Mark Refunded'}
          </button>
        </div>
      )}
    </div>
  )
}

export default function BookingDetailModal({ booking, onClose, onEdit, onPayment, onCancel, onPostpone, onCommitments, user, onRefresh, onPatch }) {
  const [completing, setCompleting] = useState(false)
  const [showIncidentals, setShowIncidentals] = useState(false)
  const [billLoading, setBillLoading] = useState('')
  const [depositLoading, setDepositLoading] = useState('')
  const showToast = useContext(ToastContext)
  const payments = booking.payments || []
  const slots = booking.booking_slots || []
  const amendments = (booking.amendments || []).sort((a, b) => new Date(b.changed_at) - new Date(a.changed_at))
  const commitment = (booking.commitments || [])[0] || null
  const totalPaid = payments.reduce((s, p) => s + Number(p.amount || 0), 0)
  const balance = Number(booking.total || 0) - totalPaid

  const perms = user?.permissions || []
  const canEdit = perms.includes('edit')
  const canPayment = perms.includes('payment')
  const canCancel = perms.includes('cancel')
  const canPostpone = perms.includes('postpone')
  const canCommitments = perms.includes('commitments')
  const canComplete = perms.includes('complete')
  const canIncidentals = perms.includes('incidentals')
  const canBill = perms.includes('bill')
  // Commitments section visible to users who can edit OR read-only view commitments
  const canViewCommitments = perms.includes('commitments') || perms.includes('commitments_read')

  async function handleComplete() {
    if (!window.confirm('Mark this booking as Completed?')) return
    setCompleting(true)
    // Optimistic: immediately show Completed status in the list behind the modal
    onPatch?.(booking.id, { status: 'Completed' })
    try {
      await markCompleted(booking.id, user.id)
      showToast('Booking marked as completed', 'success')
      onRefresh(booking.id)
      onClose()
    } catch (err) {
      // Rollback optimistic update
      onPatch?.(booking.id, { status: booking.status })
      showToast(err.message || 'Failed', 'error')
    } finally {
      setCompleting(false)
    }
  }

  const isActive = booking.status !== 'Cancelled' && booking.status !== 'Completed'
  const isCancelled = booking.status === 'Cancelled'
  const isCompleted = booking.status === 'Completed'
  // Bill shown for completed, or for active bookings that already have incidental items entered
  const hasIncidentals = (booking.incidental_items || []).length > 0
  const showBillButtons = canBill && !isCancelled && (isCompleted || hasIncidentals)

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
          {isCompleted && (canIncidentals || showBillButtons) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {canIncidentals && <button className="btn btn-sm btn-outline" onClick={() => setShowIncidentals(true)}>🧾 Incidentals</button>}
              {showBillButtons && (
                <>
                  <button
                    className="btn btn-sm btn-gold"
                    disabled={!!billLoading}
                    onClick={async () => { setBillLoading('download'); try { await downloadBill(booking, true) } finally { setBillLoading('') } }}
                  >{billLoading === 'download' ? '⏳…' : '⬇ Download Bill'}</button>
                  <button
                    className="btn btn-sm btn-outline"
                    disabled={!!billLoading}
                    onClick={async () => { setBillLoading('print'); try { await viewBill(booking, true) } finally { setBillLoading('') } }}
                  >{billLoading === 'print' ? '⏳…' : '👁 View Bill'}</button>
                </>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Left */}
            <div>
              <div className="card" style={{ marginBottom: 16 }}>
                <div className="card-title">Client Details</div>
                <div className="info-row"><span className="info-label">Client</span><span className="info-value">{booking.client}</span></div>
                <div className="info-row"><span className="info-label">Phone</span><span className="info-value">{booking.phone || '—'}</span></div>
                <div className="info-row"><span className="info-label">Email</span><span className="info-value">{booking.email || '—'}</span></div>
                <div className="info-row"><span className="info-label">Event</span><span className="info-value">{booking.event}</span></div>
                <div className="info-row"><span className="info-label">Type</span><span className="info-value">{booking.type}</span></div>
                <div className="info-row"><span className="info-label">Guests</span><span className="info-value">{booking.guest_count || 0}</span></div>
                <div className="info-row"><span className="info-label">Catering</span><span className="info-value">{booking.catering}</span></div>
                {booking.notes && (
                  <div style={{ marginTop: 8, padding: '8px 0', borderTop: '1px solid #eef3ee', fontSize: '0.85rem', color: '#555' }}>
                    <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' }}>Notes</div>
                    {booking.notes}
                  </div>
                )}
              </div>

              <div className="card">
                <div className="card-title">Payment Summary</div>
                <div className="info-row"><span className="info-label">Total</span><span className="info-value" style={{ color: 'var(--forest)', fontWeight: 700 }}>{formatCurrency(booking.total)}</span></div>
                <div className="info-row"><span className="info-label">Paid</span><span className="info-value" style={{ color: 'var(--grove)', fontWeight: 700 }}>{formatCurrency(totalPaid)}</span></div>
                <div className="info-row"><span className="info-label">Balance</span><span className="info-value" style={{ color: balance > 0 ? '#e65100' : '#1b5e20', fontWeight: 700 }}>{formatCurrency(balance)}</span></div>
                {Number(booking.total) > 0 && (
                  <div className="progress-bar-bg">
                    <div
                      className={`progress-bar-fill ${totalPaid >= Number(booking.total) ? 'over' : ''}`}
                      style={{ width: `${Math.min(100, (totalPaid / Number(booking.total)) * 100)}%` }}
                    />
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
                {slots.length === 0 ? <div className="text-muted text-sm">No slots</div> : slots.map((s, i) => (
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
                  </div>
                ))}
              </div>

              {/* Rooms booked */}
              {(booking.room_bookings || []).length > 0 && (
                <div className="card" style={{ marginBottom: 16 }}>
                  <div className="card-title">Room Bookings</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {(booking.room_bookings || []).slice().sort((a, b) => a.room_number - b.room_number).map(rb => (
                      <span key={rb.id} className="venue-tag" style={{ background: '#e3f2fd', color: '#1565c0' }}>
                        Room {rb.room_number}
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#555' }}>
                    <span>{(booking.room_bookings || []).length} room(s)</span>
                    {' · '}
                    <span style={{ fontWeight: 600, color: 'var(--forest)' }}>
                      {formatCurrency((booking.room_bookings || []).length * 5000)}
                    </span>
                    {' '}total room charges
                  </div>
                </div>
              )}

              {/* Security Deposit */}
              <DepositCard
                booking={booking}
                canPayment={canPayment}
                depositLoading={depositLoading}
                setDepositLoading={setDepositLoading}
                onRefresh={onRefresh}
                showToast={showToast}
                user={user}
              />

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
