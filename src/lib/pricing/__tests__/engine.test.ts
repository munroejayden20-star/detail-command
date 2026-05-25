import { describe, it, expect } from "vitest";
import { computeQuote } from "../engine";
import { DEFAULT_PRICING_CONFIG } from "../config";
import type { QuoteInput } from "../types";
import type { PublicService } from "@/lib/booking-api";

/* ─────────────────────────────────────────────────────────────────────────────
 * Engine tests — pure-function correctness on the default config. Each test
 * starts from a known input and asserts that the math composes correctly
 * through every step. Modifiers tuned in config.ts are intentionally
 * checked here so a future tweak to a multiplier is caught immediately if
 * it produces a non-sensical result.
 * ──────────────────────────────────────────────────────────────────────── */

/** Build a service object with sensible defaults for testing. */
function svc(overrides: Partial<PublicService> & { id: string; priceLow: number }): PublicService {
  return {
    name: "Test Service",
    description: "",
    durationMinutes: 120,
    isAddon: false,
    discount: undefined,
    priceHigh: overrides.priceHigh ?? overrides.priceLow,
    ...overrides,
  };
}

const SEDAN_AVERAGE: Omit<QuoteInput, "packages" | "addons"> = {
  vehicleSize: "sedan",
  interiorCondition: "average",
  exteriorCondition: "average",
  flags: { petHair: false, stains: false, heavyDirt: false },
};

describe("computeQuote — baselines", () => {
  it("returns the minimum booking floor for an empty request", () => {
    const q = computeQuote(
      { packages: [], addons: [], ...SEDAN_AVERAGE },
      DEFAULT_PRICING_CONFIG,
    );
    expect(q.minBookingApplied).toBe(true);
    expect(q.estimate).toBe(DEFAULT_PRICING_CONFIG.minBookingPrice);
  });

  it("sedan + average has no size/condition deltas (all modifiers = 1.0)", () => {
    const pkg = svc({ id: "p1", priceLow: 200, durationMinutes: 240 });
    const q = computeQuote(
      { packages: [pkg], addons: [], ...SEDAN_AVERAGE },
      DEFAULT_PRICING_CONFIG,
    );
    // Sedan + average is the 1.0 baseline. No size/condition lines should appear.
    const labels = q.lines.map((l) => l.label);
    expect(labels.some((l) => l.startsWith("Vehicle size"))).toBe(false);
    expect(labels.some((l) => l.startsWith("Condition ·"))).toBe(false);
  });

  it("rounds the final estimate to the configured increment", () => {
    const pkg = svc({ id: "p1", priceLow: 197, durationMinutes: 180 });
    const q = computeQuote(
      { packages: [pkg], addons: [], ...SEDAN_AVERAGE },
      DEFAULT_PRICING_CONFIG,
    );
    expect(q.estimate % DEFAULT_PRICING_CONFIG.rounding).toBe(0);
  });
});

describe("computeQuote — size + condition modifiers", () => {
  it("suv_truck applies a positive size adjustment vs sedan baseline", () => {
    const pkg = svc({ id: "p1", priceLow: 200, durationMinutes: 240 });
    const sedan = computeQuote(
      { packages: [pkg], addons: [], ...SEDAN_AVERAGE },
      DEFAULT_PRICING_CONFIG,
    );
    const suv = computeQuote(
      { packages: [pkg], addons: [], ...SEDAN_AVERAGE, vehicleSize: "suv_truck" },
      DEFAULT_PRICING_CONFIG,
    );
    expect(suv.estimate).toBeGreaterThan(sedan.estimate);
    const sizeLine = suv.lines.find((l) => l.label.startsWith("Vehicle size"));
    expect(sizeLine).toBeDefined();
    expect(sizeLine!.amount).toBeGreaterThan(0);
  });

  it("heavy condition applies a positive delta and longer labor hours", () => {
    const pkg = svc({ id: "p1", priceLow: 200, durationMinutes: 240 });
    const avg = computeQuote(
      { packages: [pkg], addons: [], ...SEDAN_AVERAGE },
      DEFAULT_PRICING_CONFIG,
    );
    const heavy = computeQuote(
      {
        packages: [pkg],
        addons: [],
        ...SEDAN_AVERAGE,
        interiorCondition: "heavy",
      },
      DEFAULT_PRICING_CONFIG,
    );
    expect(heavy.estimate).toBeGreaterThan(avg.estimate);
    expect(heavy.laborHours).toBeGreaterThan(avg.laborHours);
  });

  it("takes the WORSE of interior/exterior condition (no double-count)", () => {
    const pkg = svc({ id: "p1", priceLow: 200, durationMinutes: 240 });
    const oneHeavy = computeQuote(
      {
        packages: [pkg],
        addons: [],
        ...SEDAN_AVERAGE,
        interiorCondition: "heavy",
        exteriorCondition: "average",
      },
      DEFAULT_PRICING_CONFIG,
    );
    const bothHeavy = computeQuote(
      {
        packages: [pkg],
        addons: [],
        ...SEDAN_AVERAGE,
        interiorCondition: "heavy",
        exteriorCondition: "heavy",
      },
      DEFAULT_PRICING_CONFIG,
    );
    // Should be IDENTICAL — worst-side wins, so adding heavy to the other
    // side doesn't move the quote.
    expect(oneHeavy.estimate).toBe(bothHeavy.estimate);
  });
});

