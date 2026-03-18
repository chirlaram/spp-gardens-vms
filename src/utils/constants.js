/**
 * Shared application constants — single source of truth.
 * Import from here instead of defining locally in each file.
 */

export const EVENT_TYPES = [
  'Wedding', 'Reception', 'Engagement', 'Birthday',
  'Corporate', 'Conference', 'Other',
]

export const PAYMENT_MODES = [
  'cash', 'upi', 'bank_transfer', 'cheque', 'card', 'other',
]

/** Rate per room per booking (in rupees) */
export const ROOM_RATE = 5000

/** Total number of guest rooms available */
export const TOTAL_ROOMS = 18

/** Month names — abbreviated (Jan, Feb …) used in charts/tables */
export const MONTH_NAMES_SHORT = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
]

/** Month names — full (January, February …) used in calendar header */
export const MONTH_NAMES_FULL = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

/** Day names — abbreviated, Sunday-first */
export const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

/** Booking status strings */
export const STATUS = {
  TOKEN_ADVANCE: 'Token Advance',
  CONFIRMED_50: 'Confirmed - 50% Advance',
  FULL_PAYMENT: '100% Payment',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

/** Deposit status strings */
export const DEPOSIT_STATUS = {
  PENDING: 'Pending',
  COLLECTED: 'Collected',
  REFUNDED: 'Refunded',
}

/** Days until a token advance booking is considered overdue */
export const TOKEN_ADVANCE_DEADLINE_DAYS = 14
