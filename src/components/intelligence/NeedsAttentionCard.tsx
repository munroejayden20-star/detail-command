/**
 * Needs Attention — Phase 1 dashboard surface for Iris.
 *
 * Computes attention items live from store data on every render. Items are
 * filtered against snooze/dismiss state in localStorage. When the underlying
 * condition is fixed, the rule no longer emits the item, so it auto-resolves
 * from the UI without any cleanup code.
 *
 * Visual identity is intentionally kept consistent with the existing
 * dashboard (BookingRequests / ReviewsDueWidget). The Phase 6 work
 * introduces the animated Iris orb that ties these into a unified
 * intelligence surface.
 */
import { useMemo, useState } from "react";
import { Brain, ChevronDown, RotateCcw, Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/store";
import {
  countByPriority,
  runAttentionRules,
} from "@/lib/intelligence";
import {
  isHidden,
  useAttentionLocalState,
} from "./snoozeStorage";
import { AttentionItemRow } from "./AttentionItemRow";

const COLLAPSED_LIMIT = 5;

export function NeedsAttentionCard() {
  const { data } = useStore();
  const { state, snooze, dismiss, clear, reset } = useAttentionLocalState();
  const [expanded, setExpanded] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  // Recompute on every render — attention is stateless. Items are
  // deterministic for a given (data, now), so React can skip work via memo.
  const allItems = useMemo(() => runAttentionRules(data, new Date()), [data]);

  const visible = useMemo(
    () => allItems.filter((i) => !isHidden(i.id, state)),
    [allItems, state],
  );

  const hiddenCount = allItems.length - visible.length;
  const counts = useMemo(() => countByPriority(visible), [visible]);
  const headlineSummary = useMemo(() => buildHeadline(counts), [counts]);

  // Render nothing when there's truly nothing to do — keeps the dashboard
  // calm. The reset button under the empty state covers the rare case
  // someone wants to un-snooze items.
  if (allItems.length === 0) {
    return (
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-primary" />
            Iris · Needs Attention
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Watching bookings, jobs, customers, leads, and finance.
          </p>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={<Sparkles className="h-5 w-5" />}
            title="Nothing needs your attention right now"
            description="When something needs you — a stale booking, an unsent receipt, a customer due to rebook — it'll show up here."
          />
        </CardContent>
      </Card>
    );
  }

  const itemsToRender = expanded ? visible : visible.slice(0, COLLAPSED_LIMIT);

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-primary" />
              Iris · Needs Attention
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {headlineSummary}
            </p>
          </div>
          {hiddenCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowHidden((v) => !v)}
              className="shrink-0 text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              {showHidden ? "Hide" : "Show"} {hiddenCount} snoozed/dismissed
            </button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {visible.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-5 w-5" />}
            title="You're caught up"
            description={
              hiddenCount > 0
                ? `${hiddenCount} ${hiddenCount === 1 ? "item is" : "items are"} snoozed or dismissed.`
                : "Nothing currently needs you."
            }
            action={
              hiddenCount > 0 ? (
                <Button size="sm" variant="outline" onClick={reset}>
                  Reset snoozed
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            {itemsToRender.map((item) => (
              <AttentionItemRow
                key={item.id}
                item={item}
                onSnooze={(id, opt) => snooze(id, opt.ms)}
                onDismiss={dismiss}
              />
            ))}

            {visible.length > COLLAPSED_LIMIT ? (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className={cn(
                  "w-full mt-2 inline-flex items-center justify-center gap-1.5",
                  "rounded-md border border-dashed border-border/70 bg-muted/40",
                  "py-2 text-xs font-medium text-muted-foreground",
                  "hover:bg-muted hover:text-foreground transition-colors",
                )}
              >
                {expanded
                  ? "Show fewer"
                  : `Show ${visible.length - COLLAPSED_LIMIT} more`}
                <ChevronDown
                  className={cn(
                    "h-3.5 w-3.5 transition-transform duration-fast",
                    expanded && "rotate-180",
                  )}
                />
              </button>
            ) : null}
          </>
        )}

        {showHidden && hiddenCount > 0 ? (
          <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Snoozed · dismissed ({hiddenCount})
            </p>
            {allItems
              .filter((i) => isHidden(i.id, state))
              .map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2"
                >
                  <p className="text-xs text-muted-foreground truncate">
                    {item.title}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => clear(item.id)}
                    className="shrink-0 h-7 text-[11px]"
                  >
                    Restore
                  </Button>
                </div>
              ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────
   Headline copy
───────────────────────────────────────────── */

function buildHeadline(counts: Record<string, number>): string {
  const parts: string[] = [];
  if (counts.critical > 0) parts.push(`${counts.critical} critical`);
  if (counts.high > 0) parts.push(`${counts.high} high`);
  if (counts.medium > 0) parts.push(`${counts.medium} medium`);
  if (counts.low > 0) parts.push(`${counts.low} low`);
  if (counts.insight > 0) parts.push(`${counts.insight} insight${counts.insight === 1 ? "" : "s"}`);
  if (parts.length === 0) return "Nothing pressing right now.";
  return parts.join(" · ");
}
