/**
 * Iris — Business Intelligence Layer · Types
 *
 * The shared type system for all intelligence modules. Phase 1 only uses a
 * subset of these (AttentionItem, BusinessSnapshot, CustomerIntelligenceProfile,
 * ServicePerformanceProfile, LeadSourcePerformance, Confidence). The rest are
 * forward-looking shapes for Phases 2–7 and are imported by stub modules.
 *
 * See docs/iris-architecture.md for the full plan.
 */
import type { ID, JobStatus } from "@/lib/types";

/* ─────────────────────────────────────────────
   Confidence
───────────────────────────────────────────── */

export type Confidence = "low" | "medium" | "high";

/** Sample-size thresholds used across insights and predictions. */
export const CONFIDENCE_THRESHOLDS = {
  /** Below this many samples, no insight should be surfaced. */
  MIN_SAMPLE_FOR_INSIGHT: 3,
  /** Below this many samples, an insight is "low" confidence. */
  LOW_TO_MEDIUM: 4,
  /** At or above this many samples, an insight is "high" confidence. */
  MEDIUM_TO_HIGH: 8,
} as const;

/* ─────────────────────────────────────────────
   Attention items (Phase 1)
───────────────────────────────────────────── */

export type AttentionPriority = "critical" | "high" | "medium" | "low" | "insight";

export type AttentionCategory =
  | "bookings"
  | "jobs"
  | "customers"
  | "leads"
  | "finance"
  | "operations"
  | "external";

export type AttentionSource = "rule" | "analytics" | "ai" | "external";

/** Entity kinds an attention item can point at. */
export type AttentionEntityType =
  | "appointment"
  | "customer"
  | "lead"
  | "task"
  | "expense"
  | "receipt"
  | "service"
  | "mileage"
  | "settings"
  | null;

/** A primary action a user can take to resolve an attention item. */
export interface AttentionAction {
  /** Short verb-led label, e.g. "Approve booking", "Send receipt". */
  label: string;
  /** Internal route to navigate to. Either linkUrl OR commandId is set. */
  linkUrl?: string;
  /** Future: structured command id the AI layer can dispatch. */
  commandId?: string;
}

/**
 * A single thing the owner should pay attention to right now.
 *
 * Phase 1 derives these live from store data on every render — no DB table.
 * Snooze/dismiss state lives in localStorage keyed by `id`. When the
 * underlying condition is fixed, the rule no longer emits the item, so it
 * auto-resolves from the UI.
 */
export interface AttentionItem {
  /** Stable, deterministic ID. Same condition + entity → same id across renders. */
  id: string;
  /** Stable rule type (e.g. "completed_no_receipt"). Used for grouping/filtering. */
  type: string;
  category: AttentionCategory;
  priority: AttentionPriority;
  source: AttentionSource;
  /** One-line headline ("Send receipt to Alice"). */
  title: string;
  /** Why it matters, 1–2 sentences, plain English. */
  why: string;
  /** Optional supporting numbers, e.g. amount owed, days dormant, etc. */
  detail?: string;
  /** What the user is being asked to do. Single primary action. */
  action?: AttentionAction;
  entityType: AttentionEntityType;
  entityId?: ID;
  /** When this condition first became true (best-effort). */
  detectedAt: string;
  /** Optional deadline-ish moment that drives priority. */
  dueAt?: string;
  /** Confidence — only meaningful for analytics/ai sourced items. */
  confidence?: Confidence;
}

export const ATTENTION_PRIORITY_RANK: Record<AttentionPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  insight: 4,
};

/* ─────────────────────────────────────────────
   Snooze / dismiss state (Phase 1, localStorage)
───────────────────────────────────────────── */

export interface AttentionLocalState {
  /** Map of attention item id → ISO timestamp it should reappear. */
  snoozedUntil: Record<string, string>;
  /** Map of attention item id → ISO timestamp dismissed. */
  dismissedAt: Record<string, string>;
}

