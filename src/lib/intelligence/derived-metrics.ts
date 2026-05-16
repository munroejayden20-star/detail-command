/**
 * Derived metrics — pure aggregations over AppData.
 *
 * Phase 1 surfaces these on the dashboard and feeds them to later AI tools.
 * They build on existing primitives in selectors.ts and tax-center.ts rather
 * than duplicating logic.
 *
 * Money math is in CENTS to match the receipts/tax-center side of the app.
 * Older Appointment.estimatedPrice/finalPrice are in dollars (legacy) — we
 * convert at the boundary where needed.
 */
import { differenceInDays, parseISO } from "date-fns";
import type {
  AppData,
  Appointment,
  Customer,
  Lead,
  LeadSource,
  Service,
} from "@/lib/types";
import type { ID } from "@/lib/types";
import { jobDurationMinutes } from "@/lib/selectors";
import { dollarsToCents } from "@/lib/receipts";
import {
  appointmentsInRange,
  appointmentsForCustomer,
  completedAppointmentsForCustomer,
  completedAppointmentsInRange,
  completedAppointmentsWithService,
  activeReceiptsInRange,
  lastCompletedServiceAt,
  medianRebookIntervalDays,
  openBalanceCentsForCustomer,
  withinRange,
} from "./data-access";
import { confidenceFromSample } from "./confidence";
import type {
  AttentionItem,
  BusinessSnapshot,
  CustomerIntelligenceProfile,
  CustomerValueTier,
  DateRange,
  LeadSourcePerformance,
  ServicePerformanceProfile,
} from "./types";
import { ATTENTION_PRIORITY_RANK } from "./types";

/* ─────────────────────────────────────────────
   Tier thresholds
───────────────────────────────────────────── */

const VIP_LIFETIME_CENTS = 150_000;          // $1,500+
const HIGH_VALUE_LIFETIME_CENTS = 50_000;    // $500+
const REGULAR_MIN_JOBS = 2;

function tierFor(spendCents: number, jobs: number): CustomerValueTier {
  if (spendCents >= VIP_LIFETIME_CENTS) return "vip";
  if (spendCents >= HIGH_VALUE_LIFETIME_CENTS) return "high_value";
  if (jobs >= REGULAR_MIN_JOBS) return "regular";
  return "new";
}

/* ─────────────────────────────────────────────
   BusinessSnapshot
───────────────────────────────────────────── */

/**
 * Compute a normalized snapshot of the business across a date range. The
 * range is interpreted against `appointment.start` for activity counts and
 * `receipt.createdAt` for money. Extends tax-center's aggregate() with the
 * non-tax fields the AI layer also needs.
 */
export function buildBusinessSnapshot(
  data: AppData,
  range: DateRange,
  attention: AttentionItem[] = [],
): BusinessSnapshot {
  const apptsInRange = appointmentsInRange(data, range);
  const completed = apptsInRange.filter((a) => a.status === "completed");
  const scheduled = apptsInRange.filter(
    (a) => a.status === "scheduled" || a.status === "confirmed" || a.status === "in_progress",
  );
  const canceled = apptsInRange.filter((a) => a.status === "canceled");
  const pending = apptsInRange.filter((a) => a.status === "pending_approval");

  // Money — receipts are the source of truth for "actually collected".
  const receipts = activeReceiptsInRange(data, range);
  const collectedCents = receipts.reduce((s, r) => s + r.amountPaidCents, 0);
  const outstandingCents = receipts.reduce((s, r) => s + r.remainingBalanceCents, 0);
  const salesTaxCollectedCents = receipts.reduce((s, r) => s + r.taxCents, 0);

  const totalExpensesCents = (data.expenses ?? [])
    .filter((e) => withinRange(e.date, range))
    .reduce((sum, e) => {
      const v = Number(e.amount) || 0;
      return sum + (e.kind === "credit" ? -v : v);
    }, 0) * 100;

  // Booked future revenue = scheduled/confirmed/in_progress jobs in range
  // whose start is after now. Use estimatedPrice (legacy dollars) when no
  // finalPriceCents on the appointment.
  const now = Date.now();
  const bookedFutureCents = apptsInRange
    .filter(
      (a) =>
        (a.status === "scheduled" || a.status === "confirmed" || a.status === "in_progress") &&
        parseISO(a.start).getTime() >= now,
    )
    .reduce((sum, a) => sum + appointmentRevenueCents(a), 0);

  const completedTotalsCents = completed.reduce(
    (sum, a) => sum + appointmentRevenueCents(a),
    0,
  );
  const averageTicketCents = completed.length > 0
    ? Math.round(completedTotalsCents / completed.length)
    : 0;

  // Mileage is included in tax-center; keep snapshot-level math simple here.
  // Net profit = collected − salesTax − expenses. We deliberately don't
  // subtract mileage deduction here so this is a "cash" view; tax-center
  // remains the authoritative tax view.
  const estimatedNetProfitCents = Math.max(
    0,
    collectedCents - salesTaxCollectedCents - Math.round(totalExpensesCents),
  );

  // Leads
  const leadsCreated = data.leads.filter((l) => withinRange(l.createdAt, range)).length;
  const leadsConverted = data.leads.filter(
    (l) => l.status === "booked" && withinRange(l.createdAt, range),
  ).length;
  const leadConversionRate = leadsCreated > 0 ? leadsConverted / leadsCreated : 0;

  // Attention
  const attentionOpenCount = attention.length;
  const attentionHighCount = attention.filter(
    (a) => ATTENTION_PRIORITY_RANK[a.priority] <= ATTENTION_PRIORITY_RANK.high,
  ).length;

  return {
    range,
    appointmentsTotal: apptsInRange.length,
    appointmentsCompleted: completed.length,
    appointmentsScheduled: scheduled.length,
    appointmentsCanceled: canceled.length,
    appointmentsPending: pending.length,
    collectedCents,
    outstandingCents,
    salesTaxCollectedCents,
    totalExpensesCents: Math.round(totalExpensesCents),
    bookedFutureCents,
    averageTicketCents,
    estimatedNetProfitCents,
    leadsCreated,
    leadsConverted,
    leadConversionRate,
    attentionOpenCount,
    attentionHighCount,
    generatedAt: new Date().toISOString(),
  };
}

