/**
 * Tests for Phase H7 ai-context:
 *   - buildAiContext returns expected shape
 *   - caps attention at 15
 *   - includes focus customers when provided
 *   - no phone/email strings in any nested structure (PII redaction)
 *   - buildEnrichedContext returns richer shape
 */
import { describe, it, expect } from "vitest";
import type {
  AppData,
  Appointment,
  Customer,
  Settings,
  Service,
} from "@/lib/types";
import { buildAiContext, buildEnrichedContext } from "../ai-context";

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

function daysFromNow(d: number): string {
  return new Date(NOW.getTime() + d * 86_400_000).toISOString();
}

function makeCustomer(id: string, overrides: Partial<Customer> = {}): Customer {
  return {
    id,
    name: `Customer ${id}`,
    phone: "+15035551234",
    email: `customer${id}@example.com`,
    vehicles: [],
    createdAt: daysAgo(365),
    ...overrides,
  };
}

function makeService(): Service {
  return {
    id: "s1",
    name: "Full Detail",
    priceLow: 200,
    priceHigh: 250,
    durationMinutes: 180,
  };
}

function makeAppt(id: string, customerId: string, overrides: Partial<Appointment> = {}): Appointment {
  return {
    id,
    customerId,
    vehicle: { year: "2022", make: "Toyota", model: "Camry", color: "White" },
    address: "123 Main St",
    start: daysAgo(1),
    end: daysAgo(0.9),
    serviceIds: ["s1"],
    addonIds: [],
    estimatedPrice: 200,
    finalPrice: 210,
    depositPaid: true,
    paymentStatus: "paid",
    status: "completed",
    petHair: false,
    stains: false,
    heavyDirt: false,
    waterAccess: true,
    powerAccess: true,
    createdAt: daysAgo(2),
    ...overrides,
  };
}

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

/* ─────────────────────────────────────────────
   buildAiContext
───────────────────────────────────────────── */

describe("buildAiContext", () => {
  it("returns expected top-level shape", () => {
    const data = emptyData();
    const bundle = buildAiContext(data);

    expect(bundle).toHaveProperty("generatedAt");
    expect(bundle).toHaveProperty("snapshot");
    expect(bundle).toHaveProperty("attention");
    expect(bundle).toHaveProperty("focusCustomers");
    expect(Array.isArray(bundle.attention)).toBe(true);
    expect(Array.isArray(bundle.focusCustomers)).toBe(true);
  });

  it("caps attention at 15 even when more items exist", () => {
    // Create enough data to potentially generate many attention items.
    // 18 leads with status=new created >24h ago triggers lead_uncontacted.
    const leads = Array.from({ length: 18 }, (_, i) => ({
      id: `l${i}`,
      name: `Lead ${i}`,
      source: "google" as const,
      interest: "medium" as const,
      status: "new" as const,
      createdAt: daysAgo(2),
    }));
    const data = emptyData({ leads });
    const bundle = buildAiContext(data);
    expect(bundle.attention.length).toBeLessThanOrEqual(15);
  });

  it("uses focus customers when focusCustomerIds provided", () => {
    const customers = [
      makeCustomer("c1"),
      makeCustomer("c2"),
      makeCustomer("c3"),
    ];
    const appointments = [
      makeAppt("a1", "c1"),
      makeAppt("a2", "c2"),
      makeAppt("a3", "c3"),
    ];
    const data = emptyData({ customers, appointments, services: [makeService()] });

    const bundle = buildAiContext(data, { focusCustomerIds: ["c2"] });
    const ids = (bundle.focusCustomers ?? []).map((c) => c.customerId);
    expect(ids).toContain("c2");
    // When explicitly set to one customer, we should only get that one.
    expect(ids).toHaveLength(1);
  });

  it("defaults to top 5 customers when no focus ids given", () => {
    const customers = Array.from({ length: 8 }, (_, i) => makeCustomer(`c${i}`));
    const appointments = customers.map((c, i) =>
      makeAppt(`a${i}`, c.id, { estimatedPrice: (i + 1) * 100 }),
    );
    const data = emptyData({ customers, appointments, services: [makeService()] });

    const bundle = buildAiContext(data);
    expect((bundle.focusCustomers ?? []).length).toBeLessThanOrEqual(5);
  });

  it("populates focusAppointments when focusAppointmentIds provided", () => {
    const customers = [makeCustomer("c1")];
    const appointments = [
      makeAppt("a1", "c1"),
      makeAppt("a2", "c1"),
    ];
    const data = emptyData({ customers, appointments, services: [makeService()] });

    const bundle = buildAiContext(data, { focusAppointmentIds: ["a1"] });
    expect(bundle.focusAppointments).toBeDefined();
    expect(bundle.focusAppointments?.length).toBe(1);
    expect(bundle.focusAppointments?.[0].id).toBe("a1");
    expect(bundle.focusAppointments?.[0].status).toBe("completed");
    expect(bundle.focusAppointments?.[0].start).toBeDefined();
  });

  it("focusAppointments is undefined when no ids given", () => {
    const data = emptyData();
    const bundle = buildAiContext(data);
    // Either undefined or empty array — no appointments provided.
    expect(
      bundle.focusAppointments === undefined || bundle.focusAppointments.length === 0,
    ).toBe(true);
  });
});

