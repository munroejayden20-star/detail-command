/**
 * Tests for the attention engine.
 *
 * Strategy: build minimal AppData fixtures, drive `runAttentionRules` with a
 * fixed `now`, and assert on what items it produced (or didn't). Because the
 * engine is pure and deterministic, no time-mocking libraries are needed.
 *
 * Coverage rules each test targets:
 *   - rule fires when condition is true
 *   - rule does NOT fire when condition is false (auto-resolve)
 *   - id is stable across runs (dedupe / snooze persistence)
 *   - priority assignment is correct
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
import { runAttentionRules, sortAttentionItems } from "../rules";
import { ATTENTION_THRESHOLDS } from "../rules";

/* ─────────────────────────────────────────────
   Fixtures
───────────────────────────────────────────── */

const NOW = new Date("2026-05-10T12:00:00.000Z");

function hoursAgo(h: number, base: Date = NOW): string {
  return new Date(base.getTime() - h * 3600 * 1000).toISOString();
}
function daysAgo(d: number, base: Date = NOW): string {
  return hoursAgo(d * 24, base);
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
    settings: { ...baseSettings },
    ...overrides,
  };
}

function makeCustomer(overrides: Partial<Customer> = {}): Customer {
  return {
    id: "c1",
    name: "Alice",
    phone: "+13605555678",
    vehicles: [],
    createdAt: daysAgo(60),
    ...overrides,
  };
}

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: "a1",
    customerId: "c1",
    vehicle: { year: "2020", make: "Honda", model: "Civic", color: "Red" },
    address: "123 Main",
    start: hoursAgo(2),
    end: hoursAgo(0.5),
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
    createdAt: daysAgo(7),
    ...overrides,
  };
}

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "l1",
    name: "Bob",
    source: "facebook",
    interest: "medium",
    status: "new",
    createdAt: hoursAgo(1),
    ...overrides,
  };
}

function makeReceipt(overrides: Partial<Receipt> = {}): Receipt {
  return {
    id: "r1",
    receiptNumber: "1001",
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

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: "s1",
    name: "Full Detail",
    priceLow: 200,
    priceHigh: 250,
    durationMinutes: 180,
    isAddon: false,
    ...overrides,
  };
}

/* ─────────────────────────────────────────────
   Empty / sanity
───────────────────────────────────────────── */

describe("runAttentionRules — empty data", () => {
  it("produces no items for an empty store", () => {
    const items = runAttentionRules(emptyData(), NOW);
    expect(items).toEqual([]);
  });
});

/* ─────────────────────────────────────────────
   Bookings
───────────────────────────────────────────── */

describe("rule: pending_booking_stale", () => {
  it("does not fire below the threshold", () => {
    const data = emptyData({
      appointments: [
        makeAppointment({
          status: "pending_approval",
          createdAt: hoursAgo(ATTENTION_THRESHOLDS.PENDING_BOOKING_STALE_HOURS - 1),
        }),
      ],
    });
    const items = runAttentionRules(data, NOW);
    expect(items.find((i) => i.type === "pending_booking_stale")).toBeUndefined();
  });

  it("fires at high priority above the stale threshold", () => {
    const data = emptyData({
      customers: [makeCustomer()],
      appointments: [
        makeAppointment({
          status: "pending_approval",
          createdAt: hoursAgo(ATTENTION_THRESHOLDS.PENDING_BOOKING_STALE_HOURS + 1),
        }),
      ],
    });
    const items = runAttentionRules(data, NOW);
    const item = items.find((i) => i.type === "pending_booking_stale");
    expect(item).toBeDefined();
    expect(item?.priority).toBe("high");
  });

  it("escalates to critical above the very-stale threshold", () => {
    const data = emptyData({
      customers: [makeCustomer()],
      appointments: [
        makeAppointment({
          status: "pending_approval",
          createdAt: hoursAgo(ATTENTION_THRESHOLDS.PENDING_BOOKING_VERY_STALE_HOURS + 5),
        }),
      ],
    });
    const items = runAttentionRules(data, NOW);
    const item = items.find((i) => i.type === "pending_booking_stale");
    expect(item?.priority).toBe("critical");
  });

  it("auto-resolves once approved (rule no longer emits)", () => {
    const stale = emptyData({
      customers: [makeCustomer()],
      appointments: [
        makeAppointment({
          status: "pending_approval",
          createdAt: hoursAgo(48),
        }),
      ],
    });
    expect(
      runAttentionRules(stale, NOW).find((i) => i.type === "pending_booking_stale"),
    ).toBeDefined();

    const approved = {
      ...stale,
      appointments: stale.appointments.map((a) => ({ ...a, status: "confirmed" as const })),
    };
    expect(
      runAttentionRules(approved, NOW).find((i) => i.type === "pending_booking_stale"),
    ).toBeUndefined();
  });
});

