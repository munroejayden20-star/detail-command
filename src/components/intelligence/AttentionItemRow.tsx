/**
 * A single attention item row, used inside NeedsAttentionCard.
 *
 * Visual rules:
 *   - left edge accent stripe colored by priority (rose/amber/blue/slate)
 *   - title + why on first two lines
 *   - primary action button on the right
 *   - tertiary actions (snooze, dismiss) hidden until hover on desktop,
 *     always visible on mobile so they're reachable
 */
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  Check,
  Clock,
  DollarSign,
  Lightbulb,
  Settings as SettingsIcon,
  Star,
  Tag,
  Timer,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AttentionItem, AttentionPriority } from "@/lib/intelligence";
import {
  SNOOZE_OPTIONS,
  type SnoozeOption,
} from "./snoozeStorage";
import { useState } from "react";

/* ─────────────────────────────────────────────
   Visuals — priority + category to icon/color
───────────────────────────────────────────── */

const PRIORITY_VISUAL: Record<
  AttentionPriority,
  { stripe: string; pill: string; label: string }
> = {
  critical: {
    stripe: "bg-rose-500",
    pill: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    label: "Critical",
  },
  high: {
    stripe: "bg-amber-500",
    pill: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    label: "High",
  },
  medium: {
    stripe: "bg-blue-500",
    pill: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    label: "Medium",
  },
  low: {
    stripe: "bg-slate-400",
    pill: "border-slate-400/30 bg-slate-400/10 text-slate-700 dark:text-slate-300",
    label: "Low",
  },
  insight: {
    stripe: "bg-violet-500",
    pill: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    label: "Insight",
  },
};

function categoryIcon(item: AttentionItem) {
  // Type-specific icon overrides for the highest-signal items.
  switch (item.type) {
    case "deposit_paid_unapproved":
    case "receipt_open_balance":
      return DollarSign;
    case "completed_no_review_request":
      return Star;
    case "completed_no_receipt":
    case "completed_no_final_price":
      return Check;
    case "job_timer_stalled":
    case "in_progress_overrun":
      return Timer;
    case "lead_uncontacted":
    case "lead_followup_due":
      return UserPlus;
    case "lead_going_cold":
      return Bell;
    case "customer_overdue_rebook":
    case "high_value_dormant":
      return Users;
    case "discount_expiring":
    case "discount_expired":
      return Tag;
    case "sales_tax_no_rate":
      return SettingsIcon;
    case "pending_booking_stale":
      return Calendar;
  }
  // Fallback by category
  switch (item.category) {
    case "bookings":
      return Calendar;
    case "jobs":
      return Clock;
    case "customers":
      return Users;
    case "leads":
      return UserPlus;
    case "finance":
      return DollarSign;
    case "operations":
      return SettingsIcon;
    case "external":
      return Lightbulb;
    default:
      return AlertTriangle;
  }
}

/* ─────────────────────────────────────────────
   Component
───────────────────────────────────────────── */

interface AttentionItemRowProps {
  item: AttentionItem;
  onSnooze: (id: string, option: SnoozeOption) => void;
  onDismiss: (id: string) => void;
}

export function AttentionItemRow({ item, onSnooze, onDismiss }: AttentionItemRowProps) {
  const visual = PRIORITY_VISUAL[item.priority];
  const Icon = categoryIcon(item);
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  return (
    <div
      className={cn(
        "group relative flex items-stretch overflow-hidden",
        "rounded-md border border-border/80 bg-card",
        "transition-colors duration-fast hover:border-border hover:bg-hover",
      )}
    >
      {/* Priority stripe */}
      <div className={cn("w-1 shrink-0", visual.stripe)} aria-hidden />

      {/* Body */}
      <div className="flex-1 min-w-0 p-3 flex items-start gap-3">
        <div
          className={cn(
            "shrink-0 flex h-8 w-8 items-center justify-center rounded-md",
            "border border-border bg-background text-muted-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold leading-tight">{item.title}</p>
            <span
              className={cn(
                "rounded-full border px-1.5 py-0 text-[10px] font-medium",
                visual.pill,
              )}
            >
              {visual.label}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {item.why}
          </p>
          {item.detail ? (
            <p className="mt-1 text-[11px] text-muted-foreground/80 tabular-nums">
              {item.detail}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 flex flex-col items-end gap-1.5">
          {item.action ? (
            item.action.linkUrl ? (
              <Button asChild size="sm" variant="outline">
                <Link to={item.action.linkUrl} className="gap-1">
                  {item.action.label}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            ) : (
              <Button size="sm" variant="outline" disabled>
                {item.action.label}
              </Button>
            )
          ) : null}

          <div className="relative flex items-center gap-1 opacity-70 sm:opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={() => setSnoozeOpen((v) => !v)}
              className={cn(
                "h-7 px-2 inline-flex items-center gap-1 rounded-md",
                "text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground",
                "transition-colors",
              )}
              aria-label="Snooze"
            >
              <Clock className="h-3 w-3" />
              Snooze
            </button>
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              className={cn(
                "h-7 w-7 inline-flex items-center justify-center rounded-md",
                "text-muted-foreground hover:bg-accent hover:text-foreground",
                "transition-colors",
              )}
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </button>
            {snoozeOpen ? (
              <div
                className={cn(
                  "absolute right-0 top-8 z-10 min-w-[140px]",
                  "rounded-md border border-border bg-card shadow-md",
                  "py-1 text-xs",
                )}
              >
                {SNOOZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => {
                      onSnooze(item.id, opt);
                      setSnoozeOpen(false);
                    }}
                    className="block w-full px-3 py-1.5 text-left hover:bg-accent"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
