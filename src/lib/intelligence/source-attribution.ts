/**
 * Source attribution — labels every fact with where it came from.
 *
 * Per spec section 9 and 11, the AI layer must distinguish:
 *   - internal business data (your store)
 *   - external sourced data (web/Google/etc., with citations)
 *   - AI inference (clearly labeled as such)
 *
 * Phase 1 ships the type vocabulary. Phase 3 (external) and Phase 7 (AI) use
 * it to render source chips and citation lists.
 */
import type { ExternalSourceCitation } from "./types";

export type FactSource =
  | { kind: "internal"; reason: string }
  | { kind: "external"; citations: ExternalSourceCitation[] }
  | { kind: "ai-inference"; confidenceNote?: string };

export function isExternal(s: FactSource): s is Extract<FactSource, { kind: "external" }> {
  return s.kind === "external";
}

export function isInternal(s: FactSource): s is Extract<FactSource, { kind: "internal" }> {
  return s.kind === "internal";
}

export function isInference(s: FactSource): s is Extract<FactSource, { kind: "ai-inference" }> {
  return s.kind === "ai-inference";
}
