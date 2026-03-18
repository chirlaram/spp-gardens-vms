/**
 * ConsolidatedBillTemplate — A4 HTML template for SPP Gardens official bill.
 * Rendered off-screen by billGenerator.js, captured via html2canvas, saved as PDF.
 *
 * Props: booking (full booking object with incidental_items, room_bookings,
 *                  booking_slots, payments, and bill meta fields)
 */

import { formatCurrency, VENUE_LABELS } from '../utils/formatters'

const INR = v => {
  const n = Number(v) || 0
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}

const styles = {
  page: {
    width: '794px',
    minHeight: '1123px',
    background: '#fff',
    fontFamily: '"Helvetica Neue", Arial, sans-serif',
    color: '#111',
    padding: '36px 48px 0',
    boxSizing: 'border-box',
    fontSize: '11px',
  },
  thickLine: { borderTop: '3px solid #1c3a1e', margin: 0 },
  thinLine: { borderTop: '1px solid #c8a951', margin: 0 },
  table: { width: '100%', borderCollapse: 'collapse', marginBottom: 0 },
  th: { padding: '6px 8px', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', background: '#1c3a1e', color: '#fff', border: '1px solid #1c3a1e' },
  td: { padding: '5px 8px', border: '1px solid #c8d8c8', verticalAlign: 'middle' },
  tdRight: { padding: '5px 8px', border: '1px solid #c8d8c8', textAlign: 'right', verticalAlign: 'middle' },
  sectionHeader: { padding: '5px 8px', border: '1px solid #1c3a1e', background: '#eef5ee', fontWeight: 700, letterSpacing: '0.04em', fontSize: '10px' },
  bold: { fontWeight: 700 },
  totalRow: { background: '#f0f7f0', fontWeight: 700 },
  grandRow: { background: '#1c3a1e', color: '#fff', fontWeight: 700 },
}

function TRow({ label, qty = '', rate = '', amount, bold, shade, grand }) {
  const rowStyle = grand
    ? { ...styles.grandRow }
    : shade
      ? { ...styles.totalRow }
      : {}
  const tdStyle = grand
    ? { ...styles.td, border: '1px solid #1c3a1e', color: '#fff', background: 'transparent' }
    : { ...styles.td }
  const tdRStyle = grand
    ? { ...styles.tdRight, border: '1px solid #1c3a1e', color: '#fff', background: 'transparent' }
    : { ...styles.tdRight }

  return (
    <tr style={rowStyle}>
      <td style={{ ...tdStyle, fontWeight: bold || grand ? 700 : 400 }}>{label}</td>
      <td style={{ ...tdRStyle, fontWeight: bold || grand ? 700 : 400 }}>{qty}</td>
      <td style={{ ...tdRStyle, fontWeight: bold || grand ? 700 : 400 }}>{rate}</td>
      <td style={{ ...tdRStyle, fontWeight: bold || grand ? 700 : 400 }}>
        {amount !== undefined && amount !== '' ? `₹ ${INR(amount)}` : ''}
      </td>
    </tr>
  )
}

function SectionHeader({ label }) {
  return (
    <tr>
      <td colSpan={4} style={{ ...styles.sectionHeader }}>{label}</td>
    </tr>
  )
}

function BlankRow() {
  return (
    <tr>
      <td colSpan={4} style={{ ...styles.td, height: 10 }} />
    </tr>
  )
}

export default function ConsolidatedBillTemplate({ booking, isFinal = false }) {
  const slots = booking.booking_slots || []
  const payments = booking.payments || []
  const incidentals = (booking.incidental_items || []).slice().sort((a, b) => a.sort_order - b.sort_order)
  const lightingItems = incidentals.filter(i => i.category === 'lighting')
  const othersItems = incidentals.filter(i => i.category === 'others')

  // --- Section 1: Lawn / Event charges ---
  const lawnCharges = Number(booking.total || 0)
  const venueGstPct = Number(booking.venue_gst_percent) || 18
  const lawnGst = Math.round(lawnCharges * venueGstPct / 100)
  const totalLawn = lawnCharges + lawnGst

  // --- Section 2: Incidentals ---
  const lightingTotal = lightingItems.reduce((s, i) => s + Number(i.amount || 0), 0)
  const othersTotal = othersItems.reduce((s, i) => s + Number(i.amount || 0), 0)
  const totalAB = lightingTotal + othersTotal
  const discount = Number(booking.incidental_discount) || 0
  const afterDiscount = Math.max(0, totalAB - discount)
  const incGstPct = Number(booking.incidental_gst_percent) || 18
  const incidentalGst = Math.round(afterDiscount * incGstPct / 100)
  const totalIncidental = afterDiscount + incidentalGst

  // --- Section 3: Summary ---
  const grandTotal = totalLawn + totalIncidental
  const totalAdvance = payments.reduce((s, p) => s + Number(p.amount || 0), 0)
  const balance = grandTotal - totalAdvance

  // Header info
  const venueNames = [...new Set(slots.flatMap(s => s.venues || []))].map(v => VENUE_LABELS[v] || v).join(' + ')
  const eventDates = slots.map(s => {
    if (!s.date) return ''
    const [y, m, d] = s.date.split('-')
    return `${d}.${m}.${y} (${s.slot === 'am' ? 'AM' : 'PM'})`
  }).join(', ')

  const bookingHeader = [booking.client, booking.event, venueNames || '—', eventDates || '—']
    .filter(Boolean).join(' / ')

  return (
    <div id="spp-consolidated-bill" style={{ ...styles.page, position: 'relative' }}>
      {/* Diagonal watermark for estimates */}
      {!isFinal && (
        <div style={{
          position: 'absolute',
          top: '38%',
          left: '50%',
          transform: 'translate(-50%, -50%) rotate(-35deg)',
          fontSize: '72px',
          fontWeight: 900,
          color: 'rgba(180,110,0,0.07)',
          letterSpacing: '0.05em',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          userSelect: 'none',
          zIndex: 0,
        }}>ESTIMATE</div>
      )}
      {/* TOP RULES */}
      <div style={styles.thickLine} />
      <div style={{ height: 4 }} />
      <div style={styles.thinLine} />

      {/* LOGO */}
      <div style={{ textAlign: 'center', padding: '12px 0 8px' }}>
        <img
          src="/spp-logo.webp"
          alt="SPP Gardens"
          style={{ height: 60, objectFit: 'contain' }}
          crossOrigin="anonymous"
        />
      </div>

      <div style={styles.thinLine} />
      <div style={{ height: 4 }} />
      <div style={styles.thickLine} />

      {/* ESTIMATE / FINAL BILL banner */}
      <div style={{
        textAlign: 'center',
        padding: '6px 0 4px',
        fontSize: isFinal ? '13px' : '11px',
        fontWeight: 700,
        letterSpacing: '0.2em',
        color: isFinal ? '#1c3a1e' : '#b36a00',
      }}>
        {isFinal ? 'FINAL BILL' : 'ESTIMATE — Subject to change'}
      </div>

      {/* BOOKING HEADER ROW */}
      <div style={{
        background: '#1c3a1e',
        color: '#fff',
        padding: '8px 12px',
        fontWeight: 700,
        fontSize: '11px',
        letterSpacing: '0.03em',
        margin: '0 0 12px',
      }}>
        {bookingHeader}
      </div>

      {/* ===== SECTION 1: EVENT / LAWN CHARGES ===== */}
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={{ ...styles.th, textAlign: 'left', width: '50%' }}>Description</th>
            <th style={{ ...styles.th, textAlign: 'right', width: '12%' }}>QTY</th>
            <th style={{ ...styles.th, textAlign: 'right', width: '18%' }}>Rate</th>
            <th style={{ ...styles.th, textAlign: 'right', width: '20%' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          <SectionHeader label="EVENT" />
          <TRow label="LAWN CHARGES" qty="1" rate={`₹ ${INR(lawnCharges)}`} amount={lawnCharges} />
          <TRow label="SUB TOTAL" amount={lawnCharges} shade />
          <TRow label={`ADD: GST @ ${venueGstPct}% on Lawn Charges`} amount={lawnGst} />
          <TRow label="TOTAL (LAWN CHARGES)" amount={totalLawn} bold shade />
        </tbody>
      </table>

      <div style={{ height: 14 }} />

      {/* ===== SECTION 2: INCIDENTAL CHARGES ===== */}
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={{ ...styles.th, textAlign: 'left', width: '50%' }}>Description</th>
            <th style={{ ...styles.th, textAlign: 'right', width: '12%' }}>QTY</th>
            <th style={{ ...styles.th, textAlign: 'right', width: '18%' }}>Rate</th>
            <th style={{ ...styles.th, textAlign: 'right', width: '20%' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          <SectionHeader label="LIGHTING (A)" />
          {lightingItems.length === 0 && (
            <TRow label="(No lighting items)" />
          )}
          {lightingItems.map((it, i) => (
            <TRow key={i} label={it.description} qty={INR(it.qty)} rate={`₹ ${INR(it.rate)}`} amount={it.amount} />
          ))}
          <TRow label="TOTAL (LIGHTING) (A)" amount={lightingTotal} shade bold />

          <BlankRow />

          <SectionHeader label="OTHERS (B)" />
          {othersItems.length === 0 && (
            <TRow label="(No other items)" />
          )}
          {othersItems.map((it, i) => (
            <TRow key={i} label={it.description} qty={INR(it.qty)} rate={`₹ ${INR(it.rate)}`} amount={it.amount} />
          ))}
          <TRow label="TOTAL (OTHERS) (B)" amount={othersTotal} shade bold />

          <BlankRow />

          <TRow label="TOTAL OF A &amp; B" amount={totalAB} shade bold />
          {discount > 0 && <TRow label="LESS: DISCOUNT" amount={-discount} />}
          {discount > 0 && <TRow label="TOTAL AFTER DISCOUNT" amount={afterDiscount} shade />}
          <TRow label={`ADD: GST @ ${incGstPct}%`} amount={incidentalGst} />
          <TRow label="TOTAL (INCIDENTAL)" amount={totalIncidental} bold shade />
        </tbody>
      </table>

      <div style={{ height: 14 }} />

      {/* ===== SECTION 3: SUMMARY ===== */}
      <table style={{ ...styles.table, width: '55%', marginLeft: 'auto' }}>
        <tbody>
          <TRow label="TOTAL (LAWN CHARGES)" amount={totalLawn} />
          <TRow label="TOTAL (INCIDENTAL)" amount={totalIncidental} />
          <TRow label="GRAND TOTAL" amount={grandTotal} grand />
          <TRow label="LESS: Advance Received" amount={-totalAdvance} />
          <TRow
            label={balance < 0 ? 'REFUND TO CLIENT' : 'BALANCE DUE'}
            amount={Math.abs(balance)}
            grand
          />
        </tbody>
      </table>

      <div style={{ height: 28 }} />

      {/* ===== FOOTER: Signatures ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 12 }}>
        {[
          { role: 'Prepared By', name: booking.prepared_by || '' },
          { role: 'Checked By', name: booking.checked_by || '' },
          { role: 'Client Sign', name: '' },
        ].map(({ role, name }) => (
          <div key={role} style={{ textAlign: 'center', padding: '0 8px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8, color: '#555' }}>
              {role}
            </div>
            {name && (
              <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: 32 }}>{name}</div>
            )}
            {!name && <div style={{ height: 40 }} />}
            <div style={{ borderTop: '1px solid #333', paddingTop: 4, fontSize: '10px', color: '#888' }}>
              Signature
            </div>
          </div>
        ))}
      </div>

      {/* BOTTOM FOOTER */}
      <div style={{ ...styles.thinLine, marginTop: 8 }} />
      <div style={{ height: 3 }} />
      <div style={{ ...styles.thickLine }} />
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 24,
        fontSize: '10px',
        color: '#555',
        padding: '8px 0',
      }}>
        <span>🌐 www.sppgardens.com</span>
        <span>📞 +91 90251 80180</span>
        <span>✉ hello@sppgardens.com</span>
      </div>
      <div style={{
        background: '#c8a951',
        color: '#1c3a1e',
        textAlign: 'center',
        fontWeight: 700,
        fontSize: '9px',
        letterSpacing: '0.15em',
        padding: '6px 0',
      }}>
        A VENTURE OF HANU REDDY ODYSSEY
      </div>
    </div>
  )
}
