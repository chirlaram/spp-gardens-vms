import { useState, useContext } from 'react'
import { useBookings } from '../hooks/useBookings'
import { useAuth } from '../hooks/useAuth'
import StatusBadge from '../components/StatusBadge'
import BookingDetailModal from '../modals/BookingDetailModal'
import CommitmentsModal from '../modals/CommitmentsModal'
import { formatDate, VENUE_LABELS } from '../utils/formatters'
import { ToastContext } from '../App'
import { todayISO } from '../utils/formatters'

function getFirstSlotDate(booking) {
  const slots = booking.booking_slots || []
  if (!slots.length) return ''
  return slots.map(s => s.date).sort()[0]
}

function getVenueNames(booking) {
  const slots = booking.booking_slots || []
  const venues = new Set()
  slots.forEach(s => (s.venues || []).forEach(v => venues.add(VENUE_LABELS[v] || v)))
  return [...venues].join(', ') || '—'
}

export default function Events() {
  const { bookings, loading, error, refreshBooking, patchBooking } = useBookings()
  const { user } = useAuth()
  const showToast = useContext(ToastContext)
  const [modal, setModal] = useState(null)
  const [filter, setFilter] = useState('upcoming') // upcoming | all

  const today = todayISO()

  const filtered = bookings
    .filter(b => b.status !== 'Cancelled')
    .filter(b => {
      if (filter === 'upcoming') return (b.booking_slots || []).some(s => s.date >= today)
      return true
    })
    .sort((a, b) => {
      const da = getFirstSlotDate(a)
      const db = getFirstSlotDate(b)
      return da < db ? -1 : da > db ? 1 : 0
    })

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Events</h1>
          <p style={{ margin: 0, color: '#888', fontSize: '0.85rem' }}>
            {filtered.length} booking{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['upcoming', 'all'].map(f => (
            <button
              key={f}
              className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setFilter(f)}
              style={{ textTransform: 'capitalize' }}
            >
              {f === 'upcoming' ? 'Upcoming' : 'All Bookings'}
            </button>
          ))}
        </div>
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>Loading…</div>}
      {error && <div className="login-error">{error}</div>}

      {!loading && filtered.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#aaa' }}>
          No {filter === 'upcoming' ? 'upcoming ' : ''}bookings found.
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Event</th>
                  <th>Date</th>
                  <th>Venue</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => {
                  const firstDate = getFirstSlotDate(b)
                  const isPast = firstDate && firstDate < today
                  return (
                    <tr
                      key={b.id}
                      onClick={() => setModal({ type: 'detail', data: b })}
                      style={{ cursor: 'pointer', opacity: isPast ? 0.65 : 1 }}
                    >
                      <td><strong>{b.client}</strong></td>
                      <td>{b.event}</td>
                      <td>{firstDate ? formatDate(firstDate) : '—'}</td>
                      <td style={{ fontSize: '0.82rem', color: '#666' }}>{getVenueNames(b)}</td>
                      <td><StatusBadge status={b.status} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'detail' && (
        <BookingDetailModal
          booking={modal.data}
          onClose={() => setModal(null)}
          onEdit={() => {}}
          onPayment={() => {}}
          onCancel={() => {}}
          onPostpone={() => {}}
          eventsView={true}
          onCommitments={b => setModal({ type: 'commitments', data: b })}
          user={user}
          onRefresh={async id => {
            const u = await refreshBooking(id)
            if (u) setModal(m => m?.type === 'detail' && m.data?.id === id ? { ...m, data: u } : m)
          }}
          onPatch={patchBooking}
        />
      )}

      {modal?.type === 'commitments' && (
        <CommitmentsModal
          booking={modal.data}
          user={user}
          onClose={() => setModal({ type: 'detail', data: modal.data })}
          onSuccess={(id, savedCommitment) => {
            showToast('Commitments saved!', 'success')
            const updatedBooking = { ...modal.data, commitments: [savedCommitment] }
            setModal({ type: 'detail', data: updatedBooking })
            refreshBooking(id)
          }}
        />
      )}
    </div>
  )
}
