-- ==========================================================================
-- Detail Command — Phase A: Receipts (Phase 1 of Receipt + Tax Center)
-- ==========================================================================
-- Run in your Supabase SQL editor. Idempotent — safe to re-run.
--
-- What this adds:
--   1. receipts table (with snapshot columns so old receipts don't drift if
--      the customer/service is later edited).
--   2. receipt_number_sequences table — per-user, per-year counter.
--   3. next_receipt_number() function — atomic, race-safe.
--   4. public.get_public_receipt_by_token(text) RPC — anon-callable, returns
--      a single receipt by its public_receipt_token. No admin data leaked.
--   5. RLS policies — admin-only via public.is_admin() (Phase 8 pattern).
--   6. Realtime publication for receipts.
--   7. Settings additions for receipt customization.
-- ==========================================================================

-- ---------- 1. Settings additions ----------

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS receipt_footer_message TEXT,
  ADD COLUMN IF NOT EXISTS auto_generate_receipt_on_complete BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS default_payment_method TEXT NOT NULL DEFAULT 'cash';

-- ---------- 2. receipts table ----------

CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Relationships (nullable so receipts survive entity deletion)
  customer_id      TEXT REFERENCES customers(id)    ON DELETE SET NULL,
  appointment_id   TEXT REFERENCES appointments(id) ON DELETE SET NULL,

  -- Numbering
  receipt_number   TEXT NOT NULL,

  -- Status
  receipt_status   TEXT NOT NULL DEFAULT 'active',  -- 'active' | 'voided'
  payment_status   TEXT NOT NULL DEFAULT 'paid',    -- 'unpaid' | 'partial' | 'paid'
  payment_method   TEXT NOT NULL DEFAULT 'cash',    -- cash|card|stripe|square|apple_pay|venmo|zelle|other

  -- Money — all in cents
  subtotal_cents          INTEGER NOT NULL DEFAULT 0,
  discount_cents          INTEGER NOT NULL DEFAULT 0,
  tax_cents               INTEGER NOT NULL DEFAULT 0,
  deposit_paid_cents      INTEGER NOT NULL DEFAULT 0,
  total_cents             INTEGER NOT NULL DEFAULT 0,
  amount_paid_cents       INTEGER NOT NULL DEFAULT 0,
  remaining_balance_cents INTEGER NOT NULL DEFAULT 0,
  currency                TEXT    NOT NULL DEFAULT 'usd',

  -- Frozen records — never re-derive from the live tables. If the customer
  -- name or service price changes a year later, the old receipt is unaffected.
  line_items           JSONB NOT NULL DEFAULT '[]'::jsonb,
  customer_snapshot    JSONB,
  vehicle_snapshot     JSONB,
  business_snapshot    JSONB,
  appointment_snapshot JSONB,

  notes        TEXT,
  sent_via     TEXT,             -- 'sms' | 'email' | 'copied' | null
  sent_at      TIMESTAMPTZ,

  -- Public link token — random, unguessable. Anon callers pass this to
  -- get_public_receipt_by_token() to view a single receipt.
  public_receipt_token TEXT,

  pdf_url      TEXT,              -- reserved for a later phase

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX        IF NOT EXISTS receipts_user_id_idx        ON receipts(user_id);
CREATE INDEX        IF NOT EXISTS receipts_customer_id_idx    ON receipts(customer_id);
CREATE INDEX        IF NOT EXISTS receipts_appointment_id_idx ON receipts(appointment_id);
CREATE INDEX        IF NOT EXISTS receipts_created_at_idx     ON receipts(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS receipts_number_per_user_idx ON receipts(user_id, receipt_number);
CREATE UNIQUE INDEX IF NOT EXISTS receipts_token_idx           ON receipts(public_receipt_token) WHERE public_receipt_token IS NOT NULL;
-- Only one ACTIVE receipt per appointment. Voided receipts don't count, so
-- the owner can void + reissue without violating the constraint.
CREATE UNIQUE INDEX IF NOT EXISTS receipts_one_active_per_appointment_idx
  ON receipts(appointment_id) WHERE receipt_status = 'active' AND appointment_id IS NOT NULL;

-- updated_at trigger
CREATE OR REPLACE FUNCTION _receipts_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS receipts_updated_at ON receipts;
CREATE TRIGGER receipts_updated_at BEFORE UPDATE ON receipts
FOR EACH ROW EXECUTE FUNCTION _receipts_set_updated_at();

-- ---------- 3. receipt_number_sequences (per-user yearly counter) ----------

CREATE TABLE IF NOT EXISTS receipt_number_sequences (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year        INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, year)
);

