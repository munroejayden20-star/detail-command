-- ==========================================================================
-- Detail Command — Phase K: Customer Portal (token-based, anon)
-- ==========================================================================
-- Run in your Supabase SQL editor. Idempotent — safe to re-run.
--
-- What this adds:
--   1. customers.customer_access_token — stable per-customer random token
--      stored client-side in localStorage. Tap their /book link, hydrate.
--   2. Backfill: every existing customer gets a token.
--   3. submit_public_booking — now returns customerToken in its JSON. Always
--      ensures the customer (new OR existing) has a token. Param signature
--      unchanged; only the response payload gains a field.
--   4. get_public_payment_status — now returns customerToken too so deposit-
--      flow customers also get hydrated after Stripe redirect.
--   5. get_customer_portal_by_token(text) — anon-callable RPC that returns the
--      customer's profile, upcoming appointments, past appointments, and
--      receipts. Only this one customer's data — no cross-customer leakage.
-- ==========================================================================

-- ---------- 1. Token column ----------

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS customer_access_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS customers_access_token_idx
  ON customers(customer_access_token)
  WHERE customer_access_token IS NOT NULL;

-- ---------- 2. Backfill existing customers ----------

UPDATE customers
SET customer_access_token = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
WHERE customer_access_token IS NULL;

-- ---------- 3. submit_public_booking (response now includes customerToken) ----------
-- Same parameter list as booking_fixes.sql. Only changes:
--   • new customer insert: assigns customer_access_token
--   • existing customer: backfills token if missing
--   • return JSON now includes customerToken

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
  v_owner_id        uuid;
  v_customer_id     text;
  v_customer_token  text;
  v_appointment_id  text;
  v_start_at        timestamptz;
  v_end_at          timestamptz;
  v_duration        integer;
  v_vehicle         jsonb;
  v_vehicle_str     text;
  v_photo_url       text;
  v_photo_id        text;
BEGIN
  -- Honeypot
  IF p_honeypot IS NOT NULL AND length(trim(p_honeypot)) > 0 THEN
    RETURN jsonb_build_object(
      'appointmentId', gen_random_uuid()::text,
      'customerId',    gen_random_uuid()::text,
      'customerToken', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
    );
  END IF;

  SELECT id INTO v_owner_id FROM auth.users ORDER BY created_at ASC LIMIT 1;
  IF v_owner_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Service unavailable');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM settings
    WHERE user_id = v_owner_id
      AND COALESCE(booking_page_enabled, false) = true
  ) THEN
    RETURN jsonb_build_object('error', 'Booking is currently unavailable');
  END IF;

  -- ── Customer ───────────────────────────────────────────────────────────
  SELECT id, customer_access_token
  INTO v_customer_id, v_customer_token
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

  v_vehicle := jsonb_build_object(
    'year',  COALESCE(p_vehicle_year,  ''),
    'make',  COALESCE(p_vehicle_make,  ''),
    'model', COALESCE(p_vehicle_model, ''),
    'color', COALESCE(p_vehicle_color, ''),
    'size',  COALESCE(p_vehicle_size,  '')
  );

  IF v_customer_id IS NULL THEN
    v_customer_id    := gen_random_uuid()::text;
    v_customer_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    INSERT INTO customers (
      id, user_id, name, phone, email, address,
      preferred_contact, vehicles,
      customer_access_token,
      is_repeat, is_monthly_maintenance, created_at
    ) VALUES (
      v_customer_id,
      v_owner_id,
      trim(p_customer_name),
      trim(p_customer_phone),
      NULLIF(trim(COALESCE(p_customer_email,  '')), ''),
      NULLIF(trim(COALESCE(p_customer_address, '')), ''),
      COALESCE(p_preferred_contact, 'text'),
      CASE
        WHEN COALESCE(p_vehicle_make, '') != '' OR COALESCE(p_vehicle_model, '') != ''
        THEN jsonb_build_array(v_vehicle)
        ELSE '[]'::jsonb
      END,
      v_customer_token,
      false,
      false,
      now()
    );
  ELSE
    -- Existing customer — backfill token if missing.
    IF v_customer_token IS NULL THEN
      v_customer_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    END IF;
    UPDATE customers
    SET
      preferred_contact = COALESCE(preferred_contact, p_preferred_contact),
      customer_access_token = COALESCE(customer_access_token, v_customer_token),
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

  -- ── Appointment time ─────────────────────────────────────────────────
  IF p_preferred_date IS NOT NULL AND trim(p_preferred_date) != '' THEN
    v_start_at := timezone(
      'America/Los_Angeles',
      p_preferred_date::date
        + COALESCE(NULLIF(trim(p_preferred_time), ''), '09:00')::time
    );
  ELSE
    v_start_at := timezone(
      'America/Los_Angeles',
      (CURRENT_DATE + 1)::date + '09:00'::time
    );
  END IF;

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
      v_photo_url,
      'before',
      v_customer_id,
      v_appointment_id,
      NULLIF(v_vehicle_str, ''),
      'Uploaded by customer during online booking',
      '["booking", "customer-upload"]'::jsonb,
      now()
    );
  END LOOP;

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
    'customerId',    v_customer_id,
    'customerToken', v_customer_token
  );
END;
$$;

GRANT EXECUTE ON FUNCTION submit_public_booking(
  TEXT, TEXT, TEXT, TEXT, TEXT,
  TEXT, TEXT, TEXT, TEXT, TEXT,
  TEXT, TEXT,
  BOOLEAN, BOOLEAN, BOOLEAN,
  TEXT, JSONB, JSONB, NUMERIC,
  TEXT, TEXT,
  BOOLEAN, BOOLEAN, JSONB, TEXT
) TO anon;

