/**
 * Tests for Phase H7 ai-tools dispatchAiTool:
 *   - at least 6 implemented tools fire and return ok with sensible shapes
 *   - unknown tool name returns ok=false with error="unknown_tool"
 *   - google-family tools return ok=false with error="not_configured"
 *   - search_web / get_weather_for_appointment return ok=false when supabase unconfigured
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  AppData,
  Appointment,
  Customer,
  Settings,
  Service,
} from "@/lib/types";

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

function makeCustomer(id: string): Customer {
  return {
    id,
    name: `Customer ${id}`,
    phone: "+15035550000",
    vehicles: [{ year: "2022", make: "Toyota", model: "Camry", color: "White" }],
    createdAt: daysAgo(365),
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

function makeAppt(
  id: string,
  customerId: string,
  overrides: Partial<Appointment> = {},
): Appointment {
  return {
    id,
    customerId,
    vehicle: { year: "2022", make: "Toyota", model: "Camry", color: "White" },
    address: "123 Main St",
    start: daysAgo(10),
    end: daysAgo(9.9),
    serviceIds: ["s1"],
    addonIds: [],
    estimatedPrice: 200,
    finalPrice: 220,
    depositPaid: true,
    paymentStatus: "paid",
    status: "completed",
    petHair: false,
    stains: false,
    heavyDirt: false,
    waterAccess: true,
    powerAccess: true,
    createdAt: daysAgo(11),
    ...overrides,
  };
}

function makeData(overrides: Partial<AppData> = {}): AppData {
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
   Pure / internal tools (no network)
───────────────────────────────────────────── */

