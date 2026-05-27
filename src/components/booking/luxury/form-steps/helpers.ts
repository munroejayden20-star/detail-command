/* ============================================================================
 * Tiny helpers — discount math + presentation formatters.
 * ========================================================================== */

import type { PublicService } from "@/lib/booking-api";
import type { FormState } from "./types";

export function activeDiscount(s: PublicService) {
  const d = s.discount;
  if (!d?.active || !d.value) return null;
  if (d.expiry && new Date(d.expiry) < new Date()) return null;
  return d;
}

export function applyDiscount(price: number, d: NonNullable<PublicService["discount"]>) {
  if (d.type === "percent") return Math.round(price * (1 - d.value / 100));
  return Math.max(0, price - d.value);
}

export function midPrice(s: PublicService) {
  const base = s.priceLow;
  const d = activeDiscount(s);
  return d ? applyDiscount(base, d) : base;
}

export function fmtPrice(low: number, high: number) {
  if (low === high) return `$${low}`;
  return `$${low}–$${high}`;
}

export function fmtDuration(minutes: number) {
  if (minutes >= 60) {
    const hours = Math.round((minutes / 60) * 10) / 10;
    return `${hours}h`;
  }
  return `${minutes}min`;
}

/** Tiny stable hash for the "build number" label on Step 7. Cosmetic only. */
export function hashConfig(f: FormState): number {
  const s = `${f.serviceIds.join(",")}|${f.addonIds.join(",")}|${f.vehicleSize}|${f.preferredDate}|${f.preferredTime}|${f.name}|${f.phone}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h | 0;
}
