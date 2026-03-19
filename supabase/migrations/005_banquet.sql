-- Add booking_category to bookings and meals JSONB column to booking_slots

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS booking_category TEXT NOT NULL DEFAULT 'venue_rental'
    CHECK (booking_category IN ('venue_rental', 'banquet'));

ALTER TABLE booking_slots
  ADD COLUMN IF NOT EXISTS meals JSONB NOT NULL DEFAULT '[]'::jsonb;
