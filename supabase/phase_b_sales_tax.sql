-- ==========================================================================
-- Detail Command — Phase B: Sales Tax on Receipts
-- ==========================================================================
-- Run in Supabase SQL editor. Idempotent.
--
-- Adds opt-in sales-tax tracking to settings. The percentage rate (
-- settings.default_tax_rate) already exists from earlier phases; this just
-- adds an enable flag and an optional disclaimer line shown on receipts.
--
-- The receipt math itself runs client-side in MarkCompleteDialog:
--   tax = round((subtotal - discount) * rate / 100)
--
-- Receipts already store `tax_cents` on each row from Phase A — no change
-- to the receipts table is required.
-- ==========================================================================

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS sales_tax_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS sales_tax_disclaimer TEXT;

-- ==========================================================================
-- Done. Toggle settings.sales_tax_enabled to start auto-calculating tax on
-- new receipts. The rate comes from settings.default_tax_rate (percentage,
-- e.g. 8.5 for 8.5%).
-- ==========================================================================
