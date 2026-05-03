-- Phase: Service Discounts
-- Adds a discount JSONB column to the services table and updates the
-- get_public_booking_info RPC to expose it on the booking page.
--
-- Run this once in the Supabase SQL editor.

-- 1. Add discount column (safe to re-run)
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS discount jsonb;

-- 2. Update the public booking RPC to include discount in each service row
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
  v_booked_slots jsonb;
  v_deposit jsonb;
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

  -- Services (includes discount)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',              id,
      'name',            name,
      'description',     description,
      'priceLow',        price_low,
      'priceHigh',       price_high,
      'durationMinutes', duration_minutes,
      'isAddon',         is_addon,
      'discount',        discount
    ) ORDER BY is_addon, name
  )
  INTO v_services
  FROM services
  WHERE user_id = v_owner_id;

  -- Booked slots (non-canceled future appointments, LA local time)
  SELECT jsonb_agg(
    jsonb_build_object(
      'start', to_char(start_time AT TIME ZONE 'America/Los_Angeles', 'YYYY-MM-DD"T"HH24:MI'),
      'end',   to_char(end_time   AT TIME ZONE 'America/Los_Angeles', 'YYYY-MM-DD"T"HH24:MI')
    )
  )
  INTO v_booked_slots
  FROM appointments
  WHERE user_id = v_owner_id
    AND status NOT IN ('canceled')
    AND start_time >= NOW();

  -- Deposit config
  IF COALESCE(v_settings.booking_deposits_enabled, false) THEN
    v_deposit := jsonb_build_object(
      'enabled',                  true,
      'required',                 COALESCE(v_settings.booking_deposit_required, false),
      'amountCents',              COALESCE(v_settings.booking_deposit_amount_cents, 0),
      'allowWithoutDeposit',      COALESCE(v_settings.booking_allow_without_deposit, true),
      'appliesToTotal',           COALESCE(v_settings.booking_deposit_applies_to_total, true),
      'refundPolicy',             v_settings.booking_deposit_refund_policy,
      'disclaimer',               v_settings.booking_deposit_disclaimer,
      'autoConfirmAfterDeposit',  COALESCE(v_settings.booking_auto_confirm_after_deposit, false)
    );
  END IF;

  RETURN jsonb_build_object(
    'services',     COALESCE(v_services, '[]'::jsonb),
    'bookedSlots',  COALESCE(v_booked_slots, '[]'::jsonb),
    'deposit',      v_deposit,
    'settings',     jsonb_build_object(
      'businessName',           v_settings.business_name,
      'serviceArea',            v_settings.service_area,
      'bookingPageEnabled',     v_settings.booking_page_enabled,
      'defaultQuoteDisclaimer', v_settings.default_quote_disclaimer,
      'heroHeadline',           v_settings.booking_hero_headline,
      'heroSubheadline',        v_settings.booking_hero_subheadline,
      'heroImageUrl',           v_settings.booking_hero_image_url,
      'waterPowerText',         v_settings.booking_water_power_text,
      'bookingPhone',           v_settings.booking_phone,
      'bookingEmail',           v_settings.booking_email,
      'faqs',                   v_settings.booking_faqs,
      'featuredPhotos',         '[]'::jsonb,
      'logoUrl',                v_settings.logo_url
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_public_booking_info() TO anon;
