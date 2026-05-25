/* ============================================================================
 * BookingSuccessAccount — cinematic post-submit screen with optional sign-up.
 *
 * Renders after a customer successfully submits the booking. Replaces the old
 * "stay on /book with the ribbon expanded" UX. Offers an optional account
 * creation path so the customer can come back from any device to view + edit
 * their bookings + receipts.
 *
 * Branches:
 *   - Sign up (primary CTA): inline password field, calls supabase.auth.signUp
 *     with the email captured during booking; on success → /portal
 *   - Skip (secondary): closes the screen → returns to /book at default state
 *     with no ribbon (since no account = no portal access per spec)
 *
 * The legacy `dc_customer_token` is still saved by the orchestrator — it's
 * harmless dead weight without an account, and lets us light up the ribbon
 * later if the customer signs up on a return visit.
 * ========================================================================== */

import { useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  CarbonWeave,
  EmberCTA,
  EmberOrb,
  GrainOverlay,
  Hairline,
  Reveal,
} from "@/components/booking/luxury/primitives";
import { useAuth } from "@/auth/AuthProvider";

interface Props {
  businessName: string;
  /** Email captured in the booking form (read-only, pre-filled). May be empty
   *  if the customer didn't provide one — in that case we ask for it. */
  prefilledEmail: string;
  /** Called when the user chooses to skip account creation OR successfully
   *  signs up. The parent decides what to do (close success / route /portal). */
  onSkip: () => void;
  onAccountCreated: () => void;
  /** First name from booking form, used for personalization. */
  firstName?: string;
}

