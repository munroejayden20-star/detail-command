/* ============================================================================
 * Design System — central tokens for the Detail Command luxury surface.
 *
 * Importing from a single entry point keeps the call sites concise:
 *
 *   import { Z, EASING, DURATION, TRANSITIONS, SURFACES, GRADIENTS } from "@/design-system";
 *
 * Token modules live alongside this barrel file and can also be imported
 * directly when you only need one — e.g. `import { Z } from "@/design-system/z-index"`.
 * ========================================================================== */

export { Z, Z_CLASS } from "./z-index";
export type { ZLayer } from "./z-index";

export { EASING, DURATION, TRANSITIONS, stagger } from "./motion";

export { SURFACES, GRADIENTS, SHADOWS } from "./surfaces";
