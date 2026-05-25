/* ============================================================================
 * Pricing engine — pure computation.
 *
 * Composition order (each step uses the previous result):
 *
 *   1. Base subtotal           = sum of midPrices for selected packages
 *   2. Addon subtotal          = sum of midPrice × quantity for each addon
 *   3. Vehicle size adjustment = base × (sizeMod.price − 1)
 *                                  (only the package subtotal is scaled —
 *                                   addons are billed at listed price)
 *   4. Condition adjustment    = base × (worse(int,ext).price − 1)
 *                                  (taking the worst condition prevents
 *                                   double-charging when only one side is bad)
 *   5. Flag adjustments        = base × Σ flag.pricePct
 *                                  for petHair / stains / heavyDirt flags
 *   6. Labor hours             = (base duration × size × condition + flag mins)
 *                                  in hours
 *   7. Profit floor            = if subtotal / laborHours < hourlyMinRate,
 *                                  bump subtotal to hours × hourlyMinRate
 *   8. Min booking floor       = clamp subtotal up to minBookingPrice
 *   9. Rounding                = round to nearest `rounding` dollars
 *
 * Every step is logged into the breakdown `lines` array so the customer-
 * facing UI can render the journey without re-deriving math, and so the
 * eventual admin preview can show owners exactly where each dollar came
 * from. The engine never returns negative final estimates — minimum
 * booking is the absolute floor.
 *
 * Inputs that don't match a known modifier key fall back to the sedan +
 * average baseline. This is intentional: the customer might be on Step 1
 * (no vehicle picked yet) and we want a sane preview.
 * ========================================================================== */

import type {
  PricingConfig,
  Quote,
  QuoteInput,
  QuoteLine,
  ScaleModifier,
  ConditionModifier,
} from "./types";
import type { PublicService } from "@/lib/booking-api";

/* ─── Helpers ────────────────────────────────────────────────────────── */

function activeDiscount(s: PublicService) {
  const d = s.discount;
  if (!d?.active || !d.value) return null;
  if (d.expiry && new Date(d.expiry) < new Date()) return null;
  return d;
}

function applyDiscount(price: number, d: NonNullable<PublicService["discount"]>) {
  if (d.type === "percent") return Math.round(price * (1 - d.value / 100));
  return Math.max(0, price - d.value);
}

/** Customer-facing "starting at" price for a service. Mirrors the value
 *  the configurator card displays — `priceLow` after any active discount. */
export function midPrice(s: PublicService): number {
  const d = activeDiscount(s);
  return d ? applyDiscount(s.priceLow, d) : s.priceLow;
}

const SIZE_BASELINE: ScaleModifier = { price: 1, duration: 1, material: 1 };
const COND_BASELINE: ConditionModifier = { price: 1, duration: 1 };

const VEHICLE_LABELS: Record<string, string> = {
  compact:   "Compact",
  sedan:     "Sedan",
  suv_truck: "SUV / Truck",
  van_xl:    "Van / XL",
};

const CONDITION_LABELS: Record<string, string> = {
  light:   "Light",
  average: "Average",
  heavy:   "Heavy",
};

/* ─── Engine ─────────────────────────────────────────────────────────── */

