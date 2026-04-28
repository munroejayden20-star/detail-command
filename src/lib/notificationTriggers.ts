/**
 * Notification trigger engine.
 *
 * Runs client-side: scans the local data state for events that should produce
 * a notification (job in 1 hour, follow-up due, missing after-photos, etc.)
 * and inserts new rows via the API. Idempotent — uses deterministic IDs so
 * the same trigger doesn't double-fire.
 *
 * Caveat: only runs while the app is open. True "wake the phone up at 7am"
 * notifications require a server cron — that's Phase 5d.
 */
import { addMinutes, parseISO } from "date-fns";
import type {
  AppData,
  Notification,
  NotificationType,
  Settings,
} from "./types";
import { DEFAULT_NOTIFICATION_PREFS } from "./starter";

interface PendingNotification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  linkUrl?: string;
  metadata?: Record<string, unknown>;
}

/** Deterministic ID so re-running the engine doesn't create duplicates. */
function triggerId(type: NotificationType, key: string): string {
  return `trig_${type}_${key}`;
}

function prefsFromSettings(s: Settings) {
  return {
    enabled: s.notificationsEnabled ?? DEFAULT_NOTIFICATION_PREFS.notificationsEnabled,
    appointments: s.notifyAppointments ?? DEFAULT_NOTIFICATION_PREFS.notifyAppointments,
    payments: s.notifyPayments ?? DEFAULT_NOTIFICATION_PREFS.notifyPayments,
    followUps: s.notifyFollowUps ?? DEFAULT_NOTIFICATION_PREFS.notifyFollowUps,
    reviews: s.notifyReviews ?? DEFAULT_NOTIFICATION_PREFS.notifyReviews,
    weather: s.notifyWeather ?? DEFAULT_NOTIFICATION_PREFS.notifyWeather,
    updates: s.notifyUpdates ?? DEFAULT_NOTIFICATION_PREFS.notifyUpdates,
    reminderMinutes: s.reminderMinutes ?? DEFAULT_NOTIFICATION_PREFS.reminderMinutes,
  };
}

/**
 * Derives every notification that *should* exist right now based on the data.
 * The caller compares this list against what's already in the DB and inserts
 * the new ones.
 */
