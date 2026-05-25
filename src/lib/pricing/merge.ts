/* ============================================================================
 * Deep-merge a partial pricing config against the engine defaults.
 *
 * Why a custom merge instead of `{ ...defaults, ...partial }`:
 *   - A shallow spread on a partial config wipes out unspecified sub-objects.
 *     If the owner saves only the hourly rate, we'd lose all size modifiers.
 *   - We don't trust DB shape: a future migration may add a new modifier the
 *     stored config doesn't know about; defaults must fill the gap.
 *
 * Rules:
 *   - For known objects (vehicleSize, condition, flags, travel) we merge
 *     keys individually.
 *   - For scalars (hourlyMinRate / minBookingPrice / rounding) the partial
 *     wins when defined, otherwise defaults.
 *   - Unknown keys on partial are silently ignored — schema is owned by
 *     the engine, not the DB.
 * ========================================================================== */

import { DEFAULT_PRICING_CONFIG } from "./config";
import type { PricingConfig } from "./types";

/** Best-effort merge for a config blob coming back from Supabase. The blob
 *  may be `null`, `undefined`, or a partial PricingConfig — the result is
 *  always a fully populated config. */
export function mergePricingConfig(
  partial: Partial<PricingConfig> | null | undefined,
): PricingConfig {
  if (!partial) return DEFAULT_PRICING_CONFIG;

  return {
    vehicleSize: {
      ...DEFAULT_PRICING_CONFIG.vehicleSize,
      ...(partial.vehicleSize ?? {}),
    },
    condition: {
      ...DEFAULT_PRICING_CONFIG.condition,
      ...(partial.condition ?? {}),
    },
    flags: {
      petHair:   { ...DEFAULT_PRICING_CONFIG.flags.petHair,   ...(partial.flags?.petHair   ?? {}) },
      stains:    { ...DEFAULT_PRICING_CONFIG.flags.stains,    ...(partial.flags?.stains    ?? {}) },
      heavyDirt: { ...DEFAULT_PRICING_CONFIG.flags.heavyDirt, ...(partial.flags?.heavyDirt ?? {}) },
    },
    hourlyMinRate:   partial.hourlyMinRate   ?? DEFAULT_PRICING_CONFIG.hourlyMinRate,
    minBookingPrice: partial.minBookingPrice ?? DEFAULT_PRICING_CONFIG.minBookingPrice,
    rounding:        partial.rounding        ?? DEFAULT_PRICING_CONFIG.rounding,
    travel: {
      ...DEFAULT_PRICING_CONFIG.travel,
      ...(partial.travel ?? {}),
    },
  };
}
