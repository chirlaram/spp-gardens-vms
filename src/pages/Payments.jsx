import { useState, useContext, useMemo } from 'react'
import { useBookings } from '../hooks/useBookings'
import { useAuth } from '../hooks/useAuth'
import StatusBadge from '../components/StatusBadge'
import BookingDetailModal from '../modals/BookingDetailModal'
import PaymentModal from '../modals/PaymentModal'
import EditBookingModal from '../modals/EditBookingModal'
import CancelModal from '../modals/CancelModal'
import PostponeModal from '../modals/PostponeModal'
import CommitmentsModal from '../modals/CommitmentsModal'
import { formatCurrency, formatDate, formatDateTime, todayISO, shortId } from '../utils/formatters'
import { downloadReceipt, viewReceipt } from '../utils/receiptGenerator'
import { computeBookingTotals } from '../utils/statusCalc'
import { ToastContext } from '../App'

function bookingTotalToCollect(b) {
  return computeBookingTotals(b).totalToCollect
}

// Returns days remaining until 14-day token deadline (negative = overdue)
function tokenDaysLeft(createdAt) {
  const created = new Date(createdAt)
  const deadline = new Date(created)
  deadline.setDate(deadline.getDate() + 14)
  const today = new Date(todayISO())
  return Math.ceil((deadline - today) / (1000 * 60 * 60 * 24))
}

