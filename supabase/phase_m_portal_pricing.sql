-- ==========================================================================
-- Detail Command — Phase M: Portal per-service price breakdown
-- ==========================================================================
-- Run in your Supabase SQL editor. Idempotent — safe to re-run.
--
-- Replaces get_customer_portal_by_token so each appointment includes a
-- serviceItems array with each service's name, price range, addon flag,
-- and active discount JSON. Lets the portal show "$150 (was $200, 25% OFF)"
-- the same way the booking form does.
--
-- serviceNames kept for backwards compatibility — same data, just names.
-- ==========================================================================

CREATE OR REPLACE FUNCTION public.get_customer_portal_by_token(p_token TEXT)
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

  -- Upcoming
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
        SELECT COALESCE(jsonb_agg(s.name ORDER BY s.is_addon, s.name), '[]'::jsonb)
        FROM services s
        WHERE s.user_id = a.user_id
          AND s.id IN (
            SELECT jsonb_array_elements_text(
              COALESCE(a.service_ids, '[]'::jsonb) ||
              COALESCE(a.addon_ids,   '[]'::jsonb)
            )
          )
      ),
      'serviceItems',    (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'name',     s.name,
            'priceLow', s.price_low,
            'priceHigh', s.price_high,
            'isAddon',  s.is_addon,
            'discount', s.discount
          ) ORDER BY s.is_addon, s.name
        ), '[]'::jsonb)
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
      AND a.start_at >= NOW() - interval '2 hours'
    ORDER BY a.start_at ASC
    LIMIT 10
  ) t;

  -- Past
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
        SELECT COALESCE(jsonb_agg(s.name ORDER BY s.is_addon, s.name), '[]'::jsonb)
        FROM services s
        WHERE s.user_id = a.user_id
          AND s.id IN (
            SELECT jsonb_array_elements_text(
              COALESCE(a.service_ids, '[]'::jsonb) ||
              COALESCE(a.addon_ids,   '[]'::jsonb)
            )
          )
      ),
      'serviceItems',    (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object(
            'name',     s.name,
            'priceLow', s.price_low,
            'priceHigh', s.price_high,
            'isAddon',  s.is_addon,
            'discount', s.discount
          ) ORDER BY s.is_addon, s.name
        ), '[]'::jsonb)
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

GRANT EXECUTE ON FUNCTION public.get_customer_portal_by_token(TEXT) TO anon, authenticated;
