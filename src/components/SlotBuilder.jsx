import { todayISO, VENUE_LABELS, KITCHEN_LABELS } from '../utils/formatters'
import { checkConflict } from '../utils/conflictCheck'
import { BANQUET_MENUS, SLOT_MEAL_TYPES, VENUE_MIN_GUARANTEE } from '../utils/constants'

const VENUES = Object.entries(VENUE_LABELS).map(([key, label]) => ({ key, label }))
const KITCHENS = Object.entries(KITCHEN_LABELS).map(([key, label]) => ({ key, label }))

const MEAL_TYPE_LABELS = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' }

export default function SlotBuilder({ slots, onChange, bookings = [], excludeBookingId = null, slotErrors = [], banquetMode = false }) {
  function addSlot() {
    onChange([...slots, { date: todayISO(), slot: 'pm', venues: [], kitchen: '', meals: [] }])
  }

  function removeSlot(index) {
    onChange(slots.filter((_, i) => i !== index))
  }

  function updateSlot(index, field, value) {
    const updated = slots.map((s, i) => i === index ? { ...s, [field]: value } : s)
    onChange(updated)
  }

  function toggleVenue(index, venueKey) {
    const current = slots[index].venues || []
    const updated = current.includes(venueKey)
      ? current.filter(v => v !== venueKey)
      : [...current, venueKey]
    updateSlot(index, 'venues', updated)
  }

  function getVenueConflicts(slotIndex, venueKey) {
    const s = slots[slotIndex]
    if (!s.date || !s.slot) return []
    return checkConflict(bookings, s.date, s.slot, venueKey, excludeBookingId)
  }

  function getKitchenConflicts(slotIndex, kitchenKey) {
    const s = slots[slotIndex]
    if (!s.date || !s.slot) return []
    return checkConflict(bookings, s.date, s.slot, kitchenKey, excludeBookingId)
  }

  // ── Banquet meal helpers ──────────────────────────────
  function addMeal(slotIndex) {
    const s = slots[slotIndex]
    const availableTypes = SLOT_MEAL_TYPES[s.slot] || ['breakfast', 'lunch', 'dinner']
    const usedTypes = (s.meals || []).map(m => m.meal_type)
    const nextType = availableTypes.find(t => !usedTypes.includes(t)) || availableTypes[0]
    const newMeal = { meal_type: nextType, menu: BANQUET_MENUS[0], pax: '', rate: '', amount: 0 }
    const updated = slots.map((sl, i) =>
      i === slotIndex ? { ...sl, meals: [...(sl.meals || []), newMeal] } : sl
    )
    onChange(updated)
  }

  function removeMeal(slotIndex, mealIndex) {
    const updated = slots.map((sl, i) =>
      i === slotIndex
        ? { ...sl, meals: (sl.meals || []).filter((_, mi) => mi !== mealIndex) }
        : sl
    )
    onChange(updated)
  }

  function updateMeal(slotIndex, mealIndex, field, value) {
    const updated = slots.map((sl, i) => {
      if (i !== slotIndex) return sl
      const meals = (sl.meals || []).map((m, mi) => {
        if (mi !== mealIndex) return m
        const next = { ...m, [field]: value }
        const pax = Number(field === 'pax' ? value : m.pax) || 0
        const rate = Number(field === 'rate' ? value : m.rate) || 0
        next.amount = pax * rate
        return next
      })
      return { ...sl, meals }
    })
    onChange(updated)
  }

  function getSlotMinGuarantee(slotIndex) {
    const s = slots[slotIndex]
    const guarantees = (s.venues || []).map(v => VENUE_MIN_GUARANTEE[v] || 0).filter(g => g > 0)
    return guarantees.length > 0 ? Math.max(...guarantees) : 0
  }

  function getSlotTotalPax(slotIndex) {
    return (slots[slotIndex].meals || []).reduce((sum, m) => sum + (Number(m.pax) || 0), 0)
  }

  function getSlotRevenue(slotIndex) {
    return (slots[slotIndex].meals || []).reduce((sum, m) => sum + (Number(m.amount) || 0), 0)
  }

  return (
    <div className="slot-builder">
      {slots.map((s, i) => {
        const hasAnyConflict = [
          ...(s.venues || []).flatMap(v => getVenueConflicts(i, v)),
          ...(s.kitchen ? getKitchenConflicts(i, s.kitchen) : [])
        ].length > 0

        const minGuarantee = banquetMode ? getSlotMinGuarantee(i) : 0
        const totalPax = banquetMode ? getSlotTotalPax(i) : 0
        const slotRevenue = banquetMode ? getSlotRevenue(i) : 0
        const meetsMin = minGuarantee === 0 || totalPax >= minGuarantee
        const availableMealTypes = SLOT_MEAL_TYPES[s.slot] || ['breakfast', 'lunch', 'dinner']

        return (
          <div key={i} className="slot-entry">
            <div className="slot-entry-header">
              <span className="slot-entry-num">Slot {i + 1}</span>
              {slots.length > 1 && (
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ background: '#fce4ec', color: '#c62828', border: '1px solid #f48fb1' }}
                  onClick={() => removeSlot(i)}
                >
                  Remove
                </button>
              )}
            </div>
            <div className="form-row">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-control"
                  value={s.date}
                  onChange={e => updateSlot(i, 'date', e.target.value)}
                  min={todayISO()}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Time Slot</label>
                <select
                  className="form-control"
                  value={s.slot}
                  onChange={e => updateSlot(i, 'slot', e.target.value)}
                >
                  <option value="am">Morning (AM)</option>
                  <option value="pm">Evening (PM)</option>
                </select>
              </div>
            </div>

            <div className="form-group mt-3" style={{ marginBottom: 0 }}>
              <label className="form-label">Venues</label>
              <div className="venue-checkbox-grid">
                {VENUES.map(({ key, label }) => {
                  const conflicts = getVenueConflicts(i, key)
                  const isSelected = (s.venues || []).includes(key)
                  const hasConflict = conflicts.length > 0 && isSelected
                  return (
                    <label
                      key={key}
                      className={`venue-checkbox-item ${isSelected ? 'selected' : ''} ${hasConflict ? 'conflict' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleVenue(i, key)}
                        style={{ accentColor: 'var(--grove)' }}
                      />
                      {label}
                      {conflicts.length > 0 && (
                        <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#e53935' }} title="Conflict">⚠</span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="form-group mt-3" style={{ marginBottom: 0 }}>
              <label className="form-label">Kitchen</label>
              <div className="venue-checkbox-grid">
                <label className={`venue-checkbox-item ${!s.kitchen ? 'selected' : ''}`}>
                  <input type="radio" checked={!s.kitchen} onChange={() => updateSlot(i, 'kitchen', '')} />
                  None
                </label>
                {KITCHENS.map(({ key, label }) => {
                  const conflicts = getKitchenConflicts(i, key)
                  const isSelected = s.kitchen === key
                  const hasConflict = conflicts.length > 0 && isSelected
                  return (
                    <label
                      key={key}
                      className={`venue-checkbox-item ${isSelected ? 'selected' : ''} ${hasConflict ? 'conflict' : ''}`}
                    >
                      <input type="radio" checked={isSelected} onChange={() => updateSlot(i, 'kitchen', key)} />
                      {label}
                      {conflicts.length > 0 && (
                        <span style={{ marginLeft: 'auto', fontSize: '0.65rem', color: '#e53935' }} title="Conflict">⚠</span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>

            {/* ── Banquet Meals ── */}
            {banquetMode && (
              <div className="banquet-meals">
                <div className="banquet-meals-header">
                  <span>Meals</span>
                  <button type="button" className="banquet-add-meal-btn" onClick={() => addMeal(i)}>
                    + Add Meal
                  </button>
                </div>

                {(s.meals || []).length === 0 && (
                  <div className="banquet-meals-empty">No meals added yet — click "+ Add Meal" to start</div>
                )}

                {(s.meals || []).map((meal, mi) => (
                  <div key={mi} className="banquet-meal-row">
                    <select
                      className="form-control"
                      value={meal.meal_type}
                      onChange={e => updateMeal(i, mi, 'meal_type', e.target.value)}
                      style={{ flex: '0 0 100px' }}
                    >
                      {availableMealTypes.map(mt => (
                        <option key={mt} value={mt}>{MEAL_TYPE_LABELS[mt] || mt}</option>
                      ))}
                    </select>
                    <select
                      className="form-control"
                      value={meal.menu}
                      onChange={e => updateMeal(i, mi, 'menu', e.target.value)}
                      style={{ flex: 1 }}
                    >
                      {BANQUET_MENUS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Pax"
                      value={meal.pax}
                      onChange={e => updateMeal(i, mi, 'pax', e.target.value)}
                      min="0"
                      style={{ flex: '0 0 72px' }}
                    />
                    <input
                      type="number"
                      className="form-control"
                      placeholder="Rate ₹"
                      value={meal.rate}
                      onChange={e => updateMeal(i, mi, 'rate', e.target.value)}
                      min="0"
                      style={{ flex: '0 0 88px' }}
                    />
                    <span className="banquet-meal-amount">
                      ₹{((Number(meal.pax) || 0) * (Number(meal.rate) || 0)).toLocaleString('en-IN')}
                    </span>
                    <button
                      type="button"
                      className="banquet-meal-remove"
                      onClick={() => removeMeal(i, mi)}
                      title="Remove meal"
                    >×</button>
                  </div>
                ))}

                {(s.meals || []).length > 0 && (
                  <div className="banquet-slot-summary">
                    <span>
                      Total pax: <strong>{totalPax}</strong>
                      {minGuarantee > 0 && (
                        <span style={{ marginLeft: 6 }}>
                          / Min: {minGuarantee}
                          {meetsMin
                            ? <span style={{ color: '#16a34a', marginLeft: 4 }}>✓ Met</span>
                            : <span style={{ color: '#dc2626', marginLeft: 4 }}>⚠ Below minimum — lawn rental may apply</span>
                          }
                        </span>
                      )}
                    </span>
                    <span className="banquet-slot-total">
                      Slot total: ₹{slotRevenue.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
              </div>
            )}

            {slotErrors[i] && (
              <div style={{ color: '#c62828', fontSize: '0.8rem', marginTop: 6 }}>{slotErrors[i]}</div>
            )}
            {hasAnyConflict && (
              <div className="conflict-warning mt-2">
                <span>⚠</span>
                <span>One or more resources are already booked for this date/slot. Please review conflicts.</span>
              </div>
            )}
          </div>
        )
      })}
      <button type="button" className="add-slot-btn" onClick={addSlot}>
        + Add Another Slot
      </button>
    </div>
  )
}
