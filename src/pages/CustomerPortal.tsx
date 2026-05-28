/* ============================================================================
 * Customer Portal — /portal
 *
 * Dedicated cinematic dashboard for returning customers. Token-gated via
 * localStorage (`dc_customer_token`) — same token the /book ribbon uses,
 * resolved through `get_customer_portal_by_token` RPC.
 *
 * Design philosophy:
 *   - Booking remains the conversion-focused experience at /book
 *   - This page is account-management: history, status, vehicles, receipts,
 *     future-ready loyalty / referral / support hooks
 *   - Every "Book new appointment" CTA routes back to /book#book so the
 *     booking page stays the primary funnel
 * ========================================================================== */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Gift,
  LifeBuoy,
  LogOut,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  UserCircle2,
  Wrench,
  Zap,
} from "lucide-react";
import {
  getCustomerPortal,
  getCustomerPortalBySession,
  type CustomerPortalData,
  type PortalVehicle,
} from "@/lib/booking-api";
import {
  getCustomerToken,
  clearCustomerToken,
  saveCustomerToken,
  markCustomerAccountLinked,
  clearCustomerAccountLink,
} from "@/lib/customer-portal-storage";
import { useAuth } from "@/auth/AuthProvider";
import {
  AppointmentRow,
  IrisNote,
  ReceiptRow,
} from "@/components/booking/CustomerPortalPanel";
import {
  CarbonWeave,
  EmberCTA,
  EmberOrb,
  GlassCTA,
  GrainOverlay,
  Hairline,
  MouseSpotlight,
  Reveal,
} from "@/components/booking/luxury/primitives";

const LA_TZ = "America/Los_Angeles";

export function CustomerPortalPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [data, setData] = useState<CustomerPortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function fetchByToken(t: string) {
    setLoading(true);
    setError("");
    try {
      const d = await getCustomerPortal(t);
      if (!d) {
        setError("Your session expired. Sign in again to view your account.");
        setData(null);
      } else {
        setData(d);
        // First-load on this device — mark the account link so /book's
        // ribbon shows on return visits.
        markCustomerAccountLinked();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your account.");
    } finally {
      setLoading(false);
    }
  }

  // Auth-session driven fetch: used when user signs in on a new device, or
  // when the token isn't yet in localStorage. Caches the token from the
  // response so cancel/reschedule RPCs (still token-gated) continue to work.
  async function fetchBySession() {
    setLoading(true);
    setError("");
    try {
      const d = await getCustomerPortalBySession();
      if (!d) {
        setError(
          "Your account isn't linked to a booking yet — book a detail and we'll connect it automatically.",
        );
        setData(null);
        return;
      }
      saveCustomerToken(d.customerAccessToken);
      markCustomerAccountLinked();
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your account.");
    } finally {
      setLoading(false);
    }
  }

  // Effect — decide which fetch path to take based on session + cached token.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      // Signed-out: show the sign-in form. Account gating is auth-only now.
      setData(null);
      setLoading(false);
      return;
    }
    const t = getCustomerToken();
    if (t) {
      void fetchByToken(t);
    } else {
      void fetchBySession();
    }
  }, [user, authLoading]);

  // Poll every 30s while visible so status changes (pending → confirmed)
  // appear. Only polls while authed + has data.
  useEffect(() => {
    if (!user || !data) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      const t = getCustomerToken();
      if (t) void fetchByToken(t);
      else void fetchBySession();
    };
    const id = window.setInterval(tick, 30_000);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [user, data]);

  // Swap page title
  useEffect(() => {
    const prev = document.title;
    const biz = data?.business?.name;
    document.title = biz ? `${biz} — Your account` : "Your account";
    return () => {
      document.title = prev;
    };
  }, [data?.business?.name]);

  async function handleSignOut() {
    clearCustomerToken();
    clearCustomerAccountLink();
    await signOut();
    setData(null);
  }

  function handleRefresh() {
    const t = getCustomerToken();
    if (t) return fetchByToken(t);
    return fetchBySession();
  }

  /* ── Loading ──────────────────────────────────────────────── */
  if (authLoading || loading) {
    return (
      <PortalShell>
        <div className="grid min-h-[60vh] place-items-center">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-6 w-6 animate-spin text-ember-400" />
            <p className="font-mono text-[10.5px] uppercase tracking-[0.36em] text-platinum-300/70">
              Loading your account
            </p>
          </div>
        </div>
      </PortalShell>
    );
  }

  /* ── Not signed in → sign-in form ────────────────────────── */
  if (!user) {
    return <SignInGate />;
  }

  /* ── Signed in but no portal data (account not linked) ────── */
  if (!data) {
    return (
      <PortalShell>
        <TopBar onSignOut={handleSignOut} />
        <div className="grid min-h-[70vh] place-items-center px-5">
          <div className="relative w-full max-w-md text-center">
            <div className="pointer-events-none absolute -inset-x-10 -top-10 -z-10 h-40 bg-[radial-gradient(60%_60%_at_50%_50%,rgba(221,41,20,0.18),transparent_70%)]" />
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-white/[0.04]">
              <UserCircle2 className="h-8 w-8 text-ember-300" />
            </div>
            <h1 className="mt-7 font-sans text-3xl font-extralight tracking-tight text-platinum-50 sm:text-4xl">
              Almost <span className="font-display italic text-ember-200">there.</span>
            </h1>
            <p className="mt-4 text-[14px] leading-relaxed text-platinum-300/85">
              {error ||
                "Your account isn't linked to a booking yet — book a detail under the same email and we'll connect it automatically."}
            </p>
            <div className="mt-8">
              <Link
                to="/book"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-5 py-3 text-[11px] font-medium uppercase tracking-[0.22em] text-platinum-100 transition-all hover:border-ember-400/40 hover:bg-ember-500/10"
              >
                Go to the booking page
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </PortalShell>
    );
  }

  return <PortalDashboard data={data} onSignOut={handleSignOut} onRefresh={handleRefresh} />;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Sign-in gate — cinematic password form for returning customers on /portal
 * ────────────────────────────────────────────────────────────────────────── */