describe("rule: deposit_paid_unapproved", () => {
  it("fires critical when deposit is paid but status is pending_approval", () => {
    const data = emptyData({
      customers: [makeCustomer()],
      appointments: [
        makeAppointment({
          status: "pending_approval",
          createdAt: hoursAgo(1),
          paymentStatus: "deposit_paid",
          depositPaid: true,
          depositAmountCents: 5000,
        }),
      ],
    });
    const items = runAttentionRules(data, NOW);
    const item = items.find((i) => i.type === "deposit_paid_unapproved");
    expect(item).toBeDefined();
    expect(item?.priority).toBe("critical");
    expect(item?.detail).toContain("$50");
  });

  it("does not fire if booking is already confirmed", () => {
    const data = emptyData({
      customers: [makeCustomer()],
      appointments: [
        makeAppointment({
          status: "confirmed",
          paymentStatus: "deposit_paid",
          depositPaid: true,
        }),
      ],
    });
    const items = runAttentionRules(data, NOW);
    expect(items.find((i) => i.type === "deposit_paid_unapproved")).toBeUndefined();
  });
});

/* ─────────────────────────────────────────────
   Jobs
───────────────────────────────────────────── */

describe("rule: completed_no_final_price", () => {
  it("fires when a completed job has no finalPrice or finalPriceCents", () => {
    const data = emptyData({
      customers: [makeCustomer()],
      appointments: [
        makeAppointment({
          status: "completed",
          start: hoursAgo(8),
          finalPrice: undefined,
          finalPriceCents: undefined,
        }),
      ],
    });
    const items = runAttentionRules(data, NOW);
    expect(items.find((i) => i.type === "completed_no_final_price")).toBeDefined();
  });

  it("auto-resolves once finalPrice is set", () => {
    const fixed = emptyData({
      customers: [makeCustomer()],
      appointments: [
        makeAppointment({
          status: "completed",
          start: hoursAgo(8),
          finalPrice: 240,
        }),
      ],
    });
    const items = runAttentionRules(fixed, NOW);
    expect(items.find((i) => i.type === "completed_no_final_price")).toBeUndefined();
  });

  it("respects either finalPriceCents or legacy finalPrice", () => {
    const dataCents = emptyData({
      customers: [makeCustomer()],
      appointments: [
        makeAppointment({
          status: "completed",
          start: hoursAgo(8),
          finalPriceCents: 24000,
        }),
      ],
    });
    expect(
      runAttentionRules(dataCents, NOW).find((i) => i.type === "completed_no_final_price"),
    ).toBeUndefined();
  });
});

describe("rule: completed_no_receipt", () => {
  it("fires when a completed appointment has no receipt", () => {
    const data = emptyData({
      customers: [makeCustomer()],
      appointments: [
        makeAppointment({
          status: "completed",
          start: hoursAgo(8),
        }),
      ],
    });
    const items = runAttentionRules(data, NOW);
    expect(items.find((i) => i.type === "completed_no_receipt")).toBeDefined();
  });

  it("auto-resolves once an active receipt exists", () => {
    const data = emptyData({
      customers: [makeCustomer()],
      appointments: [
        makeAppointment({
          id: "a1",
          status: "completed",
          start: hoursAgo(8),
        }),
      ],
      receipts: [makeReceipt({ appointmentId: "a1" })],
    });
    expect(
      runAttentionRules(data, NOW).find((i) => i.type === "completed_no_receipt"),
    ).toBeUndefined();
  });

  it("ignores voided receipts (still flags as missing)", () => {
    const data = emptyData({
      customers: [makeCustomer()],
      appointments: [
        makeAppointment({
          id: "a1",
          status: "completed",
          start: hoursAgo(8),
        }),
      ],
      receipts: [makeReceipt({ appointmentId: "a1", receiptStatus: "voided" })],
    });
    expect(
      runAttentionRules(data, NOW).find((i) => i.type === "completed_no_receipt"),
    ).toBeDefined();
  });
});