/** Cents value for an appointment's revenue contribution (final > est > 0). */
export function appointmentRevenueCents(a: Appointment): number {
  if (a.status === "canceled") return 0;
  if (typeof a.finalPriceCents === "number" && a.finalPriceCents > 0) return a.finalPriceCents;
  if (typeof a.finalPrice === "number" && a.finalPrice > 0) return dollarsToCents(a.finalPrice);
  if (typeof a.estimatedPrice === "number" && a.estimatedPrice > 0) {
    return dollarsToCents(a.estimatedPrice);
  }
  return 0;
}

/* ─────────────────────────────────────────────
   CustomerIntelligenceProfile
───────────────────────────────────────────── */

/** "Due"/"overdue" thresholds against the median rebook interval. */
const REBOOK_DUE_RATIO = 0.85;     // ≥ 85% of median → "due"
const REBOOK_OVERDUE_RATIO = 1.2;  // ≥ 120% of median → "overdue"

export function buildCustomerProfile(
  data: AppData,
  customer: Customer,
  now: Date = new Date(),
): CustomerIntelligenceProfile {
  const all = appointmentsForCustomer(data, customer.id);
  const completed = completedAppointmentsForCustomer(data, customer.id);

  const lifetimeRevenueCents = completed.reduce(
    (s, a) => s + appointmentRevenueCents(a),
    0,
  );
  // Receipts are more accurate when present.
  const lifetimeSpendCents = (data.receipts ?? [])
    .filter((r) => r.customerId === customer.id && r.receiptStatus === "active")
    .reduce((s, r) => s + r.amountPaidCents, 0);

  const averageTicketCents = completed.length > 0
    ? Math.round(lifetimeRevenueCents / completed.length)
    : 0;

  const lastServiceAt = lastCompletedServiceAt(data, customer.id);
  const daysSinceLastService = lastServiceAt
    ? differenceInDays(now, parseISO(lastServiceAt))
    : null;

  const median = medianRebookIntervalDays(data, customer.id);

  let rebookStatus: CustomerIntelligenceProfile["rebookStatus"] = "unknown";
  if (median != null && daysSinceLastService != null) {
    if (daysSinceLastService >= median * REBOOK_OVERDUE_RATIO) rebookStatus = "overdue";
    else if (daysSinceLastService >= median * REBOOK_DUE_RATIO) rebookStatus = "due";
    else rebookStatus = "fresh";
  }

  const tier = tierFor(
    lifetimeSpendCents > 0 ? lifetimeSpendCents : lifetimeRevenueCents,
    completed.length,
  );

  // Latest appointment review-request flag (sorted desc).
  const latestCompleted = completed.length > 0 ? completed[completed.length - 1] : null;
  const reviewRequestSentForLatest = Boolean(latestCompleted?.reviewRequestSent);

  return {
    customerId: customer.id,
    lifetimeSpendCents,
    lifetimeRevenueCents,
    averageTicketCents,
    completedJobs: completed.length,
    totalJobs: all.length,
    lastServiceAt,
    daysSinceLastService,
    medianRebookIntervalDays: median,
    rebookStatus,
    tier,
    reviewRequestSentForLatest,
    openBalanceCents: openBalanceCentsForCustomer(data, customer.id),
  };
}