export function computeQuote(
  input: QuoteInput,
  config: PricingConfig,
): Quote {
  const lines: QuoteLine[] = [];

  /* 1. Package subtotal --------------------------------------------- */
  let packageSubtotal = 0;
  let baseDurationMin = 0;
  for (const p of input.packages) {
    packageSubtotal += midPrice(p);
    baseDurationMin += p.durationMinutes;
  }
  if (packageSubtotal > 0) {
    lines.push({
      label: input.packages.length > 1 ? "Packages" : "Package",
      amount: packageSubtotal,
      detail: input.packages.map((p) => p.name).join(" · "),
    });
  }

  /* 2. Addon subtotal — listed price × qty -------------------------- */
  let addonSubtotal = 0;
  for (const { service, quantity } of input.addons) {
    const q = Math.max(1, Math.floor(quantity));
    addonSubtotal += midPrice(service) * q;
    baseDurationMin += service.durationMinutes * q;
  }
  if (addonSubtotal > 0) {
    lines.push({
      label: "Add-ons",
      amount: addonSubtotal,
      detail: input.addons
        .map(({ service, quantity }) =>
          quantity > 1 ? `${quantity}× ${service.name}` : service.name,
        )
        .join(" · "),
    });
  }

  // Anything below this line is a delta on top of the package subtotal.
  const baseForAdjustments = packageSubtotal;

  /* 3. Vehicle size --------------------------------------------------- */
  const sizeMod = config.vehicleSize[input.vehicleSize] ?? SIZE_BASELINE;
  const sizeAdj = baseForAdjustments * (sizeMod.price - 1);
  if (input.vehicleSize && Math.abs(sizeAdj) >= 0.5) {
    const pct = Math.round((sizeMod.price - 1) * 100);
    lines.push({
      label: `Vehicle size · ${VEHICLE_LABELS[input.vehicleSize] ?? input.vehicleSize}`,
      amount: sizeAdj,
      detail: `${pct >= 0 ? "+" : "−"}${Math.abs(pct)}%`,
    });
  }

  /* 4. Condition (worse of int/ext) ----------------------------------- */
  const intMod = config.condition[input.interiorCondition] ?? COND_BASELINE;
  const extMod = config.condition[input.exteriorCondition] ?? COND_BASELINE;
  // Pick the WORSE multiplier for both price and duration. Customers with
  // a heavy interior and light exterior shouldn't pay twice for the
  // overlap.
  const cMod = {
    price:    Math.max(intMod.price, extMod.price),
    duration: Math.max(intMod.duration, extMod.duration),
  };
  const condAdj = baseForAdjustments * (cMod.price - 1);
  if (Math.abs(condAdj) >= 0.5) {
    // Choose the matching label — whichever drove the modifier.
    const drivingKey = intMod.price >= extMod.price ? input.interiorCondition : input.exteriorCondition;
    const pct = Math.round((cMod.price - 1) * 100);
    lines.push({
      label: `Condition · ${CONDITION_LABELS[drivingKey] ?? drivingKey ?? "Average"}`,
      amount: condAdj,
      detail: `${pct >= 0 ? "+" : "−"}${Math.abs(pct)}%`,
    });
  }

  /* 5. Flags ---------------------------------------------------------- */
  let flagPriceAdj = 0;
  let flagDurationMin = 0;
  const flagLabels: string[] = [];
  if (input.flags.petHair) {
    flagPriceAdj += baseForAdjustments * config.flags.petHair.pricePct;
    flagDurationMin += config.flags.petHair.durationMin;
    flagLabels.push("Pet hair");
  }
  if (input.flags.stains) {
    flagPriceAdj += baseForAdjustments * config.flags.stains.pricePct;
    flagDurationMin += config.flags.stains.durationMin;
    flagLabels.push("Stains");
  }
  if (input.flags.heavyDirt) {
    flagPriceAdj += baseForAdjustments * config.flags.heavyDirt.pricePct;
    flagDurationMin += config.flags.heavyDirt.durationMin;
    flagLabels.push("Heavy dirt");
  }
  if (flagPriceAdj > 0.5) {
    lines.push({
      label: "Condition flags",
      amount: flagPriceAdj,
      detail: flagLabels.join(" · "),
    });
  }

  /* 6. Total labor hours --------------------------------------------- */
  const adjustedBaseDuration = baseDurationMin * sizeMod.duration * cMod.duration;
  const totalDurationMin = adjustedBaseDuration + flagDurationMin;
  const laborHours = totalDurationMin / 60;

  /* 7. Subtotal so far ----------------------------------------------- */
  let runningTotal = packageSubtotal + addonSubtotal + sizeAdj + condAdj + flagPriceAdj;

  /* 8. Profit floor — bump up if effective $/hr is below the minimum -- */
  let minProtectionApplied = false;
  const effectiveBeforeProtection =
    laborHours > 0 ? runningTotal / laborHours : 0;
  if (laborHours > 0 && effectiveBeforeProtection < config.hourlyMinRate) {
    const bumped = laborHours * config.hourlyMinRate;
    const delta = bumped - runningTotal;
    if (delta > 0.5) {
      runningTotal = bumped;
      minProtectionApplied = true;
      lines.push({
        label: "Labor floor",
        amount: delta,
        detail: `${laborHours.toFixed(1)} hr × $${config.hourlyMinRate}/hr minimum`,
      });
    }
  }

  /* 9. Hard minimum --------------------------------------------------- */
  let minBookingApplied = false;
  if (runningTotal < config.minBookingPrice) {
    const delta = config.minBookingPrice - runningTotal;
    runningTotal = config.minBookingPrice;
    minBookingApplied = true;
    if (delta > 0.5) {
      lines.push({
        label: "Minimum booking",
        amount: delta,
        detail: `Floor: $${config.minBookingPrice}`,
      });
    }
  }

  /* 10. Round to the nearest $rounding ------------------------------- */
  const rawSubtotal = runningTotal;
  const rounding = Math.max(1, config.rounding);
  const estimate = Math.round(runningTotal / rounding) * rounding;

  const effectiveHourlyRate = laborHours > 0 ? estimate / laborHours : 0;

  /* 11. Policy notes — non-monetary informational items the UI can show
   *  alongside the breakdown. Currently only the travel policy lives here;
   *  the geocoding-based auto-bill version is deferred to a later phase. */
  const policyNotes: Array<{ label: string; detail: string }> = [];
  if (config.travel?.enabled) {
    const t = config.travel;
    const tail =
      t.maxMiles > t.freeRadiusMiles
        ? ` to ${t.maxMiles} mi`
        : "";
    policyNotes.push({
      label: "Travel",
      detail: `First ${t.freeRadiusMiles} mi included · $${t.perMileRate.toFixed(2)}/mi${tail} · beyond ${t.maxMiles} mi by quote`,
    });
  }

  return {
    estimate,
    rawSubtotal,
    lines,
    laborHours,
    effectiveHourlyRate,
    minProtectionApplied,
    minBookingApplied,
    policyNotes,
  };
}

