import type { AppData } from "./types";
import { EMPTY_DATA } from "./starter";
import { safeJSON } from "./utils";

/**
 * localStorage is now a *cache only* — Supabase is the source of truth.
 * We keep a per-user cached snapshot so the UI can render instantly while
 * the cloud fetch is in flight.
 *
 * Pre-cloud versions of this app stored everything under "detail-command:v1".
 * We expose loaders for that legacy key so users can opt-in to migrating
 * any local-only data they had before.
 */

const LEGACY_KEY = "detail-command:v1";
const cacheKey = (userId: string) => `detail-command:cache:${userId}`;

export function loadCachedData(userId: string): AppData | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(cacheKey(userId));
  if (!raw) return null;
  return safeJSON<AppData | null>(raw, null);
}

export function persistCache(userId: string, data: AppData) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(data));
  } catch {
    /* quota or serialization issue — non-fatal */
  }
}

export function clearCache(userId: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(cacheKey(userId));
}

/* ----- Legacy local-only data (pre-cloud) ----- */

export function loadLegacyData(): AppData | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LEGACY_KEY);
  if (!raw) return null;
  const parsed = safeJSON<AppData | null>(raw, null);
  if (!parsed || !Array.isArray(parsed.customers)) return null;
  return parsed;
}

export function clearLegacyData() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(LEGACY_KEY);
}

export function hasLegacyContent(): boolean {
  const d = loadLegacyData();
  if (!d) return false;
  return (
    d.customers.length > 0 ||
    d.appointments.length > 0 ||
    d.leads.length > 0 ||
    d.tasks.length > 0 ||
    d.expenses.length > 0
  );
}

/* ----- Export / import (manual JSON backup) ----- */

export function exportSnapshot(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

export function importSnapshot(json: string): AppData | null {
  try {
    const parsed = JSON.parse(json) as AppData;
    if (!Array.isArray(parsed.customers)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Empty starting point — never includes demo data. */
export { EMPTY_DATA };
