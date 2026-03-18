-- Migration 002: Room Bookings + Incidental Items + Booking Bill Meta
-- Run this in Supabase SQL Editor

-- ==========================================
-- TABLE: room_bookings
-- Rooms are booked for the same dates/slots as the venue booking.
-- No separate check-in/check-out — inherits from booking_slots.
-- ==========================================
CREATE TABLE IF NOT EXISTS room_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  room_number INTEGER NOT NULL CHECK (room_number >= 1 AND room_number <= 18),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_bookings_booking_id ON room_bookings(booking_id);

-- ==========================================
-- TABLE: incidental_items
-- Line items for the consolidated bill (lighting or others category)
-- ==========================================
CREATE TABLE IF NOT EXISTS incidental_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('lighting', 'others')),
  description TEXT NOT NULL,
  qty NUMERIC(10,2) NOT NULL DEFAULT 1,
  rate NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidental_items_booking_id ON incidental_items(booking_id);

-- ==========================================
-- ALTER TABLE: bookings — add bill meta columns
-- ==========================================
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS venue_gst_percent NUMERIC(5,2) DEFAULT 18;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS incidental_discount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS incidental_gst_percent NUMERIC(5,2) DEFAULT 18;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS prepared_by TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS checked_by TEXT;

-- ==========================================
-- RLS: allow all (matches existing pattern)
-- ==========================================
ALTER TABLE room_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidental_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_room_bookings" ON room_bookings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_incidental_items" ON incidental_items FOR ALL USING (true) WITH CHECK (true);