export default function Payments() {
  const { bookings, loading, error, refetch, refreshBooking, patchBooking } = useBookings()
  const { user } = useAuth()
  const showToast = useContext(ToastContext)
  const [activeTab, setActiveTab] = useState('bookings')
  const [modal, setModal] = useState(null)

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const activeBookings = useMemo(() => bookings.filter(b => b.status !== 'Cancelled'), [bookings])

  // Summary stats
  const { totalRevenue, totalCollected, totalBalance, tokenAdvanceCount } = useMemo(() => {
    let revenue = 0, collected = 0, tokenCount = 0
    for (const b of activeBookings) {
      revenue += bookingTotalToCollect(b)
      collected += (b.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0)
      if (b.status === 'Token Advance') tokenCount++
    }
    return { totalRevenue: revenue, totalCollected: collected, totalBalance: revenue - collected, tokenAdvanceCount: tokenCount }
  }, [activeBookings])

  // Filtered bookings for Booking View tab
  const filteredBookings = useMemo(() => activeBookings.filter(b => {
    if (statusFilter && b.status !== statusFilter) return false
    if (search) {
      const q = search.toLowerCase()
      if (!b.client.toLowerCase().includes(q) && !b.event.toLowerCase().includes(q) && !(b.phone || '').includes(q)) return false
    }
    return true
  }), [activeBookings, statusFilter, search])

  // All transactions for Ledger tab
  const allPayments = useMemo(() => bookings
    .flatMap(b => (b.payments || []).map(p => ({ ...p, booking: b })))
    .filter(p => {
      if (dateFrom && p.date < dateFrom) return false
      if (dateTo && p.date > dateTo) return false
      if (search) {
        const q = search.toLowerCase()
        if (!p.booking.client.toLowerCase().includes(q) && !(p.reference || '').toLowerCase().includes(q)) return false
      }
      return true
    })
    .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at)),
  [bookings, dateFrom, dateTo, search])

  const filteredTotal = useMemo(() => allPayments.reduce((s, p) => s + Number(p.amount || 0), 0), [allPayments])

  function handleSuccess(msg = 'Done!', bookingId = null) {
    showToast(msg, 'success')
    if (bookingId) refreshBooking(bookingId)
    else refetch()
    setModal(null)
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
      <div className="spinner" style={{ margin: '0 auto 12px', width: 32, height: 32, borderWidth: 3 }} />
      Loading payments...
    </div>
  )

  if (error) return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚠</div>
      <div style={{ color: '#c62828', fontWeight: 600, marginBottom: 8 }}>Failed to load payments</div>
      <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: 20 }}>{error}</div>
      <button className="btn btn-primary" onClick={refetch}>Retry</button>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Payment Tracker</h2>
          <div className="page-header-sub">Track booking payments and transaction ledger</div>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="payment-summary-bar">
        <div className="payment-sum-card">
          <div className="payment-sum-label">Total to Collect</div>
          <div className="payment-sum-val">{formatCurrency(totalRevenue)}</div>
        </div>
        <div className="payment-sum-card">
          <div className="payment-sum-label">Collected</div>
          <div className="payment-sum-val" style={{ color: 'var(--grove)' }}>{formatCurrency(totalCollected)}</div>
        </div>
        <div className="payment-sum-card">
          <div className="payment-sum-label">Outstanding</div>
          <div className="payment-sum-val" style={{ color: totalBalance > 0 ? '#e65100' : '#1b5e20' }}>{formatCurrency(totalBalance)}</div>
        </div>
        <div className="payment-sum-card">
          <div className="payment-sum-label">Collection Rate</div>
          <div className="payment-sum-val">
            {totalRevenue > 0 ? Math.round((totalCollected / totalRevenue) * 100) : 0}%
          </div>
        </div>
        <div className="payment-sum-card" style={{ cursor: 'pointer' }} onClick={() => setStatusFilter('Token Advance')}>
          <div className="payment-sum-label">Token Advances</div>
          <div className="payment-sum-val" style={{ color: '#b36a00' }}>{tokenAdvanceCount}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button className={`tab-btn ${activeTab === 'bookings' ? 'active' : ''}`} onClick={() => setActiveTab('bookings')}>
          Booking View
        </button>
        <button className={`tab-btn ${activeTab === 'ledger' ? 'active' : ''}`} onClick={() => setActiveTab('ledger')}>
          Transaction Ledger
        </button>
      </div>

      {activeTab === 'bookings' && (
        <>
          {/* Filters */}
          <div className="filter-bar">
            <div className="filter-group search-box">
              <div className="filter-label">Search</div>
              <div style={{ position: 'relative' }}>
                <span className="search-icon" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#aaa' }}>🔍</span>
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
              <div className="filter-label">Status</div>
              <select className="filter-control" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="Token Advance">Token Advance</option>
                <option value="Confirmed - 50% Advance">Confirmed - 50% Advance</option>
                <option value="100% Payment">100% Payment</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Event</th>
                  <th>Event Date</th>
                  <th>Status</th>
                  <th>Token Deadline</th>
                  <th>Total to be Collected</th>
                  <th>GST (18%)</th>
                  <th>Paid</th>
                  <th>Balance</th>
                  <th>Progress</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.length === 0 ? (
                  <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>No bookings found</td></tr>
                ) : filteredBookings.map(b => {
                  const paid = (b.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0)
                  const bal = bookingTotalToCollect(b) - paid
                  const ttc = bookingTotalToCollect(b); const pct = ttc > 0 ? Math.min(100, Math.round((paid / ttc) * 100)) : 0
                  const today = todayISO()
                  const nextSlot = (b.booking_slots || []).filter(s => s.date >= today).sort((a, c) => a.date.localeCompare(c.date))[0]
                    || (b.booking_slots || []).sort((a, c) => c.date.localeCompare(a.date))[0]
                  return (
                    <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => setModal({ type: 'detail', data: b })}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{b.client}</div>
                        <div style={{ fontSize: '0.75rem', color: '#888' }}>{b.phone || ''}</div>
                      </td>
                      <td>{b.event}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {nextSlot ? `${formatDate(nextSlot.date)} ${nextSlot.slot.toUpperCase()}` : <span style={{ color: '#ccc' }}>—</span>}
                      </td>
                      <td><StatusBadge status={b.status} /></td>
                      <td>
                        {b.status === 'Token Advance' && b.created_at ? (() => {
                          const days = tokenDaysLeft(b.created_at)
                          const overdue = days < 0
                          const urgent = days >= 0 && days <= 3
                          const color = overdue ? '#c62828' : urgent ? '#e65100' : '#2e7d32'
                          const bg = overdue ? '#fce4ec' : urgent ? '#fff3e0' : '#e8f5e9'
                          const label = overdue
                            ? `Overdue by ${Math.abs(days)}d`
                            : days === 0 ? 'Due today'
                            : `${days}d left`
                          return (
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color, background: bg, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>
                              {label}
                            </span>
                          )
                        })() : <span style={{ color: '#ccc' }}>—</span>}
                      </td>
                      <td style={{ fontWeight: 600 }}>{formatCurrency(bookingTotalToCollect(b))}</td>
                      <td style={{ fontWeight: 600, color: '#5c6bc0' }}>{formatCurrency(bookingTotalToCollect(b) * 0.18)}</td>
                      <td style={{ color: 'var(--grove)', fontWeight: 600 }}>{formatCurrency(paid)}</td>
                      <td style={{ color: bal > 0 ? '#e65100' : '#1b5e20', fontWeight: 600 }}>{formatCurrency(bal)}</td>
                      <td style={{ minWidth: 100 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div className="progress-bar-bg" style={{ flex: 1 }}>
                            <div className={`progress-bar-fill ${pct >= 100 ? 'over' : ''}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span style={{ fontSize: '0.72rem', color: '#888', minWidth: 30 }}>{pct}%</span>
                        </div>
                      </td>
                      <td onClick={e => e.stopPropagation()}>
                        {(user?.permissions || []).includes('payment') && b.status !== 'Completed' && (
                          <button
                            className="btn btn-gold btn-sm"
                            onClick={() => setModal({ type: 'payment', data: b })}
                          >
                            + Pay
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'ledger' && (
        <>
          <div className="filter-bar">
            <div className="filter-group search-box">
              <div className="filter-label">Search</div>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#aaa' }}>🔍</span>
                <input
                  className="filter-control"
                  placeholder="Client or reference..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ paddingLeft: 28 }}
                />
              </div>
            </div>
            <div className="filter-group">
              <div className="filter-label">From Date</div>
              <input type="date" className="filter-control" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="filter-group">
              <div className="filter-label">To Date</div>
              <input type="date" className="filter-control" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            {(dateFrom || dateTo || search) && (
              <div className="filter-group">
                <div className="filter-label">&nbsp;</div>
                <div style={{ padding: '6px 0', fontSize: '0.85rem', color: 'var(--grove)', fontWeight: 600 }}>
                  Total: {formatCurrency(filteredTotal)}
                </div>
              </div>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Event</th>
                  <th>Amount</th>
                  <th>GST (18%)</th>
                  <th>Mode</th>
                  <th>Reference</th>
                  <th>Note</th>
                  <th>Recorded</th>
                  <th>Receipt</th>
                </tr>
              </thead>
              <tbody>
                {allPayments.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>No transactions found</td></tr>
                ) : allPayments.map(p => (
                  <tr
                    key={p.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => setModal({ type: 'detail', data: p.booking })}
                  >
                    <td>{formatDate(p.date)}</td>
                    <td style={{ fontWeight: 600 }}>{p.booking.client}</td>
                    <td>{p.booking.event}</td>
                    <td style={{ fontWeight: 700, color: 'var(--grove)', fontSize: '1rem' }}>{formatCurrency(p.amount)}</td>
                    <td style={{ fontWeight: 600, color: '#5c6bc0' }}>{formatCurrency(Number(p.amount || 0) * 0.18)}</td>
                    <td style={{ textTransform: 'capitalize' }}>{p.mode?.replace('_', ' ')}</td>
                    <td style={{ color: '#888' }}>{p.reference || '—'}</td>
                    <td style={{ color: '#888' }}>{p.note || '—'}</td>
                    <td style={{ color: '#aaa', fontSize: '0.78rem' }}>{formatDateTime(p.recorded_at)}</td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="btn btn-sm btn-outline"
                          style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                          onClick={() => downloadReceipt(p.booking, p, shortId(p.id))}
                          title="Download Receipt PDF"
                        >⬇ PDF</button>
                        <button
                          className="btn btn-sm btn-outline"
                          style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                          onClick={() => viewReceipt(p.booking, p, shortId(p.id))}
                          title="Print Receipt"
                        >👁 View</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {allPayments.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan={3} style={{ fontWeight: 600, color: 'var(--forest)', padding: '10px 14px', borderTop: '2px solid #e0ebe0' }}>
                      Total ({allPayments.length} transactions)
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--grove)', fontSize: '1.05rem', padding: '10px 14px', borderTop: '2px solid #e0ebe0' }}>
                      {formatCurrency(filteredTotal)}
                    </td>
                    <td colSpan={6} style={{ borderTop: '2px solid #e0ebe0' }}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}

      {/* Modals */}
      {modal?.type === 'detail' && (
        <BookingDetailModal
          booking={modal.data}
          onClose={() => setModal(null)}
          onEdit={b => setModal({ type: 'edit', data: b })}
          onPayment={b => setModal({ type: 'payment', data: b })}
          onCancel={b => setModal({ type: 'cancel', data: b })}
          onPostpone={b => setModal({ type: 'postpone', data: b })}
          onCommitments={b => setModal({ type: 'commitments', data: b })}
          user={user}
          onRefresh={async id => { const u = await refreshBooking(id); if (u) setModal(m => m?.type === 'detail' && m.data?.id === id ? { ...m, data: u } : m) }}
          onPatch={patchBooking}
        />
      )}
      {modal?.type === 'payment' && (
        <PaymentModal
          booking={modal.data}
          onClose={() => setModal(null)}
          onSuccess={id => handleSuccess('Payment recorded!', id)}
          user={user}
          onPatch={patchBooking}
        />
      )}
      {modal?.type === 'edit' && (
        <EditBookingModal
          booking={modal.data}
          onClose={() => setModal(null)}
          onSuccess={id => handleSuccess('Booking updated!', id)}
          user={user}
          bookings={bookings}
        />
      )}
      {modal?.type === 'cancel' && (
        <CancelModal
          booking={modal.data}
          onClose={() => setModal(null)}
          onSuccess={id => handleSuccess('Booking cancelled', id)}
          user={user}
          onPatch={patchBooking}
        />
      )}
      {modal?.type === 'postpone' && (
        <PostponeModal
          booking={modal.data}
          onClose={() => setModal(null)}
          onSuccess={id => handleSuccess('Booking postponed!', id)}
          user={user}
          bookings={bookings}
        />
      )}
      {modal?.type === 'commitments' && (
        <CommitmentsModal
          booking={modal.data}
          onClose={() => setModal({ type: 'detail', data: modal.data })}
          onSuccess={async (id, savedCommitment) => {
            showToast('Commitments saved!', 'success')
            const updatedBooking = { ...modal.data, commitments: [savedCommitment] }
            setModal({ type: 'detail', data: updatedBooking })
            refreshBooking(id)
          }}
          user={user}
        />
      )}
    </div>
  )
}
