/**
 * Attention engine — deterministic rules over AppData.
 *
 * Each rule is a small pure function taking AppData (and optionally `now`)
 * and yielding zero or more AttentionItems. The engine combines them, dedupes
 * by id, and sorts by priority + due-time.
 *
 * Phase 1 rules cover the high-signal subset of the spec section 4. The list
 * is intentionally curated, not exhaustive — every rule here has a clear
 * recommended action and won't fire when the user has nothing to do about it.
 *
 * Rules are deliberately *deterministic*: same data + same `now` → same items
 * with same ids. That makes snooze/dismiss reliable and makes the engine
 * testable without time mocks (you pass `now` in).
 */
import { differenceInDays, parseISO } from "date-fns";
import type { AppData } from "@/lib/types";
import {
  activeReceiptsForAppointment,
  daysSinceLastContact,
  depositPaidFor,
  estimatedDurationMinutes,
  hoursSinceLeadCreated,
  hoursSinceStart,
} from "./data-access";
import { buildCustomerProfile } from "./derived-metrics";
import {
  ATTENTION_PRIORITY_RANK,
  type AttentionItem,
  type AttentionPriority,
} from "./types";

/* ─────────────────────────────────────────────
   Tunable thresholds — every magic number lives here so they can be
   adjusted without spelunking through rule bodies.
───────────────────────────────────────────── */

export const ATTENTION_THRESHOLDS = {
  /** Pending booking older than this is "high" priority. */
  PENDING_BOOKING_STALE_HOURS: 6,
  /** Pending booking older than this is "critical". */
  PENDING_BOOKING_VERY_STALE_HOURS: 24,

  /** Receipt with open balance older than this surfaces. */
  RECEIPT_OPEN_BALANCE_DAYS: 7,
  /** Receipt open balance older than this is "high" priority. */
  RECEIPT_OPEN_BALANCE_HIGH_DAYS: 21,

  /** Job timer started but not ended — surfaces after this many hours. */
  JOB_TIMER_STALLED_HOURS: 4,

  /** Completed job missing receipt surfaces this many hours after the job's start. */
  COMPLETED_NO_RECEIPT_HOURS: 6,

  /** Completed job missing final price surfaces this many hours after start. */
  COMPLETED_NO_FINAL_PRICE_HOURS: 6,

  /** Completed job no review request — minimum hours after start before nagging. */
  COMPLETED_NO_REVIEW_REQUEST_HOURS: 24,
  /** Don't surface review requests older than this — too late. */
  COMPLETED_NO_REVIEW_REQUEST_MAX_DAYS: 21,

  /** Lead with status="new" not contacted within this many hours. */
  LEAD_UNCONTACTED_HOURS: 24,
  /** Lead going cold: last contacted > this many days, status not booked/lost. */
  LEAD_GOING_COLD_DAYS: 7,

  /** Dormant high-value customer: > this many days since last service. */
  HIGH_VALUE_DORMANT_DAYS: 90,

  /** Service discount expiring within this many days surfaces. */
  DISCOUNT_EXPIRING_DAYS: 7,

  /** In-progress job over estimate by this percent surfaces. */
  IN_PROGRESS_OVERRUN_RATIO: 1.3,
} as const;

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

function isoNow(now: Date): string {
  return now.toISOString();
}

/** Stable id factory. Same condition+entity → same id across renders. */
function attId(type: string, ...parts: (string | undefined | null)[]): string {
  return ["att", type, ...parts.filter((p): p is string => Boolean(p))].join("_");
}

