/**
 * stripe-checkout — server-side endpoint for the public booking page.
 *
 * Flow:
 *   1. Validate the booking payload from the public booking form.
 *   2. Read the owner's deposit settings from DB (server-authoritative —
 *      the client cannot pick a deposit amount).
 *   3. Call submit_public_booking RPC to create customer + appointment +
 *      photo records, exactly like the existing free-booking flow.
 *   4. Insert a `payments` row with status='pending'.
 *   5. Create a Stripe Checkout Session referencing the payment.
 *   6. Update the payment with the Checkout Session ID.
 *   7. Append an audit log entry.
 *   8. Return { checkoutUrl, paymentId } so the client can redirect.
 *
 * If anything fails between #3 and #5, the booking still exists with
 * payment_status='awaiting_deposit' so the owner can manually follow up
 * via "Send Deposit Link Again" rather than have an orphan in Stripe.
 *
 * Required Supabase function secrets:
 *   STRIPE_SECRET_KEY     - sk_test_... or sk_live_...
 *   APP_URL               - https://jmdetailing.vercel.app (no trailing slash)
 *   SUPABASE_URL          - auto-set by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY - auto-set by Supabase
 */
import Stripe from "npm:stripe@17.4.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, corsPreflight } from "../_shared/cors.ts";

interface BookingPayload {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerAddress?: string;
  preferredContact?: string;
  vehicleYear?: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  vehicleSize?: string;
  interiorCondition?: string;
  exteriorCondition?: string;
  petHair?: boolean;
  stains?: boolean;
  heavyDirt?: boolean;
  vehicleNotes?: string;
  serviceIds: string[];
  addonIds: string[];
  estimatedPrice: number;
  preferredDate?: string;
  preferredTime?: string;
  waterAccess?: boolean;
  powerAccess?: boolean;
  bookingPhotoUrls: string[];
  honeypot?: string;
}

const STRIPE_API_VERSION = "2024-12-18.acacia" as const;

