-- ==========================================================================
-- Detail Command — Phase C: Tax Center
-- ==========================================================================
-- Run in Supabase SQL editor. Idempotent.
--
-- Adds two settings columns used by the new Tax Center dashboard:
--   - tax_set_aside_percent  — % of net profit to recommend setting aside
--                              for taxes (default 25)
--   - tax_business_state     — short state code, e.g. 'WA' / 'OR'
--                              shown in the dashboard header
--
-- All Tax Center math runs client-side on already-loaded receipts/expenses.
-- No new tables; this phase is pure UI + one settings expansion.
-- ==========================================================================

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS tax_set_aside_percent NUMERIC NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS tax_business_state TEXT;

-- ==========================================================================
-- Done.
-- ==========================================================================
