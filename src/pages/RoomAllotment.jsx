import { useState, useMemo, useContext } from 'react'
import { useBookings } from '../hooks/useBookings'
import { useAuth } from '../hooks/useAuth'
import { TOTAL_ROOMS } from '../utils/constants'
import { formatDate } from '../utils/formatters'
import { issueRoomKey, revokeRoomKey } from '../services/roomService'
import { ToastContext } from '../App'
import RoomAllotmentModal from '../modals/RoomAllotmentModal'

const DATE_FILTERS = [
  { key: '7',   label: 'Next 7 days' },
  { key: '14',  label: 'Next 14 days' },
  { key: '30',  label: 'Next 30 days' },
  { key: 'all', label: 'All upcoming' },
]

const GRID_COLORS = [
  '#2e7d32','#1565c0','#e65100','#6a1b9a','#b71c1c',
  '#00695c','#4e342e','#37474f','#ad1457','#283593',
]

function pad2(n) { return String(n).padStart(2, '0') }

function isoToday() {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function addDays(isoDate, n) {
  const d = new Date(isoDate + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function dateRange(from, to) {
  const dates = []
  let cur = from
  while (cur <= to) {
    dates.push(cur)
    cur = addDays(cur, 1)
  }
  return dates
}

export default function RoomAllotment() {
  const todayISO = isoToday()
  const { bookings, loading, error, refetch } = useBookings()
  const { user } = useAuth()
  const showToast = useContext(ToastContext)

  const [dateFilter, setDateFilter] = useState('14')
  const [viewTab, setViewTab]       = useState('list')   // 'list' | 'grid'
  const [statusTab, setStatusTab]   = useState('all')    // 'all' | 'needs' | 'allotted'
  const [allotModal, setAllotModal] = useState(null)     // booking object or null
  const [keyLoading, setKeyLoading] = useState(null)     // room_booking id being updated

  // Who can do what
  const canAllot    = ['management', 'accounts', 'events'].includes(user?.role)
  const canIssueKey = ['management', 'accounts', 'events', 'housekeeping'].includes(user?.role)

  // Cutoff date for filter
  const cutoffISO = useMemo(() => {
    if (dateFilter === 'all') return addDays(todayISO, 90) // cap grid at 90 days
    return addDays(todayISO, parseInt(dateFilter))
  }, [dateFilter, todayISO])

  // All upcoming (non-cancelled) bookings that have at least one slot in the date range
  const relevantBookings = useMemo(() => {
    return bookings
      .filter(b => b.status !== 'Cancelled')
      .filter(b =>
        (b.booking_slots || []).some(s => s.date >= todayISO && s.date <= cutoffISO)
      )
      .sort((a, b) => {
        const aMin = (a.booking_slots || []).filter(s => s.date >= todayISO).map(s => s.date).sort()[0] || 'z'
        const bMin = (b.booking_slots || []).filter(s => s.date >= todayISO).map(s => s.date).sort()[0] || 'z'
        return aMin.localeCompare(bMin)
      })
  }, [bookings, todayISO, cutoffISO])

  // Apply status tab filter — "needs" only counts bookings that actually requested rooms
  const displayBookings = useMemo(() => {
    if (statusTab === 'needs')    return relevantBookings.filter(b => (b.rooms_required || 0) > 0 && (b.room_bookings || []).length === 0)
    if (statusTab === 'allotted') return relevantBookings.filter(b => (b.room_bookings || []).length > 0)
    return relevantBookings
  }, [relevantBookings, statusTab])

  // Summary counts for badges
  const needsCount    = useMemo(() => relevantBookings.filter(b => (b.rooms_required || 0) > 0 && (b.room_bookings || []).length === 0).length, [relevantBookings])
  const allottedCount = useMemo(() => relevantBookings.filter(b => (b.room_bookings || []).length > 0).length, [relevantBookings])
  const totalRoomsRequested = useMemo(() => relevantBookings.reduce((s, b) => s + (b.rooms_required || 0), 0), [relevantBookings])
  const totalRoomSlots = useMemo(() => relevantBookings.reduce((s, b) => s + (b.room_bookings || []).length, 0), [relevantBookings])
  const keysIssuedCount = useMemo(() => {
    let n = 0
    for (const b of relevantBookings) for (const rb of (b.room_bookings || [])) if (rb.key_issued_at) n++
    return n
  }, [relevantBookings])

  // Grid: map roomNum → dateISO → booking
  const roomGridMap = useMemo(() => {
    const map = {}
    for (let r = 1; r <= TOTAL_ROOMS; r++) map[r] = {}
    for (const b of bookings) {
      if (b.status === 'Cancelled') continue
      const slotDates = new Set((b.booking_slots || []).map(s => s.date))
      for (const rb of (b.room_bookings || [])) {
        for (const date of slotDates) {
          if (!map[rb.room_number]) map[rb.room_number] = {}
          map[rb.room_number][date] = b
        }
      }
    }
    return map
  }, [bookings])

  // Stable color per booking
  const bookingColorMap = useMemo(() => {
    const m = {}
    relevantBookings.forEach((b, i) => { m[b.id] = GRID_COLORS[i % GRID_COLORS.length] })
    return m
  }, [relevantBookings])

  const gridDates = useMemo(() => dateRange(todayISO, cutoffISO), [todayISO, cutoffISO])

  async function handleKeyToggle(rb) {
    if (keyLoading) return
    setKeyLoading(rb.id)
    try {
      if (rb.key_issued_at) {
        await revokeRoomKey(rb.id)
        showToast(`Key for Room ${rb.room_number} revoked`, 'success')
      } else {
        await issueRoomKey(rb.id, user.id)
        showToast(`🔑 Key issued for Room ${rb.room_number}`, 'success')
      }
      refetch()
    } catch (e) {
      showToast(e.message || 'Failed to update key status', 'error')
    } finally {
      setKeyLoading(null)
    }
  }

  return (
    <div className="room-allotment-page">

      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h2>Room Allotment</h2>
          <div className="page-header-sub">Allot rooms after the pre-event meeting · Track key issuance by housekeeping</div>
        </div>
      </div>

      {/* ── Summary stats ── */}
      <div className="room-stats-bar">
        <div className="room-stat-card">
          <div className="room-stat-num">{relevantBookings.length}</div>
          <div className="room-stat-label">Upcoming Events</div>
        </div>
        <div className="room-stat-card warn">
          <div className="room-stat-num">{needsCount}</div>
          <div className="room-stat-label">Needs Allotment</div>
        </div>
        <div className="room-stat-card ok">
          <div className="room-stat-num">{allottedCount}</div>
          <div className="room-stat-label">Allotted</div>
        </div>
        <div className="room-stat-card">
          <div className="room-stat-num">{totalRoomsRequested}</div>
          <div className="room-stat-label">Rooms Reserved</div>
        </div>
        <div className="room-stat-card">
          <div className="room-stat-num">{keysIssuedCount}<span style={{ fontSize: '0.7rem', fontWeight: 400, color: '#aaa' }}>/{totalRoomSlots}</span></div>
          <div className="room-stat-label">Keys Issued</div>
        </div>
        <div className="room-stat-card">
          <div className="room-stat-num">{TOTAL_ROOMS - totalRoomsRequested < 0 ? 0 : TOTAL_ROOMS - totalRoomsRequested}</div>
          <div className="room-stat-label">Rooms Available</div>
        </div>
      </div>

      {/* ── Date filter ── */}
      <div className="filter-bar" style={{ marginBottom: 0 }}>
        {DATE_FILTERS.map(f => (
          <button
            key={f.key}
            className={`btn btn-sm ${dateFilter === f.key ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setDateFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── View + status tabs ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, margin: '14px 0' }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button className={`tab-btn ${viewTab === 'list' ? 'active' : ''}`} onClick={() => setViewTab('list')}>Allotment List</button>
          <button className={`tab-btn ${viewTab === 'grid' ? 'active' : ''}`} onClick={() => setViewTab('grid')}>Room Grid</button>
        </div>
        {viewTab === 'list' && (
          <div className="tabs" style={{ marginBottom: 0 }}>
            <button className={`tab-btn ${statusTab === 'all' ? 'active' : ''}`} onClick={() => setStatusTab('all')}>All</button>
            <button className={`tab-btn ${statusTab === 'needs' ? 'active' : ''}`} onClick={() => setStatusTab('needs')}>
              Needs Allotment {needsCount > 0 && <span className="room-badge-warn">{needsCount}</span>}
            </button>
            <button className={`tab-btn ${statusTab === 'allotted' ? 'active' : ''}`} onClick={() => setStatusTab('allotted')}>Allotted</button>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      {error ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ color: '#c62828', fontWeight: 600, marginBottom: 12 }}>Failed to load bookings</div>
          <button className="btn btn-primary" onClick={refetch}>Retry</button>
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
          <div className="spinner" style={{ margin: '0 auto 12px', width: 32, height: 32, borderWidth: 3 }} />
          Loading…
        </div>
      ) : viewTab === 'list' ? (

        /* ────────────── ALLOTMENT LIST ────────────── */
        <div className="room-booking-list">
          {displayBookings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🏨</div>
              <div style={{ fontWeight: 600, marginBottom: 6, color: '#555' }}>No upcoming events in this range</div>
              <div style={{ fontSize: '0.85rem' }}>Try extending the date filter above</div>
            </div>
          ) : (
            displayBookings.map(b => {
              const rooms = (b.room_bookings || []).slice().sort((a, c) => a.room_number - c.room_number)
              const hasRooms = rooms.length > 0
              const allKeys  = hasRooms && rooms.every(rb => rb.key_issued_at)
              const someKeys = hasRooms && rooms.some(rb => rb.key_issued_at)
              const upSlots  = (b.booking_slots || [])
                .filter(s => s.date >= todayISO)
                .sort((a, c) => a.date.localeCompare(c.date))

              return (
                <div key={b.id} className={`room-booking-card ${hasRooms ? (allKeys ? 'card-keys-done' : someKeys ? 'card-partial' : 'card-allotted') : 'card-needs'}`}>
                  <div className="room-card-top">

                    {/* Left: booking info */}
                    <div className="room-card-info">
                      <div className="room-card-client">{b.client}</div>
                      <div className="room-card-meta">{b.event} &middot; {b.type} &middot; {b.guest_count} guests</div>
                      <div className="room-card-dates">
                        {upSlots.map(s => (
                          <span key={`${s.date}-${s.slot}`} className="room-date-tag">
                            {formatDate(s.date)} <span className="room-date-slot">{s.slot.toUpperCase()}</span>
                          </span>
                        ))}
                      </div>
                      {/* Requested vs allotted */}
                      <div className="room-req-vs-allot">
                        <span className="room-req-label">Requested:</span>
                        <span className="room-req-value">{b.rooms_required || 0} rooms</span>
                        <span className="room-req-sep">·</span>
                        <span className="room-req-label">Allotted:</span>
                        <span className={`room-req-value ${rooms.length > 0 && rooms.length < (b.rooms_required || 0) ? 'room-req-short' : rooms.length > 0 ? 'room-req-ok' : ''}`}>
                          {rooms.length} rooms
                        </span>
                        {rooms.length > 0 && rooms.length < (b.rooms_required || 0) && (
                          <span className="room-req-warning">⚠ {(b.rooms_required || 0) - rooms.length} more needed</span>
                        )}
                      </div>
                    </div>

                    {/* Right: status + action */}
                    <div className="room-card-actions">
                      {hasRooms ? (
                        allKeys
                          ? <span className="room-status-badge badge-keys-done">🔑 All Keys Issued</span>
                          : someKeys
                            ? <span className="room-status-badge badge-partial">🔑 Partial Keys</span>
                            : <span className="room-status-badge badge-allotted">✓ Allotted</span>
                      ) : (
                        <span className="room-status-badge badge-needs">⚠ Needs Allotment</span>
                      )}
                      {canAllot && (
                        <button
                          className="btn btn-sm btn-outline"
                          style={{ marginTop: 8 }}
                          onClick={() => setAllotModal(b)}
                        >
                          {hasRooms ? '✎ Edit' : '+ Allot Rooms'}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Room key issuance list */}
                  {hasRooms && (
                    <div className="room-key-list">
                      {rooms.map(rb => (
                        <div key={rb.id} className={`room-key-item ${rb.key_issued_at ? 'key-done' : ''}`}>
                          <span className="room-key-num">Room {rb.room_number}</span>
                          {rb.key_issued_at ? (
                            <>
                              <span className="room-key-issued-label">🔑 Key issued</span>
                              {canIssueKey && (
                                <button
                                  className="room-key-action-btn revoke"
                                  disabled={keyLoading === rb.id}
                                  onClick={() => handleKeyToggle(rb)}
                                >
                                  {keyLoading === rb.id ? '…' : 'Revoke'}
                                </button>
                              )}
                            </>
                          ) : (
                            canIssueKey ? (
                              <button
                                className="room-key-action-btn issue"
                                disabled={keyLoading === rb.id}
                                onClick={() => handleKeyToggle(rb)}
                              >
                                {keyLoading === rb.id ? '…' : '🔑 Issue Key'}
                              </button>
                            ) : (
                              <span className="room-key-pending">Key not issued</span>
                            )
                          )}
                        </div>
                      ))}
                      {rooms[0]?.notes && (
                        <div className="room-card-notes">📝 {rooms[0].notes}</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

      ) : (

        /* ────────────── ROOM GRID ────────────── */
        <div>
          <div className="room-grid-scroll-wrapper">
            <table className="room-grid-table">
              <thead>
                <tr>
                  <th className="room-grid-sticky-cell room-grid-header-cell">Room</th>
                  {gridDates.map(d => {
                    const dt = new Date(d + 'T00:00:00')
                    const dow = ['Su','Mo','Tu','We','Th','Fr','Sa'][dt.getDay()]
                    const isToday = d === todayISO
                    return (
                      <th key={d} className={`room-grid-header-cell ${isToday ? 'room-grid-today-col' : ''}`}>
                        <div className="room-grid-dow">{dow}</div>
                        <div className="room-grid-day">{dt.getDate()}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: TOTAL_ROOMS }, (_, i) => i + 1).map(rn => (
                  <tr key={rn}>
                    <td className="room-grid-sticky-cell room-grid-room-label">Room {rn}</td>
                    {gridDates.map(d => {
                      const bk = roomGridMap[rn]?.[d]
                      if (!bk) {
                        return <td key={d} className="room-grid-cell room-grid-free" title="Available">·</td>
                      }
                      const col = bookingColorMap[bk.id] || '#888'
                      return (
                        <td
                          key={d}
                          className="room-grid-cell room-grid-occupied"
                          style={{ background: col + '1a', borderLeft: `2px solid ${col}` }}
                          title={bk.client}
                        >
                          <span style={{ color: col, fontWeight: 700 }}>
                            {bk.client.split(' ')[0]}
                          </span>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          {relevantBookings.filter(b => (b.room_bookings || []).length > 0).length > 0 && (
            <div className="room-grid-legend">
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#888', marginBottom: 6 }}>Legend</div>
              <div className="room-grid-legend-items">
                {relevantBookings
                  .filter(b => (b.room_bookings || []).length > 0)
                  .map(b => (
                    <div key={b.id} className="room-grid-legend-item">
                      <span className="room-grid-legend-dot" style={{ background: bookingColorMap[b.id] }} />
                      <span>{b.client}</span>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Allotment modal ── */}
      {allotModal && (
        <RoomAllotmentModal
          booking={allotModal}
          onClose={() => setAllotModal(null)}
          onSuccess={msg => {
            showToast(msg, 'success')
            setAllotModal(null)
            refetch()
          }}
          allBookings={bookings}
          user={user}
        />
      )}
    </div>
  )
}