export function BookingSuccessAccount({
  businessName,
  prefilledEmail,
  firstName,
  onSkip,
  onAccountCreated,
}: Props) {
  const { signUp } = useAuth();
  const [mode, setMode] = useState<"choose" | "signup">("choose");
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmationNotice, setConfirmationNotice] = useState(false);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || password.length < 8) {
      setError("Enter a valid email and a password of at least 8 characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await signUp(email.trim(), password);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.needsConfirmation) {
        // Supabase project has "Confirm email" enabled. Show a calm
        // confirmation notice — we don't navigate to /portal because
        // there's no session yet.
        setConfirmationNotice(true);
        return;
      }
      // Session is live — route to portal where the customer's data appears.
      onAccountCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create your account. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const displayName = firstName?.trim() || "there";

  /* ─ Confirmation pending state ────────────────────────────────────── */
  if (confirmationNotice) {
    return (
      <SuccessShell businessName={businessName}>
        <div className="relative w-full max-w-lg text-center">
          <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-ember-400/40 bg-ember-500/10 text-ember-300">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <h2 className="mt-6 font-sans text-3xl font-extralight tracking-tight text-platinum-50 md:text-4xl">
            Check your <span className="font-display italic text-ember-200">inbox.</span>
          </h2>
          <p className="mt-4 text-[14px] leading-relaxed text-platinum-300/85">
            We sent a confirmation link to <span className="font-mono text-platinum-100">{email}</span>.
            Click it to finish setting up your account — your booking is already in.
          </p>
          <div className="mt-8">
            <EmberCTA onClick={onSkip} size="md">
              Back to booking
              <ArrowRight className="h-4 w-4" />
            </EmberCTA>
          </div>
        </div>
      </SuccessShell>
    );
  }

  return (
    <SuccessShell businessName={businessName}>
      <div className="relative w-full max-w-xl">
        {/* ── Confirmation headline ─────────────────────────────────── */}
        <Reveal>
          <div className="flex items-center gap-3 text-platinum-300/80">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-ember-300">
              Booking received
            </span>
            <span className="h-px w-10 bg-white/15" />
            <span className="font-mono text-[10px] uppercase tracking-[0.32em]">
              {businessName}
            </span>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <h1 className="mt-6 font-sans text-[clamp(2.2rem,6vw,4.2rem)] font-extralight leading-[1.02] tracking-[-0.02em] text-platinum-50">
            Thanks{firstName ? `, ${firstName}` : ""}.{" "}
            <span className="font-display italic text-ember-200">
              You're booked.
            </span>
          </h1>
        </Reveal>

        <Reveal delay={0.16}>
          <p className="mt-5 max-w-[58ch] text-[14.5px] leading-relaxed text-platinum-300/85 md:text-[15px]">
            Your configuration was submitted. I'll review the build and reach out shortly to
            confirm the time and final price.
          </p>
        </Reveal>

        {/* ── Choice card ───────────────────────────────────────────── */}
        {mode === "choose" ? (
          <Reveal delay={0.24}>
            <div className="mt-10 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-7">
              <div
                aria-hidden
                className="pointer-events-none absolute -z-10 inset-0 bg-[radial-gradient(80%_60%_at_50%_0%,rgba(221,41,20,0.10),transparent_65%)]"
              />
              <div className="flex items-start gap-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ember-400/35 bg-ember-500/10 text-ember-300">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-ember-300">
                    Optional
                  </p>
                  <h2 className="mt-1 font-sans text-xl font-light tracking-tight text-platinum-50 sm:text-2xl">
                    Save your account, {displayName}?
                  </h2>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-platinum-300/85">
                    Sign up to see this booking and every future one in your
                    personal dashboard. Skip it and you'll still be confirmed —
                    just without history at your fingertips.
                  </p>
                </div>
              </div>

              <Hairline className="mt-6" />

              <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Benefit>View upcoming + past appointments</Benefit>
                <Benefit>Edit / reschedule from any device</Benefit>
                <Benefit>Download receipts &amp; invoices</Benefit>
                <Benefit>Saved vehicle + contact info</Benefit>
              </ul>

              <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <EmberCTA
                  onClick={() => setMode("signup")}
                  size="md"
                  className="sm:flex-1"
                >
                  Save my account
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-0.5" />
                </EmberCTA>
                <button
                  type="button"
                  onClick={onSkip}
                  className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/70 transition-colors hover:text-platinum-100"
                >
                  No thanks — just confirm
                </button>
              </div>
            </div>
          </Reveal>
        ) : (
          /* ── Sign-up form ────────────────────────────────────────── */
          <Reveal>
            <form
              onSubmit={handleSignUp}
              className="mt-10 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-7"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ember-400/35 bg-ember-500/10 text-ember-300">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-ember-300">
                    Create your account
                  </p>
                  <p className="mt-1 text-[13.5px] leading-relaxed text-platinum-300/85">
                    Pick a password — you'll use it with your email to sign in
                    on any device.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {/* Email */}
                <label className="block">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/80">
                    Email
                  </span>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="mt-2 block w-full appearance-none rounded-none border-b border-white/20 bg-transparent py-2.5 text-[15px] text-platinum-50 placeholder:text-platinum-300/40 outline-none transition-all focus:border-ember-400 focus:[box-shadow:inset_0_-1px_0_rgba(248,114,72,0.7)]"
                  />
                </label>

                {/* Password */}
                <label className="block">
                  <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/80">
                    Password <span className="text-platinum-300/45">(8+ chars)</span>
                  </span>
                  <div className="relative mt-2">
                    <Lock className="pointer-events-none absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-platinum-300/55" />
                    <input
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="••••••••"
                      className="block w-full appearance-none rounded-none border-b border-white/20 bg-transparent py-2.5 pl-6 pr-9 text-[15px] text-platinum-50 placeholder:text-platinum-300/40 outline-none transition-all focus:border-ember-400 focus:[box-shadow:inset_0_-1px_0_rgba(248,114,72,0.7)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-platinum-300/65 transition-colors hover:text-platinum-50"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </label>

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" />
                    <p className="text-[12px] leading-relaxed text-rose-200">
                      {error}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                <EmberCTA
                  type="submit"
                  disabled={busy}
                  size="md"
                  className="sm:flex-1"
                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Creating account…
                    </>
                  ) : (
                    <>
                      Create account
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-0.5" />
                    </>
                  )}
                </EmberCTA>
                <button
                  type="button"
                  onClick={() => {
                    setMode("choose");
                    setError("");
                  }}
                  disabled={busy}
                  className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/70 transition-colors hover:text-platinum-100 disabled:opacity-50"
                >
                  Back
                </button>
              </div>

              <p className="mt-4 text-[10.5px] leading-relaxed text-platinum-300/55">
                By creating an account you agree to be contacted about your bookings.
                Your email is never shared.
              </p>
            </form>
          </Reveal>
        )}
      </div>
    </SuccessShell>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Reusable shell — matches the cinematic atmosphere of /book + /portal
 * ────────────────────────────────────────────────────────────────────────── */

function SuccessShell({
  businessName,
  children,
}: {
  businessName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-obsidian-950 text-platinum-100">
      {/* Atmosphere */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_0%,#0f1218_0%,#06070a_55%,#040506_100%)]" />
        <CarbonWeave opacity={0.3} />
        <GrainOverlay opacity={0.08} />
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-20 opacity-90"
      >
        <EmberOrb size={520} />
      </div>

      {/* Top — tiny brand mark */}
      <header className="relative z-10 px-5 pt-6 sm:px-6 md:px-10">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-platinum-300/65">
          {businessName}
        </p>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-72px)] max-w-[1320px] flex-col justify-center px-5 py-12 sm:px-6 md:px-10">
        {children}
      </main>
    </div>
  );
}

function Benefit({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-[13px] text-platinum-100">
      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ember-300" />
      <span>{children}</span>
    </li>
  );
}
