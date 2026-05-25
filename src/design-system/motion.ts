/* ============================================================================
 * Motion Tokens — central easing + duration system for the luxury surface.
 *
 * Why this exists: cubic-bezier arrays were inlined in 24+ places across
 * the booking subtree. That made it impossible to tune motion holistically
 * — changing the "premium settle" curve required hunting through every
 * framer-motion `transition` prop. Now everything routes through these
 * named tokens, and tuning the system is a one-line edit.
 *
 * Two surfaces:
 *   - EASING: cubic-bezier tuples for framer-motion's `ease` and
 *     `transition.ease`. Each curve has a named role.
 *   - DURATION: seconds used in framer-motion. Tailwind's `duration-*`
 *     classes work off the same scale (multiplied by 1000ms).
 *
 * Plus a few composed `Transition` presets for the most common patterns
 * (reveal, hover, press, slide).
 *
 * Usage:
 *   import { EASING, DURATION, TRANSITIONS } from "@/design-system";
 *
 *   <motion.div transition={TRANSITIONS.reveal} ... />
 *   // or:
 *   <motion.div transition={{ duration: DURATION.relaxed, ease: EASING.settle }} ... />
 * ========================================================================== */

/** Easing curves. Each curve has a clear role — pick the closest one
 *  semantically, don't reach for a custom inline tuple. */
export const EASING = {
  /** Soft settle into rest — the "luxury settle." Used for reveals,
   *  staggered text, glass CTA outer-bloom, scheduler month-slides,
   *  and most reveal-style entry animations.
   *  cubic-bezier(0.16, 1, 0.3, 1) */
  settle: [0.16, 1, 0.3, 1] as const,

  /** Sharper exit, smoother settle — used for fade-in / slide-up of
   *  small UI bursts, modal scale-in, status pills.
   *  cubic-bezier(0.32, 0.72, 0, 1) */
  swift: [0.32, 0.72, 0, 1] as const,

  /** Symmetric breath — used for repeating pulse animations (orb breath,
   *  ember pulse). Both ends accelerate similarly.
   *  cubic-bezier(0.45, 0, 0.55, 1) */
  pulse: [0.45, 0, 0.55, 1] as const,

  /** Standard "material" curve — used for the diagonal sheen sweep on
   *  GlassCTA and other one-shot specular highlights.
   *  cubic-bezier(0.4, 0, 0.2, 1) */
  sheen: [0.4, 0, 0.2, 1] as const,

  /** Inertial in-out for the ambient fog drifts. String literal works
   *  with framer-motion's named easings. */
  ambient: "easeInOut" as const,
} as const;

/** Durations in seconds. Mirrors Tailwind's duration scale roughly:
 *  fast → relaxed → slow → cinematic. */
export const DURATION = {
  /** 120ms — micro-interactions (button press scale, focus ring). */
  instant: 0.12,
  /** 180ms — fast (hover lift, slot card stagger). */
  fast: 0.18,
  /** 250ms — slide-up cards, simple fades. */
  brisk: 0.25,
  /** 300ms — hover sheens, color transitions. */
  relaxed: 0.3,
  /** 340ms — month transitions, slot grid pop-in. */
  measured: 0.34,
  /** 450ms — outer bloom hover ramp. */
  cinematic: 0.45,
  /** 700ms — section reveals (lx-rise). */
  reveal: 0.7,
  /** 900ms — heavy entrance (lx-blur-in, boot intro fade). */
  entrance: 0.9,
  /** 1.6s — count-up counter. */
  counter: 1.6,
  /** 2.6s — one-shot scanline sweep across the hero. */
  scanline: 2.6,
} as const;

/* ─────────────────────────────────────────────────────────────────────────────
 * Composed transition presets — the most common framer-motion `transition`
 * objects, ready to spread. Reduces inline cubic-beziers to one import.
 * ────────────────────────────────────────────────────────────────────────── */

export const TRANSITIONS = {
  /** Default reveal — opacity + y from a hidden state. */
  reveal: { duration: DURATION.reveal, ease: EASING.settle },

  /** Hover lift / sheen ramp. */
  hover: { duration: DURATION.relaxed, ease: EASING.settle },

  /** Press-down depth. */
  press: { duration: DURATION.fast, ease: EASING.settle },

  /** Slide-in transition (month nav, configurator step). */
  slide: { duration: DURATION.measured, ease: EASING.settle },

  /** Modal scale-in / scale-out. */
  modal: { duration: DURATION.relaxed, ease: EASING.swift },

  /** Outer bloom on GlassCTA. */
  bloom: { duration: DURATION.cinematic, ease: EASING.settle },
} as const;

/* ─────────────────────────────────────────────────────────────────────────────
 * Stagger utility — generate per-index delay for staggered reveals.
 * Cap prevents the last items in a long list from delaying forever.
 *
 *   const delay = stagger(i);          // 16ms per item, capped at 180ms
 *   const delay = stagger(i, { step: 0.025, cap: 0.3 });
 * ────────────────────────────────────────────────────────────────────────── */

export function stagger(
  index: number,
  options: { step?: number; cap?: number } = {},
): number {
  const { step = 0.016, cap = 0.18 } = options;
  return Math.min(index * step, cap);
}
