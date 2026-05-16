-- ==========================================================================
-- Detail Command — Phase L: Customer self-serve cancel / reschedule
-- ==========================================================================
-- Run in your Supabase SQL editor. Idempotent — safe to re-run.
--
-- Both RPCs are token-gated (the customer's customer_access_token from
-- Phase K) and anon-callable. They only ever touch the one appointment
-- belonging to that one customer.
--
-- Cancel: flips status to 'canceled' and notifies the owner.
-- Reschedule: rewrites start/end + flips status back to 'pending_approval'
--             so the owner re-approves on the new time.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.cancel_appointment_by_token(
  p_token          TEXT,
  p_appointment_id TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer customers%ROWTYPE;
  v_appt     appointments%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 16 THEN
    RETURN jsonb_build_object('error', 'Invalid link');
  END IF;
  IF p_appointment_id IS NULL OR length(trim(p_appointment_id)) = 0 THEN
    RETURN jsonb_build_object('error', 'Missing appointment');
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
      'This appointment can no longer be canceled. Contact us directly.'
    );
  END IF;

  UPDATE appointments
  SET status = 'canceled'
  WHERE id = v_appt.id;

  INSERT INTO notifications (
    id, user_id, type, title, message, metadata, read, created_at
  ) VALUES (
    gen_random_uuid()::text,
    v_customer.user_id,
    'appointment_canceled_by_customer',
    'Customer canceled appointment',
    v_customer.name || ' canceled their ' ||
      to_char(v_appt.start_at AT TIME ZONE 'America/Los_Angeles', 'Mon DD "at" HH12:MI AM') ||
      ' appointment',
    jsonb_build_object(
      'appointmentId', v_appt.id,
      'customerId',    v_customer.id,
      'customerName',  v_customer.name
    ),
    false,
    now()
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_appointment_by_token(TEXT, TEXT)
  TO anon, authenticated;


CREATE OR REPLACE FUNCTION public.reschedule_appointment_by_token(
  p_token          TEXT,
  p_appointment_id TEXT,
  p_new_date       TEXT,   -- 'YYYY-MM-DD' in America/Los_Angeles
  p_new_time       TEXT    -- 'HH:MM'      in America/Los_Angeles
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

  -- Preserve the original duration so the owner doesn't lose service-derived
  -- length info when the customer reschedules.
  v_duration_min := GREATEST(
    30,
    COALESCE(EXTRACT(EPOCH FROM (v_appt.end_at - v_appt.start_at))::int / 60, 120)
  );
  v_new_end := v_new_start + (v_duration_min || ' minutes')::interval;

  -- Always send back to pending_approval so the owner re-confirms the new slot.
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
