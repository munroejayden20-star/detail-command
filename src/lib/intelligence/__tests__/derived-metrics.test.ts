/**
 * Tests for BusinessSnapshot, customer/service profiles, and lead-source
 * performance. These are pure aggregations over AppData.
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
import {
  buildBusinessSnapshot,
  buildCustomerProfile,
  buildLeadSourcePerformance,
  buildServicePerformance,
} from "../derived-metrics";
import { rangeAllTime } from "../data-access";

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
function daysAgo(d: number): string {
  return new Date(NOW.getTime() - d * 86_400_000).toISOString();
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

function receipt(overrides: Partial<Receipt>): Receipt {
  return {
    id: "r",
    receiptNumber: "1",
    receiptStatus: "active",
    paymentStatus: "paid",
    paymentMethod: "cash",
    subtotalCents: 20000,
    discountCents: 0,
    taxCents: 0,
    tipCents: 0,
    depositPaidCents: 0,
    totalCents: 20000,
    amountPaidCents: 20000,
    remainingBalanceCents: 0,
    currency: "usd",
    lineItems: [],
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    ...overrides,
  };
}

/* ─────────────────────────────────────────────
   BusinessSnapshot
───────────────────────────────────────────── */

describe("buildBusinessSnapshot", () => {
  it("returns zeroes for empty data", () => {
    const snap = buildBusinessSnapshot(emptyData(), rangeAllTime());
    expect(snap.appointmentsTotal).toBe(0);
    expect(snap.collectedCents).toBe(0);
    expect(snap.averageTicketCents).toBe(0);
    expect(snap.estimatedNetProfitCents).toBe(0);
  });

  it("counts appointments by status", () => {
    const data = emptyData({
      customers: [customer],
      appointments: [
        appt({ id: "1", status: "completed" }),
        appt({ id: "2", status: "scheduled" }),
        appt({ id: "3", status: "canceled" }),
        appt({ id: "4", status: "pending_approval" }),
      ],
    });
    const snap = buildBusinessSnapshot(data, rangeAllTime());
    expect(snap.appointmentsCompleted).toBe(1);
    expect(snap.appointmentsScheduled).toBe(1);
    expect(snap.appointmentsCanceled).toBe(1);
    expect(snap.appointmentsPending).toBe(1);
  });

  it("computes average ticket from completed jobs", () => {
    const data = emptyData({
      customers: [customer],
      appointments: [
        appt({ id: "1", status: "completed", finalPrice: 200 }),
        appt({ id: "2", status: "completed", finalPrice: 300 }),
        appt({ id: "3", status: "completed", finalPriceCents: 25000 }),
      ],
    });
    const snap = buildBusinessSnapshot(data, rangeAllTime());
    expect(snap.appointmentsCompleted).toBe(3);
    expect(snap.averageTicketCents).toBe(Math.round((20000 + 30000 + 25000) / 3));
  });

  it("uses receipt amounts for collected revenue, not appointments", () => {
    const data = emptyData({
      customers: [customer],
      appointments: [appt({ status: "completed", finalPrice: 200 })],
      receipts: [receipt({ amountPaidCents: 18000 })],
    });
    const snap = buildBusinessSnapshot(data, rangeAllTime());
    expect(snap.collectedCents).toBe(18000);
  });

  it("subtracts credits from expenses", () => {
    const data = emptyData({
      expenses: [
        { id: "e1", date: daysAgo(1), category: "products", amount: 100 },
        { id: "e2", date: daysAgo(1), category: "products", amount: 25, kind: "credit" },
      ],
    });
    const snap = buildBusinessSnapshot(data, rangeAllTime());
    expect(snap.totalExpensesCents).toBe(7500);
  });

  it("computes lead conversion rate", () => {
    const data = emptyData({
      leads: [
        { id: "l1", name: "A", source: "facebook", interest: "low", status: "new", createdAt: daysAgo(5) },
        { id: "l2", name: "B", source: "facebook", interest: "low", status: "booked", createdAt: daysAgo(5) },
        { id: "l3", name: "C", source: "google", interest: "low", status: "lost", createdAt: daysAgo(5) },
        { id: "l4", name: "D", source: "google", interest: "low", status: "booked", createdAt: daysAgo(5) },
      ],
    });
    const snap = buildBusinessSnapshot(data, rangeAllTime());
    expect(snap.leadsCreated).toBe(4);
    expect(snap.leadsConverted).toBe(2);
    expect(snap.leadConversionRate).toBeCloseTo(0.5);
  });
});

/* ─────────────────────────────────────────────
   CustomerIntelligenceProfile
───────────────────────────────────────────── */

