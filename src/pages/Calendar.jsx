import { useState, useContext, useMemo } from 'react'
import { useBookings } from '../hooks/useBookings'
import { useAuth } from '../hooks/useAuth'
import BookingDetailModal from '../modals/BookingDetailModal'
import NewBookingModal from '../modals/NewBookingModal'
import PaymentModal from '../modals/PaymentModal'
import EditBookingModal from '../modals/EditBookingModal'
import CancelModal from '../modals/CancelModal'
import PostponeModal from '../modals/PostponeModal'
import CommitmentsModal from '../modals/CommitmentsModal'
import { VENUE_LABELS, KITCHEN_LABELS, formatDate } from '../utils/formatters'
import { MONTH_NAMES_FULL as MONTH_NAMES, DAY_NAMES } from '../utils/constants'
import { ToastContext } from '../App'

const VENUES = [
  { key: 'fcl', label: 'Ficus Lawn', short: 'FCL', rowClass: 'cal-row-v1' },
  { key: 'grv', label: 'Golden Rush Valley', short: 'GRV', rowClass: 'cal-row-v2' },
  { key: 'hrp', label: 'Hanu Reddy Pavilion', short: 'HRP', rowClass: 'cal-row-v3' },
  { key: 'hpi', label: 'H.R. Pushpa Island', short: 'HRPI', rowClass: 'cal-row-v4' },
  { key: 'rgm', label: 'Raghava Mandapam', short: 'RGM', rowClass: 'cal-row-v5' },
]
const KITCHENS = [
  { key: 'vk1', label: 'Veg Kitchen 1', short: 'VK1', rowClass: 'cal-row-k1' },
  { key: 'vk2', label: 'Veg Kitchen 2', short: 'VK2', rowClass: 'cal-row-k2' },
  { key: 'nvk', label: 'Non-Veg Kitchen', short: 'NVK', rowClass: 'cal-row-k3' },
]
const RESOURCES = [...VENUES, ...KITCHENS]

// Booked-cell fill colors per resource (saturated version of row background)
const ROW_BOOKED = {
  fcl: { bg: '#6ab86a', text: '#0d2e0d' },
  grv: { bg: '#5a9fd4', text: '#0a2440' },
  hrp: { bg: '#c4907c', text: '#3d1208' },
  hpi: { bg: '#a888d0', text: '#250e45' },
  rgm: { bg: '#5ab898', text: '#082818' },
  vk1: { bg: '#e0b030', text: '#3d2400' },
  vk2: { bg: '#e09820', text: '#3d1c00' },
  nvk: { bg: '#d87070', text: '#3d0404' },
}


function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}

function pad2(n) { return String(n).padStart(2, '0') }

