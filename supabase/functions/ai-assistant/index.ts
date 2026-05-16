/**
 * ai-assistant — Command Core Phase H7 conversational AI edge function.
 *
 * Accepts POST { query: string, context: object } from an authenticated admin
 * and returns a grounded AI response with citations.
 *
 * The browser pre-computes an EnrichedAiContext bundle and sends it as facts
 * the model can rely on. Server-side tools the model can call:
 *   - search_web  → proxies to external-search edge function
 *   - get_weather → proxies to weather edge function
 *
 * Required Supabase function secrets:
 *   ANTHROPIC_API_KEY      — Anthropic Messages API key
 *   SUPABASE_URL           — auto
 *   SUPABASE_ANON_KEY      — auto (used to verify the caller's JWT)
 *
 * Optional:
 *   AI_ASSISTANT_ENABLED    — set to "false" to hard-disable (default "true")
 *   AI_ASSISTANT_MODEL      — default "claude-sonnet-4-6"
 *   AI_ASSISTANT_MAX_TOKENS — default 1500
 *
 * Auth: requires the caller's Supabase JWT in the Authorization header.
 * is_admin() RPC is the single source of truth for who can call this.
 *
 * Deploy:
 *   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
 *   supabase functions deploy ai-assistant
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders, corsPreflight } from "../_shared/cors.ts";

/* ─────────────────────────────────────────────
   Constants
───────────────────────────────────────────── */

const MAX_BODY_BYTES = 256 * 1024; // 256 KB
const MAX_TOOL_ITERATIONS = 4;
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */

interface RequestBody {
  query?: string;
  context?: unknown;
  pageContext?: unknown;
}

interface ProposedAction {
  id: string;
  type: string;
  label: string;
  summary: string;
  confirmText?: string;
  destructive?: boolean;
  payload: Record<string, unknown>;
}

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContent[];
}

interface AnthropicContent {
  type: string;
  [key: string]: unknown;
}

