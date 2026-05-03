-- ==========================================================================
-- Detail Command — Phase 6B: Admin-customizable booking landing page
-- ==========================================================================
-- Run this in your Supabase project SQL editor (https://app.supabase.com).
-- Idempotent — safe to re-run; existing data is preserved.
--
-- What this adds:
--   1. New `settings` columns for booking landing page customization
--      (hero copy, water/power text, featured photos, contact info, FAQs)
--   2. Updated `get_public_booking_info` RPC that returns those fields and
--      resolves `booking_featured_photo_ids` into public URLs from the photos
--      table so the booking page can render them without extra round-trips.
-- ==========================================================================

-- ---------- 1. New settings columns ----------

-- Defensive: ensure profile/branding columns exist before the RPC references
-- them. Some installs have run partial historical migrations and may be
-- missing these. ADD COLUMN IF NOT EXISTS is a no-op when the column already
-- exists, so this is safe to re-run.
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS service_area TEXT,
  ADD COLUMN IF NOT EXISTS default_quote_disclaimer TEXT;

-- Phase 6B columns
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS booking_hero_headline TEXT,
  ADD COLUMN IF NOT EXISTS booking_hero_subheadline TEXT,
  ADD COLUMN IF NOT EXISTS booking_hero_image_url TEXT,
  ADD COLUMN IF NOT EXISTS booking_water_power_text TEXT,
  ADD COLUMN IF NOT EXISTS booking_featured_photo_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS booking_phone TEXT,
  ADD COLUMN IF NOT EXISTS booking_email TEXT,
  ADD COLUMN IF NOT EXISTS booking_faqs JSONB;

-- ---------- 2. Updated get_public_booking_info ----------
--
-- Resolves featured photo IDs into a public-URL list. For photos uploaded
-- through /book the storage_path is already a full https:// URL (booking-uploads
-- bucket is public). For dashboard photos in the private 'photos' bucket the
-- storage_path is a path like '<user_id>/<photo_id>.<ext>' — those are exposed
-- here as public URLs via storage.public_url, which means picking a private
-- photo as a featured booking photo MAKES THAT FILE PUBLICLY ACCESSIBLE for
-- anyone with the URL. Owner is responsible for choosing photos they're OK
-- showing on the marketing page.

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

  -- Featured photos — preserve order from the settings array.
  -- Only photos already stored as a full https:// URL (i.e. uploaded via /book
  -- into the public booking-uploads bucket) are returned here. Photos in the
  -- private `photos` bucket are intentionally skipped because anon callers
  -- cannot read them; the Settings UI flags them so the owner knows.
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

  -- Booked time slots — start/end of every non-canceled future appointment in
  -- the next 90 days, formatted as LA-local wall-clock strings so the booking
  -- page can compare against the slots the customer is picking. NO customer
  -- info or appointment IDs are exposed — anon callers only learn that "this
  -- time has an appointment", which is the same info they'd see attempting to
  -- book it anyway.
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

-- ---------- 3. Business name rename: Detail Command → JMDetailing ----------
-- Idempotent — only updates rows whose business_name is the old default.
UPDATE settings
SET business_name = 'JMDetailing'
WHERE business_name = 'Detail Command';

-- ==========================================================================
-- Note about photo URLs
-- ==========================================================================
-- Only photos with a public URL (storage_path LIKE 'http%') are returned to
-- the booking page. These come from the public `booking-uploads` bucket —
-- typically photos a customer uploaded during a previous booking, but the
-- owner can also upload directly to that bucket if desired. Private-bucket
-- photos are skipped at the SQL level so anon callers don't get broken
-- image URLs. The Settings picker still allows selecting them but flags
-- them as won't-render for transparency.
-- ==========================================================================
