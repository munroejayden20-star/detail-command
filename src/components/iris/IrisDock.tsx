/**
 * IrisDock — the floating, omnipresent Iris chat.
 *
 * Visible on every authenticated dashboard page. Click the orb FAB to expand
 * a small chat panel anchored to the bottom-right (mobile: full-width
 * bottom sheet). Iris knows which page you're on (via PageContext) and
 * answers in context. Proposed actions render as approve/dismiss cards.
 *
 * The /iris page itself is the full-screen experience and supersedes this —
 * the dock auto-hides when the user is already there.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useStore } from "@/store/store";
import { runAttentionRules, countByPriority } from "@/lib/intelligence";
import { askAiAssistant, type AiAssistantResponse, type AiAssistantReason } from "@/lib/intelligence/ai-assistant";
import type { ProposedAction } from "@/lib/intelligence/iris-actions";
import { useIrisPageContext } from "./PageContext";
import { suggestionsForContext } from "./suggestions";
import { IrisOrb, type OrbState } from "./IrisOrb";
import { CommandInputBar } from "./CommandInputBar";
import { ExternalSourceChip } from "@/components/intelligence/ExternalSourceChip";
import { ProposedActionCard } from "./ProposedActionCard";

interface ChatTurn {
  id: string;
  query: string;
  pending: boolean;
  response?: AiAssistantResponse;
  error?: { reason: AiAssistantReason; message?: string };
  /** Actions resolved (approved/dismissed) by id so we don't re-render them. */
  resolvedActionIds: Set<string>;
}

const HIDE_ON_PATHS = ["/iris", "/book", "/login", "/access-denied"];

