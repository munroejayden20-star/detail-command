-- ==========================================================================
-- Detail Command — Phase H: Expense credits
-- ==========================================================================
-- Run in Supabase SQL editor. Idempotent.
--
-- Adds a "kind" column to expenses so you can record money coming back IN
-- (gift cards, refunds, rebates) that offsets expenses going OUT — without
-- using awkward negative amounts.
--
-- Existing rows default to 'expense' so totals stay identical.
-- ==========================================================================

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'expense'
    CHECK (kind IN ('expense', 'credit'));

-- ==========================================================================
-- Done.
-- ==========================================================================
