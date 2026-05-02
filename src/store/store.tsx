import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import type {
  AppData,
  Appointment,
  Customer,
  Expense,
  Lead,
  Notification,
  Photo,
  Service,
  Settings,
  StartupItem,
  Task,
  Template,
  ChecklistGroup,
  BlockedTime,
} from "@/lib/types";
import { EMPTY_DATA } from "@/lib/starter";
import { loadCachedData, persistCache, clearCache } from "@/lib/storage";
import { uid } from "@/lib/utils";
import { useAuth } from "@/auth/AuthProvider";
import { api, fetchAllForUser, seedStarterForUser } from "@/lib/api";

type Action =
  | { type: "set"; data: AppData }
  | { type: "addCustomer"; customer: Customer }
  | { type: "updateCustomer"; id: string; patch: Partial<Customer> }
  | { type: "deleteCustomer"; id: string }
  | { type: "addAppointment"; appt: Appointment }
  | { type: "updateAppointment"; id: string; patch: Partial<Appointment> }
  | { type: "deleteAppointment"; id: string }
  | { type: "addLead"; lead: Lead }
  | { type: "updateLead"; id: string; patch: Partial<Lead> }
  | { type: "deleteLead"; id: string }
  | { type: "addTask"; task: Task }
  | { type: "updateTask"; id: string; patch: Partial<Task> }
  | { type: "deleteTask"; id: string }
  | { type: "addService"; service: Service }
  | { type: "updateService"; id: string; patch: Partial<Service> }
  | { type: "deleteService"; id: string }
  | { type: "addExpense"; expense: Expense }
  | { type: "updateExpense"; id: string; patch: Partial<Expense> }
  | { type: "deleteExpense"; id: string }
  | { type: "updateStartup"; id: string; patch: Partial<StartupItem> }
  | { type: "addStartup"; item: StartupItem }
  | { type: "deleteStartup"; id: string }
  | { type: "addTemplate"; template: Template }
  | { type: "updateTemplate"; id: string; patch: Partial<Template> }
  | { type: "deleteTemplate"; id: string }
  | { type: "addChecklist"; checklist: ChecklistGroup }
  | { type: "updateChecklist"; id: string; patch: Partial<ChecklistGroup> }
  | { type: "deleteChecklist"; id: string }
  | { type: "toggleChecklistItem"; groupId: string; itemId: string }
  | { type: "resetChecklist"; id: string }
  | { type: "addBlock"; block: BlockedTime }
  | { type: "deleteBlock"; id: string }
  | { type: "addPhoto"; photo: Photo }
  | { type: "updatePhoto"; id: string; patch: Partial<Photo> }
  | { type: "deletePhoto"; id: string }
  | { type: "addNotification"; notification: Notification }
  | { type: "markNotificationRead"; id: string; read: boolean }
  | { type: "markAllNotificationsRead" }
  | { type: "deleteNotification"; id: string }
  | { type: "deleteAllNotifications" }
  | { type: "upsertNotificationFromRealtime"; notification: Notification }
  | { type: "updateSettings"; patch: Partial<Settings> };

