/**
 * Format a number as Indian Rupee currency
 */
export function formatCurrency(amount) {
  const num = Number(amount) || 0
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(num)
}

/**
 * Format a date string for display
 */
export function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

/**
 * Format a datetime for display
 */
export function formatDateTime(isoStr) {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr)
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return isoStr
  }
}

/**
 * Get today as YYYY-MM-DD
 */
export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Get client initials (first letters of first two words)
 */
export function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

/**
 * Short booking ID for display (last 6 chars of UUID)
 */
export function shortId(id) {
  if (!id) return ''
  return id.slice(-6).toUpperCase()
}

/**
 * Format slot as readable string
 */
export function formatSlot(slot) {
  if (slot === 'am') return 'Morning'
  if (slot === 'pm') return 'Evening'
  if (slot === 'full') return 'Full Day'
  return slot
}

export const VENUE_LABELS = {
  fcl: 'Ficus Lawn',
  grv: 'Golden Rush Valley',
  hrp: 'Hanu Reddy Pavilion',
  hpi: 'H.R. Pushpa Island',
  rgm: 'Raghava Mandapam',
}

export const KITCHEN_LABELS = {
  vk1: 'Veg Kitchen 1',
  vk2: 'Veg Kitchen 2',
  nvk: 'Non-Veg Kitchen',
}

export function getResourceLabel(key) {
  return VENUE_LABELS[key] || KITCHEN_LABELS[key] || key
}
