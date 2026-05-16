/**
 * Tests for Phase H4 pricing-intelligence:
 *   - buildPricingPatterns
 *   - buildCalculatorDrift
 */
import { describe, it, expect } from "vitest";
import type {
  AppData,
  Appointment,
  Customer,
  Service,
  Settings,
} from "@/lib/types";
import {
  buildPricingPatterns,
  buildCalculatorDrift,
} from "../pricing-intelligence";
import { CONFIDENCE_THRESHOLDS } from "../types";

/* ─────────────────────────────────────────────
   Fixtures
───────────────────────────────────────────── */

const baseSettings: Settings = {
  theme: "system",
  bufferMinutes: 30,
  maxJobsPerDay: 3,
  weekdayEvenings: true,
  weekdayUnavailableStart: "08:00",
  weekdayUnavailableEnd: "17:00",
  weekendAvailability: true,
  workdayStart: "08:00",
  workdayEnd: "18:00",
  defaultAppointmentDuration: 90,
  startupGoal: 0,
  businessName: "JMD",
  ownerName: "Jayden",
  contactPhone: "+13605551234",
};

const NOW = new Date("2026-05-15T12:00:00Z");

function daysAgo(d: number): string {
  return new Date(NOW.getTime() - d * 86_400_000).toISOString();
}

const customer: Customer = {
  id: "c1",
  name: "Alice",
  phone: "+1",
  vehicles: [],
  createdAt: daysAgo(365),
};

const svc: Service = {
  id: "s1",
  name: "Full Detail",
  priceLow: 200,
  priceHigh: 250,
  durationMinutes: 180,
};

function emptyData(overrides: Partial<AppData> = {}): AppData {
  return {
    version: 1,
    customers: [customer],
    appointments: [],
    leads: [],
    tasks: [],
    services: [svc],
    expenses: [],
    startup: [],
    templates: [],
    checklists: [],
    blocks: [],
    photos: [],
    notifications: [],
    receipts: [],
    mileageEntries: [],
    settings: baseSettings,
    ...overrides,
  };
}

function appt(overrides: Partial<Appointment>): Appointment {
  return {
    id: "a",
    customerId: "c1",
    vehicle: { year: "2022", make: "Toyota", model: "Camry", color: "White" },
    address: "123 Main",
    start: daysAgo(1),
    end: daysAgo(0.9),
    serviceIds: ["s1"],
    addonIds: [],
    estimatedPrice: 200,
    finalPrice: 225,
    depositPaid: false,
    paymentStatus: "paid",
    status: "completed",
    petHair: false,
    stains: false,
    heavyDirt: false,
    waterAccess: true,
    powerAccess: true,
    createdAt: daysAgo(7),
    ...overrides,
  };
}

/* ─────────────────────────────────────────────
   buildPricingPatterns
───────────────────────────────────────────── */