function customerName(data: AppData, id: string | undefined): string {
  if (!id) return "Customer";
  const c = data.customers.find((x) => x.id === id);
  return c?.name ?? "Customer";
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

/* ─────────────────────────────────────────────
   Bookings
───────────────────────────────────────────── */

function rulePendingBookingStale(data: AppData, now: Date): AttentionItem[] {
  return data.appointments
    .filter((a) => a.status === "pending_approval")
    .flatMap<AttentionItem>((a) => {
      const ageHours =
        (now.getTime() - parseISO(a.createdAt ?? a.start).getTime()) / (1000 * 60 * 60);
      if (ageHours < ATTENTION_THRESHOLDS.PENDING_BOOKING_STALE_HOURS) return [];
      const veryStale = ageHours >= ATTENTION_THRESHOLDS.PENDING_BOOKING_VERY_STALE_HOURS;
      const cust = customerName(data, a.customerId);
      return [{
        id: attId("pending_booking_stale", a.id),
        type: "pending_booking_stale",
        category: "bookings",
        priority: veryStale ? "critical" : "high",
        source: "rule",
        title: `Booking from ${cust} waiting for approval`,
        why: veryStale
          ? `It's been over ${Math.round(ageHours)} hours. Customers expect a yes/no within a day.`
          : `Pending for ${Math.round(ageHours)} hours. The longer it sits, the more likely they book elsewhere.`,
        action: { label: "Review request", linkUrl: "/" },
        entityType: "appointment",
        entityId: a.id,
        detectedAt: isoNow(now),
      }];
    });
}

function ruleDepositPaidNotApproved(data: AppData, now: Date): AttentionItem[] {
  return data.appointments
    .filter((a) => a.status === "pending_approval" && depositPaidFor(a))
    .map<AttentionItem>((a) => {
      const cust = customerName(data, a.customerId);
      const amount = a.depositAmountCents ?? 0;
      return {
        id: attId("deposit_paid_unapproved", a.id),
        type: "deposit_paid_unapproved",
        category: "bookings",
        priority: "critical",
        source: "rule",
        title: `${cust} paid a deposit but the booking isn't approved`,
        why: `Money's already collected. Approve so the calendar reflects reality and the customer gets confirmation.`,
        detail: amount > 0 ? `Deposit: ${dollars(amount)}` : undefined,
        action: { label: "Approve booking", linkUrl: "/" },
        entityType: "appointment",
        entityId: a.id,
        detectedAt: isoNow(now),
      };
    });
}

/**
 * Customer-initiated cancels (within the last 7 days, still unread by you).
 * Surfaces each cancellation as a high-priority attention item so you can
 * decide whether to call the customer, offer a new slot, refund a deposit,
 * or just acknowledge and move on.
 */
function ruleCustomerCanceledAppointment(
  data: AppData,
  now: Date,
): AttentionItem[] {
  const cutoff = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  return (data.notifications ?? [])
    .filter((n) => n.type === "appointment_canceled_by_customer" && !n.read)
    .filter((n) => {
      const t = parseISO(n.createdAt).getTime();
      return Number.isFinite(t) && t >= cutoff;
    })
    .map<AttentionItem>((n) => {
      const meta = (n.metadata ?? {}) as {
        appointmentId?: string;
        customerId?: string;
        customerName?: string;
      };
      const apptId = meta.appointmentId;
      const cust = meta.customerName || customerName(data, meta.customerId);
      const appt = apptId
        ? data.appointments.find((a) => a.id === apptId)
        : undefined;
      const depositInfo =
        appt && depositPaidFor(appt)
          ? ` Deposit of ${dollars(appt.depositAmountCents ?? 0)} was paid — may need a refund.`
          : "";
      return {
        id: attId("customer_canceled_appointment", n.id),
        type: "customer_canceled_appointment",
        category: "bookings",
        priority: depositInfo ? "critical" : "high",
        source: "rule",
        title: `${cust} canceled their appointment`,
        why: `${n.message ?? "Customer canceled via their portal."}${depositInfo}`,
        action: appt
          ? { label: "Open calendar", linkUrl: "/calendar" }
          : undefined,
        entityType: "appointment",
        entityId: apptId,
        detectedAt: n.createdAt,
      };
    });
}

/* ─────────────────────────────────────────────
   Jobs
───────────────────────────────────────────── */

function ruleCompletedNoFinalPrice(data: AppData, now: Date): AttentionItem[] {
  return data.appointments
    .filter((a) => a.status === "completed")
    .filter((a) => hoursSinceStart(a, now) >= ATTENTION_THRESHOLDS.COMPLETED_NO_FINAL_PRICE_HOURS)
    .filter((a) => {
      const hasFinalCents = typeof a.finalPriceCents === "number" && a.finalPriceCents > 0;
      const hasFinalDollars = typeof a.finalPrice === "number" && a.finalPrice > 0;
      return !hasFinalCents && !hasFinalDollars;
    })
    .map<AttentionItem>((a) => ({
      id: attId("completed_no_final_price", a.id),
      type: "completed_no_final_price",
      category: "jobs",
      priority: "high",
      source: "rule",
      title: `Set final price for ${customerName(data, a.customerId)}`,
      why: `Job's marked complete but no final price was logged. Revenue numbers and tax records won't be right until you do.`,
      action: { label: "Open appointment", linkUrl: "/calendar" },
      entityType: "appointment",
      entityId: a.id,
      detectedAt: isoNow(now),
    }));
}

function ruleCompletedNoReceipt(data: AppData, now: Date): AttentionItem[] {
  return data.appointments
    .filter((a) => a.status === "completed")
    .filter((a) => hoursSinceStart(a, now) >= ATTENTION_THRESHOLDS.COMPLETED_NO_RECEIPT_HOURS)
    .filter((a) => activeReceiptsForAppointment(data, a.id).length === 0)
    .map<AttentionItem>((a) => ({
      id: attId("completed_no_receipt", a.id),
      type: "completed_no_receipt",
      category: "jobs",
      priority: "high",
      source: "rule",
      title: `Generate receipt for ${customerName(data, a.customerId)}`,
      why: `Completed job without a receipt. Send one so the customer has a record and your income is documented.`,
      action: { label: "Open appointment", linkUrl: "/calendar" },
      entityType: "appointment",
      entityId: a.id,
      detectedAt: isoNow(now),
    }));
}

function ruleCompletedNoReviewRequest(data: AppData, now: Date): AttentionItem[] {
  if (data.settings.reviewRequestEnabled === false) return [];
  return data.appointments
    .filter((a) => a.status === "completed" && !a.reviewRequestSent)
    .filter((a) => {
      const h = hoursSinceStart(a, now);
      const days = h / 24;
      return (
        h >= ATTENTION_THRESHOLDS.COMPLETED_NO_REVIEW_REQUEST_HOURS &&
        days <= ATTENTION_THRESHOLDS.COMPLETED_NO_REVIEW_REQUEST_MAX_DAYS
      );
    })
    .map<AttentionItem>((a) => ({
      id: attId("completed_no_review_request", a.id),
      type: "completed_no_review_request",
      category: "jobs",
      priority: "medium",
      source: "rule",
      title: `Ask ${customerName(data, a.customerId)} for a review`,
      why: `They're freshly satisfied and you have ~3 weeks before the moment passes. One ask now is worth ten later.`,
      action: { label: "Send review request", linkUrl: `/customers/${a.customerId}` },
      entityType: "appointment",
      entityId: a.id,
      detectedAt: isoNow(now),
    }));
}

function ruleJobTimerStalled(data: AppData, now: Date): AttentionItem[] {
  return data.appointments
    .filter((a) => a.actualStartAt && !a.actualEndAt)
    .flatMap<AttentionItem>((a) => {
      const startedAt = parseISO(a.actualStartAt!).getTime();
      if (!Number.isFinite(startedAt)) return [];
      const hours = (now.getTime() - startedAt) / (1000 * 60 * 60);
      if (hours < ATTENTION_THRESHOLDS.JOB_TIMER_STALLED_HOURS) return [];
      return [{
        id: attId("job_timer_stalled", a.id),
        type: "job_timer_stalled",
        category: "jobs",
        priority: "medium",
        source: "rule",
        title: `Timer running for ${Math.floor(hours)}h on ${customerName(data, a.customerId)}'s job`,
        why: `The work-mode timer is still going. Either you're mid-job or you forgot to stop it — either way it'll mess up your duration averages.`,
        action: { label: "Open Work Mode", linkUrl: "/work" },
        entityType: "appointment",
        entityId: a.id,
        detectedAt: isoNow(now),
      }];
    });
}

function ruleInProgressOverrun(data: AppData, now: Date): AttentionItem[] {
  return data.appointments
    .filter((a) => a.status === "in_progress")
    .flatMap<AttentionItem>((a) => {
      const est = estimatedDurationMinutes(a);
      if (est == null || est <= 0) return [];
      const elapsedMin = (now.getTime() - parseISO(a.start).getTime()) / 60000;
      if (elapsedMin <= 0) return [];
      const ratio = elapsedMin / est;
      if (ratio < ATTENTION_THRESHOLDS.IN_PROGRESS_OVERRUN_RATIO) return [];
      const overByPct = Math.round((ratio - 1) * 100);
      return [{
        id: attId("in_progress_overrun", a.id),
        type: "in_progress_overrun",
        category: "jobs",
        priority: "medium",
        source: "rule",
        title: `${customerName(data, a.customerId)}'s job is running long`,
        why: `Estimated ${est} min, currently at ~${Math.round(elapsedMin)} min (${overByPct}% over). May be worth a heads-up to the next customer.`,
        action: { label: "Open calendar", linkUrl: "/calendar" },
        entityType: "appointment",
        entityId: a.id,
        detectedAt: isoNow(now),
      }];
    });
}

/* ─────────────────────────────────────────────
   Customers
───────────────────────────────────────────── */

function ruleCustomerOpenBalance(data: AppData, now: Date): AttentionItem[] {
  // Surface ONE item per receipt with significant aged balance, so multiple
  // unpaid receipts for the same customer all show up.
  const out: AttentionItem[] = [];
  for (const r of data.receipts ?? []) {
    if (r.receiptStatus !== "active") continue;
    if (r.remainingBalanceCents <= 0) continue;
    const ageDays = differenceInDays(now, parseISO(r.createdAt));
    if (ageDays < ATTENTION_THRESHOLDS.RECEIPT_OPEN_BALANCE_DAYS) continue;
    const high = ageDays >= ATTENTION_THRESHOLDS.RECEIPT_OPEN_BALANCE_HIGH_DAYS;
    const cust = r.customerId
      ? customerName(data, r.customerId)
      : (r.customerSnapshot?.name ?? "Customer");
    out.push({
      id: attId("receipt_open_balance", r.id),
      type: "receipt_open_balance",
      category: "finance",
      priority: high ? "high" : "medium",
      source: "rule",
      title: `${dollars(r.remainingBalanceCents)} unpaid from ${cust}`,
      why: high
        ? `Receipt #${r.receiptNumber} is ${ageDays} days old. Time to follow up firmly or write it off.`
        : `Receipt #${r.receiptNumber} is ${ageDays} days old. A friendly nudge usually closes it.`,
      action: r.publicReceiptToken
        ? { label: "Open receipt", linkUrl: `/receipt/${r.publicReceiptToken}` }
        : { label: "Open receipts", linkUrl: "/receipts" },
      entityType: "receipt",
      entityId: r.id,
      detectedAt: isoNow(now),
    });
  }
  return out;
}

function ruleCustomerOverdueRebook(data: AppData, now: Date): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const c of data.customers) {
    const profile = buildCustomerProfile(data, c, now);
    if (profile.rebookStatus !== "overdue") continue;
    if (profile.completedJobs < 2) continue; // need at least 2 to know a cadence
    out.push({
      id: attId("customer_overdue_rebook", c.id),
      type: "customer_overdue_rebook",
      category: "customers",
      priority: profile.tier === "vip" || profile.tier === "high_value" ? "high" : "medium",
      source: "analytics",
      title: `${c.name} is overdue for rebooking`,
      why: `Their typical cadence is about every ${Math.round(profile.medianRebookIntervalDays!)} days. It's been ${profile.daysSinceLastService} days. A nudge usually books a job.`,
      detail: `Lifetime: ${dollars(profile.lifetimeSpendCents || profile.lifetimeRevenueCents)} · ${profile.completedJobs} jobs`,
      action: { label: "Open customer", linkUrl: `/customers/${c.id}` },
      entityType: "customer",
      entityId: c.id,
      detectedAt: isoNow(now),
      confidence: profile.completedJobs >= 4 ? "high" : "medium",
    });
  }
  return out;
}

