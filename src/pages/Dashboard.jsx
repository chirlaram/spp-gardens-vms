import { useState, useContext, useMemo } from 'react'
import { useBookings } from '../hooks/useBookings'
import { useAuth } from '../hooks/useAuth'
import StatusBadge from '../components/StatusBadge'
import NewBookingModal from '../modals/NewBookingModal'
import BookingDetailModal from '../modals/BookingDetailModal'
import PaymentModal from '../modals/PaymentModal'
import EditBookingModal from '../modals/EditBookingModal'
import CancelModal from '../modals/CancelModal'
import PostponeModal from '../modals/PostponeModal'
import CommitmentsModal from '../modals/CommitmentsModal'
import { formatCurrency, formatDate, todayISO, VENUE_LABELS, KITCHEN_LABELS } from '../utils/formatters'
import { MONTH_NAMES_SHORT as MONTH_NAMES } from '../utils/constants'
import { ToastContext } from '../App'

const VENUES = Object.entries(VENUE_LABELS).map(([key, label]) => ({ key, label }))
const KITCHENS = Object.entries(KITCHEN_LABELS).map(([key, label]) => ({ key, label }))

// Indian Financial Year helpers (April–March)
function getCurrentFY() {
  const today = new Date()
  const y = today.getFullYear()
  const m = today.getMonth() // 0-indexed; April = 3
  const fyStart = m >= 3 ? y : y - 1
  return { from: `${fyStart}-04-01`, to: `${fyStart + 1}-03-31`, label: `FY ${fyStart}-${String(fyStart + 1).slice(2)}` }
}
function getNextFY() {
  const cur = getCurrentFY()
  const fyStart = Number(cur.from.slice(0, 4)) + 1
  return { from: `${fyStart}-04-01`, to: `${fyStart + 1}-03-31`, label: `FY ${fyStart}-${String(fyStart + 1).slice(2)}` }
}
function getCurrentMonth() {
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${lastDay}` }
}

function bookingInRange(booking, from, to) {
  return (booking.booking_slots || []).some(s => {
    if (from && s.date < from) return false
    if (to && s.date > to) return false
    return true
  })
}

export default function Dashboard() {
  const { bookings, loading, error, refetch, refreshBooking, patchBooking, addBooking } = useBookings()
  const { user, hasPermission } = useAuth()
  const showToast = useContext(ToastContext)
  const [modal, setModal] = useState(null)

  // Date range filter
  const [rangeMode, setRangeMode] = useState('current-fy')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  // Upcoming toggle
  const [upcomingDays, setUpcomingDays] = useState(30)

  const today = todayISO()

  // Compute active date range
  const { from: rangeFrom, to: rangeTo } = useMemo(() => {
    if (rangeMode === 'current-fy') return getCurrentFY()
    if (rangeMode === 'next-fy') return getNextFY()
    if (rangeMode === 'current-month') return getCurrentMonth()
    return { from: customFrom, to: customTo }
  }, [rangeMode, customFrom, customTo])

  const activeBookings = bookings.filter(b => b.status !== 'Cancelled')
  const cancelledBookings = bookings.filter(b => b.status === 'Cancelled')

  // Bookings in selected date range
  const rangeBookings = useMemo(() =>
    activeBookings.filter(b => bookingInRange(b, rangeFrom, rangeTo)),
    [activeBookings, rangeFrom, rangeTo]
  )

  // Stat card calculations (range-aware)
  const totalRevenue = rangeBookings.reduce((s, b) => s + Number(b.total || 0), 0)
  const totalPaid = rangeBookings.reduce((s, b) =>
    s + (b.payments || []).reduce((sp, p) => sp + Number(p.amount || 0), 0), 0)
  const pendingBalance = totalRevenue - totalPaid
  // Overall venue occupancy for selected date range
  const overallOccupancy = useMemo(() => {
    if (!rangeFrom || !rangeTo) return 0
    const bookedSlots = new Set()
    for (const b of rangeBookings) {
      for (const s of (b.booking_slots || [])) {
        if (s.date < rangeFrom || s.date > rangeTo) continue
        for (const v of (s.venues || [])) {
          bookedSlots.add(`${v}:${s.date}:${s.slot}`)
        }
      }
    }
    const days = Math.round((new Date(rangeTo) - new Date(rangeFrom)) / (1000 * 60 * 60 * 24)) + 1
    const total = days * 5 * 2 // 5 venues × AM + PM
    return total > 0 ? Math.round((bookedSlots.size / total) * 100) : 0
  }, [rangeBookings, rangeFrom, rangeTo])

  const upcomingCount = activeBookings.filter(b =>
    (b.booking_slots || []).some(s => s.date >= today)
  ).length

  // Today's events (always global)
  const todayBookings = bookings.filter(b => {
    if (b.status === 'Cancelled') return false
    return (b.booking_slots || []).some(s => s.date === today)
  })

  // Upcoming bookings (7 or 30 days from today)
  const upcomingBookings = useMemo(() => {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() + upcomingDays)
    const cutoffISO = cutoffDate.toISOString().slice(0, 10)
    return activeBookings
      .filter(b => (b.booking_slots || []).some(s => s.date >= today && s.date <= cutoffISO))
      .sort((a, b) => {
        const aDate = Math.min(...(a.booking_slots || []).filter(s => s.date >= today).map(s => new Date(s.date)))
        const bDate = Math.min(...(b.booking_slots || []).filter(s => s.date >= today).map(s => new Date(s.date)))
        return aDate - bDate
      })
      .slice(0, 15)
  }, [activeBookings, upcomingDays, today])

  // Venue occupancy (always this month) — computed once per activeBookings change
  const thisMonth = today.slice(0, 7)
  const venueOccupancyMap = useMemo(() => {
    const counts = {}
    for (const b of activeBookings) {
      for (const s of (b.booking_slots || [])) {
        if (!s.date.startsWith(thisMonth)) continue
        for (const v of (s.venues || [])) counts[v] = (counts[v] || 0) + 1
        if (s.kitchen) counts[s.kitchen] = (counts[s.kitchen] || 0) + 1
      }
    }
    const [y, m] = thisMonth.split('-').map(Number)
    const daysInMonth = new Date(y, m, 0).getDate()
    const totalSlots = daysInMonth * 2
    const result = {}
    for (const key of Object.keys(counts)) result[key] = Math.round((counts[key] / totalSlots) * 100)
    return result
  }, [activeBookings, thisMonth])
  function getVenueOccupancy(key) { return venueOccupancyMap[key] || 0 }

  // Recent payments (always global)
  const recentPayments = useMemo(() =>
    activeBookings
      .flatMap(b => (b.payments || []).map(p => ({ ...p, booking: b })))
      .sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at))
      .slice(0, 8),
  [activeBookings])

  // Revenue by month within range
  const monthlyRevenue = useMemo(() => {
    if (!rangeFrom || !rangeTo) return []
    const months = []
    const start = new Date(rangeFrom.slice(0, 7) + '-01')
    const end = new Date(rangeTo.slice(0, 7) + '-01')
    const cur = new Date(start)
    while (cur <= end) {
      const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`
      months.push({ key, label: `${MONTH_NAMES[cur.getMonth()]} ${String(cur.getFullYear()).slice(2)}`, revenue: 0, collected: 0 })
      cur.setMonth(cur.getMonth() + 1)
    }
    for (const b of rangeBookings) {
      const slotsInRange = (b.booking_slots || [])
        .filter(s => s.date >= rangeFrom && s.date <= rangeTo)
        .sort((a, b) => a.date.localeCompare(b.date))
      if (!slotsInRange.length) continue
      const monthKey = slotsInRange[0].date.slice(0, 7)
      const entry = months.find(m => m.key === monthKey)
      if (entry) {
        entry.revenue += Number(b.total || 0)
        entry.collected += (b.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0)
      }
    }
    return months
  }, [rangeBookings, rangeFrom, rangeTo])

  const maxMonthRevenue = Math.max(...monthlyRevenue.map(m => m.revenue), 1)

  function handleSuccess(msg = 'Done!', bookingId = null, isNew = false) {
    showToast(msg, 'success')
    if (isNew && bookingId) addBooking(bookingId)
    else if (bookingId) refreshBooking(bookingId)
    else refetch()
    setModal(null)
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
      <div className="spinner" style={{ margin: '0 auto 12px', width: 32, height: 32, borderWidth: 3 }} />
      Loading dashboard...
    </div>
  )

  if (error) return (
    <div style={{ textAlign: 'center', padding: 60 }}>
      <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚠</div>
      <div style={{ color: '#c62828', fontWeight: 600, marginBottom: 8 }}>Failed to load dashboard</div>
      <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: 20 }}>{error}</div>
      <button className="btn btn-primary" onClick={refetch}>Retry</button>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <div className="page-header-sub">Welcome back, {user?.displayName}</div>
        </div>
        {hasPermission('create') && (
          <button className="btn btn-primary" onClick={() => setModal({ type: 'new' })}>
            + New Booking
          </button>
        )}
      </div>

      {/* Date Range Filter */}
      <div className="filter-bar" style={{ marginBottom: 20 }}>
        {[
          { key: 'current-fy', label: getCurrentFY().label },
          { key: 'next-fy', label: getNextFY().label },
          { key: 'current-month', label: 'This Month' },
          { key: 'custom', label: 'Custom Range' },
        ].map(opt => (
          <button
            key={opt.key}
            className={`tab-btn ${rangeMode === opt.key ? 'active' : ''}`}
            style={{ fontSize: '0.8rem' }}
            onClick={() => setRangeMode(opt.key)}
          >
            {opt.label}
          </button>
        ))}
        {rangeMode === 'custom' && (
          <>
            <div className="filter-group" style={{ marginBottom: 0 }}>
              <input type="date" className="filter-control" value={customFrom} onChange={e => setCustomFrom(e.target.value)} />
            </div>
            <div style={{ alignSelf: 'center', color: '#888', fontSize: '0.8rem' }}>to</div>
            <div className="filter-group" style={{ marginBottom: 0 }}>
              <input type="date" className="filter-control" value={customTo} onChange={e => setCustomTo(e.target.value)} />
            </div>
          </>
        )}
        {rangeFrom && rangeTo && (
          <div style={{ alignSelf: 'center', fontSize: '0.75rem', color: '#aaa', marginLeft: 4 }}>
            {formatDate(rangeFrom)} – {formatDate(rangeTo)} · {rangeBookings.length} bookings
          </div>
        )}
      </div>

      {/* Stat Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-body">
            <div className="stat-label">Bookings</div>
            <div className="stat-value">{rangeBookings.length}</div>
            <div className="stat-sub">{cancelledBookings.length} cancelled</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-body">
            <div className="stat-label">Revenue</div>
            <div className="stat-value" style={{ fontSize: '1.05rem' }}>{formatCurrency(totalRevenue)}</div>
            <div className="stat-sub">Collected {formatCurrency(totalPaid)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🏛</div>
          <div className="stat-body">
            <div className="stat-label">Venue Occupancy</div>
            <div className="stat-value" style={{ color: overallOccupancy >= 75 ? '#1b5e20' : overallOccupancy >= 40 ? '#b36a00' : 'var(--forest)' }}>
              {overallOccupancy}%
            </div>
            <div className="stat-sub">All 5 venues · selected period</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-body">
            <div className="stat-label">Upcoming</div>
            <div className="stat-value">{upcomingCount}</div>
            <div className="stat-sub">From today onwards</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⚠</div>
          <div className="stat-body">
            <div className="stat-label">Pending Balance</div>
            <div className="stat-value" style={{ fontSize: '1.05rem', color: pendingBalance > 0 ? '#e65100' : 'var(--forest)' }}>
              {formatCurrency(pendingBalance)}
            </div>
            <div className="stat-sub">Outstanding</div>
          </div>
        </div>
      </div>

      {/* Today's Events */}
      {todayBookings.length > 0 && (
        <div className="today-strip">
          <div className="today-strip-title">Today's Events — {formatDate(today)}</div>
          <div className="today-strip-events">
            {todayBookings.map(b => {
              const todaySlots = (b.booking_slots || []).filter(s => s.date === today)
              return todaySlots.map((s, i) => (
                <div key={`${b.id}-${i}`} className="today-event-chip" style={{ cursor: 'pointer' }} onClick={() => setModal({ type: 'detail', data: b })}>
                  <span>{b.client}</span>
                  <span className="chip-slot">{s.slot.toUpperCase()}</span>
                </div>
              ))
            })}
          </div>
        </div>
      )}

      <div className="dashboard-grid">

        {/* Revenue Summary */}
        <div className="card card-full">
          <div className="card-title">Revenue Summary</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: '0.75rem', color: '#888', fontWeight: 600, marginBottom: 6 }}>Total Contracted</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--forest)' }}>{formatCurrency(totalRevenue)}</div>
              <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: 4 }}>{rangeBookings.length} bookings</div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px 0', borderLeft: '1px solid #eef3ee', borderRight: '1px solid #eef3ee' }}>
              <div style={{ fontSize: '0.75rem', color: '#888', fontWeight: 600, marginBottom: 6 }}>Advance Collected</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--grove)' }}>{formatCurrency(totalPaid)}</div>
              <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: 4 }}>
                {totalRevenue > 0 ? Math.round((totalPaid / totalRevenue) * 100) : 0}% collection rate
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: '12px 0' }}>
              <div style={{ fontSize: '0.75rem', color: '#888', fontWeight: 600, marginBottom: 6 }}>Balance Pending</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 700, color: pendingBalance > 0 ? '#e65100' : '#1b5e20' }}>{formatCurrency(pendingBalance)}</div>
              <div style={{ fontSize: '0.72rem', color: '#aaa', marginTop: 4 }}>
                {totalRevenue > 0 ? Math.round((pendingBalance / totalRevenue) * 100) : 0}% outstanding
              </div>
            </div>
          </div>
        </div>

        {/* Revenue by Month Chart */}
        {monthlyRevenue.length > 0 && (
          <div className="card card-full">
            <div className="card-title">Revenue by Month</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, paddingBottom: 20, overflowX: 'auto' }}>
              {monthlyRevenue.map(m => {
                const barH = maxMonthRevenue > 0 ? Math.max((m.revenue / maxMonthRevenue) * 96, m.revenue > 0 ? 4 : 0) : 0
                const colH = maxMonthRevenue > 0 ? Math.max((m.collected / maxMonthRevenue) * 96, m.collected > 0 ? 4 : 0) : 0
                return (
                  <div key={m.key} style={{ flex: '1 0 36px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 36 }}>
                    <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', gap: 2, height: 96 }}>
                      <div title={`Contracted: ${formatCurrency(m.revenue)}`} style={{ flex: 1, height: barH, background: '#c8d8c8', borderRadius: '2px 2px 0 0', transition: 'height 0.3s' }} />
                      <div title={`Collected: ${formatCurrency(m.collected)}`} style={{ flex: 1, height: colH, background: 'var(--grove)', borderRadius: '2px 2px 0 0', transition: 'height 0.3s' }} />
                    </div>
                    <div style={{ fontSize: '0.58rem', color: '#999', textAlign: 'center', whiteSpace: 'nowrap' }}>{m.label}</div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: '#888' }}>
                <div style={{ width: 12, height: 12, background: '#c8d8c8', borderRadius: 2 }} /> Contracted
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', color: '#888' }}>
                <div style={{ width: 12, height: 12, background: 'var(--grove)', borderRadius: 2 }} /> Collected
              </div>
            </div>
          </div>
        )}

        {/* Venue Occupancy */}
        <div className="card">
          <div className="card-title">Venue Occupancy — {thisMonth}</div>
          <div className="occupancy-chart">
            {[...VENUES, ...KITCHENS].map(({ key, label }) => {
              const pct = getVenueOccupancy(key)
              return (
                <div key={key} className="occupancy-row">
                  <div className="occupancy-label">{label}</div>
                  <div className="occupancy-bar-bg">
                    <div className="occupancy-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="occupancy-pct">{pct}%</div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent Payments */}
        <div className="card">
          <div className="card-title">Recent Payments</div>
          {recentPayments.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="empty-state-text">No payments recorded yet</div>
            </div>
          ) : (
            <div>
              {recentPayments.map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f4f0', fontSize: '0.85rem' }}>
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--forest)' }}>{p.booking.client}</div>
                    <div style={{ color: '#888', fontSize: '0.75rem' }}>{formatDate(p.date)} · {p.mode}</div>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--grove)' }}>{formatCurrency(p.amount)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Bookings */}
        <div className="card card-full">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Upcoming Bookings</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[7, 30].map(d => (
                <button
                  key={d}
                  className={`btn btn-sm ${upcomingDays === d ? 'btn-primary' : 'btn-outline'}`}
                  onClick={() => setUpcomingDays(d)}
                >
                  {d} days
                </button>
              ))}
            </div>
          </div>
          {upcomingBookings.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📅</div>
              <div className="empty-state-text">No upcoming bookings in the next {upcomingDays} days</div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Event</th>
                    <th>Next Date</th>
                    <th>Venues</th>
                    <th>Status</th>
                    <th>Total</th>
                    <th>Paid</th>
                    <th>Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingBookings.map(b => {
                    const futureSlots = (b.booking_slots || []).filter(s => s.date >= today).sort((a, b) => a.date.localeCompare(b.date))
                    const nextSlot = futureSlots[0]
                    const paid = (b.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0)
                    const bal = Number(b.total || 0) - paid
                    const venues = nextSlot ? (nextSlot.venues || []).map(v => VENUE_LABELS[v] || v).join(', ') : '—'
                    return (
                      <tr key={b.id} style={{ cursor: 'pointer' }} onClick={() => setModal({ type: 'detail', data: b })}>
                        <td><span style={{ fontWeight: 600 }}>{b.client}</span></td>
                        <td>{b.event}</td>
                        <td>{nextSlot ? `${formatDate(nextSlot.date)} ${nextSlot.slot.toUpperCase()}` : '—'}</td>
                        <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{venues}</td>
                        <td><StatusBadge status={b.status} /></td>
                        <td>{formatCurrency(b.total)}</td>
                        <td style={{ color: 'var(--grove)', fontWeight: 600 }}>{formatCurrency(paid)}</td>
                        <td style={{ color: bal > 0 ? '#e65100' : '#1b5e20', fontWeight: 600 }}>{formatCurrency(bal)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {modal?.type === 'new' && (
        <NewBookingModal onClose={() => setModal(null)} onSuccess={id => handleSuccess('Booking created!', id, true)} user={user} bookings={bookings} />
      )}
      {modal?.type === 'detail' && (
        <BookingDetailModal booking={modal.data} onClose={() => setModal(null)} onEdit={b => setModal({ type: 'edit', data: b })} onPayment={b => setModal({ type: 'payment', data: b })} onCancel={b => setModal({ type: 'cancel', data: b })} onPostpone={b => setModal({ type: 'postpone', data: b })} onCommitments={b => setModal({ type: 'commitments', data: b })} user={user} onRefresh={refreshBooking} onPatch={patchBooking} />
      )}
      {modal?.type === 'edit' && (
        <EditBookingModal booking={modal.data} onClose={() => setModal(null)} onSuccess={id => handleSuccess('Booking updated!', id)} user={user} bookings={bookings} />
      )}
      {modal?.type === 'payment' && (
        <PaymentModal booking={modal.data} onClose={() => setModal(null)} onSuccess={id => handleSuccess('Payment recorded!', id)} user={user} onPatch={patchBooking} />
      )}
      {modal?.type === 'cancel' && (
        <CancelModal booking={modal.data} onClose={() => setModal(null)} onSuccess={id => handleSuccess('Booking cancelled', id)} user={user} onPatch={patchBooking} />
      )}
      {modal?.type === 'postpone' && (
        <PostponeModal booking={modal.data} onClose={() => setModal(null)} onSuccess={id => handleSuccess('Booking postponed!', id)} user={user} bookings={bookings} />
      )}
      {modal?.type === 'commitments' && (
        <CommitmentsModal
          booking={modal.data}
          onClose={() => setModal({ type: 'detail', data: modal.data })}
          onSuccess={async (id, savedCommitment) => {
            showToast('Commitments saved!', 'success')
            // Immediately show saved data without waiting for a re-fetch
            const updatedBooking = { ...modal.data, commitments: [savedCommitment] }
            setModal({ type: 'detail', data: updatedBooking })
            refreshBooking(id) // update context in background
          }}
          user={user}
        />
      )}
    </div>
  )
}
