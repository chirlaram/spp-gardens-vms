import { useState, useEffect } from 'react'
import { saveIncidentals } from '../services/incidentalService'
import { formatCurrency } from '../utils/formatters'

const ROOM_RATE = 5000

function emptyItem(category) {
  return { category, description: '', qty: '', rate: '' }
}

function calcAmount(item) {
  return (Number(item.qty) || 0) * (Number(item.rate) || 0)
}

function subtotal(items) {
  return items.reduce((s, it) => s + calcAmount(it), 0)
}

function ItemRow({ item, onChange, onRemove, autoDesc = false }) {
  return (
    <tr>
      <td style={{ padding: '4px 6px' }}>
        <input
          className="form-control"
          style={{ fontSize: '0.82rem', padding: '4px 8px' }}
          value={item.description}
          onChange={e => onChange({ ...item, description: e.target.value })}
          placeholder="Description"
          readOnly={autoDesc}
        />
      </td>
      <td style={{ padding: '4px 6px', width: 70 }}>
        <input
          className="form-control"
          style={{ fontSize: '0.82rem', padding: '4px 8px', textAlign: 'right' }}
          type="number"
          value={item.qty}
          onChange={e => onChange({ ...item, qty: e.target.value })}
          placeholder="0"
          min="0"
          readOnly={autoDesc}
        />
      </td>
      <td style={{ padding: '4px 6px', width: 100 }}>
        <input
          className="form-control"
          style={{ fontSize: '0.82rem', padding: '4px 8px', textAlign: 'right' }}
          type="number"
          value={item.rate}
          onChange={e => onChange({ ...item, rate: e.target.value })}
          placeholder="0"
          min="0"
          readOnly={autoDesc}
        />
      </td>
      <td style={{ padding: '4px 6px', width: 110, textAlign: 'right', fontWeight: 600, fontSize: '0.82rem', color: 'var(--forest)' }}>
        {formatCurrency(calcAmount(item))}
      </td>
      <td style={{ padding: '4px 6px', width: 36 }}>
        {!autoDesc && (
          <button
            type="button"
            onClick={onRemove}
            style={{ background: 'none', border: 'none', color: '#e53935', fontSize: '1rem', cursor: 'pointer', padding: 0 }}
          >×</button>
        )}
      </td>
    </tr>
  )
}

function SectionTable({ title, items, onChangeItem, onAddItem, onRemoveItem, lockedRows = 0 }) {
  const total = subtotal(items)
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        background: 'var(--forest)',
        color: '#fff',
        padding: '6px 12px',
        fontWeight: 700,
        fontSize: '0.82rem',
        letterSpacing: '0.05em',
        borderRadius: '6px 6px 0 0',
      }}>{title}</div>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e0e8e0' }}>
        <thead>
          <tr style={{ background: '#f5f9f5', fontSize: '0.75rem', color: '#666' }}>
            <th style={{ padding: '6px', textAlign: 'left', fontWeight: 600 }}>Description</th>
            <th style={{ padding: '6px', textAlign: 'right', width: 70, fontWeight: 600 }}>QTY</th>
            <th style={{ padding: '6px', textAlign: 'right', width: 100, fontWeight: 600 }}>Rate (₹)</th>
            <th style={{ padding: '6px', textAlign: 'right', width: 110, fontWeight: 600 }}>Amount (₹)</th>
            <th style={{ width: 36 }} />
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <ItemRow
              key={i}
              item={item}
              onChange={updated => onChangeItem(i, updated)}
              onRemove={() => onRemoveItem(i)}
              autoDesc={i < lockedRows}
            />
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f0f7f0' }}>
            <td colSpan={3} style={{ padding: '6px 12px', fontWeight: 700, fontSize: '0.82rem', color: 'var(--forest)' }}>
              Subtotal
            </td>
            <td style={{ padding: '6px', textAlign: 'right', fontWeight: 700, fontSize: '0.85rem', color: 'var(--forest)' }}>
              {formatCurrency(total)}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
      <button
        type="button"
        className="btn btn-sm btn-outline"
        style={{ marginTop: 6, fontSize: '0.78rem' }}
        onClick={onAddItem}
      >+ Add Row</button>
    </div>
  )
}