describe("rule: completed_no_review_request", () => {
  it("fires medium for a completed job 24h+ ago without a review request", () => {
    const data = emptyData({
      customers: [makeCustomer()],
      appointments: [
        makeAppointment({
          status: "completed",
          start: hoursAgo(48),
          finalPrice: 200,
          reviewRequestSent: false,
        }),
      ],
    });
    const items = runAttentionRules(data, NOW);
    const item = items.find((i) => i.type === "completed_no_review_request");
    expect(item).toBeDefined();
    expect(item?.priority).toBe("medium");
  });

  it("does not fire for jobs older than the max window", () => {
    const data = emptyData({
      customers: [makeCustomer()],
      appointments: [
        makeAppointment({
          status: "completed",
          start: daysAgo(60),
          finalPrice: 200,
        }),
      ],
    });
    expect(
      runAttentionRules(data, NOW).find((i) => i.type === "completed_no_review_request"),
    ).toBeUndefined();
  });

  it("respects reviewRequestEnabled=false", () => {
    const data = emptyData({
      customers: [makeCustomer()],
      appointments: [
        makeAppointment({ status: "completed", start: hoursAgo(48), finalPrice: 200 }),
      ],
      settings: { ...baseSettings, reviewRequestEnabled: false },
    });
    expect(
      runAttentionRules(data, NOW).find((i) => i.type === "completed_no_review_request"),
    ).toBeUndefined();
  });
});

describe("rule: job_timer_stalled", () => {
  it("fires when actualStartAt set but actualEndAt missing for >4h", () => {
    const data = emptyData({
      customers: [makeCustomer()],
      appointments: [
        makeAppointment({
          status: "in_progress",
          actualStartAt: hoursAgo(5),
          actualEndAt: undefined,
        }),
      ],
    });
    const items = runAttentionRules(data, NOW);
    expect(items.find((i) => i.type === "job_timer_stalled")).toBeDefined();
  });

  it("does not fire if actualEndAt is set", () => {
    const data = emptyData({
      customers: [makeCustomer()],
      appointments: [
        makeAppointment({
          actualStartAt: hoursAgo(5),
          actualEndAt: hoursAgo(2),
        }),
      ],
    });
    expect(
      runAttentionRules(data, NOW).find((i) => i.type === "job_timer_stalled"),
    ).toBeUndefined();
  });
});

describe("rule: in_progress_overrun", () => {
  it("fires when in_progress and elapsed >= 130% of estimated duration", () => {
    const data = emptyData({
      customers: [makeCustomer()],
      appointments: [
        makeAppointment({
          status: "in_progress",
          // 60-min estimate, started 90 min ago → 150% overrun
          start: new Date(NOW.getTime() - 90 * 60 * 1000).toISOString(),
          end: new Date(NOW.getTime() - 30 * 60 * 1000).toISOString(),
        }),
      ],
    });
    const items = runAttentionRules(data, NOW);
    const item = items.find((i) => i.type === "in_progress_overrun");
    expect(item).toBeDefined();
  });

  it("does not fire for jobs within their estimated window", () => {
    const data = emptyData({
      customers: [makeCustomer()],
      appointments: [
        makeAppointment({
          status: "in_progress",
          start: new Date(NOW.getTime() - 30 * 60 * 1000).toISOString(),
          end: new Date(NOW.getTime() + 60 * 60 * 1000).toISOString(),
        }),
      ],
    });
    expect(
      runAttentionRules(data, NOW).find((i) => i.type === "in_progress_overrun"),
    ).toBeUndefined();
  });
});

/* ─────────────────────────────────────────────
   Customer / finance
───────────────────────────────────────────── */

describe("rule: receipt_open_balance", () => {
  it("fires medium for an aged receipt with open balance", () => {
    const data = emptyData({
      customers: [makeCustomer()],
      receipts: [
        makeReceipt({
          customerId: "c1",
          paymentStatus: "partial",
          totalCents: 20000,
          amountPaidCents: 5000,
          remainingBalanceCents: 15000,
          createdAt: daysAgo(10),
        }),
      ],
    });
    const items = runAttentionRules(data, NOW);
    const item = items.find((i) => i.type === "receipt_open_balance");
    expect(item).toBeDefined();
    expect(item?.priority).toBe("medium");
    expect(item?.title).toContain("$150");
  });

  it("escalates to high after the high-priority threshold", () => {
    const data = emptyData({
      customers: [makeCustomer()],
      receipts: [
        makeReceipt({
          customerId: "c1",
          paymentStatus: "partial",
          totalCents: 20000,
          amountPaidCents: 5000,
          remainingBalanceCents: 15000,
          createdAt: daysAgo(30),
        }),
      ],
    });
    const item = runAttentionRules(data, NOW).find(
      (i) => i.type === "receipt_open_balance",
    );
    expect(item?.priority).toBe("high");
  });

  it("does not fire when balance is zero", () => {
    const data = emptyData({
      customers: [makeCustomer()],
      receipts: [
        makeReceipt({
          customerId: "c1",
          createdAt: daysAgo(30),
          remainingBalanceCents: 0,
        }),
      ],
    });
    expect(
      runAttentionRules(data, NOW).find((i) => i.type === "receipt_open_balance"),
    ).toBeUndefined();
  });
});

