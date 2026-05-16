/**
 * Recent Insights — Phase H2 dashboard surface for Iris.
 *
 * Shows current business insights computed live from store data. Hidden
 * entirely when nothing meets the minimum-sample threshold, so it stays
 * out of the way until there's something to say.
 *
 * Insights here are observational — not "do this now." Action-oriented
 * items live in NeedsAttentionCard. The recommended-action button on each
 * insight links to the page where you'd act on it (calculator, calendar,
 * etc.) but is optional.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  DollarSign,
  Lightbulb,
  Sparkles,
  Tag,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/store";
import {
  buildBusinessInsights,
  type BusinessInsight,
  type Confidence,
} from "@/lib/intelligence";

/* ─────────────────────────────────────────────
   Visuals
───────────────────────────────────────────── */

const CONFIDENCE_VISUAL: Record<
  Confidence,
  { label: string; pill: string }
> = {
  high: {
    label: "High confidence",
    pill: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  medium: {
    label: "Medium confidence",
    pill: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  low: {
    label: "Low confidence",
    pill: "border-slate-400/30 bg-slate-400/10 text-slate-700 dark:text-slate-300",
  },
};

function insightIcon(insight: BusinessInsight) {
  switch (insight.type) {
    case "pricing_drift":
      return DollarSign;
    case "duration_drift":
      return BarChart3;
    case "revenue_pace":
      return insight.metadata?.["projectionVsLastMonthRatio"] != null &&
        Number(insight.metadata["projectionVsLastMonthRatio"]) < 0
        ? TrendingDown
        : TrendingUp;
    case "average_ticket_trend":
      return insight.title.includes("down") ? TrendingDown : TrendingUp;
    case "workload_outlook":
      return Calendar;
    case "rebook_candidates":
      return Users;
    case "lead_source_winner":
      return Tag;
    default:
      return Lightbulb;
  }
}

/* ─────────────────────────────────────────────
   Component
───────────────────────────────────────────── */

const VISIBLE_LIMIT = 4;

export function RecentInsightsCard() {
  const { data } = useStore();
  const insights = useMemo(
    () => buildBusinessInsights(data, new Date()),
    [data],
  );

  // No insights → render nothing. Avoids dashboard noise when there isn't
  // enough history to say anything meaningful.
  if (insights.length === 0) return null;

  const visible = insights.slice(0, VISIBLE_LIMIT);
  const hidden = insights.length - visible.length;

  return (
    <Card className="border-violet-500/25">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-violet-500" />
              Iris · Recent Insights
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {insights.length === 1
                ? "Something the data is telling us right now."
                : `${insights.length} observations about your business right now.`}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {visible.map((insight) => (
          <InsightRow key={insight.id} insight={insight} />
        ))}
        {hidden > 0 ? (
          <p className="text-[11px] text-muted-foreground text-center pt-1">
            + {hidden} more — Iris full view coming in a later phase.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function InsightRow({ insight }: { insight: BusinessInsight }) {
  const Icon = insightIcon(insight);
  const conf = CONFIDENCE_VISUAL[insight.confidence];

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-md border border-border/80 bg-card p-3",
        "transition-colors duration-fast hover:border-border hover:bg-hover",
      )}
    >
      <div
        className={cn(
          "shrink-0 flex h-8 w-8 items-center justify-center rounded-md",
          "border border-border bg-background text-violet-600 dark:text-violet-400",
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <p className="text-sm font-semibold leading-tight">{insight.title}</p>
          <span
            className={cn(
              "rounded-full border px-1.5 py-0 text-[10px] font-medium shrink-0",
              conf.pill,
            )}
            title={
              insight.sampleSize != null
                ? `${conf.label} · ${insight.sampleSize} ${insight.sampleSize === 1 ? "sample" : "samples"}`
                : conf.label
            }
          >
            {insight.confidence}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
          {insight.summary}
        </p>
        {insight.detail ? (
          <p className="mt-1 text-[11px] text-muted-foreground/80 tabular-nums">
            {insight.detail}
          </p>
        ) : null}
      </div>

      {insight.recommendedAction?.linkUrl ? (
        <Button asChild size="sm" variant="ghost" className="shrink-0 text-xs">
          <Link to={insight.recommendedAction.linkUrl} className="gap-1">
            {insight.recommendedAction.label}
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
