/**
 * Pricing intelligence — quote-vs-final analysis and recommendations.
 *
 * Recommendations from this module are advisory only. They are never applied
 * automatically and never mutate settings without explicit user confirmation
 * (per spec section 8). Every function here is a pure read-over-AppData.
 */
import type { AppData } from "@/lib/types";
import type { ID } from "@/lib/types";
import { dollarsToCents } from "@/lib/receipts";
import { completedAppointmentsWithService } from "./data-access";
import { confidenceFromSample, hasMinimumSample } from "./confidence";
import type { Confidence, PricingPattern } from "./types";
import { CONFIDENCE_THRESHOLDS } from "./types";

/* ─────────────────────────────────────────────
   Re-exported types
───────────────────────────────────────────── */

// PricingPattern lives in types.ts (already there from Phase-1 forward-planning).
export type { PricingPattern };

/* ─────────────────────────────────────────────
   CalculatorDriftWarning
───────────────────────────────────────────── */

/**
 * Advisory warning that the current calculator estimate for a given
 * service × vehicleSize combination deviates from historical actuals.
 *
 * Advisory only — this warning is displayed to the user; it never applies
 * changes to settings automatically.
 */
export interface CalculatorDriftWarning {
  serviceId: ID;
  vehicleSize: string | undefined;
  /** Average delta in cents (finalAvg − quotedAvg). Positive = underquoting. */
  patternDeltaCents: number;
  /** finalAvgCents / quotedAvgCents, capped to [0.5, 2.0]. */
  suggestedMultiplier: number;
  sampleSize: number;
  confidence: Confidence;
  /** One-liner suitable for display in the UI. */
  summary: string;
}

/* ─────────────────────────────────────────────
   Internal constants
───────────────────────────────────────────── */

/** Minimum absolute delta (cents) before we surface a drift warning. */
const DRIFT_THRESHOLD_CENTS = 1500; // $15.00

/** Caps for the suggested multiplier to keep it sane. */
const MULTIPLIER_MIN = 0.5;
const MULTIPLIER_MAX = 2.0;

/* ─────────────────────────────────────────────
   buildPricingPatterns
───────────────────────────────────────────── */

/**
 * Aggregate completed appointments by serviceId × vehicleSize, computing
 * average quoted vs final prices in cents and a quote-to-final delta.
 *
 * Only emits patterns with sampleSize >= MIN_SAMPLE_FOR_INSIGHT (3).
 *
 * Money: legacy estimatedPrice and finalPrice are in dollars — convert to
 * cents at the boundary here. finalPriceCents (newer field) is already cents.
 */