describe("computeQuote — add-ons + quantity", () => {
  // Use high-rate scenarios so the labor floor doesn't kick in and we can
  // isolate the addon-multiplication math.
  it("multiplies addon price by quantity", () => {
    const pkg = svc({ id: "p1", priceLow: 400, durationMinutes: 60 });
    const addon = svc({ id: "a1", priceLow: 15, isAddon: true, durationMinutes: 10 });
    const q1 = computeQuote(
      {
        packages: [pkg],
        addons: [{ service: addon, quantity: 1 }],
        ...SEDAN_AVERAGE,
      },
      DEFAULT_PRICING_CONFIG,
    );
    const q3 = computeQuote(
      {
        packages: [pkg],
        addons: [{ service: addon, quantity: 3 }],
        ...SEDAN_AVERAGE,
      },
      DEFAULT_PRICING_CONFIG,
    );
    expect(q1.minProtectionApplied).toBe(false);
    expect(q3.minProtectionApplied).toBe(false);
    // Difference should be 2 × $15 = $30 more, modulo rounding.
    expect(q3.estimate - q1.estimate).toBe(30);
  });

  it("quantity is clamped to at least 1", () => {
    const pkg = svc({ id: "p1", priceLow: 400, durationMinutes: 60 });
    const addon = svc({ id: "a1", priceLow: 15, isAddon: true, durationMinutes: 10 });
    const q = computeQuote(
      {
        packages: [pkg],
        addons: [{ service: addon, quantity: 0 }],
        ...SEDAN_AVERAGE,
      },
      DEFAULT_PRICING_CONFIG,
    );
    // Quantity 0 is treated as 1 (the engine refuses to make things free).
    const addonLine = q.lines.find((l) => l.label === "Add-ons");
    expect(addonLine?.amount).toBe(15);
  });
});

describe("computeQuote — flags", () => {
  it("each enabled flag adds price + labor", () => {
    const pkg = svc({ id: "p1", priceLow: 200, durationMinutes: 240 });
    const none = computeQuote(
      { packages: [pkg], addons: [], ...SEDAN_AVERAGE },
      DEFAULT_PRICING_CONFIG,
    );
    const withFlags = computeQuote(
      {
        packages: [pkg],
        addons: [],
        ...SEDAN_AVERAGE,
        flags: { petHair: true, stains: true, heavyDirt: true },
      },
      DEFAULT_PRICING_CONFIG,
    );
    expect(withFlags.estimate).toBeGreaterThan(none.estimate);
    expect(withFlags.laborHours).toBeGreaterThan(none.laborHours);
    const flagLine = withFlags.lines.find((l) => l.label === "Condition flags");
    expect(flagLine).toBeDefined();
    expect(flagLine!.detail).toContain("Pet hair");
    expect(flagLine!.detail).toContain("Stains");
    expect(flagLine!.detail).toContain("Heavy dirt");
  });
});

