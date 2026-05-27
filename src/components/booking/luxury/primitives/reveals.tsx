/* ============================================================================
 * Reveal / text primitives — Hairline, SectionMarker, RevealText, Reveal,
 * Marquee, AnimatedCounter.
 *
 * All animate on view-enter (whileInView / useInView). Honoring reduced-motion
 * is delegated to framer-motion's `useReducedMotion`.
 * ========================================================================== */

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { useIsMobile } from "./use-is-mobile";

/* ─────────────────────────────────────────────────────────────────────────────
 * Hairline — SVG line that draws itself in when scrolled into view.
 * Used between sections instead of a flat border.
 * ──────────────────────────────────────────────────────────────────────── */

export function Hairline({
  className = "",
  delay = 0,
}: {
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      aria-hidden
      className={`relative h-px w-full origin-left bg-gradient-to-r from-transparent via-white/15 to-transparent ${className}`}
      initial={{ scaleX: 0 }}
      whileInView={{ scaleX: 1 }}
      viewport={{ once: true, amount: 0.55 }}
      transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay }}
    />
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * SectionMarker — numbered editorial label ("01 — SERVICE PACKAGES").
 * JetBrains Mono so it reads as a hand-set spec sheet.
 * ──────────────────────────────────────────────────────────────────────── */

export function SectionMarker({
  index,
  label,
  align = "left",
}: {
  index: string;
  label: string;
  align?: "left" | "center";
}) {
  return (
    <div
      className={`flex items-center gap-3 text-platinum-300/80 ${
        align === "center" ? "justify-center" : ""
      }`}
    >
      <span className="font-mono text-[11px] tracking-[0.18em] text-ember-300">{index}</span>
      <span className="h-px w-8 bg-white/15" />
      <span className="font-mono text-[10.5px] uppercase tracking-[0.34em] text-platinum-200/80">
        {label}
      </span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * RevealText — splits a string into words and rises them in on view.
 *
 * Stagger and per-word blur give a printing-press feel rather than a
 * generic "fade-up." Pass `italics={[indices]}` to render those words in
 * italic Fraunces.
 * ──────────────────────────────────────────────────────────────────────── */

type RevealTag = "h1" | "h2" | "h3" | "h4" | "p" | "blockquote";

export function RevealText({
  text,
  italics,
  as = "h2",
  className = "",
  delay = 0,
  stagger = 0.045,
}: {
  text: string;
  italics?: number[]; // indices of words to italicize
  as?: RevealTag;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.45 });
  const reduced = useReducedMotion();
  const words = text.split(" ");

  const inner = (
    <span className="inline-block overflow-hidden align-baseline">
      <motion.span
        initial="hidden"
        animate={inView || reduced ? "show" : "hidden"}
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: stagger, delayChildren: delay } },
        }}
        className="inline-flex flex-wrap"
      >
        {words.map((w, i) => {
          const isItalic = italics?.includes(i);
          return (
            <motion.span
              key={`${w}-${i}`}
              className={`inline-block ${
                isItalic
                  ? "font-display italic font-light pr-[0.18em] pl-[0.04em] text-ember-200/95"
                  : "pr-[0.22em]"
              }`}
              variants={{
                hidden: { y: "110%", opacity: 0, filter: "blur(6px)" },
                show: {
                  y: 0,
                  opacity: 1,
                  filter: "blur(0)",
                  transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] },
                },
              }}
            >
              {w}
            </motion.span>
          );
        })}
      </motion.span>
    </span>
  );

  // Dispatch concrete elements instead of a dynamic Tag — JSX.IntrinsicElements
  // produces a union too wide for `ref` to typecheck against.
  const refH = ref as React.RefObject<HTMLHeadingElement>;
  const refP = ref as React.RefObject<HTMLParagraphElement>;
  const refQ = ref as React.RefObject<HTMLQuoteElement>;
  switch (as) {
    case "h1": return <h1 ref={refH} className={className}>{inner}</h1>;
    case "h2": return <h2 ref={refH} className={className}>{inner}</h2>;
    case "h3": return <h3 ref={refH} className={className}>{inner}</h3>;
    case "h4": return <h4 ref={refH} className={className}>{inner}</h4>;
    case "p":  return <p  ref={refP} className={className}>{inner}</p>;
    case "blockquote": return <blockquote ref={refQ} className={className}>{inner}</blockquote>;
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Reveal — generic wrapper. Rises content in when it scrolls into view.
 * Cheaper than RevealText (no per-word split); use for paragraphs, cards.
 * ──────────────────────────────────────────────────────────────────────── */

export function Reveal({
  children,
  delay = 0,
  y = 24,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  // On mobile, the section-to-section transition fires multiple Reveals
  // simultaneously (the whole section fits in one viewport). Each one
  // shifting up by 24px stacked into a visible "teleport up" snap at the
  // hero → manifesto boundary. Drop the Y on mobile — keep the opacity +
  // blur fade so the reveal still reads as cinematic without the lift.
  const isMobile = useIsMobile();
  const effectiveY = isMobile ? 0 : y;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: effectiveY, filter: "blur(8px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0)" }}
      viewport={{ once: true, amount: 0.4, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1], delay }}
    >
      {children}
    </motion.div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Marquee — infinite ticker. Duplicates children twice for seamless wrap.
 * Pause on hover.
 * ──────────────────────────────────────────────────────────────────────── */

export function Marquee({
  children,
  reverse,
  speed = "normal",
  pauseOnHover = true,
  className,
}: {
  children: ReactNode;
  reverse?: boolean;
  speed?: "slow" | "normal" | "fast";
  pauseOnHover?: boolean;
  className?: string;
}) {
  const anim =
    speed === "slow"
      ? "animate-lx-marquee-slow"
      : reverse
      ? "animate-lx-marquee-rev"
      : "animate-lx-marquee";

  return (
    <div className={`group flex w-full overflow-hidden ${className ?? ""}`}>
      <div
        className={`flex shrink-0 items-center gap-12 pr-12 ${anim} ${
          pauseOnHover ? "[animation-play-state:running] group-hover:[animation-play-state:paused]" : ""
        }`}
        // Doubled track for a seamless 50% loop.
        style={{ minWidth: "max-content" }}
      >
        {children}
        <span aria-hidden className="flex shrink-0 items-center gap-12 pr-12">
          {children}
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * AnimatedCounter — count-up integer used on the trust strip stats.
 * Counts only once when first scrolled into view.
 * ──────────────────────────────────────────────────────────────────────── */

export function AnimatedCounter({
  value,
  prefix,
  suffix,
  duration = 1.6,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const start = performance.now();
    const from = 0;
    const to = value;
    let raf = 0;
    function tick(t: number) {
      const p = Math.min(1, (t - start) / (duration * 1000));
      // ease-out cubic
      const e = 1 - Math.pow(1 - p, 3);
      setN(Math.round(from + (to - from) * e));
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {n}
      {suffix}
    </span>
  );
}
