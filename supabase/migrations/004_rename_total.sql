-- Migration 004: Financial model — rename total → lawn_rental, drop deposit_status
-- lawn_rental = venue rental fee only (not including rooms or deposit)
-- Total to Collect = lawn_rental + (rooms × ₹5,000) + deposit_amount

ALTER TABLE bookings RENAME COLUMN total TO lawn_rental;
ALTER TABLE bookings DROP COLUMN IF EXISTS deposit_status;
