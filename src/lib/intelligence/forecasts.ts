/**
 * Forecasts — explainable, sample-aware predictions.
 *
 * Phase H2 implements:
 *   - workload forecast (next N days)
 *   - revenue pace (current month vs projection)
 *
 * Phase H3 will fuse weather risk into the workload outlook.
 *
 * Forecasts always include the inputs they're built from so they're
 * explainable. Below the minimum sample threshold they say "not enough
 * history yet" rather than fabricating.
 */
import { parseISO } from "date-fns";
import type { AppData, Appointment } from "@/lib/types";
import { toBusinessDateKey } from "@/lib/datetime";
import { appointmentRevenueCents } from "./derived-metrics";
import type { WorkloadForecast } from "./types";

/* ─────────────────────────────────────────────
   Workload forecast
───────────────────────────────────────────── */

const FORECAST_BOOKED_STATUSES = new Set<Appointment["status"]>([
  "scheduled",
  "confirmed",
  "in_progress",
]);

/**
 * Count booked jobs for each of the next `rangeDays` days starting today
 * (business-local time). Returns a forecast with capacity vs demand,
 * overloaded vs underbooked dates, and total booked revenue in the window.
 *
 * Always returns a forecast — even with zero appointments it's useful to
 * see "0 booked / 21 open slots" rather than nothing.
 */
export function buildWorkloadForecast(
  data: AppData,
  rangeDays = 7,
  now: Date = new Date(),
): WorkloadForecast {
  const maxJobsPerDay = Math.max(1, data.settings.maxJobsPerDay || 3);
  const todayKey = toBusinessDateKey(now);

  // Build the set of date keys in the window so we can iterate them in order.
  const windowKeys: string[] = [];
  for (let i = 0; i < rangeDays; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    windowKeys.push(toBusinessDateKey(d));
  }
  const inWindow = new Set(windowKeys);

  // Group booked appointments in the window by business-local date key.
  const byDay = new Map<string, Appointment[]>();
  for (const a of data.appointments) {
    if (!FORECAST_BOOKED_STATUSES.has(a.status)) continue;
    const key = toBusinessDateKey(a.start);
    if (!inWindow.has(key)) continue;
    // Only include future-or-today appointments — past in_progress is
    // covered by the `job_timer_stalled` rule in attention.
    if (key < todayKey) continue;
    const list = byDay.get(key) ?? [];
    list.push(a);
    byDay.set(key, list);
  }

  let bookedJobs = 0;
  let bookedRevenueCents = 0;
  const overloadedDates: string[] = [];
  const underbookedDates: string[] = [];

  for (const key of windowKeys) {
    const appts = byDay.get(key) ?? [];
    bookedJobs += appts.length;
    for (const a of appts) bookedRevenueCents += appointmentRevenueCents(a);
    if (appts.length > maxJobsPerDay) overloadedDates.push(key);
    if (appts.length === 0) underbookedDates.push(key);
  }

  const openCapacity = Math.max(0, rangeDays * maxJobsPerDay - bookedJobs);

  return {
    rangeDays,
    bookedJobs,
    bookedRevenueCents,
    openCapacity,
    overloadedDates,
    underbookedDates,
    generatedAt: now.toISOString(),
  };
}

/* ─────────────────────────────────────────────
   Revenue pace forecast
───────────────────────────────────────────── */

export interface RevenuePace {
  /** Cents already collected this calendar month (receipts.amountPaidCents). */
  collectedMtdCents: number;
  /** Cents booked into the rest of the month (remaining scheduled jobs). */
  bookedRemainingCents: number;
  /** Linear projection: collectedMtd / daysElapsed × daysInMonth. */
  projectedMonthEndCents: number;
  /** Last month's collected total — comparison anchor. */
  lastMonthCollectedCents: number;
  /** projected / lastMonth − 1. Positive = ahead of last month. */
  projectionVsLastMonthRatio: number;
  /** True if there's enough of this month elapsed to project meaningfully. */
  hasEnoughDataToProject: boolean;
  daysElapsed: number;
  daysInMonth: number;
  generatedAt: string;
}

const MIN_DAYS_TO_PROJECT = 5;

export function buildRevenuePace(
  data: AppData,
  now: Date = new Date(),
): RevenuePace {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const inThisMonth = (iso: string) => {
    const t = parseISO(iso).getTime();
    return t >= start.getTime() && t <= now.getTime();
  };
  const inLastMonth = (iso: string) => {
    const t = parseISO(iso).getTime();
    return t >= lastMonthStart.getTime() && t <= lastMonthEnd.getTime();
  };

  const collectedMtdCents = (data.receipts ?? [])
    .filter((r) => r.receiptStatus === "active" && inThisMonth(r.createdAt))
    .reduce((s, r) => s + r.amountPaidCents, 0);

  const lastMonthCollectedCents = (data.receipts ?? [])
    .filter((r) => r.receiptStatus === "active" && inLastMonth(r.createdAt))
    .reduce((s, r) => s + r.amountPaidCents, 0);

  // Booked-but-not-yet-collected: scheduled/confirmed/in_progress appointments
  // whose start is between now and end of month.
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  const bookedRemainingCents = data.appointments
    .filter((a) => FORECAST_BOOKED_STATUSES.has(a.status))
    .filter((a) => {
      const t = parseISO(a.start).getTime();
      return t >= now.getTime() && t <= endOfMonth.getTime();
    })
    .reduce((s, a) => s + appointmentRevenueCents(a), 0);

  const daysInMonth = endOfMonth.getDate();
  const daysElapsed = Math.max(1, now.getDate());

  const hasEnoughDataToProject = daysElapsed >= MIN_DAYS_TO_PROJECT;

  // Linear projection — naive but explainable. If they want a smarter model
  // it lives here, not scattered in UI code.
  const projectedMonthEndCents = hasEnoughDataToProject
    ? Math.round((collectedMtdCents / daysElapsed) * daysInMonth)
    : 0;

  const projectionVsLastMonthRatio = lastMonthCollectedCents > 0
    ? projectedMonthEndCents / lastMonthCollectedCents - 1
    : 0;

  return {
    collectedMtdCents,
    bookedRemainingCents,
    projectedMonthEndCents,
    lastMonthCollectedCents,
    projectionVsLastMonthRatio,
    hasEnoughDataToProject,
    daysElapsed,
    daysInMonth,
    generatedAt: now.toISOString(),
  };
}
