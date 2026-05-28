/**
 * IrisPanel — the full intelligence experience.
 *
 * Phase H6 ships this as a fully-rendered page over real H1/H2/H3 data.
 * Phase H7 connects the input bar to the AI assistant; the visual story
 * doesn't change.
 *
 * Layout:
 *   - Full-bleed hero with the XL orb + status line
 *   - KPI strip (today / attention / week / month pace)
 *   - Command input bar with rotating placeholders
 *   - Suggested command chips
 *   - Two-column grid: attention items + insights/weather
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  BellRing,
  Calendar as CalendarIcon,
  CloudRain,
  DollarSign,
  Lightbulb,
  Star,
  Tag,
  Timer,
  TrendingUp,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useStore } from "@/store/store";
import {
  appointmentsOnDay,
  appointmentsThisWeek,
  weekRevenueEstimate,
} from "@/lib/selectors";
import { formatCurrency, cn } from "@/lib/utils";
import {
  buildBusinessInsights,
  buildRevenuePace,
  countByPriority,
  lookupWeather,
  runAttentionRules,
  type WeatherFinding,
} from "@/lib/intelligence";
import { askAiAssistant, type AiAssistantResponse, type AiAssistantReason } from "@/lib/intelligence/ai-assistant";
import { useIrisPageContext, useRegisterIrisContext } from "./PageContext";
import { ProposedActionCard } from "./ProposedActionCard";
import { IrisOrb, type OrbState } from "./IrisOrb";
import { IrisOrbitalRings } from "./IrisOrbitalRings";
import { IrisStatusConsole } from "./IrisStatusConsole";
import { MetricPill } from "./MetricPill";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { SuggestedCommandChip } from "./SuggestedCommandChip";
import { CommandInputBar } from "./CommandInputBar";
import { AttentionItemRow } from "@/components/intelligence/AttentionItemRow";
import { ExternalSourceChip } from "@/components/intelligence/ExternalSourceChip";
import { useAttentionLocalState, isHidden } from "@/components/intelligence/snoozeStorage";

const SUGGESTIONS: Array<{
  label: string;
  icon: React.ReactNode;
  linkUrl: string;
}> = [
  { label: "Today's schedule", icon: <CalendarIcon className="h-3 w-3" />, linkUrl: "/calendar" },
  { label: "Customers due to rebook", icon: <Users className="h-3 w-3" />, linkUrl: "/customers" },
  { label: "Open balances", icon: <Wallet className="h-3 w-3" />, linkUrl: "/receipts" },
  { label: "Recent leads", icon: <BellRing className="h-3 w-3" />, linkUrl: "/leads" },
  { label: "Service performance", icon: <Tag className="h-3 w-3" />, linkUrl: "/services" },
  { label: "Pricing calculator", icon: <DollarSign className="h-3 w-3" />, linkUrl: "/calculator" },
];

export function IrisPanel() {
  const { data } = useStore();
  const navigate = useNavigate();
  useRegisterIrisContext({ page: "iris", label: "Iris home" });
  const pageContext = useIrisPageContext();
  const { state: snoozeState, snooze, dismiss } = useAttentionLocalState();
  const [resolvedActionIds, setResolvedActionIds] = useState<Set<string>>(new Set());

  // Live intelligence
  const now = useMemo(() => new Date(), []);
  const attention = useMemo(() => runAttentionRules(data, now), [data, now]);
  const insights = useMemo(() => buildBusinessInsights(data, now), [data, now]);
  const pace = useMemo(() => buildRevenuePace(data, now), [data, now]);
  const visibleAttention = useMemo(
    () => attention.filter((i) => !isHidden(i.id, snoozeState)),
    [attention, snoozeState],
  );
  const counts = useMemo(() => countByPriority(visibleAttention), [visibleAttention]);

  // Operational stats
  const today = useMemo(() => new Date(), []);
  const todays = appointmentsOnDay(data, today);
  const week = appointmentsThisWeek(data, today);
  const weekRev = weekRevenueEstimate(data, today);

  // Orb state derives from urgency
  const orbState: OrbState =
    counts.critical > 0 ? "alert" : counts.high > 0 ? "thinking" : "idle";

  // Time-aware greeting
  const greetingLine = useMemo(() => {
    const hour = now.getHours();
    const greeting =
      hour < 5
        ? "Working late"
        : hour < 12
          ? "Good morning"
          : hour < 17
            ? "Good afternoon"
            : hour < 21
              ? "Good evening"
              : "Working late";
    const first = data.settings.ownerName?.trim().split(/\s+/)[0] ?? "";
    return first ? `${greeting}, ${first}.` : `${greeting}.`;
  }, [data.settings.ownerName, now]);

  // AI assistant state
  const [aiPending, setAiPending] = useState(false);
  const [aiResponse, setAiResponse] = useState<AiAssistantResponse | null>(null);
  const [aiError, setAiError] = useState<{ reason: AiAssistantReason; message?: string } | null>(null);

  const handleSubmit = useCallback(async (query: string) => {
    setAiPending(true);
    setAiResponse(null);
    setAiError(null);
    setResolvedActionIds(new Set());
    const result = await askAiAssistant(query, data, { pageContext });
    setAiPending(false);
    if (result.ok && result.data) {
      setAiResponse(result.data);
    } else {
      setAiError({ reason: result.reason, message: result.message });
    }
  }, [data, pageContext]);

  const clearAiResponse = useCallback(() => {
    setAiResponse(null);
    setAiError(null);
    setResolvedActionIds(new Set());
  }, []);

  // Weather (async, optional)
  const [weather, setWeather] = useState<WeatherFinding | null>(null);
  useEffect(() => {
    let cancelled = false;
    lookupWeather({ forecastDays: 7 }).then((r) => {
      if (cancelled) return;
      if (r.ok && r.data) setWeather(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const weatherRiskCount = useMemo(() => {
    if (!weather) return 0;
    return weather.days.filter(
      (d) => (d.precipitationProbabilityPct ?? 0) >= 50,
    ).length;
  }, [weather]);

  // Pace formatting
  const paceTrend: "up" | "down" | "neutral" = pace.hasEnoughDataToProject
    ? pace.projectionVsLastMonthRatio > 0.02
      ? "up"
      : pace.projectionVsLastMonthRatio < -0.02
        ? "down"
        : "neutral"
    : "neutral";
  const paceHint = pace.hasEnoughDataToProject
    ? `proj ${formatCurrency(pace.projectedMonthEndCents / 100)}`
    : `${pace.daysElapsed}/${pace.daysInMonth} days`;
  const paceCompact = pace.hasEnoughDataToProject
    ? `${pace.projectionVsLastMonthRatio >= 0 ? "+" : ""}${(pace.projectionVsLastMonthRatio * 100).toFixed(0)}%`
    : "—";

  return (
    <div className="relative">
      {/* ── HUD atmosphere ─────────────────────────────────────────────
       *
       * Three layered effects re-tuned for the true obsidian shell:
       *   1. Three soft ember radial glows (top-left, top-right, bottom-center)
       *      that establish "the room has light somewhere" without committing
       *      to a single source — the orb is the implied origin.
       *   2. A faint ember grid that drifts diagonally — keeps the eye
       *      registering depth even when the page is static.
       *   3. A slow scanline sweep using mix-blend screen — the cinematic
       *      "this is software" cue. Stays low-opacity so it never competes
       *      with content.
       * The old version used CSS-var primary refs that pointed at light-mode
       * red and rendered muted against the dark shell. Now anchored to
       * explicit ember rgba.
       * ────────────────────────────────────────────────────────────── */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 0% 0%, rgba(221,41,20,0.12) 0%, transparent 60%),
              radial-gradient(ellipse 80% 50% at 100% 0%, rgba(248,114,72,0.09) 0%, transparent 60%),
              radial-gradient(ellipse 100% 60% at 50% 100%, rgba(168,114,70,0.07) 0%, transparent 70%)
            `,
          }}
        />
        {/* Faint ember grid that drifts diagonally */}
        <div
          className="absolute inset-0 opacity-[0.05] animate-iris-grid-drift"
          style={{
            backgroundImage: `
              linear-gradient(rgba(248,114,72,0.7) 1px, transparent 1px),
              linear-gradient(90deg, rgba(248,114,72,0.7) 1px, transparent 1px)
            `,
            backgroundSize: "44px 44px",
          }}
        />
        {/* Scanline sweep — slow, low-opacity ember band */}
        <div
          className="absolute inset-x-0 h-40 animate-iris-scanline mix-blend-screen"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(248,114,72,0.10) 50%, transparent 100%)",
          }}
        />
      </div>

      <div className="relative z-0 mx-auto max-w-5xl space-y-8 pb-12">
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="flex flex-col items-center text-center pt-4 sm:pt-6">
          {/* Greeting / brand line — mono kicker treatment matches the
              cinematic admin shell. */}
          <div
            className="font-mono text-[10px] sm:text-[11px] tracking-[0.28em] uppercase text-platinum-300/65 animate-iris-fade-up"
            style={{ animationDelay: "0ms" }}
          >
            <span className="text-platinum-100/90">{greetingLine}</span>
            <span className="ml-2 text-platinum-300/35 hidden sm:inline">
              // Detail Command · Intelligence Layer
            </span>
          </div>

          {/* Orbital field with orb centered inside */}
          <div
            className="relative mt-2 sm:mt-3 animate-iris-fade-up"
            style={{
              width: "min(30rem, 100%)",
              aspectRatio: "1 / 1",
              animationDelay: "120ms",
            }}
          >
            <IrisOrbitalRings
              jobsToday={todays.length}
              weekRevenue={formatCurrency(weekRev)}
              monthPace={paceCompact}
              attention={visibleAttention.length}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <IrisOrb state={orbState} size="xl" />
            </div>
          </div>

          {/* Status console — cycles through observations + recent events */}
          <div
            className="mt-1 w-full max-w-2xl animate-iris-fade-up"
            style={{ animationDelay: "320ms" }}
          >
            <IrisStatusConsole data={data} />
          </div>
        </section>

        {/* ── KPI strip ───────────────────────────────────────────── */}
        <section className="grid gap-2 grid-cols-2 sm:grid-cols-4">
          <MetricPill
            label="Today"
            value={todays.length}
            hint={`${week.length} this week`}
            icon={<CalendarIcon className="h-3.5 w-3.5" />}
            accent="primary"
          />
          <MetricPill
            label="Attention"
            value={counts.critical + counts.high + counts.medium + counts.low}
            hint={
              counts.critical > 0
                ? `${counts.critical} critical`
                : counts.high > 0
                  ? `${counts.high} high`
                  : "all clear"
            }
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            accent={counts.critical > 0 ? "primary" : counts.high > 0 ? "amber" : "emerald"}
          />
          <MetricPill
            label="Week revenue"
            value={formatCurrency(weekRev)}
            hint={`${week.length} jobs`}
            icon={<Wallet className="h-3.5 w-3.5" />}
            accent="emerald"
          />
          <MetricPill
            label="Month pace"
            value={
              pace.hasEnoughDataToProject
                ? `${pace.projectionVsLastMonthRatio >= 0 ? "+" : ""}${(pace.projectionVsLastMonthRatio * 100).toFixed(0)}%`
                : "—"
            }
            hint={paceHint}
            trend={paceTrend}
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            accent="violet"
          />
        </section>

        {/* ── Command input ───────────────────────────────────────── */}
        <section className="mx-auto max-w-2xl">
          <CommandInputBar onSubmit={handleSubmit} isLoading={aiPending} />
        </section>

        {/* ── Suggestions ─────────────────────────────────────────── */}
        <section className="flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <SuggestedCommandChip
              key={s.label}
              label={s.label}
              icon={s.icon}
              linkUrl={s.linkUrl}
            />
          ))}
        </section>

        {/* ── AI response transmission ──────────────────────────────
         *
         * Not a card — a "transmission" panel. Carbon-weave glass surface
         * with an ember rail at top-left that reads as "incoming signal,"
         * a TX timestamp label, and content laid out for reading not
         * skimming. The pending state uses an animated ember bar instead
         * of generic "Analyzing…" text.
         * ────────────────────────────────────────────────────────── */}
        {(aiPending || aiResponse || aiError) ? (
          <section className="mx-auto w-full max-w-2xl">
            <div
              className="relative isolate overflow-hidden border border-white/10 bg-gradient-to-b from-obsidian-850/85 via-obsidian-900/90 to-obsidian-900/95 backdrop-blur-xl backdrop-saturate-150 animate-iris-fade-up"
              style={{ borderRadius: 4 }}
            >
              {/* Carbon weave */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.35]"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 4px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 4px)",
                  backgroundSize: "8px 8px",
                }}
              />
              {/* Ember signal rail — top-left bracket */}
              <span
                aria-hidden
                className="pointer-events-none absolute left-0 top-0 h-12 w-px bg-ember-400"
                style={{ boxShadow: "0 0 10px rgba(248,114,72,0.7)" }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute left-0 top-0 h-px w-12 bg-ember-400"
                style={{ boxShadow: "0 0 10px rgba(248,114,72,0.7)" }}
              />
              {/* Top hairline of light */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-px"
                style={{
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.10) 50%, transparent 100%)",
                }}
              />

              <div className="relative">
                {/* Header — TX label + orb + close */}
                <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3">
                  <div className="flex items-center gap-2.5">
                    <IrisOrb
                      size="xs"
                      state={aiPending ? "thinking" : aiError ? "alert" : "success"}
                      noHalo
                    />
                    <div className="flex flex-col leading-tight">
                      <span className="font-sans text-[13px] font-light text-platinum-50">
                        {aiPending ? "Iris" : aiError ? "Iris" : "Iris"}
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-ember-300/85">
                        {aiPending ? "Receiving…" : aiError ? "Channel error" : "Transmission"}
                      </span>
                    </div>
                  </div>
                  {!aiPending ? (
                    <button
                      type="button"
                      onClick={clearAiResponse}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-platinum-300/65 transition-colors duration-150 hover:bg-white/[0.05] hover:text-platinum-50"
                      aria-label="Clear response"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>

                {/* Body */}
                <div className="px-5 py-5 space-y-4">
                  {aiPending ? (
                    <div className="space-y-3">
                      <p className="font-mono text-[10.5px] uppercase tracking-[0.26em] text-platinum-300/70">
                        Analyzing live business data
                      </p>
                      {/* Animated ember progress bar — uses the existing
                          iris-scanline keyframe for a single sweeping band. */}
                      <div className="relative h-px w-full overflow-hidden bg-white/[0.06]">
                        <span
                          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-ember-400 to-transparent animate-iris-scanline"
                          style={{ animationDuration: "2.4s" }}
                        />
                      </div>
                    </div>
                  ) : aiError ? (
                    <div className="text-[13px] leading-relaxed text-platinum-200/85">
                      {aiError.reason === "not_configured" ? (
                        <p>
                          Iris is offline. Set{" "}
                          <code className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[11px] text-ember-200">
                            ANTHROPIC_API_KEY
                          </code>{" "}
                          in Supabase function secrets and deploy{" "}
                          <code className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[11px] text-ember-200">
                            ai-assistant
                          </code>{" "}
                          to bring her online.
                        </p>
                      ) : aiError.reason === "unauthorized" ? (
                        <p>Session expired or insufficient permissions. Please sign in again.</p>
                      ) : aiError.reason === "rate_limited" ? (
                        <p>Too many requests. Wait a moment and try again.</p>
                      ) : aiError.reason === "bad_query" ? (
                        <p>Query was empty or too large. Try a shorter question.</p>
                      ) : (
                        <p>
                          Iris ran into an issue. Try again in a moment.
                          {aiError.message ? (
                            <span className="ml-1 font-mono text-[10px] text-platinum-300/55">
                              ({aiError.reason})
                            </span>
                          ) : null}
                        </p>
                      )}
                    </div>
                  ) : aiResponse ? (
                    <>
                      <div className="space-y-2.5 text-[13.5px] leading-relaxed text-platinum-100/95">
                        {aiResponse.text.split(/\n\n+/).map((paragraph, i) => (
                          <p key={i}>{paragraph}</p>
                        ))}
                      </div>
                      {aiResponse.proposedActions.length > 0 ? (
                        <div className="space-y-1.5 pt-1">
                          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ember-300/85">
                            Proposed actions
                          </p>
                          <div className="space-y-1.5">
                            {aiResponse.proposedActions
                              .filter((a) => !resolvedActionIds.has(a.id))
                              .map((action) => (
                                <ProposedActionCard
                                  key={action.id}
                                  action={action}
                                  onResolved={(id) =>
                                    setResolvedActionIds((prev) => {
                                      const next = new Set(prev);
                                      next.add(id);
                                      return next;
                                    })
                                  }
                                />
                              ))}
                          </div>
                        </div>
                      ) : null}
                      {aiResponse.citations.length > 0 ? (
                        <div className="space-y-1.5 pt-1">
                          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-platinum-300/60">
                            Sources
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {aiResponse.citations.map((citation, i) => (
                              <ExternalSourceChip key={i} citation={citation} />
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {aiResponse.usage ? (
                        <p className="font-mono text-[9.5px] uppercase tracking-[0.22em] text-platinum-300/40 pt-1">
                          {aiResponse.usage.input_tokens + aiResponse.usage.output_tokens} tokens · {aiResponse.model}
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {/* ── Two-column intelligence grid ──────────────────────────
         *
         * All three panels share the same cinematic surface system:
         * obsidian-glass body, top hairline of light, ember rail at top-left
         * to mark them as Iris-curated, mono kicker headers.
         *
         * Color encoding by accent (rail glow + icon color):
         *   - ember:    Attention  (primary signal)
         *   - violet:   Insights   (curated observations)
         *   - sky:      Weather    (environmental)
         *   - amber:    Reviews    (time-sensitive opportunity)
         * ────────────────────────────────────────────────────────── */}
        <section className="grid gap-5 lg:grid-cols-3">
          {/* Attention column (wider) */}
          <IrisInsightPanel
            className="lg:col-span-2"
            icon={<BellRing className="h-3.5 w-3.5" />}
            kicker="Iris · Attention"
            title="Needs Attention"
            description="Live, deterministic. Every item auto-resolves the moment its underlying condition is fixed."
            accent="ember"
            action={
              visibleAttention.length > 0 ? (
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className="group/lux-link inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-platinum-200/85 transition-all duration-200 hover:border-ember-400/45 hover:bg-ember-500/10 hover:text-ember-200"
                >
                  Dashboard
                  <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover/lux-link:translate-x-0.5" />
                </button>
              ) : null
            }
          >
            {visibleAttention.length === 0 ? (
              <div
                className="relative isolate overflow-hidden rounded-md border border-dashed border-white/[0.10] bg-white/[0.015] px-4 py-8 text-center"
              >
                <IrisOrb size="sm" state="success" noHalo className="mb-3 mx-auto" />
                <p className="font-sans text-[14px] font-light text-platinum-50">
                  Inbox zero on attention items
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-platinum-300/65">
                  Nothing currently needs you. Iris is still watching in the
                  background.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {visibleAttention.slice(0, 8).map((item) => (
                  <AttentionItemRow
                    key={item.id}
                    item={item}
                    onSnooze={(id, opt) => snooze(id, opt.ms)}
                    onDismiss={dismiss}
                  />
                ))}
              </div>
            )}
          </IrisInsightPanel>

          {/* Insights column */}
          <div className="space-y-5">
            <IrisInsightPanel
              icon={<Lightbulb className="h-3.5 w-3.5" />}
              kicker="Iris · Insights"
              title="Insights"
              description={
                insights.length === 0
                  ? "Not enough history yet to surface insights."
                  : `${insights.length} observation${insights.length === 1 ? "" : "s"} from the data.`
              }
              accent="violet"
            >
              {insights.length === 0 ? (
                <p className="text-[12px] italic leading-relaxed text-platinum-300/60">
                  Once you've completed a few more jobs, Iris can start
                  surfacing pricing drift, duration drift, lead-source winners,
                  and revenue trends.
                </p>
              ) : (
                <div className="space-y-2">
                  {insights.slice(0, 4).map((insight) => (
                    <div
                      key={insight.id}
                      className="rounded-md border border-white/[0.08] bg-white/[0.02] p-3 transition-colors duration-150 hover:border-white/[0.15]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-light leading-tight text-platinum-50">
                          {insight.title}
                        </p>
                        <ConfidenceBadge
                          confidence={insight.confidence}
                          sampleSize={insight.sampleSize}
                        />
                      </div>
                      <p className="mt-1 text-[11.5px] leading-relaxed text-platinum-300/75">
                        {insight.summary}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </IrisInsightPanel>

            {/* Weather summary */}
            {weather ? (
              <IrisInsightPanel
                icon={<CloudRain className="h-3.5 w-3.5" />}
                kicker="Iris · Weather"
                title="Next 7 days"
                description={
                  weatherRiskCount > 0
                    ? `${weatherRiskCount} ${weatherRiskCount === 1 ? "day has" : "days have"} high rain risk.`
                    : "Forecast looks clear for outdoor work."
                }
                accent="sky"
              >
                <div className="grid grid-cols-7 gap-1.5">
                  {weather.days.slice(0, 7).map((d) => {
                    const risky = (d.precipitationProbabilityPct ?? 0) >= 50;
                    return (
                      <div
                        key={d.date}
                        className={cn(
                          "rounded-md border px-1 py-2 text-center transition-colors duration-150",
                          risky
                            ? "border-amber-400/40 bg-amber-500/10"
                            : "border-white/[0.08] bg-white/[0.02]",
                        )}
                        title={d.conditions}
                      >
                        <p className="font-mono text-[9px] uppercase tracking-wider text-platinum-300/55 tabular-nums">
                          {d.date.slice(5)}
                        </p>
                        <p
                          className={cn(
                            "text-[12px] font-light tabular-nums",
                            risky ? "text-amber-200" : "text-platinum-50",
                          )}
                        >
                          {d.precipitationProbabilityPct ?? "—"}%
                        </p>
                        <p className="font-mono text-[9px] text-platinum-300/55 tabular-nums">
                          {d.highF != null ? `${Math.round(d.highF)}°` : "—"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </IrisInsightPanel>
            ) : null}

            {/* Top customer reminder hook */}
            {visibleAttention.some((a) => a.type === "completed_no_review_request") ? (
              <IrisInsightPanel
                icon={<Star className="h-3.5 w-3.5" />}
                kicker="Iris · Opportunity"
                title="Reviews are time-sensitive"
                accent="amber"
                compact
              >
                <p className="text-[12px] leading-relaxed text-platinum-300/80">
                  The freshness of a job is your best asset for asking. Every
                  day past completion, the chance of a review goes down.
                </p>
              </IrisInsightPanel>
            ) : null}
          </div>
        </section>

        {/* ── Architecture footer hint ────────────────────────────── */}
        <section className="text-center pt-2">
          <p className="flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-platinum-300/45">
            <Timer className="h-3 w-3" />
            {aiResponse
              ? "Iris online · grounded in your real data + cited sources"
              : aiError?.reason === "not_configured"
                ? "Iris offline · set ANTHROPIC_API_KEY to bring her online"
                : "Grounded in your live business data · deploy ai-assistant to bring Iris online"}
          </p>
        </section>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * IrisInsightPanel — shared cinematic glass surface used by every intelligence
 * card on /iris. Encodes the panel rhythm: top hairline, top-left ember rail,
 * mono kicker → light title → description → body.
 *
 * The `accent` prop tints the rail glow + the icon. Encoding the semantic
 * tone through color rather than copy keeps the panels readable at a glance.
 * ────────────────────────────────────────────────────────────────────────── */

type AccentTone = "ember" | "violet" | "sky" | "amber";

const ACCENT_TONES: Record<
  AccentTone,
  { rail: string; railShadow: string; icon: string }
> = {
  ember: {
    rail: "bg-ember-400",
    railShadow: "0 0 10px rgba(248,114,72,0.7)",
    icon: "text-ember-300",
  },
  violet: {
    rail: "bg-violet-400",
    railShadow: "0 0 10px rgba(167,139,250,0.65)",
    icon: "text-violet-300",
  },
  sky: {
    rail: "bg-sky-400",
    railShadow: "0 0 10px rgba(56,189,248,0.65)",
    icon: "text-sky-300",
  },
  amber: {
    rail: "bg-amber-400",
    railShadow: "0 0 10px rgba(251,191,36,0.65)",
    icon: "text-amber-300",
  },
};

function IrisInsightPanel({
  className,
  icon,
  kicker,
  title,
  description,
  accent = "ember",
  action,
  compact = false,
  children,
}: {
  className?: string;
  icon: React.ReactNode;
  kicker: string;
  title: string;
  description?: string;
  accent?: AccentTone;
  action?: React.ReactNode;
  compact?: boolean;
  children: React.ReactNode;
}) {
  const tone = ACCENT_TONES[accent];
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden border border-white/10 bg-gradient-to-b from-obsidian-850/85 via-obsidian-900/90 to-obsidian-900/95 backdrop-blur-xl backdrop-saturate-150",
        className,
      )}
      style={{ borderRadius: 4 }}
    >
      {/* Carbon weave */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 4px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 4px)",
          backgroundSize: "8px 8px",
        }}
      />
      {/* Top hairline of light */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.10) 50%, transparent 100%)",
        }}
      />
      {/* Accent rail bracket — top-left */}
      <span
        aria-hidden
        className={cn("pointer-events-none absolute left-0 top-0 h-10 w-px", tone.rail)}
        style={{ boxShadow: tone.railShadow }}
      />
      <span
        aria-hidden
        className={cn("pointer-events-none absolute left-0 top-0 h-px w-10", tone.rail)}
        style={{ boxShadow: tone.railShadow }}
      />

      <div className="relative">
        <div
          className={cn(
            "flex items-start justify-between gap-3 border-b border-white/[0.06] px-5",
            compact ? "py-3" : "py-4",
          )}
        >
          <div className="min-w-0">
            <p
              className={cn(
                "inline-flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.28em]",
                tone.icon,
              )}
            >
              <span className={cn("inline-flex", tone.icon)}>{icon}</span>
              {kicker}
            </p>
            <h3
              className={cn(
                "mt-1.5 font-sans font-light leading-tight tracking-tight text-platinum-50",
                compact ? "text-[14px]" : "text-[16px]",
              )}
            >
              {title}
            </h3>
            {description ? (
              <p className="mt-1 text-[11.5px] leading-relaxed text-platinum-300/70">
                {description}
              </p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
        <div className={cn(compact ? "px-5 py-3" : "px-5 py-4")}>{children}</div>
      </div>
    </div>
  );
}
