-- ==========================================================================
-- Detail Command — Phase D: Mileage tracker
-- ==========================================================================
-- Run in Supabase SQL editor. Idempotent.
--
-- Adds a mileage_entries table for IRS-style trip logging:
--   - one row per trip
--   - business or personal flag (only business counts toward Tax Center)
--   - optional odometer start/end
--   - optional charging-cost in cents (for EV detailing rigs)
--   - optional links to a customer + appointment
--
-- RLS uses the same admin-only pattern as receipts.
-- ==========================================================================

CREATE TABLE IF NOT EXISTS mileage_entries (
  id            TEXT PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  entry_date    DATE NOT NULL,
  start_location TEXT,
  destination   TEXT,
  miles         NUMERIC NOT NULL DEFAULT 0,

  odometer_start NUMERIC,
  odometer_end   NUMERIC,

  purpose       TEXT,
  is_business   BOOLEAN NOT NULL DEFAULT TRUE,

  charging_cost_cents INTEGER,

  customer_id    TEXT REFERENCES customers(id)    ON DELETE SET NULL,
  appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,

  notes         TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mileage_entries_user_id_idx        ON mileage_entries(user_id);
CREATE INDEX IF NOT EXISTS mileage_entries_entry_date_idx     ON mileage_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS mileage_entries_customer_id_idx    ON mileage_entries(customer_id);
CREATE INDEX IF NOT EXISTS mileage_entries_appointment_id_idx ON mileage_entries(appointment_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION _mileage_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mileage_entries_updated_at ON mileage_entries;
CREATE TRIGGER mileage_entries_updated_at BEFORE UPDATE ON mileage_entries
FOR EACH ROW EXECUTE FUNCTION _mileage_set_updated_at();

-- ---------- RLS (admin-only via is_admin) ----------

ALTER TABLE mileage_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin select own mileage" ON mileage_entries;
DROP POLICY IF EXISTS "admin insert own mileage" ON mileage_entries;
DROP POLICY IF EXISTS "admin update own mileage" ON mileage_entries;
DROP POLICY IF EXISTS "admin delete own mileage" ON mileage_entries;

CREATE POLICY "admin select own mileage"
  ON mileage_entries FOR SELECT
  USING (auth.uid() = user_id AND public.is_admin());

CREATE POLICY "admin insert own mileage"
  ON mileage_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id AND public.is_admin());

CREATE POLICY "admin update own mileage"
  ON mileage_entries FOR UPDATE
  USING (auth.uid() = user_id AND public.is_admin())
  WITH CHECK (auth.uid() = user_id AND public.is_admin());

CREATE POLICY "admin delete own mileage"
  ON mileage_entries FOR DELETE
  USING (auth.uid() = user_id AND public.is_admin());

-- ---------- Realtime publication ----------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'mileage_entries'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE mileage_entries';
  END IF;
END$$;

-- ==========================================================================
-- Done.
-- ==========================================================================
