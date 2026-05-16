/**
 * Iris — Business Intelligence Layer · public API barrel.
 *
 * Import from here whenever possible:
 *   import { runAttentionRules, buildBusinessSnapshot } from "@/lib/intelligence";
 *
 * Phase 1 surfaces (live):
 *   - runAttentionRules / sortAttentionItems / countByPriority
 *   - buildBusinessSnapshot / buildCustomerProfile / buildServicePerformance / buildLeadSourcePerformance
 *   - confidenceFromSample / hasMinimumSample
 *   - explainer helpers
 *
 * Later-phase surfaces (stubs that throw or return empty):
 *   - buildBusinessInsights (Phase 2)
 *   - buildWorkloadForecast (Phase 2)
 *   - buildPricingPatterns (Phase 4)
 *   - searchWeb / getWeatherForAppointment (Phase 3)
 *   - buildAiContext (Phase 7)
 *   - dispatchAiTool (Phase 7)
 */

// ── Types ────────────────────────────────────────────────────────────
export type {
  AiContextBundle,
  AiToolCall,
  AiToolResult,
  AttentionAction,
  AttentionCategory,
  AttentionEntityType,
  AttentionItem,
  AttentionLocalState,
  AttentionPriority,
  AttentionSource,
  BusinessInsight,
  BusinessSnapshot,
  Confidence,
  CustomerIntelligenceProfile,
  CustomerValueTier,
  DateRange,
  ExternalFinding,
  ExternalFreshness,
  ExternalSourceCitation,
  InsightSourceType,
  LeadSourcePerformance,
  PricingPattern,
  ServicePerformanceProfile,
  WorkloadForecast,
} from "./types";

export { ATTENTION_PRIORITY_RANK, CONFIDENCE_THRESHOLDS } from "./types";

// ── Confidence ───────────────────────────────────────────────────────
export { confidenceFromSample, hasMinimumSample, lowDataNote } from "./confidence";

// ── Data access ──────────────────────────────────────────────────────
export {
  activeCustomers,
  activeLeads,
  activeReceiptsForAppointment,
  activeReceiptsForCustomer,
  activeReceiptsInRange,
  appointmentsForCustomer,
  appointmentsInRange,
  completedAppointmentsForCustomer,
  completedAppointmentsInRange,
  completedAppointmentsWithService,
  daysSinceLastContact,
  depositPaidFor,
  estimatedDurationMinutes,
  findAppointment,
  findCustomer,
  findService,
  hoursSinceLeadCreated,
  hoursSinceStart,
  hoursUntilStart,
  jobDurationMinutes,
  lastCompletedServiceAt,
  medianRebookIntervalDays,
  openBalanceCentsForCustomer,
  rangeAllTime,
  rangeFromDates,
  withinRange,
} from "./data-access";

// ── Derived metrics ──────────────────────────────────────────────────
export {
  appointmentRevenueCents,
  buildBusinessSnapshot,
  buildCustomerProfile,
  buildLeadSourcePerformance,
  buildServicePerformance,
  rebookCandidates,
  topCustomerProfiles,
} from "./derived-metrics";

// ── Rules engine ─────────────────────────────────────────────────────
export {
  ATTENTION_THRESHOLDS,
  countByPriority,
  runAttentionRules,
  sortAttentionItems,
} from "./rules";

// ── Explainers ───────────────────────────────────────────────────────
export {
  confidenceLabel,
  priorityLabel,
  summarizeAttentionItem,
} from "./explainers";

// ── Source attribution ───────────────────────────────────────────────
export type { FactSource } from "./source-attribution";
export {
  isExternal,
  isInference,
  isInternal,
} from "./source-attribution";

// ── Phase H2 — Insights & forecasts ──────────────────────────────────
export {
  INSIGHT_THRESHOLDS,
  buildBusinessInsights,
  sortInsights,
} from "./insights";
export { buildRevenuePace, buildWorkloadForecast } from "./forecasts";
export type { RevenuePace } from "./forecasts";

// ── Phase H3 — External intelligence ─────────────────────────────────
export {
  clearExternalCaches,
  getWeatherForAppointment,
  lookupWeather,
  searchWeb,
} from "./external-intelligence";
export type {
  ExternalReason,
  ExternalResult,
  WebSearchOptions,
  WeatherLookupOptions,
} from "./external-intelligence";
export type { WeatherDay, WeatherFinding } from "./types";

// ── Phase H4 — Customer + pricing intelligence ───────────────────────
export {
  customerHighlights,
  daysSinceIso,
  draftFollowUpMessage,
  predictNextRebookDate,
} from "./customer-intelligence";
export type { CustomerHighlights } from "./customer-intelligence";
export { buildCalculatorDrift, buildPricingPatterns } from "./pricing-intelligence";
export type { CalculatorDriftWarning } from "./pricing-intelligence";

// ── Phase H7 — AI assistant ──────────────────────────────────────────
export { buildAiContext, buildEnrichedContext } from "./ai-context";
export type { AiContextOptions, EnrichedAiContext } from "./ai-context";
export { dispatchAiTool } from "./ai-tools";
export type { AiToolName } from "./ai-tools";
export { askAiAssistant } from "./ai-assistant";
export type {
  AiAssistantReason,
  AiAssistantResponse,
  AiAssistantResult,
} from "./ai-assistant";

// ── Iris action proposals + executor ────────────────────────────────
export { executeIrisAction } from "./iris-actions";
export type {
  IrisActionContext,
  IrisActionResult,
  IrisActionType,
  ProposedAction,
} from "./iris-actions";