export function IrisDock() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data } = useStore();
  const pageContext = useIrisPageContext();

  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Auto-hide on certain routes.
  const shouldHide = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith("/auth/")) return true;
    if (path.startsWith("/receipt/")) return true;
    if (path.startsWith("/booking/")) return true;
    return HIDE_ON_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
  }, [location.pathname]);

  // Close the dock if we navigate to a hidden route.
  useEffect(() => {
    if (shouldHide && open) setOpen(false);
  }, [shouldHide, open]);

  // Attention-driven pulse state on the FAB.
  const orbState: OrbState = useMemo(() => {
    const items = runAttentionRules(data, new Date());
    const counts = countByPriority(items);
    if (counts.critical > 0) return "alert";
    if (counts.high > 0) return "thinking";
    return "idle";
  }, [data]);

  const suggestions = useMemo(() => suggestionsForContext(pageContext), [pageContext]);

  const handleAsk = useCallback(
    async (query: string) => {
      const turnId = `turn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const pending: ChatTurn = {
        id: turnId,
        query,
        pending: true,
        resolvedActionIds: new Set(),
      };
      setTurns((t) => [...t, pending]);

      const result = await askAiAssistant(query, data, { pageContext });

      setTurns((t) =>
        t.map((tt) =>
          tt.id === turnId
            ? {
                ...tt,
                pending: false,
                response: result.ok ? result.data : undefined,
                error: !result.ok ? { reason: result.reason, message: result.message } : undefined,
              }
            : tt,
        ),
      );
    },
    [data, pageContext],
  );

  function handleActionResolved(turnId: string, actionId: string) {
    setTurns((t) =>
      t.map((tt) => {
        if (tt.id !== turnId) return tt;
        const next = new Set(tt.resolvedActionIds);
        next.add(actionId);
        return { ...tt, resolvedActionIds: next };
      }),
    );
  }

  function clearChat() {
    setTurns([]);
  }

  // Auto-scroll to bottom when new turn lands.
  useEffect(() => {
    if (!open) return;
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [turns, open]);

  if (shouldHide) return null;

  const isLoading = turns.some((t) => t.pending);

  return (
    <>
      {/* ── FAB ─────────────────────────────────────────────── */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open Iris"
          className={cn(
            "fixed z-30 right-4 md:right-6 md:!bottom-6",
            "inline-flex items-center gap-2 rounded-full pl-1.5 pr-3 py-1.5",
            "border border-primary/30 bg-card/95 backdrop-blur-md shadow-lg",
            "hover:border-primary/50 hover:shadow-xl",
            "transition-all duration-fast",
          )}
          // Mobile: sit ABOVE the bottom-nav "+" FAB (which lives at
          // ~bottom 4.5rem + safe-area). 9rem clears its 3.5rem height
          // plus a small gap. md+ uses bottom-6 via the !important class.
          style={{
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 9rem)",
          }}
        >
          <IrisOrb size="sm" state={orbState} noHalo />
          <span className="text-xs font-semibold tracking-tight">Ask Iris</span>
        </button>
      ) : null}

      {/* ── Drawer ──────────────────────────────────────────── */}
      {open ? (
        <>
          {/* Backdrop — mobile only, click to close */}
          <div
            className="fixed inset-0 z-30 bg-background/40 backdrop-blur-[1px] md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            className={cn(
              "fixed z-40",
              // Mobile: full-bottom sheet
              "inset-x-0 bottom-0 md:inset-x-auto md:bottom-6 md:right-6",
              "md:w-[420px] md:max-w-[calc(100vw-3rem)]",
              "max-h-[80vh] md:max-h-[640px]",
              "rounded-t-2xl md:rounded-2xl",
              "border border-border/80 md:border-primary/25",
              "bg-card/95 backdrop-blur-xl shadow-2xl",
              "flex flex-col overflow-hidden",
              "animate-iris-fade-up",
            )}
            role="dialog"
            aria-label="Iris"
          >
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2.5">
              <IrisOrb size="sm" state={isLoading ? "thinking" : orbState} noHalo />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight">Iris</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {pageContext?.label
                    ? `On ${pageContext.label}`
                    : "Your business assistant"}
                </p>
              </div>
              {turns.length > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-[11px]"
                  onClick={clearChat}
                >
                  Clear
                </Button>
              ) : null}
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => navigate("/iris")}
                aria-label="Open full Iris panel"
                title="Open full Iris panel"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setOpen(false)}
                aria-label="Close Iris"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Scroll area */}
            <div ref={scrollerRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
              {turns.length === 0 ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Hi — I'm Iris. Ask me anything about your business,
                    {pageContext?.label ? ` or about ${pageContext.label.toLowerCase()}` : ""}.
                    I can also propose actions for you to approve.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => handleAsk(s.prompt)}
                        className={cn(
                          "inline-flex items-center rounded-full px-3 py-1",
                          "border border-border/70 bg-card/60 text-[11px]",
                          "hover:border-primary/40 hover:bg-primary/[0.04] hover:text-foreground",
                          "transition-colors duration-fast text-foreground/80",
                        )}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                turns.map((turn) => (
                  <div key={turn.id} className="space-y-2">
                    {/* User turn */}
                    <div className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary/10 px-3 py-2 text-sm">
                        {turn.query}
                      </div>
                    </div>

                    {/* Iris turn */}
                    {turn.pending ? (
                      <div className="flex items-start gap-2">
                        <IrisOrb size="xs" state="thinking" noHalo />
                        <p className="text-xs text-muted-foreground italic animate-pulse">
                          Thinking…
                        </p>
                      </div>
                    ) : turn.error ? (
                      <div className="text-xs text-muted-foreground">
                        {turn.error.reason === "not_configured" ? (
                          <p>
                            Iris is offline. Deploy <code className="rounded bg-muted px-1 font-mono">ai-assistant</code> with{" "}
                            <code className="rounded bg-muted px-1 font-mono">ANTHROPIC_API_KEY</code> set.
                          </p>
                        ) : turn.error.reason === "unauthorized" ? (
                          <p>Session expired. Sign in again.</p>
                        ) : turn.error.reason === "rate_limited" ? (
                          <p>Too many requests. Try again shortly.</p>
                        ) : (
                          <p>Iris ran into an issue ({turn.error.reason}). Try again.</p>
                        )}
                      </div>
                    ) : turn.response ? (
                      <>
                        <div className="flex items-start gap-2">
                          <IrisOrb size="xs" state="success" noHalo />
                          <div className="min-w-0 flex-1 space-y-1.5 text-sm leading-relaxed">
                            {turn.response.text.split(/\n\n+/).map((p, i) => (
                              <p key={i}>{p}</p>
                            ))}
                          </div>
                        </div>

                        {/* Proposed actions */}
                        {turn.response.proposedActions.length > 0 ? (
                          <div className="ml-6 space-y-1.5">
                            {turn.response.proposedActions
                              .filter((a) => !turn.resolvedActionIds.has(a.id))
                              .map((action: ProposedAction) => (
                                <ProposedActionCard
                                  key={action.id}
                                  action={action}
                                  onResolved={(id) => handleActionResolved(turn.id, id)}
                                />
                              ))}
                          </div>
                        ) : null}

                        {/* Citations */}
                        {turn.response.citations.length > 0 ? (
                          <div className="ml-6 flex flex-wrap gap-1.5">
                            {turn.response.citations.map((c, i) => (
                              <ExternalSourceChip key={i} citation={c} />
                            ))}
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            {/* Input */}
            <div className="border-t border-border/70 p-2.5">
              <CommandInputBar
                onSubmit={handleAsk}
                isLoading={isLoading}
                showH7Notice={false}
              />
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