function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case "set":
      return action.data;

    case "addCustomer":
      return { ...state, customers: [action.customer, ...state.customers] };
    case "updateCustomer":
      return {
        ...state,
        customers: state.customers.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)),
      };
    case "deleteCustomer":
      return { ...state, customers: state.customers.filter((c) => c.id !== action.id) };

    case "addAppointment":
      return { ...state, appointments: [action.appt, ...state.appointments] };
    case "updateAppointment":
      return {
        ...state,
        appointments: state.appointments.map((a) => (a.id === action.id ? { ...a, ...action.patch } : a)),
      };
    case "deleteAppointment":
      return { ...state, appointments: state.appointments.filter((a) => a.id !== action.id) };

    case "addLead":
      return { ...state, leads: [action.lead, ...state.leads] };
    case "updateLead":
      return {
        ...state,
        leads: state.leads.map((l) => (l.id === action.id ? { ...l, ...action.patch } : l)),
      };
    case "deleteLead":
      return { ...state, leads: state.leads.filter((l) => l.id !== action.id) };

    case "addTask":
      return { ...state, tasks: [action.task, ...state.tasks] };
    case "updateTask":
      return {
        ...state,
        tasks: state.tasks.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)),
      };
    case "deleteTask":
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };

    case "addService":
      return { ...state, services: [...state.services, action.service] };
    case "updateService":
      return {
        ...state,
        services: state.services.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s)),
      };
    case "deleteService":
      return { ...state, services: state.services.filter((s) => s.id !== action.id) };

    case "addExpense":
      return { ...state, expenses: [action.expense, ...state.expenses] };
    case "updateExpense":
      return {
        ...state,
        expenses: state.expenses.map((e) => (e.id === action.id ? { ...e, ...action.patch } : e)),
      };
    case "deleteExpense":
      return { ...state, expenses: state.expenses.filter((e) => e.id !== action.id) };

    case "addStartup":
      return { ...state, startup: [...state.startup, action.item] };
    case "updateStartup":
      return {
        ...state,
        startup: state.startup.map((i) => (i.id === action.id ? { ...i, ...action.patch } : i)),
      };
    case "deleteStartup":
      return { ...state, startup: state.startup.filter((i) => i.id !== action.id) };

    case "addTemplate":
      return { ...state, templates: [action.template, ...state.templates] };
    case "updateTemplate":
      return {
        ...state,
        templates: state.templates.map((t) => (t.id === action.id ? { ...t, ...action.patch } : t)),
      };
    case "deleteTemplate":
      return { ...state, templates: state.templates.filter((t) => t.id !== action.id) };

    case "addChecklist":
      return { ...state, checklists: [action.checklist, ...state.checklists] };
    case "deleteChecklist":
      return { ...state, checklists: state.checklists.filter((c) => c.id !== action.id) };
    case "updateChecklist":
      return {
        ...state,
        checklists: state.checklists.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)),
      };
    case "toggleChecklistItem":
      return {
        ...state,
        checklists: state.checklists.map((c) =>
          c.id !== action.groupId
            ? c
            : {
                ...c,
                items: c.items.map((it) =>
                  it.id === action.itemId ? { ...it, done: !it.done } : it
                ),
              }
        ),
      };
    case "resetChecklist":
      return {
        ...state,
        checklists: state.checklists.map((c) =>
          c.id === action.id
            ? { ...c, items: c.items.map((it) => ({ ...it, done: false })) }
            : c
        ),
      };

    case "addBlock":
      return { ...state, blocks: [...state.blocks, action.block] };
    case "deleteBlock":
      return { ...state, blocks: state.blocks.filter((b) => b.id !== action.id) };

    case "addNotification":
      return { ...state, notifications: [action.notification, ...(state.notifications ?? [])] };
    case "markNotificationRead":
      return {
        ...state,
        notifications: (state.notifications ?? []).map((n) =>
          n.id === action.id ? { ...n, read: action.read } : n
        ),
      };
    case "markAllNotificationsRead":
      return {
        ...state,
        notifications: (state.notifications ?? []).map((n) =>
          n.read ? n : { ...n, read: true }
        ),
      };
    case "deleteNotification":
      return {
        ...state,
        notifications: (state.notifications ?? []).filter((n) => n.id !== action.id),
      };
    case "deleteAllNotifications":
      return { ...state, notifications: [] };
    case "upsertNotificationFromRealtime": {
      const existing = (state.notifications ?? []).findIndex(
        (n) => n.id === action.notification.id
      );
      if (existing >= 0) {
        const next = [...(state.notifications ?? [])];
        next[existing] = action.notification;
        return { ...state, notifications: next };
      }
      return {
        ...state,
        notifications: [action.notification, ...(state.notifications ?? [])],
      };
    }

    case "addPhoto":
      return { ...state, photos: [action.photo, ...(state.photos ?? [])] };
    case "updatePhoto":
      return {
        ...state,
        photos: (state.photos ?? []).map((p) =>
          p.id === action.id ? { ...p, ...action.patch } : p
        ),
      };
    case "deletePhoto":
      return {
        ...state,
        photos: (state.photos ?? []).filter((p) => p.id !== action.id),
      };

    case "updateSettings":
      return { ...state, settings: { ...state.settings, ...action.patch } };

    default:
      return state;
  }
}

