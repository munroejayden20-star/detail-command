import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import {
  getCustomerPortal,
  getPaymentStatusBySession,
  type PublicPaymentStatus,
} from "@/lib/booking-api";
import { saveCustomerToken } from "@/lib/customer-portal-storage";
import { BookingSuccessAccount } from "@/components/booking/BookingSuccessAccount";

/**
 * /booking/success — customer arrives here after Stripe Checkout completes.
 * Stripe redirects here with `?session_id=cs_...`. The webhook may not have
 * fired yet, so we poll get_public_payment_status until status is paid (or
 * a terminal failure state). Status is *only* trusted from this server-side
 * lookup — the redirect itself does NOT mark the deposit paid.
 */
export function BookingSuccessPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get("session_id");
  const [status, setStatus] = useState<PublicPaymentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);
  // Pulled from the customer portal once we have a token — used to prefill
  // the signup form on the post-deposit account-creation prompt.
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerFirstName, setCustomerFirstName] = useState("");

  useEffect(() => {
    if (!sessionId) {
      setError("Missing session reference. If you just paid, give it a moment.");
      return;
    }
    let cancelled = false;
    let attempts = 0;
    async function poll() {
      try {
        const s = await getPaymentStatusBySession(sessionId!);
        if (cancelled) return;
        if (s.customerToken) {
          saveCustomerToken(s.customerToken);
          // Fetch customer info so BookingSuccessAccount can pre-fill email.
          // Fire-and-forget — failure leaves the field empty (user enters it).
          getCustomerPortal(s.customerToken).then((portal) => {
            if (cancelled || !portal) return;
            setCustomerEmail(portal.customer.email ?? "");
            const first = (portal.customer.name ?? "").trim().split(/\s+/)[0] ?? "";
            setCustomerFirstName(first);
          });
        }
        setStatus(s);
        attempts++;
        setPollCount(attempts);
        // Keep polling while still pending; stop on any terminal state.
        if (s.status === "pending" && attempts < 20) {
          setTimeout(poll, 2000);
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Could not check payment status");
      }
    }
    poll();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const isPaid = status?.status === "paid";
  const isStillPending = status?.status === "pending";
  const isTerminalFail =
    status?.status === "failed" ||
    status?.status === "canceled" ||
    status?.status === "expired";

  /* Deposit confirmed → show the same cinematic account-creation choice
   *  that the no-deposit path gets. Without this, Stripe customers never
   *  got the chance to sign up. */
  if (isPaid) {
    return (
      <BookingSuccessAccount
        businessName={status?.businessName ?? "Our team"}
        prefilledEmail={customerEmail}
        firstName={customerFirstName}
        onSkip={() => navigate("/book")}
        onAccountCreated={() => navigate("/portal")}
      />
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        {/* Header icon */}
        <div className="mx-auto mb-6">
          {isTerminalFail ? (
            <div className="h-16 w-16 mx-auto rounded-full bg-rose-500/10 border border-rose-500/40 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-rose-400" />
            </div>
          ) : (
            <div className="h-16 w-16 mx-auto rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-red-400 animate-spin" />
            </div>
          )}
        </div>

        {error ? (
          <>
            <h1 className="text-2xl font-bold mb-2">Hmm, something's off</h1>
            <p className="text-sm text-zinc-400 leading-relaxed">{error}</p>
          </>
        ) : isTerminalFail ? (
          <>
            <h1 className="text-2xl font-bold mb-2">Payment didn't complete</h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Your booking was submitted, but the deposit wasn't charged. Try again to reserve your slot.
            </p>
            <Link
              to="/book"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
            >
              Try Payment Again
            </Link>
          </>
        ) : isStillPending ? (
          <>
            <h1 className="text-2xl font-bold mb-2">Payment is processing…</h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              We're waiting for Stripe to confirm your payment. This usually takes just a few seconds.
            </p>
            <p className="mt-4 text-[11px] text-zinc-600">
              Checked {pollCount} time{pollCount === 1 ? "" : "s"}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold mb-2">Loading…</h1>
            <p className="text-sm text-zinc-400">Hang tight.</p>
          </>
        )}

        <Link to="/book" className="mt-10 inline-block text-xs text-zinc-500 hover:text-zinc-300">
          ← Back to booking page
        </Link>
      </div>
    </div>
  );
}

// (Stat / formatDateLabel removed — the deposit-confirmed UI now lives in
// BookingSuccessAccount so the post-payment flow matches the no-deposit
// path's cinematic account-creation prompt.)
