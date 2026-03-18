import { amountToWords } from '../utils/amountToWords'
import { formatCurrency, VENUE_LABELS } from '../utils/formatters'

/**
 * A4 receipt component for SPP Gardens.
 * Rendered off-screen then captured by html2canvas for PDF/print.
 *
 * Props:
 *   booking  — full booking object (with booking_slots)
 *   payment  — the specific payment record
 *   receiptNo — display receipt number (e.g. short payment id)
 */
export default function Receipt({ booking, payment, receiptNo }) {
  const payDate = payment.date
    ? (() => {
        const [y, m, d] = payment.date.split('-')
        return `${d}.${m}.${y}`
      })()
    : ''

  // Build human-readable event dates from booking_slots
  const slots = booking.booking_slots || []
  const eventDates = slots.length
    ? slots
        .map(s => {
          if (!s.date) return ''
          const [y, m, d] = s.date.split('-')
          return `${d}.${m}.${y} (${s.slot === 'am' ? 'Morning' : 'Evening'})`
        })
        .join(', ')
    : '—'

  // Venue names for "charges towards"
  const allVenues = [...new Set(slots.flatMap(s => s.venues || []))]
  const venueNames = allVenues.map(v => VENUE_LABELS[v] || v).join(', ') || '—'

  const amtNum = Number(payment.amount || 0)

  return (
    <div
      id="spp-receipt"
      style={{
        width: '794px',        // A4 at 96dpi
        minHeight: '1123px',
        background: '#fff',
        fontFamily: 'Georgia, "Times New Roman", serif',
        color: '#1c1c1c',
        padding: '48px 60px',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* TOP RULE */}
      <div style={{ borderTop: '3px solid #1c3a1e', marginBottom: 6 }} />
      <div style={{ borderTop: '1px solid #c8a951', marginBottom: 20 }} />

      {/* LOGO + DATE row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ flex: 1 }} />
        <div style={{ flex: 2, textAlign: 'center' }}>
          <img
            src="/spp-logo.webp"
            alt="SPP Gardens"
            style={{ height: 72, objectFit: 'contain' }}
            crossOrigin="anonymous"
          />
        </div>
        <div style={{ flex: 1, textAlign: 'right', fontSize: '0.9rem', paddingTop: 8, color: '#333' }}>
          <div style={{ fontWeight: 600 }}>Date: {payDate}</div>
          <div style={{ marginTop: 4, fontSize: '0.8rem', color: '#666' }}>Receipt No: {receiptNo}</div>
        </div>
      </div>

      {/* BOTTOM RULE under header */}
      <div style={{ borderTop: '1px solid #c8a951', marginBottom: 6 }} />
      <div style={{ borderTop: '3px solid #1c3a1e', marginBottom: 32 }} />

      {/* TITLE */}
      <div style={{ textAlign: 'center', marginBottom: 36 }}>
        <span style={{
          fontSize: '1.6rem',
          fontWeight: 700,
          letterSpacing: '0.25em',
          textDecoration: 'underline',
          textTransform: 'uppercase',
        }}>Receipt</span>
      </div>

      {/* BODY PARAGRAPH */}
      <div style={{ fontSize: '1rem', lineHeight: 2.2, textAlign: 'justify', marginBottom: 60 }}>
        <p style={{ margin: 0 }}>
          Received with thanks from{' '}
          <strong><u>{booking.client}</u></strong>
          {booking.phone ? <> ({booking.phone})</> : ''}
          {' '}a sum of{' '}
          <strong><u>{formatCurrency(amtNum)}</u></strong>
          {' '}(Rupees <strong><u>{amountToWords(amtNum)}</u></strong>)
          {' '}towards <strong><u>{booking.type === 'banquet' ? 'Banquet' : 'Rental'} Charges</u></strong>
          {' '}for the{' '}
          <strong><u>{booking.event}</u></strong>
          {' '}event booked at{' '}
          <strong><u>{venueNames}</u></strong>
          {' '}on{' '}
          <strong><u>{eventDates}</u></strong>.
        </p>
        {payment.mode && (
          <p style={{ margin: '16px 0 0' }}>
            Payment received via{' '}
            <strong>{payment.mode.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</strong>
            {payment.reference ? <>, Reference: <strong>{payment.reference}</strong></> : ''}.
          </p>
        )}
        {payment.note && (
          <p style={{ margin: '8px 0 0', color: '#555' }}>{payment.note}</p>
        )}
      </div>

      {/* SIGNATURE — right aligned */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 80 }}>
        <div style={{ textAlign: 'center', minWidth: 220 }}>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 56 }}>
            For Hanu Reddy Realty India Pvt. Ltd.
          </div>
          <div style={{ borderTop: '1px solid #999', paddingTop: 6, fontSize: '0.95rem', fontWeight: 700 }}>
            C. RAM REDDY
          </div>
          <div style={{ fontSize: '0.85rem', color: '#555', marginTop: 2 }}>Manager</div>
        </div>
      </div>

      {/* FOOTER */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
        {/* Icon row */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 32,
          fontSize: '0.78rem',
          color: '#555',
          padding: '0 60px 12px',
        }}>
          <span>🌐 www.sppgardens.com</span>
          <span>📞 +91 98480 12345</span>
          <span>✉ info@sppgardens.com</span>
        </div>
        {/* Gold bar */}
        <div style={{
          background: '#c8a951',
          color: '#1c3a1e',
          textAlign: 'center',
          fontWeight: 700,
          fontSize: '0.8rem',
          letterSpacing: '0.15em',
          padding: '8px 0',
        }}>
          A VENTURE OF HANU REDDY ODYSSEY
        </div>
      </div>
    </div>
  )
}
