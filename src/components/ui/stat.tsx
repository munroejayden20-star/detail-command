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
        "rounded-xl border bg-card p-5 shadow-soft transition-all hover:shadow-lift",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
        </div>
        {icon ? (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {icon}
          </div>
        ) : null}
      </div>
      {hint ? (
        <div className={cn(
          "mt-3 text-xs",
          trend === "up" && "text-emerald-600 dark:text-emerald-400",
          trend === "down" && "text-rose-600 dark:text-rose-400",
          (!trend || trend === "neutral") && "text-muted-foreground"
        )}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}
