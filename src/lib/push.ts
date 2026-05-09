/**
 * Web Push subscription helpers.
 *
 * Flow:
 *   1. User toggles "Phone notifications" ON in Settings.
 *   2. We request browser permission.
 *   3. We call serviceWorker.pushManager.subscribe(...) with the VAPID public key.
 *   4. We persist the resulting PushSubscription to the push_subscriptions table.
 *
 * The edge function (send-notification) reads from that table and dispatches
 * encrypted pushes whenever a row lands in the notifications table.
 *
 * iOS note: web push only works for installed PWAs on iOS 16.4+. The user must
 * "Add to Home Screen" first, then open the installed app, then toggle on.
 */
import { requireSupabase } from "./supabase";

export const VAPID_PUBLIC_KEY: string | undefined =
  import.meta.env.VITE_VAPID_PUBLIC_KEY;

export interface PushSupportInfo {
  supported: boolean;
  reason?: string;
  isStandalone: boolean;
  isIos: boolean;
  permission: NotificationPermission | "unsupported";
}

/** What we know about this device's ability to receive push. */
export function getPushSupport(): PushSupportInfo {
  if (typeof window === "undefined") {
    return { supported: false, reason: "No window", isStandalone: false, isIos: false, permission: "unsupported" };
  }
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari uses a non-standard property
    (navigator as unknown as { standalone?: boolean }).standalone === true;

  if (!("serviceWorker" in navigator)) {
    return {
      supported: false,
      reason: "Service workers aren't supported in this browser.",
      isStandalone,
      isIos,
      permission: "unsupported",
    };
  }
  if (!("PushManager" in window)) {
    return {
      supported: false,
      reason: "Push isn't supported in this browser.",
      isStandalone,
      isIos,
      permission: "unsupported",
    };
  }
  if (!("Notification" in window)) {
    return {
      supported: false,
      reason: "Notifications aren't supported in this browser.",
      isStandalone,
      isIos,
      permission: "unsupported",
    };
  }
  if (isIos && !isStandalone) {
    return {
      supported: false,
      reason:
        "On iPhone, push only works after you 'Add to Home Screen' (Share button → Add to Home Screen) and open the installed app.",
      isStandalone,
      isIos,
      permission: Notification.permission,
    };
  }
  if (!VAPID_PUBLIC_KEY) {
    return {
      supported: false,
      reason: "Server isn't configured for push (missing VAPID public key).",
      isStandalone,
      isIos,
      permission: Notification.permission,
    };
  }
  return {
    supported: true,
    isStandalone,
    isIos,
    permission: Notification.permission,
  };
}

/** Convert a base64url string to a Uint8Array (required by pushManager.subscribe). */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  // Wait for SW to be ready (registered + activated)
  const reg = await navigator.serviceWorker.ready;
  return reg;
}

/**
 * Subscribe this device to web push and persist to Supabase.
 * Returns true on success, false if the user denied permission.
 * Throws on other unexpected errors.
 */
export async function subscribeToPush(userId: string): Promise<boolean> {
  const support = getPushSupport();
  if (!support.supported) {
    throw new Error(support.reason ?? "Push not supported on this device.");
  }
  if (!VAPID_PUBLIC_KEY) {
    throw new Error("Missing VITE_VAPID_PUBLIC_KEY — see supabase/phase_e_push_notifications.sql for setup.");
  }

  // 1. Permission
  let perm = Notification.permission;
  if (perm === "default") perm = await Notification.requestPermission();
  if (perm !== "granted") return false;

  // 2. Subscribe via the service worker's PushManager
  const reg = await getRegistration();
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      // Cast — pushManager wants a BufferSource backed by ArrayBuffer; our
      // helper returns a fresh Uint8Array which is fine at runtime.
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    });
  }

  // 3. Persist the subscription so the server can target this device
  const json = sub.toJSON() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  const endpoint = json.endpoint ?? sub.endpoint;
  // Some browsers (Safari) put base64 directly in keys; others give an ArrayBuffer
  // via getKey. Normalize.
  const p256dh =
    json.keys?.p256dh ??
    arrayBufferToBase64(sub.getKey?.("p256dh") ?? null);
  const auth =
    json.keys?.auth ?? arrayBufferToBase64(sub.getKey?.("auth") ?? null);

  if (!endpoint || !p256dh || !auth) {
    throw new Error("Push subscription is missing endpoint or keys.");
  }

  const sb = requireSupabase();
  // Upsert by endpoint so re-subscribing on the same device updates instead
  // of duplicating.
  const { error } = await sb.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint,
      p256dh,
      auth,
      user_agent: navigator.userAgent.slice(0, 200),
      device_label: deviceLabel(),
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error) throw error;

  return true;
}

/** Best-effort friendly device label like "iPhone — Safari" or "Desktop — Chrome". */
function deviceLabel(): string {
  const ua = navigator.userAgent;
  let device = "Device";
  if (/iPhone/.test(ua)) device = "iPhone";
  else if (/iPad/.test(ua)) device = "iPad";
  else if (/Android/.test(ua)) device = "Android";
  else if (/Mac/.test(ua)) device = "Mac";
  else if (/Windows/.test(ua)) device = "Windows";
  else if (/Linux/.test(ua)) device = "Linux";

  let browser = "Browser";
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Safari\//.test(ua)) browser = "Safari";

  return `${device} — ${browser}`;
}

/** Remove the local subscription and the matching DB row. */
export async function unsubscribeFromPush(userId: string): Promise<void> {
  const sb = requireSupabase();
  if (!("serviceWorker" in navigator)) return;

  const reg = await getRegistration();
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await sb
      .from("push_subscriptions")
      .delete()
      .eq("user_id", userId)
      .eq("endpoint", endpoint);
  }
}

/** Has this device already subscribed (browser-side check, not DB)? */
export async function hasActiveSubscription(): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;
    const sub = await reg.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}
