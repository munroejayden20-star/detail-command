/**
 * External intelligence — browser-side client for the Phase H3 web + weather
 * edge functions.
 *
 * All real network calls happen server-side in `supabase/functions/external-search`
 * and `supabase/functions/weather`. Provider API keys never leave the server.
 *
 * This module:
 *   - invokes those functions via supabase-js
 *   - normalizes their responses
 *   - caches in-session by query (cheap dedupe; no PII to localStorage)
 *   - returns a structured "not configured" result instead of throwing so
 *     the UI can render gracefully when keys aren't set yet
 *
 * The AI assistant (Phase H7) will call these same functions as tool calls.
 * The shapes returned here ARE the tool-call output shapes.
 */
import { getSupabase } from "@/lib/supabase";
import type { ExternalFinding, WeatherFinding } from "./types";

/* ─────────────────────────────────────────────
   Web search
───────────────────────────────────────────── */

export interface WebSearchOptions {
  /** "fresh" → bias to recent (~1 month). "any" → no time filter. */
  recency?: "fresh" | "any";
  /** Restrict to a single domain (e.g. "irs.gov"). */
  domain?: string;
  /** Max results to return. Provider-clamped. */
  limit?: number;
}

export type ExternalReason =
  | "ok"
  | "supabase_unconfigured"
  | "web_search_disabled"
  | "provider_not_configured"
  | "unauthorized"
  | "provider_failed"
  | "bad_query"
  | "unknown_error";

export interface ExternalResult<T> {
  ok: boolean;
  reason: ExternalReason;
  data?: T;
  message?: string;
}

const webCache = new Map<string, ExternalFinding>();

/**
 * Run a web search via the server-side `external-search` edge function.
 * Returns ok=false with a reason when not configured or auth fails — the UI
 * decides whether to show that as a banner or hide entirely.
 */
export async function searchWeb(
  query: string,
  options: WebSearchOptions = {},
): Promise<ExternalResult<ExternalFinding>> {
  const trimmed = (query ?? "").trim();
  if (!trimmed) return { ok: false, reason: "bad_query" };

  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "supabase_unconfigured" };

  const cacheKey = `${trimmed}|${options.recency ?? ""}|${options.domain ?? ""}|${options.limit ?? ""}`;
  const cached = webCache.get(cacheKey);
  if (cached) return { ok: true, reason: "ok", data: cached };

  const { data, error } = await sb.functions.invoke<ExternalFinding | { error: string }>(
    "external-search",
    { body: { query: trimmed, options } },
  );

  if (error) {
    // supabase-js wraps non-2xx as FunctionsHttpError. Surface the reason.
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("503")) return { ok: false, reason: "provider_not_configured", message: msg };
    if (msg.includes("401") || msg.includes("403")) return { ok: false, reason: "unauthorized", message: msg };
    return { ok: false, reason: "provider_failed", message: msg };
  }
  if (!data || (data as { error?: string }).error) {
    const errMsg = (data as { error?: string } | null)?.error ?? "no data";
    return { ok: false, reason: "provider_failed", message: errMsg };
  }
  const finding = data as ExternalFinding;
  webCache.set(cacheKey, finding);
  return { ok: true, reason: "ok", data: finding };
}

/* ─────────────────────────────────────────────
   Weather
───────────────────────────────────────────── */

export interface WeatherLookupOptions {
  latitude?: number;
  longitude?: number;
  forecastDays?: number;
  /** Free-form label echoed back so callers can group results. */
  label?: string;
}

const weatherCache = new Map<string, { data: WeatherFinding; cachedAt: number }>();
const WEATHER_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Forecast for the business's service area (Vancouver, WA by default) or any
 * given coordinates. Cached for 30 minutes per location to avoid duplicate
 * calls when multiple appointments map to the same lat/lng.
 */
export async function lookupWeather(
  options: WeatherLookupOptions = {},
): Promise<ExternalResult<WeatherFinding>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "supabase_unconfigured" };

  const cacheKey = `${options.latitude ?? "default"}|${options.longitude ?? "default"}|${options.forecastDays ?? 7}`;
  const now = Date.now();
  const cached = weatherCache.get(cacheKey);
  if (cached && now - cached.cachedAt < WEATHER_TTL_MS) {
    return { ok: true, reason: "ok", data: cached.data };
  }

  const { data, error } = await sb.functions.invoke<WeatherFinding | { error: string }>(
    "weather",
    { body: options },
  );
  if (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("401") || msg.includes("403")) return { ok: false, reason: "unauthorized", message: msg };
    return { ok: false, reason: "provider_failed", message: msg };
  }
  if (!data || (data as { error?: string }).error) {
    const errMsg = (data as { error?: string } | null)?.error ?? "no data";
    return { ok: false, reason: "provider_failed", message: errMsg };
  }
  const finding = data as WeatherFinding;
  weatherCache.set(cacheKey, { data: finding, cachedAt: now });
  return { ok: true, reason: "ok", data: finding };
}

/* ─────────────────────────────────────────────
   Phase 7-friendly wrappers (kept for the AI tool surface)
───────────────────────────────────────────── */

/** Phase H7 tool wrapper. Throws on failure to keep tool-result semantics. */
export async function getWeatherForAppointment(
  _appointmentId: string,
): Promise<WeatherFinding> {
  // For v1, weather is service-area-level. Geocoding individual addresses
  // is a Phase H5 (Google Maps) follow-up. Returning the service-area forecast
  // is the right answer for "is the weather risky on this appointment's day."
  const r = await lookupWeather();
  if (!r.ok || !r.data) {
    throw new Error(`[external-intelligence] weather lookup failed: ${r.reason} ${r.message ?? ""}`);
  }
  return r.data;
}

/* ─────────────────────────────────────────────
   Cache controls (used by Settings → Integrations test panel)
───────────────────────────────────────────── */

export function clearExternalCaches(): void {
  webCache.clear();
  weatherCache.clear();
}
