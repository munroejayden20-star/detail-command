/**
 * MetricPill — a single live KPI tile used in the Iris panel.
 *
 * Visual: small dark card with a colored accent border, label uppercase
 * tracking-wide, value tabular-nums. Optional trend hint (up/down/neutral).
 */
import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export type MetricTrend = "up" | "down" | "neutral";

interface MetricPillProps {
  label: string;
  value: string | number;
  hint?: string;
  trend?: MetricTrend;
  icon?: ReactNode;
  /** Color accent: defaults to primary (red). */
  accent?: "primary" | "amber" | "emerald" | "sky" | "violet" | "slate";
  className?: string;
}

const ACCENT_BORDER: Record<NonNullable<MetricPillProps["accent"]>, string> = {
  primary: "border-primary/30",
  amber: "border-amber-500/30",
  emerald: "border-emerald-500/30",
  sky: "border-sky-500/30",
  violet: "border-violet-500/30",
  slate: "border-slate-500/30",
};

const ACCENT_TEXT: Record<NonNullable<MetricPillProps["accent"]>, string> = {
  primary: "text-primary",
  amber: "text-amber-500",
  emerald: "text-emerald-500",
  sky: "text-sky-500",
  violet: "text-violet-500",
  slate: "text-slate-500",
};

export function MetricPill({
  label,
  value,
  hint,
  trend,
  icon,
  accent = "primary",
  className,
}: MetricPillProps) {
  const TrendIcon = trend === "up" ? ArrowUp : trend === "down" ? ArrowDown : Minus;
  const trendColor =
    trend === "up"
      ? "text-emerald-500"
      : trend === "down"
        ? "text-rose-500"
        : "text-muted-foreground";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-card/60 px-3 py-2.5",
        "backdrop-blur-sm",
        "transition-colors duration-fast hover:bg-card/90",
        ACCENT_BORDER[accent],
        className,
      )}
    >
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        {icon ? (
          <span className={cn("inline-flex h-3.5 w-3.5", ACCENT_TEXT[accent])}>
            {icon}
          </span>
        ) : null}
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-xl font-semibold tabular-nums leading-none">
          {value}
        </span>
        {trend ? <TrendIcon className={cn("h-3 w-3", trendColor)} /> : null}
      </div>
      {hint ? (
        <p className="mt-1 text-[11px] text-muted-foreground tabular-nums leading-tight truncate">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