function SignInGate() {
  const { signIn, signInWithMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [linkSent, setLinkSent] = useState(false);
  // One-shot banner if the user just finished a password reset.
  const resetSuccess =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("reset") === "success";

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const { error } = await signIn(email.trim(), password);
      if (error) setErr(error);
      // No navigation — useAuth().user transitions and the page re-renders.
    } finally {
      setBusy(false);
    }
  }

  async function handleMagicLink() {
    if (!email.trim()) {
      setErr("Enter your email above first.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const { error } = await signInWithMagicLink(email.trim());
      if (error) setErr(error);
      else setLinkSent(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PortalShell>
      <div className="grid min-h-[80vh] place-items-center px-5">
        <div className="relative w-full max-w-md">
          <div className="pointer-events-none absolute -inset-x-10 -top-10 -z-10 h-40 bg-[radial-gradient(60%_60%_at_50%_50%,rgba(221,41,20,0.16),transparent_70%)]" />

          <div className="text-center">
            <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full border border-ember-400/35 bg-ember-500/10 text-ember-300">
              <ShieldCheck className="h-7 w-7" />
            </span>
            <h1 className="mt-6 font-sans text-3xl font-extralight tracking-tight text-platinum-50 sm:text-4xl">
              Sign in to your{" "}
              <span className="font-display italic text-ember-200">account.</span>
            </h1>
            <p className="mt-3 text-[13.5px] leading-relaxed text-platinum-300/80">
              Bookings, receipts, and saved details — under one roof.
            </p>
          </div>

          <form onSubmit={handleSignIn} className="mt-8 space-y-4">
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

            <label className="block">
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/80">
                  Password
                </span>
                <Link
                  to="/auth/forgot"
                  className="font-mono text-[10px] uppercase tracking-[0.24em] text-platinum-300/70 transition-colors hover:text-ember-200"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative mt-2">
                <Lock className="pointer-events-none absolute left-0 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-platinum-300/55" />
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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

            {resetSuccess && !err && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                <p className="text-[12px] leading-relaxed text-emerald-200">
                  Password updated. Sign in with your new password.
                </p>
              </div>
            )}

            {err && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" />
                <p className="text-[12px] leading-relaxed text-rose-200">{err}</p>
              </div>
            )}

            {linkSent && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                <p className="text-[12px] leading-relaxed text-emerald-200">
                  Check your email — sign-in link sent.
                </p>
              </div>
            )}

            <EmberCTA type="submit" disabled={busy} size="md" className="w-full">
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-0.5" />
                </>
              )}
            </EmberCTA>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleMagicLink}
                disabled={busy}
                className="font-mono text-[10.5px] uppercase tracking-[0.26em] text-platinum-300/70 transition-colors hover:text-ember-200 disabled:opacity-50"
              >
                Email me a link instead
              </button>
              <Link
                to="/book"
                className="font-mono text-[10.5px] uppercase tracking-[0.26em] text-platinum-300/70 transition-colors hover:text-platinum-100"
              >
                Back to booking
              </Link>
            </div>
          </form>

          <p className="mt-10 text-center text-[11px] text-platinum-300/55">
            No account yet?{" "}
            <Link to="/book" className="text-ember-200 hover:text-ember-100">
              Book a detail
            </Link>{" "}
            — you can create one at the end.
          </p>
        </div>
      </div>
    </PortalShell>
  );
}


