/* ============================================================================
 * Dashboard-local cinematic primitives.
 *
 * The DashboardPage is the one admin surface we're treating with the booking-
 * page dark/ember palette — it's the command center, glanced at constantly,
 * and a tool that looks expensive sets the tone for everything else in the
 * platform. These primitives are deliberately NOT shared with other admin
 * pages (Calendar, Customers, etc.) — those stay shadcn until/unless we
 * decide to roll the cinematic treatment further.
 *
 * Design notes:
 *   - Admin needs to read FAST. Reveals are 200ms not 850ms. No staggered
 *     content cascades. Hover responses are subtle so they don't compete
 *     with information density.
 *   - Glass blur is dialed back vs. the booking page (10-14px not 28px)
 *     because the dashboard renders inside a light shell — too much blur
 *     looks blown out, not premium.
 *   - Ember accent is reserved for *signal* (today, urgent, pending). The
 *     neutral surface reads as base; ember as "look here."
 * ========================================================================== */

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import { TrendingUp } from "lucide-react";
import { useStore } from "@/store/store";
import { appointmentsOnDay } from "@/lib/selectors";
import { cn, formatCurrency } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────────────────────
 * LuxCard — the foundational dashboard surface.
 *
 * Layered structure (back to front):
 *   1. obsidian body with faint top→bottom gradient (catches eye from top)
 *   2. carbon-weave texture at very low opacity (tactile depth without noise)
 *   3. hairline border, slightly warmer at top
 *   4. content
 *   5. optional ember corner bloom (when tone="signal")
 *
 * Three tones map to three semantic roles:
 *   - neutral: default container, what most cards are
 *   - signal:  ember-tinted, for "act here" surfaces (today, urgent)
 *   - ink:     darker, for collapsed/secondary regions
 * ──────────────────────────────────────────────────────────────────────── */

type LuxCardTone = "neutral" | "signal" | "ink";

