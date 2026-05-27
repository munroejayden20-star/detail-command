/* ============================================================================
 * Luxury primitives — public API barrel.
 *
 * Booking landing-page sections + form-steps + the orchestrator all import
 * from this directory. Each primitive lives in a per-family file: atmosphere,
 * reveals, buttons, scroll, progress, modal. The useIsMobile hook is exported
 * standalone so any consumer (including non-booking surfaces) can opt out of
 * mobile-jank-prone effects.
 *
 * GPU rules: only `transform` + `opacity` are animated in the hot path.
 * Reduced-motion is honored by framer-motion's `useReducedMotion`.
 * ========================================================================== */

export { useIsMobile } from "./use-is-mobile";

export {
  CarbonWeave,
  CinematicVignette,
  EmberOrb,
  FloatingParticles,
  GrainOverlay,
  MouseSpotlight,
  VolumetricFog,
} from "./atmosphere";

export {
  AnimatedCounter,
  Hairline,
  Marquee,
  Reveal,
  RevealText,
  SectionMarker,
} from "./reveals";

export {
  EmberCTA,
  GlassCTA,
  MagneticButton,
  TiltCard,
} from "./buttons";

export {
  ParallaxLayer,
  ScrollAmbient,
  ScrollTelemetry,
} from "./scroll";

export { LiquidProgress } from "./progress";

export { LuxModal } from "./modal";
