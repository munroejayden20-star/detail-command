/* ============================================================================
 * Scroll-driven primitives — ParallaxLayer, ScrollAmbient, ScrollTelemetry.
 *
 * ScrollAmbient and ScrollTelemetry short-circuit to null on mobile (heavy
 * compositor cost + scroll-tick state setters that contributed to first-
 * scroll jank). The "Inner" components carry the actual motion subscriptions
 * so the outer wrappers can opt-out cleanly without conditional hooks.
 * ========================================================================== */

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { Z_CLASS } from "@/design-system";
import { useIsMobile } from "./use-is-mobile";

/* ─────────────────────────────────────────────────────────────────────────────
 * ParallaxLayer — scroll-linked Y translate. Used in the hero to give depth
 * to the headline plate vs the photographic plate.
 * ──────────────────────────────────────────────────────────────────────── */

export function ParallaxLayer({
  children,
  speed = 0.2,
  className = "",
}: {
  children: ReactNode;
  speed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const reduced = useReducedMotion();
  const y = useTransform(scrollYProgress, [0, 1], [`${speed * 100}px`, `${-speed * 100}px`]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <motion.div style={reduced ? undefined : { y }}>{children}</motion.div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ScrollAmbient — fixed full-viewport background that reacts to scroll.
 *
 * Composed of:
 *   1. A dot-grid that pans diagonally with scroll progress.
 *   2. Four vertical hairlines that drift up/down at different rates — reads
 *      like floor markings passing on a service-bay tour.
 *   3. Two large soft ember orbs at extreme parallax — one slow upward, one
 *      slow downward — so the lighting "rotates" subtly as you read.
 *   4. A scanline that crosses once per long scroll travel.
 *
 * Sits at z-0 with pointer-events:none. Disabled on mobile + reduced-motion.
 * ──────────────────────────────────────────────────────────────────────── */

export function ScrollAmbient() {
  // Mobile short-circuit BEFORE any motion hooks fire. On phones the
  // atmospheric layer is barely visible (it's a backdrop with subtle
  // grid/orbs) but its 7 useTransform + useSpring + useScroll chain was
  // the dominant cost on first-scroll jank. Returning null from this
  // outer wrapper means none of the inner hooks ever mount — no listener,
  // no transforms, no compositor layers.
  const isMobile = useIsMobile();
  if (isMobile) return null;
  return <ScrollAmbientInner />;
}

function ScrollAmbientInner() {
  const { scrollYProgress } = useScroll();
  const reduced = useReducedMotion();

  // Smooth the raw scroll progress so all derived motion values inherit ease.
  // Tighter than a typical "buttery" spring on purpose — the soft profile
  // (stiffness 80 / mass 0.4) had a visible catch-up lag on the first scroll
  // event after page load, which read as jitter. This profile critically
  // tracks scroll (no perceptible lag) while still ironing out trackpad
  // micro-jitter at high scroll resolution.
  const smooth = useSpring(scrollYProgress, { stiffness: 220, damping: 36, mass: 0.3 });

  const gridX = useTransform(smooth, [0, 1], ["0px", "60px"]);
  const gridY = useTransform(smooth, [0, 1], ["0px", "-120px"]);

  // Hairlines — each gets a different translate-y range so they pass at
  // different "speeds." The hairline element itself is twice as tall as the
  // viewport so it never reveals an edge as it drifts.
  const line1Y = useTransform(smooth, [0, 1], ["-25%", "12%"]);
  const line2Y = useTransform(smooth, [0, 1], ["8%",  "-22%"]);
  const line3Y = useTransform(smooth, [0, 1], ["-12%", "20%"]);
  const line4Y = useTransform(smooth, [0, 1], ["18%", "-14%"]);

  // Ember orbs — extreme slow parallax.
  const orbAY = useTransform(smooth, [0, 1], ["10vh",  "-40vh"]);
  const orbAX = useTransform(smooth, [0, 1], ["-10vw", "5vw"]);
  const orbBY = useTransform(smooth, [0, 1], ["0vh",   "55vh"]);
  const orbBX = useTransform(smooth, [0, 1], ["20vw",  "-10vw"]);

  // Horizon — a single bright line that slowly sinks down through the viewport.
  const horizon = useTransform(smooth, [0, 1], ["30%", "75%"]);

  if (reduced) return null;

  return (
    <div aria-hidden className={`pointer-events-none fixed inset-0 ${Z_CLASS.base} overflow-hidden`}>
      <motion.div
        className="absolute inset-[-20%]"
        style={{
          x: gridX,
          y: gridY,
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage:
            "radial-gradient(ellipse 90% 70% at 50% 50%, black 35%, transparent 85%)",
          opacity: 0.55,
        }}
      />

      <motion.div className="absolute inset-x-0 h-[200vh] w-px left-[8%] bg-gradient-to-b from-transparent via-white/8 to-transparent" style={{ top: 0, y: line1Y, opacity: 0.55 }} />
      <motion.div className="absolute inset-x-0 h-[200vh] w-px left-[26%] bg-gradient-to-b from-transparent via-ember-500/15 to-transparent" style={{ top: 0, y: line2Y, opacity: 0.6 }} />
      <motion.div className="absolute inset-x-0 h-[200vh] w-px left-[64%] bg-gradient-to-b from-transparent via-white/8 to-transparent" style={{ top: 0, y: line3Y, opacity: 0.55 }} />
      <motion.div className="absolute inset-x-0 h-[200vh] w-px left-[88%] bg-gradient-to-b from-transparent via-copper-300/15 to-transparent" style={{ top: 0, y: line4Y, opacity: 0.55 }} />

      <motion.div
        className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent"
        style={{ top: horizon, opacity: 0.7 }}
      />

      <motion.div
        className="absolute h-[55vh] w-[55vh] rounded-full blur-3xl"
        style={{
          left: "-15%",
          top: "5%",
          x: orbAX,
          y: orbAY,
          background:
            "radial-gradient(circle, rgba(221,41,20,0.18) 0%, rgba(221,41,20,0.04) 35%, transparent 65%)",
        }}
      />
      <motion.div
        className="absolute h-[60vh] w-[60vh] rounded-full blur-3xl"
        style={{
          right: "-20%",
          bottom: "0%",
          x: orbBX,
          y: orbBY,
          background:
            "radial-gradient(circle, rgba(168,114,70,0.16) 0%, rgba(168,114,70,0.05) 40%, transparent 70%)",
        }}
      />

      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_50%,transparent_40%,#06070a_100%)]" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ScrollTelemetry — fixed right-edge film-counter readout.
 *
 * Two design choices worth flagging:
 *   - The tick is driven by a `y` transform (GPU) in pixels, not `top: %` —
 *     framer-motion subscribes motion values to inline styles, and using
 *     `top` with a percent string fails silently if the parent isn't fully
 *     resolved at hook time. `y` is the canonical hot-path target.
 *   - The rail height comes from a layout effect after first paint, so the
 *     tick range matches the real rendered height at any viewport.
 * ──────────────────────────────────────────────────────────────────────── */

export function ScrollTelemetry() {
  // Already CSS-hidden on mobile (`hidden md:flex`) but the inner hooks
  // still ran — including a `useMotionValueEvent` that called setState on
  // every scroll tick. That's pure waste on mobile and a contributor to
  // first-scroll jank. Short-circuit before any hooks mount.
  const isMobile = useIsMobile();
  if (isMobile) return null;
  return <ScrollTelemetryInner />;
}

function ScrollTelemetryInner() {
  const { scrollYProgress } = useScroll();
  const reduced = useReducedMotion();
  const [pct, setPct] = useState(0);
  const railRef = useRef<HTMLDivElement | null>(null);
  const [railH, setRailH] = useState(220);

  useEffect(() => {
    if (!railRef.current) return;
    const measure = () => {
      const h = railRef.current?.getBoundingClientRect().height ?? 220;
      setRailH(h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(railRef.current);
    return () => ro.disconnect();
  }, []);

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    setPct(Math.round(v * 100));
  });

  const tickY = useTransform(scrollYProgress, [0, 1], [0, Math.max(0, railH - 7)]);

  if (reduced) return null;

  return (
    <div
      aria-hidden
      className={`pointer-events-none fixed right-3 top-1/2 ${Z_CLASS.navInternal} hidden -translate-y-1/2 flex-col items-center gap-3 md:flex`}
    >
      <span className="font-mono text-[9.5px] uppercase tracking-[0.4em] text-platinum-300/55 [writing-mode:vertical-rl] rotate-180">
        Telemetry
      </span>
      <div ref={railRef} className="relative h-[240px] w-px bg-white/12">
        {/* hash marks every 25% so motion has reference */}
        <span className="absolute -left-1 top-0 h-px w-2.5 bg-white/30" />
        <span className="absolute -left-1 top-1/4 h-px w-1.5 bg-white/18" />
        <span className="absolute -left-1 top-1/2 h-px w-1.5 bg-white/18" />
        <span className="absolute -left-1 top-3/4 h-px w-1.5 bg-white/18" />
        <span className="absolute -left-1 bottom-0 h-px w-2.5 bg-white/30" />

        {/* ember tick — driven by transform y in pixels */}
        <motion.span
          className="absolute left-[-3.5px] top-0 h-[8px] w-[8px] rounded-full bg-ember-400 shadow-[0_0_14px_3px_rgba(248,114,72,0.7)]"
          style={{ y: tickY }}
        />
        {/* faint ember trail above the tick */}
        <motion.span
          className="absolute left-0 top-0 w-px -translate-x-px bg-gradient-to-b from-transparent via-ember-500/40 to-ember-400"
          style={{ height: tickY }}
        />
      </div>
      <span className="font-mono text-[10px] tabular-nums tracking-[0.18em] text-platinum-300/85">
        {String(pct).padStart(3, "0")}<span className="text-platinum-300/40">%</span>
      </span>
    </div>
  );
}
