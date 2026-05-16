/**
 * Insights — narrative business observations derived from analytics.
 *
 * Phase H2 implementation. Each insight family is a small pure function
 * over AppData that yields zero or more `BusinessInsight`s. The engine
 * combines and sorts them. Below `MIN_SAMPLE_FOR_INSIGHT`, an insight is
 * SUPPRESSED entirely — we do not surface generic statements without
 * supporting data.
 *
 * Insights are advisory: every one ships with confidence + sample size and,
 * where applicable, a recommended action. None of them mutate state.
 */
import { parseISO } from "date-fns";
import type { AppData } from "@/lib/types";
import { jobDurationMinutes } from "@/lib/selectors";
import {
  appointmentRevenueCents,
  buildLeadSourcePerformance,
  buildServicePerformance,
  rebookCandidates,
} from "./derived-metrics";
import { buildRevenuePace, buildWorkloadForecast } from "./forecasts";
import { confidenceFromSample, hasMinimumSample } from "./confidence";
import type { BusinessInsight } from "./types";

/* ─────────────────────────────────────────────
   Tunable thresholds for what's "interesting"
───────────────────────────────────────────── */

export const INSIGHT_THRESHOLDS = {
  /** Quote-vs-final delta magnitude (cents) below which we don't bother. */
  PRICING_DRIFT_MIN_CENTS: 1500,
  /** Duration delta magnitude (minutes) below which we don't bother. */
  DURATION_DRIFT_MIN_MINUTES: 20,
  /** Last-month vs this-month average ticket delta ratio worth surfacing. */
  AVERAGE_TICKET_TREND_MIN_RATIO: 0.08,
  /** Min underbooked days in next 7 to flag a "schedule looks light" insight. */
  UNDERBOOKED_DAYS_THRESHOLD: 3,
} as const;

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

function dollars(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  if (abs % 100 === 0) return `${sign}$${(abs / 100).toFixed(0)}`;
  return `${sign}$${(abs / 100).toFixed(2)}`;
}

function pct(ratio: number, fractionDigits = 0): string {
  return `${(ratio * 100).toFixed(fractionDigits)}%`;
}

function isoNow(now: Date): string {
  return now.toISOString();
}

function makeId(...parts: string[]): string {
  return ["ins", ...parts].join("_");
}

/* ─────────────────────────────────────────────
   Pricing drift — per service
───────────────────────────────────────────── */

function pricingDriftInsights(data: AppData, now: Date): BusinessInsight[] {
  const out: BusinessInsight[] = [];
  for (const service of data.services) {
    if (service.isAddon) continue;
    const perf = buildServicePerformance(data, service);
    if (!hasMinimumSample(perf.sampleSize)) continue;
    const delta = perf.averageQuoteToFinalDeltaCents;
    if (delta == null) continue;
    if (Math.abs(delta) < INSIGHT_THRESHOLDS.PRICING_DRIFT_MIN_CENTS) continue;

    const direction = delta > 0 ? "above" : "below";
    const verb = delta > 0 ? "raise" : "review";
    out.push({
      id: makeId("pricing_drift", service.id),
      type: "pricing_drift",
      title: delta > 0
        ? `${service.name} averages ${dollars(delta)} above quote`
        : `${service.name} averages ${dollars(Math.abs(delta))} below quote`,
      summary: `Across ${perf.sampleSize} completed ${perf.sampleSize === 1 ? "job" : "jobs"}, the final price is consistently ${direction} the calculator estimate. Worth ${verb}-ing the calculator multiplier or the service's price range.`,
      detail: `Avg quote-to-final delta: ${dollars(delta)} · Avg final: ${dollars(perf.averageFinalPriceCents)}`,
      confidence: perf.confidence,
      sampleSize: perf.sampleSize,
      recommendedAction: { label: "Open calculator", linkUrl: "/calculator" },
      sourceType: "internal",
      metadata: { serviceId: service.id, deltaCents: delta },
      generatedAt: isoNow(now),
    });
  }
  return out;
}

/* ─────────────────────────────────────────────
   Duration drift — actual vs configured durationMinutes
───────────────────────────────────────────── */