export function buildPricingPatterns(data: AppData): PricingPattern[] {
  // Key: `${serviceId}:${vehicleSize ?? "__any__"}`
  const buckets = new Map<
    string,
    {
      serviceId: ID;
      vehicleSize: string | undefined;
      quotedCents: number[];
      finalCents: number[];
      durationMinutes: number[];
    }
  >();

  for (const appt of data.appointments) {
    if (appt.status !== "completed") continue;

    // Require both an estimate and a final price.
    if (!appt.estimatedPrice || appt.estimatedPrice <= 0) continue;

    const finalC: number | null =
      typeof appt.finalPriceCents === "number" && appt.finalPriceCents > 0
        ? appt.finalPriceCents
        : typeof appt.finalPrice === "number" && appt.finalPrice > 0
          ? dollarsToCents(appt.finalPrice)
          : null;

    if (finalC == null) continue;

    const quotedC = dollarsToCents(appt.estimatedPrice);
    const vehicleSize = appt.vehicle?.size ?? undefined;

    // Duration from job timer if available.
    let durationMinutes: number | null = null;
    if (appt.actualStartAt && appt.actualEndAt) {
      const ms =
        new Date(appt.actualEndAt).getTime() - new Date(appt.actualStartAt).getTime();
      if (ms > 0) durationMinutes = Math.round(ms / 60000);
    }

    // One bucket per serviceId, and one per serviceId × vehicleSize (if known).
    const sizeLabel = vehicleSize ?? "__any__";
    for (const serviceId of appt.serviceIds) {
      const key = `${serviceId}:${sizeLabel}`;
      if (!buckets.has(key)) {
        buckets.set(key, {
          serviceId,
          vehicleSize,
          quotedCents: [],
          finalCents: [],
          durationMinutes: [],
        });
      }
      const bucket = buckets.get(key)!;
      bucket.quotedCents.push(quotedC);
      bucket.finalCents.push(finalC);
      if (durationMinutes != null) bucket.durationMinutes.push(durationMinutes);
    }
  }

  const patterns: PricingPattern[] = [];

  for (const bucket of buckets.values()) {
    const n = bucket.quotedCents.length;
    if (!hasMinimumSample(n)) continue;

    const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;

    const quotedAvgCents = Math.round(avg(bucket.quotedCents));
    const finalAvgCents = Math.round(avg(bucket.finalCents));
    const deltaAvgCents = finalAvgCents - quotedAvgCents;
    const averageDurationMinutes =
      bucket.durationMinutes.length > 0
        ? Math.round(avg(bucket.durationMinutes))
        : null;

    patterns.push({
      serviceId: bucket.serviceId,
      vehicleSize: bucket.vehicleSize,
      quotedAvgCents,
      finalAvgCents,
      deltaAvgCents,
      averageDurationMinutes,
      sampleSize: n,
      confidence: confidenceFromSample(n),
    });
  }

  return patterns;
}

/* ─────────────────────────────────────────────
   buildCalculatorDrift
───────────────────────────────────────────── */

/**
 * Look up the pricing pattern for a given serviceId × vehicleSize and, if
 * the average delta exceeds $15 and the sample is sufficient, return an
 * advisory drift warning with a suggested multiplier.
 *
 * Advisory only — this function never mutates settings.
 */
export function buildCalculatorDrift(
  data: AppData,
  serviceId: ID,
  vehicleSize?: string,
): CalculatorDriftWarning | null {
  const patterns = buildPricingPatterns(data);

  // Try exact vehicleSize match first, then fall back to any-size bucket.
  const sizeLabel = vehicleSize ?? "__any__";
  const pattern =
    patterns.find(
      (p) => p.serviceId === serviceId && (p.vehicleSize ?? "__any__") === sizeLabel,
    ) ??
    (vehicleSize != null
      ? patterns.find(
          (p) => p.serviceId === serviceId && p.vehicleSize == null,
        )
      : undefined);

  if (!pattern) return null;
  if (!hasMinimumSample(pattern.sampleSize)) return null;
  if (Math.abs(pattern.deltaAvgCents) < DRIFT_THRESHOLD_CENTS) return null;

  // Suggested multiplier: finalAvg / quotedAvg, capped to [0.5, 2.0].
  const rawMultiplier = pattern.quotedAvgCents > 0
    ? pattern.finalAvgCents / pattern.quotedAvgCents
    : 1;
  const suggestedMultiplier = Math.min(
    MULTIPLIER_MAX,
    Math.max(MULTIPLIER_MIN, rawMultiplier),
  );

  const direction = pattern.deltaAvgCents > 0 ? "underquoting" : "overquoting";
  const absDollars = (Math.abs(pattern.deltaAvgCents) / 100).toFixed(0);

  const service = data.services.find((s) => s.id === serviceId);
  const serviceName = service?.name ?? serviceId;
  const sizeHint = vehicleSize ? ` (${vehicleSize})` : "";

  const summary = `${serviceName}${sizeHint}: calculator is ${direction} by ~$${absDollars} on average across ${pattern.sampleSize} job${pattern.sampleSize === 1 ? "" : "s"}. Suggestion: multiply current price by ${suggestedMultiplier.toFixed(2)}×.`;

  return {
    serviceId,
    vehicleSize,
    patternDeltaCents: pattern.deltaAvgCents,
    suggestedMultiplier,
    sampleSize: pattern.sampleSize,
    confidence: pattern.confidence,
    summary,
  };
}
