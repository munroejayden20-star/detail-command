import * as React from "react";
import { cn } from "@/lib/utils";

interface StatProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function Stat({ label, value, hint, icon, trend, className }: StatProps) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border/80 bg-card",
        "p-5 shadow-soft",
        "transition-[box-shadow,border-color,transform] duration-normal ease-smooth",
        "hover:shadow-md hover:border-border",
        className
      )}
    >
      {/* Subtle accent line at the top — hairline, becomes visible on hover */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent opacity-0 transition-opacity group-hover:opacity-100"
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </p>
          <p className="text-[26px] font-semibold leading-none tracking-tight tabular-nums">
            {value}
          </p>
        </div>
        {icon ? (
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
              "bg-primary/10 text-primary",
              "transition-colors group-hover:bg-primary/15"
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>
      {hint ? (
        <div
          className={cn(
            "mt-3 flex items-center gap-1 text-xs",
            trend === "up" && "text-emerald-600 dark:text-emerald-400",
            trend === "down" && "text-rose-600 dark:text-rose-400",
            (!trend || trend === "neutral") && "text-muted-foreground"
          )}
        >
          {trend === "up" ? <TrendArrow direction="up" /> : null}
          {trend === "down" ? <TrendArrow direction="down" /> : null}
          <span className="truncate">{hint}</span>
        </div>
      ) : null}
    </div>
  );
}

function TrendArrow({ direction }: { direction: "up" | "down" }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className="h-2.5 w-2.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {direction === "up" ? (
        <path d="M2 8l4-4 4 4" />
      ) : (
        <path d="M2 4l4 4 4-4" />
      )}
    </svg>
  );
}
