-- SPP Gardens Venue Management System
-- Complete Database Schema with RLS and seed data

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- TABLE: users
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('management', 'accounts', 'sales', 'events', 'housekeeping')),
  pin TEXT NOT NULL, -- stored as plain text or hashed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- TABLE: bookings
-- ==========================================
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  event TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other',
  status TEXT NOT NULL DEFAULT 'Token Advance',
  guest_count INTEGER DEFAULT 0,
  catering TEXT DEFAULT 'self',
  total NUMERIC(12,2) DEFAULT 0,
  advance_target NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  venue_gst_percent NUMERIC(5,2) DEFAULT 18,
  incidental_discount NUMERIC(12,2) DEFAULT 0,
  incidental_gst_percent NUMERIC(5,2) DEFAULT 18,
  prepared_by TEXT,
  checked_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- ==========================================
-- TABLE: booking_slots
-- ==========================================
CREATE TABLE IF NOT EXISTS booking_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  slot TEXT NOT NULL CHECK (slot IN ('am', 'pm', 'full')),
  venues TEXT[] DEFAULT '{}',
  kitchen TEXT
);

CREATE INDEX IF NOT EXISTS idx_booking_slots_booking_id ON booking_slots(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_slots_date ON booking_slots(date);

-- ==========================================
-- TABLE: payments
-- ==========================================
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'cash',
  reference TEXT,
  note TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  recorded_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date);

-- ==========================================
-- TABLE: commitments
-- ==========================================
CREATE TABLE IF NOT EXISTS commitments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  extra_services TEXT,
  discount NUMERIC(10,2) DEFAULT 0,
  discount_note TEXT,
  food_promises TEXT,
  venue_arrangements TEXT,
  timing_access TEXT,
  complimentary_rooms TEXT,
  other_notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_commitments_booking_id ON commitments(booking_id);

-- ==========================================
-- TABLE: amendments
-- ==========================================
CREATE TABLE IF NOT EXISTS amendments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  changed_field TEXT,
  old_value TEXT,
  new_value TEXT,
  reason TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW(),
  changed_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_amendments_booking_id ON amendments(booking_id);

-- ==========================================
-- TABLE: room_bookings
-- Rooms inherit dates/slots from the venue booking — no separate dates.
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
-- Line items for consolidated bill (category: lighting | others)
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
-- ROW LEVEL SECURITY
-- ==========================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE amendments ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS
-- For anon access (app uses anon key + custom auth), allow all:
CREATE POLICY "allow_all_users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_bookings" ON bookings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_booking_slots" ON booking_slots FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_payments" ON payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_commitments" ON commitments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_amendments" ON amendments FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE room_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidental_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_room_bookings" ON room_bookings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_incidental_items" ON incidental_items FOR ALL USING (true) WITH CHECK (true);

-- ==========================================
-- SEED DATA: Default Users
-- Pins stored as plain text for simplicity
-- In production, hash with bcrypt
-- ==========================================
INSERT INTO users (username, display_name, role, pin) VALUES
  ('management', 'Management User', 'management', '1234'),
  ('accounts', 'Accounts User', 'accounts', '1234'),
  ('sales', 'Sales User', 'sales', '1234'),
  ('events', 'Events User', 'events', '1234'),
  ('housekeeping', 'Housekeeping User', 'housekeeping', '1234')
ON CONFLICT (username) DO NOTHING;