function makeId(): string {
  return crypto.randomUUID();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Env validation ────────────────────────────────────────────────────────
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const appUrl = Deno.env.get("APP_URL");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!stripeKey || !appUrl || !supabaseUrl || !serviceKey) {
    console.error("[stripe-checkout] missing env vars");
    return new Response(
      JSON.stringify({ error: "Payment system not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // ── Parse + validate input ────────────────────────────────────────────────
  let payload: BookingPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Honeypot — bots get a 200 with a fake URL so they don't probe further.
  if (payload.honeypot && payload.honeypot.trim().length > 0) {
    return new Response(JSON.stringify({ checkoutUrl: appUrl, paymentId: makeId() }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!payload.customerName?.trim() || !payload.customerPhone?.trim()) {
    return new Response(JSON.stringify({ error: "Name and phone are required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Server-authoritative settings lookup ──────────────────────────────────
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Resolve the single business owner.
  const { data: ownerRow, error: ownerErr } = await supabase
    .from("settings")
    .select("user_id, business_name, booking_deposits_enabled, booking_deposit_amount_cents, booking_deposit_required, booking_auto_confirm_after_deposit, booking_allow_without_deposit, booking_page_enabled")
    .order("user_id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (ownerErr || !ownerRow) {
    console.error("[stripe-checkout] no settings row", ownerErr);
    return new Response(JSON.stringify({ error: "Service unavailable" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!ownerRow.booking_page_enabled) {
    return new Response(JSON.stringify({ error: "Booking is disabled" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!ownerRow.booking_deposits_enabled) {
    return new Response(
      JSON.stringify({ error: "Deposits are not enabled. Submit without deposit instead." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const ownerId: string = ownerRow.user_id;
  const businessName: string = ownerRow.business_name || "Detail";
  const depositAmountCents: number = Number(ownerRow.booking_deposit_amount_cents) || 3000;

  // ── Create the booking via the existing public RPC ────────────────────────
  // We call submit_public_booking using anon-equivalent params; this reuses
  // the timezone-correct insert + photo metadata insert + dashboard
  // notification flow already battle-tested in production.

  const { data: rpcData, error: rpcError } = await supabase.rpc("submit_public_booking", {
    p_customer_name: payload.customerName.trim(),
    p_customer_phone: payload.customerPhone.trim(),
    p_customer_email: payload.customerEmail?.trim() || null,
    p_customer_address: payload.customerAddress?.trim() || null,
    p_preferred_contact: payload.preferredContact || "text",
    p_vehicle_year: payload.vehicleYear || "",
    p_vehicle_make: payload.vehicleMake || "",
    p_vehicle_model: payload.vehicleModel || "",
    p_vehicle_color: payload.vehicleColor || "",
    p_vehicle_size: payload.vehicleSize || "",
    p_interior_condition: payload.interiorCondition || null,
    p_exterior_condition: payload.exteriorCondition || null,
    p_pet_hair: !!payload.petHair,
    p_stains: !!payload.stains,
    p_heavy_dirt: !!payload.heavyDirt,
    p_vehicle_notes: payload.vehicleNotes || null,
    p_service_ids: payload.serviceIds || [],
    p_addon_ids: payload.addonIds || [],
    p_estimated_price: Number(payload.estimatedPrice) || 0,
    p_preferred_date: payload.preferredDate || null,
    p_preferred_time: payload.preferredTime || null,
    p_water_access: payload.waterAccess !== false,
    p_power_access: payload.powerAccess !== false,
    p_booking_photo_urls: payload.bookingPhotoUrls || [],
    p_honeypot: null,
  });

  if (rpcError || !rpcData?.appointmentId) {
    console.error("[stripe-checkout] submit_public_booking failed", rpcError, rpcData);
    return new Response(
      JSON.stringify({ error: rpcData?.error || "Could not create booking" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const appointmentId: string = rpcData.appointmentId;
  const customerId: string = rpcData.customerId;

  // Mark the appointment as deposit-required + awaiting deposit.
  await supabase
    .from("appointments")
    .update({
      deposit_required: true,
      deposit_amount_cents: depositAmountCents,
      payment_status: "awaiting_deposit",
    })
    .eq("id", appointmentId);

  // ── Insert payment row (pending) ──────────────────────────────────────────
  const paymentId = makeId();
  const { error: payErr } = await supabase.from("payments").insert({
    id: paymentId,
    user_id: ownerId,
    appointment_id: appointmentId,
    customer_id: customerId,
    amount_cents: depositAmountCents,
    currency: "usd",
    payment_type: "deposit",
    status: "pending",
    metadata: { source: "public-booking-page" },
  });
  if (payErr) {
    console.error("[stripe-checkout] payment insert failed", payErr);
    return new Response(JSON.stringify({ error: "Could not initialize payment" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Create Stripe Checkout Session ────────────────────────────────────────
  const stripe = new Stripe(stripeKey, {
    apiVersion: STRIPE_API_VERSION,
    httpClient: Stripe.createFetchHttpClient(),
  });

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: depositAmountCents,
            product_data: {
              name: `${businessName} — Booking Deposit`,
              description: "Reserves your appointment request. Applies toward the final detail price.",
            },
          },
        },
      ],
      customer_email: payload.customerEmail?.trim() || undefined,
      success_url: `${appUrl}/booking/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/booking/cancel?appointment_id=${appointmentId}`,
      metadata: {
        user_id: ownerId,
        appointment_id: appointmentId,
        customer_id: customerId,
        payment_id: paymentId,
        payment_type: "deposit",
      },
      payment_intent_data: {
        metadata: {
          user_id: ownerId,
          appointment_id: appointmentId,
          payment_id: paymentId,
        },
        description: `Deposit for booking on ${payload.preferredDate ?? "TBD"} at ${payload.preferredTime ?? "TBD"}`,
      },
    });
  } catch (e) {
    console.error("[stripe-checkout] Stripe session create failed", e);
    return new Response(JSON.stringify({ error: "Could not start payment" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Persist the session ID on payment + appointment ───────────────────────
  await supabase
    .from("payments")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", paymentId);

  await supabase
    .from("appointments")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", appointmentId);

  // ── Audit ─────────────────────────────────────────────────────────────────
  await supabase.from("audit_logs").insert({
    id: makeId(),
    user_id: ownerId,
    entity_type: "payment",
    entity_id: paymentId,
    action: "deposit.checkout.created",
    metadata: {
      appointmentId,
      sessionId: session.id,
      amountCents: depositAmountCents,
    },
  });

  return new Response(
    JSON.stringify({
      checkoutUrl: session.url,
      paymentId,
      sessionId: session.id,
      appointmentId,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