interface AnthropicToolUse {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface AnthropicToolResult {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

interface AnthropicApiResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: AnthropicContent[];
  stop_reason: "end_turn" | "tool_use" | "max_tokens" | string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  model: string;
}

interface ExternalSourceCitation {
  title: string;
  url: string;
  domain: string;
  freshness: string;
}

interface SearchResult {
  query: string;
  summary: string;
  citations?: ExternalSourceCitation[];
  retrievedAt: string;
}

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* ─────────────────────────────────────────────
   Admin auth (mirror of external-search)
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
   Server-side tool dispatch
───────────────────────────────────────────── */

async function dispatchSearchWeb(
  query: string,
  recency: string | undefined,
  supabaseUrl: string,
  authHeader: string,
): Promise<{ result: SearchResult; citations: ExternalSourceCitation[] }> {
  const url = `${supabaseUrl}/functions/v1/external-search`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": authHeader,
    },
    body: JSON.stringify({ query, options: { recency: recency ?? "any" } }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`external-search HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json() as SearchResult;
  return {
    result: data,
    citations: data.citations ?? [],
  };
}

async function dispatchGetWeather(
  supabaseUrl: string,
  authHeader: string,
): Promise<unknown> {
  const url = `${supabaseUrl}/functions/v1/weather`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": authHeader,
    },
    body: JSON.stringify({ forecastDays: 7 }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`weather HTTP ${res.status}: ${text.slice(0, 200)}`);
  }

  return await res.json();
}

/* ─────────────────────────────────────────────
   Tool definitions for the model
───────────────────────────────────────────── */

const MODEL_TOOLS = [
  {
    name: "search_web",
    description: "Search the web for current information about auto detailing products, pricing, regulations, competitors, or any external topic relevant to the business question.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query.",
        },
        recency: {
          type: "string",
          enum: ["fresh", "any"],
          description: "fresh = bias to last ~30 days; any = no time filter.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_weather",
    description: "Get the current weather forecast for the service area (Vancouver, WA / Portland, OR metro). Returns daily high/low temps, precipitation probability, and conditions for the next 7 days.",
    input_schema: {
      type: "object",
      properties: {
        days: {
          type: "number",
          description: "Number of forecast days to return. Default 7.",
        },
      },
      required: [],
    },
  },
  {
    name: "propose_action",
    description:
      "Propose an action for Jayden to approve. Use this whenever the user might want you to actually DO something (create a task, snooze an alert, send a review request, update a service price, mark a job complete, navigate, copy a draft message, etc.). The action is rendered in the UI as a confirm-and-execute card — it is NEVER auto-executed. Only propose actions that map to types in the enum. Be specific in summary so Jayden knows exactly what will happen.",
    input_schema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: [
            "create_task",
            "snooze_attention",
            "send_review_request",
            "mark_appointment_complete",
            "update_service_price",
            "navigate_to",
            "copy_text",
            "draft_customer_message",
            "open_appointment",
            "open_customer",
          ],
          description: "The kind of action.",
        },
        label: {
          type: "string",
          description: "Short button label, e.g. 'Create task', 'Snooze 1 day', 'Open customer'.",
        },
        summary: {
          type: "string",
          description: "One-line description of what will happen if approved.",
        },
        confirmText: {
          type: "string",
          description: "Optional warning text shown before the user confirms (use for destructive or one-way actions).",
        },
        destructive: {
          type: "boolean",
          description: "Set true for irreversible / money-touching actions so the UI styles the button as destructive.",
        },
        payload: {
          type: "object",
          description:
            "Action-specific payload. Shapes by type: " +
            "create_task: { title, priority?, dueDate?, notes? }; " +
            "snooze_attention: { attentionItemId, durationMs }; " +
            "send_review_request: { appointmentId, method? }; " +
            "mark_appointment_complete: { appointmentId, finalPriceCents? }; " +
            "update_service_price: { serviceId, priceLow, priceHigh }; " +
            "navigate_to: { url }; " +
            "copy_text: { text, label? }; " +
            "draft_customer_message: { customerId, intent (rebook|thank_you|checkin) }; " +
            "open_appointment: { appointmentId }; " +
            "open_customer: { customerId }.",
        },
      },
      required: ["type", "label", "summary", "payload"],
    },
  },
];

/* ─────────────────────────────────────────────
   System prompt
───────────────────────────────────────────── */

const SYSTEM_PROMPT = `You are Iris — the intelligence layer + AI assistant for Jayden's Mobile Detailing, a mobile auto detailing business operating in Vancouver, WA / Portland, OR. You are the central operating brain of the app: you know the business end-to-end, you make suggestions, and you can propose actions the user approves.

Your role: Answer business questions grounded in the real data in the <business_context> tag. Use tools for external info (web, weather). When the user might want you to DO something, call the propose_action tool one or more times — never describe an action without proposing it.

Context-awareness:
- The <page_context> tag tells you which page the user is currently on and what they're focused on (e.g. a specific customer, a calculator quote, a calendar day). Anchor your answer to that context. If they ask "what should I do?", interpret it relative to the page.
- If they're on a customer's detail page, default to talking about that customer.
- If they're on the calculator with a service+vehicle-size selected, default to pricing/quote framing.

Rules:
- Answer ONLY from facts in <business_context> OR from tool call results. Never invent revenue, customer counts, or statistics.
- If you don't have enough data, say so plainly and (when relevant) propose a navigate_to or open_customer action so they can see the underlying data.
- When you use external sources, cite them.
- Be concise (≤180 words for prose). Direct, no-fluff, automotive-shop tone. Lead with the answer — don't open with "I" or your own name.
- Money in the bundle is cents — convert to dollars for display (divide by 100).
- Dates/times are America/Los_Angeles.
- Be PROACTIVE with suggestions: if you spot something useful in <business_context> related to the question (overdue rebooks, pricing drift, attention items, rain risk on an upcoming job), surface it briefly even if not asked.
- Propose actions liberally when the user signals intent ("remind me to…", "snooze this", "should I reach out to X?", "raise my Sedan price"). Each proposed action shows up as an approve-or-dismiss card; the user is always in control.`;

/* ─────────────────────────────────────────────
   Server
───────────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  // Check if enabled.
  const enabled = (Deno.env.get("AI_ASSISTANT_ENABLED") ?? "true").toLowerCase() !== "false";
  if (!enabled) {
    return jsonResponse({ error: "not_configured" }, 503);
  }

  // Require Anthropic API key.
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "not_configured" }, 503);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const model = Deno.env.get("AI_ASSISTANT_MODEL") ?? "claude-sonnet-4-6";
  const maxTokens = parseInt(Deno.env.get("AI_ASSISTANT_MAX_TOKENS") ?? "1500", 10);

  // Admin auth.
  const authHeader = req.headers.get("Authorization");
  const auth = await verifyAdmin(authHeader);
  if (!auth.ok) {
    return jsonResponse({ error: "unauthorized", reason: auth.reason }, 401);
  }

  // Check body size.
  const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
  if (contentLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: "payload_too_large" }, 400);
  }

  // Parse body.
  let body: RequestBody;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) {
      return jsonResponse({ error: "payload_too_large" }, 400);
    }
    body = JSON.parse(text);
  } catch {
    return jsonResponse({ error: "bad_json" }, 400);
  }

  const query = (body.query ?? "").trim();
  if (!query) {
    return jsonResponse({ error: "empty_query" }, 400);
  }

  // Build the user message with embedded business context + page context.
  const contextJson = body.context ? JSON.stringify(body.context) : "{}";
  const pageContextJson = body.pageContext ? JSON.stringify(body.pageContext) : "null";
  const userMessage =
    `${query}\n\n<page_context>\n${pageContextJson}\n</page_context>\n\n` +
    `<business_context>\n${contextJson}\n</business_context>`;

  // Accumulated citations from all search_web calls + proposed actions.
  const allCitations: ExternalSourceCitation[] = [];
  const allProposedActions: ProposedAction[] = [];

  // Message history — starts with the user turn.
  const messages: AnthropicMessage[] = [
    { role: "user", content: userMessage },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let finalText = "";
  let responseModel = model;

  // Agentic loop — up to MAX_TOOL_ITERATIONS.
  for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
    let apiRes: Response;
    try {
      apiRes = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: SYSTEM_PROMPT,
          tools: MODEL_TOOLS,
          messages,
        }),
      });
    } catch (err) {
      console.error("[ai-assistant] Anthropic fetch error:", err instanceof Error ? err.message : err);
      return jsonResponse({ error: "provider_failed", message: "Network error calling Anthropic API" }, 502);
    }

    if (!apiRes.ok) {
      const errText = await apiRes.text().catch(() => "");
      console.error("[ai-assistant] Anthropic error:", apiRes.status, errText.slice(0, 300));
      // Sanitize: never return raw API error which might contain context data.
      const sanitizedMsg = `Anthropic API returned HTTP ${apiRes.status}`;
      return jsonResponse({ error: "provider_failed", message: sanitizedMsg }, 502);
    }

    let anthropicResp: AnthropicApiResponse;
    try {
      anthropicResp = await apiRes.json();
    } catch {
      return jsonResponse({ error: "provider_failed", message: "Invalid JSON from Anthropic" }, 502);
    }

    totalInputTokens += anthropicResp.usage?.input_tokens ?? 0;
    totalOutputTokens += anthropicResp.usage?.output_tokens ?? 0;
    responseModel = anthropicResp.model ?? model;

    // Append assistant's response to the message history.
    messages.push({ role: "assistant", content: anthropicResp.content });

    // If the model is done, extract the final text and exit.
    if (anthropicResp.stop_reason === "end_turn" || anthropicResp.stop_reason === "max_tokens") {
      // Extract text blocks.
      for (const block of anthropicResp.content) {
        if (block.type === "text" && typeof block.text === "string") {
          finalText += block.text;
        }
      }
      break;
    }

    // Handle tool_use.
    if (anthropicResp.stop_reason === "tool_use") {
      const toolUseBlocks = anthropicResp.content.filter(
        (b): b is AnthropicToolUse => b.type === "tool_use",
      );

      const toolResults: AnthropicToolResult[] = [];

      for (const toolUse of toolUseBlocks) {
        let resultContent: string;
        let isError = false;

        try {
          if (toolUse.name === "search_web") {
            const searchQuery = String(toolUse.input.query ?? "");
            const recency = toolUse.input.recency ? String(toolUse.input.recency) : undefined;
            const { result, citations } = await dispatchSearchWeb(
              searchQuery,
              recency,
              supabaseUrl,
              authHeader ?? "",
            );
            allCitations.push(...citations);
            resultContent = JSON.stringify(result);
          } else if (toolUse.name === "get_weather") {
            const weatherData = await dispatchGetWeather(supabaseUrl, authHeader ?? "");
            resultContent = JSON.stringify(weatherData);
          } else if (toolUse.name === "propose_action") {
            const input = toolUse.input as Record<string, unknown>;
            const proposed: ProposedAction = {
              id: `iris_${crypto.randomUUID()}`,
              type: String(input.type ?? ""),
              label: String(input.label ?? "Approve"),
              summary: String(input.summary ?? ""),
              confirmText: input.confirmText ? String(input.confirmText) : undefined,
              destructive: Boolean(input.destructive),
              payload: (input.payload && typeof input.payload === "object")
                ? (input.payload as Record<string, unknown>)
                : {},
            };
            allProposedActions.push(proposed);
            resultContent = JSON.stringify({
              ok: true,
              proposed_id: proposed.id,
              note: "Proposal recorded — the user will see it as a confirm card after your final text reply.",
            });
          } else {
            resultContent = JSON.stringify({ error: "unknown_tool", name: toolUse.name });
            isError = true;
          }
        } catch (err) {
          console.error("[ai-assistant] tool dispatch error:", toolUse.name, err instanceof Error ? err.message : err);
          resultContent = JSON.stringify({ error: err instanceof Error ? err.message : "tool_failed" });
          isError = true;
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: resultContent,
          ...(isError ? { is_error: true } : {}),
        });
      }

      // Append tool results as a user message and continue the loop.
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    // Unexpected stop reason — extract what text we have and break.
    for (const block of anthropicResp.content) {
      if (block.type === "text" && typeof block.text === "string") {
        finalText += block.text;
      }
    }
    break;
  }

  return jsonResponse({
    text: finalText.trim(),
    citations: allCitations,
    proposedActions: allProposedActions,
    usage: {
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
    },
    model: responseModel,
  });
});