export function deriveTriggeredNotifications(data: AppData): PendingNotification[] {
  const out: PendingNotification[] = [];
  const prefs = prefsFromSettings(data.settings);
  if (!prefs.enabled) return out;

  const now = new Date();

  /* ---------- Appointments ---------- */
  if (prefs.appointments) {
    for (const a of data.appointments) {
      const start = parseISO(a.start);
      const minutesUntil = (start.getTime() - now.getTime()) / 60000;
      const customer = data.customers.find((c) => c.id === a.customerId);
      const customerName = customer?.name ?? "Customer";

      // "Soon" notification — fires within reminderMinutes window
      if (
        minutesUntil > 0 &&
        minutesUntil <= prefs.reminderMinutes &&
        a.status !== "completed" &&
        a.status !== "canceled"
      ) {
        // Bucket by reminder window so re-running doesn't duplicate
        const bucket = Math.ceil(minutesUntil / 5) * 5;
        out.push({
          id: triggerId("appointment_soon", `${a.id}_${bucket}`),
          type: "appointment_soon",
          title: `${customerName} in ${Math.round(minutesUntil)} min`,
          message: `${a.address || "On-site"}`,
          linkUrl: `/calendar`,
          metadata: { appointmentId: a.id },
        });
      }

      // Needs-confirm — within 48h, still scheduled or inquiry
      const hoursUntil = minutesUntil / 60;
      if (
        hoursUntil > 0 &&
        hoursUntil < 48 &&
        (a.status === "scheduled" || a.status === "inquiry")
      ) {
        out.push({
          id: triggerId("appointment_needs_confirm", a.id),
          type: "appointment_needs_confirm",
          title: `Confirm ${customerName}`,
          message: `Job in ${Math.round(hoursUntil)} h is still ${a.status}`,
          linkUrl: `/`,
          metadata: { appointmentId: a.id },
        });
      }
    }
  }

  /* ---------- Payments ---------- */
  if (prefs.payments) {
    for (const a of data.appointments) {
      if (a.status === "completed" && a.paymentStatus === "unpaid") {
        const start = parseISO(a.start);
        // Only flag if completed >24h ago
        if (addMinutes(start, 24 * 60).getTime() < now.getTime()) {
          const customer = data.customers.find((c) => c.id === a.customerId);
          out.push({
            id: triggerId("appointment_missing_payment", a.id),
            type: "appointment_missing_payment",
            title: `Unpaid: ${customer?.name ?? "Customer"}`,
            message: `Job completed but payment isn't logged.`,
            linkUrl: `/calendar`,
            metadata: { appointmentId: a.id },
          });
        }
      }
    }
  }

  /* ---------- Follow-ups ---------- */
  if (prefs.followUps) {
    for (const l of data.leads) {
      if (l.followUpDate && l.status !== "booked" && l.status !== "lost") {
        const due = parseISO(l.followUpDate);
        if (due.getTime() <= now.getTime()) {
          out.push({
            id: triggerId(
              "follow_up_due",
              `${l.id}_${due.toISOString().slice(0, 10)}`
            ),
            type: "follow_up_due",
            title: `Follow up with ${l.name}`,
            message: l.notes?.slice(0, 80),
            linkUrl: `/leads`,
            metadata: { leadId: l.id },
          });
        }
      }
    }
  }

  /* ---------- Reviews ---------- */
  if (prefs.reviews) {
    for (const a of data.appointments) {
      if (a.status === "completed") {
        const completedAt = parseISO(a.start);
        const hoursSince =
          (now.getTime() - completedAt.getTime()) / (60 * 60 * 1000);
        if (hoursSince > 2 && hoursSince < 72) {
          const customer = data.customers.find((c) => c.id === a.customerId);
          out.push({
            id: triggerId("review_due", a.id),
            type: "review_due",
            title: `Ask ${customer?.name ?? "customer"} for a review`,
            message: `Job completed ${Math.round(hoursSince)}h ago.`,
            linkUrl: `/customers/${a.customerId}`,
            metadata: { appointmentId: a.id, customerId: a.customerId },
          });
        }
      }
    }
  }

  /* ---------- Tasks ---------- */
  if (prefs.appointments /* tasks share the same toggle as job-side reminders */) {
    for (const t of data.tasks) {
      if (t.completed || !t.dueDate) continue;
      const due = parseISO(t.dueDate);
      if (due.getTime() <= now.getTime()) {
        out.push({
          id: triggerId("task_due", `${t.id}_${due.toISOString().slice(0, 10)}`),
          type: "task_due",
          title: `Task due: ${t.title}`,
          linkUrl: `/tasks`,
          metadata: { taskId: t.id },
        });
      }
    }
  }

  /* ---------- Photos / checklists after a job ---------- */
  if (prefs.appointments) {
    for (const a of data.appointments) {
      if (a.status !== "completed") continue;
      const photos = (data.photos ?? []).filter(
        (p) => p.appointmentId === a.id || (p.customerId === a.customerId && parseISO(p.createdAt).getTime() >= parseISO(a.start).getTime())
      );
      const hasBefore = photos.some((p) => p.type === "before");
      const hasAfter = photos.some((p) => p.type === "after");
      const customer = data.customers.find((c) => c.id === a.customerId);
      if (!hasBefore) {
        out.push({
          id: triggerId("missing_before_photos", a.id),
          type: "missing_before_photos",
          title: `Missing before photos: ${customer?.name ?? "Customer"}`,
          linkUrl: `/customers/${a.customerId}`,
          metadata: { appointmentId: a.id },
        });
      }
      if (!hasAfter) {
        out.push({
          id: triggerId("missing_after_photos", a.id),
          type: "missing_after_photos",
          title: `Missing after photos: ${customer?.name ?? "Customer"}`,
          linkUrl: `/customers/${a.customerId}`,
          metadata: { appointmentId: a.id },
        });
      }
    }
  }

  return out;
}

/**
 * Build a Notification ready for insertion. Caller still chooses whether to
 * actually insert (de-duping against existing DB rows).
 */
export function pendingToNotification(p: PendingNotification): Notification {
  return {
    id: p.id,
    type: p.type,
    title: p.title,
    message: p.message,
    linkUrl: p.linkUrl,
    metadata: p.metadata,
    read: false,
    createdAt: new Date().toISOString(),
  };
}