function durationDriftInsights(data: AppData, now: Date): BusinessInsight[] {
  const out: BusinessInsight[] = [];
  for (const service of data.services) {
    if (service.isAddon) continue;
    if (!service.durationMinutes || service.durationMinutes <= 0) continue;
    const completed = data.appointments.filter(
      (a) => a.status === "completed" && a.serviceIds.includes(service.id),
    );
    const durations = completed
      .map((a) => jobDurationMinutes(a))
      .filter((m): m is number => m != null && m > 0);
    if (!hasMinimumSample(durations.length)) continue;

    const avg = durations.reduce((s, n) => s + n, 0) / durations.length;
    const delta = avg - service.durationMinutes;
    if (Math.abs(delta) < INSIGHT_THRESHOLDS.DURATION_DRIFT_MIN_MINUTES) continue;

    out.push({
      id: makeId("duration_drift", service.id),
      type: "duration_drift",
      title: delta > 0
        ? `${service.name} runs ${Math.round(delta)} min over your estimate`
        : `${service.name} runs ${Math.round(Math.abs(delta))} min under your estimate`,
      summary: delta > 0
        ? `Actual average is ${Math.round(avg)} min vs the ${service.durationMinutes} min configured. Consider widening the slot so you're not running late.`
        : `Actual average is ${Math.round(avg)} min vs the ${service.durationMinutes} min configured. You may be reserving more time than you need — could fit more jobs.`,
      detail: `Across ${durations.length} timed ${durations.length === 1 ? "job" : "jobs"}.`,
      confidence: confidenceFromSample(durations.length),
      sampleSize: durations.length,
      recommendedAction: { label: "Open service", linkUrl: "/services" },
      sourceType: "internal",
      metadata: { serviceId: service.id, deltaMinutes: delta },
      generatedAt: isoNow(now),
    });
  }
  return out;
}

/* ─────────────────────────────────────────────
   Revenue pace
───────────────────────────────────────────── */

function revenuePaceInsight(data: AppData, now: Date): BusinessInsight[] {
  const pace = buildRevenuePace(data, now);
  if (!pace.hasEnoughDataToProject) return [];
  if (pace.lastMonthCollectedCents <= 0 && pace.collectedMtdCents <= 0) return [];

  const ahead = pace.projectionVsLastMonthRatio > 0;
  const ratio = Math.abs(pace.projectionVsLastMonthRatio);

  const title = pace.lastMonthCollectedCents > 0
    ? `On pace for ${dollars(pace.projectedMonthEndCents)} this month — ${pct(ratio)} ${ahead ? "above" : "below"} last month`
    : `On pace for ${dollars(pace.projectedMonthEndCents)} this month`;

  const summary = pace.lastMonthCollectedCents > 0
    ? `Collected ${dollars(pace.collectedMtdCents)} so far over ${pace.daysElapsed} days. Last month finished at ${dollars(pace.lastMonthCollectedCents)}.`
    : `Collected ${dollars(pace.collectedMtdCents)} over ${pace.daysElapsed} days; projected through month-end based on current pace.`;

  return [{
    id: makeId("revenue_pace", `${now.getFullYear()}-${now.getMonth() + 1}`),
    type: "revenue_pace",
    title,
    summary,
    detail: pace.bookedRemainingCents > 0
      ? `Plus ${dollars(pace.bookedRemainingCents)} already booked for the rest of the month.`
      : undefined,
    // Pace is a projection; mark "medium" until late in the month.
    confidence: pace.daysElapsed >= 20 ? "high" : pace.daysElapsed >= 10 ? "medium" : "low",
    recommendedAction: { label: "Open Revenue", linkUrl: "/revenue" },
    sourceType: "internal",
    metadata: {
      collectedMtdCents: pace.collectedMtdCents,
      projectedMonthEndCents: pace.projectedMonthEndCents,
      lastMonthCollectedCents: pace.lastMonthCollectedCents,
    },
    generatedAt: isoNow(now),
  }];
}

/* ─────────────────────────────────────────────
   Average ticket trend (this month vs last month)
───────────────────────────────────────────── */

