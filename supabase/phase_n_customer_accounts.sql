-- ============================================================================
-- Phase N — Customer Accounts (Supabase Auth → customer-portal bridge)
--
-- Adds `get_customer_portal_by_session()` so a signed-in customer can fetch
-- their portal data without needing the legacy `dc_customer_token` in
-- localStorage. Uses the authenticated user's email (from JWT) to find the
-- customer record by email match, then delegates to the existing by-token
-- function so the data shape + business logic stay identical.
--
-- Side-channel: the response includes the customer_access_token so the
-- browser can persist it on a fresh device — that keeps cancel / reschedule
-- RPCs (still token-based) working without further migrations.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_customer_portal_by_session()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email   text;
  v_token   text;
  v_portal  jsonb;
BEGIN
  -- Pull the authenticated user's email from the JWT. SECURITY DEFINER means
  -- the function runs as the table owner, so we cannot rely on RLS — the
  -- email check IS our authorization.
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  IF v_email = '' THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT customer_access_token INTO v_token
  FROM customers
  WHERE lower(email) = v_email
    AND customer_access_token IS NOT NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_token IS NULL THEN
    RETURN jsonb_build_object('error', 'No customer record found for this account');
  END IF;

  -- Delegate to the existing by-token RPC so portal data shape stays in sync
  -- with the rest of the app. Re-emit the token so the browser can persist
  -- it (needed for cancel / reschedule RPCs which are still token-gated).
  v_portal := get_customer_portal_by_token(v_token);

  RETURN v_portal || jsonb_build_object('customerAccessToken', v_token);
END;
$$;

REVOKE EXECUTE ON FUNCTION get_customer_portal_by_session() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_customer_portal_by_session() TO authenticated;
