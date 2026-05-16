/**
 * ConfidenceBadge — visual indicator of an Iris insight's certainty.
 * Used by AI responses (Phase H7) and the recent-insights surface (Phase H2).
 */
import { cn } from "@/lib/utils";
import type { Confidence } from "@/lib/intelligence";

const VISUAL: Record<Confidence, { label: string; cls: string }> = {
  high: {
    label: "High confidence",
    cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  medium: {
    label: "Medium confidence",
    cls: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  low: {
    label: "Low confidence",
    cls: "border-slate-400/30 bg-slate-400/10 text-slate-700 dark:text-slate-300",
  },
};

interface ConfidenceBadgeProps {
  confidence: Confidence;
  sampleSize?: number;
  className?: string;
}

export function ConfidenceBadge({ confidence, sampleSize, className }: ConfidenceBadgeProps) {
  const v = VISUAL[confidence];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide",
        v.cls,
        className,
      )}
      title={
        sampleSize != null
          ? `${v.label} · ${sampleSize} ${sampleSize === 1 ? "sample" : "samples"}`
          : v.label
      }
    >
      {confidence}
      {sampleSize != null ? <span className="opacity-60 normal-case">· {sampleSize}</span> : null}
    </span>
  );
}