ALTER TABLE receipt_number_sequences ENABLE ROW LEVEL SECURITY;
-- No user-facing policies — only the SECURITY DEFINER function below mutates this.

-- ---------- 4. next_receipt_number() ----------
-- Atomic, race-safe. Returns a string like 'JMD-2026-0001'.
-- The prefix defaults to 'JMD' but the caller can pass a per-business one.

CREATE OR REPLACE FUNCTION public.next_receipt_number(
  p_user_id UUID,
  p_prefix  TEXT DEFAULT 'JMD'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM (NOW() AT TIME ZONE 'America/Los_Angeles'))::int;
  v_next INTEGER;
BEGIN
  INSERT INTO receipt_number_sequences (user_id, year, last_number)
  VALUES (p_user_id, v_year, 1)
  ON CONFLICT (user_id, year) DO UPDATE
    SET last_number = receipt_number_sequences.last_number + 1
  RETURNING last_number INTO v_next;

  RETURN p_prefix || '-' || v_year::text || '-' || lpad(v_next::text, 4, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_receipt_number(UUID, TEXT) TO authenticated;

-- ---------- 5. RLS ----------

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin select own receipts" ON receipts;
DROP POLICY IF EXISTS "admin insert own receipts" ON receipts;
DROP POLICY IF EXISTS "admin update own receipts" ON receipts;
DROP POLICY IF EXISTS "admin delete own receipts" ON receipts;

CREATE POLICY "admin select own receipts"
  ON receipts FOR SELECT
  USING (auth.uid() = user_id AND public.is_admin());

CREATE POLICY "admin insert own receipts"
  ON receipts FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_admin());

CREATE POLICY "admin update own receipts"
  ON receipts FOR UPDATE
  USING (auth.uid() = user_id AND public.is_admin())
  WITH CHECK (auth.uid() = user_id AND public.is_admin());

CREATE POLICY "admin delete own receipts"
  ON receipts FOR DELETE
  USING (auth.uid() = user_id AND public.is_admin());

-- ---------- 6. Public receipt RPC ----------
-- Anon callers pass a token (received from an SMS/email link) and get back
-- a single receipt's public-safe fields. No customer phone/email leaked
-- beyond what the customer themselves owns. Only active (non-voided) receipts.

CREATE OR REPLACE FUNCTION public.get_public_receipt_by_token(p_token TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receipt receipts%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 16 THEN
    RETURN jsonb_build_object('error', 'Invalid receipt link');
  END IF;

  SELECT * INTO v_receipt
  FROM receipts
  WHERE public_receipt_token = p_token
    AND receipt_status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Receipt not found');
  END IF;

  RETURN jsonb_build_object(
    'receiptNumber',         v_receipt.receipt_number,
    'paymentStatus',         v_receipt.payment_status,
    'paymentMethod',         v_receipt.payment_method,
    'subtotalCents',         v_receipt.subtotal_cents,
    'discountCents',         v_receipt.discount_cents,
    'taxCents',              v_receipt.tax_cents,
    'depositPaidCents',      v_receipt.deposit_paid_cents,
    'totalCents',            v_receipt.total_cents,
    'amountPaidCents',       v_receipt.amount_paid_cents,
    'remainingBalanceCents', v_receipt.remaining_balance_cents,
    'currency',              v_receipt.currency,
    'lineItems',             v_receipt.line_items,
    'customerSnapshot',      v_receipt.customer_snapshot,
    'vehicleSnapshot',       v_receipt.vehicle_snapshot,
    'businessSnapshot',      v_receipt.business_snapshot,
    'appointmentSnapshot',   v_receipt.appointment_snapshot,
    'notes',                 v_receipt.notes,
    'createdAt',             v_receipt.created_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_receipt_by_token(TEXT) TO anon, authenticated;

-- ---------- 7. Realtime publication ----------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'receipts'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE receipts';
  END IF;
END$$;

-- ==========================================================================
-- Done. Notes:
--   - The frontend calls next_receipt_number(auth.uid()) before INSERTing a
--     receipt to grab a unique number atomically.
--   - public_receipt_token should be a 32+ char random hex string generated
--     client-side (crypto.randomUUID + suffix).
--   - Soft-delete only: voided receipts stay in the table with
--     receipt_status='voided' so audit history is preserved.
-- ==========================================================================
