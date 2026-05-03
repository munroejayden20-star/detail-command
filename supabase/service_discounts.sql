-- Phase: Service Discounts
-- Adds a discount JSONB column to services and updates the booking RPC
-- to expose it. Based on the Phase 7 RPC — only change is adding
-- 'discount' to the services jsonb_build_object.
--
-- Run this once in the Supabase SQL editor.

-- 1. Add discount column (safe to re-run)
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS discount jsonb;

-- 2. Update get_public_booking_info to include discount per service
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

  -- Services (includes discount field)
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
    'services',    COALESCE(v_services, '[]'::jsonb),
    'bookedSlots', v_booked,
    'deposit', jsonb_build_object(
      'enabled',                 COALESCE(v_settings.booking_deposits_enabled, false),
      'required',                COALESCE(v_settings.booking_deposit_required, false),
      'amountCents',             COALESCE(v_settings.booking_deposit_amount_cents, 3000),
      'allowWithoutDeposit',     COALESCE(v_settings.booking_allow_without_deposit, false),
      'appliesToTotal',          COALESCE(v_settings.booking_deposit_applies_to_total, true),
      'refundPolicy',            v_settings.booking_deposit_refund_policy,
      'disclaimer',              v_settings.booking_deposit_disclaimer,
      'autoConfirmAfterDeposit', COALESCE(v_settings.booking_auto_confirm_after_deposit, false)
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
