-- ==========================================================================
-- Detail Command — Phase 7: Stripe deposits
-- ==========================================================================
-- Run in your Supabase project SQL editor. Idempotent — safe to re-run.
--
-- What this adds:
--   1. New columns on `settings` for deposit configuration.
--   2. New columns on `appointments` to track deposit state on each booking.
--   3. New `payments` table (source of truth for all money state).
--   4. New `stripe_events` table (idempotency for webhooks).
--   5. New `audit_logs` table (paper trail for money events).
--   6. RLS policies — owner sees their own; anon cannot read directly.
--   7. New `get_public_payment_status(session_id)` RPC so the public
--      booking success page can poll for status without auth.
-- ==========================================================================

-- ---------- 1. Settings: deposit configuration ----------

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS booking_deposits_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS booking_deposit_amount_cents INTEGER NOT NULL DEFAULT 3000,
  ADD COLUMN IF NOT EXISTS booking_deposit_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS booking_auto_confirm_after_deposit BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS booking_deposit_refund_policy TEXT,
  ADD COLUMN IF NOT EXISTS booking_deposit_disclaimer TEXT,
  ADD COLUMN IF NOT EXISTS booking_allow_without_deposit BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS booking_deposit_applies_to_total BOOLEAN NOT NULL DEFAULT true;

-- ---------- 2. Appointments: per-booking deposit tracking ----------

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS deposit_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deposit_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS final_price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;

-- payment_status already exists with values 'unpaid'|'deposit'|'paid'.
-- We extend the vocabulary by allowing additional string values; no enum
-- constraint change needed since the column is text.

-- ---------- 3. Payments table ----------

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  stripe_customer_id TEXT,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  payment_type TEXT NOT NULL DEFAULT 'deposit',
    -- one of: deposit, invoice, final_payment, refund
  status TEXT NOT NULL DEFAULT 'pending',
    -- one of: pending, paid, failed, canceled, expired, refunded, partially_refunded
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  amount_refunded_cents INTEGER NOT NULL DEFAULT 0,
  receipt_url TEXT,
  failure_reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payments_user_id_idx ON payments(user_id);
CREATE INDEX IF NOT EXISTS payments_appointment_id_idx ON payments(appointment_id);
CREATE INDEX IF NOT EXISTS payments_customer_id_idx ON payments(customer_id);
CREATE UNIQUE INDEX IF NOT EXISTS payments_stripe_session_idx
  ON payments(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS payments_stripe_pi_idx ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(user_id, status);
CREATE INDEX IF NOT EXISTS payments_created_at_idx ON payments(created_at DESC);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION _payments_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_updated_at ON payments;
CREATE TRIGGER payments_updated_at BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION _payments_set_updated_at();

-- ---------- 4. Stripe events table (webhook idempotency) ----------

CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,                     -- our own ID
  stripe_event_id TEXT UNIQUE NOT NULL,    -- evt_xxx from Stripe
  type TEXT NOT NULL,
  user_id UUID,                            -- nullable, set when known
  payload JSONB,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS stripe_events_type_idx ON stripe_events(type);

-- ---------- 5. Audit logs table (paper trail) ----------

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,               -- 'payment' | 'appointment' | 'stripe_event' | etc.
  entity_id TEXT,
  action TEXT NOT NULL,                    -- 'deposit.created', 'deposit.paid', etc.
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at DESC);