interface StoreContextValue {
  data: AppData;
  loaded: boolean;
  loading: boolean;
  error: string | null;
  dispatch: React.Dispatch<Action>;
  reload: () => Promise<void>;
  reset: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const initial = useMemo<AppData>(() => {
    if (userId) {
      const cached = loadCachedData(userId);
      if (cached) return cached;
    }
    return EMPTY_DATA;
  }, [userId]);

  const [data, baseDispatch] = useReducer(reducer, initial);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Keep a ref so async callbacks can read the latest state
  const dataRef = useRef(data);
  dataRef.current = data;

  // Keep latest userId in a ref for sync writes
  const userIdRef = useRef<string | null>(userId);
  userIdRef.current = userId;

  // Wrap dispatch so we apply locally THEN sync to Supabase.
  const dispatch = useCallback<React.Dispatch<Action>>((action) => {
    baseDispatch(action);
    const uid = userIdRef.current;
    if (!uid) return;
    syncAction(action, uid).catch((err) => {
      console.error("[sync]", action.type, err);
      toast.error("Sync failed — change may not appear on other devices", {
        description: err?.message ?? String(err),
      });
    });
  }, []);

  /* ----- Initial load + reload-on-user-change ----- */

  const load = useCallback(async () => {
    if (!userId) {
      baseDispatch({ type: "set", data: EMPTY_DATA });
      setLoaded(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // First make sure the user has starter content (services / templates / etc).
      // seedStarterForUser is idempotent — only seeds on first run.
      const fresh = await seedStarterForUser(userId);
      baseDispatch({ type: "set", data: fresh });
      setLoaded(true);
    } catch (e) {
      const msg = e instanceof Error
        ? e.message
        : "Failed to load your data from Supabase. Check your connection and try again.";
      console.error("[store] load failed:", msg, e);
      setError(msg);
      // Show cache but mark it as stale so user knows
      const cached = loadCachedData(userId);
      if (cached) {
        baseDispatch({ type: "set", data: cached });
        setLoaded(true);
        toast.warning("Showing cached data — couldn't reach Supabase", {
          description: msg,
        });
      } else {
        toast.error("Could not load data from Supabase", {
          description: msg,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Persist to cache whenever data changes (write-through cache for offline)
  useEffect(() => {
    if (userId && loaded) {
      persistCache(userId, data);
    }
  }, [data, userId, loaded]);

  // Refetch on tab focus OR visibility change (mobile browsers use visibilitychange)
  useEffect(() => {
    function refetch() {
      if (userId && loaded) load();
    }
    function onVisibility() {
      if (document.visibilityState === "visible") refetch();
    }
    window.addEventListener("focus", refetch);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", refetch);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [userId, loaded, load]);

  // Realtime subscriptions — sync changes from other devices live.
  // Covers all core business tables so cross-device edits appear instantly.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    import("@/lib/supabase").then(({ getSupabase }) => {
      if (cancelled) return;
      const client = getSupabase();
      if (!client) return;

      const channel = client.channel(`sync:${userId}`);

      // For core tables, any INSERT/UPDATE/DELETE triggers a full refetch.
      // This is simple and guarantees consistency across devices without
      // needing per-table fromRow logic for every possible partial update.
      const coreTables = [
        "customers",
        "appointments",
        "leads",
        "tasks",
        "services",
        "expenses",
        "startup_items",
        "templates",
        "checklist_groups",
        "blocked_times",
        "photos",
        "settings",
      ];

      for (const table of coreTables) {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table, filter: `user_id=eq.${userId}` },
          () => {
            // Debounce: only refetch if we're visible (avoids hammering while backgrounded)
            if (document.visibilityState === "visible") {
              load();
            }
          }
        );
      }

      // Notifications get granular handling so the bell updates instantly
      channel
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          (payload: any) => {
            import("@/lib/mappers").then(({ notificationFromRow }) => {
              baseDispatch({
                type: "upsertNotificationFromRealtime",
                notification: notificationFromRow(payload.new),
              });
            });
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          (payload: any) => {
            import("@/lib/mappers").then(({ notificationFromRow }) => {
              baseDispatch({
                type: "upsertNotificationFromRealtime",
                notification: notificationFromRow(payload.new),
              });
            });
          }
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          (payload: any) => {
            const id = payload.old?.id;
            if (id) baseDispatch({ type: "deleteNotification", id });
          }
        );

      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("[realtime] connected — cross-device sync active");
        }
        if (status === "CHANNEL_ERROR") {
          console.warn("[realtime] channel error — will retry automatically");
        }
      });

      unsubscribe = () => {
        client.removeChannel(channel);
      };
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [userId, load]);

  const reset = useCallback(() => {
    if (userId) clearCache(userId);
    baseDispatch({ type: "set", data: EMPTY_DATA });
  }, [userId]);

  const value = useMemo<StoreContextValue>(
    () => ({
      data,
      loaded,
      loading,
      error,
      dispatch,
      reload: load,
      reset,
    }),
    [data, loaded, loading, error, dispatch, load, reset]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

/**
 * Mirror an action to Supabase. Fire-and-forget — the local reducer has
 * already applied it optimistically, and load() runs again on focus to heal
 * any divergence.
 */
async function syncAction(action: Action, userId: string): Promise<void> {
  switch (action.type) {
    case "addCustomer": {
      const r = await api.insertCustomer(action.customer, userId);
      if (r.error) throw r.error;
      return;
    }
    case "updateCustomer": {
      const r = await api.updateCustomer(action.id, action.patch);
      if (r.error) throw r.error;
      return;
    }
    case "deleteCustomer": {
      const r = await api.deleteCustomer(action.id);
      if (r.error) throw r.error;
      return;
    }

    case "addAppointment": {
      const r = await api.insertAppointment(action.appt, userId);
      if (r.error) throw r.error;
      return;
    }
    case "updateAppointment": {
      const r = await api.updateAppointment(action.id, action.patch);
      if (r.error) throw r.error;
      return;
    }
    case "deleteAppointment": {
      const r = await api.deleteAppointment(action.id);
      if (r.error) throw r.error;
      return;
    }

    case "addLead": {
      const r = await api.insertLead(action.lead, userId);
      if (r.error) throw r.error;
      return;
    }
    case "updateLead": {
      const r = await api.updateLead(action.id, action.patch);
      if (r.error) throw r.error;
      return;
    }
    case "deleteLead": {
      const r = await api.deleteLead(action.id);
      if (r.error) throw r.error;
      return;
    }

    case "addTask": {
      const r = await api.insertTask(action.task, userId);
      if (r.error) throw r.error;
      return;
    }
    case "updateTask": {
      const r = await api.updateTask(action.id, action.patch);
      if (r.error) throw r.error;
      return;
    }
    case "deleteTask": {
      const r = await api.deleteTask(action.id);
      if (r.error) throw r.error;
      return;
    }

    case "addService": {
      const r = await api.insertService(action.service, userId);
      if (r.error) throw r.error;
      return;
    }
    case "updateService": {
      const r = await api.updateService(action.id, action.patch);
      if (r.error) throw r.error;
      return;
    }
    case "deleteService": {
      const r = await api.deleteService(action.id);
      if (r.error) throw r.error;
      return;
    }

    case "addExpense": {
      const r = await api.insertExpense(action.expense, userId);
      if (r.error) throw r.error;
      return;
    }
    case "updateExpense": {
      const r = await api.updateExpense(action.id, action.patch);
      if (r.error) throw r.error;
      return;
    }
    case "deleteExpense": {
      const r = await api.deleteExpense(action.id);
      if (r.error) throw r.error;
      return;
    }

    case "addStartup": {
      const r = await api.insertStartup(action.item, userId);
      if (r.error) throw r.error;
      return;
    }
    case "updateStartup": {
      const r = await api.updateStartup(action.id, action.patch);
      if (r.error) throw r.error;
      return;
    }
    case "deleteStartup": {
      const r = await api.deleteStartup(action.id);
      if (r.error) throw r.error;
      return;
    }

    case "addTemplate": {
      const r = await api.insertTemplate(action.template, userId);
      if (r.error) throw r.error;
      return;
    }
    case "updateTemplate": {
      const r = await api.updateTemplate(action.id, action.patch);
      if (r.error) throw r.error;
      return;
    }
    case "deleteTemplate": {
      const r = await api.deleteTemplate(action.id);
      if (r.error) throw r.error;
      return;
    }

    case "addChecklist": {
      const r = await api.insertChecklist(action.checklist, userId);
      if (r.error) throw r.error;
      return;
    }
    case "deleteChecklist": {
      const r = await api.deleteChecklist(action.id);
      if (r.error) throw r.error;
      return;
    }
    case "updateChecklist": {
      const r = await api.updateChecklist(action.id, action.patch);
      if (r.error) throw r.error;
      return;
    }
    case "toggleChecklistItem":
    case "resetChecklist": {
      // These mutate the items JSONB array — read the new items from local state
      // and push the whole array back. Re-derived from a tiny helper to avoid
      // racing with the reducer.
      const id = action.type === "resetChecklist" ? action.id : action.groupId;
      // Defer one tick so the reducer's update has flushed
      await new Promise((r) => setTimeout(r, 0));
      const items = readChecklistItems(id);
      if (items) {
        const r = await api.updateChecklist(id, { items });
        if (r.error) throw r.error;
      }
      return;
    }

    case "addBlock": {
      const r = await api.insertBlock(action.block, userId);
      if (r.error) throw r.error;
      return;
    }
    case "deleteBlock": {
      const r = await api.deleteBlock(action.id);
      if (r.error) throw r.error;
      return;
    }

    case "addNotification": {
      const r = await api.insertNotification(action.notification, userId);
      if (r.error) throw r.error;
      return;
    }
    case "markNotificationRead": {
      const r = await api.updateNotificationRead(action.id, action.read);
      if (r.error) throw r.error;
      return;
    }
    case "markAllNotificationsRead": {
      const r = await api.markAllNotificationsRead(userId);
      if (r.error) throw r.error;
      return;
    }
    case "deleteNotification": {
      const r = await api.deleteNotification(action.id);
      if (r.error) throw r.error;
      return;
    }
    case "deleteAllNotifications": {
      const r = await api.deleteAllNotifications(userId);
      if (r.error) throw r.error;
      return;
    }
    case "upsertNotificationFromRealtime":
      // Realtime-sourced — already on the server, no sync needed.
      return;

    case "addPhoto": {
      const r = await api.insertPhoto(action.photo, userId);
      if (r.error) throw r.error;
      return;
    }
    case "updatePhoto": {
      const r = await api.updatePhoto(action.id, action.patch);
      if (r.error) throw r.error;
      return;
    }
    case "deletePhoto": {
      const r = await api.deletePhoto(action.id);
      if (r.error) throw r.error;
      return;
    }

    case "updateSettings": {
      const r = await api.patchSettings(userId, action.patch);
      if (r.error) throw r.error;
      return;
    }

    case "set":
      return;
  }
}

// Side-channel for syncAction to read latest checklist items after the reducer applies
// its mutation. Set by StoreProvider on every render via a ref pattern.
let _readChecklist: ((groupId: string) => ChecklistGroup["items"] | null) | null = null;
function readChecklistItems(groupId: string) {
  return _readChecklist ? _readChecklist(groupId) : null;
}
export function _setChecklistReader(fn: typeof _readChecklist) {
  _readChecklist = fn;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  // Register a reader so syncAction can read the latest items array
  _setChecklistReader((groupId) => {
    return ctx.data.checklists.find((c) => c.id === groupId)?.items ?? null;
  });
  return ctx;
}

export function makeId() {
  return uid();
}

// Re-export so old imports still work
export { EMPTY_DATA } from "@/lib/starter";
