import { useState } from 'react'
import { saveIncidentals } from '../services/incidentalService'
import { saveExtraPlates } from '../services/bookingService'
import { formatCurrency } from '../utils/formatters'
import { INCIDENTALS_CATALOG, ROOM_RATE } from '../utils/constants'

function calcAmount(item) {
  return (Number(item.qty) || 0) * (Number(item.rate) || 0)
}

function subtotal(items) {
  return items.reduce((s, it) => s + calcAmount(it), 0)
}

function emptyItem(category) {
  return { category, description: '', qty: '', rate: '', isCatalog: false }
}

/**
 * ItemRow renders one line item.
 * - catalog items: description locked, qty/rate editable, no remove button
 * - locked items (ROOMS): everything locked, no remove button
 * - custom items: everything editable, has remove button
 */
function ItemRow({ item, onChange, onRemove, locked = false }) {
  const lockDesc = locked || item.isCatalog
  const lockQtyRate = locked
  const showRemove = !locked && !item.isCatalog
  const amt = calcAmount(item)

  return (
    <tr style={{ background: item.isCatalog ? '#fafcfa' : '' }}>
      <td style={{ padding: '4px 6px' }}>
        <input
          className="form-control"
          style={{ fontSize: '0.82rem', padding: '4px 8px', background: lockDesc ? '#f5f9f5' : '', color: lockDesc ? '#555' : '' }}
          value={item.description}
          onChange={e => onChange({ ...item, description: e.target.value })}
          placeholder="Description"
          readOnly={lockDesc}
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
          readOnly={lockQtyRate}
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
          readOnly={lockQtyRate}
        />
      </td>
      <td style={{ padding: '4px 6px', width: 110, textAlign: 'right', fontWeight: 600, fontSize: '0.82rem', color: amt > 0 ? 'var(--forest)' : '#ccc' }}>
        {amt > 0 ? formatCurrency(amt) : '—'}
      </td>
      <td style={{ padding: '4px 6px', width: 36 }}>
        {showRemove && (
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

function SectionTable({ title, items, onChangeItem, onAddItem, onRemoveItem, lockedCount = 0 }) {
  const total = subtotal(items)
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        background: 'var(--forest)', color: '#fff',
        padding: '6px 12px', fontWeight: 700, fontSize: '0.82rem',
        letterSpacing: '0.05em', borderRadius: '6px 6px 0 0',
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
              locked={i < lockedCount}
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
  const roomBookings = booking.room_bookings || []
  const existingIncidentals = booking.incidental_items || []
  const isBanquet = booking.booking_category === 'banquet'

  function buildCatalogItems(category) {
    return (INCIDENTALS_CATALOG[category] || []).map(c => {
      const saved = existingIncidentals.find(
        i => i.category === category && i.description.toLowerCase() === c.description.toLowerCase()
      )
      return {
        category,
        description: c.description,
        qty: saved ? String(saved.qty) : '',
        rate: saved ? String(saved.rate) : String(c.rate),
        isCatalog: true,
      }
    })
  }

  function buildCustomItems(category) {
    const catalogDescs = (INCIDENTALS_CATALOG[category] || []).map(c => c.description.toLowerCase())
    return existingIncidentals
      .filter(i => i.category === category && !catalogDescs.includes(i.description.toLowerCase()) && i.description !== 'ROOMS')
      .map(i => ({ category, description: i.description, qty: String(i.qty), rate: String(i.rate), isCatalog: false }))
  }

  function buildInitialState() {
    // LIGHTING: catalog rows first, then any saved custom rows
    const lighting = [...buildCatalogItems('lighting'), ...buildCustomItems('lighting')]

    // OTHERS: ROOMS row first (fully locked), then catalog, then custom
    const roomsRows = []
    if (existingIncidentals.length === 0 && roomBookings.length > 0) {
      roomsRows.push({ category: 'others', description: 'ROOMS', qty: String(roomBookings.length), rate: String(ROOM_RATE), isCatalog: false })
    } else {
      const saved = existingIncidentals.find(i => i.category === 'others' && i.description === 'ROOMS')
      if (saved) roomsRows.push({ category: 'others', description: 'ROOMS', qty: String(saved.qty), rate: String(saved.rate), isCatalog: false })
    }
    const others = [...roomsRows, ...buildCatalogItems('others'), ...buildCustomItems('others')]

    return { lighting, others, roomsCount: roomsRows.length }
  }

  // Food extras state (banquet only) — extra_pax per meal per slot
  const [slotsData, setSlotsData] = useState(() =>
    (booking.booking_slots || []).map(s => ({
      id: s.id,
      date: s.date,
      slot: s.slot,
      meals: (s.meals || []).map(m => ({
        meal_type: m.meal_type || '',
        menu: m.menu || '',
        pax: Number(m.pax || 0),
        rate: Number(m.rate || 0),
        extra_pax: m.extra_pax != null ? String(m.extra_pax) : '',
      })),
    }))
  )

  function updateMealExtraPax(slotIdx, mealIdx, val) {
    setSlotsData(prev => prev.map((s, si) =>
      si !== slotIdx ? s : {
        ...s,
        meals: s.meals.map((m, mi) => mi !== mealIdx ? m : { ...m, extra_pax: val }),
      }
    ))
  }

  const init = buildInitialState()
  const [lightingItems, setLightingItems] = useState(init.lighting)
  const [othersItems, setOthersItems] = useState(init.others)
  const lockedOthersCount = init.roomsCount

  const [venueGst, setVenueGst] = useState(Number(booking.venue_gst_percent) || 18)
  const [incGst, setIncGst] = useState(Number(booking.incidental_gst_percent) || 18)
  const [discount, setDiscount] = useState(String(booking.incidental_discount || ''))
  const [preparedBy, setPreparedBy] = useState(booking.prepared_by || '')
  const [checkedBy, setCheckedBy] = useState(booking.checked_by || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function updateLighting(i, item) { setLightingItems(prev => prev.map((it, idx) => idx === i ? item : it)) }
  function removeLighting(i) { setLightingItems(prev => prev.filter((_, idx) => idx !== i)) }
  function updateOthers(i, item) { setOthersItems(prev => prev.map((it, idx) => idx === i ? item : it)) }
  function removeOthers(i) {
    if (i < lockedOthersCount) return
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
  const lawnGstAmt = Math.round(Number(booking.lawn_rental || 0) * venueGst / 100)
  const totalLawn = Number(booking.lawn_rental || 0) + lawnGstAmt

  async function handleSave() {
    setLoading(true)
    setError('')
    try {
      // Only save items that have a description AND qty > 0
      const allItems = [
        ...lightingItems.filter(i => i.description.trim() && Number(i.qty) > 0).map(i => ({ ...i, category: 'lighting' })),
        ...othersItems.filter(i => i.description.trim() && Number(i.qty) > 0).map(i => ({ ...i, category: 'others' })),
      ]
      await saveIncidentals(booking.id, allItems, {
        venue_gst_percent: venueGst,
        incidental_discount: discountAmt,
        incidental_gst_percent: incGst,
        prepared_by: preparedBy.trim(),
        checked_by: checkedBy.trim(),
      }, user.id)

      // For banquet: save extra_pax back to booking_slots
      if (isBanquet) {
        const slotsToUpdate = slotsData.map(s => ({
          id: s.id,
          meals: s.meals.map(m => ({
            meal_type: m.meal_type,
            menu: m.menu,
            pax: m.pax,
            rate: m.rate,
            extra_pax: Number(m.extra_pax) || 0,
          })),
        }))
        await saveExtraPlates(booking.id, slotsToUpdate)
      }

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
          {booking.status === 'Completed' ? (
            <div style={{ background: '#e8f5e9', color: '#1b5e20', border: '1px solid #66bb6a', borderRadius: 6, padding: '8px 14px', marginBottom: 16, fontSize: '0.83rem', fontWeight: 600 }}>
              ✅ POST-EVENT ACTUALS — Enter final actual charges for consolidated bill generation.
            </div>
          ) : (
            <div style={{ background: '#fff8e1', color: '#b36a00', border: '1px solid #f5c842', borderRadius: 6, padding: '8px 14px', marginBottom: 16, fontSize: '0.83rem', fontWeight: 600 }}>
              📋 PRE-EVENT ESTIMATE — Fill in quantities for items used. Only rows with qty &gt; 0 appear on the bill.
            </div>
          )}
          {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}

          {/* Food Extras — banquet only */}
          {isBanquet && (
            <div style={{ marginBottom: 20 }}>
              <div style={{
                background: '#2e5939', color: '#fff',
                padding: '6px 12px', fontWeight: 700, fontSize: '0.82rem',
                letterSpacing: '0.05em', borderRadius: '6px 6px 0 0',
              }}>FOOD EXTRAS — Extra Plates Post-Event</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e0e8e0' }}>
                <thead>
                  <tr style={{ background: '#f5f9f5', fontSize: '0.75rem', color: '#666' }}>
                    <th style={{ padding: '6px', textAlign: 'left', fontWeight: 600 }}>Meal</th>
                    <th style={{ padding: '6px', textAlign: 'right', width: 80, fontWeight: 600 }}>Orig. Pax</th>
                    <th style={{ padding: '6px', textAlign: 'right', width: 100, fontWeight: 600 }}>Rate (₹)</th>
                    <th style={{ padding: '6px', textAlign: 'right', width: 90, fontWeight: 600 }}>Extra Pax</th>
                    <th style={{ padding: '6px', textAlign: 'right', width: 110, fontWeight: 600 }}>Extra Amt (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {slotsData.flatMap((s, si) =>
                    s.meals.map((m, mi) => {
                      const slotLabel = s.date ? `${s.date.split('-').reverse().join('.')} (${(s.slot || '').toUpperCase()})` : ''
                      const extraAmt = (Number(m.extra_pax) || 0) * m.rate
                      return (
                        <tr key={`${si}-${mi}`} style={{ background: '#fafcfa' }}>
                          <td style={{ padding: '4px 6px', fontSize: '0.82rem' }}>
                            {slotLabel} — {m.meal_type.charAt(0).toUpperCase() + m.meal_type.slice(1)} ({m.menu})
                          </td>
                          <td style={{ padding: '4px 6px', textAlign: 'right', fontSize: '0.82rem', color: '#888' }}>
                            {m.pax}
                          </td>
                          <td style={{ padding: '4px 6px', textAlign: 'right', fontSize: '0.82rem', color: '#888' }}>
                            {m.rate.toLocaleString('en-IN')}
                          </td>
                          <td style={{ padding: '4px 6px', width: 90 }}>
                            <input
                              className="form-control"
                              style={{ fontSize: '0.82rem', padding: '4px 8px', textAlign: 'right' }}
                              type="number"
                              value={m.extra_pax}
                              onChange={e => updateMealExtraPax(si, mi, e.target.value)}
                              placeholder="0"
                              min="0"
                            />
                          </td>
                          <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600, fontSize: '0.82rem', color: extraAmt > 0 ? 'var(--forest)' : '#ccc' }}>
                            {extraAmt > 0 ? formatCurrency(extraAmt) : '—'}
                          </td>
                        </tr>
                      )
                    })
                  )}
                  {slotsData.every(s => s.meals.length === 0) && (
                    <tr><td colSpan={5} style={{ padding: '8px 12px', color: '#aaa', fontSize: '0.82rem' }}>No meal details found.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

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
            lockedCount={lockedOthersCount}
          />

          {/* Totals Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
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
                <span className="info-label">Lawn Rental</span>
                <span className="info-value">{formatCurrency(booking.lawn_rental)}</span>
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
