/* ============================================================================
 * Shared atomic UI pieces — input chrome, toggles, condition selectors,
 * quantity stepper, expandable description, step header.
 *
 * Premium input style: hairline border, lowercased mono label above, ember
 * focus ring on caret. No "outlined" boxes everywhere.
 * ========================================================================== */

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Minus, Plus } from "lucide-react";

export const inputCls =
  "block w-full appearance-none rounded-none border-b border-white/20 bg-transparent py-2.5 text-[15px] text-platinum-50 placeholder:text-platinum-300/40 outline-none transition-all focus:border-ember-400 focus:[box-shadow:inset_0_-1px_0_rgba(248,114,72,0.7)]";

export function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/80">
        {label} {required ? <span className="text-ember-300">*</span> : null}
      </span>
      <div className="mt-2">{children}</div>
      {hint ? <span className="mt-1.5 block font-mono text-[10.5px] tracking-[0.16em] text-platinum-300/55">{hint}</span> : null}
    </label>
  );
}

export function SelectChips<T extends string>({
  options,
  value,
  onChange,
  cols = 3,
}: {
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
  cols?: 2 | 3 | 4;
}) {
  const colCls = cols === 4 ? "grid-cols-2 md:grid-cols-4" : cols === 3 ? "grid-cols-3" : "grid-cols-2";
  return (
    <div className={`grid gap-2 ${colCls}`}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`group relative overflow-hidden border px-4 py-3 text-left transition-all ${
              active
                ? "border-ember-400/70 bg-ember-500/[0.08]"
                : "border-white/12 bg-white/[0.02] hover:border-white/25"
            }`}
            style={{ borderRadius: 2 }}
          >
            {active && (
              <span
                aria-hidden
                className="absolute inset-0 bg-gradient-to-br from-ember-500/10 via-transparent to-transparent"
              />
            )}
            <span className={`relative font-sans text-[14px] font-normal ${active ? "text-platinum-50" : "text-platinum-100"}`}>
              {o.label}
            </span>
            {o.hint ? (
              <span className="relative mt-0.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-platinum-300/65">
                {o.hint}
              </span>
            ) : null}
            <span
              aria-hidden
              className={`absolute bottom-0 left-0 h-px bg-ember-400 transition-all duration-500 ${active ? "w-full" : "w-0 group-hover:w-1/3"}`}
            />
          </button>
        );
      })}
    </div>
  );
}

export function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="group flex w-full items-center justify-between gap-4 border-b border-white/10 py-4 text-left transition-colors hover:bg-white/[0.02]"
    >
      <span>
        <span className="block font-sans text-[14.5px] text-platinum-50">{label}</span>
        {hint ? <span className="mt-0.5 block font-mono text-[10.5px] uppercase tracking-[0.22em] text-platinum-300/70">{hint}</span> : null}
      </span>
      <span
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${
          checked ? "border-ember-400/70 bg-ember-500/30" : "border-white/15 bg-white/[0.03]"
        }`}
      >
        <motion.span
          className={`absolute top-0.5 h-6 w-6 rounded-full ${checked ? "bg-ember-300 shadow-[0_0_18px_rgba(248,114,72,0.6)]" : "bg-platinum-200"}`}
          animate={{ x: checked ? 20 : 2 }}
          transition={{ type: "spring", stiffness: 380, damping: 26 }}
        />
      </span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * QuantityStepper — compact +/- control used inside add-on rows.
 *
 * Reasoning for inline +/- vs a number input:
 *   - The add-on row is itself a clickable card (role="button"); a number
 *     input inside a button would create accessibility friction. Two small
 *     buttons that stopPropagation are cleaner than a typeable field.
 *   - The visible range (1 – ~20) is small enough that a stepper feels
 *     faster than typing.
 *
 * Caller passes value + onChange. Clamps internally [min, max].
 */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 20,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const clamped = Math.max(min, Math.min(max, value));
  const dec = () => onChange(Math.max(min, clamped - 1));
  const inc = () => onChange(Math.min(max, clamped + 1));
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-obsidian-950/60 px-1 py-0.5 backdrop-blur-sm"
      // The stepper sits inside an outer card with role="button" that toggles
      // the addon. Stop propagation here so +/- never accidentally unchecks.
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={clamped <= min}
        onClick={dec}
        className="flex h-6 w-6 items-center justify-center rounded-full text-platinum-200 transition-colors hover:bg-white/[0.08] hover:text-ember-300 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <Minus className="h-3 w-3" />
      </button>
      <span className="min-w-[20px] text-center font-mono text-[12px] tabular-nums text-platinum-50">
        {clamped}
      </span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={clamped >= max}
        onClick={inc}
        className="flex h-6 w-6 items-center justify-center rounded-full text-platinum-200 transition-colors hover:bg-white/[0.08] hover:text-ember-300 disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <Plus className="h-3 w-3" />
      </button>
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ExpandableDescription — clamped paragraph + "Read more" toggle.
 *
 * The toggle only renders when the clamped paragraph actually overflows. We
 * measure scrollHeight vs clientHeight on every resize via ResizeObserver so
 * the affordance stays correct across viewport changes. The toggle stops
 * propagation so it never triggers the parent tile's select/toggle.
 *
 * Designed to live inside a clickable card wrapper rendered as
 * <div role="button">, since a real <button> inside another <button> is
 * invalid HTML — the package/add-on tiles use role-button wrappers for that
 * reason.
 *
 * `clampClass` lets the caller pick line-clamp-2 (compact addons) or
 * line-clamp-3 (more breathing room on packages).
 */
export function ExpandableDescription({
  text,
  clampClass = "line-clamp-2",
}: {
  text: string;
  clampClass?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const descRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (!text) return;
    function measure() {
      const el = descRef.current;
      if (!el) return;
      if (el.dataset.clamped === "true") {
        setOverflows(el.scrollHeight - 1 > el.clientHeight);
      }
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (descRef.current) ro.observe(descRef.current);
    return () => ro.disconnect();
  }, [text]);

  return (
    <>
      <p
        ref={descRef}
        data-clamped={!expanded}
        className={`whitespace-pre-line text-[13px] leading-relaxed text-platinum-300/85 ${
          expanded ? "" : clampClass
        }`}
      >
        {text}
      </p>
      {overflows ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.26em] text-ember-300 transition-colors hover:text-ember-200"
        >
          {expanded ? "Show less" : "Read more"}
          <ChevronDown
            className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      ) : null}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Step header — common kicker + title + body for every step.
 * ──────────────────────────────────────────────────────────────────────── */

export function StepHeader({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  // Italicize last word of the title.
  const words = title.split(" ");
  return (
    <div>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-ember-300">{kicker}</p>
      <h3 className="mt-2 font-sans text-[clamp(1.7rem,3.6vw,2.4rem)] font-extralight leading-[1.05] tracking-[-0.02em] text-platinum-50">
        {words.slice(0, -1).join(" ")}{" "}
        <span className="font-display italic font-light text-ember-200/95">{words.slice(-1).join(" ")}</span>
      </h3>
      <p className="mt-3 max-w-[52ch] text-[14px] leading-relaxed text-platinum-300/85">{body}</p>
    </div>
  );
}
