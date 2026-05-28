/* ============================================================================
 * Reset Password — /auth/reset
 *
 * Lands here after the user clicks the link in their recovery email.
 * Supabase's `detectSessionInUrl: true` picks up the hash token and fires
 * PASSWORD_RECOVERY, which AuthProvider catches and exposes as
 * `recoveryFlow`. We accept either signal:
 *   - recoveryFlow=true (Supabase's authoritative signal), OR
 *   - `type=recovery` in the URL hash on mount (covers the brief window
 *     before the event fires).
 *
 * On a bad/expired link Supabase appends `error` / `error_description` to
 * the hash — we surface those as the cinematic "link expired" state with
 * a route back to /auth/forgot.
 *
 * On success we globally sign out (invalidates other devices' sessions
 * per the password-reset security spec) and redirect to /login with a
 * one-shot success banner.
 * ========================================================================== */

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useAuth } from "./AuthProvider";
import { supabase } from "@/lib/supabase";
import {
  CarbonWeave,
  EmberCTA,
  GrainOverlay,
  MouseSpotlight,
} from "@/components/booking/luxury/primitives";

const MIN_PASSWORD = 8;
const RECOVERY_GRACE_MS = 2500;

type Phase = "verifying" | "ready" | "expired" | "success";

export function ResetPasswordPage() {
  const { recoveryFlow, user, loading, updatePassword, signOut } = useAuth();
  const navigate = useNavigate();

  // Parse the URL hash ONCE on mount — Supabase will wipe it shortly after.
  const initial = useMemo(() => parseRecoveryHash(), []);

  const [phase, setPhase] = useState<Phase>(() => {
    if (initial.error) return "expired";
    return "verifying";
  });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitErr, setSubmitErr] = useState("");
  const [busy, setBusy] = useState(false);

  // Transition verifying → ready once Supabase confirms the recovery session
  // (or after a short grace period if we already saw the recovery hash).
  useEffect(() => {
    if (phase !== "verifying") return;
    if (loading) return;
    if (recoveryFlow || (initial.type === "recovery" && user)) {
      setPhase("ready");
      return;
    }
    // If the URL never had a recovery signal AND the user already had a
    // normal session (e.g. they typed /auth/reset directly), treat it as
    // ready — they can change their password while signed in. If they
    // have no session at all, the link must have expired.
    if (!initial.type && user) {
      setPhase("ready");
      return;
    }
    if (initial.type === "recovery") {
      // Give the Supabase client a moment to finish exchanging the hash.
      const t = setTimeout(() => {
        setPhase((current) => (current === "verifying" ? "expired" : current));
      }, RECOVERY_GRACE_MS);
      return () => clearTimeout(t);
    }
    setPhase("expired");
  }, [phase, loading, recoveryFlow, user, initial.type]);

  const strength = useMemo(() => scorePassword(password), [password]);
  const mismatched = confirm.length > 0 && confirm !== password;
  const canSubmit =
    !busy &&
    password.length >= MIN_PASSWORD &&
    confirm === password &&
    strength.score >= 2;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setSubmitErr("");
    try {
      const { error } = await updatePassword(password);
      if (error) {
        setSubmitErr(humanizeUpdateError(error));
        return;
      }
      // Global sign-out invalidates refresh tokens on every device.
      // The redirect lands on /login with a one-shot success banner.
      if (supabase) {
        await supabase.auth.signOut({ scope: "global" }).catch(() => {});
      } else {
        await signOut();
      }
      setPhase("success");
      setTimeout(() => navigate("/login?reset=success", { replace: true }), 1400);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <div className="grid min-h-[80vh] place-items-center px-5">
        <div className="relative w-full max-w-md">
          <div className="pointer-events-none absolute -inset-x-10 -top-10 -z-10 h-40 bg-[radial-gradient(60%_60%_at_50%_50%,rgba(221,41,20,0.16),transparent_70%)]" />

          {phase === "verifying" && <VerifyingState />}
          {phase === "expired" && <ExpiredState reason={initial.errorDescription} />}
          {phase === "success" && <SuccessState />}
          {phase === "ready" && (
            <ReadyForm
              password={password}
              confirm={confirm}
              showPassword={showPassword}
              busy={busy}
              submitErr={submitErr}
              strength={strength}
              mismatched={mismatched}
              canSubmit={canSubmit}
              onPasswordChange={setPassword}
              onConfirmChange={setConfirm}
              onToggleShow={() => setShowPassword((v) => !v)}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </div>
    </Shell>
  );
}

/* ───────────────────────── phases ─────────────────────────────────────── */

function VerifyingState() {
  return (
    <div className="text-center">
      <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-ember-400/35 bg-ember-500/10 text-ember-300">
        <Loader2 className="h-6 w-6 animate-spin" />
      </span>
      <h1 className="mt-6 font-sans text-3xl font-extralight tracking-tight text-platinum-50">
        Verifying your{" "}
        <span className="font-display italic text-ember-200">link</span>
      </h1>
      <p className="mt-3 text-[13.5px] leading-relaxed text-platinum-300/80">
        One moment — confirming your recovery session.
      </p>
    </div>
  );
}

function ExpiredState({ reason }: { reason: string | null }) {
  return (
    <div className="text-center">
      <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-300">
        <ShieldAlert className="h-7 w-7" />
      </span>
      <h1 className="mt-6 font-sans text-3xl font-extralight tracking-tight text-platinum-50">
        That link is{" "}
        <span className="font-display italic text-rose-200">no longer valid.</span>
      </h1>
      <p className="mt-3 text-[13.5px] leading-relaxed text-platinum-300/80">
        Recovery links expire shortly and can only be used once. Request a fresh
        one and we'll send a new link to your inbox.
      </p>
      {reason ? (
        <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.26em] text-rose-300/60">
          {reason}
        </p>
      ) : null}

      <div className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
        <Link
          to="/auth/forgot"
          className="group/btn inline-flex items-center justify-center gap-2 rounded-full border border-ember-400/40 bg-gradient-to-b from-ember-500/95 to-ember-600/90 px-5 py-3 text-[13px] font-medium text-platinum-50 shadow-[0_18px_40px_-12px_rgba(221,41,20,0.55)] transition-all hover:from-ember-400/95 hover:to-ember-500/90"
        >
          Send a new link
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-0.5" />
        </Link>
        <Link
          to="/login"
          className="inline-flex items-center justify-center gap-1.5 font-mono text-[10.5px] uppercase tracking-[0.26em] text-platinum-300/70 transition-colors hover:text-platinum-100"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}

function SuccessState() {
  return (
    <div className="text-center">
      <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-emerald-500/35 bg-emerald-500/10 text-emerald-300">
        <CheckCircle2 className="h-7 w-7" />
      </span>
      <h1 className="mt-6 font-sans text-3xl font-extralight tracking-tight text-platinum-50">
        Password{" "}
        <span className="font-display italic text-ember-200">reset.</span>
      </h1>
      <p className="mt-3 text-[13.5px] leading-relaxed text-platinum-300/80">
        Your password has been updated. For your security we've signed you out
        of every device. Redirecting to sign in…
      </p>
      <Loader2 className="mx-auto mt-6 h-4 w-4 animate-spin text-platinum-300/60" />
    </div>
  );
}

function ReadyForm(props: {
  password: string;
  confirm: string;
  showPassword: boolean;
  busy: boolean;
  submitErr: string;
  strength: PasswordScore;
  mismatched: boolean;
  canSubmit: boolean;
  onPasswordChange: (v: string) => void;
  onConfirmChange: (v: string) => void;
  onToggleShow: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const {
    password,
    confirm,
    showPassword,
    busy,
    submitErr,
    strength,
    mismatched,
    canSubmit,
    onPasswordChange,
    onConfirmChange,
    onToggleShow,
    onSubmit,
  } = props;
  return (
    <>
      <div className="text-center">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-ember-400/35 bg-ember-500/10 text-ember-300">
          <ShieldCheck className="h-7 w-7" />
        </span>
        <h1 className="mt-6 font-sans text-3xl font-extralight tracking-tight text-platinum-50 sm:text-4xl">
          Set a new{" "}
          <span className="font-display italic text-ember-200">password.</span>
        </h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-platinum-300/80">
          At least {MIN_PASSWORD} characters. Mix letters, numbers, and a symbol
          for a stronger key.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <label className="block">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/80">
            New password
          </span>
          <div className="relative mt-2">
            <Lock className="pointer-events-none absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-platinum-300/55" />
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              required
              minLength={MIN_PASSWORD}
              autoFocus
              placeholder="••••••••"
              className="block w-full appearance-none rounded-none border-b border-white/20 bg-transparent py-2.5 pl-6 pr-9 text-[15px] text-platinum-50 placeholder:text-platinum-300/40 outline-none transition-all focus:border-ember-400 focus:[box-shadow:inset_0_-1px_0_rgba(248,114,72,0.7)]"
            />
            <button
              type="button"
              onClick={onToggleShow}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-0 top-1/2 -translate-y-1/2 p-1 text-platinum-300/65 transition-colors hover:text-platinum-50"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {password ? <StrengthMeter score={strength} /> : null}
        </label>

        <label className="block">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/80">
            Confirm password
          </span>
          <div className="relative mt-2">
            <Lock className="pointer-events-none absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-platinum-300/55" />
            <input
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => onConfirmChange(e.target.value)}
              required
              placeholder="••••••••"
              className="block w-full appearance-none rounded-none border-b border-white/20 bg-transparent py-2.5 pl-6 text-[15px] text-platinum-50 placeholder:text-platinum-300/40 outline-none transition-all focus:border-ember-400 focus:[box-shadow:inset_0_-1px_0_rgba(248,114,72,0.7)]"
            />
          </div>
          {mismatched ? (
            <p className="mt-1.5 font-mono text-[10.5px] uppercase tracking-[0.26em] text-rose-300/80">
              Passwords don't match yet
            </p>
          ) : null}
        </label>

        {submitErr && (
          <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" />
            <p className="text-[12px] leading-relaxed text-rose-200">{submitErr}</p>
          </div>
        )}

        <EmberCTA type="submit" disabled={!canSubmit} size="md" className="w-full">
          {busy ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Updating…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Update password
            </>
          )}
        </EmberCTA>

        <p className="text-center font-mono text-[10.5px] uppercase tracking-[0.26em] text-platinum-300/55">
          You'll be signed out of every device after this change.
        </p>
      </form>
    </>
  );
}

