/**
 * CustomerIntelligencePanel — per-customer intelligence surface.
 *
 * Drops into CustomerDetail's right column above the Vehicles card.
 * Hides entirely when `customerHighlights` returns null (no signal yet).
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  Sparkles,
  CalendarClock,
  ChevronDown,
  Copy,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfidenceBadge } from "@/components/iris/ConfidenceBadge";
import { useStore } from "@/store/store";
import {
  customerHighlights,
  draftFollowUpMessage,
} from "@/lib/intelligence/customer-intelligence";
import type { ID } from "@/lib/types";
import { cn } from "@/lib/utils";

const TIER_LABEL: Record<string, string> = {
  new: "New",
  regular: "Regular",
  high_value: "High Value",
  vip: "VIP",
};

const TIER_CLASS: Record<string, string> = {
  new: "border-slate-400/30 bg-slate-400/10 text-slate-700 dark:text-slate-300",
  regular: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  high_value: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  vip: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

const REBOOK_LABEL: Record<string, string> = {
  fresh: "Fresh",
  due: "Due for rebook",
  overdue: "Overdue",
  unknown: "Unknown",
};

const REBOOK_CLASS: Record<string, string> = {
  fresh: "text-emerald-600 dark:text-emerald-400",
  due: "text-amber-600 dark:text-amber-400",
  overdue: "text-rose-600 dark:text-rose-400",
  unknown: "text-muted-foreground",
};

type FollowUpIntent = "rebook" | "thank_you" | "checkin";

const INTENT_LABELS: Record<FollowUpIntent, string> = {
  rebook: "Rebook",
  thank_you: "Thank you",
  checkin: "Check-in",
};

interface Props {
  customerId: ID;
}

export function CustomerIntelligencePanel({ customerId }: Props) {
  const { data } = useStore();
  const [intentOpen, setIntentOpen] = useState(false);
  const [copying, setCopying] = useState<FollowUpIntent | null>(null);

  const highlights = customerHighlights(data, customerId);
  if (!highlights) return null;

  async function handleDraft(intent: FollowUpIntent) {
    const draft = draftFollowUpMessage(data, customerId, intent);
    if (!draft) {
      toast.error("Couldn't generate a draft — not enough info.");
      return;
    }
    setCopying(intent);
    try {
      await navigator.clipboard.writeText(`${draft.subject}\n\n${draft.body}`);
      toast.success(`${INTENT_LABELS[intent]} message copied to clipboard`);
    } catch {
      toast.error("Could not copy to clipboard.");
    } finally {
      setCopying(null);
      setIntentOpen(false);
    }
  }

  return (
    <Card className="border-primary/20 bg-primary/[0.02]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          Intelligence
          <span
            className={cn(
              "ml-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              TIER_CLASS[highlights.tier],
            )}
          >
            {TIER_LABEL[highlights.tier]}
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        {/* Rebook status */}
        <div className="flex items-start gap-2">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "font-medium leading-tight",
                REBOOK_CLASS[highlights.rebookStatus],
              )}
            >
              {REBOOK_LABEL[highlights.rebookStatus]}
              {highlights.daysSinceLastService != null &&
                ` · ${highlights.daysSinceLastService}d since last visit`}
            </p>
            {highlights.predictedNextRebook ? (
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                Predicted next:{" "}
                <span className="font-medium text-foreground">
                  {format(parseISO(highlights.predictedNextRebook.date), "MMM d, yyyy")}
                </span>
                <ConfidenceBadge
                  confidence={highlights.predictedNextRebook.confidence}
                  className="shrink-0"
                />
              </p>
            ) : null}
          </div>
        </div>

        {/* Top services */}
        {highlights.topServices.length > 0 ? (
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Top services
            </p>
            <div className="flex flex-wrap gap-1.5">
              {highlights.topServices.map((s) => (
                <Badge key={s.serviceId} variant="secondary" className="text-[11px]">
                  {s.serviceName}
                  <span className="ml-1 opacity-60">×{s.count}</span>
                </Badge>
              ))}
            </div>
          </div>
        ) : null}

        {/* Open balance */}
        {highlights.openBalanceCents > 0 ? (
          <p className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-700 dark:text-rose-400">
            Open balance: ${(highlights.openBalanceCents / 100).toFixed(2)}
          </p>
        ) : null}

        {/* Draft follow-up */}
        <div className="relative pt-1">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between"
            onClick={() => setIntentOpen((v) => !v)}
          >
            <span className="flex items-center gap-1.5">
              <Copy className="h-3.5 w-3.5" />
              Draft follow-up
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-150",
                intentOpen && "rotate-180",
              )}
            />
          </Button>
          {intentOpen ? (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-md border bg-popover shadow-md">
              {(["rebook", "thank_you", "checkin"] as FollowUpIntent[]).map((intent) => (
                <button
                  key={intent}
                  onClick={() => handleDraft(intent)}
                  disabled={copying === intent}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-hover disabled:opacity-50 first:rounded-t-md last:rounded-b-md"
                >
                  <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  {INTENT_LABELS[intent]}
                  {copying === intent ? (
                    <span className="ml-auto text-xs text-muted-foreground">Copying…</span>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
