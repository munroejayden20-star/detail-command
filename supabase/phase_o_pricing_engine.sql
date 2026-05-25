-- ==========================================================================
-- Detail Command — Phase O: Pricing engine (admin-customizable)
-- ==========================================================================
-- Run this in your Supabase project SQL editor.
-- Idempotent — safe to re-run; existing rows are preserved with NULL config
-- (the client merges with defaults so behavior is unchanged until the owner
-- saves customizations).
--
-- What this adds:
--   1. settings.pricing_config (JSONB, nullable) — full PricingConfig blob
--      written by the admin UI. When NULL or partial, the booking page
--      deep-merges it with DEFAULT_PRICING_CONFIG on the client.
--   2. Updates get_public_booking_info to return the field as `pricingConfig`
--      so the customer-facing engine reads the owner's tuned modifiers.
--
-- Note: pricing math runs on the client. The RPC just relays the config —
-- it never executes any calculations on the server.
-- ==========================================================================

-- ---------- 1. New column on settings ----------

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS pricing_config JSONB DEFAULT NULL;

-- ---------- 2. Update get_public_booking_info ----------
-- Adds `pricingConfig` to the returned settings blob.
-- Based on the latest version (service_discounts.sql) — only change is the
-- added top-level pricingConfig field.

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
    AND status IN ('scheduled', 'confirmed', 'in_progress')
    AND start_at >= NOW() - INTERVAL '1 hour'
    AND start_at <= NOW() + INTERVAL '90 days';

  RETURN jsonb_build_object(
    'services',      COALESCE(v_services, '[]'::jsonb),
    'bookedSlots',   v_booked,
    'pricingConfig', v_settings.pricing_config,
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

-- ==========================================================================
-- Done. Existing customers see no change — pricing_config is NULL by default
-- and the client falls back to its baked-in defaults. Editing the config
-- from the admin UI persists a JSONB blob that the customer-facing engine
-- merges with defaults on the next page load.
-- ==========================================================================