export default function Calendar() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const { bookings, loading, error, refetch, refreshBooking, patchBooking, addBooking } = useBookings()
  const { user, hasPermission } = useAuth()
  const showToast = useContext(ToastContext)
  const [modal, setModal] = useState(null)
  const [dayDetail, setDayDetail] = useState(null)

  const isHousekeeping = user?.role === 'housekeeping'
  const resources = isHousekeeping ? KITCHENS : RESOURCES

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const daysInMonth = getDaysInMonth(year, month)
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  // Actual today's ISO date — computed from the real current date, not from navigated year/month
  const todayISO = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`

  // Build a Sun→Sat aligned calendar grid.
  // Leading nulls = days before the 1st; trailing nulls = days after the last.
  const startDay = new Date(year, month, 1).getDay() // 0=Sun … 6=Sat
  const calendarDays = [...Array(startDay).fill(null), ...days]
  while (calendarDays.length % 7 !== 0) calendarDays.push(null)

  // Split into rows of 7
  const weeks = []
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7))
  }

  // Build lookup: { 'fcl:2024-01-15:am': [booking, ...] }
  const slotMap = useMemo(() => {
    const map = {}
    for (const b of bookings) {
      if (b.status === 'Cancelled') continue
      for (const s of (b.booking_slots || [])) {
        const st = s.slot
        for (const v of (s.venues || [])) {
          const k = `${v}:${s.date}:${st}`
          if (!map[k]) map[k] = []
          map[k].push(b)
        }
        if (s.kitchen) {
          const k = `${s.kitchen}:${s.date}:${st}`
          if (!map[k]) map[k] = []
          map[k].push(b)
        }
      }
    }
    return map
  }, [bookings])

  function getBookingsForSlot(resourceKey, dayNum, slotType) {
    const dateStr = `${year}-${pad2(month + 1)}-${pad2(dayNum)}`
    const k = `${resourceKey}:${dateStr}:${slotType}`
    return slotMap[k] || []
  }

  function getBookingsForDay(dayNum) {
    const dateStr = `${year}-${pad2(month + 1)}-${pad2(dayNum)}`
    const seen = new Set()
    const result = []
    for (const b of bookings) {
      if (b.status === 'Cancelled') continue
      for (const s of (b.booking_slots || [])) {
        if (s.date === dateStr && !seen.has(b.id)) {
          seen.add(b.id)
          result.push({ ...b, _slot: s })
        }
      }
    }
    return result
  }

  function handleCellClick(dayNum, resourceKey, slotType) {
    if (!hasPermission('create')) return
    const dateStr = `${year}-${pad2(month + 1)}-${pad2(dayNum)}`
    setModal({ type: 'new', prefillDate: dateStr })
  }

  function handleSuccess(msg = 'Done!', bookingId = null, isNew = false) {
    showToast(msg, 'success')
    if (isNew && bookingId) addBooking(bookingId)
    else if (bookingId) refreshBooking(bookingId)
    else refetch()
    setModal(null)
    setDayDetail(null)
  }

  return (
    <div className="calendar-page">
      <div className="page-header">
        <div>
          <h2>Calendar</h2>
          <div className="page-header-sub">Venue & Kitchen availability</div>
        </div>
        {hasPermission('create') && (
          <button className="btn btn-primary" onClick={() => setModal({ type: 'new' })}>
            + New Booking
          </button>
        )}
      </div>

      <div className="calendar-nav">
        <button className="btn btn-outline btn-sm" onClick={prevMonth}>← Prev</button>
        <div className="calendar-month-label">{MONTH_NAMES[month]} {year}</div>
        <button className="btn btn-outline btn-sm" onClick={nextMonth}>Next →</button>
      </div>

      {error ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>⚠</div>
          <div style={{ color: '#c62828', fontWeight: 600, marginBottom: 8 }}>Failed to load calendar</div>
          <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: 20 }}>{error}</div>
          <button className="btn btn-primary" onClick={refetch}>Retry</button>
        </div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#aaa' }}>
          <div className="spinner" style={{ margin: '0 auto 12px', width: 32, height: 32, borderWidth: 3 }} />
          Loading calendar...
        </div>
      ) : (
        <div className="calendar-weeks">
          {weeks.map((weekDays, wi) => (
            <div key={wi} className="calendar-week">
              <div className="calendar-wrapper">
                <table className="calendar-table">
                  <thead>
                    <tr>
                      <th className="resource-header-cell">Resource</th>
                      {weekDays.map((d, di) => {
                        // di 0=Sun … 6=Sat always, regardless of whether d is null
                        if (d === null) {
                          return (
                            <th key={`eh-${di}`} className="cal-empty-col-header">
                              <div className="day-name">{DAY_NAMES[di]}</div>
                            </th>
                          )
                        }
                        const dateStr = `${year}-${pad2(month + 1)}-${pad2(d)}`
                        const isToday = dateStr === todayISO
                        const isSun = di === 0
                        return (
                          <th
                            key={d}
                            className={isToday ? 'cal-today-col' : ''}
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                              const dayBkgs = getBookingsForDay(d)
                              if (dayBkgs.length > 0) setDayDetail({ dayNum: d, bookings: dayBkgs })
                            }}
                          >
                            <div className="day-name">{DAY_NAMES[di]}</div>
                            <div className="date-header" style={{ color: isSun ? '#ff6b6b' : undefined }}>{d}</div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {resources.map(res => (
                      <tr key={res.key} className={res.rowClass}>
                        <td className="resource-cell">
                          <div>{res.label}</div>
                          <div className="res-short">{res.short}</div>
                        </td>
                        {weekDays.map((d, di) => {
                          if (d === null) {
                            return <td key={`e-${di}`} className="slot-cell slot-cell-empty" />
                          }
                          return (
                            <td key={d} className="slot-cell">
                              <div className="slot-grid">
                                {['am', 'pm'].map(st => {
                                  const slotBookings = getBookingsForSlot(res.key, d, st)
                                  const isBooked = slotBookings.length > 0
                                  const colors = ROW_BOOKED[res.key]
                                  return (
                                    <div
                                      key={st}
                                      className={`slot-half ${isBooked ? 'booked' : ''}`}
                                      style={isBooked ? { background: colors?.bg, cursor: 'pointer' } : {}}
                                      title={isBooked ? slotBookings.map(b => b.client).join(', ') : `Click to book ${res.label} — ${st.toUpperCase()}`}
                                      onClick={isBooked
                                        ? () => setModal({ type: 'detail', data: slotBookings[0] })
                                        : () => handleCellClick(d, res.key, st)
                                      }
                                    >
                                      {isBooked ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 3, overflow: 'hidden' }}>
                                          <span style={{ fontSize: '0.55rem', fontWeight: 800, color: colors?.text, opacity: 0.65, flexShrink: 0 }}>{st.toUpperCase()}</span>
                                          <span style={{ fontSize: '0.6rem', fontWeight: 700, color: colors?.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {slotBookings.map(b => b.client).join(', ')}
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="slot-label">{st.toUpperCase()}</div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Day Detail Side Panel */}
      {dayDetail && (
        <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && setDayDetail(null)}>
          <div className="modal modal-md">
            <div className="day-detail-header">
              <div className="day-detail-date">
                {formatDate(`${year}-${pad2(month + 1)}-${pad2(dayDetail.dayNum)}`)}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
                {dayDetail.bookings.length} booking{dayDetail.bookings.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="day-booking-list">
              {dayDetail.bookings.map(b => {
                const s = b._slot
                const venues = [...(s.venues || []).map(v => VENUE_LABELS[v] || v), ...(s.kitchen ? [KITCHEN_LABELS[s.kitchen] || s.kitchen] : [])]
                return (
                  <div
                    key={b.id}
                    className="day-booking-card"
                    onClick={() => { setDayDetail(null); setModal({ type: 'detail', data: b }) }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div className="day-booking-title">{b.client}</div>
                      <span style={{ fontSize: '0.72rem', background: 'var(--mist)', color: 'var(--grove)', padding: '2px 6px', borderRadius: 10, fontWeight: 600 }}>
                        {s.slot.toUpperCase()}
                      </span>
                    </div>
                    <div className="day-booking-meta">{b.event} · {b.type}</div>
                    <div className="day-booking-venues">
                      {venues.map((v, i) => <span key={i} className="venue-tag">{v}</span>)}
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ padding: '0 16px 16px', display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              {hasPermission('create') && (
                <button className="btn btn-primary btn-sm" onClick={() => {
                  const dateStr = `${year}-${pad2(month + 1)}-${pad2(dayDetail.dayNum)}`
                  setDayDetail(null)
                  setModal({ type: 'new', prefillDate: dateStr })
                }}>
                  + New Booking
                </button>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => setDayDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'new' && (
        <NewBookingModal
          onClose={() => setModal(null)}
          onSuccess={id => handleSuccess('Booking created!', id, true)}
          user={user}
          bookings={bookings}
          prefillDate={modal.prefillDate}
        />
      )}
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
      {modal?.type === 'edit' && (
        <EditBookingModal
          booking={modal.data}
          onClose={() => setModal(null)}
          onSuccess={id => handleSuccess('Booking updated!', id)}
          user={user}
          bookings={bookings}
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