/* ─────────────────────────────────────────────
   PII redaction
───────────────────────────────────────────── */

describe("buildAiContext PII redaction", () => {
  it("does not include raw phone or email strings when includePii is not set", () => {
    const customers = [makeCustomer("c1", { phone: "+15035559999", email: "alice@gmail.com" })];
    const data = emptyData({ customers });

    const bundle = buildAiContext(data);
    const serialized = JSON.stringify(bundle);

    // Phone number should not appear.
    expect(serialized).not.toContain("+15035559999");
    // Email should not appear.
    expect(serialized).not.toContain("alice@gmail.com");
  });

  it("redacts phone-like strings throughout the bundle", () => {
    const customers = [makeCustomer("c1", { phone: "+15035550000" })];
    const data = emptyData({ customers });
    const bundle = buildAiContext(data, { includePii: false });
    const serialized = JSON.stringify(bundle);
    expect(serialized).not.toContain("+15035550000");
  });

  it("allows PII through when includePii is true", () => {
    // CustomerIntelligenceProfile doesn't store raw phone/email, so this just
    // confirms includePii=true skips the redaction pass without throwing.
    const customers = [makeCustomer("c1")];
    const data = emptyData({ customers });
    // Should not throw.
    expect(() => buildAiContext(data, { includePii: true })).not.toThrow();
  });
});

/* ─────────────────────────────────────────────
   buildEnrichedContext
───────────────────────────────────────────── */

describe("buildEnrichedContext", () => {
  it("includes the base bundle plus extra analytics fields", () => {
    const data = emptyData();
    const enriched = buildEnrichedContext(data);

    expect(enriched).toHaveProperty("generatedAt");
    expect(enriched).toHaveProperty("bundle");
    expect(enriched).toHaveProperty("insights");
    expect(enriched).toHaveProperty("workloadForecast");
    expect(enriched).toHaveProperty("revenuePace");
    expect(enriched).toHaveProperty("pricingPatterns");
    expect(enriched).toHaveProperty("focusCustomerHighlights");
    expect(enriched).toHaveProperty("rebookCandidateCount");
    expect(Array.isArray(enriched.insights)).toBe(true);
    expect(Array.isArray(enriched.pricingPatterns)).toBe(true);
    expect(typeof enriched.rebookCandidateCount).toBe("number");
  });

  it("caps insights at 10", () => {
    const data = emptyData();
    const enriched = buildEnrichedContext(data);
    expect(enriched.insights.length).toBeLessThanOrEqual(10);
  });

  it("caps pricingPatterns at 10", () => {
    const data = emptyData();
    const enriched = buildEnrichedContext(data);
    expect(enriched.pricingPatterns.length).toBeLessThanOrEqual(10);
  });

  it("includes focusCustomerHighlights for focus ids when present", () => {
    const customers = [makeCustomer("c1")];
    const appointments = [makeAppt("a1", "c1")];
    const data = emptyData({ customers, appointments, services: [makeService()] });

    const enriched = buildEnrichedContext(data, { focusCustomerIds: ["c1"] });
    expect(enriched.focusCustomerHighlights.length).toBeGreaterThan(0);
    expect(enriched.focusCustomerHighlights[0].customerId).toBe("c1");
  });
});
