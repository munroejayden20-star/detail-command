/* ============================================================================
 * Form → engine adapters.
 *
 * Centralizes the FormState → engine input mapping so every consumer
 * (configurator status bar, mobile dock, review step breakdown, submit
 * payload) sees the same number.
 * ========================================================================== */

import type { PublicService } from "@/lib/booking-api";
import { computeQuote } from "@/lib/pricing/engine";
import { DEFAULT_PRICING_CONFIG } from "@/lib/pricing/config";
import type { PricingConfig, Quote } from "@/lib/pricing/types";
import type { FormState } from "./types";

/**
 * Builds a full Quote from the live form state via the pricing engine.
 *
 * Optional `config` arg threads the owner-tuned PricingConfig in from the
 * BookingPage. Callers without access to the config (legacy code paths,
 * tests) pass nothing and get DEFAULT_PRICING_CONFIG behavior.
 */
export function quoteOf(
  form: FormState,
  services: PublicService[],
  config: PricingConfig = DEFAULT_PRICING_CONFIG,
): Quote {
  const packages = form.serviceIds
    .map((id) => services.find((s) => s.id === id))
    .filter((s): s is PublicService => !!s);
  const addons = form.addonIds
    .map((id) => {
      const s = services.find((x) => x.id === id);
      if (!s) return null;
      return {
        service: s,
        quantity: Math.max(1, form.addonQuantities[id] ?? 1),
      };
    })
    .filter((a): a is { service: PublicService; quantity: number } => !!a);

  return computeQuote(
    {
      packages,
      addons,
      vehicleSize: form.vehicleSize,
      interiorCondition: form.interiorCondition,
      exteriorCondition: form.exteriorCondition,
      flags: {
        petHair: form.petHair,
        stains: form.stains,
        heavyDirt: form.heavyDirt,
      },
    },
    config,
  );
}

/**
 * Number-only helper kept for backwards compatibility with the orchestrator
 * (`BookingPage`) and the configurator shell, which both useMemo on a
 * primitive. Delegates to the engine; identical math, identical return.
 */
export function estimatedPriceOf(
  form: FormState,
  services: PublicService[],
  config: PricingConfig = DEFAULT_PRICING_CONFIG,
): number {
  return quoteOf(form, services, config).estimate;
}