/* ─────────────────────────────────────────────
   Business snapshot (Phase 1)
───────────────────────────────────────────── */

export interface DateRange {
  /** Inclusive ISO start, or null for unbounded. */
  start: string | null;
  /** Inclusive ISO end, or null for unbounded. */
  end: string | null;
  /** Human label, e.g. "This month". */
  label: string;
}

/**
 * A normalized, point-in-time view of the business across a date range.
 * Built on top of existing selectors and tax-center aggregations — no new
 * primitives. Phase 1 surfaces this on the dashboard and feeds it to later
 * AI-tool fns.
 */
export interface BusinessSnapshot {
  range: DateRange;

  // ── Activity ─────────────────────────────────────
  appointmentsTotal: number;
  appointmentsCompleted: number;
  appointmentsScheduled: number;
  appointmentsCanceled: number;
  appointmentsPending: number;

  // ── Money (cents) ────────────────────────────────
  /** Sum of receipts.amountPaidCents in range — what was actually collected. */
  collectedCents: number;
  /** Sum of receipts.remainingBalanceCents — what is still owed. */
  outstandingCents: number;
  /** Sum of receipts.taxCents — pass-through, not income. */
  salesTaxCollectedCents: number;
  /** Sum of expenses (signed: credits subtract). */
  totalExpensesCents: number;
  /** Estimated revenue from booked-but-not-completed jobs in range. */
  bookedFutureCents: number;
  /** Average finalPrice across completed jobs in range, in cents. */
  averageTicketCents: number;
  /** Estimated net profit (collected − salesTax − expenses − mileageDeduction). */
  estimatedNetProfitCents: number;

  // ── Leads ────────────────────────────────────────
  leadsCreated: number;
  leadsConverted: number;
  /** Converted / created. 0 if no leads. */
  leadConversionRate: number;

  // ── Operations ───────────────────────────────────
  /** Count of attention items currently open. */
  attentionOpenCount: number;
  /** Count of high+ priority attention items. */
  attentionHighCount: number;

  /** When this snapshot was computed. */
  generatedAt: string;
}

/* ─────────────────────────────────────────────
   Customer intelligence (Phase 1 surfaces basics; Phase 4 fleshes out)
───────────────────────────────────────────── */

export type CustomerValueTier = "new" | "regular" | "high_value" | "vip";

export interface CustomerIntelligenceProfile {
  customerId: ID;
  // ── Spend ─────────────────────────────────
  /** Sum of receipt amounts (cents) across all of this customer's receipts. */
  lifetimeSpendCents: number;
  /** Sum of estimated/final price across completed appointments — fallback when no receipts. */
  lifetimeRevenueCents: number;
  averageTicketCents: number;
  // ── Activity ──────────────────────────────
  completedJobs: number;
  totalJobs: number;
  lastServiceAt: string | null;
  daysSinceLastService: number | null;
  /** Median days between consecutive completed jobs. null if <2 services. */
  medianRebookIntervalDays: number | null;
  /** "due", "overdue", "fresh", "unknown" based on rebook interval. */
  rebookStatus: "fresh" | "due" | "overdue" | "unknown";
  // ── Tier ──────────────────────────────────
  tier: CustomerValueTier;
  // ── Communication ─────────────────────────
  reviewRequestSentForLatest: boolean;
  /** Open balance across active receipts (cents). */
  openBalanceCents: number;
}

/* ─────────────────────────────────────────────
   Service performance (Phase 2 — minimal v1 in derived-metrics)
───────────────────────────────────────────── */

export interface ServicePerformanceProfile {
  serviceId: ID;
  serviceName: string;
  /** Completed jobs that included this service. */
  jobsCount: number;
  averageFinalPriceCents: number;
  /** Average minutes for completed jobs that have a job timer record. */
  averageDurationMinutes: number | null;
  averageHourlyCents: number | null;
  /** Average difference between estimatedPrice and finalPrice (final − est). */
  averageQuoteToFinalDeltaCents: number | null;
  /** Confidence based on jobsCount. */
  confidence: Confidence;
  sampleSize: number;
}

