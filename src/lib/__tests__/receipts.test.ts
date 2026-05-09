import { describe, it, expect } from "vitest";
import {
  buildReceiptFromAppointment,
  centsToDollars,
  dollarsToCents,
  formatCents,
  publicReceiptUrl,
  makeReceiptToken,
} from "../receipts";
import type { Appointment, Customer, Service, Settings } from "../types";

const settings: Settings = {
  theme: "system",
  bufferMinutes: 30,
  maxJobsPerDay: 3,
  weekdayEvenings: true,
  weekdayUnavailableStart: "08:00",
  weekdayUnavailableEnd: "17:00",
  startupGoal: 2000,
  businessName: "JMD",
  ownerName: "Jayden",
  contactPhone: "+13605551234",
  weekendAvailability: true,
  workdayStart: "08:00",
  workdayEnd: "18:00",
  defaultAppointmentDuration: 90,
};

const customer: Customer = {
  id: "c1",
  name: "Alice",
  phone: "+13605555678",
  vehicles: [],
  createdAt: "2025-01-01T00:00:00Z",
};

const services: Service[] = [
  {
    id: "s1",
    name: "Full Detail",
    description: "Wash + interior",
    priceLow: 200,
    priceHigh: 250,
    durationMinutes: 180,
    isAddon: false,
  },
  {
    id: "a1",
    name: "Pet hair",
    priceLow: 30,
    priceHigh: 40,
    durationMinutes: 30,
    isAddon: true,
  },
];

const appt: Appointment = {
  id: "appt1",
  customerId: "c1",
  vehicle: { year: "2020", make: "Honda", model: "Civic", color: "Red" },
  address: "123 Main",
  start: "2025-06-15T15:00:00Z",
  end: "2025-06-15T18:00:00Z",
  serviceIds: ["s1"],
  addonIds: ["a1"],
  estimatedPrice: 250,
  depositPaid: false,
  paymentStatus: "unpaid",
  status: "completed",
  petHair: false,
  stains: false,
  heavyDirt: false,
  waterAccess: true,
  powerAccess: true,
  createdAt: "2025-06-01T00:00:00Z",
};

describe("dollarsToCents / centsToDollars / formatCents", () => {
  it("dollarsToCents handles ints and decimals", () => {
    expect(dollarsToCents(10)).toBe(1000);
    expect(dollarsToCents(10.5)).toBe(1050);
    expect(dollarsToCents(10.555)).toBe(1056); // rounds
  });

  it("dollarsToCents handles null / NaN", () => {
    expect(dollarsToCents(null)).toBe(0);
    expect(dollarsToCents(undefined)).toBe(0);
    expect(dollarsToCents(NaN)).toBe(0);
  });

  it("centsToDollars round-trips", () => {
    expect(centsToDollars(1234)).toBe(12.34);
    expect(centsToDollars(0)).toBe(0);
    expect(centsToDollars(null)).toBe(0);
  });

  it("formatCents renders USD", () => {
    expect(formatCents(1234)).toBe("$12.34");
    expect(formatCents(0)).toBe("$0.00");
  });
});

describe("buildReceiptFromAppointment", () => {
  it("creates receipt with line items for each service + addon", () => {
    const r = buildReceiptFromAppointment({
      appointment: appt,
      customer,
      services,
      settings,
      finalPriceCents: 25000,
      paymentMethod: "cash",
      paymentStatus: "paid",
    });
    expect(r.lineItems).toHaveLength(2);
    expect(r.lineItems[0].name).toBe("Full Detail");
    expect(r.lineItems[1].name).toBe("Pet hair");
    expect(r.lineItems[1].category).toBe("addon");
  });

  it("subtotal uses finalPriceCents when provided", () => {
    const r = buildReceiptFromAppointment({
      appointment: appt,
      customer,
      services,
      settings,
      finalPriceCents: 30000,
      paymentMethod: "cash",
      paymentStatus: "paid",
    });
    expect(r.subtotalCents).toBe(30000);
    expect(r.totalCents).toBe(30000);
    expect(r.amountPaidCents).toBe(30000);
    expect(r.remainingBalanceCents).toBe(0);
  });

  it("falls back to summing line items when finalPriceCents is 0", () => {
    const r = buildReceiptFromAppointment({
      appointment: appt,
      customer,
      services,
      settings,
      finalPriceCents: 0,
      paymentMethod: "cash",
      paymentStatus: "paid",
    });
    // service avg = (200+250)/2 = 225, addon avg = (30+40)/2 = 35 → 26000 cents
    expect(r.subtotalCents).toBe(26000);
  });

  it("computes total = subtotal - discount + tax and balance correctly", () => {
    const r = buildReceiptFromAppointment({
      appointment: appt,
      customer,
      services,
      settings,
      finalPriceCents: 25000,
      discountCents: 2000,
      taxCents: 1000,
      depositPaidCents: 5000,
      paymentMethod: "card",
      paymentStatus: "partial",
    });
    expect(r.totalCents).toBe(25000 - 2000 + 1000); // 24000
    // partial → amountPaid = depositPaid only
    expect(r.amountPaidCents).toBe(5000);
    expect(r.remainingBalanceCents).toBe(24000 - 5000);
  });

  it("paid status fills amountPaid to total even when no deposit", () => {
    const r = buildReceiptFromAppointment({
      appointment: appt,
      customer,
      services,
      settings,
      finalPriceCents: 25000,
      paymentMethod: "cash",
      paymentStatus: "paid",
    });
    expect(r.amountPaidCents).toBe(25000);
    expect(r.remainingBalanceCents).toBe(0);
  });

  it("snapshot fields are populated from current settings + customer + vehicle", () => {
    const r = buildReceiptFromAppointment({
      appointment: appt,
      customer,
      services,
      settings,
      finalPriceCents: 25000,
      paymentMethod: "cash",
      paymentStatus: "paid",
    });
    expect(r.customerSnapshot?.name).toBe("Alice");
    expect(r.vehicleSnapshot?.make).toBe("Honda");
    expect(r.businessSnapshot?.name).toBe("JMD");
    expect(r.appointmentSnapshot?.serviceNames).toContain("Full Detail");
    expect(r.appointmentSnapshot?.addonNames).toContain("Pet hair");
  });

  it("generates a unique public receipt token", () => {
    const r1 = buildReceiptFromAppointment({
      appointment: appt,
      customer,
      services,
      settings,
      finalPriceCents: 25000,
      paymentMethod: "cash",
    });
    const r2 = buildReceiptFromAppointment({
      appointment: appt,
      customer,
      services,
      settings,
      finalPriceCents: 25000,
      paymentMethod: "cash",
    });
    expect(r1.publicReceiptToken).toBeTruthy();
    expect(r2.publicReceiptToken).not.toBe(r1.publicReceiptToken);
  });
});

describe("publicReceiptUrl + makeReceiptToken", () => {
  it("makeReceiptToken returns a 40-char string", () => {
    const t = makeReceiptToken();
    expect(t.length).toBe(40);
  });

  it("publicReceiptUrl returns relative path when no window", () => {
    // node env has no window → relative
    expect(publicReceiptUrl("abc")).toMatch(/\/receipt\/abc/);
  });
});
