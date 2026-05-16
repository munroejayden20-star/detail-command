-- ==========================================================================
-- Detail Command — Phase J: Customer tips
-- ==========================================================================
-- Run in your Supabase SQL editor. Idempotent — safe to re-run.
--
-- Adds tip_cents to receipts so the owner can record customer tips, and
-- updates get_public_receipt_by_token() to expose it on the public link.
-- ==========================================================================

ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS tip_cents INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.get_public_receipt_by_token(p_token TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receipt receipts%ROWTYPE;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 16 THEN
    RETURN jsonb_build_object('error', 'Invalid receipt link');
  END IF;

  SELECT * INTO v_receipt
  FROM receipts
  WHERE public_receipt_token = p_token
    AND receipt_status = 'active'
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Receipt not found');
  END IF;

  RETURN jsonb_build_object(
    'receiptNumber',         v_receipt.receipt_number,
    'paymentStatus',         v_receipt.payment_status,
    'paymentMethod',         v_receipt.payment_method,
    'subtotalCents',         v_receipt.subtotal_cents,
    'discountCents',         v_receipt.discount_cents,
    'taxCents',              v_receipt.tax_cents,
    'tipCents',              v_receipt.tip_cents,
    'depositPaidCents',      v_receipt.deposit_paid_cents,
    'totalCents',            v_receipt.total_cents,
    'amountPaidCents',       v_receipt.amount_paid_cents,
    'remainingBalanceCents', v_receipt.remaining_balance_cents,
    'currency',              v_receipt.currency,
    'lineItems',             v_receipt.line_items,
    'customerSnapshot',      v_receipt.customer_snapshot,
    'vehicleSnapshot',       v_receipt.vehicle_snapshot,
    'businessSnapshot',      v_receipt.business_snapshot,
    'appointmentSnapshot',   v_receipt.appointment_snapshot,
    'notes',                 v_receipt.notes,
    'createdAt',             v_receipt.created_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_receipt_by_token(TEXT) TO anon, authenticated;