/* ─────────────────────────────────────────────────────────────────────────────
 * Outer shell — shared atmosphere + top bar + footer caption
 * ────────────────────────────────────────────────────────────────────────── */

function PortalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-obsidian-950 text-platinum-100 antialiased">
      {/* Atmosphere */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_0%,#0f1218_0%,#06070a_55%,#040506_100%)]" />
        <CarbonWeave opacity={0.30} />
        <GrainOverlay opacity={0.08} />
      </div>
      <MouseSpotlight color="rgba(221,41,20,0.16)" size={520} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Top bar — back link + sign-out
 * ────────────────────────────────────────────────────────────────────────── */

function TopBar({
  businessName,
  onSignOut,
}: {
  businessName?: string;
  onSignOut: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-obsidian-950/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-3 px-4 py-3.5 sm:px-6 md:px-10 md:py-4">
        <Link
          to="/book"
          className="group inline-flex min-w-0 items-center gap-2 text-platinum-200 transition-colors hover:text-platinum-50"
        >
          <ArrowLeft className="h-4 w-4 shrink-0 text-platinum-300 transition-transform duration-300 group-hover:-translate-x-0.5" />
          <span className="truncate text-[11px] uppercase tracking-[0.24em] sm:tracking-[0.28em]">
            {businessName ? <>Back to {businessName}</> : <>Back to booking</>}
          </span>
        </Link>
        <button
          type="button"
          onClick={onSignOut}
          title="Forget this device — useful on shared computers."
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 text-[10.5px] uppercase tracking-[0.22em] text-platinum-300/85 transition-colors hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-200"
        >
          <LogOut className="h-3 w-3" />
          Sign out
        </button>
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Dashboard — assumes data is present
 * ────────────────────────────────────────────────────────────────────────── */

function PortalDashboard({
  data,
  onSignOut,
  onRefresh,
}: {
  data: CustomerPortalData;
  onSignOut: () => void;
  onRefresh: () => void | Promise<void>;
}) {
  const navigate = useNavigate();
  const first = (data.customer.name || "").trim().split(/\s+/)[0] || "there";
  const next = data.upcoming[0];

  const stats = computeStats(data);

  return (
    <PortalShell>
      <TopBar businessName={data.business?.name} onSignOut={onSignOut} />

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-16 opacity-90"
        >
          <EmberOrb size={420} />
        </div>
        <div className="mx-auto max-w-[1320px] px-5 pb-10 pt-12 sm:px-6 md:px-10 md:pb-16 md:pt-20">
          <Reveal>
            <div className="flex items-center gap-3 text-platinum-300/80">
              <span className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-ember-300">
                Your account
              </span>
              <span className="h-px w-10 bg-white/15" />
              <span className="font-mono text-[10px] uppercase tracking-[0.32em]">
                {data.business?.name || "Studio"}
              </span>
            </div>
          </Reveal>

          <Reveal delay={0.08}>
            <h1 className="mt-6 font-sans text-[clamp(2.2rem,7vw,4.6rem)] font-extralight leading-[1.02] tracking-[-0.02em] text-platinum-50">
              Welcome back,{" "}
              <span className="font-display italic text-ember-200">{first}.</span>
            </h1>
          </Reveal>

          <Reveal delay={0.16}>
            <p className="mt-5 max-w-[60ch] text-[14.5px] leading-relaxed text-platinum-300/85 md:text-[15px]">
              {next
                ? `Your next appointment is ${formatApptLong(next.startAt)}. Everything below is yours — history, receipts, vehicles, saved info.`
                : "Your dashboard is below — history, receipts, vehicles. Ready for another detail? Book one in a couple of taps."}
            </p>
          </Reveal>

          {/* Quick actions */}
          <Reveal delay={0.22}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <EmberCTA onClick={() => navigate("/book#book")} size="md">
                Book new appointment
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover/btn:translate-x-0.5" />
              </EmberCTA>
              <GlassCTA
                onClick={() => navigate("/book")}
                variant="secondary"
                size="md"
              >
                Browse services
              </GlassCTA>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── IRIS NOTE ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1320px] px-5 sm:px-6 md:px-10">
        <Reveal delay={0.3}>
          <IrisNote data={data} />
        </Reveal>
      </section>

      {/* ── STAT STRIP ────────────────────────────────────────── */}
      <section className="mx-auto mt-10 max-w-[1320px] px-5 sm:px-6 md:mt-14 md:px-10">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <StatCard
            icon={<Calendar className="h-4 w-4" />}
            label="Upcoming"
            value={String(stats.upcomingCount)}
          />
          <StatCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Completed"
            value={String(stats.completedCount)}
          />
          <StatCard
            icon={<Star className="h-4 w-4" />}
            label="Total spent"
            value={stats.totalSpent ? formatMoney(stats.totalSpent) : "—"}
          />
          <StatCard
            icon={<Clock className="h-4 w-4" />}
            label="Member since"
            value={stats.memberSince ?? "—"}
          />
        </div>
      </section>

      {/* ── APPOINTMENTS GRID ─────────────────────────────────── */}
      <section className="mx-auto mt-12 max-w-[1320px] px-5 sm:px-6 md:mt-20 md:px-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-12">
          {/* Upcoming */}
          <Panel
            eyebrow="On the calendar"
            title="Upcoming"
            italic="appointments"
          >
            {data.upcoming.length === 0 ? (
              <EmptyState
                icon={<Calendar className="h-5 w-5" />}
                title="Nothing booked yet"
                body="Configure a detail to see it land here."
                ctaLabel="Book now"
                onCta={() => navigate("/book#book")}
              />
            ) : (
              <ul className="space-y-2">
                {data.upcoming.map((appt) => (
                  <AppointmentRow key={appt.id} appt={appt} onRefresh={onRefresh} />
                ))}
              </ul>
            )}
          </Panel>

          {/* Past */}
          <Panel
            eyebrow="Service history"
            title="Past"
            italic={data.past.length > 0 ? `(${data.past.length})` : "details"}
          >
            {data.past.length === 0 ? (
              <EmptyState
                icon={<Wrench className="h-5 w-5" />}
                title="No history yet"
                body="Your service history will appear here after your first appointment."
              />
            ) : (
              <ul className="space-y-2">
                {data.past.slice(0, 8).map((appt) => (
                  <AppointmentRow key={appt.id} appt={appt} muted onRefresh={onRefresh} />
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </section>

      {/* ── RECEIPTS ──────────────────────────────────────────── */}
      {data.receipts.length > 0 ? (
        <section className="mx-auto mt-12 max-w-[1320px] px-5 sm:px-6 md:mt-20 md:px-10">
          <Panel eyebrow="Paper trail" title="Receipts" italic="& invoices">
            <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {data.receipts.slice(0, 10).map((r) => (
                <ReceiptRow key={r.receiptNumber} receipt={r} />
              ))}
            </ul>
          </Panel>
        </section>
      ) : null}

      {/* ── VEHICLES + SAVED INFO ─────────────────────────────── */}
      <section className="mx-auto mt-12 max-w-[1320px] px-5 sm:px-6 md:mt-20 md:px-10">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-12">
          {/* Vehicles */}
          <Panel eyebrow="Garage" title="Vehicles" italic="on file">
            {data.customer.vehicles.length === 0 ? (
              <EmptyState
                icon={<Zap className="h-5 w-5" />}
                title="No vehicles saved yet"
                body="Your vehicles are added automatically with each appointment."
              />
            ) : (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {data.customer.vehicles.map((v, i) => (
                  <VehicleCard key={i} vehicle={v} />
                ))}
              </ul>
            )}
          </Panel>

          {/* Saved info */}
          <Panel eyebrow="On file" title="Saved" italic="information">
            <SavedInfo data={data} />
          </Panel>
        </div>
      </section>

      {/* ── FUTURE: LOYALTY / REFERRAL / SUPPORT ──────────────── */}
      <section className="mx-auto mt-12 max-w-[1320px] px-5 sm:px-6 md:mt-20 md:px-10">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
          <PromoCard
            icon={<Sparkles className="h-4 w-4" />}
            eyebrow="Loyalty"
            title="Earn with every wash"
            body="Recurring customers unlock priority booking and seasonal credits. Rolling out soon — your visits are already counting."
          />
          <PromoCard
            icon={<Gift className="h-4 w-4" />}
            eyebrow="Refer a friend"
            title="Share the studio"
            body="Refer someone who books a full detail and we'll credit you on your next appointment. Ask for your link by message."
          />
          <PromoCard
            icon={<LifeBuoy className="h-4 w-4" />}
            eyebrow="Support"
            title="Need a hand?"
            body="Questions about a booking, receipt, or product recommendation — message the studio directly."
            href={data.customer.email ? `mailto:${data.customer.email}` : undefined}
          />
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer className="relative mt-20 border-t border-white/[0.06] bg-obsidian-950/85 md:mt-28">
        <div className="mx-auto flex max-w-[1320px] flex-col items-start justify-between gap-3 px-5 py-10 sm:px-6 md:flex-row md:items-center md:px-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-platinum-300/70">
            © {new Date().getFullYear()} {data.business?.name || "Studio"} · Your account
          </p>
          <Link
            to="/book"
            className="group inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.32em] text-platinum-300/80 transition-colors hover:text-ember-200"
          >
            Back to booking
            <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </div>
      </footer>
    </PortalShell>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Sub-components
 * ────────────────────────────────────────────────────────────────────────── */

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 transition-colors hover:border-ember-400/30 hover:bg-white/[0.035] md:p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_120%_at_50%_0%,rgba(221,41,20,0.10),transparent_70%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      />
      <div className="relative">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-ember-400/30 bg-ember-500/10 text-ember-300">
          {icon}
        </span>
        <p className="mt-3 font-mono text-[9.5px] uppercase tracking-[0.28em] text-platinum-300/70">
          {label}
        </p>
        <p className="mt-1.5 font-sans text-2xl font-extralight tracking-tight text-platinum-50 md:text-3xl">
          {value}
        </p>
      </div>
    </div>
  );
}

function Panel({
  eyebrow,
  title,
  italic,
  children,
}: {
  eyebrow: string;
  title: string;
  italic?: string;
  children: React.ReactNode;
}) {
  return (
    <Reveal>
      <div>
        <div className="flex items-baseline gap-3">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-ember-300">
            {eyebrow}
          </p>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <h2 className="mt-3 font-sans text-2xl font-extralight tracking-tight text-platinum-50 md:text-3xl">
          {title}
          {italic ? (
            <>
              {" "}
              <span className="font-display italic text-ember-200">{italic}</span>
            </>
          ) : null}
        </h2>
        <div className="mt-5">{children}</div>
      </div>
    </Reveal>
  );
}

function EmptyState({
  icon,
  title,
  body,
  ctaLabel,
  onCta,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  ctaLabel?: string;
  onCta?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.015] px-5 py-8 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-ember-300">
        {icon}
      </div>
      <p className="mt-4 text-[14px] font-medium text-platinum-50">{title}</p>
      <p className="mx-auto mt-1.5 max-w-[36ch] text-[12.5px] leading-relaxed text-platinum-300/75">
        {body}
      </p>
      {ctaLabel && onCta ? (
        <div className="mt-5">
          <EmberCTA onClick={onCta} size="sm">
            {ctaLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </EmberCTA>
        </div>
      ) : null}
    </div>
  );
}

function VehicleCard({ vehicle }: { vehicle: PortalVehicle }) {
  const title =
    [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle";
  return (
    <li className="overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 transition-colors hover:border-ember-400/30">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-obsidian-900 text-ember-300">
          <Zap className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-platinum-50">{title}</p>
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.22em] text-platinum-300/70">
            {[vehicle.color, vehicle.size].filter(Boolean).join(" · ") || "—"}
          </p>
        </div>
      </div>
    </li>
  );
}

function SavedInfo({ data }: { data: CustomerPortalData }) {
  const c = data.customer;
  return (
    <ul className="space-y-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 md:p-5">
      <InfoLine icon={<UserCircle2 className="h-3.5 w-3.5" />} label="Name">
        {c.name || "—"}
      </InfoLine>
      {c.phone ? (
        <InfoLine icon={<Phone className="h-3.5 w-3.5" />} label="Phone">
          <a href={`tel:${c.phone}`} className="hover:text-ember-200">
            {c.phone}
          </a>
        </InfoLine>
      ) : null}
      {c.email ? (
        <InfoLine icon={<Mail className="h-3.5 w-3.5" />} label="Email">
          <a href={`mailto:${c.email}`} className="break-all hover:text-ember-200">
            {c.email}
          </a>
        </InfoLine>
      ) : null}
      {c.address ? (
        <InfoLine icon={<MapPin className="h-3.5 w-3.5" />} label="Address">
          {c.address}
        </InfoLine>
      ) : null}
      {c.preferredContact ? (
        <InfoLine icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Contact">
          <span className="capitalize">{c.preferredContact}</span>
        </InfoLine>
      ) : null}
      <p className="pt-2 text-[11px] text-platinum-300/60">
        To update saved info, mention the change with your next booking and we'll
        amend the record.
      </p>
    </ul>
  );
}

function InfoLine({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 text-[13px]">
      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-ember-300">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[9.5px] uppercase tracking-[0.24em] text-platinum-300/65">
          {label}
        </p>
        <div className="mt-0.5 min-w-0 text-platinum-100">{children}</div>
      </div>
    </li>
  );
}

function PromoCard({
  icon,
  eyebrow,
  title,
  body,
  href,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  body: string;
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-center gap-2">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-ember-400/30 bg-ember-500/10 text-ember-300">
          {icon}
        </span>
        <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ember-300">
          {eyebrow}
        </p>
      </div>
      <p className="mt-4 font-sans text-lg font-extralight tracking-tight text-platinum-50">
        {title}
      </p>
      <p className="mt-2 text-[12.5px] leading-relaxed text-platinum-300/80">{body}</p>
    </>
  );

  const cls =
    "group relative block overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 transition-colors hover:border-ember-400/30 hover:bg-white/[0.035]";

  if (href) {
    return (
      <a href={href} className={cls}>
        {inner}
      </a>
    );
  }
  return <div className={cls}>{inner}</div>;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────────────────── */

interface DerivedStats {
  upcomingCount: number;
  completedCount: number;
  totalSpent: number | null;
  memberSince: string | null;
}

function computeStats(data: CustomerPortalData): DerivedStats {
  const upcomingCount = data.upcoming.length;
  const completedCount = data.past.filter((a) => a.status === "completed").length;

  const totalCents = data.receipts.reduce((sum, r) => sum + (r.amountPaidCents ?? 0), 0);
  const totalSpent = totalCents > 0 ? totalCents / 100 : null;

  const allDates = [...data.past, ...data.upcoming]
    .map((a) => new Date(a.startAt).getTime())
    .filter((n) => !Number.isNaN(n));
  const memberSince =
    allDates.length > 0
      ? new Intl.DateTimeFormat("en-US", {
          timeZone: LA_TZ,
          month: "short",
          year: "numeric",
        }).format(new Date(Math.min(...allDates)))
      : null;

  return { upcomingCount, completedCount, totalSpent, memberSince };
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function formatApptLong(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: LA_TZ,
      weekday: "long",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}
