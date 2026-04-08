-- Migration: Add resp_rate column to vitals table
-- Run this if you get an error about missing resp_rate column

ALTER TABLE vitals ADD COLUMN resp_rate FLOAT DEFAULT 16;

-- Verify the column was added
DESCRIBE vitals;
