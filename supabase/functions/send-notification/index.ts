/**
 * send-notification — fires web push (and, when configured, SMS) for any
 * notification row inserted into public.notifications.
 *
 * Invocation: configured as a Supabase Database Webhook on the notifications
 * table (INSERT events). Payload shape (Supabase webhook):
 *
 *   {
 *     "type": "INSERT",
 *     "table": "notifications",
 *     "schema": "public",
 *     "record": { id, user_id, type, title, message, link_url, metadata, ... }
 *   }
 *
 * Required Supabase function secrets:
 *   VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *   VAPID_SUBJECT             (e.g. "mailto:you@example.com")
 *   SUPABASE_URL              (auto)
 *   SUPABASE_SERVICE_ROLE_KEY (auto)
 *
 * Optional (SMS — leave unset to keep SMS off):
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *   TWILIO_FROM_NUMBER
 *
 * Deploy with:
 *   supabase functions deploy send-notification
 */
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

interface NotificationRecord {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message?: string | null;
  link_url?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: NotificationRecord;
  old_record?: NotificationRecord;
}

// Notification types that should NOT wake up the phone — they're informational
// only and would be too noisy as push.
const SUPPRESSED_TYPES = new Set<string>([
  // Add types here if you want to silence specific ones
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@example.com";

  if (!supabaseUrl || !serviceKey) {
    console.error("[send-notification] missing Supabase env");
    return new Response("misconfigured", { status: 500 });
  }
  if (!vapidPublic || !vapidPrivate) {
    console.warn(
      "[send-notification] VAPID keys missing — push will be skipped. Set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY function secrets.",
    );
  } else {
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  }

  let body: WebhookPayload;
  try {
    body = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }

  if (body.type !== "INSERT" || body.table !== "notifications" || !body.record) {
    return new Response(JSON.stringify({ skipped: "not an insert on notifications" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const n = body.record;
  if (SUPPRESSED_TYPES.has(n.type)) {
    return new Response(JSON.stringify({ skipped: "type suppressed" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const sb = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Load the user's settings (do they want push? sms?)
  const { data: settings } = await sb
    .from("settings")
    .select("push_notifications_enabled, sms_enabled, sms_phone_number, notifications_enabled")
    .eq("user_id", n.user_id)
    .maybeSingle();

  // Master toggle
  if (settings && settings.notifications_enabled === false) {
    return new Response(JSON.stringify({ skipped: "notifications disabled" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const result: Record<string, unknown> = { notification: n.id };

  /* ---------- Web Push ---------- */
  if (settings?.push_notifications_enabled !== false && vapidPublic && vapidPrivate) {
    const { data: subs, error } = await sb
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", n.user_id);

    if (error) {
      console.error("[send-notification] failed to load subs:", error);
    } else if (subs && subs.length > 0) {
      const payload = JSON.stringify({
        title: n.title,
        message: n.message ?? "",
        linkUrl: n.link_url ?? "/",
        tag: n.type, // dedupe — same type replaces older
        notificationId: n.id,
      });

      const sent: string[] = [];
      const dead: string[] = [];

      await Promise.all(
        subs.map(async (s) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: s.endpoint,
                keys: { p256dh: s.p256dh, auth: s.auth },
              },
              payload,
              { TTL: 60 * 60 * 24 }, // 1 day max
            );
            sent.push(s.id);
          } catch (err: unknown) {
            const status = (err as { statusCode?: number })?.statusCode;
            if (status === 404 || status === 410) {
              // subscription is gone — clean up
              dead.push(s.id);
            } else {
              console.error("[send-notification] push failed:", err);
            }
          }
        }),
      );

      if (dead.length > 0) {
        await sb.from("push_subscriptions").delete().in("id", dead);
      }
      result.pushSent = sent.length;
      result.pushDead = dead.length;
    } else {
      result.pushSent = 0;
    }
  }

  /* ---------- SMS (scaffold) ---------- */
  if (settings?.sms_enabled && settings.sms_phone_number) {
    const sid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const token = Deno.env.get("TWILIO_AUTH_TOKEN");
    const from = Deno.env.get("TWILIO_FROM_NUMBER");

    if (!sid || !token || !from) {
      result.smsSkipped = "Twilio secrets not configured";
    } else {
      try {
        const smsBody = [n.title, n.message].filter(Boolean).join(" — ").slice(0, 320);
        const auth = btoa(`${sid}:${token}`);
        const form = new URLSearchParams({
          From: from,
          To: settings.sms_phone_number,
          Body: smsBody,
        });
        const resp = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
          {
            method: "POST",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: form.toString(),
          },
        );
        if (!resp.ok) {
          const txt = await resp.text();
          console.error("[send-notification] twilio failed:", resp.status, txt);
          result.smsError = `${resp.status}`;
        } else {
          result.smsSent = true;
        }
      } catch (err) {
        console.error("[send-notification] twilio threw:", err);
        result.smsError = String(err);
      }
    }
  }

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  });
});