-- ---------- 4. get_public_payment_status — now returns customerToken ----------

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
  v_token      text;
BEGIN
  IF p_session_id IS NULL OR length(trim(p_session_id)) = 0 THEN
    RETURN jsonb_build_object('error', 'Missing session_id');
  END IF;

  SELECT * INTO v_payment
  FROM payments
  WHERE stripe_checkout_session_id = p_session_id
  LIMIT 1;

  IF NOT FOUND THEN
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

  SELECT customer_access_token INTO v_token
  FROM customers
  WHERE id = v_payment.customer_id
  LIMIT 1;

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
                      END,
    'customerToken',  v_token
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_payment_status(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_public_payment_status(TEXT) TO authenticated;

-- ---------- 5. get_customer_portal_by_token ----------
-- Anon-callable, token-gated. Returns ONLY this customer's data — no
-- cross-customer info, no admin info, no other customer phones/emails.

CREATE OR REPLACE FUNCTION get_customer_portal_by_token(p_token TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer       record;
  v_business_name  text;
  v_review_link    text;
  v_upcoming       jsonb;
  v_past           jsonb;
  v_receipts       jsonb;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 16 THEN
    RETURN jsonb_build_object('error', 'Invalid link');
  END IF;

  SELECT * INTO v_customer
  FROM customers
  WHERE customer_access_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Not found');
  END IF;

  SELECT business_name, google_review_link
  INTO v_business_name, v_review_link
  FROM settings
  WHERE user_id = v_customer.user_id;

  -- Upcoming = appointments scheduled at or after now (not canceled).
  SELECT COALESCE(jsonb_agg(row_data ORDER BY (row_data->>'startAt')), '[]'::jsonb)
  INTO v_upcoming
  FROM (
    SELECT jsonb_build_object(
      'id',              a.id,
      'startAt',         a.start_at,
      'endAt',           a.end_at,
      'status',          a.status,
      'paymentStatus',   a.payment_status,
      'depositPaid',     COALESCE(a.deposit_paid, false),
      'estimatedPrice',  a.estimated_price,
      'finalPrice',      a.final_price,
      'vehicle',         a.vehicle,
      'address',         a.address,
      'serviceNames',    (
        SELECT COALESCE(jsonb_agg(s.name ORDER BY s.name), '[]'::jsonb)
        FROM services s
        WHERE s.user_id = a.user_id
          AND s.id IN (
            SELECT jsonb_array_elements_text(
              COALESCE(a.service_ids, '[]'::jsonb) ||
              COALESCE(a.addon_ids,   '[]'::jsonb)
            )
          )
      )
    ) AS row_data
    FROM appointments a
    WHERE a.customer_id = v_customer.id
      AND a.status != 'canceled'
      AND a.start_at >= NOW() - interval '2 hours'  -- include "just finished"
    ORDER BY a.start_at ASC
    LIMIT 10
  ) t;

  -- Past = everything else, most-recent first.
  SELECT COALESCE(jsonb_agg(row_data ORDER BY (row_data->>'startAt') DESC), '[]'::jsonb)
  INTO v_past
  FROM (
    SELECT jsonb_build_object(
      'id',              a.id,
      'startAt',         a.start_at,
      'status',          a.status,
      'paymentStatus',   a.payment_status,
      'finalPrice',      a.final_price,
      'estimatedPrice',  a.estimated_price,
      'vehicle',         a.vehicle,
      'serviceNames',    (
        SELECT COALESCE(jsonb_agg(s.name ORDER BY s.name), '[]'::jsonb)
        FROM services s
        WHERE s.user_id = a.user_id
          AND s.id IN (
            SELECT jsonb_array_elements_text(
              COALESCE(a.service_ids, '[]'::jsonb) ||
              COALESCE(a.addon_ids,   '[]'::jsonb)
            )
          )
      )
    ) AS row_data
    FROM appointments a
    WHERE a.customer_id = v_customer.id
      AND (a.status = 'canceled' OR a.start_at < NOW() - interval '2 hours')
    ORDER BY a.start_at DESC
    LIMIT 20
  ) t;

  SELECT COALESCE(jsonb_agg(row_data ORDER BY (row_data->>'createdAt') DESC), '[]'::jsonb)
  INTO v_receipts
  FROM (
    SELECT jsonb_build_object(
      'receiptNumber',        r.receipt_number,
      'publicReceiptToken',   r.public_receipt_token,
      'createdAt',            r.created_at,
      'totalCents',           r.total_cents,
      'amountPaidCents',      r.amount_paid_cents,
      'currency',             r.currency,
      'paymentStatus',        r.payment_status
    ) AS row_data
    FROM receipts r
    WHERE r.customer_id = v_customer.id
      AND r.receipt_status = 'active'
      AND r.public_receipt_token IS NOT NULL
    ORDER BY r.created_at DESC
    LIMIT 20
  ) t;

  RETURN jsonb_build_object(
    'customer', jsonb_build_object(
      'id',                v_customer.id,
      'name',              v_customer.name,
      'phone',             v_customer.phone,
      'email',             v_customer.email,
      'address',           v_customer.address,
      'preferredContact',  v_customer.preferred_contact,
      'vehicles',          COALESCE(v_customer.vehicles, '[]'::jsonb)
    ),
    'business', jsonb_build_object(
      'name',       v_business_name,
      'reviewLink', v_review_link
    ),
    'upcoming',  v_upcoming,
    'past',      v_past,
    'receipts',  v_receipts
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_customer_portal_by_token(TEXT) TO anon, authenticated;
