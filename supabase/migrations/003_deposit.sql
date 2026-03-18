-- Migration 003: Security Deposit fields on bookings
-- Run this in Supabase SQL Editor

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_due_date DATE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS deposit_status TEXT DEFAULT 'Pending';
