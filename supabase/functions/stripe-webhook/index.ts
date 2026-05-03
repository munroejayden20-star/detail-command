/**
 * stripe-webhook — receives signed Stripe events, idempotently updates DB.
 *
 * Security:
 *   - Reads raw request body before parsing.
 *   - Verifies signature with STRIPE_WEBHOOK_SECRET. Invalid → 400.
 *   - Service role only writes (bypasses RLS).
 *   - Deduplicates via `stripe_events.stripe_event_id` unique index.
 *
 * Events handled:
 *   - checkout.session.completed     → mark deposit paid, update appointment
 *   - checkout.session.expired       → mark payment expired
 *   - payment_intent.payment_failed  → mark payment failed
 *   - charge.refunded                → mark payment refunded
 *
 * Required Supabase function secrets:
 *   STRIPE_SECRET_KEY
 *   STRIPE_WEBHOOK_SECRET
 *   SUPABASE_URL              (auto)
 *   SUPABASE_SERVICE_ROLE_KEY (auto)
 *
 * IMPORTANT: deploy with --no-verify-jwt because Stripe is unauthenticated:
 *   supabase functions deploy stripe-webhook --no-verify-jwt
 */
import Stripe from "https://esm.sh/stripe@17.4.0?target=deno&deno-std=0.224.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const STRIPE_API_VERSION = "2024-12-18.acacia" as const;