function averageTicketTrendInsight(data: AppData, now: Date): BusinessInsight[] {
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const lastEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();

  const completedInRange = (a: typeof data.appointments[number], from: number, to: number) =>
    a.status === "completed" &&
    parseISO(a.start).getTime() >= from &&
    parseISO(a.start).getTime() <= to;

  const thisMonth = data.appointments.filter((a) => completedInRange(a, start, now.getTime()));
  const lastMonth = data.appointments.filter((a) => completedInRange(a, lastStart, lastEnd));

  if (!hasMinimumSample(thisMonth.length) || !hasMinimumSample(lastMonth.length)) return [];

  const avg = (arr: typeof thisMonth) =>
    arr.reduce((s, a) => s + appointmentRevenueCents(a), 0) / Math.max(1, arr.length);

  const thisAvg = avg(thisMonth);
  const lastAvg = avg(lastMonth);
  if (lastAvg <= 0) return [];

  const ratio = thisAvg / lastAvg - 1;
  if (Math.abs(ratio) < INSIGHT_THRESHOLDS.AVERAGE_TICKET_TREND_MIN_RATIO) return [];

  const up = ratio > 0;
  return [{
    id: makeId("average_ticket_trend", `${now.getFullYear()}-${now.getMonth() + 1}`),
    type: "average_ticket_trend",
    title: up
      ? `Average ticket up ${pct(Math.abs(ratio))} this month`
      : `Average ticket down ${pct(Math.abs(ratio))} this month`,
    summary: `This month: ${dollars(Math.round(thisAvg))} across ${thisMonth.length} jobs. Last month: ${dollars(Math.round(lastAvg))} across ${lastMonth.length}.`,
    confidence: confidenceFromSample(Math.min(thisMonth.length, lastMonth.length)),
    sampleSize: Math.min(thisMonth.length, lastMonth.length),
    sourceType: "internal",
    metadata: { thisAvgCents: thisAvg, lastAvgCents: lastAvg, ratio },
    generatedAt: isoNow(now),
  }];
}

/* ─────────────────────────────────────────────
   Lead source winners
───────────────────────────────────────────── */

function leadSourceWinnerInsight(data: AppData, now: Date): BusinessInsight[] {
  const perf = buildLeadSourcePerformance(data);
  // Need at least one source with enough leads to mean anything.
  const eligible = perf.filter((p) => hasMinimumSample(p.leadsCount));
  if (eligible.length === 0) return [];

  // Top by conversion rate (must have ≥1 conversion).
  const byConversion = [...eligible]
    .filter((p) => p.convertedCount > 0)
    .sort((a, b) => b.conversionRate - a.conversionRate);

  if (byConversion.length === 0) return [];
  const winner = byConversion[0];

  return [{
    id: makeId("lead_source_winner", winner.source),
    type: "lead_source_winner",
    title: `${winner.source} converts at ${pct(winner.conversionRate)} — your best source`,
    summary: `Across ${winner.leadsCount} ${winner.leadsCount === 1 ? "lead" : "leads"}, ${winner.convertedCount} booked. Worth doubling down on what's working there.`,
    detail: winner.totalRevenueCents > 0
      ? `Attributed revenue: ${dollars(winner.totalRevenueCents)}`
      : undefined,
    confidence: winner.confidence,
    sampleSize: winner.leadsCount,
    recommendedAction: { label: "Open Leads", linkUrl: "/leads" },
    sourceType: "internal",
    metadata: { source: winner.source, conversionRate: winner.conversionRate },
    generatedAt: isoNow(now),
  }];
}

/* ─────────────────────────────────────────────
   Rebook candidates aggregation
───────────────────────────────────────────── */

function rebookCandidatesInsight(data: AppData, now: Date): BusinessInsight[] {
  const candidates = rebookCandidates(data, now);
  if (candidates.length === 0) return [];

  const totalAvgTicketCents = candidates.reduce(
    (s, c) => s + (c.averageTicketCents > 0 ? c.averageTicketCents : 0),
    0,
  );
  const overdueCount = candidates.filter((c) => c.rebookStatus === "overdue").length;

  return [{
    id: makeId("rebook_candidates", new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10)),
    type: "rebook_candidates",
    title: `${candidates.length} ${candidates.length === 1 ? "customer is" : "customers are"} due for rebooking`,
    summary: overdueCount > 0
      ? `${overdueCount} of them are overdue past their typical cadence. A polite check-in usually books a job.`
      : `Worth a check-in this week — they're at the edge of their typical cadence.`,
    detail: totalAvgTicketCents > 0
      ? `Combined average ticket potential: ~${dollars(totalAvgTicketCents)}`
      : undefined,
    confidence: confidenceFromSample(candidates.length),
    sampleSize: candidates.length,
    recommendedAction: { label: "Open Customers", linkUrl: "/customers" },
    sourceType: "internal",
    metadata: { count: candidates.length, overdue: overdueCount },
    generatedAt: isoNow(now),
  }];
}

