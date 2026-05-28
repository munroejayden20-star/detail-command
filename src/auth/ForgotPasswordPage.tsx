/* ============================================================================
 * Forgot Password — /auth/forgot
 *
 * Cinematic recovery entry point. Mirrors the /portal sign-in aesthetic so
 * customers landing here from the booking flow feel continuity, while admins
 * coming from /login also get a premium surface. We never confirm whether
 * the email matches an account — the success message is identical either way
 * so attackers can't enumerate users.
 * ========================================================================== */

import { useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, KeyRound, Loader2, Mail } from "lucide-react";
import { useAuth } from "./AuthProvider";
import {
  CarbonWeave,
  EmberCTA,
  GrainOverlay,
  MouseSpotlight,
} from "@/components/booking/luxury/primitives";

export function ForgotPasswordPage() {
  const { sendPasswordReset, configured } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!configured) {
      setErr("Authentication is not available right now. Try again later.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const { error } = await sendPasswordReset(email.trim());
      // Never leak account existence — show success regardless. Real
      // transport failures (rate limits, malformed email) still surface.
      if (error && /rate|too many|invalid email/i.test(error)) {
        setErr(error);
      } else {
        setSent(true);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not send the recovery link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div className="grid min-h-[80vh] place-items-center px-5">
        <div className="relative w-full max-w-md">
          <div className="pointer-events-none absolute -inset-x-10 -top-10 -z-10 h-40 bg-[radial-gradient(60%_60%_at_50%_50%,rgba(221,41,20,0.16),transparent_70%)]" />

          <div className="text-center">
            <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-ember-400/35 bg-ember-500/10 text-ember-300">
              <KeyRound className="h-7 w-7" />
            </span>
            <h1 className="mt-6 font-sans text-3xl font-extralight tracking-tight text-platinum-50 sm:text-4xl">
              Recover your{" "}
              <span className="font-display italic text-ember-200">access.</span>
            </h1>
            <p className="mt-3 text-[13.5px] leading-relaxed text-platinum-300/80">
              {sent
                ? "If that email is on file, a secure reset link is on its way."
                : "Enter the email tied to your account. We'll send a one-time, expiring link to set a new password."}
            </p>
          </div>

          {sent ? (
            <SuccessPanel email={email.trim()} />
          ) : (
            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <label className="block">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/80">
                  Email
                </span>
                <div className="relative mt-2">
                  <Mail className="pointer-events-none absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-platinum-300/55" />
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    autoFocus
                    className="block w-full appearance-none rounded-none border-b border-white/20 bg-transparent py-2.5 pl-6 text-[15px] text-platinum-50 placeholder:text-platinum-300/40 outline-none transition-all focus:border-ember-400 focus:[box-shadow:inset_0_-1px_0_rgba(248,114,72,0.7)]"
                  />
                </div>
              </label>

              {err && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2">
                  <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" />
                  <p className="text-[12px] leading-relaxed text-rose-200">{err}</p>
                </div>
              )}

              <EmberCTA type="submit" disabled={busy || !email.trim()} size="md" className="w-full">
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    Send recovery link
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-0.5" />
                  </>
                )}
              </EmberCTA>

              <div className="flex items-center justify-between gap-3 pt-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.26em] text-platinum-300/70 transition-colors hover:text-platinum-100"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to sign in
                </Link>
                <Link
                  to="/portal"
                  className="font-mono text-[10.5px] uppercase tracking-[0.26em] text-platinum-300/70 transition-colors hover:text-ember-200"
                >
                  Customer sign in
                </Link>
              </div>
            </form>
          )}

          <p className="mt-10 text-center text-[11px] text-platinum-300/55">
            Need a hand?{" "}
            <Link to="/book" className="text-ember-200 hover:text-ember-100">
              Contact support
            </Link>
          </p>
        </div>
      </div>
    </Shell>
  );
}

function SuccessPanel({ email }: { email: string }) {
  return (
    <div className="mt-8 space-y-5">
      <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.04] px-4 py-4">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
        <div className="space-y-1.5">
          <p className="text-[13px] font-medium leading-relaxed text-emerald-100">
            Check your inbox{email ? <span className="text-emerald-200/70"> — {email}</span> : null}.
          </p>
          <p className="text-[12px] leading-relaxed text-emerald-200/70">
            The link expires shortly and can only be used once. Didn't get it?
            Check spam, then send again.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.26em] text-platinum-300/70 transition-colors hover:text-platinum-100"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to sign in
        </Link>
        <Link
          to="/auth/forgot"
          reloadDocument
          className="font-mono text-[10.5px] uppercase tracking-[0.26em] text-ember-200 transition-colors hover:text-ember-100"
        >
          Send another
        </Link>
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-obsidian-950 text-platinum-100 antialiased">
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_0%,#0f1218_0%,#06070a_55%,#040506_100%)]" />
        <CarbonWeave opacity={0.3} />
        <GrainOverlay opacity={0.08} />
      </div>
      <MouseSpotlight color="rgba(221,41,20,0.16)" size={520} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
