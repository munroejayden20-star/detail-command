/**
 * Customer intelligence — per-customer analytical surfaces.
 *
 * Phase 1 already implements `buildCustomerProfile` in derived-metrics.ts.
 * Phase 4 expands this into:
 *   - rebook prediction with confidence
 *   - structured customer highlights bundle
 *   - draft-message helpers (plain templates; AI overlay in Phase 7)
 *
 * Re-exports the v1 builders so the public API is stable.
 */
import { addDays, differenceInDays, parseISO } from "date-fns";
import type { AppData } from "@/lib/types";
import type { ID } from "@/lib/types";
import { buildCustomerProfile } from "./derived-metrics";
import { confidenceFromSample } from "./confidence";
import { completedAppointmentsForCustomer, findService } from "./data-access";
import type { Confidence, CustomerValueTier } from "./types";
import { CONFIDENCE_THRESHOLDS } from "./types";

/* ─────────────────────────────────────────────
   Re-exports (stable Phase-1 public API)
───────────────────────────────────────────── */
export { buildCustomerProfile, rebookCandidates, topCustomerProfiles } from "./derived-metrics";
export type { CustomerIntelligenceProfile, CustomerValueTier } from "./types";

/* ─────────────────────────────────────────────
   CustomerHighlights — structured per-customer bundle
───────────────────────────────────────────── */

export interface CustomerHighlights {
  tier: CustomerValueTier;
  lifetimeSpendCents: number;
  totalJobs: number;
  lastServiceIso: string | null;
  daysSinceLastService: number | null;
  /** Top 3 services by completed-job count. */
  topServices: Array<{ serviceId: ID; serviceName: string; count: number }>;
  rebookStatus: "fresh" | "due" | "overdue" | "unknown";
  predictedNextRebook: { date: string; confidence: Confidence } | null;
  openBalanceCents: number;
  isRepeat: boolean;
  isMonthly: boolean;
}

/* ─────────────────────────────────────────────
   predictNextRebookDate
───────────────────────────────────────────── */

/**
 * Predict the next rebook date for a customer based on `lastServiceAt` +
 * `medianRebookIntervalDays`. Confidence scales with `completedJobs`.
 *
 * Returns null if `medianRebookIntervalDays` or `lastServiceAt` are absent
 * (not enough data), or if the sample is below MIN_SAMPLE_FOR_INSIGHT.
 */
export function predictNextRebookDate(
  profile: ReturnType<typeof buildCustomerProfile>,
): { date: string; confidence: Confidence } | null {
  const { lastServiceAt, medianRebookIntervalDays, completedJobs } = profile;

  if (lastServiceAt == null || medianRebookIntervalDays == null) return null;
  // Gate: need at least MIN_SAMPLE_FOR_INSIGHT completed jobs for prediction.
  if (completedJobs < CONFIDENCE_THRESHOLDS.MIN_SAMPLE_FOR_INSIGHT) return null;

  const lastDate = parseISO(lastServiceAt);
  const predictedDate = addDays(lastDate, Math.round(medianRebookIntervalDays));

  return {
    date: predictedDate.toISOString(),
    confidence: confidenceFromSample(completedJobs),
  };
}

/* ─────────────────────────────────────────────
   customerHighlights
───────────────────────────────────────────── */

/**
 * Structured summary bundle for the per-customer intelligence panel.
 * Returns null when the customer doesn't exist or has no completed jobs
 * (nothing actionable to surface yet).
 */
export function customerHighlights(
  data: AppData,
  customerId: ID,
): CustomerHighlights | null {
  const customer = data.customers.find((c) => c.id === customerId);
  if (!customer) return null;

  const profile = buildCustomerProfile(data, customer);
  if (profile.completedJobs === 0) return null;

  // Top 3 services by count across completed appointments.
  const completed = completedAppointmentsForCustomer(data, customerId);
  const serviceCounts = new Map<ID, number>();
  for (const appt of completed) {
    for (const sid of appt.serviceIds) {
      serviceCounts.set(sid, (serviceCounts.get(sid) ?? 0) + 1);
    }
  }
  const topServices = [...serviceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([serviceId, count]) => {
      const svc = findService(data, serviceId);
      return { serviceId, serviceName: svc?.name ?? serviceId, count };
    });

  const predictedNextRebook = predictNextRebookDate(profile);

  return {
    tier: profile.tier,
    lifetimeSpendCents:
      profile.lifetimeSpendCents > 0
        ? profile.lifetimeSpendCents
        : profile.lifetimeRevenueCents,
    totalJobs: profile.totalJobs,
    lastServiceIso: profile.lastServiceAt,
    daysSinceLastService: profile.daysSinceLastService,
    topServices,
    rebookStatus: profile.rebookStatus,
    predictedNextRebook,
    openBalanceCents: profile.openBalanceCents,
    isRepeat: customer.isRepeat ?? false,
    isMonthly: customer.isMonthlyMaintenance ?? false,
  };
}

