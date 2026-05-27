/* ============================================================================
 * Shared helpers used by multiple section files (price math, discount math,
 * duration formatter, smooth-scroll-to-id).
 * ========================================================================== */

import type { PublicService } from "@/lib/booking-api";

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

export function discBadgeText(d: NonNullable<PublicService["discount"]>) {
  if (d.label) return d.label;
  return d.type === "percent" ? `${d.value}% OFF` : `$${d.value} OFF`;
}

export function fmtDuration(minutes: number) {
  if (minutes >= 60) {
    const hours = Math.round((minutes / 60) * 10) / 10;
    return `${hours} hr`;
  }
  return `${minutes} min`;
}

export function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}
