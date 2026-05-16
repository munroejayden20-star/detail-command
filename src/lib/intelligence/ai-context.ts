/**
 * AI context builder — assembles a structured, minimal-PII bundle to send to
 * the AI provider when answering questions or drafting messages.
 *
 * Privacy rules per spec section 13:
 *   - never send raw DB rows
 *   - never send full customer lists; only focus entities for the question
 *   - redact phone/email unless the AI is explicitly drafting a message
 *   - log usage without leaking customer identifiers
 */
import type { AppData } from "@/lib/types";
import type { AiContextBundle, BusinessInsight, PricingPattern, WorkloadForecast } from "./types";
import type { RevenuePace } from "./forecasts";
import { buildBusinessSnapshot, buildCustomerProfile, topCustomerProfiles, rebookCandidates } from "./derived-metrics";
import { runAttentionRules } from "./rules";
import { buildBusinessInsights } from "./insights";
import { buildWorkloadForecast, buildRevenuePace } from "./forecasts";
import { buildPricingPatterns } from "./pricing-intelligence";
import { customerHighlights, type CustomerHighlights } from "./customer-intelligence";
import { rangeAllTime } from "./data-access";
import type { ID } from "@/lib/types";

export interface AiContextOptions {
  /** Customers the question is "about". */
  focusCustomerIds?: string[];
  /** Appointments the question is "about". */
  focusAppointmentIds?: string[];
  /** Whether to include PII (used only when drafting messages). */
  includePii?: boolean;
}

/* ─────────────────────────────────────────────
   PII redaction
───────────────────────────────────────────── */

const PHONE_RE = /\+?[\d\s\-().]{7,}/g;
const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

/**
 * Defensively strip phone numbers and email addresses from any JSON-
 * serializable structure. Returns a new deep copy with the fields scrubbed.
 * CustomerIntelligenceProfile already doesn't carry them, but we apply this
 * as a belt-and-suspenders guard before the bundle leaves the browser.
 */
function redactPii<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value
      .replace(PHONE_RE, "[redacted]")
      .replace(EMAIL_RE, "[redacted]") as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redactPii(v)) as unknown as T;
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = redactPii(v);
    }
    return result as T;
  }
  return value;
}

/* ─────────────────────────────────────────────
   buildAiContext
───────────────────────────────────────────── */

/**
 * Assemble the minimal-PII context bundle. Used as the base layer for the
 * enriched context sent to the AI edge function.
 */
export function buildAiContext(
  data: AppData,
  options: AiContextOptions = {},
): AiContextBundle {
  const now = new Date();
  const attention = runAttentionRules(data, now).slice(0, 15);
  const snapshot = buildBusinessSnapshot(data, rangeAllTime(), attention);

  // Focus customers: either the specified ids or the top 5 by value.
  let focusCustomers = (options.focusCustomerIds ?? []).length > 0
    ? options.focusCustomerIds!
        .map((id) => data.customers.find((c) => c.id === id))
        .filter(Boolean)
        .map((c) => buildCustomerProfile(data, c!, now))
    : topCustomerProfiles(data, 5, now);

  // Focus appointments: either the specified ids projected to a minimal shape.
  const focusAppointments = (options.focusAppointmentIds ?? []).length > 0
    ? options.focusAppointmentIds!
        .map((id) => data.appointments.find((a) => a.id === id))
        .filter(Boolean)
        .map((a) => ({ id: a!.id, status: a!.status, start: a!.start }))
    : [];

  const bundle: AiContextBundle = {
    generatedAt: now.toISOString(),
    snapshot,
    attention,
    focusCustomers,
    focusAppointments: focusAppointments.length > 0 ? focusAppointments : undefined,
  };

  // PII redaction when not drafting messages.
  if (options.includePii !== true) {
    return redactPii(bundle);
  }
  return bundle;
}

/* ─────────────────────────────────────────────
   EnrichedAiContext
───────────────────────────────────────────── */

export interface EnrichedAiContext {
  generatedAt: string;
  bundle: AiContextBundle;
  insights: BusinessInsight[];
  workloadForecast: WorkloadForecast;
  revenuePace: RevenuePace;
  pricingPatterns: PricingPattern[];
  focusCustomerHighlights: Array<{ customerId: ID; highlights: CustomerHighlights }>;
  rebookCandidateCount: number;
}

/**
 * Richer, JSON-serializable context object that includes the base bundle plus
 * insights, forecasts, pricing patterns, and customer highlights. This is the
 * payload sent to the ai-assistant edge function.
 */
export function buildEnrichedContext(
  data: AppData,
  options: AiContextOptions = {},
): EnrichedAiContext {
  const now = new Date();
  const bundle = buildAiContext(data, options);
  const insights = buildBusinessInsights(data, now).slice(0, 10);
  const workloadForecast = buildWorkloadForecast(data, 14, now);
  const revenuePace = buildRevenuePace(data, now);
  const pricingPatterns = buildPricingPatterns(data).slice(0, 10);
  const rebookCandidateCount = rebookCandidates(data, now).length;

  // Customer highlights for focus customers.
  const focusIds = (options.focusCustomerIds ?? []).length > 0
    ? options.focusCustomerIds!
    : (bundle.focusCustomers ?? []).map((c) => c.customerId);

  const focusCustomerHighlights = focusIds
    .map((id) => {
      const h = customerHighlights(data, id);
      return h ? { customerId: id, highlights: h } : null;
    })
    .filter(Boolean) as Array<{ customerId: ID; highlights: CustomerHighlights }>;

  const enriched: EnrichedAiContext = {
    generatedAt: now.toISOString(),
    bundle,
    insights,
    workloadForecast,
    revenuePace,
    pricingPatterns,
    focusCustomerHighlights,
    rebookCandidateCount,
  };

  // PII redaction.
  if (options.includePii !== true) {
    return redactPii(enriched);
  }
  return enriched;
}
