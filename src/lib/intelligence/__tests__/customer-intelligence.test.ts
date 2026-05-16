/**
 * Tests for Phase H4 customer-intelligence expansions:
 *   - predictNextRebookDate
 *   - customerHighlights
 *   - draftFollowUpMessage
 */
import { describe, it, expect } from "vitest";
import type {
  AppData,
  Appointment,
  Customer,
  Settings,
} from "@/lib/types";
import { buildCustomerProfile } from "../derived-metrics";
import {
  predictNextRebookDate,
  customerHighlights,
  draftFollowUpMessage,
} from "../customer-intelligence";

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
  name: "Alice Johnson",
  phone: "+1",
  vehicles: [{ year: "2022", make: "Toyota", model: "Camry", color: "White" }],
  createdAt: daysAgo(365),
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

function appt(overrides: Partial<Appointment>): Appointment {
  return {
    id: "a",
    customerId: "c1",
    vehicle: { year: "2022", make: "Toyota", model: "Camry", color: "White" },
    address: "123 Main",
    start: daysAgo(1),
    end: daysAgo(0.9),
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

/* ─────────────────────────────────────────────
   predictNextRebookDate
───────────────────────────────────────────── */

describe("predictNextRebookDate", () => {
  it("returns null when there is no median rebook interval", () => {
    // Only 1 completed job → no median
    const data = emptyData({
      customers: [customer],
      appointments: [appt({ id: "a1", status: "completed", start: daysAgo(30) })],
    });
    const profile = buildCustomerProfile(data, customer, NOW);
    expect(profile.medianRebookIntervalDays).toBeNull();
    expect(predictNextRebookDate(profile)).toBeNull();
  });

  it("returns null when lastServiceAt is null", () => {
    // No completed appointments at all
    const data = emptyData({ customers: [customer] });
    const profile = buildCustomerProfile(data, customer, NOW);
    expect(predictNextRebookDate(profile)).toBeNull();
  });

  it("returns null below MIN_SAMPLE_FOR_INSIGHT completed jobs (3)", () => {
    // 2 completed jobs → has a median but below threshold
    const data = emptyData({
      customers: [customer],
      appointments: [
        appt({ id: "a1", status: "completed", start: daysAgo(60) }),
        appt({ id: "a2", status: "completed", start: daysAgo(30) }),
      ],
    });
    const profile = buildCustomerProfile(data, customer, NOW);
    expect(profile.completedJobs).toBe(2);
    expect(predictNextRebookDate(profile)).toBeNull();
  });

  it("returns a predicted date when there are enough samples", () => {
    // 3 completed jobs, ~30d apart
    const data = emptyData({
      customers: [customer],
      appointments: [
        appt({ id: "a1", status: "completed", start: daysAgo(60) }),
        appt({ id: "a2", status: "completed", start: daysAgo(30) }),
        appt({ id: "a3", status: "completed", start: daysAgo(0) }),
      ],
    });
    const profile = buildCustomerProfile(data, customer, NOW);
    expect(profile.completedJobs).toBe(3);
    const result = predictNextRebookDate(profile);
    expect(result).not.toBeNull();
    expect(result?.date).toBeTruthy();
    // Predicted date should be ~30 days in the future from last service
    const predictedMs = new Date(result!.date).getTime();
    const nowMs = NOW.getTime();
    // Should be roughly +30 days from today (within ±2d rounding)
    expect(predictedMs).toBeGreaterThan(nowMs + 28 * 86_400_000);
    expect(predictedMs).toBeLessThan(nowMs + 32 * 86_400_000);
  });

  it("confidence is 'low' for MIN_SAMPLE_FOR_INSIGHT (3) samples", () => {
    const data = emptyData({
      customers: [customer],
      appointments: [
        appt({ id: "a1", status: "completed", start: daysAgo(60) }),
        appt({ id: "a2", status: "completed", start: daysAgo(30) }),
        appt({ id: "a3", status: "completed", start: daysAgo(0) }),
      ],
    });
    const profile = buildCustomerProfile(data, customer, NOW);
    const result = predictNextRebookDate(profile);
    // 3 samples → low confidence (below LOW_TO_MEDIUM threshold of 4)
    expect(result?.confidence).toBe("low");
  });

  it("confidence is 'high' for 8+ samples", () => {
    const appointments = Array.from({ length: 9 }, (_, i) =>
      appt({ id: `a${i}`, status: "completed", start: daysAgo(i * 30) }),
    );
    const data = emptyData({ customers: [customer], appointments });
    const profile = buildCustomerProfile(data, customer, NOW);
    const result = predictNextRebookDate(profile);
    expect(result?.confidence).toBe("high");
  });
});

/* ─────────────────────────────────────────────
   customerHighlights
───────────────────────────────────────────── */

describe("customerHighlights", () => {
  it("returns null for a non-existent customer", () => {
    expect(customerHighlights(emptyData(), "nope")).toBeNull();
  });

  it("returns null for a customer with no completed jobs", () => {
    const data = emptyData({
      customers: [customer],
      appointments: [appt({ id: "a1", status: "scheduled" })],
    });
    expect(customerHighlights(data, "c1")).toBeNull();
  });

  it("returns correct shape for a customer with completed jobs", () => {
    const data = emptyData({
      customers: [customer],
      services: [{ id: "s1", name: "Full Detail", priceLow: 200, priceHigh: 250, durationMinutes: 180 }],
      appointments: [
        appt({ id: "a1", status: "completed", start: daysAgo(60), serviceIds: ["s1"], finalPrice: 200 }),
        appt({ id: "a2", status: "completed", start: daysAgo(30), serviceIds: ["s1"], finalPrice: 250 }),
        appt({ id: "a3", status: "completed", start: daysAgo(2), serviceIds: ["s1"], finalPrice: 220 }),
      ],
    });
    const h = customerHighlights(data, "c1");
    expect(h).not.toBeNull();
    expect(h?.totalJobs).toBe(3);
    expect(h?.tier).toBeTruthy();
    expect(h?.lastServiceIso).toBeTruthy();
    expect(h?.topServices).toHaveLength(1);
    expect(h?.topServices[0].serviceName).toBe("Full Detail");
    expect(h?.topServices[0].count).toBe(3);
    expect(typeof h?.openBalanceCents).toBe("number");
    expect(typeof h?.isRepeat).toBe("boolean");
    expect(typeof h?.isMonthly).toBe("boolean");
  });

  it("limits topServices to 3 even with many services", () => {
    const services = Array.from({ length: 5 }, (_, i) => ({
      id: `s${i}`,
      name: `Service ${i}`,
      priceLow: 100,
      priceHigh: 150,
      durationMinutes: 60,
    }));
    // 3 jobs each with a different service
    const appointments = services.map((s, i) =>
      appt({ id: `a${i}`, status: "completed", start: daysAgo(i * 10 + 5), serviceIds: [s.id] }),
    );
    const data = emptyData({ customers: [customer], services, appointments });
    const h = customerHighlights(data, "c1");
    expect(h?.topServices.length).toBeLessThanOrEqual(3);
  });

  it("predictedNextRebook is null below MIN_SAMPLE_FOR_INSIGHT", () => {
    const data = emptyData({
      customers: [customer],
      appointments: [
        appt({ id: "a1", status: "completed", start: daysAgo(60) }),
        appt({ id: "a2", status: "completed", start: daysAgo(30) }),
      ],
    });
    const h = customerHighlights(data, "c1");
    expect(h?.predictedNextRebook).toBeNull();
  });
});

/* ─────────────────────────────────────────────
   draftFollowUpMessage
───────────────────────────────────────────── */

describe("draftFollowUpMessage", () => {
  const richData = (() => {
    const data = emptyData({
      customers: [customer],
      services: [{ id: "s1", name: "Full Detail", priceLow: 200, priceHigh: 250, durationMinutes: 180 }],
      appointments: [
        appt({ id: "a1", status: "completed", start: daysAgo(45), serviceIds: ["s1"] }),
        appt({ id: "a2", status: "completed", start: daysAgo(15), serviceIds: ["s1"] }),
        appt({ id: "a3", status: "completed", start: daysAgo(5), serviceIds: ["s1"] }),
      ],
    });
    return data;
  })();

  it("returns null for a non-existent customer", () => {
    expect(draftFollowUpMessage(emptyData(), "nope", "rebook")).toBeNull();
  });

  it("produces a non-empty body for 'rebook' intent", () => {
    const draft = draftFollowUpMessage(richData, "c1", "rebook");
    expect(draft).not.toBeNull();
    expect(draft?.subject).toBeTruthy();
    expect(draft?.body.length).toBeGreaterThan(20);
    expect(draft?.body).toContain("Alice");
  });

  it("produces a non-empty body for 'thank_you' intent", () => {
    const draft = draftFollowUpMessage(richData, "c1", "thank_you");
    expect(draft).not.toBeNull();
    expect(draft?.subject).toBeTruthy();
    expect(draft?.body.length).toBeGreaterThan(20);
    expect(draft?.body).toContain("Alice");
  });

  it("produces a non-empty body for 'checkin' intent", () => {
    const draft = draftFollowUpMessage(richData, "c1", "checkin");
    expect(draft).not.toBeNull();
    expect(draft?.subject).toBeTruthy();
    expect(draft?.body.length).toBeGreaterThan(20);
    expect(draft?.body).toContain("Alice");
  });

  it("each intent produces a distinct subject line", () => {
    const subjects = (["rebook", "thank_you", "checkin"] as const).map(
      (intent) => draftFollowUpMessage(richData, "c1", intent)?.subject,
    );
    const unique = new Set(subjects.filter(Boolean));
    expect(unique.size).toBe(3);
  });

  it("includes owner name in body", () => {
    const draft = draftFollowUpMessage(richData, "c1", "rebook");
    expect(draft?.body).toContain("Jayden");
  });
});
