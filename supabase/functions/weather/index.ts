/**
 * weather — Command Core Phase H3 weather lookup edge function.
 *
 * Returns daily forecasts for the business's service area or any given
 * coordinates. Backed by Open-Meteo (free, no API key required, no signup).
 *
 * Used by the dashboard's WeatherWatchCard to flag rain risk on upcoming
 * exterior jobs and by the AI assistant (Phase H7) when answering questions
 * like "what's the weather risk this weekend?"
 *
 * Default location is Vancouver, WA (45.6387, −122.6615) — the business's
 * primary service area. Callers can override via lat/lng.
 *
 * Required Supabase function secrets:
 *   SUPABASE_URL          — auto
 *   SUPABASE_ANON_KEY     — auto (used to verify the caller's JWT)
 *
 * Auth: requires the caller's Supabase JWT in the Authorization header. The
 * is_admin() Postgres function is the single source of truth.
 *
 * Deploy:
 *   supabase functions deploy weather
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, corsPreflight } from "../_shared/cors.ts";

interface RequestBody {
  /** Optional ISO timestamp the caller is asking about. Used to pick a day. */
  at?: string;
  /** Optional location overrides. Defaults to Vancouver, WA. */
  latitude?: number;
  longitude?: number;
  /** Days of forecast to return. 1–14. */
  forecastDays?: number;
  /** Free-form label echoed back so callers can group results. */
  label?: string;
}

interface OpenMeteoResponse {
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_probability_max?: number[];
    precipitation_sum?: number[];
  };
  timezone?: string;
}

interface WeatherDay {
  date: string;
  conditions: string;
  /** WMO weather interpretation code. */
  weatherCode: number;
  highF: number | null;
  lowF: number | null;
  precipitationProbabilityPct: number | null;
  precipitationInches: number | null;
}

interface WeatherFinding {
  label: string;
  latitude: number;
  longitude: number;
  timezone: string;
  days: WeatherDay[];
  /** ISO. */
  retrievedAt: string;
  source: "open-meteo";
}

/* ─────────────────────────────────────────────
   WMO weather code → short label
───────────────────────────────────────────── */

function describeWeather(code: number | null | undefined): string {
  if (code == null) return "Unknown";
  if (code === 0) return "Clear";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if (code >= 51 && code <= 55) return "Drizzle";
  if (code >= 56 && code <= 57) return "Freezing drizzle";
  if (code >= 61 && code <= 65) return "Rain";
  if (code >= 66 && code <= 67) return "Freezing rain";
  if (code >= 71 && code <= 75) return "Snow";
  if (code === 77) return "Snow grains";
  if (code >= 80 && code <= 82) return "Rain showers";
  if (code >= 85 && code <= 86) return "Snow showers";
  if (code === 95) return "Thunderstorm";
  if (code === 96 || code === 99) return "Thunderstorm with hail";
  return "Unknown";
}

const VANCOUVER_WA = { lat: 45.6387, lng: -122.6615 };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* ─────────────────────────────────────────────
   Auth — verify admin (mirror of external-search)
───────────────────────────────────────────── */

async function verifyAdmin(authHeader: string | null): Promise<{ ok: boolean; reason?: string }> {
  if (!authHeader) return { ok: false, reason: "missing_authorization" };
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return { ok: false, reason: "misconfigured" };

  const sb = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userErr } = await sb.auth.getUser();
  if (userErr || !userData?.user) return { ok: false, reason: "no_user" };
  const { data: isAdmin, error: rpcErr } = await sb.rpc("is_admin");
  if (rpcErr) return { ok: false, reason: "rpc_failed" };
  if (!isAdmin) return { ok: false, reason: "not_admin" };
  return { ok: true };
}

/* ─────────────────────────────────────────────
   Server
───────────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const auth = await verifyAdmin(req.headers.get("Authorization"));
  if (!auth.ok) {
    return jsonResponse({ error: "unauthorized", reason: auth.reason }, 401);
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const latitude = Number.isFinite(body.latitude) ? Number(body.latitude) : VANCOUVER_WA.lat;
  const longitude = Number.isFinite(body.longitude) ? Number(body.longitude) : VANCOUVER_WA.lng;
  const forecastDays = Math.max(1, Math.min(14, Number(body.forecastDays ?? 7)));

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("timezone", "America/Los_Angeles");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("precipitation_unit", "inch");
  url.searchParams.set("forecast_days", String(forecastDays));
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum",
  );

  let providerResp: OpenMeteoResponse;
  try {
    const res = await fetch(url.toString(), { headers: { "User-Agent": "DetailCommand/1.0" } });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Open-Meteo HTTP ${res.status}: ${text.slice(0, 200)}`);
    }
    providerResp = await res.json();
  } catch (err) {
    console.error("[weather] provider call failed:", err);
    return jsonResponse(
      { error: "provider_failed", message: err instanceof Error ? err.message : String(err) },
      502,
    );
  }

  const daily = providerResp.daily ?? {};
  const dates = daily.time ?? [];
  const days: WeatherDay[] = dates.map((date, i) => {
    const code = daily.weather_code?.[i] ?? null;
    return {
      date,
      conditions: describeWeather(code ?? undefined),
      weatherCode: code ?? -1,
      highF: daily.temperature_2m_max?.[i] ?? null,
      lowF: daily.temperature_2m_min?.[i] ?? null,
      precipitationProbabilityPct: daily.precipitation_probability_max?.[i] ?? null,
      precipitationInches: daily.precipitation_sum?.[i] ?? null,
    };
  });

  const finding: WeatherFinding = {
    label: body.label || "Service area",
    latitude,
    longitude,
    timezone: providerResp.timezone || "America/Los_Angeles",
    days,
    retrievedAt: new Date().toISOString(),
    source: "open-meteo",
  };

  return jsonResponse(finding);
});
