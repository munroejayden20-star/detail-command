/**
 * Explainers — small, deterministic helpers that turn intelligence outputs
 * into plain-English text. Used in attention items, insight cards, and
 * AI-context narration.
 *
 * Keep these pure. No I/O. No randomness. They must produce identical text
 * for identical inputs so snapshots and tests stay stable.
 */
import type { AttentionItem, AttentionPriority, Confidence } from "./types";

const PRIORITY_LABEL: Record<AttentionPriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  insight: "Insight",
};

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "High confidence",
  medium: "Medium confidence",
  low: "Low confidence — interpret carefully",
};

export function priorityLabel(p: AttentionPriority): string {
  return PRIORITY_LABEL[p];
}

export function confidenceLabel(c: Confidence): string {
  return CONFIDENCE_LABEL[c];
}

/** A one-line summary of an attention item, suitable for SMS / push. */
export function summarizeAttentionItem(item: AttentionItem): string {
  const verb = item.action?.label ? `${item.action.label}: ` : "";
  return `${verb}${item.title}`;
}