describe("buildCustomerProfile", () => {
  it("computes lifetime metrics + tier", () => {
    const data = emptyData({
      customers: [customer],
      appointments: [
        appt({ id: "1", status: "completed", start: daysAgo(120), finalPrice: 200 }),
        appt({ id: "2", status: "completed", start: daysAgo(60), finalPrice: 300 }),
        appt({ id: "3", status: "completed", start: daysAgo(30), finalPrice: 250 }),
      ],
    });
    const profile = buildCustomerProfile(data, customer, NOW);
    expect(profile.completedJobs).toBe(3);
    expect(profile.lifetimeRevenueCents).toBe(75000);
    expect(profile.averageTicketCents).toBe(25000);
    expect(profile.tier).toBe("high_value");
  });

  it("computes median rebook interval correctly", () => {
    const data = emptyData({
      customers: [customer],
      appointments: [
        appt({ id: "1", status: "completed", start: daysAgo(120), finalPrice: 100 }),
        appt({ id: "2", status: "completed", start: daysAgo(90), finalPrice: 100 }), // 30
        appt({ id: "3", status: "completed", start: daysAgo(60), finalPrice: 100 }), // 30
      ],
    });
    const profile = buildCustomerProfile(data, customer, NOW);
    expect(profile.medianRebookIntervalDays).toBe(30);
  });

  it("flags rebook status correctly", () => {
    // Overdue: last service 90 days ago, median 30 → 300% of median
    const overdue = emptyData({
      customers: [customer],
      appointments: [
        appt({ id: "1", status: "completed", start: daysAgo(150), finalPrice: 100 }),
        appt({ id: "2", status: "completed", start: daysAgo(120), finalPrice: 100 }),
        appt({ id: "3", status: "completed", start: daysAgo(90), finalPrice: 100 }),
      ],
    });
    expect(buildCustomerProfile(overdue, customer, NOW).rebookStatus).toBe("overdue");

    // Fresh: last service 5 days ago, median 30 → ~17%
    const fresh = emptyData({
      customers: [customer],
      appointments: [
        appt({ id: "1", status: "completed", start: daysAgo(65), finalPrice: 100 }),
        appt({ id: "2", status: "completed", start: daysAgo(35), finalPrice: 100 }),
        appt({ id: "3", status: "completed", start: daysAgo(5), finalPrice: 100 }),
      ],
    });
    expect(buildCustomerProfile(fresh, customer, NOW).rebookStatus).toBe("fresh");
  });

  it("returns rebookStatus=unknown with fewer than 2 services", () => {
    const data = emptyData({
      customers: [customer],
      appointments: [
        appt({ id: "1", status: "completed", start: daysAgo(60), finalPrice: 100 }),
      ],
    });
    expect(buildCustomerProfile(data, customer, NOW).rebookStatus).toBe("unknown");
  });

  it("computes open balance from active receipts", () => {
    const data = emptyData({
      customers: [customer],
      receipts: [
        receipt({ id: "r1", customerId: "c1", remainingBalanceCents: 5000 }),
        receipt({ id: "r2", customerId: "c1", remainingBalanceCents: 1000 }),
        // voided should be ignored
        receipt({
          id: "r3",
          customerId: "c1",
          receiptStatus: "voided",
          remainingBalanceCents: 99000,
        }),
      ],
    });
    expect(buildCustomerProfile(data, customer, NOW).openBalanceCents).toBe(6000);
  });
});

/* ─────────────────────────────────────────────
   ServicePerformanceProfile
───────────────────────────────────────────── */

describe("buildServicePerformance", () => {
  it("returns low confidence with very few samples", () => {
    const svc: Service = {
      id: "s1",
      name: "Full Detail",
      priceLow: 200,
      priceHigh: 250,
      durationMinutes: 180,
    };
    const data = emptyData({
      customers: [customer],
      services: [svc],
      appointments: [
        appt({
          id: "1",
          serviceIds: ["s1"],
          status: "completed",
          finalPrice: 240,
        }),
      ],
    });
    const perf = buildServicePerformance(data, svc);
    expect(perf.jobsCount).toBe(1);
    expect(perf.confidence).toBe("low");
  });

  it("upgrades confidence at the medium-to-high threshold", () => {
    const svc: Service = {
      id: "s1",
      name: "Full Detail",
      priceLow: 200,
      priceHigh: 250,
      durationMinutes: 180,
    };
    const appts = Array.from({ length: 8 }, (_, i) =>
      appt({
        id: `a${i}`,
        serviceIds: ["s1"],
        status: "completed",
        finalPrice: 240,
        start: daysAgo(60 - i * 5),
      }),
    );
    const data = emptyData({ customers: [customer], services: [svc], appointments: appts });
    const perf = buildServicePerformance(data, svc);
    expect(perf.confidence).toBe("high");
  });

  it("computes quote-to-final delta when both estimate and final exist", () => {
    const svc: Service = {
      id: "s1",
      name: "Full Detail",
      priceLow: 200,
      priceHigh: 250,
      durationMinutes: 180,
    };
    const data = emptyData({
      services: [svc],
      customers: [customer],
      appointments: [
        appt({
          id: "1",
          serviceIds: ["s1"],
          status: "completed",
          estimatedPrice: 200,
          finalPrice: 240,
        }),
        appt({
          id: "2",
          serviceIds: ["s1"],
          status: "completed",
          estimatedPrice: 220,
          finalPrice: 260,
        }),
      ],
    });
    const perf = buildServicePerformance(data, svc);
    // (4000 + 4000) / 2 = 4000 cents
    expect(perf.averageQuoteToFinalDeltaCents).toBe(4000);
  });
});

/* ─────────────────────────────────────────────
   LeadSourcePerformance
───────────────────────────────────────────── */

describe("buildLeadSourcePerformance", () => {
  it("groups by source, computes conversion rate", () => {
    const leads: Lead[] = [
      { id: "l1", name: "Alice", source: "facebook", interest: "low", status: "booked", createdAt: daysAgo(20) },
      { id: "l2", name: "Bob", source: "facebook", interest: "low", status: "lost", createdAt: daysAgo(20) },
      { id: "l3", name: "Carol", source: "facebook", interest: "low", status: "new", createdAt: daysAgo(5) },
      { id: "l4", name: "Dave", source: "dealership", interest: "low", status: "booked", createdAt: daysAgo(15) },
    ];
    const data = emptyData({ leads });
    const perf = buildLeadSourcePerformance(data);
    const fb = perf.find((p) => p.source === "facebook");
    const dlr = perf.find((p) => p.source === "dealership");
    expect(fb?.leadsCount).toBe(3);
    expect(fb?.convertedCount).toBe(1);
    expect(fb?.conversionRate).toBeCloseTo(1 / 3);
    expect(dlr?.conversionRate).toBe(1);
  });
});