describe("rule: customer_overdue_rebook", () => {
  it("fires when last service is well past the customer's median cadence", () => {
    const data = emptyData({
      customers: [makeCustomer()],
      appointments: [
        // Three completed jobs with ~30-day cadence
        makeAppointment({ id: "p1", status: "completed", start: daysAgo(120), finalPrice: 200 }),
        makeAppointment({ id: "p2", status: "completed", start: daysAgo(90), finalPrice: 200 }),
        makeAppointment({ id: "p3", status: "completed", start: daysAgo(60), finalPrice: 200 }),
      ],
    });
    // Median is ~30 days; last service was 60 days ago → 200% of median → overdue
    const item = runAttentionRules(data, NOW).find(
      (i) => i.type === "customer_overdue_rebook",
    );
    expect(item).toBeDefined();
  });

  it("does not fire when last service is within cadence", () => {
    const data = emptyData({
      customers: [makeCustomer()],
      appointments: [
        makeAppointment({ id: "p1", status: "completed", start: daysAgo(60), finalPrice: 200 }),
        makeAppointment({ id: "p2", status: "completed", start: daysAgo(30), finalPrice: 200 }),
        makeAppointment({ id: "p3", status: "completed", start: daysAgo(5), finalPrice: 200 }),
      ],
    });
    expect(
      runAttentionRules(data, NOW).find((i) => i.type === "customer_overdue_rebook"),
    ).toBeUndefined();
  });

  it("does not fire when there are fewer than 2 completed jobs (no cadence yet)", () => {
    const data = emptyData({
      customers: [makeCustomer()],
      appointments: [
        makeAppointment({ id: "p1", status: "completed", start: daysAgo(180), finalPrice: 200 }),
      ],
    });
    expect(
      runAttentionRules(data, NOW).find((i) => i.type === "customer_overdue_rebook"),
    ).toBeUndefined();
  });
});

describe("rule: high_value_dormant", () => {
  it("fires when high-value customer hasn't been serviced in 90+ days", () => {
    const data = emptyData({
      customers: [makeCustomer()],
      appointments: [
        // Lifetime $600 → high_value tier
        makeAppointment({ id: "p1", status: "completed", start: daysAgo(200), finalPrice: 600 }),
      ],
    });
    const item = runAttentionRules(data, NOW).find(
      (i) => i.type === "high_value_dormant",
    );
    expect(item).toBeDefined();
  });

  it("does not double-fire if rebook rule already covers them", () => {
    const data = emptyData({
      customers: [makeCustomer()],
      appointments: [
        // Two completed at 30-day cadence, last 200 days ago → both rules eligible
        makeAppointment({ id: "p1", status: "completed", start: daysAgo(260), finalPrice: 600 }),
        makeAppointment({ id: "p2", status: "completed", start: daysAgo(230), finalPrice: 600 }),
      ],
    });
    const items = runAttentionRules(data, NOW);
    const dormant = items.find((i) => i.type === "high_value_dormant");
    const rebook = items.find((i) => i.type === "customer_overdue_rebook");
    // Rebook wins; dormant suppressed.
    expect(rebook).toBeDefined();
    expect(dormant).toBeUndefined();
  });
});

/* ─────────────────────────────────────────────
   Leads
───────────────────────────────────────────── */

describe("rule: lead_uncontacted", () => {
  it("fires for status=new lead older than threshold", () => {
    const data = emptyData({
      leads: [
        makeLead({
          status: "new",
          createdAt: hoursAgo(ATTENTION_THRESHOLDS.LEAD_UNCONTACTED_HOURS + 1),
        }),
      ],
    });
    const items = runAttentionRules(data, NOW);
    const item = items.find((i) => i.type === "lead_uncontacted");
    expect(item).toBeDefined();
    expect(item?.priority).toBe("high");
  });

  it("auto-resolves once status moves off 'new'", () => {
    const data = emptyData({
      leads: [
        makeLead({
          status: "contacted",
          createdAt: hoursAgo(48),
        }),
      ],
    });
    expect(
      runAttentionRules(data, NOW).find((i) => i.type === "lead_uncontacted"),
    ).toBeUndefined();
  });
});