-- ---------- 6. RLS ----------

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Owner can do everything on their own rows. Anon cannot read.
DO $$
DECLARE t TEXT;
DECLARE tables TEXT[] := ARRAY['payments','audit_logs'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE FORMAT('DROP POLICY IF EXISTS "users select own %1$s" ON %1$I', t);
    EXECUTE FORMAT('DROP POLICY IF EXISTS "users insert own %1$s" ON %1$I', t);
    EXECUTE FORMAT('DROP POLICY IF EXISTS "users update own %1$s" ON %1$I', t);
    EXECUTE FORMAT('DROP POLICY IF EXISTS "users delete own %1$s" ON %1$I', t);
    EXECUTE FORMAT('CREATE POLICY "users select own %1$s" ON %1$I FOR SELECT USING (auth.uid() = user_id)', t);
    EXECUTE FORMAT('CREATE POLICY "users insert own %1$s" ON %1$I FOR INSERT WITH CHECK (auth.uid() = user_id)', t);
    EXECUTE FORMAT('CREATE POLICY "users update own %1$s" ON %1$I FOR UPDATE USING (auth.uid() = user_id)', t);
    EXECUTE FORMAT('CREATE POLICY "users delete own %1$s" ON %1$I FOR DELETE USING (auth.uid() = user_id)', t);
  END LOOP;
END$$;

-- stripe_events is service-role-only — no user-scoped policies.
-- The service role bypasses RLS, so it can read/write freely.
-- Authenticated users have no policies → no access.

-- Realtime: payments visible cross-device
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'payments'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE payments';
  END IF;
END$$;

-- ---------- 7. Public payment status RPC (for success page) ----------
--
-- Customer just paid; they have the checkout session ID in the success URL
-- as `session_id=xxx`. They should be able to poll status without auth. We
-- only return safe minimal fields — no other customer info, no internal IDs
-- the public couldn't already infer from their own session.

CREATE OR REPLACE FUNCTION get_public_payment_status(p_session_id TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment    record;
  v_appt       record;
  v_business   text;
BEGIN
  IF p_session_id IS NULL OR length(trim(p_session_id)) = 0 THEN
    RETURN jsonb_build_object('error', 'Missing session_id');
  END IF;

  SELECT * INTO v_payment
  FROM payments
  WHERE stripe_checkout_session_id = p_session_id
  LIMIT 1;

  IF NOT FOUND THEN
    -- Webhook may not have created the row yet (extreme edge case) or the
    -- session is invalid. Either way, return a safe "unknown" state — the
    -- success page polls and will get the real status once it lands.
    RETURN jsonb_build_object(
      'status', 'pending',
      'amountCents', 0,
      'currency', 'usd'
    );
  END IF;

  SELECT * INTO v_appt
  FROM appointments
  WHERE id = v_payment.appointment_id
  LIMIT 1;

  SELECT business_name INTO v_business
  FROM settings WHERE user_id = v_payment.user_id;

  RETURN jsonb_build_object(
    'status',         v_payment.status,
    'amountCents',    v_payment.amount_cents,
    'currency',       v_payment.currency,
    'paidAt',         v_payment.paid_at,
    'businessName',   v_business,
    'bookingStatus',  COALESCE(v_appt.status, 'unknown'),
    'preferredDate',  CASE
                        WHEN v_appt IS NOT NULL THEN
                          to_char(v_appt.start_at AT TIME ZONE 'America/Los_Angeles', 'YYYY-MM-DD"T"HH24:MI')
                        ELSE NULL
                      END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_payment_status(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_public_payment_status(TEXT) TO authenticated;

-- ---------- 8. Updated get_public_booking_info — includes deposit info ----------
--
-- The booking page needs to know whether deposits are enabled, the amount,
-- the disclaimer/refund policy, etc. This is the same RPC from Phase 6B,
-- now extended with a `deposit` block. Idempotent — replaces the function
-- definition.

CREATE OR REPLACE FUNCTION get_public_booking_info()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id    uuid;
  v_settings    record;
  v_services    jsonb;
  v_featured    jsonb;
  v_booked      jsonb;
BEGIN
  SELECT id INTO v_owner_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('error', 'No owner configured');
  END IF;

  SELECT * INTO v_settings FROM settings WHERE user_id = v_owner_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Settings not found');
  END IF;

  IF NOT COALESCE(v_settings.booking_page_enabled, false) THEN
    RETURN jsonb_build_object('error', 'Booking page is disabled');
  END IF;

  -- Services
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',              id,
      'name',            name,
      'description',     description,
      'priceLow',        price_low,
      'priceHigh',       price_high,
      'durationMinutes', duration_minutes,
      'isAddon',         is_addon
    ) ORDER BY is_addon, name
  )
  INTO v_services
  FROM services
  WHERE user_id = v_owner_id;

  -- Featured photos
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('id', p.id, 'url', p.storage_path, 'caption', p.notes)
      ORDER BY t.ordinality
    ),
    '[]'::jsonb
  )
  INTO v_featured
  FROM jsonb_array_elements_text(
    COALESCE(v_settings.booking_featured_photo_ids, '[]'::jsonb)
  ) WITH ORDINALITY AS t(photo_id, ordinality)
  JOIN photos p
    ON p.id = t.photo_id
   AND p.user_id = v_owner_id
   AND p.storage_path LIKE 'http%';

  -- Booked slots — next 90 days, LA wall-clock
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'start', to_char(start_at AT TIME ZONE 'America/Los_Angeles', 'YYYY-MM-DD"T"HH24:MI'),
        'end',   to_char(end_at   AT TIME ZONE 'America/Los_Angeles', 'YYYY-MM-DD"T"HH24:MI')
      )
    ),
    '[]'::jsonb
  )
  INTO v_booked
  FROM appointments
  WHERE user_id = v_owner_id
    AND status NOT IN ('canceled', 'completed')
    AND start_at >= NOW() - INTERVAL '1 hour'
    AND start_at <= NOW() + INTERVAL '90 days';

  RETURN jsonb_build_object(
    'services', COALESCE(v_services, '[]'::jsonb),
    'bookedSlots', v_booked,
    'deposit', jsonb_build_object(
      'enabled',                  COALESCE(v_settings.booking_deposits_enabled, false),
      'required',                 COALESCE(v_settings.booking_deposit_required, false),
      'amountCents',              COALESCE(v_settings.booking_deposit_amount_cents, 3000),
      'allowWithoutDeposit',      COALESCE(v_settings.booking_allow_without_deposit, false),
      'appliesToTotal',           COALESCE(v_settings.booking_deposit_applies_to_total, true),
      'refundPolicy',             v_settings.booking_deposit_refund_policy,
      'disclaimer',               v_settings.booking_deposit_disclaimer,
      'autoConfirmAfterDeposit',  COALESCE(v_settings.booking_auto_confirm_after_deposit, false)
    ),
    'settings', jsonb_build_object(
      'businessName',           v_settings.business_name,
      'serviceArea',            v_settings.service_area,
      'bookingPageEnabled',     v_settings.booking_page_enabled,
      'defaultQuoteDisclaimer', v_settings.default_quote_disclaimer,
      'heroHeadline',           v_settings.booking_hero_headline,
      'heroSubheadline',        v_settings.booking_hero_subheadline,
      'heroImageUrl',           v_settings.booking_hero_image_url,
      'waterPowerText',         v_settings.booking_water_power_text,
      'bookingPhone',           COALESCE(v_settings.booking_phone, v_settings.contact_phone),
      'bookingEmail',           COALESCE(v_settings.booking_email, v_settings.email),
      'faqs',                   v_settings.booking_faqs,
      'featuredPhotos',         v_featured,
      'logoUrl',                v_settings.logo_url
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_booking_info() TO anon;

-- ==========================================================================
-- Notes
-- ==========================================================================
-- 1. The Stripe Checkout flow is owned by an Edge Function (`stripe-checkout`)
--    that runs with the service role. It calls `submit_public_booking` to
--    create the booking, then inserts a `payments` row, then creates the
--    Stripe Checkout Session, then updates the row with the session ID.
-- 2. The webhook (`stripe-webhook`) verifies the Stripe signature server-side,
--    de-duplicates via `stripe_events`, and writes to `payments`,
--    `appointments`, `notifications`, and `audit_logs` atomically per event.
-- 3. The customer success page calls `get_public_payment_status` to poll
--    until the webhook lands. It only knows the session_id, which the
--    customer themselves received from Stripe — there's no way to enumerate
--    other people's payments from this RPC.
-- ==========================================================================
