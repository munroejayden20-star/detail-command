import { useEffect, useRef, useState } from "react";
import { useStore } from "@/store/store";
import { uid } from "@/lib/utils";

const POLL_MS = 60_000; // every minute
const STORAGE_KEY = "dc:update-banner-dismissed-for";

interface UpdateState {
  available: boolean;
  latestBuildId: string | null;
}

declare const __BUILD_ID__: string;

const updateState: UpdateState = {
  available: false,
  latestBuildId: null,
};

const listeners = new Set<() => void>();

function setUpdateAvailable(latestBuildId: string) {
  if (updateState.available && updateState.latestBuildId === latestBuildId) return;
  updateState.available = true;
  updateState.latestBuildId = latestBuildId;
  listeners.forEach((l) => l());
}

export function useUpdateState() {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return updateState;
}

export function dismissUpdateBanner() {
  if (updateState.latestBuildId) {
    sessionStorage.setItem(STORAGE_KEY, updateState.latestBuildId);
  }
  updateState.available = false;
  listeners.forEach((l) => l());
}

export function applyUpdate() {
  // Mark the post-reload toast that gets shown once we boot
  if (updateState.latestBuildId) {
    sessionStorage.setItem("dc:just-updated-from", __BUILD_ID__);
  }
  // Hard reload, bypassing cache where possible
  window.location.reload();
}

export function useUpdateChecker() {
  const { dispatch, data } = useStore();
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const dataRef = useRef(data);
  dataRef.current = data;

  // After-reload toast: if we just applied an update, post a notification
  useEffect(() => {
    const justUpdatedFrom = sessionStorage.getItem("dc:just-updated-from");
    if (justUpdatedFrom && justUpdatedFrom !== __BUILD_ID__) {
      sessionStorage.removeItem("dc:just-updated-from");
      // Small delay so the store is loaded before we dispatch
      setTimeout(() => {
        if (!dataRef.current.settings.notifyUpdates) return;
        dispatchRef.current({
          type: "addNotification",
          notification: {
            id: `update_${__BUILD_ID__}`,
            type: "app_update_completed",
            title: "App updated successfully",
            message: `Now on build ${__BUILD_ID__.slice(0, 19).replace("T", " ")} UTC`,
            read: false,
            createdAt: new Date().toISOString(),
          },
        });
      }, 1500);
    }
  }, []);

  // Poll /version.json
  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (cancelled) return;
      try {
        const res = await fetch("/version.json", { cache: "no-store" });
        if (!res.ok) return;
        const { buildId } = (await res.json()) as { buildId: string };
        if (!buildId) return;
        const dismissedFor = sessionStorage.getItem(STORAGE_KEY);
        if (buildId !== __BUILD_ID__ && buildId !== dismissedFor) {
          setUpdateAvailable(buildId);
          // Add a notification once per detected build
          const notifId = `update_avail_${buildId}`;
          const existing = (dataRef.current.notifications ?? []).some(
            (n) => n.id === notifId
          );
          if (!existing && dataRef.current.settings.notifyUpdates) {
            dispatchRef.current({
              type: "addNotification",
              notification: {
                id: notifId,
                type: "app_update_available",
                title: "New update available",
                message: "Tap the banner to load the latest version.",
                read: false,
                createdAt: new Date().toISOString(),
              },
            });
          }
        }
      } catch {
        // Network blip — try again next tick
      }
    }
    // Avoid running in dev; version.json is a build-time artifact
    if (import.meta.env.PROD) {
      check();
      const id = setInterval(check, POLL_MS);
      const onFocus = () => check();
      window.addEventListener("focus", onFocus);
      return () => {
        cancelled = true;
        clearInterval(id);
        window.removeEventListener("focus", onFocus);
      };
    }
    return () => {
      cancelled = true;
    };
  }, []);
}

// Tiny helper used for synthesizing notification IDs elsewhere
export function newNotifId() {
  return uid();
}
