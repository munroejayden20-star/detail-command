/**
 * CommandInputBar — the natural-language input at the heart of the
 * Iris panel. Phase H6 ships this as a polished UI placeholder;
 * Phase H7 wires it to the AI assistant edge function.
 *
 * Even without AI, the bar:
 *   - cycles intelligent placeholders so the page feels alive
 *   - accepts input and shows a graceful "coming in H7" response
 *   - looks identical to its eventual AI-connected form, so flipping it
 *     on later doesn't change the visual story
 */
import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Send, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const PLACEHOLDERS = [
  "What needs my attention today?",
  "Am I underpricing SUVs?",
  "Who should I follow up with this week?",
  "Explain this month's revenue.",
  "What's the weather risk this weekend?",
  "Which customers are due to rebook?",
  "Where am I leaving money on the table?",
  "Summarize everything important about this customer.",
  "What changed in the business this month?",
];

interface CommandInputBarProps {
  /** Optional handler — called with the trimmed query. */
  onSubmit?: (query: string) => void;
  /** Show provider disclaimer below the bar. */
  showH7Notice?: boolean;
  /** When true, disable submit button and show spinner. */
  isLoading?: boolean;
  className?: string;
}

export function CommandInputBar({
  onSubmit,
  showH7Notice = true,
  isLoading = false,
  className,
}: CommandInputBarProps) {
  const [value, setValue] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cycle placeholders every ~4s when the input is empty + unfocused.
  useEffect(() => {
    if (isFocused || value.length > 0) return;
    const id = window.setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDERS.length);
    }, 4000);
    return () => window.clearInterval(id);
  }, [isFocused, value.length]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit?.(trimmed);
    setValue("");
  }

  return (
    <form onSubmit={handleSubmit} className={cn("w-full", className)}>
      <div
        className={cn(
          "relative flex items-center gap-2",
          "rounded-2xl border bg-card/70 backdrop-blur-md",
          "transition-all duration-fast",
          isFocused
            ? "border-primary/40 shadow-[0_0_0_3px_hsl(var(--primary)/0.15),0_8px_28px_-4px_rgba(220,38,38,0.25)]"
            : "border-border/80 shadow-md",
        )}
      >
        {/* Inner gradient accent when focused */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-relaxed",
            isFocused && "opacity-100",
          )}
          style={{
            background:
              "linear-gradient(90deg, rgba(220,38,38,0.06) 0%, transparent 30%, transparent 70%, rgba(220,38,38,0.06) 100%)",
          }}
        />

        <div className="pl-4 text-primary shrink-0">
          <Sparkles className="h-4 w-4" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={PLACEHOLDERS[placeholderIndex]}
          aria-label="Ask Iris"
          className={cn(
            "flex-1 bg-transparent px-2 py-3.5 text-sm",
            "outline-none placeholder:text-muted-foreground",
            "tracking-tight",
          )}
        />

        <button
          type="button"
          aria-label="Voice input (coming later)"
          title="Voice input — coming soon to Iris"
          className={cn(
            "shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full",
            "text-muted-foreground/60 hover:text-muted-foreground",
            "transition-colors disabled:opacity-50",
          )}
          disabled
        >
          <Mic className="h-4 w-4" />
        </button>

        <Button
          type="submit"
          size="sm"
          disabled={!value.trim() || isLoading}
          className="mr-1.5 shrink-0 gap-1"
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Ask
        </Button>
      </div>

      {showH7Notice ? (
        <p className="mt-2 text-[11px] text-muted-foreground text-center">
          Grounded in your real business data. Provider key never leaves the server.
        </p>
      ) : null}
    </form>
  );
}
