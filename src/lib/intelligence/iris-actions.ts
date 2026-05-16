/**
 * Iris actions — the bridge between Iris's proposals and the rest of the app.
 *
 * Flow:
 *   1. The AI assistant edge function emits one or more `ProposedAction` entries
 *      in its response (via the server-side `propose_action` tool).
 *   2. The IrisDock / IrisPanel renders each as a confirm-and-execute card.
 *   3. On approve, the browser calls `executeIrisAction(...)` which dispatches
 *      to store actions, navigation, clipboard, etc., and logs to the
 *      `iris_actions` audit table for after-the-fact review.
 *
 * Iris NEVER executes a write action without the user's explicit approval.
 * Read-only proposals (`navigate_to`, `copy_text`, `open_dialog`) are still
 * proposals so the user opts in.
 */
import type { AppData, Appointment, Task } from "@/lib/types";
import type { CommitResult } from "@/store/store";
import { getSupabase } from "@/lib/supabase";
import { uid } from "@/lib/utils";
import { draftFollowUpMessage } from "./customer-intelligence";

/* ─────────────────────────────────────────────
   Action types — keep payload shape tight + serializable
───────────────────────────────────────────── */

export type IrisActionType =
  | "create_task"
  | "snooze_attention"
  | "send_review_request"
  | "mark_appointment_complete"
  | "update_service_price"
  | "navigate_to"
  | "copy_text"
  | "draft_customer_message"
  | "open_appointment"
  | "open_customer";

export interface IrisActionBase<T extends IrisActionType, P> {
  /** Stable id Iris assigns so the UI can de-dupe. */
  id: string;
  type: T;
  /** Human label rendered on the approve button. */
  label: string;
  /** One-line description of what will happen. */
  summary: string;
  /** Optional pre-execution warning text (destructive / one-way actions). */
  confirmText?: string;
  /** Marks the proposal as destructive — UI styles approve button rose. */
  destructive?: boolean;
  payload: P;
}

export type ProposedAction =
  | IrisActionBase<"create_task", { title: string; priority?: "low" | "medium" | "high"; dueDate?: string; notes?: string }>
  | IrisActionBase<"snooze_attention", { attentionItemId: string; durationMs: number }>
  | IrisActionBase<"send_review_request", { appointmentId: string; method?: "copy" | "sms" | "email" }>
  | IrisActionBase<"mark_appointment_complete", { appointmentId: string; finalPriceCents?: number }>
  | IrisActionBase<"update_service_price", { serviceId: string; priceLow: number; priceHigh: number }>
  | IrisActionBase<"navigate_to", { url: string }>
  | IrisActionBase<"copy_text", { text: string; label?: string }>
  | IrisActionBase<"draft_customer_message", { customerId: string; intent: "rebook" | "thank_you" | "checkin" }>
  | IrisActionBase<"open_appointment", { appointmentId: string }>
  | IrisActionBase<"open_customer", { customerId: string }>;

/* ─────────────────────────────────────────────
   Result + executor context
───────────────────────────────────────────── */

export type IrisActionResult =
  | { ok: true; summary: string }
  | { ok: false; reason: string };

export interface IrisActionContext {
  data: AppData;
  /** From useStore — used for optimistic adds. */
  dispatch: (action: any) => void;
  /** From useStore — used for money-touching writes. */
  commit: (action: any) => Promise<CommitResult>;
  /** From react-router useNavigate(). */
  navigate: (url: string) => void;
  /** From sonner toast. */
  toast: { success: (m: string) => void; error: (m: string) => void; info: (m: string) => void };
  /** Optional callback to open the appointment dialog with a given id (set by Layout). */
  openAppointmentDialog?: (appointmentId: string) => void;
}

/* ─────────────────────────────────────────────
   Audit log — best-effort; failure to log never blocks execution
───────────────────────────────────────────── */

