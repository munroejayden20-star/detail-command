/**
 * ExternalSourceChip — small attribution pill used wherever Iris surfaces
 * a fact pulled from outside the app.
 *
 * Phase H3 ships this for use by the WeatherWatchCard and the Integrations
 * test panel. Iris uses the same component to render citations on her
 * answers, so the freshness/domain visual stays consistent across the
 * product.
 */
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ExternalSourceCitation } from "@/lib/intelligence";

const FRESHNESS_PILL: Record<ExternalSourceCitation["freshness"], string> = {
  fresh: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  recent: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  stale: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  unknown: "border-slate-400/30 bg-slate-400/10 text-slate-700 dark:text-slate-300",
};

interface ExternalSourceChipProps {
  citation: ExternalSourceCitation;
  className?: string;
  /** Show the freshness pill alongside the domain. Default true. */
  showFreshness?: boolean;
}

export function ExternalSourceChip({
  citation,
  className,
  showFreshness = true,
}: ExternalSourceChipProps) {
  return (
    <a
      href={citation.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group inline-flex items-center gap-1.5 max-w-full",
        "rounded-full border border-border bg-card pl-2 pr-2 py-0.5",
        "text-[11px] text-foreground hover:bg-hover transition-colors",
        className,
      )}
      title={`${citation.title} — ${citation.url}`}
    >
      <span className="truncate font-medium">
        {citation.domain || citation.title}
      </span>
      {showFreshness ? (
        <span
          className={cn(
            "shrink-0 rounded-full border px-1 py-0 text-[9px] font-medium uppercase tracking-wide",
            FRESHNESS_PILL[citation.freshness],
          )}
        >
          {citation.freshness}
        </span>
      ) : null}
      <ExternalLink className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
    </a>
  );
}