describe("dispatchAiTool — internal tools", () => {
  // Mock supabase to avoid network calls in these pure tests.
  beforeEach(() => {
    vi.resetModules();
  });

  it("get_business_snapshot returns ok=true with snapshot shape", async () => {
    vi.doMock("@/lib/supabase", () => ({ getSupabase: () => null }));
    const { dispatchAiTool } = await import("../ai-tools");
    const data = makeData();
    const result = await dispatchAiTool("get_business_snapshot", {}, { data });
    expect(result.ok).toBe(true);
    expect(result.data).toHaveProperty("collectedCents");
    expect(result.data).toHaveProperty("appointmentsCompleted");
  });

  it("get_attention_items returns ok=true with array", async () => {
    vi.doMock("@/lib/supabase", () => ({ getSupabase: () => null }));
    const { dispatchAiTool } = await import("../ai-tools");
    const data = makeData();
    const result = await dispatchAiTool("get_attention_items", {}, { data });
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("get_customer_summary returns ok=true for existing customer with jobs", async () => {
    vi.doMock("@/lib/supabase", () => ({ getSupabase: () => null }));
    const { dispatchAiTool } = await import("../ai-tools");
    const customers = [makeCustomer("c1")];
    const appointments = [makeAppt("a1", "c1")];
    const data = makeData({ customers, appointments, services: [makeService()] });
    const result = await dispatchAiTool("get_customer_summary", { customer_id: "c1" }, { data });
    expect(result.ok).toBe(true);
    expect(result.data).toHaveProperty("tier");
    expect(result.data).toHaveProperty("totalJobs");
  });

  it("get_customer_summary returns ok=false for unknown customer", async () => {
    vi.doMock("@/lib/supabase", () => ({ getSupabase: () => null }));
    const { dispatchAiTool } = await import("../ai-tools");
    const data = makeData();
    const result = await dispatchAiTool("get_customer_summary", { customer_id: "nonexistent" }, { data });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("customer_not_found");
  });

  it("search_customers returns ok=true with matched results", async () => {
    vi.doMock("@/lib/supabase", () => ({ getSupabase: () => null }));
    const { dispatchAiTool } = await import("../ai-tools");
    const customers = [
      makeCustomer("c1"),
      { ...makeCustomer("c2"), name: "Bob Smith" },
    ];
    const data = makeData({ customers });
    const result = await dispatchAiTool("search_customers", { query: "customer c1" }, { data });
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("get_appointments returns ok=true with capped array", async () => {
    vi.doMock("@/lib/supabase", () => ({ getSupabase: () => null }));
    const { dispatchAiTool } = await import("../ai-tools");
    const customers = [makeCustomer("c1")];
    const appointments = Array.from({ length: 25 }, (_, i) =>
      makeAppt(`a${i}`, "c1", { id: `a${i}` }),
    );
    const data = makeData({ customers, appointments });
    const result = await dispatchAiTool("get_appointments", {}, { data });
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    expect((result.data as unknown[]).length).toBeLessThanOrEqual(20);
  });

  it("get_revenue_summary returns ok=true with money fields", async () => {
    vi.doMock("@/lib/supabase", () => ({ getSupabase: () => null }));
    const { dispatchAiTool } = await import("../ai-tools");
    const data = makeData();
    const result = await dispatchAiTool("get_revenue_summary", { range: "all_time" }, { data });
    expect(result.ok).toBe(true);
    expect(result.data).toHaveProperty("collectedCents");
    expect(result.data).toHaveProperty("averageTicketCents");
  });

  it("get_workload_forecast returns ok=true with forecast shape", async () => {
    vi.doMock("@/lib/supabase", () => ({ getSupabase: () => null }));
    const { dispatchAiTool } = await import("../ai-tools");
    const data = makeData();
    const result = await dispatchAiTool("get_workload_forecast", {}, { data });
    expect(result.ok).toBe(true);
    expect(result.data).toHaveProperty("bookedJobs");
    expect(result.data).toHaveProperty("openCapacity");
  });

  it("get_pricing_patterns returns ok=true with patterns array", async () => {
    vi.doMock("@/lib/supabase", () => ({ getSupabase: () => null }));
    const { dispatchAiTool } = await import("../ai-tools");
    const data = makeData();
    const result = await dispatchAiTool("get_pricing_patterns", {}, { data });
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("get_rebooking_candidates returns ok=true with array", async () => {
    vi.doMock("@/lib/supabase", () => ({ getSupabase: () => null }));
    const { dispatchAiTool } = await import("../ai-tools");
    const data = makeData();
    const result = await dispatchAiTool("get_rebooking_candidates", {}, { data });
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("get_review_request_gaps returns ok=true with array", async () => {
    vi.doMock("@/lib/supabase", () => ({ getSupabase: () => null }));
    const { dispatchAiTool } = await import("../ai-tools");
    const customers = [makeCustomer("c1")];
    const appointments = [
      makeAppt("a1", "c1", {
        // Completed 2 days ago, no review request sent
        start: daysAgo(2),
        reviewRequestSent: false,
      }),
    ];
    const data = makeData({ customers, appointments });
    const result = await dispatchAiTool("get_review_request_gaps", {}, { data });
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("get_quote_vs_final_analysis returns ok=true with summary", async () => {
    vi.doMock("@/lib/supabase", () => ({ getSupabase: () => null }));
    const { dispatchAiTool } = await import("../ai-tools");
    const data = makeData();
    const result = await dispatchAiTool("get_quote_vs_final_analysis", {}, { data });
    expect(result.ok).toBe(true);
    expect(result.data).toHaveProperty("totalPatterns");
    expect(result.data).toHaveProperty("underquotingCount");
  });

  it("draft_customer_message returns ok=true for existing customer", async () => {
    vi.doMock("@/lib/supabase", () => ({ getSupabase: () => null }));
    const { dispatchAiTool } = await import("../ai-tools");
    const customers = [makeCustomer("c1")];
    const appointments = [makeAppt("a1", "c1")];
    const data = makeData({ customers, appointments, services: [makeService()] });
    const result = await dispatchAiTool(
      "draft_customer_message",
      { customer_id: "c1", intent: "rebook" },
      { data },
    );
    expect(result.ok).toBe(true);
    expect(result.data).toHaveProperty("subject");
    expect(result.data).toHaveProperty("body");
  });
});

/* ─────────────────────────────────────────────
   Unknown tool
───────────────────────────────────────────── */

describe("dispatchAiTool — unknown tool", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("returns ok=false with error=unknown_tool for unrecognized name", async () => {
    vi.doMock("@/lib/supabase", () => ({ getSupabase: () => null }));
    const { dispatchAiTool } = await import("../ai-tools");
    const data = makeData();
    // Cast to bypass TypeScript's type check so we can test the runtime guard.
    const result = await dispatchAiTool(
      "totally_made_up_tool_name" as Parameters<typeof dispatchAiTool>[0],
      {},
      { data },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe("unknown_tool");
  });
});

/* ─────────────────────────────────────────────
   Google-family tools — not_configured
───────────────────────────────────────────── */

describe("dispatchAiTool — google-family tools return not_configured", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it.each([
    "get_route_between_appointments",
    "get_google_calendar_events",
    "draft_gmail_message",
    "get_google_business_reviews",
  ] as const)("%s returns ok=false with not_configured", async (toolName) => {
    vi.doMock("@/lib/supabase", () => ({ getSupabase: () => null }));
    const { dispatchAiTool } = await import("../ai-tools");
    const data = makeData();
    const result = await dispatchAiTool(toolName, {}, { data });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("not_configured");
  });
});

/* ─────────────────────────────────────────────
   Network tools — graceful failure without supabase
───────────────────────────────────────────── */

describe("dispatchAiTool — network tools degrade gracefully", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("search_web returns ok=false when supabase not configured", async () => {
    vi.doMock("@/lib/supabase", () => ({ getSupabase: () => null }));
    const { dispatchAiTool } = await import("../ai-tools");
    const data = makeData();
    const result = await dispatchAiTool("search_web", { query: "auto detailing prices" }, { data });
    // Without supabase, searchWeb returns supabase_unconfigured → ok=false.
    expect(result.ok).toBe(false);
  });

  it("search_web returns ok=false for empty query", async () => {
    vi.doMock("@/lib/supabase", () => ({ getSupabase: () => null }));
    const { dispatchAiTool } = await import("../ai-tools");
    const data = makeData();
    const result = await dispatchAiTool("search_web", { query: "" }, { data });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("empty_query");
  });
});
