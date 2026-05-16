/**
 * BusinessPulseCard — dashboard hero summarizing the state of the business
 * with the Iris orb at its heart. Click → /iris.
 *
 * Acts as a "weather report" for the whole business: what the orb is doing
 * right now (idle / thinking / alert) tells you the day's vibe at a glance.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Brain, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store/store";
import { cn, formatCurrency } from "@/lib/utils";
import {
  buildBusinessInsights,
  buildRevenuePace,
  countByPriority,
  runAttentionRules,
} from "@/lib/intelligence";
import {
  appointmentsOnDay,
  appointmentsThisWeek,
  weekRevenueEstimate,
} from "@/lib/selectors";
import { IrisOrb, type OrbState } from "./IrisOrb";

export function BusinessPulseCard() {
  const { data } = useStore();
  const navigate = useNavigate();

  const today = useMemo(() => new Date(), []);
  const attention = useMemo(() => runAttentionRules(data, today), [data, today]);
  const insights = useMemo(() => buildBusinessInsights(data, today), [data, today]);
  const counts = useMemo(() => countByPriority(attention), [attention]);
  const pace = useMemo(() => buildRevenuePace(data, today), [data, today]);
  const todays = appointmentsOnDay(data, today);
  const week = appointmentsThisWeek(data, today);
  const weekRev = weekRevenueEstimate(data, today);

  const orbState: OrbState =
    counts.critical > 0 ? "alert" : counts.high > 0 ? "thinking" : "idle";

  // One-line headline that reads naturally.
  const headline = useMemo(() => {
    const parts: string[] = [];
    if (todays.length > 0) {
      parts.push(`${todays.length} job${todays.length === 1 ? "" : "s"} today`);
    } else {
      parts.push("No jobs today");
    }
    const att = counts.critical + counts.high + counts.medium;
    if (att > 0) {
      parts.push(`${att} need${att === 1 ? "s" : ""} you`);
    }
    if (week.length > 0) {
      parts.push(`${formatCurrency(weekRev)} this week`);
    }
    return parts.join(" · ");
  }, [counts, todays.length, week.length, weekRev]);

  const detail = useMemo(() => {
    if (counts.critical > 0) {
      return "A critical item is waiting on you. Iris can show you what to do first.";
    }
    if (counts.high > 0) {
      return "A few high-priority items need your eyes today.";
    }
    if (insights.length > 0) {
      return `Everything's caught up. ${insights.length} new ${insights.length === 1 ? "insight is" : "insights are"} ready when you want to look.`;
    }
    if (pace.hasEnoughDataToProject) {
      return `On pace for ${formatCurrency(pace.projectedMonthEndCents / 100)} this month.`;
    }
    return "Iris is watching every part of the business.";
  }, [counts, insights.length, pace]);

  return (
    <button
      type="button"
      onClick={() => navigate("/iris")}
      className={cn(
        "group relative w-full overflow-hidden rounded-xl border border-primary/20 bg-card text-left",
        "transition-all duration-relaxed hover:border-primary/40 hover:shadow-lift",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
    >
      {/* Ambient red glow behind the orb */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-12 h-56 w-56 rounded-full opacity-60"
        style={{
          background: "radial-gradient(circle, hsl(var(--primary) / 0.2) 0%, transparent 65%)",
        }}
      />

      <div className="relative flex items-center gap-5 p-5 sm:gap-6 sm:p-6">
        <div className="shrink-0">
          <IrisOrb state={orbState} size="md" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <Brain className="h-3 w-3 text-primary" />
            Iris · Business Pulse
          </div>
          <p className="mt-1 text-base sm:text-lg font-semibold leading-tight tracking-tight">
            {headline}
          </p>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {detail}
          </p>
        </div>

        <div className="hidden sm:flex shrink-0">
          <Button
            asChild
            size="sm"
            variant="outline"
            className="group-hover:border-primary/40 group-hover:text-primary"
          >
            <span className="gap-1">
              Open
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-fast group-hover:translate-x-0.5" />
            </span>
          </Button>
        </div>
      </div>

      {/* Subtle motion bar at the bottom — adds life without being noisy */}
      <div
        aria-hidden
        className="relative h-0.5 w-full overflow-hidden bg-border/40"
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-1/3",
            counts.critical > 0
              ? "bg-rose-500"
              : counts.high > 0
                ? "bg-amber-500"
                : insights.length > 0
                  ? "bg-violet-500"
                  : "bg-primary",
            "animate-shimmer",
          )}
          style={{
            backgroundSize: "200% 100%",
            backgroundImage:
              counts.critical > 0
                ? "linear-gradient(90deg, transparent 0%, rgb(244 63 94) 50%, transparent 100%)"
                : counts.high > 0
                  ? "linear-gradient(90deg, transparent 0%, rgb(245 158 11) 50%, transparent 100%)"
                  : insights.length > 0
                    ? "linear-gradient(90deg, transparent 0%, rgb(139 92 246) 50%, transparent 100%)"
                    : "linear-gradient(90deg, transparent 0%, hsl(var(--primary)) 50%, transparent 100%)",
            width: "100%",
          }}
        />
      </div>

      {/* Sparkle accent */}
      {insights.length > 0 ? (
        <div className="absolute right-4 top-4 hidden sm:flex items-center gap-1 text-[10px] font-medium text-violet-500">
          <Sparkles className="h-3 w-3" />
          {insights.length} new
        </div>
      ) : null}
    </button>
  );
}
