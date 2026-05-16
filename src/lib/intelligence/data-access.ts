/**
 * Data-access helpers for the intelligence layer.
 *
 * Thin, normalized accessors over AppData that the rest of the intelligence
 * modules (rules, derived-metrics, insights, ai-tools) can rely on without
 * each having to re-query the store. These complement existing selectors in
 * src/lib/selectors.ts — they don't replace them.
 *
 * All inputs are AppData; no React, no I/O. Pure functions.
 */
import { parseISO } from "date-fns";
import type {
  AppData,
  Appointment,
  Customer,
  Lead,
  Receipt,
  Service,
} from "@/lib/types";
import type { ID } from "@/lib/types";
import { jobDurationMinutes } from "@/lib/selectors";
import type { DateRange } from "./types";

/* ─────────────────────────────────────────────
   Date-range helpers
───────────────────────────────────────────── */

/** Inclusive ISO range filter. null bounds mean "no bound on that side". */
export function withinRange(iso: string | undefined | null, range: DateRange): boolean {
  if (!iso) return false;
  const t = parseISO(iso).getTime();
  if (Number.isNaN(t)) return false;
  if (range.start && t < parseISO(range.start).getTime()) return false;
  if (range.end && t > parseISO(range.end).getTime()) return false;
  return true;
}

/** "All time" range. */
export function rangeAllTime(): DateRange {
  return { start: null, end: null, label: "All time" };
}

export function rangeFromDates(start: Date, end: Date, label: string): DateRange {
  return {
    start: start.toISOString(),
    end: end.toISOString(),
    label,
  };
}

/* ─────────────────────────────────────────────
   Customers
───────────────────────────────────────────── */

export function findCustomer(data: AppData, id: ID | undefined): Customer | undefined {
  if (!id) return undefined;
  return data.customers.find((c) => c.id === id);
}

export function appointmentsForCustomer(data: AppData, customerId: ID): Appointment[] {
  return data.appointments
    .filter((a) => a.customerId === customerId)
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function completedAppointmentsForCustomer(
  data: AppData,
  customerId: ID,
): Appointment[] {
  return appointmentsForCustomer(data, customerId).filter((a) => a.status === "completed");
}

export function lastCompletedServiceAt(
  data: AppData,
  customerId: ID,
): string | null {
  const completed = completedAppointmentsForCustomer(data, customerId);
  if (completed.length === 0) return null;
  // Already sorted ascending; last entry is most recent.
  return completed[completed.length - 1].start;
}

/**
 * Median number of days between consecutive completed jobs for a customer.
 * Returns null if fewer than 2 completed services. The median is more robust
 * than mean for small samples with rare outliers.
 */
export function medianRebookIntervalDays(
  data: AppData,
  customerId: ID,
): number | null {
  const completed = completedAppointmentsForCustomer(data, customerId);
  if (completed.length < 2) return null;
  const intervals: number[] = [];
  for (let i = 1; i < completed.length; i++) {
    const a = parseISO(completed[i - 1].start).getTime();
    const b = parseISO(completed[i].start).getTime();
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) {
      intervals.push((b - a) / (1000 * 60 * 60 * 24));
    }
  }
  if (intervals.length === 0) return null;
  intervals.sort((a, b) => a - b);
  const mid = Math.floor(intervals.length / 2);
  return intervals.length % 2 === 0
    ? (intervals[mid - 1] + intervals[mid]) / 2
    : intervals[mid];
}

/** Customers with at least one appointment. */
export function activeCustomers(data: AppData): Customer[] {
  const ids = new Set(data.appointments.map((a) => a.customerId));
  return data.customers.filter((c) => ids.has(c.id));
}

/* ─────────────────────────────────────────────
   Appointments
───────────────────────────────────────────── */

export function findAppointment(
  data: AppData,
  id: ID | undefined,
): Appointment | undefined {
  if (!id) return undefined;
  return data.appointments.find((a) => a.id === id);
}