/* ─────────────────────────────────────────────
   ServicePerformanceProfile
───────────────────────────────────────────── */

export function buildServicePerformance(
  data: AppData,
  service: Service,
): ServicePerformanceProfile {
  const completed = completedAppointmentsWithService(data, service.id);
  const finalPriceCents = completed
    .map((a) => appointmentRevenueCents(a))
    .filter((c) => c > 0);
  const averageFinalPriceCents = finalPriceCents.length > 0
    ? Math.round(finalPriceCents.reduce((s, n) => s + n, 0) / finalPriceCents.length)
    : 0;

  const durations = completed
    .map((a) => jobDurationMinutes(a))
    .filter((m): m is number => m != null);
  const averageDurationMinutes = durations.length > 0
    ? Math.round(durations.reduce((s, n) => s + n, 0) / durations.length)
    : null;

  const averageHourlyCents = averageDurationMinutes != null && averageDurationMinutes > 0
    ? Math.round((averageFinalPriceCents / averageDurationMinutes) * 60)
    : null;

  // Quote-to-final delta — only count appointments where both estimate and
  // a real "final" exist.
  const deltas: number[] = [];
  for (const a of completed) {
    const finalC = a.finalPriceCents ??
      (typeof a.finalPrice === "number" && a.finalPrice > 0 ? dollarsToCents(a.finalPrice) : null);
    if (finalC == null) continue;
    if (a.estimatedPrice == null || a.estimatedPrice <= 0) continue;
    deltas.push(finalC - dollarsToCents(a.estimatedPrice));
  }
  const averageQuoteToFinalDeltaCents = deltas.length > 0
    ? Math.round(deltas.reduce((s, n) => s + n, 0) / deltas.length)
    : null;

  return {
    serviceId: service.id,
    serviceName: service.name,
    jobsCount: completed.length,
    averageFinalPriceCents,
    averageDurationMinutes,
    averageHourlyCents,
    averageQuoteToFinalDeltaCents,
    confidence: confidenceFromSample(completed.length),
    sampleSize: completed.length,
  };
}

/* ─────────────────────────────────────────────
   LeadSourcePerformance
───────────────────────────────────────────── */

export function buildLeadSourcePerformance(
  data: AppData,
): LeadSourcePerformance[] {
  const bySource = new Map<LeadSource, Lead[]>();
  for (const lead of data.leads) {
    const list = bySource.get(lead.source) ?? [];
    list.push(lead);
    bySource.set(lead.source, list);
  }

  const out: LeadSourcePerformance[] = [];
  for (const [source, leads] of bySource.entries()) {
    const converted = leads.filter((l) => l.status === "booked");
    // Revenue attribution: sum of completed-appointment revenue for the
    // customer the lead converted into. We don't currently link a Lead → a
    // specific Customer; best-effort fallback is to match by name.
    let totalRevenueCents = 0;
    for (const lead of converted) {
      const cust = data.customers.find(
        (c) => c.name.trim().toLowerCase() === lead.name.trim().toLowerCase(),
      );
      if (!cust) continue;
      const completed = completedAppointmentsForCustomer(data, cust.id);
      totalRevenueCents += completed.reduce((s, a) => s + appointmentRevenueCents(a), 0);
    }
    const averageRevenueCents = converted.length > 0
      ? Math.round(totalRevenueCents / converted.length)
      : 0;
    out.push({
      source,
      leadsCount: leads.length,
      convertedCount: converted.length,
      conversionRate: leads.length > 0 ? converted.length / leads.length : 0,
      averageRevenueCents,
      totalRevenueCents,
      confidence: confidenceFromSample(leads.length),
    });
  }

  return out.sort((a, b) => b.totalRevenueCents - a.totalRevenueCents);
}

/* ─────────────────────────────────────────────
   Helpers used by rules + UI
───────────────────────────────────────────── */

/** Top customer profiles sorted by lifetime spend (most valuable first). */
export function topCustomerProfiles(
  data: AppData,
  limit = 10,
  now: Date = new Date(),
): CustomerIntelligenceProfile[] {
  return data.customers
    .map((c) => buildCustomerProfile(data, c, now))
    .sort((a, b) => {
      const aV = a.lifetimeSpendCents || a.lifetimeRevenueCents;
      const bV = b.lifetimeSpendCents || b.lifetimeRevenueCents;
      return bV - aV;
    })
    .slice(0, limit);
}

/** Current attention-relevant customers: those whose rebookStatus is due/overdue. */
export function rebookCandidates(
  data: AppData,
  now: Date = new Date(),
): CustomerIntelligenceProfile[] {
  return data.customers
    .map((c) => buildCustomerProfile(data, c, now))
    .filter((p) => p.rebookStatus === "due" || p.rebookStatus === "overdue");
}

/** Aliased ID type re-export for ergonomics. */
export type { ID };
