import { getInitials, shortId } from '../utils/formatters'

const CHIP_CLASS = {
  'Token Advance': 'booking-chip-token',
  'Confirmed - 50% Advance': 'booking-chip-confirmed',
  '100% Payment': 'booking-chip-full',
  'Cancelled': 'booking-chip-cancelled',
  'Completed': 'booking-chip-completed',
}

export default function BookingChip({ booking, onClick }) {
  const chipClass = CHIP_CLASS[booking.status] || 'booking-chip-token'
  return (
    <div
      className={`booking-chip ${chipClass}`}
      title={`${booking.client} — ${booking.event}`}
      onClick={onClick}
    >
      <span>{getInitials(booking.client)}</span>
      <span style={{ opacity: 0.7, fontSize: '0.62rem' }}>{shortId(booking.id)}</span>
    </div>
  )
}
