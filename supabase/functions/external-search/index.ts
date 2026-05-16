/**
 * external-search — Command Core Phase H3 web retrieval edge function.
 *
 * Accepts POST { query: string, options?: { recency?, domain?, limit? } } from
 * an authenticated admin and returns a normalized `ExternalFinding` shape with
 * citations + freshness metadata. Provider key never leaves the server.
 *
 * Provider: Tavily (default). To swap providers, add another adapter and
 * select via WEB_SEARCH_PROVIDER env. The shape returned to the client is
 * provider-independent.
 *
 * Required Supabase function secrets:
 *   TAVILY_API_KEY        — Tavily search API key (https://tavily.com)
 *   SUPABASE_URL          — auto
 *   SUPABASE_ANON_KEY     — auto (used to verify the caller's JWT)
 *
 * Optional:
 *   WEB_SEARCH_PROVIDER   — defaults to "tavily"
 *   WEB_SEARCH_ENABLED    — set to "false" to hard-disable the function
 *
 * Auth: requires the caller's Supabase JWT in the Authorization header.
 * The is_admin() Postgres function (Phase 8 admin lockdown) is the single
 * source of truth for who can call this.
 *
 * Deploy:
 *   supabase functions deploy external-search
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, corsPreflight } from "../_shared/cors.ts";

interface SearchOptions {
  /** "fresh" → bias to recent (~1 month), "any" → no time filter. */
  recency?: "fresh" | "any";
  /** Restrict to a single domain (e.g., "irs.gov"). */
  domain?: string;
  /** Max results to return. Provider-clamped. */
  limit?: number;
}

interface RequestBody {
  query?: string;
  options?: SearchOptions;
}

interface TavilyResult {
  title: string;
  url: string;
  content?: string;
  score?: number;
  published_date?: string | null;
}

interface TavilyResponse {
  answer?: string;
  results?: TavilyResult[];
}

interface ExternalSourceCitation {
  title: string;
  url: string;
  domain: string;
  retrievedAt: string;
  freshness: "fresh" | "recent" | "stale" | "unknown";
}

interface ExternalFinding {
  query: string;
  summary: string;
  citations: ExternalSourceCitation[];
  confidence: "low" | "medium" | "high";
  relevantTo: string;
  retrievedAt: string;
}

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function freshnessOf(publishedAt: string | null | undefined): ExternalSourceCitation["freshness"] {
  if (!publishedAt) return "unknown";
  const t = Date.parse(publishedAt);
  if (Number.isNaN(t)) return "unknown";
  const ageDays = (Date.now() - t) / (1000 * 60 * 60 * 24);
  if (ageDays < 30) return "fresh";
  if (ageDays < 365) return "recent";
  return "stale";
}

function confidenceOf(citations: ExternalSourceCitation[]): "low" | "medium" | "high" {
  const usable = citations.filter((c) => c.freshness !== "stale").length;
  if (usable >= 3) return "high";
  if (usable >= 1) return "medium";
  return "low";
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* ─────────────────────────────────────────────
   Tavily adapter
───────────────────────────────────────────── */

async function tavilySearch(
  apiKey: string,
  query: string,
  options: SearchOptions,
): Promise<TavilyResponse> {
  const body: Record<string, unknown> = {
    api_key: apiKey,
    query,
    search_depth: "basic",
    include_answer: true,
    max_results: Math.max(1, Math.min(10, options.limit ?? 5)),
  };
  if (options.recency === "fresh") body.days = 30;
  if (options.domain) body.include_domains = [options.domain];

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Tavily HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return await res.json();
}

/* ─────────────────────────────────────────────
   Auth — verify the caller is an admin
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

  const enabled = (Deno.env.get("WEB_SEARCH_ENABLED") ?? "true").toLowerCase() !== "false";
  if (!enabled) {
    return jsonResponse({ error: "web_search_disabled" }, 503);
  }

  const provider = (Deno.env.get("WEB_SEARCH_PROVIDER") ?? "tavily").toLowerCase();
  const apiKey = provider === "tavily" ? Deno.env.get("TAVILY_API_KEY") : undefined;
  if (!apiKey) {
    return jsonResponse(
      { error: "provider_not_configured", provider },
      503,
    );
  }

  // Admin auth
  const auth = await verifyAdmin(req.headers.get("Authorization"));
  if (!auth.ok) {
    return jsonResponse({ error: "unauthorized", reason: auth.reason }, 401);
  }

  // Parse body
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "bad_json" }, 400);
  }
  const query = (body.query ?? "").trim();
  if (!query) {
    return jsonResponse({ error: "empty_query" }, 400);
  }
  const options: SearchOptions = body.options ?? {};

  // Provider call
  let providerResp: TavilyResponse;
  try {
    providerResp = await tavilySearch(apiKey, query, options);
  } catch (err) {
    console.error("[external-search] provider call failed:", err);
    return jsonResponse(
      { error: "provider_failed", message: err instanceof Error ? err.message : String(err) },
      502,
    );
  }

  // Normalize
  const retrievedAt = new Date().toISOString();
  const citations: ExternalSourceCitation[] = (providerResp.results ?? []).map((r) => ({
    title: r.title || domainOf(r.url) || r.url,
    url: r.url,
    domain: domainOf(r.url),
    retrievedAt,
    freshness: freshnessOf(r.published_date),
  }));
  const summary = providerResp.answer?.trim() ||
    citations.slice(0, 3).map((c) => c.title).join(" · ") ||
    "No usable summary returned by the provider.";

  const finding: ExternalFinding = {
    query,
    summary,
    citations,
    confidence: confidenceOf(citations),
    relevantTo: options.domain ? `domain:${options.domain}` : "general",
    retrievedAt,
  };

  return jsonResponse(finding);
});
