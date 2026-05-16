/**
 * ProposedActionCard — render an action Iris wants Jayden to approve.
 *
 * Iris never executes a write action without an explicit click here. The
 * card shows the label + summary, plus an optional confirmText warning for
 * destructive operations. On approve, executeIrisAction runs and the card
 * collapses into a one-line success/failure receipt.
 */
import { useState } from "react";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useStore } from "@/store/store";
import { cn } from "@/lib/utils";
import {
  executeIrisAction,
  type IrisActionResult,
  type ProposedAction,
} from "@/lib/intelligence/iris-actions";

interface ProposedActionCardProps {
  action: ProposedAction;
  /** Called after execute (success or failure) so the parent can clean up state. */
  onResolved?: (id: string, result: IrisActionResult | { dismissed: true }) => void;
  className?: string;
}

export function ProposedActionCard({ action, onResolved, className }: ProposedActionCardProps) {
  const { data, dispatch, commit } = useStore();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IrisActionResult | { dismissed: true } | null>(null);

  async function handleApprove() {
    setBusy(true);
    const r = await executeIrisAction(action, {
      data,
      dispatch,
      commit,
      navigate: (url: string) => navigate(url),
      toast: {
        success: (m: string) => toast.success(m),
        error: (m: string) => toast.error(m),
        info: (m: string) => toast.info(m),
      },
    });
    setBusy(false);
    setResult(r);
    onResolved?.(action.id, r);
  }

  function handleDismiss() {
    const r = { dismissed: true } as const;
    setResult(r);
    onResolved?.(action.id, r);
  }

  if (result && "dismissed" in result) {
    return (
      <div
        className={cn(
          "rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground italic",
          className,
        )}
      >
        Dismissed: {action.label}
      </div>
    );
  }

  if (result && "ok" in result && result.ok) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs",
          className,
        )}
      >
        <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
        <span className="text-emerald-700 dark:text-emerald-400">{result.summary}</span>
      </div>
    );
  }

  if (result && "ok" in result && !result.ok) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-xs",
          className,
        )}
      >
        <X className="h-3.5 w-3.5 text-rose-600 shrink-0" />
        <span className="text-rose-700 dark:text-rose-400">{result.reason}</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-primary/25 bg-primary/[0.04] p-3",
        action.destructive && "border-rose-500/40 bg-rose-500/[0.04]",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
            "bg-primary/15 text-primary",
            action.destructive && "bg-rose-500/15 text-rose-600",
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{action.label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground leading-snug">{action.summary}</p>
          {action.confirmText ? (
            <p className="mt-1.5 rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1 text-[11px] text-amber-800 dark:text-amber-300">
              {action.confirmText}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-end gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleDismiss}
          disabled={busy}
          className="h-7 text-xs"
        >
          Dismiss
        </Button>
        <Button
          type="button"
          size="sm"
          variant={action.destructive ? "destructive" : "default"}
          onClick={handleApprove}
          disabled={busy}
          className="h-7 gap-1 text-xs"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          Approve
        </Button>
      </div>
    </div>
  );
}
