import { useEffect, useRef } from "react";
import { useStore } from "@/store/store";
import {
  deriveTriggeredNotifications,
  pendingToNotification,
} from "@/lib/notificationTriggers";

const TICK_MS = 60_000; // 1 minute — cheap, all client-side

/**
 * Runs the notification trigger engine on a 1-minute timer (and once on mount
 * + on focus). Inserts new notifications into the store, dedups by trigger ID
 * so the same job doesn't spam multiple "soon" rows.
 */
export function useNotificationScheduler() {
  const { data, dispatch, loaded } = useStore();
  const dataRef = useRef(data);
  dataRef.current = data;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const loadedRef = useRef(loaded);
  loadedRef.current = loaded;

  useEffect(() => {
    function tick() {
      if (!loadedRef.current) return;
      const d = dataRef.current;
      if (!d.settings.notificationsEnabled) return;
      const pending = deriveTriggeredNotifications(d);
      if (pending.length === 0) return;

      const existingIds = new Set((d.notifications ?? []).map((n) => n.id));
      const fresh = pending.filter((p) => !existingIds.has(p.id));
      for (const p of fresh) {
        dispatchRef.current({
          type: "addNotification",
          notification: pendingToNotification(p),
        });
      }
    }

    // First tick after a short delay so initial render isn't blocked
    const initial = setTimeout(tick, 1500);
    const interval = setInterval(tick, TICK_MS);
    function onFocus() {
      tick();
    }
    window.addEventListener("focus", onFocus);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, []);
}