describe("buildPricingPatterns", () => {
  it("returns empty array for no data", () => {
    expect(buildPricingPatterns(emptyData())).toEqual([]);
  });

  it("suppresses patterns below MIN_SAMPLE_FOR_INSIGHT", () => {
    const data = emptyData({
      appointments: [
        appt({ id: "a1", estimatedPrice: 200, finalPrice: 250 }),
        appt({ id: "a2", estimatedPrice: 200, finalPrice: 250 }),
        // Only 2 samples — below threshold of 3
      ],
    });
    expect(buildPricingPatterns(data)).toHaveLength(0);
  });

  it("emits a pattern at exactly MIN_SAMPLE_FOR_INSIGHT (3) samples", () => {
    const data = emptyData({
      appointments: [
        appt({ id: "a1", estimatedPrice: 200, finalPrice: 230 }),
        appt({ id: "a2", estimatedPrice: 200, finalPrice: 230 }),
        appt({ id: "a3", estimatedPrice: 200, finalPrice: 230 }),
      ],
    });
    const patterns = buildPricingPatterns(data);
    expect(patterns.length).toBeGreaterThanOrEqual(1);
  });

  it("computes correct averages and delta", () => {
    // 3 jobs: est=$200, finals: $220, $230, $240 → avg final=$230, avg quoted=$200, delta=+$30
    const data = emptyData({
      appointments: [
        appt({ id: "a1", estimatedPrice: 200, finalPrice: 220 }),
        appt({ id: "a2", estimatedPrice: 200, finalPrice: 230 }),
        appt({ id: "a3", estimatedPrice: 200, finalPrice: 240 }),
      ],
    });
    const patterns = buildPricingPatterns(data);
    const p = patterns.find((x) => x.serviceId === "s1");
    expect(p).toBeDefined();
    expect(p!.quotedAvgCents).toBe(20000);
    expect(p!.finalAvgCents).toBe(23000);
    expect(p!.deltaAvgCents).toBe(3000); // +$30 in cents
    expect(p!.sampleSize).toBe(3);
  });

  it("groups by vehicleSize when provided", () => {
    // sedan and suv should land in different buckets
    const data = emptyData({
      appointments: [
        appt({ id: "a1", vehicle: { year: "2022", make: "Toyota", model: "Camry", color: "White", size: "sedan" }, estimatedPrice: 200, finalPrice: 220 }),
        appt({ id: "a2", vehicle: { year: "2022", make: "Toyota", model: "Camry", color: "White", size: "sedan" }, estimatedPrice: 200, finalPrice: 220 }),
        appt({ id: "a3", vehicle: { year: "2022", make: "Toyota", model: "Camry", color: "White", size: "sedan" }, estimatedPrice: 200, finalPrice: 220 }),
        appt({ id: "a4", vehicle: { year: "2021", make: "Ford", model: "Explorer", color: "Black", size: "suv" }, estimatedPrice: 250, finalPrice: 280 }),
        appt({ id: "a5", vehicle: { year: "2021", make: "Ford", model: "Explorer", color: "Black", size: "suv" }, estimatedPrice: 250, finalPrice: 280 }),
        appt({ id: "a6", vehicle: { year: "2021", make: "Ford", model: "Explorer", color: "Black", size: "suv" }, estimatedPrice: 250, finalPrice: 280 }),
      ],
    });
    const patterns = buildPricingPatterns(data);
    const sedanPattern = patterns.find((p) => p.vehicleSize === "sedan");
    const suvPattern = patterns.find((p) => p.vehicleSize === "suv");
    expect(sedanPattern).toBeDefined();
    expect(suvPattern).toBeDefined();
    expect(sedanPattern?.quotedAvgCents).toBe(20000);
    expect(suvPattern?.quotedAvgCents).toBe(25000);
  });

  it("skips appointments without estimatedPrice", () => {
    const data = emptyData({
      appointments: [
        appt({ id: "a1", estimatedPrice: 0, finalPrice: 230 }),
        appt({ id: "a2", estimatedPrice: 0, finalPrice: 230 }),
        appt({ id: "a3", estimatedPrice: 0, finalPrice: 230 }),
      ],
    });
    expect(buildPricingPatterns(data)).toHaveLength(0);
  });

  it("skips appointments without finalPrice", () => {
    const data = emptyData({
      appointments: [
        appt({ id: "a1", estimatedPrice: 200, finalPrice: undefined }),
        appt({ id: "a2", estimatedPrice: 200, finalPrice: undefined }),
        appt({ id: "a3", estimatedPrice: 200, finalPrice: undefined }),
      ],
    });
    expect(buildPricingPatterns(data)).toHaveLength(0);
  });

  it("skips non-completed appointments", () => {
    const data = emptyData({
      appointments: [
        appt({ id: "a1", status: "scheduled", estimatedPrice: 200, finalPrice: 250 }),
        appt({ id: "a2", status: "canceled", estimatedPrice: 200, finalPrice: 250 }),
        appt({ id: "a3", status: "in_progress", estimatedPrice: 200, finalPrice: 250 }),
      ],
    });
    expect(buildPricingPatterns(data)).toHaveLength(0);
  });

  it("confidence is 'low' at 3 samples", () => {
    const data = emptyData({
      appointments: [
        appt({ id: "a1", estimatedPrice: 200, finalPrice: 250 }),
        appt({ id: "a2", estimatedPrice: 200, finalPrice: 250 }),
        appt({ id: "a3", estimatedPrice: 200, finalPrice: 250 }),
      ],
    });
    const [pattern] = buildPricingPatterns(data);
    expect(pattern.confidence).toBe("low");
  });

  it("confidence is 'high' at 8+ samples", () => {
    const appointments = Array.from({ length: 8 }, (_, i) =>
      appt({ id: `a${i}`, estimatedPrice: 200, finalPrice: 250, start: daysAgo(i * 15) }),
    );
    const data = emptyData({ appointments });
    const pattern = buildPricingPatterns(data).find((p) => p.sampleSize >= 8);
    expect(pattern?.confidence).toBe("high");
  });

  it("handles finalPriceCents (newer field) as well as legacy finalPrice", () => {
    const data = emptyData({
      appointments: [
        appt({ id: "a1", estimatedPrice: 200, finalPrice: undefined, finalPriceCents: 25000 }),
        appt({ id: "a2", estimatedPrice: 200, finalPrice: undefined, finalPriceCents: 25000 }),
        appt({ id: "a3", estimatedPrice: 200, finalPrice: undefined, finalPriceCents: 25000 }),
      ],
    });
    const patterns = buildPricingPatterns(data);
    const p = patterns.find((x) => x.serviceId === "s1");
    expect(p).toBeDefined();
    expect(p!.finalAvgCents).toBe(25000);
  });
});