describe("computeQuote — profit + minimum protection", () => {
  it("applies the labor floor when the natural quote is below the hourly minimum", () => {
    // 8 hours of labor for $100 = $12.50/hr. Floor is $65/hr, so engine
    // should bump to 8 × $65 = $520 (then ceiling to rounding).
    const pkg = svc({ id: "p1", priceLow: 100, durationMinutes: 480 });
    const q = computeQuote(
      { packages: [pkg], addons: [], ...SEDAN_AVERAGE },
      DEFAULT_PRICING_CONFIG,
    );
    expect(q.minProtectionApplied).toBe(true);
    expect(q.estimate).toBeGreaterThanOrEqual(8 * 65 - DEFAULT_PRICING_CONFIG.rounding);
    const floor = q.lines.find((l) => l.label === "Labor floor");
    expect(floor).toBeDefined();
  });

  it("does NOT apply the labor floor when the quote is already above it", () => {
    // 1 hour @ $200 = $200/hr — well above the $65 floor.
    const pkg = svc({ id: "p1", priceLow: 200, durationMinutes: 60 });
    const q = computeQuote(
      { packages: [pkg], addons: [], ...SEDAN_AVERAGE },
      DEFAULT_PRICING_CONFIG,
    );
    expect(q.minProtectionApplied).toBe(false);
  });

  it("clamps below-minimum quotes up to the minimum booking floor", () => {
    // A trivial $30 service shouldn't quote at $30.
    const pkg = svc({ id: "p1", priceLow: 30, durationMinutes: 15 });
    const q = computeQuote(
      { packages: [pkg], addons: [], ...SEDAN_AVERAGE },
      DEFAULT_PRICING_CONFIG,
    );
    expect(q.estimate).toBeGreaterThanOrEqual(DEFAULT_PRICING_CONFIG.minBookingPrice);
  });
});

describe("computeQuote — travel policy", () => {
  it("adds travel policy to policyNotes when enabled (no $ impact)", () => {
    const pkg = svc({ id: "p1", priceLow: 200, durationMinutes: 120 });
    const baseline = computeQuote(
      { packages: [pkg], addons: [], ...SEDAN_AVERAGE },
      DEFAULT_PRICING_CONFIG,
    );
    const withTravel = computeQuote(
      { packages: [pkg], addons: [], ...SEDAN_AVERAGE },
      {
        ...DEFAULT_PRICING_CONFIG,
        travel: { enabled: true, freeRadiusMiles: 15, perMileRate: 1.5, maxMiles: 40 },
      },
    );
    // Travel is informational — the dollar estimate should NOT change.
    expect(withTravel.estimate).toBe(baseline.estimate);
    // But the policy note shows up.
    expect(withTravel.policyNotes.length).toBe(1);
    expect(withTravel.policyNotes[0].label).toBe("Travel");
    expect(withTravel.policyNotes[0].detail).toMatch(/15/);
  });

  it("omits travel policy when disabled", () => {
    const pkg = svc({ id: "p1", priceLow: 200, durationMinutes: 120 });
    const q = computeQuote(
      { packages: [pkg], addons: [], ...SEDAN_AVERAGE },
      DEFAULT_PRICING_CONFIG,
    );
    expect(q.policyNotes.length).toBe(0);
  });
});

describe("computeQuote — breakdown lines", () => {
  it("breakdown lines are ordered (packages → addons → adjustments → floors)", () => {
    const pkg = svc({ id: "p1", priceLow: 200, durationMinutes: 240 });
    const addon = svc({ id: "a1", priceLow: 15, isAddon: true });
    const q = computeQuote(
      {
        packages: [pkg],
        addons: [{ service: addon, quantity: 2 }],
        ...SEDAN_AVERAGE,
        vehicleSize: "suv_truck",
        interiorCondition: "heavy",
        flags: { petHair: true, stains: false, heavyDirt: false },
      },
      DEFAULT_PRICING_CONFIG,
    );
    const labels = q.lines.map((l) => l.label);
    const packageIdx = labels.indexOf("Package");
    const addonIdx = labels.indexOf("Add-ons");
    const sizeIdx = labels.findIndex((l) => l.startsWith("Vehicle size"));
    const condIdx = labels.findIndex((l) => l.startsWith("Condition ·"));
    expect(packageIdx).toBeLessThan(addonIdx);
    expect(addonIdx).toBeLessThan(sizeIdx);
    expect(sizeIdx).toBeLessThan(condIdx);
  });
});
