/* ============================================================================
 * Pricing engine — type contracts.
 *
 * The engine is a pure function: (input, config) → Quote. All math is
 * deterministic; nothing here touches Supabase or React. Everything else in
 * this folder builds on these shapes.
 *
 * Why this lives in its own module:
 *   - Pricing logic is a business invariant and must be unit-testable.
 *   - It's used by the customer-facing configurator AND will later be used
 *     by the admin preview UI + dashboard "what would we have charged?"
 *     calculators. Sharing the same engine guarantees consistency.
 *   - When the admin UI lands (Phase 2), it will edit a `PricingConfig`
 *     stored in the `settings` table — the engine signature won't change.
 * ========================================================================== */

import type { PublicService } from "@/lib/booking-api";

/* ─── Modifier shapes ────────────────────────────────────────────────── */

/** A multiplicative modifier applied to base price + duration + material.
 *  1.0 means "no change". 1.20 means +20%. 0.92 means −8%. */
export interface ScaleModifier {
  /** Multiplier on the package subtotal — affects what the customer sees. */
  price: number;
  /** Multiplier on labor minutes — drives the profit-floor calculation. */
  duration: number;
  /** Multiplier on material/consumable cost. Reserved for Phase 2 cost
   *  tracking; the engine carries it through so callers can sum margin
   *  internally without re-deriving. */
  material: number;
}

/** A condition modifier acts on price + duration only — materials track
 *  with size, not with how dirty the car is. */
export interface ConditionModifier {
  price: number;
  duration: number;
}

/** Additive flag modifier — applied on TOP of size + condition. Adds a
 *  percentage of the package subtotal (`pricePct`) and a flat amount of
 *  labor minutes (`durationMin`). Use this for flags like "pet hair" /
 *  "stains" / "heavy dirt" where the work isn't proportional to base
 *  price — it's a real chunk of extra labor regardless of vehicle. */
export interface FlagModifier {
  /** Percentage of the package subtotal added to the price total
   *  (0.08 = +8%). */
  pricePct: number;
  /** Flat minutes of extra labor added on top of the base duration. */
  durationMin: number;
}

/* ─── Engine config ──────────────────────────────────────────────────── */

/** Complete pricing-engine configuration. The default lives in `./config.ts`;
 *  Phase 2 will load this from `settings.pricing_config` so the owner can
 *  tune everything from the admin panel. */
export interface PricingConfig {
  /** Vehicle size → modifier. Keys match `FormState.vehicleSize` values
   *  ("compact" / "sedan" / "suv_truck" / "van_xl"). Sedan should be the
   *  1.0 baseline so the displayed estimate matches the listed prices for
   *  the most common case. */
  vehicleSize: Record<string, ScaleModifier>;

  /** Interior + exterior condition modifiers. Keys match
   *  `CONDITION_OPTIONS` values ("light" / "average" / "heavy"). The
   *  engine takes the **worse** of the two when computing the per-condition
   *  adjustment — interior and exterior labor overlap, so charging for
   *  both would double-count. */
  condition: Record<string, ConditionModifier>;

  /** Per-flag additive modifiers — pet hair, stains, heavy dirt. */
  flags: {
    petHair: FlagModifier;
    stains: FlagModifier;
    heavyDirt: FlagModifier;
  };

  /** Business protection — the engine bumps the quote up to whatever this
   *  hourly rate × estimated labor hours would yield, but only if the
   *  natural quote came in below. Acts as a soft floor on profitability. */
  hourlyMinRate: number;

  /** Hard floor — minimum a customer can be quoted. Protects against tiny
   *  jobs that aren't worth the drive. */
  minBookingPrice: number;

  /** Round the final estimate to the nearest $N. Keeps quotes from
   *  reading as $187.42 — feels engineered, not arbitrary. */
  rounding: number;
}

/* ─── Quote (output) ─────────────────────────────────────────────────── */

/** Selected addon + the customer-chosen quantity. Mirrors what the
 *  configurator already tracks via `addonQuantities`. */
export interface QuoteAddonSelection {
  service: PublicService;
  quantity: number;
}

/** Engine input. Everything the engine needs to compute a quote. All
 *  fields are present — if the customer hasn't picked a vehicle size yet,
 *  pass `""` and the engine falls back to the sedan/average baseline. */
export interface QuoteInput {
  packages: PublicService[];
  addons: QuoteAddonSelection[];
  vehicleSize: string;
  interiorCondition: string;
  exteriorCondition: string;
  flags: {
    petHair: boolean;
    stains: boolean;
    heavyDirt: boolean;
  };
}

/** A single labeled line in the customer-facing breakdown. The engine
 *  builds this list so the UI can render a clean table without re-deriving
 *  any math. */
export interface QuoteLine {
  /** Human-readable label e.g. "Vehicle size · Large SUV". */
  label: string;
  /** Signed dollar delta. Positive = added to the total, negative =
   *  subtracted. The base subtotal line is always positive. */
  amount: number;
  /** Free-text annotation rendered under the label in muted type, e.g.
   *  "+18% (large SUV)" or "min protection — 6.5 hr × $65/hr". */
  detail?: string;
}

/** Engine output. `estimate` is what the customer sees; everything else
 *  is breakdown + diagnostics. */
export interface Quote {
  /** Final number shown to the customer. Already rounded. */
  estimate: number;

  /** Pre-rounding, pre-floor subtotal — useful for analytics + diffing
   *  against `estimate` to know if protection kicked in. */
  rawSubtotal: number;

  /** Breakdown lines in display order. Already excludes zero-amount
   *  lines so the UI can iterate without filtering. */
  lines: QuoteLine[];

  /** Estimated labor in hours, used to compute hourly rate. */
  laborHours: number;

  /** What the quote would average per labor hour. Useful for the owner
   *  in the future admin preview ("does this look right?"). */
  effectiveHourlyRate: number;

  /** Did the hourly-rate floor bump the quote up? UI surfaces this via a
   *  small footnote so customers understand why the number isn't simply
   *  the sum of line items. */
  minProtectionApplied: boolean;

  /** Did the minimum-booking floor kick in? */
  minBookingApplied: boolean;
}
