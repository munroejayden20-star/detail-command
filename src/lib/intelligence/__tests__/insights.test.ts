/**
 * Tests for the insights engine. Each insight family must:
 *   - fire when the underlying signal is interesting
 *   - suppress when sample size is too small
 *   - not double-fire when the data hasn't changed
 */
import { describe, it, expect } from "vitest";
import type {
  AppData,
  Appointment,
  Customer,
  Lead,
  Receipt,
  Service,
  Settings,
} from "@/lib/types";
import { buildBusinessInsights } from "../insights";

const NOW = new Date("2026-05-15T12:00:00Z");

function daysAgo(d: number): string {
  return new Date(NOW.getTime() - d * 86_400_000).toISOString();
}

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

const customer: Customer = {
  id: "c1",
  name: "Alice",
  phone: "+1",
  vehicles: [],
  createdAt: daysAgo(180),
};

function appt(overrides: Partial<Appointment>): Appointment {
  return {
    id: "a",
    customerId: "c1",
    vehicle: { year: "2020", make: "Honda", model: "Civic", color: "Red" },
    address: "x",
    start: daysAgo(1),
    end: daysAgo(0.96),
    serviceIds: [],
    addonIds: [],
    estimatedPrice: 200,
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

const fullDetail: Service = {
  id: "s1",
  name: "Full Detail",
  priceLow: 200,
  priceHigh: 250,
  durationMinutes: 180,
};

/* ─────────────────────────────────────────────
   Pricing drift
───────────────────────────────────────────── */

describe("insight: pricing_drift", () => {
  it("fires when avg final consistently exceeds quote across enough samples", () => {
    const appts = Array.from({ length: 5 }, (_, i) =>
      appt({
        id: `a${i}`,
        serviceIds: ["s1"],
        status: "completed",
        estimatedPrice: 200,
        finalPrice: 240, // +$40 each
        start: daysAgo(60 - i * 5),
      }),
    );
    const data = emptyData({
      customers: [customer],
      services: [fullDetail],
      appointments: appts,
    });
    const found = buildBusinessInsights(data, NOW).find((i) => i.type === "pricing_drift");
    expect(found).toBeDefined();
    expect(found?.title).toContain("above quote");
  });

  it("does not fire below the minimum sample threshold", () => {
    const data = emptyData({
      customers: [customer],
      services: [fullDetail],
      appointments: [
        appt({
          id: "a1",
          serviceIds: ["s1"],
          status: "completed",
          estimatedPrice: 200,
          finalPrice: 240,
        }),
      ],
    });
    expect(
      buildBusinessInsights(data, NOW).find((i) => i.type === "pricing_drift"),
    ).toBeUndefined();
  });

  it("does not fire when the average delta is small", () => {
    const appts = Array.from({ length: 4 }, (_, i) =>
      appt({
        id: `a${i}`,
        serviceIds: ["s1"],
        status: "completed",
        estimatedPrice: 200,
        finalPrice: 205, // tiny delta
        start: daysAgo(60 - i * 5),
      }),
    );
    const data = emptyData({
      customers: [customer],
      services: [fullDetail],
      appointments: appts,
    });
    expect(
      buildBusinessInsights(data, NOW).find((i) => i.type === "pricing_drift"),
    ).toBeUndefined();
  });
});

/* ─────────────────────────────────────────────
   Duration drift
───────────────────────────────────────────── */

describe("insight: duration_drift", () => {
  it("fires when actual duration consistently exceeds configured by > threshold", () => {
    const startTimes = [
      "2026-04-01T15:00:00Z",
      "2026-04-08T15:00:00Z",
      "2026-04-15T15:00:00Z",
      "2026-04-22T15:00:00Z",
    ];
    const appts = startTimes.map((t, i) => {
      const start = new Date(t);
      const actualStart = new Date(start.getTime());
      // Configured 180 min, actuals 220 min → +40 min drift
      const actualEnd = new Date(start.getTime() + 220 * 60 * 1000);
      return appt({
        id: `a${i}`,
        serviceIds: ["s1"],
        status: "completed",
        start: t,
        end: new Date(start.getTime() + 180 * 60 * 1000).toISOString(),
        actualStartAt: actualStart.toISOString(),
        actualEndAt: actualEnd.toISOString(),
      });
    });
    const data = emptyData({
      customers: [customer],
      services: [fullDetail],
      appointments: appts,
    });
    const found = buildBusinessInsights(data, NOW).find((i) => i.type === "duration_drift");
    expect(found).toBeDefined();
    expect(found?.title).toContain("over your estimate");
  });
});

/* ─────────────────────────────────────────────
   Lead source winner
───────────────────────────────────────────── */

describe("insight: lead_source_winner", () => {
  it("fires for the highest-converting source with enough leads", () => {
    const leads: Lead[] = [
      // Dealership: 4 leads, 3 booked → 75%
      { id: "l1", name: "Alice", source: "dealership", interest: "low", status: "booked", createdAt: daysAgo(20) },
      { id: "l2", name: "Bob", source: "dealership", interest: "low", status: "booked", createdAt: daysAgo(20) },
      { id: "l3", name: "Carol", source: "dealership", interest: "low", status: "booked", createdAt: daysAgo(20) },
      { id: "l4", name: "Dave", source: "dealership", interest: "low", status: "lost", createdAt: daysAgo(20) },
      // Facebook: 4 leads, 1 booked → 25%
      { id: "l5", name: "Eve", source: "facebook", interest: "low", status: "booked", createdAt: daysAgo(20) },
      { id: "l6", name: "Frank", source: "facebook", interest: "low", status: "lost", createdAt: daysAgo(20) },
      { id: "l7", name: "Grace", source: "facebook", interest: "low", status: "lost", createdAt: daysAgo(20) },
      { id: "l8", name: "Helen", source: "facebook", interest: "low", status: "lost", createdAt: daysAgo(20) },
    ];
    const data = emptyData({ leads });
    const found = buildBusinessInsights(data, NOW).find((i) => i.type === "lead_source_winner");
    expect(found).toBeDefined();
    expect(found?.title).toContain("dealership");
    expect(found?.metadata?.["source"]).toBe("dealership");
  });

  it("does not fire when no source has any conversions", () => {
    const leads: Lead[] = Array.from({ length: 5 }, (_, i) => ({
      id: `l${i}`,
      name: `Lead${i}`,
      source: "facebook" as const,
      interest: "low" as const,
      status: "lost" as const,
      createdAt: daysAgo(20),
    }));
    const data = emptyData({ leads });
    expect(
      buildBusinessInsights(data, NOW).find((i) => i.type === "lead_source_winner"),
    ).toBeUndefined();
  });
});

/* ─────────────────────────────────────────────
   Rebook candidates aggregation
───────────────────────────────────────────── */

describe("insight: rebook_candidates", () => {
  it("fires when any customers are due/overdue", () => {
    const data = emptyData({
      customers: [customer],
      // Median 30d, last service 90d ago → overdue
      appointments: [
        appt({ id: "1", status: "completed", start: daysAgo(150), finalPrice: 200 }),
        appt({ id: "2", status: "completed", start: daysAgo(120), finalPrice: 200 }),
        appt({ id: "3", status: "completed", start: daysAgo(90), finalPrice: 200 }),
      ],
    });
    const found = buildBusinessInsights(data, NOW).find((i) => i.type === "rebook_candidates");
    expect(found).toBeDefined();
    expect(found?.metadata?.["count"]).toBe(1);
  });

  it("does not fire when no customer is due", () => {
    const data = emptyData({
      customers: [customer],
      appointments: [
        appt({ id: "1", status: "completed", start: daysAgo(60), finalPrice: 200 }),
        appt({ id: "2", status: "completed", start: daysAgo(30), finalPrice: 200 }),
        appt({ id: "3", status: "completed", start: daysAgo(5), finalPrice: 200 }),
      ],
    });
    expect(
      buildBusinessInsights(data, NOW).find((i) => i.type === "rebook_candidates"),
    ).toBeUndefined();
  });
});

/* ─────────────────────────────────────────────
   Workload outlook
───────────────────────────────────────────── */

describe("insight: workload_outlook", () => {
  it("fires with overloaded message when a day exceeds maxJobsPerDay", () => {
    const day = new Date(NOW.getTime() + 24 * 3600 * 1000);
    const data = emptyData({
      appointments: [1, 2, 3, 4, 5].map((i) =>
        appt({
          id: `${i}`,
          status: "scheduled",
          start: day.toISOString(),
          finalPrice: 200,
        }),
      ),
    });
    const found = buildBusinessInsights(data, NOW).find((i) => i.type === "workload_outlook");
    expect(found).toBeDefined();
    expect(found?.title).toContain("overloaded");
  });

  it("does not fire when the schedule is balanced and not noteworthy", () => {
    // 1 booked job, only 1 underbooked-day-out-of-7 → not enough to surface
    const data = emptyData({
      appointments: [
        appt({
          status: "scheduled",
          start: new Date(NOW.getTime() + 24 * 3600 * 1000).toISOString(),
        }),
        appt({
          id: "a2",
          status: "scheduled",
          start: new Date(NOW.getTime() + 48 * 3600 * 1000).toISOString(),
        }),
        appt({
          id: "a3",
          status: "scheduled",
          start: new Date(NOW.getTime() + 72 * 3600 * 1000).toISOString(),
        }),
        appt({
          id: "a4",
          status: "scheduled",
          start: new Date(NOW.getTime() + 96 * 3600 * 1000).toISOString(),
        }),
        appt({
          id: "a5",
          status: "scheduled",
          start: new Date(NOW.getTime() + 120 * 3600 * 1000).toISOString(),
        }),
        // 5 days with 1 each, 2 underbooked → 2 < UNDERBOOKED_DAYS_THRESHOLD (3)
      ],
    });
    const found = buildBusinessInsights(data, NOW).find((i) => i.type === "workload_outlook");
    // Above threshold of 3 underbooked needed
    expect(found).toBeUndefined();
  });
});

/* ─────────────────────────────────────────────
   Engine — overall behavior
───────────────────────────────────────────── */

describe("buildBusinessInsights", () => {
  it("produces no insights with empty data", () => {
    expect(buildBusinessInsights(emptyData(), NOW)).toEqual([]);
  });

  it("returns the same ids for the same inputs (stability)", () => {
    const appts = Array.from({ length: 5 }, (_, i) =>
      appt({
        id: `a${i}`,
        serviceIds: ["s1"],
        status: "completed",
        estimatedPrice: 200,
        finalPrice: 240,
        start: daysAgo(60 - i * 5),
      }),
    );
    const data = emptyData({
      customers: [customer],
      services: [fullDetail],
      appointments: appts,
    });
    const a = buildBusinessInsights(data, NOW).map((i) => i.id);
    const b = buildBusinessInsights(data, NOW).map((i) => i.id);
    expect(a).toEqual(b);
  });
});

// Reference unused imports to keep linters happy without changing tsconfig.
void ({} as Receipt);
