-- Migration 003: Room Allotment workflow
-- Rooms are now allotted after the pre-event meeting, not at booking time.
-- Add key-issuance tracking and allotment notes to room_bookings.
-- Add rooms_required count to bookings (reserved at booking time).

-- 1. rooms_required: how many rooms the client needs (set at booking time)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS rooms_required INT DEFAULT 0;

-- 2. Key-issuance tracking on individual room allotments
ALTER TABLE room_bookings
  ADD COLUMN IF NOT EXISTS key_issued_by  UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS key_issued_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes          TEXT;

-- Optional: clear any rooms that were pre-filled during old booking flow
-- (run only if you want a clean slate — comment out to keep existing data)
-- DELETE FROM room_bookings;