function StrengthMeter({ score }: { score: PasswordScore }) {
  const labels = ["Too short", "Weak", "Fair", "Strong", "Excellent"];
  const colors = [
    "bg-rose-500/70",
    "bg-rose-400/80",
    "bg-amber-400/85",
    "bg-emerald-400/85",
    "bg-emerald-300",
  ];
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-[3px] flex-1 rounded-full transition-colors duration-300 ${
              i < score.score ? colors[score.score] : "bg-white/[0.08]"
            }`}
          />
        ))}
      </div>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.26em] text-platinum-300/70">
        {labels[score.score]}
      </p>
    </div>
  );
}

/* ───────────────────────── shell + helpers ────────────────────────────── */

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

interface ParsedRecovery {
  type: string | null;
  error: string | null;
  errorDescription: string | null;
}

function parseRecoveryHash(): ParsedRecovery {
  if (typeof window === "undefined") {
    return { type: null, error: null, errorDescription: null };
  }
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  const params = new URLSearchParams(hash);
  const error = params.get("error") ?? params.get("error_code");
  const errorDescription = params.get("error_description");
  return {
    type: params.get("type"),
    error,
    errorDescription: errorDescription
      ? decodeURIComponent(errorDescription.replace(/\+/g, " "))
      : null,
  };
}

export interface PasswordScore {
  score: 0 | 1 | 2 | 3 | 4;
}

export function scorePassword(value: string): PasswordScore {
  if (value.length < MIN_PASSWORD) return { score: 0 };
  let s = 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) s++;
  if (/[0-9]/.test(value)) s++;
  if (/[^A-Za-z0-9]/.test(value)) s++;
  if (value.length >= 14) s = Math.min(4, s + 1);
  return { score: Math.min(4, s) as PasswordScore["score"] };
}

function humanizeUpdateError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes("same as the old") || m.includes("should be different")) {
    return "That's the same as your old password — pick a new one.";
  }
  if (m.includes("weak") || m.includes("password")) {
    return raw;
  }
  if (m.includes("expired") || m.includes("invalid")) {
    return "Your recovery session expired. Request a fresh link.";
  }
  return raw;
}