function ruleHighValueDormant(data: AppData, now: Date): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const c of data.customers) {
    const profile = buildCustomerProfile(data, c, now);
    if (profile.tier !== "high_value" && profile.tier !== "vip") continue;
    if (profile.daysSinceLastService == null) continue;
    if (profile.daysSinceLastService < ATTENTION_THRESHOLDS.HIGH_VALUE_DORMANT_DAYS) continue;
    // Don't double-fire if rebook rule already covers them
    if (profile.rebookStatus === "overdue") continue;
    out.push({
      id: attId("high_value_dormant", c.id),
      type: "high_value_dormant",
      category: "customers",
      priority: "medium",
      source: "analytics",
      title: `${c.name} hasn't been back in ${profile.daysSinceLastService} days`,
      why: `One of your better customers has gone quiet. Worth checking in — you don't want them detailing somewhere else.`,
      detail: `Lifetime: ${dollars(profile.lifetimeSpendCents || profile.lifetimeRevenueCents)}`,
      action: { label: "Open customer", linkUrl: `/customers/${c.id}` },
      entityType: "customer",
      entityId: c.id,
      detectedAt: isoNow(now),
    });
  }
  return out;
}

/* ─────────────────────────────────────────────
   Leads
───────────────────────────────────────────── */

function ruleLeadUncontacted(data: AppData, now: Date): AttentionItem[] {
  return data.leads
    .filter((l) => l.status === "new")
    .filter((l) => hoursSinceLeadCreated(l, now) >= ATTENTION_THRESHOLDS.LEAD_UNCONTACTED_HOURS)
    .map<AttentionItem>((l) => ({
      id: attId("lead_uncontacted", l.id),
      type: "lead_uncontacted",
      category: "leads",
      priority: "high",
      source: "rule",
      title: `New lead: ${l.name}`,
      why: `Hasn't been contacted yet. Lead conversion drops off a cliff after the first day.`,
      detail: l.notes ? l.notes.slice(0, 80) : undefined,
      action: { label: "Open lead", linkUrl: "/leads" },
      entityType: "lead",
      entityId: l.id,
      detectedAt: isoNow(now),
    }));
}

