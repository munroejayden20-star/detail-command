/**
 * Tests for workload forecast + revenue pace.
 */
import { describe, it, expect } from "vitest";
import type {
  AppData,
  Appointment,
  Receipt,
  Settings,
} from "@/lib/types";
import { buildRevenuePace, buildWorkloadForecast } from "../forecasts";
import { toBusinessDateKey } from "@/lib/datetime";

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

function emptyData(overrides: Partial<AppData> = {}): AppData {
  return {
    version: 1,
    customers: [],
    appointments: [],
    leads: [],
    tasks: [],
    services: [],
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

const NOW = new Date("2026-05-10T12:00:00Z");

function appt(overrides: Partial<Appointment>): Appointment {
  return {
    id: "a",
    customerId: "c1",
    vehicle: { year: "2020", make: "Honda", model: "Civic", color: "Red" },
    address: "x",
    start: NOW.toISOString(),
    end: new Date(NOW.getTime() + 90 * 60 * 1000).toISOString(),
    serviceIds: [],
    addonIds: [],
    estimatedPrice: 200,
    depositPaid: false,
    paymentStatus: "unpaid",
    status: "scheduled",
    petHair: false,
    stains: false,
    heavyDirt: false,
    waterAccess: true,
    powerAccess: true,
    createdAt: NOW.toISOString(),
    ...overrides,
  };
}

function receipt(overrides: Partial<Receipt>): Receipt {
  return {
    id: "r",
    receiptNumber: "1",
    receiptStatus: "active",
    paymentStatus: "paid",
    paymentMethod: "cash",
    subtotalCents: 0,
    discountCents: 0,
    taxCents: 0,
    tipCents: 0,
    depositPaidCents: 0,
    totalCents: 0,
    amountPaidCents: 0,
    remainingBalanceCents: 0,
    currency: "usd",
    lineItems: [],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

/* ─────────────────────────────────────────────
   Workload forecast
───────────────────────────────────────────── */

describe("buildWorkloadForecast", () => {
  it("returns zero booked / full open capacity for empty data", () => {
    const fc = buildWorkloadForecast(emptyData(), 7, NOW);
    expect(fc.bookedJobs).toBe(0);
    expect(fc.bookedRevenueCents).toBe(0);
    expect(fc.openCapacity).toBe(7 * 3);
    expect(fc.underbookedDates).toHaveLength(7);
    expect(fc.overloadedDates).toHaveLength(0);
  });

  it("counts booked appointments in the next N days", () => {
    const data = emptyData({
      appointments: [
        appt({
          id: "1",
          status: "scheduled",
          start: new Date(NOW.getTime() + 24 * 3600 * 1000).toISOString(),
          finalPrice: 200,
        }),
        appt({
          id: "2",
          status: "confirmed",
          start: new Date(NOW.getTime() + 48 * 3600 * 1000).toISOString(),
          finalPrice: 250,
        }),
        appt({
          id: "3",
          status: "in_progress",
          start: new Date(NOW.getTime() + 72 * 3600 * 1000).toISOString(),
          estimatedPrice: 180,
        }),
      ],
    });
    const fc = buildWorkloadForecast(data, 7, NOW);
    expect(fc.bookedJobs).toBe(3);
    // Two finalPrice (in dollars) → 20000+25000 cents, plus estimated 18000 cents
    expect(fc.bookedRevenueCents).toBe(20000 + 25000 + 18000);
    expect(fc.openCapacity).toBe(7 * 3 - 3);
  });

  it("ignores past appointments", () => {
    const data = emptyData({
      appointments: [
        appt({
          status: "scheduled",
          start: new Date(NOW.getTime() - 48 * 3600 * 1000).toISOString(),
        }),
      ],
    });
    expect(buildWorkloadForecast(data, 7, NOW).bookedJobs).toBe(0);
  });

  it("ignores canceled / completed appointments", () => {
    const data = emptyData({
      appointments: [
        appt({
          id: "1",
          status: "canceled",
          start: new Date(NOW.getTime() + 24 * 3600 * 1000).toISOString(),
        }),
        appt({
          id: "2",
          status: "completed",
          start: new Date(NOW.getTime() + 24 * 3600 * 1000).toISOString(),
        }),
      ],
    });
    expect(buildWorkloadForecast(data, 7, NOW).bookedJobs).toBe(0);
  });

  it("flags overloaded dates", () => {
    // 5 jobs same day, max=3
    const day = new Date(NOW.getTime() + 24 * 3600 * 1000);
    const data = emptyData({
      appointments: [1, 2, 3, 4, 5].map((i) =>
        appt({ id: `${i}`, status: "scheduled", start: day.toISOString() }),
      ),
    });
    const fc = buildWorkloadForecast(data, 7, NOW);
    expect(fc.overloadedDates).toHaveLength(1);
    expect(fc.overloadedDates[0]).toBe(toBusinessDateKey(day));
  });

  it("flags underbooked dates (zero appointments)", () => {
    const data = emptyData({
      appointments: [
        // Only book day 1
        appt({
          status: "scheduled",
          start: new Date(NOW.getTime() + 24 * 3600 * 1000).toISOString(),
        }),
      ],
    });
    const fc = buildWorkloadForecast(data, 7, NOW);
    expect(fc.underbookedDates.length).toBe(6);
  });
});

/* ─────────────────────────────────────────────
   Revenue pace
───────────────────────────────────────────── */

describe("buildRevenuePace", () => {
  it("returns hasEnoughDataToProject=false on day 1 of month", () => {
    const day1 = new Date("2026-05-01T12:00:00Z");
    const pace = buildRevenuePace(emptyData(), day1);
    expect(pace.hasEnoughDataToProject).toBe(false);
    expect(pace.daysElapsed).toBe(1);
  });

  it("projects month-end based on current pace once 5+ days in", () => {
    // May 11 = day 11 (out of 31)
    const may11 = new Date("2026-05-11T12:00:00Z");
    const data = emptyData({
      receipts: [
        // $1000 collected so far across 11 days → projection 1000/11*31 ≈ $2818
        receipt({
          createdAt: "2026-05-05T00:00:00Z",
          amountPaidCents: 50000,
        }),
        receipt({
          id: "r2",
          createdAt: "2026-05-09T00:00:00Z",
          amountPaidCents: 50000,
        }),
      ],
    });
    const pace = buildRevenuePace(data, may11);
    expect(pace.hasEnoughDataToProject).toBe(true);
    expect(pace.collectedMtdCents).toBe(100000);
    // ~281818 cents ± rounding
    expect(pace.projectedMonthEndCents).toBe(Math.round(100000 / 11 * 31));
  });

  it("compares projection to last month's collected", () => {
    const may11 = new Date("2026-05-11T12:00:00Z");
    const data = emptyData({
      receipts: [
        // April 2026 finished at $3000
        receipt({
          id: "r1",
          createdAt: "2026-04-30T00:00:00Z",
          amountPaidCents: 300000,
        }),
        // May has $1000 over 11 days → projecting ~$2818 → ratio ~−0.06
        receipt({
          id: "r2",
          createdAt: "2026-05-05T00:00:00Z",
          amountPaidCents: 100000,
        }),
      ],
    });
    const pace = buildRevenuePace(data, may11);
    expect(pace.lastMonthCollectedCents).toBe(300000);
    expect(pace.projectionVsLastMonthRatio).toBeLessThan(0);
  });

  it("counts booked-but-not-collected jobs in the rest of the month", () => {
    const may11 = new Date("2026-05-11T12:00:00Z");
    const data = emptyData({
      appointments: [
        appt({
          status: "scheduled",
          start: "2026-05-20T18:00:00Z",
          finalPrice: 250,
        }),
        appt({
          id: "a2",
          status: "confirmed",
          start: "2026-05-25T18:00:00Z",
          finalPrice: 300,
        }),
        // June — out of month, ignored
        appt({
          id: "a3",
          status: "scheduled",
          start: "2026-06-01T18:00:00Z",
          finalPrice: 999,
        }),
      ],
    });
    const pace = buildRevenuePace(data, may11);
    expect(pace.bookedRemainingCents).toBe(25000 + 30000);
  });
});
