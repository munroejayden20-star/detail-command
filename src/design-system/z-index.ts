/* ============================================================================
 * Z-Index Registry — single source of truth for stacking order.
 *
 * Every fixed/absolute/sticky surface that competes for stacking context
 * should reference one of these constants instead of inline `z-N` values.
 * That way you can scan one file and understand the entire app's stacking
 * hierarchy at a glance, and changes (like raising the mobile menu above
 * the boot intro) don't require hunting through 30 files.
 *
 * Layers are organized from back to front. Negative values are below
 * neutral content; positive values are layered on top.
 *
 * Usage:
 *   import { Z } from "@/design-system";
 *
 *   <div style={{ zIndex: Z.nav }}>...</div>
 *   // or with Tailwind arbitrary value:
 *   <div className={`z-[${Z.nav}]`}>...</div>
 *
 *   // For static class adoption (preferred — Tailwind purges these), use
 *   // the `Z_CLASS` map below which maps each named layer to a static
 *   // tailwind class string.
 * ========================================================================== */

export const Z = {
  /** Decorative gradients sitting beneath their parent content (e.g., the
   *  ember underlay on a card). Inside an `isolate` stacking context. */
  underlay: -10,

  /** Base atmosphere layers — page background, grids, weaves, grain. */
  base: 0,

  /** Hero photographic plate — sits above base but behind ambient FX. */
  plate: 1,

  /** Hero ambient — fog, particles, scanline. */
  ambient: 2,

  /** Interactive accents in the hero — MouseSpotlight, EmberOrb decoration,
   *  CinematicVignette frame. Above ambient but below content. */
  accent: 3,

  /** Editorial content (headlines, CTAs) inside an in-flow section. */
  content: 10,

  /** Bottom-bleed gradient that dissolves the hero into the next section. */
  bleed: 15,

  /** Static scroll cue ("Scroll") at the bottom of the hero. */
  cue: 20,

  /** Sticky sub-navigation inside a page (e.g., /portal TopBar). */
  navInternal: 30,

  /** Floating UI dock pinned to the bottom of the viewport (MobileBookDock). */
  dock: 40,

  /** Primary fixed TopNav on /book. */
  nav: 50,

  /** Top-edge scroll-progress bar — visually above the nav. */
  scrollProgress: 55,

  /** Returning-customer ribbon + mobile menu overlay drawer — sits ABOVE
   *  the TopNav (the nav gets offset down by RIBBON_HEIGHT_PX when ribbon
   *  is present, and the mobile menu fully replaces the nav). */
  navOverlay: 60,

  /** Modals + overlays that capture the entire screen. */
  modal: 100,

  /** Boot intro splash — the absolute top of the stack. Only present for
   *  the first ~1.2s of the page lifecycle. */
  boot: 200,
} as const;

/** Static Tailwind class strings — preferred over inline `style.zIndex`
 *  because Tailwind can purge unused classes and HMR pickups are cheaper.
 *  Mirrors `Z` exactly. */
export const Z_CLASS = {
  underlay: "-z-10",
  base: "z-0",
  plate: "z-[1]",
  ambient: "z-[2]",
  accent: "z-[3]",
  content: "z-10",
  bleed: "z-[15]",
  cue: "z-20",
  navInternal: "z-30",
  dock: "z-40",
  nav: "z-50",
  scrollProgress: "z-[55]",
  navOverlay: "z-[60]",
  modal: "z-[100]",
  boot: "z-[200]",
} as const;

export type ZLayer = keyof typeof Z;
