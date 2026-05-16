/**
 * AI tool registry — names and dispatcher for structured tool functions the
 * AI layer calls to retrieve real business data.
 *
 * Phase 7 implements the bodies. Every tool MUST:
 *   - return data sourced from AppData / receipts / external findings
 *   - never invent numbers
 *   - include source attribution when external
 *   - return AiToolResult<T> so the AI layer can fail gracefully
 */
import type { AppData } from "@/lib/types";
import type { AiToolResult, DateRange } from "./types";
import { buildBusinessSnapshot, rebookCandidates } from "./derived-metrics";
import { runAttentionRules } from "./rules";
import { buildWorkloadForecast } from "./forecasts";
import { buildPricingPatterns } from "./pricing-intelligence";
import { customerHighlights, draftFollowUpMessage } from "./customer-intelligence";
import { searchWeb, getWeatherForAppointment } from "./external-intelligence";
import { rangeAllTime, rangeFromDates, findAppointment } from "./data-access";
import { ATTENTION_THRESHOLDS } from "./rules";

/** Tool function name — used by the AI layer's tool-call dispatcher. */
export type AiToolName =
  | "get_business_snapshot"
  | "get_attention_items"
  | "get_customer_summary"
  | "search_customers"
  | "get_appointments"
  | "get_revenue_summary"
  | "get_expense_summary"
  | "get_mileage_summary"
  | "get_service_performance"
  | "get_lead_performance"
  | "get_pricing_patterns"
  | "get_review_request_gaps"
  | "get_rebooking_candidates"
  | "get_quote_vs_final_analysis"
  | "get_workload_forecast"
  | "draft_customer_message"
  | "search_web"
  | "search_news"
  | "get_weather_for_appointment"
  | "get_route_between_appointments"
  | "get_google_calendar_events"
  | "draft_gmail_message"
  | "get_google_business_reviews";

/* ─────────────────────────────────────────────
   Range helper
───────────────────────────────────────────── */

function parseRange(range: unknown): DateRange {
  if (typeof range !== "string") return rangeAllTime();
  const now = new Date();
  switch (range) {
    case "today": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      return rangeFromDates(start, end, "Today");
    }
    case "this_week": {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return rangeFromDates(start, end, "This week");
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return rangeFromDates(start, end, "This month");
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return rangeFromDates(start, end, "Last month");
    }
    case "last_30_days": {
      const start = new Date(now.getTime() - 30 * 86_400_000);
      return rangeFromDates(start, now, "Last 30 days");
    }
    case "last_90_days": {
      const start = new Date(now.getTime() - 90 * 86_400_000);
      return rangeFromDates(start, now, "Last 90 days");
    }
    case "all_time":
    default:
      return rangeAllTime();
  }
}

/* ─────────────────────────────────────────────
   Dispatcher
───────────────────────────────────────────── */

/**
 * Dispatch a tool call from the AI layer. Browser-side tools are called
 * directly; network tools (search_web, get_weather_for_appointment) perform
 * async I/O via the existing edge-function clients.
 *
 * Google-family tools (get_route_between_appointments, get_google_calendar_events,
 * draft_gmail_message, get_google_business_reviews) return not_configured until
 * Phase H5.
 */
