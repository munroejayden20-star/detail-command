-- ==========================================================================
-- Detail Command — Phase N: Server-side double-booking guard
-- ==========================================================================
-- Run in your Supabase SQL editor. Idempotent — safe to re-run.
--
-- Both public booking entry points now reject any request that would overlap
-- with an existing non-terminal appointment. The booking form already greys
-- out conflicting slots client-side; this is the server-side enforcement.
--
--   • submit_public_booking — guards against new bookings double-up
--   • reschedule_appointment_by_token — guards reschedules into a busy slot
--     (excludes the appointment being moved itself)
--
-- Returns { error: '...' } when blocked. The frontend already surfaces
-- data.error so no client changes are required.
-- ==========================================================================

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

  -- Customer (same logic as Phase K)
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
  ELSE
    IF v_customer_token IS NULL THEN
      v_customer_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    END IF;
  END IF;

  -- ── Appointment time ───────────────────────────────────────────────────
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

  -- ── Conflict guard ─────────────────────────────────────────────────────
  -- Two intervals [a,b) and [c,d) overlap when a < d AND b > c. We exclude
  -- terminal statuses since they no longer hold the slot.
  IF EXISTS (
    SELECT 1
    FROM appointments x
    WHERE x.user_id = v_owner_id
      AND x.status NOT IN ('canceled', 'completed', 'no_show')
      AND x.start_at < v_end_at
      AND x.end_at   > v_start_at
  ) THEN
    RETURN jsonb_build_object(
      'error',
      'That time just got taken — please pick another slot.'
    );
  END IF;

  -- ── Persist customer (now that the slot is safe) ───────────────────────
  IF NOT EXISTS (SELECT 1 FROM customers WHERE id = v_customer_id) THEN
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

  -- ── Appointment ────────────────────────────────────────────────────────
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


-- Reschedule guard — overlap check excludes the appointment being moved.
CREATE OR REPLACE FUNCTION public.reschedule_appointment_by_token(
  p_token          TEXT,
  p_appointment_id TEXT,
  p_new_date       TEXT,
  p_new_time       TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer    customers%ROWTYPE;
  v_appt        appointments%ROWTYPE;
  v_old_start   timestamptz;
  v_new_start   timestamptz;
  v_new_end     timestamptz;
  v_duration_min integer;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 16 THEN
    RETURN jsonb_build_object('error', 'Invalid link');
  END IF;
  IF p_appointment_id IS NULL OR length(trim(p_appointment_id)) = 0 THEN
    RETURN jsonb_build_object('error', 'Missing appointment');
  END IF;
  IF p_new_date IS NULL OR trim(p_new_date) = '' THEN
    RETURN jsonb_build_object('error', 'Pick a date');
  END IF;
  IF p_new_time IS NULL OR trim(p_new_time) = '' THEN
    RETURN jsonb_build_object('error', 'Pick a time');
  END IF;

  SELECT * INTO v_customer
  FROM customers
  WHERE customer_access_token = p_token
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Not found');
  END IF;

  SELECT * INTO v_appt
  FROM appointments
  WHERE id = p_appointment_id
    AND customer_id = v_customer.id
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Appointment not found');
  END IF;

  IF v_appt.status IN ('completed', 'canceled', 'no_show', 'in_progress') THEN
    RETURN jsonb_build_object(
      'error',
      'This appointment can no longer be changed. Contact us directly.'
    );
  END IF;

  v_old_start := v_appt.start_at;
  v_new_start := timezone(
    'America/Los_Angeles',
    p_new_date::date + p_new_time::time
  );
  v_duration_min := GREATEST(
    30,
    COALESCE(EXTRACT(EPOCH FROM (v_appt.end_at - v_appt.start_at))::int / 60, 120)
  );
  v_new_end := v_new_start + (v_duration_min || ' minutes')::interval;

  -- Conflict guard — exclude the appointment being rescheduled.
  IF EXISTS (
    SELECT 1
    FROM appointments x
    WHERE x.user_id = v_appt.user_id
      AND x.id      <> v_appt.id
      AND x.status NOT IN ('canceled', 'completed', 'no_show')
      AND x.start_at < v_new_end
      AND x.end_at   > v_new_start
  ) THEN
    RETURN jsonb_build_object(
      'error',
      'That time just got taken — please pick another slot.'
    );
  END IF;

  UPDATE appointments
  SET start_at = v_new_start,
      end_at   = v_new_end,
      status   = 'pending_approval'
  WHERE id = v_appt.id;

  INSERT INTO notifications (
    id, user_id, type, title, message, metadata, read, created_at
  ) VALUES (
    gen_random_uuid()::text,
    v_customer.user_id,
    'appointment_rescheduled_by_customer',
    'Customer rescheduled appointment',
    v_customer.name || ' moved their appointment from ' ||
      to_char(v_old_start AT TIME ZONE 'America/Los_Angeles', 'Mon DD "at" HH12:MI AM') ||
      ' to ' ||
      to_char(v_new_start AT TIME ZONE 'America/Los_Angeles', 'Mon DD "at" HH12:MI AM'),
    jsonb_build_object(
      'appointmentId', v_appt.id,
      'customerId',    v_customer.id,
      'customerName',  v_customer.name
    ),
    false,
    now()
  );

  RETURN jsonb_build_object(
    'ok', true,
    'newStartAt', v_new_start
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reschedule_appointment_by_token(TEXT, TEXT, TEXT, TEXT)
  TO anon, authenticated;