export function LuxCard({
  children,
  tone = "neutral",
  className = "",
  interactive = false,
}: {
  children: ReactNode;
  tone?: LuxCardTone;
  className?: string;
  interactive?: boolean;
}) {
  const toneCls =
    tone === "signal"
      ? "border-ember-500/30 bg-gradient-to-b from-obsidian-850/95 via-obsidian-900/95 to-obsidian-950/95"
      : tone === "ink"
      ? "border-white/8 bg-obsidian-950/85"
      : "border-white/10 bg-gradient-to-b from-obsidian-850/90 via-obsidian-900/92 to-obsidian-900/95";

  const hoverCls = interactive
    ? "transition-colors duration-200 hover:border-white/20"
    : "";

  return (
    <div
      className={cn(
        "relative isolate overflow-hidden border backdrop-blur-[12px] backdrop-saturate-150",
        toneCls,
        hoverCls,
        className,
      )}
      style={{ borderRadius: 4 }}
    >
      {/* Carbon weave — tactile depth */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 4px), repeating-linear-gradient(-45deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 4px)",
          backgroundSize: "8px 8px",
        }}
      />
      {/* Top hairline gradient — picks up "light from above" */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            tone === "signal"
              ? "linear-gradient(90deg, transparent 0%, rgba(255,200,170,0.45) 50%, transparent 100%)"
              : "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 50%, transparent 100%)",
        }}
      />
      {/* Ember corner bloom for signal tone */}
      {tone === "signal" && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full blur-3xl"
          style={{
            background:
              "radial-gradient(circle, rgba(221,41,20,0.18) 0%, rgba(248,114,72,0.04) 40%, transparent 70%)",
          }}
        />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * LuxCardHeader / LuxCardTitle — consistent header chrome for LuxCard.
 *
 * Title uses a small mono kicker above the actual title text so the
 * hierarchy reads as: "what this card is" → "specific number / state."
 * ──────────────────────────────────────────────────────────────────────── */

export function LuxCardHeader({
  kicker,
  title,
  description,
  action,
}: {
  kicker?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
      <div className="min-w-0">
        {kicker && (
          <p className="font-mono text-[9.5px] uppercase tracking-[0.32em] text-ember-300">
            {kicker}
          </p>
        )}
        <h3 className="mt-1 font-sans text-[15px] font-light leading-tight tracking-tight text-platinum-50">
          {title}
        </h3>
        {description && (
          <p className="mt-1 text-[12px] text-platinum-300/70 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function LuxCardBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-6 py-5", className)}>{children}</div>;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * LuxStat — KPI tile.
 *
 * Big tabular-nums number, mono kicker above it, hint below. Optional
 * trend indicator (up = ember, down = muted). Click-through optional —
 * when interactive, the entire tile becomes a link with hover lift.
 * ──────────────────────────────────────────────────────────────────────── */

export function LuxStat({
  kicker,
  value,
  hint,
  icon,
  href,
  emphasis = false,
}: {
  kicker: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  href?: string;
  /** True for the headline metric in a row — slightly larger number, ember accent */
  emphasis?: boolean;
}) {
  const inner = (
    <LuxCard
      tone={emphasis ? "signal" : "neutral"}
      interactive={!!href}
      className={cn("group relative h-full", href && "cursor-pointer")}
    >
      <div className="px-5 py-5">
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.28em] text-platinum-300/70">
            {kicker}
          </p>
          {icon && (
            <span className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full border border-white/10",
              emphasis ? "text-ember-300" : "text-platinum-300/80",
            )}>
              {icon}
            </span>
          )}
        </div>
        <p className={cn(
          "mt-3 font-sans font-extralight tabular-nums leading-none text-platinum-50",
          emphasis ? "text-[34px]" : "text-[28px]",
        )}>
          {value}
        </p>
        {hint && (
          <p className="mt-2 text-[11.5px] text-platinum-300/65 leading-relaxed">
            {hint}
          </p>
        )}
      </div>
      {href && (
        <span
          aria-hidden
          className="absolute right-3 top-3 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
        >
          <ArrowRight className="h-3 w-3 text-platinum-300/70" />
        </span>
      )}
    </LuxCard>
  );

  return href ? <Link to={href}>{inner}</Link> : inner;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * LuxQuickAction — primary CTA in the hero strip.
 *
 * Small enough to fit 3 across in a dock, but full glass treatment so the
 * primary actions feel like the most important affordances on the page.
 * ──────────────────────────────────────────────────────────────────────── */

export function LuxQuickAction({
  icon,
  label,
  onClick,
  variant = "ember",
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  variant?: "ember" | "neutral";
}) {
  const isEmber = variant === "ember";
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "group/lux-action relative inline-flex items-center gap-2.5 overflow-hidden border px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.22em] backdrop-blur-md transition-all duration-200",
        isEmber
          ? "border-ember-500/35 bg-gradient-to-b from-ember-500/12 via-ember-500/8 to-ember-500/14 text-platinum-50 hover:border-ember-400/55 hover:from-ember-500/18 hover:to-ember-500/22"
          : "border-white/12 bg-white/[0.04] text-platinum-100 hover:border-white/25 hover:bg-white/[0.06]",
      )}
      style={{ borderRadius: 999 }}
    >
      {/* Top specular highlight */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full"
        style={{
          background: isEmber
            ? "linear-gradient(180deg, rgba(255,220,200,0.18) 0%, transparent 100%)"
            : "linear-gradient(180deg, rgba(255,255,255,0.14) 0%, transparent 100%)",
        }}
      />
      <span className={cn(
        "relative inline-flex h-3.5 w-3.5 items-center justify-center",
        isEmber ? "text-ember-300" : "text-platinum-300",
      )}>
        {icon}
      </span>
      <span className="relative">{label}</span>
    </motion.button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * LuxEmptyState — dashboard-flavored empty state.
 *
 * Replaces the generic shadcn EmptyState for in-card holes. Includes a
 * subtle ember tick mark to keep the eye engaged even when there's no
 * data to look at.
 * ──────────────────────────────────────────────────────────────────────── */

export function LuxEmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-platinum-300/85">
        {icon}
      </span>
      <div>
        <p className="font-sans text-[14px] font-light text-platinum-100">{title}</p>
        {description && (
          <p className="mx-auto mt-1 max-w-[34ch] text-[12px] leading-relaxed text-platinum-300/65">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * LuxRowLink — generic dark list-row container.
 *
 * Used by today's tasks and the appointment lists. Hover lifts the row
 * subtly and reveals a thin ember rail on the left.
 * ──────────────────────────────────────────────────────────────────────── */

export function LuxRow({
  children,
  className = "",
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const Comp: "div" | "button" = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "group/lux-row relative w-full overflow-hidden border-b border-white/8 px-4 py-3 text-left transition-colors duration-150 last:border-b-0 hover:bg-white/[0.025]",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-px scale-y-0 bg-ember-400/70 transition-transform duration-200 group-hover/lux-row:scale-y-100"
        style={{ transformOrigin: "center" }}
      />
      {children}
    </Comp>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * LuxSectionLink — "see more" arrow link in card headers.
 * ──────────────────────────────────────────────────────────────────────── */

export function LuxSectionLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="group/seemore inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-platinum-300/85 transition-colors hover:text-ember-300"
    >
      {label}
      <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover/seemore:translate-x-0.5" />
    </Link>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * LuxSevenDay — the week-outlook strip, dark theme.
 *
 * Each day is its own mini-tile with: weekday label, date, fill bar,
 * jobs-count, revenue-tally (when present). Today gets the ember treatment.
 * Days at capacity get an emerald flag.
 * ──────────────────────────────────────────────────────────────────────── */

export function LuxSevenDay() {
  const { data } = useStore();
  const today = new Date();
  const max = data.settings.maxJobsPerDay || 3;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const appts = appointmentsOnDay(data, d);
    const revenue = appts.reduce(
      (s, a) => s + (a.finalPrice ?? a.estimatedPrice),
      0,
    );
    return { date: d, appts, revenue };
  });

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {days.map(({ date, appts, revenue }, i) => {
        const filled = appts.length;
        const pct = Math.min(100, (filled / max) * 100);
        const isToday = i === 0;
        const isFull = filled >= max;
        return (
          <div
            key={date.toISOString()}
            className={cn(
              "relative overflow-hidden border p-3 transition-colors duration-200",
              isToday
                ? "border-ember-500/35 bg-gradient-to-b from-ember-500/8 to-ember-500/[0.04]"
                : "border-white/8 bg-obsidian-900/60 hover:border-white/15",
            )}
            style={{ borderRadius: 3 }}
          >
            <p className={cn(
              "font-mono text-[9px] uppercase tracking-[0.24em]",
              isToday ? "text-ember-300" : "text-platinum-300/65",
            )}>
              {isToday ? "Today" : format(date, "EEE")}
            </p>
            <p className="text-[13px] font-light leading-tight tabular-nums text-platinum-50">
              {format(date, "MMM d")}
            </p>
            <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  isFull
                    ? "bg-emerald-400"
                    : filled > 0
                    ? "bg-gradient-to-r from-ember-500 to-ember-300"
                    : "bg-white/10",
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1.5 font-mono text-[10px] tabular-nums text-platinum-300/65">
              {filled}/{max} jobs
            </p>
            {revenue > 0 && (
              <p
                className={cn(
                  "mt-0.5 inline-flex items-center gap-0.5 font-mono text-[10px] tabular-nums",
                  isFull ? "text-emerald-400" : "text-platinum-200/85",
                )}
              >
                <TrendingUp className="h-2.5 w-2.5" />
                {formatCurrency(revenue)}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * LuxAmbient — page-level atmosphere wrapper.
 *
 * Sits behind the dashboard content. Two soft ember orbs at extreme parallax
 * (one upper-left, one lower-right) + a faint top vignette so the corners
 * darken away. Doesn't move with scroll — purely decorative depth.
 * Disabled visually under reduced-motion via opacity drop.
 * ──────────────────────────────────────────────────────────────────────── */

export function LuxAmbient() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden motion-reduce:opacity-40"
    >
      <div
        className="absolute -left-32 -top-32 h-[55vh] w-[55vh] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(221,41,20,0.10) 0%, rgba(221,41,20,0.02) 40%, transparent 70%)",
        }}
      />
      <div
        className="absolute -right-40 bottom-0 h-[60vh] w-[60vh] rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(168,114,70,0.08) 0%, transparent 65%)",
        }}
      />
      <div className="absolute inset-x-0 top-0 h-[40vh] bg-[radial-gradient(80%_50%_at_50%_0%,rgba(15,18,24,0.4),transparent)]" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * PriorityDot — tiny semantic dot used in task rows.
 * ──────────────────────────────────────────────────────────────────────── */

export function PriorityDot({ priority }: { priority?: "high" | "medium" | "low" }) {
  const color =
    priority === "high"
      ? "bg-rose-400"
      : priority === "medium"
      ? "bg-amber-400"
      : "bg-white/25";
  return (
    <span
      aria-hidden
      className={cn("inline-block h-1.5 w-1.5 shrink-0 rounded-full", color)}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * formatTaskDate — small helper kept here so DashboardPage isn't littered.
 * ──────────────────────────────────────────────────────────────────────── */

export function formatTaskDate(iso?: string | null) {
  if (!iso) return "no due date";
  return format(parseISO(iso), "MMM d");
}
