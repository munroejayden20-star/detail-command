-- ==========================================================================
-- Detail Command — Phase F: Review request workflow
-- ==========================================================================
-- Run in Supabase SQL editor. Idempotent.
--
-- Adds tracking for whether a Google review request has been sent for each
-- appointment, to support the Reviews-due workflow on the dashboard and
-- prevent accidental duplicate spam.
--
-- Existing rows default to "not sent" — preserving current behavior. No data
-- is modified.
-- ==========================================================================

-- ---------- appointments columns ----------

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS review_request_sent      BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS review_request_sent_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_request_method    TEXT;       -- "sms" | "email" | "copied" | "manual"

-- ---------- settings columns ----------

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS review_request_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS review_request_delay_hours INTEGER NOT NULL DEFAULT 2;

-- ==========================================================================
-- Done.
-- ==========================================================================
