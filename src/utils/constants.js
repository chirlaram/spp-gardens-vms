/**
 * Shared application constants — single source of truth.
 * Import from here instead of defining locally in each file.
 */

export const EVENT_TYPES = [
  'Wedding', 'Reception', 'Reception + Wedding',
  'Birthday Party', 'Engagement', 'Haldi', 'Sangeeth',
  'Corporate Event', 'Other',
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

/** Booking categories */
export const BOOKING_CATEGORY = {
  VENUE_RENTAL: 'venue_rental',
  BANQUET: 'banquet',
}

/**
 * Minimum pax guarantee per venue key (per slot).
 * AM slot: breakfast pax + lunch pax must >= guarantee
 * PM slot: dinner pax must >= guarantee
 */
export const VENUE_MIN_GUARANTEE = {
  fcl: 500,  // Ficus Lawn
  hrp: 600,  // Hanu Reddy Pavilion
  // Other venues have no minimum guarantee
}

/** Available banquet menus */
export const BANQUET_MENUS = [
  'Breakfast Menu',
  'Lunch Menu',
  'Vegetarian Silver',
  'Vegetarian Gold',
  'Vegetarian Platinum',
  'Vegetarian Diamond',
  'Non-Vegetarian Silver',
  'Non-Vegetarian Gold',
  'Non-Vegetarian Platinum',
  'Non-Vegetarian Diamond',
]

/** Allowed meal types per slot time */
export const SLOT_MEAL_TYPES = {
  am:   ['breakfast', 'lunch'],
  pm:   ['dinner'],
  full: ['breakfast', 'lunch', 'dinner'],
}

/**
 * Pre-populated incidental line items with default rates.
 * Shown in IncidentalsModal with qty=0; only qty>0 rows are saved/billed.
 * Same catalog applies to both venue_rental and banquet bookings.
 */
export const INCIDENTALS_CATALOG = {
  lighting: [
    { description: 'Mirchi Lights',  rate: 50 },
    { description: 'LED Parken',     rate: 500 },
    { description: 'Face Light',     rate: 500 },
    { description: 'Audio',          rate: 6000 },
    { description: 'Metal Light',    rate: 400 },
    { description: 'Edition Bulb',   rate: 150 },
    { description: 'Lantern',        rate: 150 },
    { description: 'Remo Arch',      rate: 7000 },
  ],
  others: [
    { description: 'Cleaning & Maintenance', rate: 18000 },
    { description: 'Valet Drivers',          rate: 1000 },
    { description: 'Welcome Girls',          rate: 2000 },
    { description: 'Housekeeping Staff',     rate: 1000 },
    { description: 'Diesel 82 KVA',         rate: 1400 },
    { description: 'Diesel 125 KVA',        rate: 2000 },
    { description: 'Diesel 625 KVA',        rate: 8000 },
    { description: 'Standing Table',        rate: 600 },
    { description: 'Steel Tables',          rate: 150 },
    { description: 'Snacks',                rate: 200 },
    { description: 'Two Seater Sofa',       rate: 1500 },
    { description: 'Transport',              rate: 5000 },
  ],
}