export function completedAppointmentsInRange(
  data: AppData,
  range: DateRange,
): Appointment[] {
  return data.appointments.filter(
    (a) => a.status === "completed" && withinRange(a.start, range),
  );
}

export function appointmentsInRange(
  data: AppData,
  range: DateRange,
): Appointment[] {
  return data.appointments.filter((a) => withinRange(a.start, range));
}

/** Hours since an appointment's scheduled start. Negative if in the future. */
export function hoursSinceStart(a: Appointment, now: Date = new Date()): number {
  return (now.getTime() - parseISO(a.start).getTime()) / (1000 * 60 * 60);
}

export function hoursUntilStart(a: Appointment, now: Date = new Date()): number {
  return -hoursSinceStart(a, now);
}

/** Estimated duration of an appointment in minutes (end − start). */
export function estimatedDurationMinutes(a: Appointment): number | null {
  const start = parseISO(a.start).getTime();
  const end = parseISO(a.end).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (end <= start) return null;
  return Math.round((end - start) / 60000);
}

/* ─────────────────────────────────────────────
   Receipts
───────────────────────────────────────────── */

export function activeReceiptsForAppointment(
  data: AppData,
  appointmentId: ID,
): Receipt[] {
  return (data.receipts ?? []).filter(
    (r) => r.appointmentId === appointmentId && r.receiptStatus === "active",
  );
}

export function activeReceiptsForCustomer(
  data: AppData,
  customerId: ID,
): Receipt[] {
  return (data.receipts ?? []).filter(
    (r) => r.customerId === customerId && r.receiptStatus === "active",
  );
}

export function openBalanceCentsForCustomer(data: AppData, customerId: ID): number {
  return activeReceiptsForCustomer(data, customerId).reduce(
    (sum, r) => sum + (r.remainingBalanceCents || 0),
    0,
  );
}

export function activeReceiptsInRange(
  data: AppData,
  range: DateRange,
): Receipt[] {
  return (data.receipts ?? []).filter(
    (r) => r.receiptStatus === "active" && withinRange(r.createdAt, range),
  );
}

/* ─────────────────────────────────────────────
   Leads
───────────────────────────────────────────── */

export function activeLeads(data: AppData): Lead[] {
  return data.leads.filter((l) => l.status !== "booked" && l.status !== "lost");
}

/** Hours since a lead's createdAt. */
export function hoursSinceLeadCreated(lead: Lead, now: Date = new Date()): number {
  return (now.getTime() - parseISO(lead.createdAt).getTime()) / (1000 * 60 * 60);
}

/** Days since the most recent contact (lastContacted) — null if never contacted. */
export function daysSinceLastContact(lead: Lead, now: Date = new Date()): number | null {
  if (!lead.lastContacted) return null;
  const t = parseISO(lead.lastContacted).getTime();
  if (Number.isNaN(t)) return null;
  return (now.getTime() - t) / (1000 * 60 * 60 * 24);
}

/* ─────────────────────────────────────────────
   Services
───────────────────────────────────────────── */

export function findService(data: AppData, id: ID): Service | undefined {
  return data.services.find((s) => s.id === id);
}

/** Completed appointments that included a given service. */
export function completedAppointmentsWithService(
  data: AppData,
  serviceId: ID,
): Appointment[] {
  return data.appointments.filter(
    (a) => a.status === "completed" && a.serviceIds.includes(serviceId),
  );
}

/* ─────────────────────────────────────────────
   Job timer helpers (re-export so callers don't reach into selectors)
───────────────────────────────────────────── */

export { jobDurationMinutes };

/** Time a customer paid the deposit, if they did. */
export function depositPaidFor(a: Appointment): boolean {
  return Boolean(
    a.depositPaid ||
      a.depositPaidAt ||
      a.paymentStatus === "deposit" ||
      a.paymentStatus === "deposit_paid" ||
      a.paymentStatus === "paid",
  );
}
