import { useState, useContext } from 'react'
import { useBookings } from '../hooks/useBookings'
import { useAuth } from '../hooks/useAuth'
import BookingDetailModal from '../modals/BookingDetailModal'
import { formatCurrency, formatDate, formatDateTime, VENUE_LABELS } from '../utils/formatters'
import { ToastContext } from '../App'

export default function Cancelled() {
  const { bookings, loading, error, refetch } = useBookings()
  const { user } = useAuth()
  const showToast = useContext(ToastContext)
  const [modal, setModal] = useState(null)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const cancelledBookings = bookings
    .filter(b => b.status === 'Cancelled')
    .filter(b => {
      if (search) {
        const q = search.toLowerCase()
        if (!b.client.toLowerCase().includes(q) && !b.event.toLowerCase().includes(q) && !(b.phone || '').includes(q)) return false
      }
      // Filter by cancellation date (from amendments)
      const cancelAmendment = (b.amendments || []).find(a => a.type === 'cancel')
      if (cancelAmendment) {
        const cancelDate = cancelAmendment.changed_at?.slice(0, 10) || ''
        if (dateFrom && cancelDate < dateFrom) return false
        if (dateTo && cancelDate > dateTo) return false
      }
      return true
    })
    .sort((a, b) => {
      const aAmend = (a.amendments || []).find(am => am.type === 'cancel')
      const bAmend = (b.amendments || []).find(am => am.type === 'cancel')
      return new Date(bAmend?.changed_at || b.created_at) - new Date(aAmend?.changed_at || a.created_at)
    })

  // Stats
  const totalCancelled = cancelledBookings.length
  const totalForfeited = cancelledBookings.reduce((s, b) => {
    const forfeited = (b.amendments || []).some(a => a.changed_field === 'advance_forfeited' && a.new_value === 'true')
    return forfeited ? s + (b.payments || []).reduce((sp, p) => sp + Number(p.amount || 0), 0) : s
  }, 0)

  function handleSuccess(msg = 'Done!') {
    showToast(msg, 'success')
    refetch()
    setModal(null)
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
      <div className="spinner" style={{ margin: '0 auto 12px', width: 32, height: 32, borderWidth: 3 }} />
      Loading...
    </div>
  )

  if (error) return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚠</div>
      <div style={{ color: '#c62828', fontWeight: 600, marginBottom: 8 }}>Failed to load cancelled bookings</div>
      <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: 20 }}>{error}</div>
      <button className="btn btn-primary" onClick={refetch}>Retry</button>
    </div>
  )

  return (
    <div className="cancelled-page">
      <div className="page-header">
        <div>
          <h2>Cancelled Bookings</h2>
          <div className="page-header-sub">{totalCancelled} cancellation{totalCancelled !== 1 ? 's' : ''} total</div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="payment-sum-card">
          <div className="payment-sum-label">Total Cancelled</div>
          <div className="payment-sum-val">{totalCancelled}</div>
        </div>
        <div className="payment-sum-card">
          <div className="payment-sum-label">Advance Forfeited</div>
          <div className="payment-sum-val" style={{ color: '#c62828' }}>{formatCurrency(totalForfeited)}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar" style={{ marginBottom: 20 }}>
        <div className="filter-group">
          <div className="filter-label">Search</div>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#aaa', fontSize: '0.85rem' }}>🔍</span>
            <input
              className="filter-control"
              placeholder="Client, event, phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: 28 }}
            />
          </div>
        </div>
        <div className="filter-group">
          <div className="filter-label">Cancelled From</div>
          <input type="date" className="filter-control" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
        </div>
        <div className="filter-group">
          <div className="filter-label">Cancelled To</div>
          <input type="date" className="filter-control" value={dateTo} onChange={e => setDateTo(e.target.value)} />
        </div>
        {(search || dateFrom || dateTo) && (
          <div className="filter-group">
            <div className="filter-label">&nbsp;</div>
            <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setDateFrom(''); setDateTo('') }}>
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {cancelledBookings.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">✕</div>
          <div className="empty-state-text">
            {search || dateFrom || dateTo ? 'No cancelled bookings match your filters' : 'No cancelled bookings'}
          </div>
        </div>
      ) : (
        <div>
          {cancelledBookings.map(b => {
            const cancelAmendment = (b.amendments || []).find(a => a.type === 'cancel' && a.changed_field === 'status')
            const forfeitedAmendment = (b.amendments || []).find(a => a.changed_field === 'advance_forfeited')
            const paid = (b.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0)
            const slots = b.booking_slots || []
            const firstSlot = slots[0]
            const venues = firstSlot ? (firstSlot.venues || []).map(v => VENUE_LABELS[v] || v).join(', ') : ''

            return (
              <div
                key={b.id}
                className="cancelled-item"
                style={{ cursor: 'pointer' }}
                onClick={() => setModal({ type: 'detail', data: b })}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div className="cancelled-client">{b.client}</div>
                    <div className="cancelled-meta">
                      {b.event} · {b.type}
                      {b.phone && ` · ${b.phone}`}
                    </div>
                    {firstSlot && (
                      <div className="cancelled-meta">
                        {formatDate(firstSlot.date)} {firstSlot.slot.toUpperCase()}
                        {venues && ` · ${venues}`}
                      </div>
                    )}
                    {cancelAmendment?.reason && (
                      <div style={{ marginTop: 6, fontSize: '0.82rem', color: '#880e4f', background: '#fce4ec', padding: '4px 10px', borderRadius: 'var(--radius-sm)', display: 'inline-block' }}>
                        Reason: {cancelAmendment.reason}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontWeight: 700, color: 'var(--forest)', fontSize: '1.05rem' }}>{formatCurrency(b.total)}</div>
                    {paid > 0 && (
                      <div style={{ fontSize: '0.8rem', color: forfeitedAmendment ? '#c62828' : 'var(--grove)', fontWeight: 600 }}>
                        {forfeitedAmendment ? '⚠ Forfeited: ' : 'Paid: '}{formatCurrency(paid)}
                      </div>
                    )}
                    <div style={{ fontSize: '0.72rem', color: '#bbb', marginTop: 2 }}>
                      {cancelAmendment ? formatDateTime(cancelAmendment.changed_at) : formatDateTime(b.created_at)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal?.type === 'detail' && (
        <BookingDetailModal
          booking={modal.data}
          onClose={() => setModal(null)}
          onEdit={() => {}}
          onPayment={() => {}}
          onCancel={() => {}}
          onPostpone={() => {}}
          onCommitments={() => {}}
          user={user}
          onRefresh={refetch}
        />
      )}
    </div>
  )
}
