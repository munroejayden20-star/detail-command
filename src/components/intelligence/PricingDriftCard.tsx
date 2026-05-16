/**
 * PricingDriftCard — advisory pricing drift indicator for the Calculator page.
 *
 * Accepts serviceId + vehicleSize props. Renders a warning when
 * `buildCalculatorDrift` finds a statistically significant deviation between
 * the calculator's estimated prices and historical actuals.
 *
 * Advisory only — this component never applies changes to settings.
 */
import { TrendingUp } from "lucide-react";
import { ConfidenceBadge } from "@/components/iris/ConfidenceBadge";
import { useStore } from "@/store/store";
import { buildCalculatorDrift } from "@/lib/intelligence/pricing-intelligence";
import type { ID } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  serviceId: ID;
  vehicleSize?: string;
}

export function PricingDriftCard({ serviceId, vehicleSize }: Props) {
  const { data } = useStore();

  const warning = buildCalculatorDrift(data, serviceId, vehicleSize);
  if (!warning) return null;

  const isUnderquoting = warning.patternDeltaCents > 0;
  const absDollars = (Math.abs(warning.patternDeltaCents) / 100).toFixed(0);
  const directionLabel = isUnderquoting ? "underquoting" : "overquoting";

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2.5 text-sm",
        isUnderquoting
          ? "border-amber-500/30 bg-amber-500/10"
          : "border-blue-500/30 bg-blue-500/10",
      )}
    >
      <div className="flex items-start gap-2">
        <TrendingUp
          className={cn(
            "mt-0.5 h-4 w-4 shrink-0",
            isUnderquoting
              ? "text-amber-600 dark:text-amber-400"
              : "text-blue-600 dark:text-blue-400",
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "font-semibold",
                isUnderquoting
                  ? "text-amber-700 dark:text-amber-300"
                  : "text-blue-700 dark:text-blue-300",
              )}
            >
              Calculator drift
            </span>
            <ConfidenceBadge
              confidence={warning.confidence}
              sampleSize={warning.sampleSize}
            />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Historically {directionLabel} by ~${absDollars} on this combination.
          </p>
          <p className="mt-1 text-[11px] font-medium text-foreground/80">
            Suggestion: multiply current price by{" "}
            <span className="font-semibold tabular-nums">
              {warning.suggestedMultiplier.toFixed(2)}×
            </span>{" "}
            — advisory only.
          </p>
        </div>
      </div>
    </div>
  );
}
