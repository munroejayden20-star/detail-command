/**
 * LocalStorage-backed snooze + dismiss state for attention items.
 *
 * Phase 1 keeps this client-side because attention items are computed live
 * from store data. When the underlying condition is fixed, the rule no
 * longer emits the item, so persistence is not needed for correctness.
 *
 * Phase 2+ may promote this to an `intelligence_actions` table to share
 * snooze state across devices. The hook signature would stay the same.
 */
import { useCallback, useEffect, useState } from "react";
import { safeJSON } from "@/lib/utils";
import type { AttentionLocalState } from "@/lib/intelligence";

const KEY = "detail-command:attention-state:v1";

const EMPTY: AttentionLocalState = {
  snoozedUntil: {},
  dismissedAt: {},
};

function load(): AttentionLocalState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    return safeJSON<AttentionLocalState>(raw, EMPTY);
  } catch {
    return EMPTY;
  }
}

function save(state: AttentionLocalState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // localStorage might be full or disabled — silently no-op
  }
}

/** Snooze duration presets (ms). */
export const SNOOZE_OPTIONS = [
  { label: "1 hour", ms: 60 * 60 * 1000 },
  { label: "Tomorrow", ms: 24 * 60 * 60 * 1000 },
  { label: "Next week", ms: 7 * 24 * 60 * 60 * 1000 },
] as const;

export type SnoozeOption = (typeof SNOOZE_OPTIONS)[number];

export function useAttentionLocalState() {
  const [state, setState] = useState<AttentionLocalState>(() => load());

  // Cross-tab sync — if another tab dismisses something, reflect it here.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === KEY) setState(load());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const snooze = useCallback((id: string, ms: number) => {
    const until = new Date(Date.now() + ms).toISOString();
    setState((prev) => {
      const next = {
        ...prev,
        snoozedUntil: { ...prev.snoozedUntil, [id]: until },
      };
      save(next);
      return next;
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setState((prev) => {
      const next = {
        ...prev,
        dismissedAt: { ...prev.dismissedAt, [id]: new Date().toISOString() },
      };
      save(next);
      return next;
    });
  }, []);

  const clear = useCallback((id: string) => {
    setState((prev) => {
      const snoozedUntil = { ...prev.snoozedUntil };
      const dismissedAt = { ...prev.dismissedAt };
      delete snoozedUntil[id];
      delete dismissedAt[id];
      const next = { snoozedUntil, dismissedAt };
      save(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    save(EMPTY);
    setState(EMPTY);
  }, []);

  return { state, snooze, dismiss, clear, reset };
}

/** Return true if an item is currently hidden by snooze or dismissal. */
export function isHidden(
  id: string,
  state: AttentionLocalState,
  now: number = Date.now(),
): boolean {
  if (state.dismissedAt[id]) return true;
  const until = state.snoozedUntil[id];
  if (until && new Date(until).getTime() > now) return true;
  return false;
}