export async function dispatchAiTool(
  name: AiToolName,
  args: Record<string, unknown>,
  ctx: { data: AppData },
): Promise<AiToolResult> {
  const { data } = ctx;

  try {
    switch (name) {
      /* ── Internal: business snapshot ──────────────────────── */
      case "get_business_snapshot": {
        const range = parseRange(args.range);
        const now = new Date();
        const attention = runAttentionRules(data, now);
        const snapshot = buildBusinessSnapshot(data, range, attention);
        return { ok: true, data: snapshot };
      }

      /* ── Internal: attention items ────────────────────────── */
      case "get_attention_items": {
        const items = runAttentionRules(data, new Date());
        return { ok: true, data: items };
      }

      /* ── Internal: customer summary ──────────────────────── */
      case "get_customer_summary": {
        const customerId = String(args.customer_id ?? "");
        const h = customerHighlights(data, customerId);
        if (!h) return { ok: false, error: "customer_not_found" };
        return { ok: true, data: h };
      }

      /* ── Internal: customer search ───────────────────────── */
      case "search_customers": {
        const query = String(args.query ?? "").toLowerCase().trim();
        const limit = Math.min(Number(args.limit ?? 5), 20);
        const matches = query
          ? data.customers
              .filter((c) => c.name.toLowerCase().includes(query))
              .slice(0, limit)
              .map((c) => ({ id: c.id, name: c.name }))
          : data.customers.slice(0, limit).map((c) => ({ id: c.id, name: c.name }));
        return { ok: true, data: matches };
      }

      /* ── Internal: appointments ──────────────────────────── */
      case "get_appointments": {
        const statusFilter = args.status ? String(args.status) : undefined;
        const rangeDays = args.range_days ? Number(args.range_days) : undefined;
        let appts = data.appointments;
        if (statusFilter) {
          appts = appts.filter((a) => a.status === statusFilter);
        }
        if (rangeDays) {
          const cutoff = new Date(Date.now() - rangeDays * 86_400_000).toISOString();
          appts = appts.filter((a) => a.start >= cutoff);
        }
        const result = appts.slice(0, 20).map((a) => ({
          id: a.id,
          status: a.status,
          start: a.start,
          customerId: a.customerId,
          estimatedPrice: a.estimatedPrice,
          finalPrice: a.finalPrice,
          finalPriceCents: a.finalPriceCents,
        }));
        return { ok: true, data: result };
      }

      /* ── Internal: revenue summary ───────────────────────── */
      case "get_revenue_summary": {
        const range = parseRange(args.range);
        const now = new Date();
        const snapshot = buildBusinessSnapshot(data, range, runAttentionRules(data, now));
        return {
          ok: true,
          data: {
            range: snapshot.range,
            collectedCents: snapshot.collectedCents,
            outstandingCents: snapshot.outstandingCents,
            estimatedNetProfitCents: snapshot.estimatedNetProfitCents,
            averageTicketCents: snapshot.averageTicketCents,
            appointmentsCompleted: snapshot.appointmentsCompleted,
          },
        };
      }

      /* ── Internal: workload forecast ─────────────────────── */
      case "get_workload_forecast": {
        const rangeDays = args.range_days ? Math.min(Number(args.range_days), 60) : 14;
        const forecast = buildWorkloadForecast(data, rangeDays, new Date());
        return { ok: true, data: forecast };
      }

      /* ── Internal: pricing patterns ──────────────────────── */
      case "get_pricing_patterns": {
        const patterns = buildPricingPatterns(data);
        return { ok: true, data: patterns };
      }

      /* ── Internal: review request gaps ──────────────────── */
      case "get_review_request_gaps": {
        const now = new Date();
        const minHours = ATTENTION_THRESHOLDS.COMPLETED_NO_REVIEW_REQUEST_HOURS;
        const maxDays = ATTENTION_THRESHOLDS.COMPLETED_NO_REVIEW_REQUEST_MAX_DAYS;
        const gaps = data.appointments.filter((a) => {
          if (a.status !== "completed") return false;
          if (a.reviewRequestSent) return false;
          const hoursElapsed = (now.getTime() - new Date(a.start).getTime()) / 3_600_000;
          const daysElapsed = hoursElapsed / 24;
          return hoursElapsed >= minHours && daysElapsed <= maxDays;
        }).map((a) => ({ id: a.id, customerId: a.customerId, start: a.start }));
        return { ok: true, data: gaps };
      }

      /* ── Internal: rebooking candidates ─────────────────── */
      case "get_rebooking_candidates": {
        const candidates = rebookCandidates(data, new Date());
        return {
          ok: true,
          data: candidates.map((p) => ({
            customerId: p.customerId,
            tier: p.tier,
            rebookStatus: p.rebookStatus,
            daysSinceLastService: p.daysSinceLastService,
          })),
        };
      }

      /* ── Internal: quote vs final analysis ──────────────── */
      case "get_quote_vs_final_analysis": {
        const patterns = buildPricingPatterns(data);
        const hasDelta = patterns.filter((p) => Math.abs(p.deltaAvgCents) > 0);
        const totalUnderquotedCents = hasDelta
          .filter((p) => p.deltaAvgCents > 0)
          .reduce((s, p) => s + p.deltaAvgCents * p.sampleSize, 0);
        return {
          ok: true,
          data: {
            patterns,
            totalPatterns: patterns.length,
            underquotingCount: hasDelta.filter((p) => p.deltaAvgCents > 0).length,
            overquotingCount: hasDelta.filter((p) => p.deltaAvgCents < 0).length,
            totalUnderquotedCents,
          },
        };
      }

      /* ── Internal: draft customer message ───────────────── */
      case "draft_customer_message": {
        const customerId = String(args.customer_id ?? "");
        const intent = String(args.intent ?? "rebook") as "rebook" | "thank_you" | "checkin";
        const draft = draftFollowUpMessage(data, customerId, intent);
        if (!draft) return { ok: false, error: "customer_not_found" };
        return { ok: true, data: draft };
      }

      /* ── External: web search ────────────────────────────── */
      case "search_web": {
        const query = String(args.query ?? "").trim();
        if (!query) return { ok: false, error: "empty_query" };
        const result = await searchWeb(query, { recency: args.recency as "fresh" | "any" | undefined });
        if (!result.ok) return { ok: false, error: result.reason };
        return { ok: true, data: result.data };
      }

      /* ── External: news search ───────────────────────────── */
      case "search_news": {
        const query = String(args.query ?? "").trim();
        if (!query) return { ok: false, error: "empty_query" };
        const result = await searchWeb(query, { recency: "fresh" });
        if (!result.ok) return { ok: false, error: result.reason };
        return { ok: true, data: result.data };
      }

      /* ── External: weather for appointment ──────────────── */
      case "get_weather_for_appointment": {
        const appointmentId = String(args.appointment_id ?? "");
        // Validate the appointment exists.
        const appt = findAppointment(data, appointmentId);
        if (!appt) return { ok: false, error: "appointment_not_found" };
        const weather = await getWeatherForAppointment(appointmentId);
        return { ok: true, data: weather };
      }

      /* ── Not yet implemented (planned for later phases) ──── */
      case "get_expense_summary":
      case "get_mileage_summary":
      case "get_service_performance":
      case "get_lead_performance":
        return { ok: false, error: "not_implemented" };

      /* ── Google-family — activate in H5 ─────────────────── */
      case "get_route_between_appointments":
      case "get_google_calendar_events":
      case "draft_gmail_message":
      case "get_google_business_reviews":
        return { ok: false, error: "not_configured" };

      /* ── Unknown ─────────────────────────────────────────── */
      default: {
        const _exhaustiveCheck: never = name;
        void _exhaustiveCheck;
        return { ok: false, error: "unknown_tool" };
      }
    }
  } catch (err) {
    console.error("[ai-tools] tool dispatch error:", name, err instanceof Error ? err.message : err);
    return { ok: false, error: err instanceof Error ? err.message : "unknown_error" };
  }
}