/* ─────────────────────────────────────────────
   buildCalculatorDrift
───────────────────────────────────────────── */

describe("buildCalculatorDrift", () => {
  it("returns null when no pattern exists", () => {
    expect(buildCalculatorDrift(emptyData(), "s1")).toBeNull();
  });

  it("returns null when delta is below $15 (1500 cents)", () => {
    // delta = $10 — below threshold
    const data = emptyData({
      appointments: [
        appt({ id: "a1", estimatedPrice: 200, finalPrice: 210 }),
        appt({ id: "a2", estimatedPrice: 200, finalPrice: 210 }),
        appt({ id: "a3", estimatedPrice: 200, finalPrice: 210 }),
      ],
    });
    expect(buildCalculatorDrift(data, "s1")).toBeNull();
  });

  it("returns non-null when delta exceeds $15 and sample size is sufficient", () => {
    // delta = $25 per job
    const data = emptyData({
      appointments: [
        appt({ id: "a1", estimatedPrice: 200, finalPrice: 225 }),
        appt({ id: "a2", estimatedPrice: 200, finalPrice: 225 }),
        appt({ id: "a3", estimatedPrice: 200, finalPrice: 225 }),
      ],
    });
    const warning = buildCalculatorDrift(data, "s1");
    expect(warning).not.toBeNull();
    expect(warning?.patternDeltaCents).toBe(2500);
    expect(warning?.sampleSize).toBe(3);
  });

  it("suggestedMultiplier equals finalAvg / quotedAvg", () => {
    // est=$200, final=$250 → multiplier = 25000/20000 = 1.25
    const data = emptyData({
      appointments: [
        appt({ id: "a1", estimatedPrice: 200, finalPrice: 250 }),
        appt({ id: "a2", estimatedPrice: 200, finalPrice: 250 }),
        appt({ id: "a3", estimatedPrice: 200, finalPrice: 250 }),
      ],
    });
    const warning = buildCalculatorDrift(data, "s1");
    expect(warning?.suggestedMultiplier).toBeCloseTo(1.25, 2);
  });

  it("caps suggestedMultiplier at 2.0 (upper bound)", () => {
    // est=$50, final=$200 → raw multiplier = 4.0 → capped at 2.0
    const data = emptyData({
      appointments: [
        appt({ id: "a1", estimatedPrice: 50, finalPrice: 200 }),
        appt({ id: "a2", estimatedPrice: 50, finalPrice: 200 }),
        appt({ id: "a3", estimatedPrice: 50, finalPrice: 200 }),
      ],
    });
    const warning = buildCalculatorDrift(data, "s1");
    expect(warning?.suggestedMultiplier).toBe(2.0);
  });

  it("caps suggestedMultiplier at 0.5 (lower bound)", () => {
    // est=$200, final=$50 → raw multiplier = 0.25 → capped at 0.5
    const data = emptyData({
      appointments: [
        appt({ id: "a1", estimatedPrice: 200, finalPrice: 50 }),
        appt({ id: "a2", estimatedPrice: 200, finalPrice: 50 }),
        appt({ id: "a3", estimatedPrice: 200, finalPrice: 50 }),
      ],
    });
    const warning = buildCalculatorDrift(data, "s1");
    expect(warning?.suggestedMultiplier).toBe(0.5);
  });

  it("includes a non-empty summary string", () => {
    const data = emptyData({
      appointments: [
        appt({ id: "a1", estimatedPrice: 200, finalPrice: 225 }),
        appt({ id: "a2", estimatedPrice: 200, finalPrice: 225 }),
        appt({ id: "a3", estimatedPrice: 200, finalPrice: 225 }),
      ],
    });
    const warning = buildCalculatorDrift(data, "s1");
    expect(typeof warning?.summary).toBe("string");
    expect(warning!.summary.length).toBeGreaterThan(10);
  });

  it("matches by vehicleSize when provided", () => {
    // Two buckets: sedan (small delta) and suv (large delta)
    const data = emptyData({
      appointments: [
        appt({ id: "a1", vehicle: { year: "2022", make: "Toyota", model: "Camry", color: "White", size: "sedan" }, estimatedPrice: 200, finalPrice: 205 }),
        appt({ id: "a2", vehicle: { year: "2022", make: "Toyota", model: "Camry", color: "White", size: "sedan" }, estimatedPrice: 200, finalPrice: 205 }),
        appt({ id: "a3", vehicle: { year: "2022", make: "Toyota", model: "Camry", color: "White", size: "sedan" }, estimatedPrice: 200, finalPrice: 205 }),
        appt({ id: "a4", vehicle: { year: "2021", make: "Ford", model: "Explorer", color: "Black", size: "suv" }, estimatedPrice: 200, finalPrice: 240 }),
        appt({ id: "a5", vehicle: { year: "2021", make: "Ford", model: "Explorer", color: "Black", size: "suv" }, estimatedPrice: 200, finalPrice: 240 }),
        appt({ id: "a6", vehicle: { year: "2021", make: "Ford", model: "Explorer", color: "Black", size: "suv" }, estimatedPrice: 200, finalPrice: 240 }),
      ],
    });
    // sedan: $5 delta → below threshold → null
    expect(buildCalculatorDrift(data, "s1", "sedan")).toBeNull();
    // suv: $40 delta → above threshold → non-null
    expect(buildCalculatorDrift(data, "s1", "suv")).not.toBeNull();
  });

  it("returns null below MIN_SAMPLE_FOR_INSIGHT even if delta is large", () => {
    // Only 2 samples
    const data = emptyData({
      appointments: [
        appt({ id: "a1", estimatedPrice: 100, finalPrice: 300 }),
        appt({ id: "a2", estimatedPrice: 100, finalPrice: 300 }),
      ],
    });
    expect(buildCalculatorDrift(data, "s1")).toBeNull();
  });
});