/* ─────────────────────────────────────────────
   Lead source performance (Phase 2 — minimal v1)
───────────────────────────────────────────── */

export interface LeadSourcePerformance {
  source: string;
  leadsCount: number;
  convertedCount: number;
  conversionRate: number;
  averageRevenueCents: number;
  totalRevenueCents: number;
  confidence: Confidence;
}

/* ─────────────────────────────────────────────
   Pricing patterns (Phase 4)
───────────────────────────────────────────── */

export interface PricingPattern {
  serviceId: ID;
  vehicleSize?: string;
  condition?: string;
  quotedAvgCents: number;
  finalAvgCents: number;
  deltaAvgCents: number;
  averageDurationMinutes: number | null;
  sampleSize: number;
  confidence: Confidence;
}

/* ─────────────────────────────────────────────
   Workload forecast (Phase 2)
───────────────────────────────────────────── */

export interface WorkloadForecast {
  rangeDays: number;
  bookedJobs: number;
  bookedRevenueCents: number;
  /** Open capacity = (rangeDays × maxJobsPerDay) − bookedJobs, floored at 0. */
  openCapacity: number;
  overloadedDates: string[];
  underbookedDates: string[];
  generatedAt: string;
}

/* ─────────────────────────────────────────────
   Insight envelope (Phase 2)
───────────────────────────────────────────── */

export type InsightSourceType = "internal" | "external" | "mixed";

export interface BusinessInsight {
  id: string;
  type: string;
  title: string;
  summary: string;
  detail?: string;
  confidence: Confidence;
  sampleSize?: number;
  recommendedAction?: AttentionAction;
  sourceType: InsightSourceType;
  metadata?: Record<string, unknown>;
  generatedAt: string;
}

/* ─────────────────────────────────────────────
   External research / web findings (Phase 3)
───────────────────────────────────────────── */

export type ExternalFreshness = "fresh" | "recent" | "stale" | "unknown";

export interface ExternalSourceCitation {
  title: string;
  url: string;
  domain: string;
  retrievedAt: string;
  freshness: ExternalFreshness;
}

export interface ExternalFinding {
  query: string;
  summary: string;
  citations: ExternalSourceCitation[];
  confidence: Confidence;
  /** What this is meant to inform — e.g. "pricing", "weather", "law". */
  relevantTo: string;
  retrievedAt: string;
}

/* ─────────────────────────────────────────────
   Weather (Phase H3)
───────────────────────────────────────────── */

export interface WeatherDay {
  /** YYYY-MM-DD in business timezone. */
  date: string;
  /** Plain-English summary, e.g. "Rain showers". */
  conditions: string;
  /** WMO weather interpretation code. */
  weatherCode: number;
  highF: number | null;
  lowF: number | null;
  /** 0–100 chance of precipitation that day. */
  precipitationProbabilityPct: number | null;
  precipitationInches: number | null;
}

export interface WeatherFinding {
  label: string;
  latitude: number;
  longitude: number;
  timezone: string;
  days: WeatherDay[];
  retrievedAt: string;
  source: "open-meteo";
}

/* ─────────────────────────────────────────────
   AI tool / context shapes (Phase 7)
───────────────────────────────────────────── */

/** A structured envelope passed to the AI layer. Never raw DB rows. */
export interface AiContextBundle {
  generatedAt: string;
  snapshot: BusinessSnapshot;
  attention: AttentionItem[];
  /** Optional focused entities (e.g. "asking about this customer"). */
  focusCustomers?: CustomerIntelligenceProfile[];
  focusAppointments?: { id: ID; status: JobStatus; start: string }[];
  /** Optional external findings the AI should cite. */
  external?: ExternalFinding[];
}

export interface AiToolCall {
  name: string;
  args: Record<string, unknown>;
}

export interface AiToolResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}
