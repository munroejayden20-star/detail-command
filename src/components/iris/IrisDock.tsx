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
      {/* ── FAB — "Ask Iris" pill on every authenticated page ─
       *
       * Cinematic glass pill with the orb inset on the left and a mono
       * "Ask Iris" label. Ember rim glow scales with orb urgency state.
       * Sits above the BottomNav FAB on mobile (9rem clearance), bottom-6
       * on md+ via the !important class.
       * ────────────────────────────────────────────────────────── */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open Iris"
          className={cn(
            "group/iris-fab fixed z-30 right-4 md:right-6 md:!bottom-6",
            "inline-flex items-center gap-2 rounded-full pl-1.5 pr-3.5 py-1.5",
            "border border-ember-400/35 bg-obsidian-900/85 backdrop-blur-xl backdrop-saturate-150",
            "transition-all duration-200",
            "hover:border-ember-400/55 hover:bg-obsidian-900/95",
          )}
          style={{
            bottom: "calc(env(safe-area-inset-bottom, 0px) + 9rem)",
            boxShadow:
              orbState === "alert"
                ? "0 18px 40px -12px rgba(255,38,38,0.45), 0 0 24px -8px rgba(248,114,72,0.55)"
                : orbState === "thinking"
                ? "0 16px 36px -14px rgba(221,41,20,0.4), 0 0 20px -10px rgba(248,114,72,0.4)"
                : "0 14px 32px -14px rgba(0,0,0,0.55), 0 0 16px -10px rgba(248,114,72,0.3)",
          }}
        >
          <IrisOrb size="sm" state={orbState} noHalo />
          <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-platinum-100/90 transition-colors duration-200 group-hover/iris-fab:text-platinum-50">
            Ask Iris
          </span>
        </button>
      ) : null}

      {/* ── Drawer ──────────────────────────────────────────────
       *
       * Cinematic glass panel anchored bottom-right on desktop, full-width
       * bottom sheet on mobile. Top hairline of light + ember rail at top-
       * left so the drawer feels of-a-piece with the IrisPanel transmission
       * card. Header is mono-kicker rhythm. User bubbles use ember tint,
       * Iris replies hang on a left orb-anchored layout.
       * ────────────────────────────────────────────────────────── */}
      {open ? (
        <>
          {/* Backdrop — mobile only, click to close */}
          <div
            className="fixed inset-0 z-30 bg-black/55 backdrop-blur-[2px] md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            className={cn(
              "fixed z-40",
              "inset-x-0 bottom-0 md:inset-x-auto md:bottom-6 md:right-6",
              "md:w-[420px] md:max-w-[calc(100vw-3rem)]",
              "max-h-[80vh] md:max-h-[640px]",
              "relative isolate overflow-hidden",
              "border border-white/[0.08]",
              "bg-gradient-to-b from-obsidian-850/92 via-obsidian-900/95 to-obsidian-950/97",
              "backdrop-blur-2xl backdrop-saturate-150",
              "flex flex-col",
              "animate-iris-fade-up",
            )}
            role="dialog"
            aria-label="Iris"
            style={{
              borderRadius: 4,
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              boxShadow:
                "0 -20px 60px -20px rgba(0,0,0,0.7), 0 0 40px -20px rgba(248,114,72,0.25)",
            }}
          >
            {/* Carbon weave */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.30]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 4px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 4px)",
                backgroundSize: "8px 8px",
              }}
            />
            {/* Top hairline of light */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%)",
              }}
            />
            {/* Ember L-bracket — matches IrisPanel's "signal" cue */}
            <span
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 h-10 w-px bg-ember-400"
              style={{ boxShadow: "0 0 10px rgba(248,114,72,0.7)" }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute left-0 top-0 h-px w-10 bg-ember-400"
              style={{ boxShadow: "0 0 10px rgba(248,114,72,0.7)" }}
            />

            {/* Header */}
            <div className="relative flex items-center gap-2.5 border-b border-white/[0.06] px-4 py-3">
              <IrisOrb size="sm" state={isLoading ? "thinking" : orbState} noHalo />
              <div className="flex-1 min-w-0 leading-tight">
                <p className="font-sans text-[13px] font-light text-platinum-50">Iris</p>
                <p className="truncate font-mono text-[9.5px] uppercase tracking-[0.26em] text-ember-300/85">
                  {pageContext?.label ? `On ${pageContext.label}` : "Business assistant"}
                </p>
              </div>
              {turns.length > 0 ? (
                <button
                  type="button"
                  onClick={clearChat}
                  className="inline-flex h-7 items-center rounded-full border border-white/10 bg-white/[0.03] px-2.5 font-mono text-[9.5px] uppercase tracking-[0.22em] text-platinum-300/75 transition-colors duration-150 hover:border-white/20 hover:bg-white/[0.05] hover:text-platinum-50"
                >
                  Clear
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => navigate("/iris")}
                aria-label="Open full Iris panel"
                title="Open full Iris panel"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-platinum-300/70 transition-colors duration-150 hover:bg-white/[0.05] hover:text-ember-200"
              >
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close Iris"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-platinum-300/70 transition-colors duration-150 hover:bg-white/[0.05] hover:text-platinum-50"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Scroll area */}
            <div ref={scrollerRef} className="relative flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin">
              {turns.length === 0 ? (
                <div className="space-y-4">
                  <p className="text-[12.5px] leading-relaxed text-platinum-200/85">
                    Hi — I'm Iris. Ask me anything about your business
                    {pageContext?.label ? `, or about ${pageContext.label.toLowerCase()}` : ""}.
                    I can also propose actions for you to approve.
                  </p>
                  <div>
                    <p className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.28em] text-ember-300/85">
                      Suggested
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.map((s) => (
                        <button
                          key={s.label}
                          type="button"
                          onClick={() => handleAsk(s.prompt)}
                          className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.20em] text-platinum-200/85 transition-all duration-200 hover:border-ember-400/45 hover:bg-ember-500/10 hover:text-ember-200"
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                turns.map((turn) => (
                  <div key={turn.id} className="space-y-2.5">
                    {/* User turn — ember-tinted bubble, right-aligned */}
                    <div className="flex justify-end">
                      <div
                        className="relative max-w-[85%] overflow-hidden rounded-2xl rounded-br-md border border-ember-400/25 bg-ember-500/[0.12] px-3.5 py-2 text-[13px] text-platinum-50"
                        style={{ boxShadow: "inset 0 1px 0 rgba(255,220,200,0.1)" }}
                      >
                        {turn.query}
                      </div>
                    </div>

                    {/* Iris turn */}
                    {turn.pending ? (
                      <div className="flex items-start gap-2.5">
                        <IrisOrb size="xs" state="thinking" noHalo />
                        <div className="flex-1 space-y-1.5 pt-1">
                          <p className="font-mono text-[10px] uppercase tracking-[0.26em] text-ember-300/85">
                            Receiving
                          </p>
                          <div className="relative h-px w-full overflow-hidden bg-white/[0.06]">
                            <span
                              className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-ember-400 to-transparent animate-iris-scanline"
                              style={{ animationDuration: "2.4s" }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : turn.error ? (
                      <div className="flex items-start gap-2.5">
                        <IrisOrb size="xs" state="alert" noHalo />
                        <div className="flex-1 text-[12px] leading-relaxed text-platinum-200/85">
                          {turn.error.reason === "not_configured" ? (
                            <p>
                              Iris is offline. Deploy{" "}
                              <code className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10.5px] text-ember-200">
                                ai-assistant
                              </code>{" "}
                              with{" "}
                              <code className="rounded bg-white/[0.05] px-1.5 py-0.5 font-mono text-[10.5px] text-ember-200">
                                ANTHROPIC_API_KEY
                              </code>{" "}
                              set.
                            </p>
                          ) : turn.error.reason === "unauthorized" ? (
                            <p>Session expired. Sign in again.</p>
                          ) : turn.error.reason === "rate_limited" ? (
                            <p>Too many requests. Try again shortly.</p>
                          ) : (
                            <p>
                              Iris ran into an issue
                              <span className="ml-1 font-mono text-[10px] text-platinum-300/55">
                                ({turn.error.reason})
                              </span>
                              . Try again.
                            </p>
                          )}
                        </div>
                      </div>
                    ) : turn.response ? (
                      <>
                        <div className="flex items-start gap-2.5">
                          <IrisOrb size="xs" state="success" noHalo />
                          <div className="min-w-0 flex-1 space-y-2 text-[13px] leading-relaxed text-platinum-100/95">
                            {turn.response.text.split(/\n\n+/).map((p, i) => (
                              <p key={i}>{p}</p>
                            ))}
                          </div>
                        </div>

                        {/* Proposed actions */}
                        {turn.response.proposedActions.length > 0 ? (
                          <div className="ml-7 space-y-1.5">
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
                          <div className="ml-7 flex flex-wrap gap-1.5">
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
            <div className="relative border-t border-white/[0.06] bg-obsidian-950/40 p-3">
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