/* ─────────────────────────────────────────────
   Workload outlook
───────────────────────────────────────────── */

function workloadOutlookInsight(data: AppData, now: Date): BusinessInsight[] {
  const fc = buildWorkloadForecast(data, 7, now);
  const overloaded = fc.overloadedDates.length > 0;
  const underbooked = fc.underbookedDates.length >= INSIGHT_THRESHOLDS.UNDERBOOKED_DAYS_THRESHOLD;

  // Only surface when there's something genuinely interesting. A "normal-
  // looking week" doesn't deserve a card on the dashboard.
  if (!overloaded && !underbooked) return [];

  // Underbooked-only: don't nag a brand-new app with no business history yet.
  const hasAnyHistory = data.appointments.some((a) => a.status === "completed");
  if (!overloaded && underbooked && !hasAnyHistory) return [];

  let title: string;
  let summary: string;
  if (overloaded) {
    title = `${fc.overloadedDates.length} ${fc.overloadedDates.length === 1 ? "day is" : "days are"} overloaded next week`;
    summary = `You're booked beyond your max-jobs-per-day setting on ${fc.overloadedDates.join(", ")}. Consider blocking new bookings or reordering jobs.`;
  } else {
    title = `${fc.underbookedDates.length} open days next week`;
    summary = `${fc.bookedJobs} jobs booked across the next 7 days — ${fc.openCapacity} open slots. Good time to push out a promotion or call rebook candidates.`;
  }

  return [{
    id: makeId("workload_outlook", new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10)),
    type: "workload_outlook",
    title,
    summary,
    detail: fc.bookedRevenueCents > 0
      ? `Booked revenue in window: ${dollars(fc.bookedRevenueCents)}`
      : undefined,
    confidence: "high",
    sampleSize: fc.bookedJobs,
    recommendedAction: { label: "Open Calendar", linkUrl: "/calendar" },
    sourceType: "internal",
    metadata: {
      bookedJobs: fc.bookedJobs,
      overloadedDates: fc.overloadedDates,
      underbookedDates: fc.underbookedDates,
    },
    generatedAt: isoNow(now),
  }];
}

/* ─────────────────────────────────────────────
   Engine
───────────────────────────────────────────── */

const ALL_INSIGHT_BUILDERS: Array<(d: AppData, now: Date) => BusinessInsight[]> = [
  pricingDriftInsights,
  durationDriftInsights,
  revenuePaceInsight,
  averageTicketTrendInsight,
  leadSourceWinnerInsight,
  rebookCandidatesInsight,
  workloadOutlookInsight,
];

/**
 * Run every insight builder and return a deduped, confidence-sorted list.
 * Pure function. Below `MIN_SAMPLE_FOR_INSIGHT`, individual insights are
 * suppressed by their own builder.
 */
export function buildBusinessInsights(
  data: AppData,
  now: Date = new Date(),
): BusinessInsight[] {
  const seen = new Set<string>();
  const out: BusinessInsight[] = [];
  for (const build of ALL_INSIGHT_BUILDERS) {
    let produced: BusinessInsight[];
    try {
      produced = build(data, now);
    } catch (err) {
      console.error("[intelligence/insights] builder threw:", err);
      continue;
    }
    for (const ins of produced) {
      if (seen.has(ins.id)) continue;
      seen.add(ins.id);
      out.push(ins);
    }
  }
  return sortInsights(out);
}

const CONFIDENCE_RANK: Record<BusinessInsight["confidence"], number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const TYPE_PRIORITY: Record<string, number> = {
  // Money-relevant insights surface first.
  pricing_drift: 0,
  revenue_pace: 1,
  average_ticket_trend: 2,
  workload_outlook: 3,
  rebook_candidates: 4,
  lead_source_winner: 5,
  duration_drift: 6,
};

export function sortInsights(items: BusinessInsight[]): BusinessInsight[] {
  return [...items].sort((a, b) => {
    const c = CONFIDENCE_RANK[a.confidence] - CONFIDENCE_RANK[b.confidence];
    if (c !== 0) return c;
    const tp = (TYPE_PRIORITY[a.type] ?? 99) - (TYPE_PRIORITY[b.type] ?? 99);
    if (tp !== 0) return tp;
    return a.id.localeCompare(b.id);
  });
}