function ruleLeadFollowUpDue(data: AppData, now: Date): AttentionItem[] {
  return data.leads
    .filter((l) => l.status !== "booked" && l.status !== "lost")
    .filter((l) => l.followUpDate)
    .filter((l) => parseISO(l.followUpDate!).getTime() <= now.getTime())
    .map<AttentionItem>((l) => ({
      id: attId("lead_followup_due", l.id, l.followUpDate?.slice(0, 10)),
      type: "lead_followup_due",
      category: "leads",
      priority: "high",
      source: "rule",
      title: `Follow up with ${l.name}`,
      why: `Follow-up date has passed. Reach out before they assume you're not interested.`,
      action: { label: "Open lead", linkUrl: "/leads" },
      entityType: "lead",
      entityId: l.id,
      detectedAt: isoNow(now),
    }));
}

function ruleLeadGoingCold(data: AppData, now: Date): AttentionItem[] {
  return data.leads
    .filter((l) => l.status === "contacted" || l.status === "waiting")
    .flatMap<AttentionItem>((l) => {
      const days = daysSinceLastContact(l, now);
      if (days == null) return [];
      if (days < ATTENTION_THRESHOLDS.LEAD_GOING_COLD_DAYS) return [];
      return [{
        id: attId("lead_going_cold", l.id),
        type: "lead_going_cold",
        category: "leads",
        priority: "medium",
        source: "analytics",
        title: `${l.name} is going cold`,
        why: `Last contact was ${Math.round(days)} days ago. One more polite reach-out, then either book or close as lost.`,
        action: { label: "Open lead", linkUrl: "/leads" },
        entityType: "lead",
        entityId: l.id,
        detectedAt: isoNow(now),
      }];
    });
}

