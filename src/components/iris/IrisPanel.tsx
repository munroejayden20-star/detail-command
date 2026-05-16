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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
      {/* ── HUD background: radial glows + drifting grid + scanline ── */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 80% 50% at 0% 0%, hsl(var(--primary) / 0.10) 0%, transparent 60%),
              radial-gradient(ellipse 80% 50% at 100% 0%, hsl(var(--primary) / 0.08) 0%, transparent 60%),
              radial-gradient(ellipse 100% 60% at 50% 100%, hsl(var(--primary) / 0.06) 0%, transparent 70%)
            `,
          }}
        />
        {/* Faint grid that drifts diagonally */}
        <div
          className="absolute inset-0 opacity-[0.06] animate-iris-grid-drift"
          style={{
            backgroundImage: `
              linear-gradient(hsl(var(--primary) / 0.7) 1px, transparent 1px),
              linear-gradient(90deg, hsl(var(--primary) / 0.7) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />
        {/* Scanline sweep */}
        <div
          className="absolute inset-x-0 h-40 animate-iris-scanline mix-blend-screen"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, hsl(var(--primary) / 0.08) 50%, transparent 100%)",
          }}
        />
      </div>

      <div className="relative z-0 mx-auto max-w-5xl space-y-8 pb-12">
        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="flex flex-col items-center text-center pt-4 sm:pt-6">
          {/* Greeting / brand line */}
          <div
            className="font-mono text-[10px] sm:text-[11px] tracking-[0.22em] uppercase text-foreground/55 animate-iris-fade-up"
            style={{ animationDelay: "0ms" }}
          >
            <span className="text-foreground/85">{greetingLine}</span>
            <span className="ml-2 text-foreground/30 hidden sm:inline">
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

        {/* ── AI assistant response ────────────────────────────────── */}
        {(aiPending || aiResponse || aiError) ? (
          <section className="mx-auto w-full max-w-2xl">
            <Card className="border-primary/20 bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <IrisOrb
                      size="xs"
                      state={aiPending ? "thinking" : aiError ? "alert" : "success"}
                      noHalo
                    />
                    <span className="text-sm font-semibold">
                      {aiPending ? "Iris is thinking…" : aiError ? "Iris" : "Iris"}
                    </span>
                  </div>
                  {!aiPending ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={clearAiResponse}
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                      aria-label="Clear response"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {aiPending ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="animate-pulse">Analyzing your business data…</span>
                  </div>
                ) : aiError ? (
                  <div className="text-sm text-muted-foreground">
                    {aiError.reason === "not_configured" ? (
                      <p>
                        Iris is offline. Set{" "}
                        <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
                          ANTHROPIC_API_KEY
                        </code>{" "}
                        in Supabase function secrets and deploy{" "}
                        <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
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
                          <span className="ml-1 text-xs opacity-60">({aiError.reason})</span>
                        ) : null}
                      </p>
                    )}
                  </div>
                ) : aiResponse ? (
                  <>
                    <div className="space-y-2 text-sm leading-relaxed">
                      {aiResponse.text.split(/\n\n+/).map((paragraph, i) => (
                        <p key={i}>{paragraph}</p>
                      ))}
                    </div>
                    {aiResponse.proposedActions.length > 0 ? (
                      <div className="space-y-1.5 pt-1">
                        <p className="mb-1.5 text-[11px] text-muted-foreground uppercase tracking-wider">
                          Proposed actions
                        </p>
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
                    ) : null}
                    {aiResponse.citations.length > 0 ? (
                      <div className="pt-1">
                        <p className="mb-1.5 text-[11px] text-muted-foreground uppercase tracking-wider">
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
                      <p className="text-[10px] text-muted-foreground/50 pt-1">
                        {aiResponse.usage.input_tokens + aiResponse.usage.output_tokens} tokens · {aiResponse.model}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </CardContent>
            </Card>
          </section>
        ) : null}

        {/* ── Two-column intelligence grid ────────────────────────── */}
        <section className="grid gap-5 lg:grid-cols-3">
          {/* Attention column (wider) */}
          <Card className="lg:col-span-2 border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <BellRing className="h-4 w-4 text-primary" />
                  Needs Attention
                </CardTitle>
                {visibleAttention.length > 0 ? (
                  <Button asChild size="sm" variant="ghost" className="text-xs">
                    <button
                      type="button"
                      onClick={() => navigate("/")}
                      className="gap-1"
                    >
                      Dashboard
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Live, deterministic — every item auto-resolves the moment its
                underlying condition is fixed.
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {visibleAttention.length === 0 ? (
                <div className="rounded-md border border-dashed border-border/70 bg-muted/30 px-4 py-8 text-center">
                  <IrisOrb size="sm" state="success" noHalo className="mb-3 mx-auto" />
                  <p className="text-sm font-semibold">
                    Inbox zero on attention items
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Nothing currently needs you. Iris is still watching in the
                    background.
                  </p>
                </div>
              ) : (
                visibleAttention.slice(0, 8).map((item) => (
                  <AttentionItemRow
                    key={item.id}
                    item={item}
                    onSnooze={(id, opt) => snooze(id, opt.ms)}
                    onDismiss={dismiss}
                  />
                ))
              )}
            </CardContent>
          </Card>

          {/* Insights column */}
          <div className="space-y-5">
            <Card className="border-violet-500/25">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Lightbulb className="h-4 w-4 text-violet-500" />
                  Insights
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {insights.length === 0
                    ? "Not enough history yet to surface insights."
                    : `${insights.length} observation${insights.length === 1 ? "" : "s"} from the data.`}
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {insights.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Once you've completed a few more jobs, Iris can start
                    surfacing pricing drift, duration drift, lead-source winners,
                    and revenue trends.
                  </p>
                ) : (
                  insights.slice(0, 4).map((insight) => (
                    <div
                      key={insight.id}
                      className="rounded-md border border-border/80 bg-card/60 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-tight">
                          {insight.title}
                        </p>
                        <ConfidenceBadge
                          confidence={insight.confidence}
                          sampleSize={insight.sampleSize}
                        />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {insight.summary}
                      </p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Weather summary */}
            {weather ? (
              <Card className="border-sky-500/25">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CloudRain className="h-4 w-4 text-sky-500" />
                    Weather (next 7d)
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {weatherRiskCount > 0
                      ? `${weatherRiskCount} ${weatherRiskCount === 1 ? "day has" : "days have"} high rain risk.`
                      : "Forecast looks clear for outdoor work."}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-1.5">
                    {weather.days.slice(0, 7).map((d) => {
                      const risky = (d.precipitationProbabilityPct ?? 0) >= 50;
                      return (
                        <div
                          key={d.date}
                          className={cn(
                            "rounded-md border px-1 py-2 text-center",
                            risky
                              ? "border-amber-500/40 bg-amber-500/10"
                              : "border-border/60 bg-card",
                          )}
                          title={d.conditions}
                        >
                          <p className="text-[9px] text-muted-foreground tabular-nums">
                            {d.date.slice(5)}
                          </p>
                          <p className={cn("text-[11px] font-semibold tabular-nums", risky && "text-amber-700 dark:text-amber-300")}>
                            {d.precipitationProbabilityPct ?? "—"}%
                          </p>
                          <p className="text-[9px] text-muted-foreground tabular-nums">
                            {d.highF != null ? `${Math.round(d.highF)}°` : "—"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* Top customer reminder hook */}
            {visibleAttention.some((a) => a.type === "completed_no_review_request") ? (
              <Card className="border-amber-500/25">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Star className="h-4 w-4 text-amber-500" />
                    Reviews are time-sensitive
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    The freshness of a job is your best asset for asking. Every
                    day past completion, the chance of a review goes down.
                  </p>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </section>

        {/* ── Architecture footer hint ────────────────────────────── */}
        <section className="text-center pt-2">
          <p className="text-[11px] text-muted-foreground italic flex items-center justify-center gap-2">
            <Timer className="h-3 w-3" />
            {aiResponse
              ? "Iris is online — answers grounded in your real data + cited external sources."
              : aiError?.reason === "not_configured"
                ? "Iris is offline — set ANTHROPIC_API_KEY to bring her online. Intelligence data is live."
                : "Grounded in your live business data. Deploy ai-assistant to bring Iris online."}
          </p>
        </section>
      </div>
    </div>
  );
}
