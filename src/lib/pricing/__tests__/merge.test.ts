import { describe, it, expect } from "vitest";
import { mergePricingConfig } from "../merge";
import { DEFAULT_PRICING_CONFIG } from "../config";

describe("mergePricingConfig", () => {
  it("returns defaults for null input", () => {
    expect(mergePricingConfig(null)).toEqual(DEFAULT_PRICING_CONFIG);
  });

  it("returns defaults for undefined input", () => {
    expect(mergePricingConfig(undefined)).toEqual(DEFAULT_PRICING_CONFIG);
  });

  it("overrides only the specified scalar without touching others", () => {
    const merged = mergePricingConfig({ hourlyMinRate: 90 });
    expect(merged.hourlyMinRate).toBe(90);
    expect(merged.minBookingPrice).toBe(DEFAULT_PRICING_CONFIG.minBookingPrice);
    expect(merged.rounding).toBe(DEFAULT_PRICING_CONFIG.rounding);
  });

  it("merges a partial vehicleSize map without losing other sizes", () => {
    const merged = mergePricingConfig({
      vehicleSize: {
        suv_truck: { price: 1.4, duration: 1.3, material: 1.25 },
      },
    });
    expect(merged.vehicleSize.suv_truck.price).toBe(1.4);
    // Other sizes preserved at defaults
    expect(merged.vehicleSize.sedan).toEqual(DEFAULT_PRICING_CONFIG.vehicleSize.sedan);
    expect(merged.vehicleSize.compact).toEqual(DEFAULT_PRICING_CONFIG.vehicleSize.compact);
  });

  it("merges a single flag without zeroing the others", () => {
    const merged = mergePricingConfig({
      flags: {
        petHair: { pricePct: 0.15, durationMin: 45 },
      } as never,
    });
    expect(merged.flags.petHair.pricePct).toBe(0.15);
    expect(merged.flags.stains).toEqual(DEFAULT_PRICING_CONFIG.flags.stains);
    expect(merged.flags.heavyDirt).toEqual(DEFAULT_PRICING_CONFIG.flags.heavyDirt);
  });

  it("merges travel sub-object", () => {
    const merged = mergePricingConfig({
      travel: { enabled: true, perMileRate: 2.0 } as never,
    });
    expect(merged.travel.enabled).toBe(true);
    expect(merged.travel.perMileRate).toBe(2.0);
    // Untouched fields inherit defaults.
    expect(merged.travel.freeRadiusMiles).toBe(
      DEFAULT_PRICING_CONFIG.travel.freeRadiusMiles,
    );
  });
});