/* ─────────────────────────────────────────────
   Operations
───────────────────────────────────────────── */

function ruleServiceDiscountExpiring(data: AppData, now: Date): AttentionItem[] {
  return data.services
    .filter((s) => s.discount?.active && s.discount.expiry)
    .flatMap<AttentionItem>((s) => {
      const exp = parseISO(s.discount!.expiry!).getTime();
      if (!Number.isFinite(exp)) return [];
      const daysLeft = (exp - now.getTime()) / (1000 * 60 * 60 * 24);
      if (daysLeft < 0) {
        // Already expired but still flagged active — let owner know.
        return [{
          id: attId("discount_expired", s.id),
          type: "discount_expired",
          category: "operations",
          priority: "low",
          source: "rule",
          title: `Discount expired on "${s.name}"`,
          why: `It's still flagged active in Services. Either remove the discount or push the expiry date.`,
          action: { label: "Open services", linkUrl: "/services" },
          entityType: "service",
          entityId: s.id,
          detectedAt: isoNow(now),
        }];
      }
      if (daysLeft > ATTENTION_THRESHOLDS.DISCOUNT_EXPIRING_DAYS) return [];
      return [{
        id: attId("discount_expiring", s.id),
        type: "discount_expiring",
        category: "operations",
        priority: "low",
        source: "rule",
        title: `Discount on "${s.name}" expires in ${Math.ceil(daysLeft)} days`,
        why: `Decide if you'll extend, raise the price, or let it lapse.`,
        action: { label: "Open services", linkUrl: "/services" },
        entityType: "service",
        entityId: s.id,
        detectedAt: isoNow(now),
        dueAt: s.discount!.expiry,
      }];
    });
}

