/**
 * AI assistant — browser-side client for the Phase H7 ai-assistant edge function.
 *
 * Wraps the edge function invocation with the ExternalResult<T> pattern so
 * callers can handle not_configured gracefully without needing a try/catch.
 *
 * The function signature is `askAiAssistant(query, data, contextOptions?)` so
 * the caller passes AppData and this module builds the enriched context bundle
 * internally — the model key never reaches the browser.
 */
import { getSupabase } from "@/lib/supabase";
import type { AppData } from "@/lib/types";
import type { ExternalSourceCitation } from "./types";
import type { ExternalReason } from "./external-intelligence";
import { buildEnrichedContext } from "./ai-context";
import type { AiContextOptions } from "./ai-context";
import type { ProposedAction } from "./iris-actions";
import type { IrisPageContext } from "@/components/iris/PageContext";

/* ─────────────────────────────────────────────
   Types
───────────────────────────────────────────── */

export type AiAssistantReason =
  | "ok"
  | "not_configured"
  | "unauthorized"
  | "rate_limited"
  | "bad_query"
  | "provider_failed"
  | "supabase_unconfigured"
  | "unknown_error";

export interface AiAssistantResponse {
  text: string;
  citations: ExternalSourceCitation[];
  /** Proposed actions Iris wants the user to approve. Empty array when none. */
  proposedActions: ProposedAction[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  model: string;
}

export interface AiAssistantResult {
  ok: boolean;
  reason: AiAssistantReason;
  data?: AiAssistantResponse;
  message?: string;
}

/* ─────────────────────────────────────────────
   Error reason mapping
───────────────────────────────────────────── */

function mapErrorReason(msg: string, body?: { error?: string }): AiAssistantReason {
  const bodyError = body?.error ?? "";
  if (bodyError === "not_configured") return "not_configured";
  if (bodyError === "empty_query" || bodyError === "payload_too_large") return "bad_query";
  if (msg.includes("503") || bodyError.includes("not_configured")) return "not_configured";
  if (msg.includes("429")) return "rate_limited";
  if (msg.includes("401") || msg.includes("403") || bodyError === "unauthorized") return "unauthorized";
  if (msg.includes("400")) return "bad_query";
  if (msg.includes("502") || bodyError === "provider_failed") return "provider_failed";
  return "unknown_error";
}

/* ─────────────────────────────────────────────
   askAiAssistant
───────────────────────────────────────────── */

/**
 * Ask the AI assistant a question grounded in real business data.
 *
 * Builds an EnrichedAiContext from AppData and sends it along with the query
 * to the `ai-assistant` edge function. Returns a structured result so the
 * caller can differentiate between not_configured, provider errors, and
 * successful responses.
 */
export async function askAiAssistant(
  query: string,
  data: AppData,
  contextOptions: AiContextOptions & { pageContext?: IrisPageContext | null } = {},
): Promise<AiAssistantResult> {
  const trimmed = (query ?? "").trim();
  if (!trimmed) return { ok: false, reason: "bad_query", message: "Query is empty." };

  const sb = getSupabase();
  if (!sb) return { ok: false, reason: "supabase_unconfigured" };

  // Build the enriched context bundle.
  const { pageContext, ...ctxOptions } = contextOptions;
  const context = buildEnrichedContext(data, ctxOptions);

  const { data: responseData, error } = await sb.functions.invoke<
    AiAssistantResponse | { error: string }
  >("ai-assistant", {
    body: { query: trimmed, context, pageContext: pageContext ?? null },
  });

  if (error) {
    const msg = error instanceof Error ? error.message : String(error);
    // Try to parse error body from supabase-js FunctionsHttpError.
    let bodyError: { error?: string } | undefined;
    try {
      // supabase-js wraps the body; some versions expose it via .context.
      const context = (error as { context?: unknown }).context;
      if (context && typeof context === "object") {
        bodyError = context as { error?: string };
      }
    } catch {
      // ignore
    }
    const reason = mapErrorReason(msg, bodyError);
    return { ok: false, reason, message: msg };
  }

  if (!responseData || (responseData as { error?: string }).error) {
    const errMsg = (responseData as { error?: string } | null)?.error ?? "no data returned";
    const reason = mapErrorReason(errMsg, responseData as { error?: string });
    return { ok: false, reason, message: errMsg };
  }

  const response = responseData as AiAssistantResponse;
  // Defensive: older edge-function deploys may not include the field yet.
  if (!Array.isArray(response.proposedActions)) {
    response.proposedActions = [];
  }
  return { ok: true, reason: "ok", data: response };
}
