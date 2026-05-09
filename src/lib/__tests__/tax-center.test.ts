import { describe, it, expect } from "vitest";
import {
  buildPeriod,
  aggregate,
  aggregateMileage,
  IRS_MILEAGE_RATE_CENTS_PER_MILE,
} from "../tax-center";
import type { Receipt, Expense, MileageEntry } from "../types";

const rPaid: Receipt = {
  id: "r1",
  receiptNumber: "JMD-001",
  receiptStatus: "active",
  paymentStatus: "paid",
  paymentMethod: "cash",
  subtotalCents: 25000,
  discountCents: 0,
  taxCents: 2000,
  depositPaidCents: 0,
  totalCents: 27000,
  amountPaidCents: 27000,
  remainingBalanceCents: 0,
  currency: "usd",
  lineItems: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const rUnpaid: Receipt = {
  ...rPaid,
  id: "r2",
  amountPaidCents: 5000,
  remainingBalanceCents: 22000,
  paymentStatus: "partial",
};

const rVoid: Receipt = {
  ...rPaid,
  id: "r3",
  receiptStatus: "voided",
};

const e1: Expense = {
  id: "e1",
  date: new Date().toISOString(),
  category: "products",
  amount: 50, // dollars
};

describe("aggregate (no mileage)", () => {
  it("only counts active receipts in gross revenue", () => {
    const period = buildPeriod("all");
    const a = aggregate([rPaid, rVoid], [], period, 25);
    expect(a.receiptsCount).toBe(1);
    expect(a.grossRevenueCents).toBe(27000);
  });

  it("adds outstanding from partial/unpaid receipts", () => {
    const period = buildPeriod("all");
    const a = aggregate([rPaid, rUnpaid], [], period, 25);
    expect(a.outstandingCents).toBe(22000);
  });

  it("net profit subtracts sales tax + expenses + mileage from gross", () => {
    const period = buildPeriod("all");
    const a = aggregate([rPaid], [e1], period, 25);
    // 27000 - 2000 (sales tax) - 5000 (expense) - 0 (mileage) = 20000
    expect(a.netProfitCents).toBe(20000);
  });

  it("set-aside applies the configured percent to net profit", () => {
    const period = buildPeriod("all");
    const a = aggregate([rPaid], [], period, 30);
    // net = 27000 - 2000 = 25000; 30% → 7500
    expect(a.setAsideCents).toBe(7500);
  });
});

describe("aggregate with mileage", () => {
  const today = new Date();
  const todayDate = today.toISOString().slice(0, 10);

  const businessMile: MileageEntry = {
    id: "m1",
    entryDate: todayDate,
    miles: 50,
    isBusiness: true,
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  };
  const personalMile: MileageEntry = {
    id: "m2",
    entryDate: todayDate,
    miles: 10,
    isBusiness: false,
    createdAt: today.toISOString(),
    updatedAt: today.toISOString(),
  };

  it("aggregateMileage sums business vs personal separately", () => {
    const period = buildPeriod("all");
    const m = aggregateMileage([businessMile, personalMile], period);
    expect(m.businessMiles).toBe(50);
    expect(m.personalMiles).toBe(10);
    expect(m.totalMiles).toBe(60);
    expect(m.tripsCount).toBe(2);
  });

  it("deduction = business miles × IRS standard rate", () => {
    const period = buildPeriod("all");
    const m = aggregateMileage([businessMile], period);
    expect(m.deductionCents).toBe(50 * IRS_MILEAGE_RATE_CENTS_PER_MILE);
  });

  it("aggregate(receipts, expenses, period, %, mileage) reduces net profit by deduction", () => {
    const period = buildPeriod("all");
    const without = aggregate([rPaid], [], period, 25, []);
    const withMile = aggregate([rPaid], [], period, 25, [businessMile]);
    const expectedDelta = 50 * IRS_MILEAGE_RATE_CENTS_PER_MILE;
    expect(without.netProfitCents - withMile.netProfitCents).toBe(expectedDelta);
  });
});

describe("buildPeriod", () => {
  it("'all' has no bounds", () => {
    const p = buildPeriod("all");
    expect(p.start).toBeNull();
    expect(p.end).toBeNull();
  });

  it("'this_year' returns a bounded period", () => {
    const p = buildPeriod("this_year");
    expect(p.start).toBeInstanceOf(Date);
    expect(p.end).toBeInstanceOf(Date);
    expect(p.start!.getFullYear()).toBe(new Date().getFullYear());
  });
});