export default function IncidentalsModal({ booking, onClose, onSuccess, user }) {
  // Pre-populate Others with rooms from room_bookings
  const roomBookings = booking.room_bookings || []
  const existingIncidentals = booking.incidental_items || []

  function buildInitialState() {
    if (existingIncidentals.length > 0) {
      return {
        lighting: existingIncidentals.filter(i => i.category === 'lighting').map(i => ({
          category: 'lighting', description: i.description, qty: String(i.qty), rate: String(i.rate),
        })),
        others: existingIncidentals.filter(i => i.category === 'others').map(i => ({
          category: 'others', description: i.description, qty: String(i.qty), rate: String(i.rate),
        })),
      }
    }
    // No existing items — seed OTHERS with rooms row if rooms booked
    const others = []
    if (roomBookings.length > 0) {
      others.push({ category: 'others', description: 'ROOMS', qty: String(roomBookings.length), rate: String(ROOM_RATE) })
    }
    return { lighting: [], others }
  }

  const init = buildInitialState()
  const [lightingItems, setLightingItems] = useState(init.lighting)
  const [othersItems, setOthersItems] = useState(init.others)

  const [venueGst, setVenueGst] = useState(Number(booking.venue_gst_percent) || 18)
  const [incGst, setIncGst] = useState(Number(booking.incidental_gst_percent) || 18)
  const [discount, setDiscount] = useState(String(booking.incidental_discount || ''))
  const [preparedBy, setPreparedBy] = useState(booking.prepared_by || '')
  const [checkedBy, setCheckedBy] = useState(booking.checked_by || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Detect how many Others rows are auto-generated (locked to prevent deletion)
  const lockedOthersRows = (init.others.length > 0 && init.others[0]?.description === 'ROOMS') ? 1 : 0

  function updateLighting(i, item) {
    setLightingItems(prev => prev.map((it, idx) => idx === i ? item : it))
  }
  function removeLighting(i) {
    setLightingItems(prev => prev.filter((_, idx) => idx !== i))
  }
  function updateOthers(i, item) {
    setOthersItems(prev => prev.map((it, idx) => idx === i ? item : it))
  }
  function removeOthers(i) {
    if (i < lockedOthersRows) return // cannot remove auto-rows
    setOthersItems(prev => prev.filter((_, idx) => idx !== i))
  }

  // Calculations
  const lightingTotal = subtotal(lightingItems)
  const othersTotal = subtotal(othersItems)
  const totalAB = lightingTotal + othersTotal
  const discountAmt = Number(discount) || 0
  const afterDiscount = Math.max(0, totalAB - discountAmt)
  const incidentalGstAmt = Math.round(afterDiscount * incGst / 100)
  const totalIncidental = afterDiscount + incidentalGstAmt
  const lawnGstAmt = Math.round(Number(booking.total || 0) * venueGst / 100)
  const totalLawn = Number(booking.total || 0) + lawnGstAmt

  async function handleSave() {
    setLoading(true)
    setError('')
    try {
      const allItems = [
        ...lightingItems.filter(i => i.description.trim()).map(i => ({ ...i, category: 'lighting' })),
        ...othersItems.filter(i => i.description.trim()).map(i => ({ ...i, category: 'others' })),
      ]
      await saveIncidentals(booking.id, allItems, {
        venue_gst_percent: venueGst,
        incidental_discount: discountAmt,
        incidental_gst_percent: incGst,
        prepared_by: preparedBy.trim(),
        checked_by: checkedBy.trim(),
      }, user.id)
      onSuccess(booking.id)
    } catch (err) {
      setError(err.message || 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl" style={{ maxWidth: 860 }}>
        <div className="modal-header">
          <div className="modal-header-content">
            <div className="modal-title">Incidental Charges</div>
            <div className="modal-subtitle">{booking.client} — {booking.event}</div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          {/* Stage banner */}
          {booking.status === 'Completed' ? (
            <div style={{
              background: '#e8f5e9', color: '#1b5e20', border: '1px solid #66bb6a',
              borderRadius: 6, padding: '8px 14px', marginBottom: 16, fontSize: '0.83rem', fontWeight: 600,
            }}>
              ✅ POST-EVENT ACTUALS — Enter final actual charges for consolidated bill generation.
            </div>
          ) : (
            <div style={{
              background: '#fff8e1', color: '#b36a00', border: '1px solid #f5c842',
              borderRadius: 6, padding: '8px 14px', marginBottom: 16, fontSize: '0.83rem', fontWeight: 600,
            }}>
              📋 PRE-EVENT ESTIMATE — These are estimated charges. Update to actual amounts after the event.
            </div>
          )}
          {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}

          <SectionTable
            title="A — LIGHTING"
            items={lightingItems}
            onChangeItem={updateLighting}
            onAddItem={() => setLightingItems(prev => [...prev, emptyItem('lighting')])}
            onRemoveItem={removeLighting}
          />

          <SectionTable
            title="B — OTHERS"
            items={othersItems}
            onChangeItem={updateOthers}
            onAddItem={() => setOthersItems(prev => [...prev, emptyItem('others')])}
            onRemoveItem={removeOthers}
            lockedRows={lockedOthersRows}
          />

          {/* Totals Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Incidentals calc */}
            <div className="card" style={{ fontSize: '0.85rem' }}>
              <div className="card-title">Incidental Summary</div>
              <div className="info-row">
                <span className="info-label">Total A (Lighting)</span>
                <span className="info-value">{formatCurrency(lightingTotal)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Total B (Others)</span>
                <span className="info-value">{formatCurrency(othersTotal)}</span>
              </div>
              <div className="info-row" style={{ borderTop: '1px solid #e0e8e0', paddingTop: 6, marginTop: 4 }}>
                <span className="info-label" style={{ fontWeight: 600 }}>Total A + B</span>
                <span className="info-value" style={{ fontWeight: 700 }}>{formatCurrency(totalAB)}</span>
              </div>
              <div className="info-row" style={{ alignItems: 'center' }}>
                <span className="info-label">Less Discount</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#888' }}>₹</span>
                  <input
                    className="form-control"
                    style={{ width: 90, padding: '3px 8px', fontSize: '0.82rem', textAlign: 'right' }}
                    type="number"
                    value={discount}
                    onChange={e => setDiscount(e.target.value)}
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>
              <div className="info-row">
                <span className="info-label">After Discount</span>
                <span className="info-value">{formatCurrency(afterDiscount)}</span>
              </div>
              <div className="info-row" style={{ alignItems: 'center' }}>
                <span className="info-label">GST %</span>
                <input
                  className="form-control"
                  style={{ width: 60, padding: '3px 8px', fontSize: '0.82rem', textAlign: 'right' }}
                  type="number"
                  value={incGst}
                  onChange={e => setIncGst(Number(e.target.value) || 18)}
                  min="0"
                />
              </div>
              <div className="info-row" style={{ borderTop: '1px solid #e0e8e0', paddingTop: 6, marginTop: 4 }}>
                <span className="info-label" style={{ fontWeight: 700, color: 'var(--forest)' }}>Total Incidental</span>
                <span className="info-value" style={{ fontWeight: 700, color: 'var(--forest)' }}>{formatCurrency(totalIncidental)}</span>
              </div>
            </div>

            {/* Bill meta + grand total */}
            <div className="card" style={{ fontSize: '0.85rem' }}>
              <div className="card-title">Bill Meta</div>
              <div className="info-row" style={{ alignItems: 'center' }}>
                <span className="info-label">Venue GST %</span>
                <input
                  className="form-control"
                  style={{ width: 60, padding: '3px 8px', fontSize: '0.82rem', textAlign: 'right' }}
                  type="number"
                  value={venueGst}
                  onChange={e => setVenueGst(Number(e.target.value) || 18)}
                  min="0"
                />
              </div>
              <div className="info-row">
                <span className="info-label">Lawn Charges</span>
                <span className="info-value">{formatCurrency(booking.total)}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Lawn GST</span>
                <span className="info-value">{formatCurrency(lawnGstAmt)}</span>
              </div>
              <div className="info-row" style={{ borderTop: '1px solid #e0e8e0', paddingTop: 6, marginTop: 4 }}>
                <span className="info-label" style={{ fontWeight: 700 }}>Grand Total</span>
                <span className="info-value" style={{ fontWeight: 700, color: 'var(--forest)' }}>{formatCurrency(totalLawn + totalIncidental)}</span>
              </div>

              <div className="form-group" style={{ marginTop: 12 }}>
                <label className="form-label">Prepared By</label>
                <input className="form-control" style={{ fontSize: '0.82rem' }} value={preparedBy} onChange={e => setPreparedBy(e.target.value)} placeholder="Name" />
              </div>
              <div className="form-group">
                <label className="form-label">Checked By</label>
                <input className="form-control" style={{ fontSize: '0.82rem' }} value={checkedBy} onChange={e => setCheckedBy(e.target.value)} placeholder="Name" />
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={loading}>
            {loading ? 'Saving…' : 'Save Incidentals'}
          </button>
        </div>
      </div>
    </div>
  )
}