function ruleSalesTaxNoRate(data: AppData, now: Date): AttentionItem[] {
  if (!data.settings.salesTaxEnabled) return [];
  if (data.settings.defaultTaxRate && data.settings.defaultTaxRate > 0) return [];
  return [{
    id: attId("sales_tax_no_rate"),
    type: "sales_tax_no_rate",
    category: "finance",
    priority: "high",
    source: "rule",
    title: "Sales tax is on but the rate is empty",
    why: "Receipts will calculate $0 tax until you set the default rate. Fix it before the next receipt.",
    action: { label: "Open settings", linkUrl: "/settings" },
    entityType: "settings",
    detectedAt: isoNow(now),
  }];
}

/* ─────────────────────────────────────────────
   Engine
───────────────────────────────────────────── */

const ALL_RULES: Array<(d: AppData, now: Date) => AttentionItem[]> = [
  rulePendingBookingStale,
  ruleDepositPaidNotApproved,
  ruleCustomerCanceledAppointment,
  ruleCompletedNoFinalPrice,
  ruleCompletedNoReceipt,
  ruleCompletedNoReviewRequest,
  ruleJobTimerStalled,
  ruleInProgressOverrun,
  ruleCustomerOpenBalance,
  ruleCustomerOverdueRebook,
  ruleHighValueDormant,
  ruleLeadUncontacted,
  ruleLeadFollowUpDue,
  ruleLeadGoingCold,
  ruleServiceDiscountExpiring,
  ruleSalesTaxNoRate,
];

/**
 * Run every rule and return a deduped, priority-sorted list of attention
 * items. Pure function — pass `now` for deterministic tests.
 */
export function runAttentionRules(
  data: AppData,
  now: Date = new Date(),
): AttentionItem[] {
  const seen = new Set<string>();
  const items: AttentionItem[] = [];
  for (const rule of ALL_RULES) {
    let produced: AttentionItem[];
    try {
      produced = rule(data, now);
    } catch (err) {
      // A single bad rule must never take down the whole engine.
      console.error("[intelligence] rule threw:", err);
      continue;
    }
    for (const item of produced) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      items.push(item);
    }
  }
  return sortAttentionItems(items);
}

/** Stable priority + due-time ordering used everywhere we render items. */
export function sortAttentionItems(items: AttentionItem[]): AttentionItem[] {
  return [...items].sort((a, b) => {
    const p = ATTENTION_PRIORITY_RANK[a.priority] - ATTENTION_PRIORITY_RANK[b.priority];
    if (p !== 0) return p;
    const at = a.dueAt ? parseISO(a.dueAt).getTime() : parseISO(a.detectedAt).getTime();
    const bt = b.dueAt ? parseISO(b.dueAt).getTime() : parseISO(b.detectedAt).getTime();
    if (at !== bt) return at - bt;
    return a.id.localeCompare(b.id);
  });
}

/** Counts per priority — used by dashboard headline. */
export function countByPriority(items: AttentionItem[]): Record<AttentionPriority, number> {
  const out: Record<AttentionPriority, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    insight: 0,
  };
  for (const i of items) out[i.priority] += 1;
  return out;
}