async function logAction(
  action: ProposedAction,
  result: IrisActionResult,
): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  try {
    const { data: userData } = await sb.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return;
    await sb.from("iris_actions").insert({
      id: uid(),
      user_id: userId,
      action_type: action.type,
      payload: action.payload as unknown as Record<string, unknown>,
      label: action.label,
      summary: action.summary,
      status: result.ok ? "executed" : "failed",
      result_summary: result.ok ? result.summary : result.reason,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[iris-actions] audit log failed (non-fatal):", err);
  }
}

/* ─────────────────────────────────────────────
   Executor
───────────────────────────────────────────── */

export async function executeIrisAction(
  action: ProposedAction,
  ctx: IrisActionContext,
): Promise<IrisActionResult> {
  let result: IrisActionResult;

  try {
    switch (action.type) {
      case "create_task": {
        const { title, priority = "medium", dueDate, notes } = action.payload;
        const task: Task = {
          id: uid(),
          title,
          category: "general",
          completed: false,
          priority,
          dueDate,
          notes,
          createdAt: new Date().toISOString(),
        };
        ctx.dispatch({ type: "addTask", task });
        ctx.toast.success(`Task created: ${title}`);
        result = { ok: true, summary: `Task "${title}" added.` };
        break;
      }

      case "snooze_attention": {
        const { attentionItemId, durationMs } = action.payload;
        const KEY = "detail-command:attention-state:v1";
        try {
          const raw = window.localStorage.getItem(KEY);
          const state = raw
            ? (JSON.parse(raw) as { snoozedUntil: Record<string, string>; dismissedAt: Record<string, string> })
            : { snoozedUntil: {}, dismissedAt: {} };
          state.snoozedUntil[attentionItemId] = new Date(Date.now() + durationMs).toISOString();
          window.localStorage.setItem(KEY, JSON.stringify(state));
          window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
          ctx.toast.success("Snoozed.");
          result = { ok: true, summary: `Snoozed ${attentionItemId} for ${Math.round(durationMs / 3_600_000)}h.` };
        } catch (e) {
          result = { ok: false, reason: `Snooze failed: ${e instanceof Error ? e.message : String(e)}` };
        }
        break;
      }

      case "send_review_request": {
        const { appointmentId, method = "copy" } = action.payload;
        const appt = ctx.data.appointments.find((a) => a.id === appointmentId);
        if (!appt) {
          result = { ok: false, reason: "Appointment not found." };
          break;
        }
        // Mark sent — same shape ReviewRequestPrompt uses.
        const methodMapped: "sms" | "email" | "copied" | "manual" =
          method === "sms" ? "sms" : method === "email" ? "email" : "copied";
        const patch: Partial<Appointment> = {
          reviewRequestSent: true,
          reviewRequestSentAt: new Date().toISOString(),
          reviewRequestMethod: methodMapped,
        };
        const r = await ctx.commit({ type: "updateAppointment", id: appointmentId, patch });
        if (!r.ok) {
          result = { ok: false, reason: r.error?.message ?? "Save failed." };
          break;
        }
        ctx.toast.success("Marked review request as sent.");
        result = { ok: true, summary: `Review request marked sent for appointment ${appointmentId}.` };
        break;
      }

      case "mark_appointment_complete": {
        const { appointmentId, finalPriceCents } = action.payload;
        const appt = ctx.data.appointments.find((a) => a.id === appointmentId);
        if (!appt) {
          result = { ok: false, reason: "Appointment not found." };
          break;
        }
        const patch: Partial<Appointment> = {
          status: "completed",
          actualEndAt: appt.actualEndAt ?? new Date().toISOString(),
        } as Partial<Appointment>;
        if (typeof finalPriceCents === "number") {
          (patch as { finalPriceCents?: number }).finalPriceCents = finalPriceCents;
          (patch as { finalPrice?: number }).finalPrice = finalPriceCents / 100;
        }
        const r = await ctx.commit({ type: "updateAppointment", id: appointmentId, patch });
        if (!r.ok) {
          result = { ok: false, reason: r.error?.message ?? "Save failed." };
          break;
        }
        ctx.toast.success("Marked complete.");
        result = { ok: true, summary: `Appointment ${appointmentId} marked complete.` };
        break;
      }

      case "update_service_price": {
        const { serviceId, priceLow, priceHigh } = action.payload;
        const service = ctx.data.services.find((s) => s.id === serviceId);
        if (!service) {
          result = { ok: false, reason: "Service not found." };
          break;
        }
        const r = await ctx.commit({
          type: "updateService",
          id: serviceId,
          patch: { priceLow, priceHigh },
        });
        if (!r.ok) {
          result = { ok: false, reason: r.error?.message ?? "Save failed." };
          break;
        }
        ctx.toast.success(`${service.name} price updated.`);
        result = { ok: true, summary: `Updated ${service.name} to $${priceLow}–$${priceHigh}.` };
        break;
      }

      case "navigate_to": {
        ctx.navigate(action.payload.url);
        result = { ok: true, summary: `Navigated to ${action.payload.url}.` };
        break;
      }

      case "copy_text": {
        const { text, label } = action.payload;
        await navigator.clipboard.writeText(text);
        ctx.toast.success(label ? `${label} copied.` : "Copied to clipboard.");
        result = { ok: true, summary: `Copied ${text.length} chars.` };
        break;
      }

      case "draft_customer_message": {
        const { customerId, intent } = action.payload;
        const draft = draftFollowUpMessage(ctx.data, customerId, intent);
        if (!draft) {
          result = { ok: false, reason: "Customer not found." };
          break;
        }
        const composed = `Subject: ${draft.subject}\n\n${draft.body}`;
        await navigator.clipboard.writeText(composed);
        ctx.toast.success("Draft copied to clipboard.");
        result = { ok: true, summary: `Drafted ${intent} message for ${customerId}.` };
        break;
      }

      case "open_appointment": {
        const { appointmentId } = action.payload;
        if (ctx.openAppointmentDialog) {
          ctx.openAppointmentDialog(appointmentId);
          result = { ok: true, summary: `Opened appointment ${appointmentId}.` };
        } else {
          ctx.navigate(`/calendar?appointment=${appointmentId}`);
          result = { ok: true, summary: `Navigated to calendar.` };
        }
        break;
      }

      case "open_customer": {
        const { customerId } = action.payload;
        ctx.navigate(`/customers/${customerId}`);
        result = { ok: true, summary: `Opened customer ${customerId}.` };
        break;
      }

      default: {
        // Exhaustiveness — narrow `never`.
        const _exhaustive: never = action;
        void _exhaustive;
        result = { ok: false, reason: "Unknown action type." };
      }
    }
  } catch (err) {
    result = { ok: false, reason: err instanceof Error ? err.message : "unknown_error" };
    ctx.toast.error(`Iris action failed: ${result.reason}`);
  }

  void logAction(action, result);
  return result;
}