function makeId(): string {
  return crypto.randomUUID();
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!stripeKey || !webhookSecret || !supabaseUrl || !serviceKey) {
    console.error("[stripe-webhook] missing env vars");
    return new Response("Webhook misconfigured", { status: 500 });
  }

  const stripe = new Stripe(stripeKey, {
    apiVersion: STRIPE_API_VERSION,
    httpClient: Stripe.createFetchHttpClient(),
  });

  // ── Verify signature (raw body required) ──────────────────────────────────
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new Response("Missing signature", { status: 400 });
  }
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig, webhookSecret);
  } catch (e) {
    console.error("[stripe-webhook] bad signature", e instanceof Error ? e.message : e);
    return new Response("Bad signature", { status: 400 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Idempotency: skip if we've already processed this event ──────────────
  const { data: dupe } = await supabase
    .from("stripe_events")
    .select("id")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (dupe) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Record the event UP FRONT so two parallel deliveries can't both process.
  // The unique index on stripe_event_id will reject the second insert.
  const { error: insertEventErr } = await supabase.from("stripe_events").insert({
    id: makeId(),
    stripe_event_id: event.id,
    type: event.type,
    payload: event.data.object as unknown as Record<string, unknown>,
  });

  if (insertEventErr) {
    // Likely a race — another worker just claimed it. Treat as duplicate.
    console.warn("[stripe-webhook] event insert failed (likely duplicate)", insertEventErr);
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(supabase, event.data.object as Stripe.Checkout.Session);
        break;
      case "checkout.session.expired":
        await handleCheckoutExpired(supabase, event.data.object as Stripe.Checkout.Session);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentFailed(supabase, event.data.object as Stripe.PaymentIntent);
        break;
      case "charge.refunded":
        await handleChargeRefunded(supabase, event.data.object as Stripe.Charge);
        break;
      default:
        // Unhandled event types are still recorded above so we can audit later.
        console.log("[stripe-webhook] unhandled type", event.type);
    }
  } catch (e) {
    console.error("[stripe-webhook] handler error", e);
    return new Response("Handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

/* ─────────────────────────────────────────────
   Handlers
───────────────────────────────────────────── */

async function handleCheckoutCompleted(
  supabase: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session,
) {
  const md = session.metadata ?? {};
  const userId = md.user_id;
  const appointmentId = md.appointment_id;
  const paymentId = md.payment_id;

  if (!userId || !appointmentId || !paymentId) {
    console.error("[stripe-webhook] missing metadata on completed session", session.id);
    return;
  }

  // Look up the payment row — protects against double-application.
  const { data: existing } = await supabase
    .from("payments")
    .select("id, status, user_id")
    .eq("id", paymentId)
    .maybeSingle();
  if (!existing) {
    console.error("[stripe-webhook] payment row missing", paymentId);
    return;
  }
  if (existing.status === "paid") {
    return; // Already processed.
  }

  const paymentIntentId = typeof session.payment_intent === "string"
    ? session.payment_intent
    : session.payment_intent?.id ?? null;
  const stripeCustomerId = typeof session.customer === "string"
    ? session.customer
    : session.customer?.id ?? null;

  // ── Update payment row ────────────────────────────────────────────────────
  await supabase
    .from("payments")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      stripe_payment_intent_id: paymentIntentId,
      stripe_customer_id: stripeCustomerId,
    })
    .eq("id", paymentId);

  // ── Read business settings to decide auto-confirm + lookup customer name ─
  const { data: settings } = await supabase
    .from("settings")
    .select("booking_auto_confirm_after_deposit")
    .eq("user_id", userId)
    .maybeSingle();

  const autoConfirm = !!settings?.booking_auto_confirm_after_deposit;

  // ── Update appointment ───────────────────────────────────────────────────
  await supabase
    .from("appointments")
    .update({
      deposit_paid: true,
      deposit_paid_at: new Date().toISOString(),
      deposit_payment_id: paymentId,
      payment_status: "deposit_paid",
      // Auto-confirm if owner enabled it; otherwise stay pending_approval.
      ...(autoConfirm ? { status: "confirmed" } : {}),
    })
    .eq("id", appointmentId);

  // ── Notification ─────────────────────────────────────────────────────────
  const { data: appt } = await supabase
    .from("appointments")
    .select("customer_id")
    .eq("id", appointmentId)
    .maybeSingle();

  let customerName = "a customer";
  if (appt?.customer_id) {
    const { data: c } = await supabase
      .from("customers")
      .select("name")
      .eq("id", appt.customer_id)
      .maybeSingle();
    if (c?.name) customerName = c.name;
  }

  const amountDollars = ((session.amount_total ?? 0) / 100).toFixed(2);
  await supabase.from("notifications").insert({
    id: makeId(),
    user_id: userId,
    type: "deposit_received",
    title: "Deposit received",
    message: `${customerName} paid a $${amountDollars} deposit`,
    metadata: {
      appointmentId,
      paymentId,
      sessionId: session.id,
      autoConfirm,
    },
    read: false,
  });

  // ── Audit log ────────────────────────────────────────────────────────────
  await supabase.from("audit_logs").insert({
    id: makeId(),
    user_id: userId,
    entity_type: "payment",
    entity_id: paymentId,
    action: "deposit.paid",
    metadata: {
      appointmentId,
      stripeSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      amountCents: session.amount_total,
      autoConfirm,
    },
  });
}

async function handleCheckoutExpired(
  supabase: ReturnType<typeof createClient>,
  session: Stripe.Checkout.Session,
) {
  const paymentId = session.metadata?.payment_id;
  if (!paymentId) return;
  const { data: existing } = await supabase
    .from("payments")
    .select("id, user_id, appointment_id, status")
    .eq("id", paymentId)
    .maybeSingle();
  if (!existing || existing.status === "paid") return;

  await supabase
    .from("payments")
    .update({ status: "expired" })
    .eq("id", paymentId);

  if (existing.appointment_id) {
    await supabase
      .from("appointments")
      .update({ payment_status: "deposit_expired" })
      .eq("id", existing.appointment_id);
  }

  await supabase.from("audit_logs").insert({
    id: makeId(),
    user_id: existing.user_id,
    entity_type: "payment",
    entity_id: paymentId,
    action: "deposit.expired",
    metadata: { sessionId: session.id, appointmentId: existing.appointment_id },
  });
}

async function handlePaymentFailed(
  supabase: ReturnType<typeof createClient>,
  pi: Stripe.PaymentIntent,
) {
  const paymentId = pi.metadata?.payment_id;
  if (!paymentId) return;
  const { data: existing } = await supabase
    .from("payments")
    .select("id, user_id, appointment_id, status")
    .eq("id", paymentId)
    .maybeSingle();
  if (!existing || existing.status === "paid") return;

  await supabase
    .from("payments")
    .update({
      status: "failed",
      failure_reason: pi.last_payment_error?.message ?? "Payment failed",
    })
    .eq("id", paymentId);

  if (existing.appointment_id) {
    await supabase
      .from("appointments")
      .update({ payment_status: "deposit_failed" })
      .eq("id", existing.appointment_id);
  }

  await supabase.from("notifications").insert({
    id: makeId(),
    user_id: existing.user_id,
    type: "deposit_failed",
    title: "Deposit payment failed",
    message: pi.last_payment_error?.message ?? "A booking deposit could not be charged.",
    metadata: { appointmentId: existing.appointment_id, paymentId, paymentIntentId: pi.id },
    read: false,
  });

  await supabase.from("audit_logs").insert({
    id: makeId(),
    user_id: existing.user_id,
    entity_type: "payment",
    entity_id: paymentId,
    action: "deposit.failed",
    metadata: {
      appointmentId: existing.appointment_id,
      paymentIntentId: pi.id,
      reason: pi.last_payment_error?.message,
    },
  });
}

async function handleChargeRefunded(
  supabase: ReturnType<typeof createClient>,
  charge: Stripe.Charge,
) {
  const paymentIntentId = typeof charge.payment_intent === "string"
    ? charge.payment_intent
    : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  const { data: existing } = await supabase
    .from("payments")
    .select("id, user_id, appointment_id, amount_cents, amount_refunded_cents")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (!existing) return;

  const totalRefunded = charge.amount_refunded ?? 0;
  const isFullRefund = totalRefunded >= (existing.amount_cents ?? 0);

  await supabase
    .from("payments")
    .update({
      status: isFullRefund ? "refunded" : "partially_refunded",
      amount_refunded_cents: totalRefunded,
      refunded_at: new Date().toISOString(),
    })
    .eq("id", existing.id);

  if (existing.appointment_id && isFullRefund) {
    await supabase
      .from("appointments")
      .update({ payment_status: "refunded", deposit_paid: false })
      .eq("id", existing.appointment_id);
  }

  await supabase.from("audit_logs").insert({
    id: makeId(),
    user_id: existing.user_id,
    entity_type: "payment",
    entity_id: existing.id,
    action: isFullRefund ? "deposit.refunded" : "deposit.partial_refund",
    metadata: {
      appointmentId: existing.appointment_id,
      stripeChargeId: charge.id,
      amountRefundedCents: totalRefunded,
    },
  });
}
