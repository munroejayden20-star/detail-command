/* ============================================================================
 * Default pricing config.
 *
 * Modifier values were picked to be **fair** — meaningful but not predatory.
 * Sedan + average is the 1.0 baseline so the configurator displays exactly
 * the listed service price for the most common booking. Bigger vehicles
 * and worse conditions adjust up; compact + light adjust slightly down so
 * customers in the easy bracket feel rewarded.
 *
 * Phase 2 will replace this with a `pricing_config` row in the settings
 * table so the owner can tune values without redeploying. The engine
 * signature won't change — only the source of the config object.
 * ========================================================================== */

import type { PricingConfig } from "./types";

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  vehicleSize: {
    // Compact: smaller footprint, less product, less time.
    compact:   { price: 0.92, duration: 0.93, material: 0.92 },
    // Sedan = 1.0 baseline. The price the owner enters in Settings is the
    // sedan + average + clean quote — no surprises for the common case.
    sedan:     { price: 1.00, duration: 1.00, material: 1.00 },
    // SUV / truck: more glass, taller panels, larger interior volume.
    suv_truck: { price: 1.18, duration: 1.15, material: 1.15 },
    // Van / XL: substantially more surface area inside and out.
    van_xl:    { price: 1.32, duration: 1.22, material: 1.25 },
  },

  condition: {
    // Light = barely needs the work. Small discount, slightly faster.
    light:   { price: 0.95, duration: 0.92 },
    // Average baseline.
    average: { price: 1.00, duration: 1.00 },
    // Heavy: longer labor, more chemistry, more passes.
    heavy:   { price: 1.20, duration: 1.30 },
  },

  flags: {
    // Pet hair: real labor, even on otherwise clean cars. +8% of base
    // packages plus ~30 minutes of extra removal/vac work.
    petHair:   { pricePct: 0.08, durationMin: 30 },
    // Stains: targeted extraction work, slightly more time per spot.
    stains:    { pricePct: 0.10, durationMin: 35 },
    // Heavy dirt / mud: pre-rinse, foam soak, two-bucket extra passes.
    heavyDirt: { pricePct: 0.06, durationMin: 25 },
  },

  // Soft floor on profitability. If the natural quote would yield less
  // than this per estimated labor hour, the engine bumps the price up to
  // match. $65/hr is conservative for a one-person mobile detail studio
  // in the PNW — adjust upward as the business calibrates.
  hourlyMinRate: 65,

  // Hard floor — covers the drive, the spread, and product baseline even
  // for a tiny job. Keeps the math from quoting absurdly low estimates
  // for, say, "Wax & Wipe on a compact in light condition" with no add-ons.
  minBookingPrice: 75,

  // Round to nearest $5. Reads as engineered (200, 215, 240) rather than
  // arbitrary (197.43). Tune to 1 if you want exact pennies.
  rounding: 5,
};
