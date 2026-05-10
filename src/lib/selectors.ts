import {
  endOfWeek,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import type { Appointment, AppData } from "./types";

/** Job duration in minutes from the timer (Start/Mark complete in Work Mode).
 *  Returns null if the job hasn't been timed end-to-end. */
export function jobDurationMinutes(a: Appointment): number | null {
  if (!a.actualStartAt || !a.actualEndAt) return null;
  const ms = parseISO(a.actualEndAt).getTime() - parseISO(a.actualStartAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.round(ms / 60000);
}

/** Format a minute count as "1h 23m" (or "45m" under an hour). */
export function formatDurationMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function appointmentsOnDay(data: AppData, day: Date): Appointment[] {
  return data.appointments
    .filter((a) => isSameDay(parseISO(a.start), day))
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function appointmentsThisWeek(data: AppData, base: Date = new Date()): Appointment[] {
  const start = startOfWeek(base, { weekStartsOn: 1 });
  const end = endOfWeek(base, { weekStartsOn: 1 });
  return data.appointments
    .filter((a) => {
      const d = parseISO(a.start);
      return isWithinInterval(d, { start, end });
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function upcomingAppointments(data: AppData, limit = 5): Appointment[] {
  const now = Date.now();
  return [...data.appointments]
    .filter((a) => parseISO(a.start).getTime() >= now)
    .filter((a) => a.status !== "canceled")
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, limit);
}

export function appointmentRevenue(a: Appointment): number {
  if (a.status === "canceled") return 0;
  return a.finalPrice ?? a.estimatedPrice ?? 0;
}

export function weekRevenueEstimate(data: AppData, base: Date = new Date()): number {
  return appointmentsThisWeek(data, base).reduce(
    (sum, a) => sum + appointmentRevenue(a),
    0
  );
}

export function monthRevenue(data: AppData, base: Date = new Date()): number {
  const start = startOfMonth(base);
  const end = endOfMonth(base);
  return data.appointments
    .filter((a) => {
      const d = parseISO(a.start);
      return isWithinInterval(d, { start, end });
    })
    .reduce((sum, a) => sum + appointmentRevenue(a), 0);
}

export function customerLifetimeValue(
  data: AppData,
  customerId: string
): number {
  return data.appointments
    .filter((a) => a.customerId === customerId && a.status === "completed")
    .reduce((sum, a) => sum + (a.finalPrice ?? a.estimatedPrice ?? 0), 0);
}

export function customerAppointmentCount(data: AppData, customerId: string): number {
  return data.appointments.filter((a) => a.customerId === customerId).length;
}

/** Returns the signed contribution of an expense to net spend.
 *  Credits (gift cards, refunds, rebates) subtract; regular expenses add. */
export function signedExpenseAmount(e: { amount: number; kind?: "expense" | "credit" }): number {
  return e.kind === "credit" ? -e.amount : e.amount;
}

export function totalExpenses(data: AppData): number {
  return data.expenses.reduce((s, e) => s + signedExpenseAmount(e), 0);
}

export function pendingFollowUps(data: AppData): number {
  const followUpAppts = data.appointments.filter((a) => a.status === "follow_up").length;
  const dueLeads = data.leads.filter((l) => {
    if (l.status === "booked" || l.status === "lost") return false;
    if (!l.followUpDate) return false;
    return parseISO(l.followUpDate).getTime() <= Date.now() + 24 * 60 * 60 * 1000;
  }).length;
  return followUpAppts + dueLeads;
}

export function unconfirmedJobs(data: AppData): Appointment[] {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  return data.appointments.filter(
    (a) =>
      (a.status === "scheduled" || a.status === "inquiry") &&
      parseISO(a.start).getTime() <= tomorrow.getTime() &&
      parseISO(a.start).getTime() >= Date.now() - 12 * 60 * 60 * 1000
  );
}
