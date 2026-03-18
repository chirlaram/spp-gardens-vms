import { todayISO, VENUE_LABELS, KITCHEN_LABELS } from '../utils/formatters'
import { checkConflict } from '../utils/conflictCheck'

const VENUES = Object.entries(VENUE_LABELS).map(([key, label]) => ({ key, label }))
const KITCHENS = Object.entries(KITCHEN_LABELS).map(([key, label]) => ({ key, label }))

export default function SlotBuilder({ slots, onChange, bookings = [], excludeBookingId = null, slotErrors = [] }) {
  function addSlot() {
    onChange([...slots, { date: todayISO(), slot: 'pm', venues: [], kitchen: '' }])
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

  return (
    <div className="slot-builder">
      {slots.map((s, i) => {
        const hasAnyConflict = [
          ...( s.venues || []).flatMap(v => getVenueConflicts(i, v)),
          ...(s.kitchen ? getKitchenConflicts(i, s.kitchen) : [])
        ].length > 0

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
                <label
                  className={`venue-checkbox-item ${!s.kitchen ? 'selected' : ''}`}
                >
                  <input
                    type="radio"
                    checked={!s.kitchen}
                    onChange={() => updateSlot(i, 'kitchen', '')}
                  />
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
                      <input
                        type="radio"
                        checked={isSelected}
                        onChange={() => updateSlot(i, 'kitchen', key)}
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
