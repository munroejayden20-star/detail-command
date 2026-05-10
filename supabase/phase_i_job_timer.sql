-- ==========================================================================
-- Detail Command — Phase I: Work Mode job timer
-- ==========================================================================
-- Run in Supabase SQL editor. Idempotent.
--
-- Records the actual wall-clock start/end of a job when the detailer presses
-- Start/Mark complete in Work Mode. Independent of the scheduled start/end
-- so it tracks real time on site rather than booked time.
--
-- Existing rows default to NULL (no recorded duration), preserving current
-- behavior — duration just won't show on jobs done before this column existed.
-- ==========================================================================

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS actual_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS actual_end_at   TIMESTAMPTZ;

-- ==========================================================================
-- Done.
-- ==========================================================================
