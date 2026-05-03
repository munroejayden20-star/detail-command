import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, Loader2, Mail, Phone, Calendar, AlertCircle } from "lucide-react";
import { getPaymentStatusBySession, type PublicPaymentStatus } from "@/lib/booking-api";

/**
 * /booking/success — customer arrives here after Stripe Checkout completes.
 * Stripe redirects here with `?session_id=cs_...`. The webhook may not have
 * fired yet, so we poll get_public_payment_status until status is paid (or
 * a terminal failure state). Status is *only* trusted from this server-side
 * lookup — the redirect itself does NOT mark the deposit paid.
 */
export function BookingSuccessPage() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [status, setStatus] = useState<PublicPaymentStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollCount, setPollCount] = useState(0);

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

  const businessName = status?.businessName ?? "the team";
  const isPaid = status?.status === "paid";
  const isStillPending = status?.status === "pending";
  const isTerminalFail =
    status?.status === "failed" ||
    status?.status === "canceled" ||
    status?.status === "expired";

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md text-center">
        {/* Header icon */}
        <div className="mx-auto mb-6">
          {isPaid ? (
            <div className="h-16 w-16 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
            </div>
          ) : isTerminalFail ? (
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
        ) : isPaid ? (
          <>
            <h1 className="text-2xl font-bold mb-2">Deposit received!</h1>
            <p className="text-sm text-zinc-300 leading-relaxed">
              Thanks — your booking request is in. {businessName} will review the details and reach out shortly to confirm.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-2 text-left">
              <Stat
                icon={<CheckCircle2 className="h-4 w-4 text-emerald-400" />}
                label="Deposit"
                value={`$${(status!.amountCents / 100).toFixed(2)} ${status!.currency.toUpperCase()} paid`}
              />
              {status?.preferredDate ? (
                <Stat
                  icon={<Calendar className="h-4 w-4 text-zinc-400" />}
                  label="Requested time"
                  value={formatDateLabel(status.preferredDate)}
                />
              ) : null}
              <Stat
                icon={<Mail className="h-4 w-4 text-zinc-400" />}
                label="Receipt"
                value="Stripe will email your receipt"
              />
            </div>
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

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3">
      <div className="shrink-0">{icon}</div>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">{label}</p>
        <p className="text-sm text-white">{value}</p>
      </div>
    </div>
  );
}

function formatDateLabel(dateStr: string): string {
  // dateStr is "YYYY-MM-DDTHH:mm" in LA local time from the RPC.
  const [datePart, timePart] = dateStr.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dateLabel = date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  if (!timePart) return dateLabel;
  const [hh, mm] = timePart.split(":").map(Number);
  const hour12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  const ampm = hh < 12 ? "AM" : "PM";
  return `${dateLabel} · ${hour12}:${String(mm).padStart(2, "0")} ${ampm}`;
}
