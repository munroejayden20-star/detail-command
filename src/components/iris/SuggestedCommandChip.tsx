/**
 * SuggestedCommandChip — clickable suggestion shown under the Iris
 * input bar. For Phase H6 these route to existing pages; Phase H7 will
 * convert them to AI prompts.
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface SuggestedCommandChipProps {
  label: string;
  hint?: string;
  icon?: ReactNode;
  /** Internal route the chip should navigate to. */
  linkUrl?: string;
  /** Or a custom click handler instead of navigation. */
  onClick?: () => void;
  className?: string;
}

export function SuggestedCommandChip({
  label,
  hint,
  icon,
  linkUrl,
  onClick,
  className,
}: SuggestedCommandChipProps) {
  const baseCls = cn(
    "group inline-flex items-center gap-2 rounded-full",
    "border border-border/80 bg-card/60 px-3 py-1.5",
    "text-xs font-medium leading-none",
    "transition-colors duration-fast",
    "hover:border-primary/40 hover:bg-primary/5 hover:text-foreground",
    "backdrop-blur-sm",
    className,
  );

  const inner = (
    <>
      {icon ? <span className="text-primary">{icon}</span> : null}
      <span className="truncate max-w-[200px]">{label}</span>
      {hint ? (
        <span className="text-[10px] text-muted-foreground hidden sm:inline">
          {hint}
        </span>
      ) : null}
      <ArrowUpRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
    </>
  );

  if (linkUrl) {
    return (
      <Link to={linkUrl} className={baseCls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={baseCls}>
      {inner}
    </button>
  );
}
