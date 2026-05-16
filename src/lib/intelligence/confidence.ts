/**
 * Confidence helpers.
 *
 * The same rule applies everywhere: a number computed from very few samples
 * shouldn't be presented with the same authority as one computed from many.
 * These helpers centralize the thresholds so the whole intelligence layer
 * speaks the same language about certainty.
 */
import { CONFIDENCE_THRESHOLDS, type Confidence } from "./types";

/** Map a sample size to a confidence level. */
export function confidenceFromSample(n: number): Confidence {
  if (n >= CONFIDENCE_THRESHOLDS.MEDIUM_TO_HIGH) return "high";
  if (n >= CONFIDENCE_THRESHOLDS.LOW_TO_MEDIUM) return "medium";
  return "low";
}

/** True if there's enough data to surface an insight at all. */
export function hasMinimumSample(n: number): boolean {
  return n >= CONFIDENCE_THRESHOLDS.MIN_SAMPLE_FOR_INSIGHT;
}

/** Human-readable suffix for low-data warnings. */
export function lowDataNote(n: number): string {
  return `Based on ${n} ${n === 1 ? "sample" : "samples"} — confidence is low.`;
}