describe("rule: lead_followup_due", () => {
  it("fires when followUpDate is in the past and status is open", () => {
    const data = emptyData({
      leads: [
        makeLead({
          status: "contacted",
          followUpDate: daysAgo(1),
        }),
      ],
    });
    expect(
      runAttentionRules(data, NOW).find((i) => i.type === "lead_followup_due"),
    ).toBeDefined();
  });

  it("does not fire if status is booked or lost", () => {
    for (const closed of ["booked", "lost"] as const) {
      const data = emptyData({
        leads: [makeLead({ status: closed, followUpDate: daysAgo(1) })],
      });
      expect(
        runAttentionRules(data, NOW).find((i) => i.type === "lead_followup_due"),
      ).toBeUndefined();
    }
  });
});

describe("rule: lead_going_cold", () => {
  it("fires when last contact is more than 7 days ago and status is open", () => {
    const data = emptyData({
      leads: [
        makeLead({
          status: "waiting",
          lastContacted: daysAgo(10),
        }),
      ],
    });
    expect(
      runAttentionRules(data, NOW).find((i) => i.type === "lead_going_cold"),
    ).toBeDefined();
  });

  it("does not fire if lastContacted missing (no signal)", () => {
    const data = emptyData({
      leads: [makeLead({ status: "contacted" })],
    });
    expect(
      runAttentionRules(data, NOW).find((i) => i.type === "lead_going_cold"),
    ).toBeUndefined();
  });
});

/* ─────────────────────────────────────────────
   Operations
───────────────────────────────────────────── */

describe("rule: discount_expiring / discount_expired", () => {
  it("flags discounts within the expiring window", () => {
    const data = emptyData({
      services: [
        makeService({
          discount: { active: true, type: "percent", value: 10, expiry: daysAgo(-3) },
        }),
      ],
    });
    expect(
      runAttentionRules(data, NOW).find((i) => i.type === "discount_expiring"),
    ).toBeDefined();
  });

  it("flags expired but still active discounts", () => {
    const data = emptyData({
      services: [
        makeService({
          discount: { active: true, type: "percent", value: 10, expiry: daysAgo(2) },
        }),
      ],
    });
    expect(
      runAttentionRules(data, NOW).find((i) => i.type === "discount_expired"),
    ).toBeDefined();
  });
});

describe("rule: sales_tax_no_rate", () => {
  it("fires when salesTaxEnabled=true and rate is missing", () => {
    const data = emptyData({
      settings: { ...baseSettings, salesTaxEnabled: true, defaultTaxRate: undefined },
    });
    expect(
      runAttentionRules(data, NOW).find((i) => i.type === "sales_tax_no_rate"),
    ).toBeDefined();
  });

  it("does not fire when rate is set", () => {
    const data = emptyData({
      settings: { ...baseSettings, salesTaxEnabled: true, defaultTaxRate: 8.5 },
    });
    expect(
      runAttentionRules(data, NOW).find((i) => i.type === "sales_tax_no_rate"),
    ).toBeUndefined();
  });
});

/* ─────────────────────────────────────────────
   Engine — dedupe / sort / stability
───────────────────────────────────────────── */

describe("engine: dedupe + stability", () => {
  it("returns the same item ids for the same inputs", () => {
    const data = emptyData({
      customers: [makeCustomer()],
      appointments: [
        makeAppointment({
          status: "pending_approval",
          createdAt: hoursAgo(48),
        }),
      ],
    });
    const a = runAttentionRules(data, NOW).map((i) => i.id);
    const b = runAttentionRules(data, NOW).map((i) => i.id);
    expect(a).toEqual(b);
  });

  it("sorts critical before high before medium", () => {
    const data = emptyData({
      customers: [makeCustomer()],
      appointments: [
        // Stale pending (high), old enough but not very stale
        makeAppointment({
          id: "ax",
          status: "pending_approval",
          createdAt: hoursAgo(8),
        }),
        // Deposit paid pending (critical)
        makeAppointment({
          id: "ay",
          status: "pending_approval",
          createdAt: hoursAgo(8),
          paymentStatus: "deposit_paid",
          depositPaid: true,
        }),
        // Completed missing review (medium)
        makeAppointment({
          id: "az",
          status: "completed",
          start: hoursAgo(48),
          finalPrice: 200,
        }),
      ],
    });
    const items = sortAttentionItems(runAttentionRules(data, NOW));
    const priorities = items.map((i) => i.priority);
    // Critical must appear before high before medium in the order
    const ic = priorities.indexOf("critical");
    const ih = priorities.indexOf("high");
    const im = priorities.indexOf("medium");
    expect(ic).toBeGreaterThanOrEqual(0);
    expect(ih).toBeGreaterThanOrEqual(0);
    expect(im).toBeGreaterThanOrEqual(0);
    expect(ic).toBeLessThan(ih);
    expect(ih).toBeLessThan(im);
  });
});
