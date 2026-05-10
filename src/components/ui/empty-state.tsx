import * as React from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden",
        "rounded-lg border border-dashed border-border/70",
        "bg-gradient-to-b from-muted/40 to-transparent",
        "px-6 py-12 text-center",
        className
      )}
    >
      {icon ? (
        <div
          className={cn(
            "mb-4 flex h-12 w-12 items-center justify-center rounded-lg",
            "border border-border/70 bg-card text-muted-foreground shadow-soft"
          )}
        >
          {icon}
        </div>
      ) : null}
      <h4 className="text-sm font-semibold leading-tight tracking-tight">
        {title}
      </h4>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
