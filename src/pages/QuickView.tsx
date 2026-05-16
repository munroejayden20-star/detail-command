/**
 * /quick — the Iris Quick View.
 *
 * Designed for the installed PWA's desktop launcher. Opens in its own
 * chromeless window with no app shell — just the orb, key intel, and a
 * direct line to Iris. "Open Full Dashboard" / "Open Full Iris" buttons
 * take the user into the real app inside the same standalone window.
 *
 * Layout target: ~520px wide. Reflows down to ~360px.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  Calendar as CalendarIcon,
  Clock,
  LayoutDashboard,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store/store";
import {
  appointmentsOnDay,
  appointmentsThisWeek,
  upcomingAppointments,
  weekRevenueEstimate,
} from "@/lib/selectors";
import { formatCurrency, cn } from "@/lib/utils";
import {
  formatBusinessTime,
  formatBusinessMonthDay,
} from "@/lib/datetime";
import {
  buildRevenuePace,
  countByPriority,
  runAttentionRules,
} from "@/lib/intelligence";
import {
  askAiAssistant,
  type AiAssistantResponse,
  type AiAssistantReason,
} from "@/lib/intelligence/ai-assistant";
import { IrisOrb, type OrbState } from "@/components/iris/IrisOrb";
import { MetricPill } from "@/components/iris/MetricPill";
import { CommandInputBar } from "@/components/iris/CommandInputBar";
import { ExternalSourceChip } from "@/components/intelligence/ExternalSourceChip";
import { isHidden, useAttentionLocalState } from "@/components/intelligence/snoozeStorage";
import type { Appointment } from "@/lib/types";

export function QuickViewPage() {
  const { data } = useStore();
  const navigate = useNavigate();
  const { state: snoozeState } = useAttentionLocalState();

  // Live clock — re-render every 30s so countdowns stay current.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Strip the body background while Quick View is mounted so the panel reads
  // as a floating widget. Restored on unmount.
  useEffect(() => {
    document.body.classList.add("quick-view-active");
    return () => document.body.classList.remove("quick-view-active");
  }, []);

  const attention = useMemo(() => runAttentionRules(data, now), [data, now]);
  const visibleAttention = useMemo(
    () => attention.filter((i) => !isHidden(i.id, snoozeState)),
    [attention, snoozeState],
  );
  const counts = useMemo(() => countByPriority(visibleAttention), [visibleAttention]);
  const pace = useMemo(() => buildRevenuePace(data, now), [data, now]);

  const todays = appointmentsOnDay(data, now);
  const week = appointmentsThisWeek(data, now);
  const weekRev = weekRevenueEstimate(data, now);
  const upcoming = upcomingAppointments(data, 1);
  const nextAppt = upcoming[0];

  // Orb state from urgency
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
    return first ? `${greeting}, ${first}` : greeting;
  }, [data.settings.ownerName, now]);

  const clockLine = useMemo(
    () =>
      now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
    [now],
  );

  // Pace
  const paceTrend: "up" | "down" | "neutral" = pace.hasEnoughDataToProject
    ? pace.projectionVsLastMonthRatio > 0.02
      ? "up"
      : pace.projectionVsLastMonthRatio < -0.02
        ? "down"
        : "neutral"
    : "neutral";
  const paceCompact = pace.hasEnoughDataToProject
    ? `${pace.projectionVsLastMonthRatio >= 0 ? "+" : ""}${(pace.projectionVsLastMonthRatio * 100).toFixed(0)}%`
    : "—";
  const paceHint = pace.hasEnoughDataToProject
    ? `proj ${formatCurrency(pace.projectedMonthEndCents / 100)}`
    : `${pace.daysElapsed}/${pace.daysInMonth} days`;

  // AI assistant
  const [aiPending, setAiPending] = useState(false);
  const [aiResponse, setAiResponse] = useState<AiAssistantResponse | null>(null);
  const [aiError, setAiError] = useState<{ reason: AiAssistantReason; message?: string } | null>(null);

  const handleSubmit = useCallback(
    async (query: string) => {
      setAiPending(true);
      setAiResponse(null);
      setAiError(null);
      const result = await askAiAssistant(query, data, {
        pageContext: { page: "other", label: "Iris Quick View" },
      });
      setAiPending(false);
      if (result.ok && result.data) {
        setAiResponse(result.data);
      } else {
        setAiError({ reason: result.reason, message: result.message });
      }
    },
    [data],
  );

  const clearAiResponse = useCallback(() => {
    setAiResponse(null);
    setAiError(null);
  }, []);

  return (
    <div className="quick-view-page relative min-h-screen text-foreground">
      <div
        className={cn(
          "relative mx-auto my-3 flex max-w-xl flex-col gap-4 px-4 py-5",
          "rounded-2xl border border-primary/40",
          "bg-background/55 backdrop-blur-xl",
          "shadow-[0_0_0_1px_hsl(var(--primary)/0.18),0_24px_60px_-12px_rgba(220,38,38,0.4)]",
        )}
        style={{
          background: `
            linear-gradient(180deg, hsl(var(--background) / 0.55) 0%, hsl(var(--background) / 0.45) 100%),
            radial-gradient(ellipse 80% 60% at 50% 0%, hsl(var(--primary) / 0.18) 0%, transparent 65%)
          `,
        }}
      >
        {/* ── Header ─────────────────────────────────────── */}
        <header className="flex items-center gap-3">
          <IrisOrb state={orbState} size="md" />
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-muted-foreground">
              Iris · Quick View
            </p>
            <p className="text-base font-semibold leading-tight truncate">
              {greetingLine}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {clockLine} · {now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="shrink-0 gap-1 text-xs"
            onClick={() => navigate("/")}
            title="Open the full dashboard"
          >
            Full app
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Button>
        </header>

        {/* ── KPI grid ───────────────────────────────────── */}
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
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
            label="Week"
            value={formatCurrency(weekRev)}
            hint={`${week.length} jobs`}
            icon={<Wallet className="h-3.5 w-3.5" />}
            accent="emerald"
          />
          <MetricPill
            label="Pace"
            value={paceCompact}
            hint={paceHint}
            trend={paceTrend}
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            accent="violet"
          />
        </section>

        {/* ── Next up ────────────────────────────────────── */}
        {nextAppt ? <NextUpCard appt={nextAppt} now={now} data={data} /> : null}

        {/* ── Attention (top 3) ──────────────────────────── */}
        <section className="rounded-lg border border-border/80 bg-card/60 backdrop-blur-sm">
          <header className="flex items-center justify-between px-3 pt-3 pb-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <BellRing className="h-3.5 w-3.5 text-primary" />
              <span className="uppercase tracking-wider">Needs attention</span>
            </div>
            {visibleAttention.length > 3 ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-[11px]"
                onClick={() => navigate("/")}
              >
                +{visibleAttention.length - 3} more
              </Button>
            ) : null}
          </header>
          <div className="p-2 pt-1">
            {visibleAttention.length === 0 ? (
              <div className="px-2 py-4 text-center">
                <p className="text-sm font-medium">Inbox zero ✓</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  Nothing currently needs you.
                </p>
              </div>
            ) : (
              <ul className="space-y-1">
                {visibleAttention.slice(0, 3).map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-2 rounded-md border border-border/70 bg-background/70 p-2"
                  >
                    <span
                      className={cn(
                        "mt-1 h-2 w-2 shrink-0 rounded-full",
                        item.priority === "critical"
                          ? "bg-rose-500"
                          : item.priority === "high"
                            ? "bg-amber-500"
                            : item.priority === "medium"
                              ? "bg-sky-500"
                              : "bg-slate-400",
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold leading-tight truncate">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug line-clamp-2">
                        {item.why}
                      </p>
                    </div>
                    {item.action?.linkUrl ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 shrink-0 gap-1 px-2 text-[11px]"
                        onClick={() => navigate(item.action!.linkUrl!)}
                      >
                        Go
                        <ArrowRight className="h-3 w-3" />
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ── Ask Iris ───────────────────────────────────── */}
        <section className="space-y-2">
          <CommandInputBar
            onSubmit={handleSubmit}
            isLoading={aiPending}
            showH7Notice={false}
          />

          {aiPending || aiResponse || aiError ? (
            <div className="rounded-lg border border-primary/20 bg-card/80 p-3 backdrop-blur-sm">
              <div className="flex items-center justify-between pb-1.5">
                <div className="flex items-center gap-1.5">
                  <IrisOrb
                    size="xs"
                    state={aiPending ? "thinking" : aiError ? "alert" : "success"}
                    noHalo
                  />
                  <span className="text-xs font-semibold">
                    {aiPending ? "Iris is thinking…" : "Iris"}
                  </span>
                </div>
                {!aiPending ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px]"
                    onClick={clearAiResponse}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>

              {aiPending ? (
                <p className="text-xs text-muted-foreground animate-pulse">
                  Analyzing your business data…
                </p>
              ) : aiError ? (
                <p className="text-xs text-muted-foreground">
                  {aiError.reason === "not_configured"
                    ? "Iris is offline. Deploy the ai-assistant function with ANTHROPIC_API_KEY to bring her online."
                    : aiError.reason === "unauthorized"
                      ? "Session expired. Please sign in again."
                      : aiError.reason === "rate_limited"
                        ? "Too many requests. Wait a moment and try again."
                        : aiError.reason === "bad_query"
                          ? "Query was empty or too long. Try a shorter question."
                          : "Iris ran into an issue. Try again in a moment."}
                </p>
              ) : aiResponse ? (
                <div className="space-y-2">
                  <div className="space-y-1.5 text-xs leading-relaxed">
                    {aiResponse.text.split(/\n\n+/).map((paragraph, i) => (
                      <p key={i}>{paragraph}</p>
                    ))}
                  </div>
                  {aiResponse.citations.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {aiResponse.citations.map((citation, i) => (
                        <ExternalSourceChip key={i} citation={citation} />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* ── Footer actions ─────────────────────────────── */}
        <footer className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="default"
            className="flex-1 gap-1.5"
            onClick={() => navigate("/")}
          >
            <LayoutDashboard className="h-4 w-4" />
            Open Full Dashboard
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1 gap-1.5"
            onClick={() => navigate("/iris")}
          >
            <IrisOrb size="xs" state="idle" noHalo />
            Full Iris
          </Button>
        </footer>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Next-up card
───────────────────────────────────────────── */

function NextUpCard({
  appt,
  now,
  data,
}: {
  appt: Appointment;
  now: Date;
  data: ReturnType<typeof useStore>["data"];
}) {
  const customer = data.customers.find((c) => c.id === appt.customerId);
  const startMs = new Date(appt.start).getTime();
  const diffMin = Math.round((startMs - now.getTime()) / 60_000);

  const countdown =
    diffMin <= 0
      ? "now"
      : diffMin < 60
        ? `in ${diffMin}m`
        : diffMin < 60 * 24
          ? `in ${Math.floor(diffMin / 60)}h ${diffMin % 60}m`
          : `in ${Math.floor(diffMin / (60 * 24))}d`;

  const vehicle = [appt.vehicle.year, appt.vehicle.make, appt.vehicle.model]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="rounded-lg border border-primary/25 bg-card/70 p-3 backdrop-blur-sm">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Clock className="h-3 w-3 text-primary" />
        Next up
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold leading-tight truncate">
          {customer?.name ?? "Unknown customer"}
        </p>
        <p className="text-xs font-medium text-primary tabular-nums shrink-0">
          {countdown}
        </p>
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
        {vehicle || "—"}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
        {formatBusinessMonthDay(appt.start)} · {formatBusinessTime(appt.start)}
      </p>
    </section>
  );
}