/* ─────────────────────────────────────────────
   draftFollowUpMessage
───────────────────────────────────────────── */

/**
 * Generate a plain-text draft message for a follow-up intent.
 * Templates are intentional and advisory — they are never sent automatically.
 * Phase 7 will optionally run these through the AI layer for tone refinement.
 *
 * Returns null when the customer doesn't exist or has no signal to work from.
 */
export function draftFollowUpMessage(
  data: AppData,
  customerId: ID,
  intent: "rebook" | "thank_you" | "checkin",
): { subject: string; body: string } | null {
  const customer = data.customers.find((c) => c.id === customerId);
  if (!customer) return null;

  const profile = buildCustomerProfile(data, customer);
  const firstName = customer.name.split(/\s+/)[0] ?? customer.name;

  // Format a short date like "May 3"
  const lastServiceShort = profile.lastServiceAt
    ? (() => {
        const d = parseISO(profile.lastServiceAt);
        return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      })()
    : null;

  const completed = completedAppointmentsForCustomer(data, customerId);
  const serviceCounts = new Map<ID, number>();
  for (const appt of completed) {
    for (const sid of appt.serviceIds) {
      serviceCounts.set(sid, (serviceCounts.get(sid) ?? 0) + 1);
    }
  }
  const topServiceId = [...serviceCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const topServiceName = topServiceId ? findService(data, topServiceId)?.name ?? null : null;

  const ownerName = data.settings?.ownerName || data.settings?.businessName || "Jayden";

  switch (intent) {
    case "rebook": {
      const serviceHint = topServiceName ? ` for a ${topServiceName}` : "";
      const lastHint = lastServiceShort ? ` Since your last detail on ${lastServiceShort}` : "";
      return {
        subject: "Ready to book your next detail?",
        body: [
          `Hey ${firstName}!`,
          "",
          `${lastHint ? lastHint + ", your" : "Your"} car is probably due for some love again.${serviceHint ? ` I'd love to get you booked${serviceHint}.` : " Let me know when works and I'll get you scheduled."}`,
          "",
          `Reply here or text me directly — happy to work around your schedule.`,
          "",
          `— ${ownerName}`,
        ].join("\n"),
      };
    }

    case "thank_you": {
      const serviceHint = topServiceName ? ` on the ${topServiceName}` : "";
      const lastHint = lastServiceShort ? ` on ${lastServiceShort}` : "";
      return {
        subject: "Thanks for the business!",
        body: [
          `Hey ${firstName}!`,
          "",
          `Just wanted to say thanks for trusting me with your vehicle${lastHint}. It was a pleasure working${serviceHint}.`,
          "",
          `If you get a chance, a quick Google review goes a long way — and of course, reach out anytime you need another detail.`,
          "",
          `— ${ownerName}`,
        ].join("\n"),
      };
    }

    case "checkin": {
      const daysSince = profile.daysSinceLastService;
      const timeHint =
        daysSince != null
          ? ` It's been about ${daysSince} day${daysSince === 1 ? "" : "s"} since your last visit.`
          : "";
      return {
        subject: "Checking in!",
        body: [
          `Hey ${firstName}!`,
          "",
          `Just checking in to see how everything is going with your car.${timeHint}`,
          "",
          `If you're happy with the work, I'd love a quick review — and if there's anything I can do better, let me know.`,
          "",
          `— ${ownerName}`,
        ].join("\n"),
      };
    }
  }
}

/* ─────────────────────────────────────────────
   Days-since helper (used by CustomerHighlights display)
───────────────────────────────────────────── */

/** Days between a past ISO date and now. Safe null-pass. */
export function daysSinceIso(iso: string | null, now: Date = new Date()): number | null {
  if (!iso) return null;
  const t = parseISO(iso);
  if (Number.isNaN(t.getTime())) return null;
  return differenceInDays(now, t);
}
