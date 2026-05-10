import {
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  parseISO,
} from "date-fns";
import type { Expense, MileageEntry, Receipt } from "./types";

// IRS standard business mileage rate — update annually when the IRS publishes
// the new rate (https://www.irs.gov/tax-professionals/standard-mileage-rates).
// Stored in cents per mile to match the rest of the money math in this app.
// 2025 rate: 70 cents/mile.
export const IRS_MILEAGE_RATE_CENTS_PER_MILE = 70;

export type TaxPeriodKey = "this_week" | "this_month" | "this_quarter" | "this_year" | "all" | "custom";

export interface TaxPeriod {
  key: TaxPeriodKey;
  label: string;
  start: Date | null;  // null = no lower bound (used by 'all')
  end: Date | null;
}

export function buildPeriod(
  key: TaxPeriodKey,
  custom?: { start: Date; end: Date }
): TaxPeriod {
  const now = new Date();
  switch (key) {
    case "this_week":
      return {
        key,
        label: "This week",
        start: startOfWeek(now, { weekStartsOn: 0 }),
        end: endOfWeek(now, { weekStartsOn: 0 }),
      };
    case "this_month":
      return { key, label: "This month", start: startOfMonth(now), end: endOfMonth(now) };
    case "this_quarter":
      return { key, label: "This quarter", start: startOfQuarter(now), end: endOfQuarter(now) };
    case "this_year":
      return { key, label: "This year", start: startOfYear(now), end: endOfYear(now) };
    case "all":
      return { key, label: "All time", start: null, end: null };
    case "custom":
      return {
        key,
        label: "Custom",
        start: custom?.start ?? startOfMonth(now),
        end: custom?.end ?? endOfMonth(now),
      };
  }
}

function withinPeriod(iso: string, period: TaxPeriod): boolean {
  if (!iso) return false;
  if (period.start === null && period.end === null) return true;
  let t: number;
  try {
    t = parseISO(iso).getTime();
  } catch {
    return false;
  }
  if (Number.isNaN(t)) return false;
  if (period.start && t < period.start.getTime()) return false;
  if (period.end && t > period.end.getTime()) return false;
  return true;
}

export function isMileageInPeriod(m: MileageEntry, period: TaxPeriod): boolean {
  return withinPeriod(m.entryDate, period);
}

export interface MileageAggregates {
  tripsCount: number;
  businessMiles: number;
  personalMiles: number;
  totalMiles: number;
  /** Business miles × IRS standard rate. */
  deductionCents: number;
  chargingCostCents: number;
}

export function aggregateMileage(
  entries: MileageEntry[],
  period: TaxPeriod
): MileageAggregates {
  const inPeriod = (entries ?? []).filter((m) => isMileageInPeriod(m, period));
  const businessMiles = inPeriod.filter((m) => m.isBusiness).reduce((s, m) => s + Number(m.miles || 0), 0);
  const personalMiles = inPeriod.filter((m) => !m.isBusiness).reduce((s, m) => s + Number(m.miles || 0), 0);
  const chargingCostCents = inPeriod.reduce((s, m) => s + (m.chargingCostCents ?? 0), 0);
  return {
    tripsCount: inPeriod.length,
    businessMiles,
    personalMiles,
    totalMiles: businessMiles + personalMiles,
    deductionCents: Math.round(businessMiles * IRS_MILEAGE_RATE_CENTS_PER_MILE),
    chargingCostCents,
  };
}

/* ─────────────────────────────────────────────
   Aggregations
───────────────────────────────────────────── */

export interface TaxAggregates {
  receiptsCount: number;
  grossRevenueCents: number;       // sum of amount_paid (only collected money)
  outstandingCents: number;        // unpaid balances
  salesTaxCollectedCents: number;
  totalExpensesCents: number;
  mileageDeductionCents: number;   // business miles × IRS standard rate
  businessMiles: number;
  netProfitCents: number;          // grossRevenue - expenses - mileage deduction
  averageReceiptCents: number;
  setAsideCents: number;           // recommended tax set-aside ($)
  setAsidePercent: number;         // the % used
}

export function aggregate(
  receipts: Receipt[],
  expenses: Expense[],
  period: TaxPeriod,
  setAsidePercent: number,
  mileageEntries: MileageEntry[] = []
): TaxAggregates {
  const inPeriodReceipts = (receipts ?? []).filter(
    (r) => r.receiptStatus === "active" && withinPeriod(r.createdAt, period)
  );
  const inPeriodExpenses = (expenses ?? []).filter((e) => withinPeriod(e.date, period));

  const grossRevenueCents = inPeriodReceipts.reduce((s, r) => s + r.amountPaidCents, 0);
  const outstandingCents = inPeriodReceipts.reduce((s, r) => s + r.remainingBalanceCents, 0);
  const salesTaxCollectedCents = inPeriodReceipts.reduce((s, r) => s + r.taxCents, 0);
  // Expenses are stored in dollars (legacy). Convert to cents.
  // Credits (gift cards, refunds, rebates) subtract from total spend.
  const totalExpensesCents = Math.round(
    inPeriodExpenses.reduce((s, e) => {
      const signed = e.kind === "credit" ? -(Number(e.amount) || 0) : (Number(e.amount) || 0);
      return s + signed;
    }, 0) * 100
  );
  const mileage = aggregateMileage(mileageEntries, period);
  const mileageDeductionCents = mileage.deductionCents;
  // Net profit = collected revenue - sales tax (passed through, not income)
  // - business expenses - business mileage deduction. Rough estimate only.
  const netProfitCents = Math.max(
    0,
    grossRevenueCents - salesTaxCollectedCents - totalExpensesCents - mileageDeductionCents
  );
  const averageReceiptCents = inPeriodReceipts.length
    ? Math.round(grossRevenueCents / inPeriodReceipts.length)
    : 0;
  const setAsideCents = Math.round((netProfitCents * setAsidePercent) / 100);

  return {
    receiptsCount: inPeriodReceipts.length,
    grossRevenueCents,
    outstandingCents,
    salesTaxCollectedCents,
    totalExpensesCents,
    mileageDeductionCents,
    businessMiles: mileage.businessMiles,
    netProfitCents,
    averageReceiptCents,
    setAsideCents,
    setAsidePercent,
  };
}
