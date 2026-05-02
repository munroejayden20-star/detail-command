-- ==========================================================================
-- Detail Command — Booking System Fixes
-- ==========================================================================
-- Run this in your Supabase project SQL editor (https://app.supabase.com).
-- Safe to re-run — uses IF NOT EXISTS / CREATE OR REPLACE throughout.
--
-- What this fixes:
--   1. Missing columns (source, booking_photo_urls on appointments;
--      preferred_contact on customers)
--   2. booking-uploads storage bucket + anon upload/read policies
--   3. get_public_booking_info RPC (idempotent replace)
--   4. submit_public_booking RPC — timezone bug fixed (America/Los_Angeles),
--      photo metadata now inserted into photos table
-- ==========================================================================

-- ---------- 1. Missing table columns ----------

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'dashboard',
  ADD COLUMN IF NOT EXISTS booking_photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS preferred_contact TEXT;

-- ---------- 2. Public booking-uploads storage bucket ----------

INSERT INTO storage.buckets (id, name, public)
VALUES ('booking-uploads', 'booking-uploads', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow any anonymous user to upload files (booking page is not authenticated)
DROP POLICY IF EXISTS "anon upload booking photos" ON storage.objects;
CREATE POLICY "anon upload booking photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'booking-uploads');

-- Allow anyone to read booking photos (bucket is public)
DROP POLICY IF EXISTS "public read booking photos" ON storage.objects;
CREATE POLICY "public read booking photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'booking-uploads');

-- Allow the authenticated owner to delete booking photos
DROP POLICY IF EXISTS "owner delete booking photos" ON storage.objects;
CREATE POLICY "owner delete booking photos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'booking-uploads' AND auth.uid() IS NOT NULL);

-- ---------- 3. get_public_booking_info ----------

CREATE OR REPLACE FUNCTION get_public_booking_info()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
  v_settings record;
  v_services jsonb;
BEGIN
  -- Single-owner app: first user is always the business owner
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

  RETURN jsonb_build_object(
    'services', COALESCE(v_services, '[]'::jsonb),
    'settings', jsonb_build_object(
      'businessName',          v_settings.business_name,
      'serviceArea',           v_settings.service_area,
      'bookingPageEnabled',    v_settings.booking_page_enabled,
      'defaultQuoteDisclaimer', v_settings.default_quote_disclaimer
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_booking_info() TO anon;

-- ---------- 4. submit_public_booking ----------
--
-- Key fixes vs. original:
--   • start_at built with timezone('America/Los_Angeles', ...) so the
--     customer's "2:00 PM" selection is stored as 2:00 PM Pacific time,
--     not 2:00 PM UTC (which would display as ~6-8 AM in the dashboard).
--   • Photo URLs are now also inserted into the photos table so they appear
--     in the gallery, customer profile, and appointment detail view.
--   • Existing customer's vehicle list is updated if a new vehicle is given.

CREATE OR REPLACE FUNCTION submit_public_booking(
  p_customer_name      TEXT,
  p_customer_phone     TEXT,
  p_customer_email     TEXT    DEFAULT NULL,
  p_customer_address   TEXT    DEFAULT NULL,
  p_preferred_contact  TEXT    DEFAULT 'text',
  p_vehicle_year       TEXT    DEFAULT '',
  p_vehicle_make       TEXT    DEFAULT '',
  p_vehicle_model      TEXT    DEFAULT '',
  p_vehicle_color      TEXT    DEFAULT '',
  p_vehicle_size       TEXT    DEFAULT '',
  p_interior_condition TEXT    DEFAULT NULL,
  p_exterior_condition TEXT    DEFAULT NULL,
  p_pet_hair           BOOLEAN DEFAULT false,
  p_stains             BOOLEAN DEFAULT false,
  p_heavy_dirt         BOOLEAN DEFAULT false,
  p_vehicle_notes      TEXT    DEFAULT NULL,
  p_service_ids        JSONB   DEFAULT '[]'::jsonb,
  p_addon_ids          JSONB   DEFAULT '[]'::jsonb,
  p_estimated_price    NUMERIC DEFAULT 0,
  p_preferred_date     TEXT    DEFAULT NULL,
  p_preferred_time     TEXT    DEFAULT NULL,
  p_water_access       BOOLEAN DEFAULT true,
  p_power_access       BOOLEAN DEFAULT true,
  p_booking_photo_urls JSONB   DEFAULT '[]'::jsonb,
  p_honeypot           TEXT    DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id       uuid;
  v_customer_id    text;
  v_appointment_id text;
  v_start_at       timestamptz;
  v_end_at         timestamptz;
  v_duration       integer;
  v_vehicle        jsonb;
  v_vehicle_str    text;
  v_photo_url      text;
  v_photo_id       text;
BEGIN
  -- Honeypot: silently succeed so bots get no signal
  IF p_honeypot IS NOT NULL AND length(trim(p_honeypot)) > 0 THEN
    RETURN jsonb_build_object(
      'appointmentId', gen_random_uuid()::text,
      'customerId',    gen_random_uuid()::text
    );
  END IF;

  -- Resolve owner (single-user app)
  SELECT id INTO v_owner_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Service unavailable');
  END IF;

  -- Guard: booking must be enabled
  IF NOT EXISTS (
    SELECT 1 FROM settings
    WHERE user_id = v_owner_id
      AND COALESCE(booking_page_enabled, false) = true
  ) THEN
    RETURN jsonb_build_object('error', 'Booking is currently unavailable');
  END IF;

  -- ── Customer ─────────────────────────────────────────────────────────────

  -- Match existing customer by phone (primary) or email (fallback)
  SELECT id INTO v_customer_id
  FROM customers
  WHERE user_id = v_owner_id
    AND (
      phone = trim(p_customer_phone)
      OR (
        p_customer_email IS NOT NULL
        AND trim(p_customer_email) != ''
        AND email = trim(p_customer_email)
      )
    )
  ORDER BY created_at ASC
  LIMIT 1;

  -- Build vehicle object (used for both customer record and appointment)
  v_vehicle := jsonb_build_object(
    'year',  COALESCE(p_vehicle_year,  ''),
    'make',  COALESCE(p_vehicle_make,  ''),
    'model', COALESCE(p_vehicle_model, ''),
    'color', COALESCE(p_vehicle_color, ''),
    'size',  COALESCE(p_vehicle_size,  '')
  );

  IF v_customer_id IS NULL THEN
    -- New customer
    v_customer_id := gen_random_uuid()::text;
    INSERT INTO customers (
      id, user_id, name, phone, email, address,
      preferred_contact, vehicles,
      is_repeat, is_monthly_maintenance, created_at
    ) VALUES (
      v_customer_id,
      v_owner_id,
      trim(p_customer_name),
      trim(p_customer_phone),
      NULLIF(trim(COALESCE(p_customer_email,  '')), ''),
      NULLIF(trim(COALESCE(p_customer_address, '')), ''),
      COALESCE(p_preferred_contact, 'text'),
      -- Include vehicle in profile if make/model was provided
      CASE
        WHEN COALESCE(p_vehicle_make, '') != '' OR COALESCE(p_vehicle_model, '') != ''
        THEN jsonb_build_array(v_vehicle)
        ELSE '[]'::jsonb
      END,
      false,
      false,
      now()
    );

  ELSE
    -- Existing customer — update preferred_contact if not already set,
    -- and append vehicle if it differs from ones already on file.
    UPDATE customers
    SET
      preferred_contact = COALESCE(preferred_contact, p_preferred_contact),
      vehicles = CASE
        WHEN (COALESCE(p_vehicle_make, '') != '' OR COALESCE(p_vehicle_model, '') != '')
          AND NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(vehicles) AS v
            WHERE v->>'make'  = COALESCE(p_vehicle_make,  '')
              AND v->>'model' = COALESCE(p_vehicle_model, '')
              AND v->>'year'  = COALESCE(p_vehicle_year,  '')
          )
        THEN vehicles || jsonb_build_array(v_vehicle)
        ELSE vehicles
      END
    WHERE id = v_customer_id;
  END IF;

  -- ── Appointment time ──────────────────────────────────────────────────────
  --
  -- IMPORTANT: timezone() converts a "wall-clock" timestamp to the correct UTC
  -- instant for that timezone, respecting DST.
  --
  -- Without this fix, '2025-05-15 14:00'::timestamptz in a UTC Postgres server
  -- stores UTC 14:00, which displays as ~6-8 AM in a Pacific-time browser.
  -- With this fix, 14:00 LA local → correct UTC → displays as 2:00 PM in Pacific.

  IF p_preferred_date IS NOT NULL AND trim(p_preferred_date) != '' THEN
    v_start_at := timezone(
      'America/Los_Angeles',
      p_preferred_date::date
        + COALESCE(NULLIF(trim(p_preferred_time), ''), '09:00')::time
    );
  ELSE
    -- No date given: default to next day at 9 AM LA time
    v_start_at := timezone(
      'America/Los_Angeles',
      (CURRENT_DATE + 1)::date + '09:00'::time
    );
  END IF;

  -- Calculate duration from selected services + add-ons (default 120 min)
  SELECT COALESCE(SUM(duration_minutes), 120) INTO v_duration
  FROM services
  WHERE user_id = v_owner_id
    AND id IN (
      SELECT jsonb_array_elements_text(
        COALESCE(p_service_ids, '[]'::jsonb) ||
        COALESCE(p_addon_ids,   '[]'::jsonb)
      )
    );

  v_end_at := v_start_at + (v_duration || ' minutes')::interval;

  -- ── Appointment ───────────────────────────────────────────────────────────

  v_appointment_id := gen_random_uuid()::text;

  INSERT INTO appointments (
    id, user_id, customer_id,
    vehicle, address,
    start_at, end_at,
    service_ids, addon_ids,
    estimated_price,
    status, source,
    interior_condition, exterior_condition,
    pet_hair, stains, heavy_dirt,
    water_access, power_access,
    customer_notes,
    booking_photo_urls,
    deposit_paid, payment_status,
    created_at
  ) VALUES (
    v_appointment_id,
    v_owner_id,
    v_customer_id,
    v_vehicle,
    COALESCE(NULLIF(trim(COALESCE(p_customer_address, '')), ''), ''),
    v_start_at,
    v_end_at,
    COALESCE(p_service_ids, '[]'::jsonb),
    COALESCE(p_addon_ids,   '[]'::jsonb),
    COALESCE(p_estimated_price, 0),
    'pending_approval',
    'Public Booking Page',
    NULLIF(trim(COALESCE(p_interior_condition, '')), ''),
    NULLIF(trim(COALESCE(p_exterior_condition, '')), ''),
    COALESCE(p_pet_hair,    false),
    COALESCE(p_stains,      false),
    COALESCE(p_heavy_dirt,  false),
    COALESCE(p_water_access,  true),
    COALESCE(p_power_access,  true),
    NULLIF(trim(COALESCE(p_vehicle_notes, '')), ''),
    COALESCE(p_booking_photo_urls, '[]'::jsonb),
    false,
    'unpaid',
    now()
  );

  -- ── Photo metadata ────────────────────────────────────────────────────────
  --
  -- Insert a row into the photos table for each booking photo so they appear
  -- in the Photos gallery and the customer profile.
  -- storage_path is stored as the full public URL because these files live in
  -- the public booking-uploads bucket, not the private photos bucket.
  -- PhotoImage.tsx detects full URLs and renders them directly (no signing).

  v_vehicle_str := trim(
    concat_ws(' ',
      NULLIF(COALESCE(p_vehicle_year,  ''), ''),
      NULLIF(COALESCE(p_vehicle_make,  ''), ''),
      NULLIF(COALESCE(p_vehicle_model, ''), '')
    )
  );

  FOR v_photo_url IN
    SELECT jsonb_array_elements_text(COALESCE(p_booking_photo_urls, '[]'::jsonb))
  LOOP
    v_photo_id := gen_random_uuid()::text;
    INSERT INTO photos (
      id, user_id,
      storage_path, type,
      customer_id, appointment_id,
      vehicle, notes, tags,
      created_at
    ) VALUES (
      v_photo_id,
      v_owner_id,
      v_photo_url,       -- full public URL; PhotoImage.tsx handles this
      'before',          -- booking photos are pre-job "before" photos
      v_customer_id,
      v_appointment_id,
      NULLIF(v_vehicle_str, ''),
      'Uploaded by customer during online booking',
      '["booking", "customer-upload"]'::jsonb,
      now()
    );
  END LOOP;

  -- ── Notification ──────────────────────────────────────────────────────────

  INSERT INTO notifications (
    id, user_id, type, title, message, metadata, read, created_at
  ) VALUES (
    gen_random_uuid()::text,
    v_owner_id,
    'new_booking_request',
    'New booking request',
    trim(p_customer_name) || ' requested ' ||
      to_char(
        v_start_at AT TIME ZONE 'America/Los_Angeles',
        'Mon DD "at" HH12:MI AM'
      ),
    jsonb_build_object(
      'appointmentId', v_appointment_id,
      'customerId',    v_customer_id,
      'customerName',  trim(p_customer_name)
    ),
    false,
    now()
  );

  RETURN jsonb_build_object(
    'appointmentId', v_appointment_id,
    'customerId',    v_customer_id
  );
END;
$$;

-- Grant execute to the anon role so the public booking page can call it
GRANT EXECUTE ON FUNCTION submit_public_booking(
  TEXT, TEXT, TEXT, TEXT, TEXT,
  TEXT, TEXT, TEXT, TEXT, TEXT,
  TEXT, TEXT,
  BOOLEAN, BOOLEAN, BOOLEAN,
  TEXT, JSONB, JSONB, NUMERIC,
  TEXT, TEXT,
  BOOLEAN, BOOLEAN, JSONB, TEXT
) TO anon;