/* ─── Service price range ────────────────────────────────────────────── */

/** Pick the size key whose `price` multiplier sits at the extreme requested.
 *  Falls back to the sedan baseline (1.0) when the config is empty. */
function pickSizeKeyByPrice(
  config: PricingConfig,
  end: "min" | "max",
): string {
  const entries = Object.entries(config.vehicleSize);
  if (entries.length === 0) return "";
  return entries.reduce((acc, cur) =>
    end === "min"
      ? cur[1].price < acc[1].price ? cur : acc
      : cur[1].price > acc[1].price ? cur : acc,
  )[0];
}

function pickConditionKeyByPrice(
  config: PricingConfig,
  end: "min" | "max",
): string {
  const entries = Object.entries(config.condition);
  if (entries.length === 0) return "";
  return entries.reduce((acc, cur) =>
    end === "min"
      ? cur[1].price < acc[1].price ? cur : acc
      : cur[1].price > acc[1].price ? cur : acc,
  )[0];
}

/**
 * Realistic min/max final quote for a single service across the full
 * configurator input space. Mirrors what the calculator would actually
 * produce — vehicle size, condition, flags, and all engine floors
 * (hourly minimum, min booking, rounding) included.
 *
 * Low = smallest vehicle × lightest condition × no flags.
 * High = biggest vehicle × heaviest condition × every flag.
 *
 * The displayed `priceLow` / `priceHigh` columns on a service are
 * advisory only; this helper returns the real envelope the customer
 * could be quoted in. Used by the /book service tiles and Step 1.
 */
export function computeServicePriceRange(
  service: PublicService,
  config: PricingConfig,
): { low: number; high: number } {
  const sizeMin = pickSizeKeyByPrice(config, "min");
  const sizeMax = pickSizeKeyByPrice(config, "max");
  const condMin = pickConditionKeyByPrice(config, "min");
  const condMax = pickConditionKeyByPrice(config, "max");

  const low = computeQuote(
    {
      packages: [service],
      addons: [],
      vehicleSize: sizeMin,
      interiorCondition: condMin,
      exteriorCondition: condMin,
      flags: { petHair: false, stains: false, heavyDirt: false },
    },
    config,
  ).estimate;

  const high = computeQuote(
    {
      packages: [service],
      addons: [],
      vehicleSize: sizeMax,
      interiorCondition: condMax,
      exteriorCondition: condMax,
      flags: { petHair: true, stains: true, heavyDirt: true },
    },
    config,
  ).estimate;

  return { low, high };
}
