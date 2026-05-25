/* ============================================================================
 * Surfaces — reusable background / glass / glow tokens for the luxury UI.
 *
 * Returns class strings or CSS values — NOT React components. Surfaces
 * are usually applied as className adds on existing structural elements
 * (cards, sections, panels), so a token approach composes better than
 * wrapper components.
 *
 * Usage:
 *   import { SURFACES } from "@/design-system";
 *
 *   <div className={SURFACES.glassPanel}>...</div>
 *   <div style={{ background: SURFACES.atmosphereRadial }}>...</div>
 * ========================================================================== */

/** Class strings — composable with the surrounding element's className. */
export const SURFACES = {
  /** Standard glass card body — used in scheduler frames, CTA cards,
   *  customer-portal panels. */
  glassPanel:
    "relative isolate overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]",

  /** Slim glass row — used for compact list items, info chips. */
  glassRow:
    "rounded-xl border border-white/[0.08] bg-white/[0.02]",

  /** Dashed empty state — for "nothing to show yet" panels. */
  glassEmpty:
    "rounded-2xl border border-dashed border-white/[0.10] bg-white/[0.01]",

  /** Compact pill — used for hour-segment chips, status indicators. */
  glassPill:
    "rounded-full border border-white/[0.08] bg-white/[0.02]",
} as const;

/** Pure CSS gradient strings — paste into `style={{ background: ... }}`
 *  or use in arbitrary Tailwind value `bg-[<value>]`. */
export const GRADIENTS = {
  /** Deep radial atmosphere — the base of every luxury surface (booking
   *  page, portal, success screens). */
  atmosphere:
    "radial-gradient(120%_70%_at_50%_0%,#0f1218_0%,#06070a_55%,#040506_100%)",

  /** Ember radial underlay — soft warm glow at the top of a card/section. */
  emberUnderlay:
    "radial-gradient(60%_60%_at_50%_50%,rgba(221,41,20,0.18),transparent_70%)",

  /** Ember + copper underlay — slightly more complex composition used on
   *  the scheduler frame. */
  emberCopperUnderlay:
    "radial-gradient(120%_60%_at_50%_0%,rgba(221,41,20,0.10),transparent_65%),radial-gradient(80%_60%_at_100%_100%,rgba(168,114,70,0.06),transparent_65%)",

  /** Bottom-bleed used to dissolve sections into the next surface. */
  bottomBleed:
    "linear-gradient(180deg,transparent_0%,rgba(6,7,10,0.25)_30%,rgba(6,7,10,0.65)_65%,#06070a_100%)",

  /** Selected day-tile glow — radial ember from below. */
  selectedDay:
    "radial-gradient(circle at 50% 60%, rgba(221,41,20,0.32) 0%, rgba(248,114,72,0.10) 50%, transparent 80%)",

  /** Selected time-slot glow — wider top-anchored radial. */
  selectedSlot:
    "radial-gradient(120% 80% at 50% 0%, rgba(221,41,20,0.22), transparent 70%)",
} as const;

/** Box-shadow strings — for elevation, ember rim glows, glass bevels. */
export const SHADOWS = {
  /** Selected day-tile rim + drop. */
  selectedDay:
    "inset 0 0 0 1px rgba(248,114,72,0.45), 0 10px 28px -10px rgba(221,41,20,0.6)",

  /** Selected slot rim + drop. */
  selectedSlot:
    "inset 0 0 0 1px rgba(248,114,72,0.40), 0 14px 32px -14px rgba(221,41,20,0.55)",

  /** Standard ember CTA at rest. */
  emberCtaRest:
    "0 18px 40px -12px rgba(221,41,20,0.55)",

  /** Ember CTA on hover. */
  emberCtaHover:
    "0 28px 56px -14px rgba(221,41,20,0.7)",

  /** Ember CTA on press (depressed). */
  emberCtaPress:
    "0 6px 18px -6px rgba(221,41,20,0.55), inset 0 2px 6px rgba(0,0,0,0.35)",
} as const;
