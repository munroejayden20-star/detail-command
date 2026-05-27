/* ============================================================================
 * Booking configurator — public API barrel.
 *
 * BookingPage imports from this directory; everything it needs is re-exported
 * here. Internal helpers (Field, StepHeader, quoteOf-internals, etc.) stay
 * intentionally unexported so future cleanup doesn't break the orchestrator.
 * ========================================================================== */

export { ConfiguratorShell } from "./configurator-shell";
export { makeCanProceed } from "./validation";
export { estimatedPriceOf, quoteOf } from "./quote";
export { EMPTY_FORM, TOTAL_STEPS } from "./types";
export type { FormState } from "./types";
