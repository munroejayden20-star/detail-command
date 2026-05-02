import type { AppData } from "./types";
import { requireSupabase } from "./supabase";
import {
  appointmentFromRow,
  appointmentPatchToRow,
  appointmentToRow,
  blockFromRow,
  blockToRow,
  checklistFromRow,
  checklistPatchToRow,
  checklistToRow,
  customerFromRow,
  customerPatchToRow,
  customerToRow,
  expenseFromRow,
  expensePatchToRow,
  expenseToRow,
  leadFromRow,
  leadPatchToRow,
  leadToRow,
  serviceFromRow,
  servicePatchToRow,
  serviceToRow,
  settingsFromRow,
  settingsPatchToRow,
  settingsToRow,
  startupFromRow,
  startupPatchToRow,
  startupToRow,
  taskFromRow,
  taskPatchToRow,
  taskToRow,
  templateFromRow,
  templatePatchToRow,
  templateToRow,
  photoFromRow,
  photoPatchToRow,
  photoToRow,
  notificationFromRow,
  notificationToRow,
} from "./mappers";
import { makeStarterContent, EMPTY_DATA } from "./starter";

/**
 * Fetch every entity that belongs to the currently authenticated user and
 * return an AppData shaped like the local store expects.
 */
export async function fetchAllForUser(userId: string): Promise<AppData> {
  const sb = requireSupabase();

  const [
    customers,
    appointments,
    leads,
    tasks,
    services,
    expenses,
    startup,
    templates,
    checklists,
    blocks,
    photos,
    notifications,
    settingsRow,
  ] = await Promise.all([
    sb.from("customers").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    sb.from("appointments").select("*").eq("user_id", userId).order("start_at", { ascending: true }),
    sb.from("leads").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    sb.from("tasks").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    sb.from("services").select("*").eq("user_id", userId),
    sb.from("expenses").select("*").eq("user_id", userId).order("date", { ascending: false }),
    sb.from("startup_items").select("*").eq("user_id", userId),
    sb.from("templates").select("*").eq("user_id", userId),
    sb.from("checklist_groups").select("*").eq("user_id", userId),
    sb.from("blocked_times").select("*").eq("user_id", userId),
    sb.from("photos").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    sb.from("notifications").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
    sb.from("settings").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  const errs = [customers, appointments, leads, tasks, services, expenses, startup, templates, checklists, blocks, photos, notifications].filter(
    (r) => r.error
  );
  if (errs.length) throw errs[0].error;
  if (settingsRow.error) throw settingsRow.error;

  return {
    version: 2,
    customers: (customers.data ?? []).map(customerFromRow),
    appointments: (appointments.data ?? []).map(appointmentFromRow),
    leads: (leads.data ?? []).map(leadFromRow),
    tasks: (tasks.data ?? []).map(taskFromRow),
    services: (services.data ?? []).map(serviceFromRow),
    expenses: (expenses.data ?? []).map(expenseFromRow),
    startup: (startup.data ?? []).map(startupFromRow),
    templates: (templates.data ?? []).map(templateFromRow),
    checklists: (checklists.data ?? []).map(checklistFromRow),
    blocks: (blocks.data ?? []).map(blockFromRow),
    photos: (photos.data ?? []).map(photoFromRow),
    notifications: (notifications.data ?? []).map(notificationFromRow),
    settings: settingsRow.data ? settingsFromRow(settingsRow.data) : EMPTY_DATA.settings,
  };
}

/**
 * Returns true if the user has any records at all (services counts).
 * Used to decide whether to seed starter content.
 */
export async function userHasAnyData(userId: string): Promise<boolean> {
  const sb = requireSupabase();
  const { count, error } = await sb
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

/**
 * Insert the starter content for a brand-new account.
 * Idempotent: only seeds if the user has no services yet.
 */
export async function seedStarterForUser(userId: string): Promise<AppData> {
  const sb = requireSupabase();
  const already = await userHasAnyData(userId);
  if (already) return fetchAllForUser(userId);

  const starter = makeStarterContent();

  const inserts = await Promise.all([
    sb.from("services").insert(starter.services.map((s) => serviceToRow(s, userId))),
    sb.from("templates").insert(starter.templates.map((t) => templateToRow(t, userId))),
    sb.from("checklist_groups").insert(starter.checklists.map((c) => checklistToRow(c, userId))),
    sb.from("startup_items").insert(starter.startup.map((i) => startupToRow(i, userId))),
    sb.from("blocked_times").insert(starter.blocks.map((b) => blockToRow(b, userId))),
    sb.from("settings").upsert(settingsToRow(starter.settings, userId), { onConflict: "user_id" }),
  ]);

  for (const r of inserts) if (r.error) throw r.error;
  return fetchAllForUser(userId);
}

/**
 * Ensure a settings row exists for the user. Called on every load — settings
 * is a single row keyed by user_id and seeded at first login.
 */
export async function ensureSettingsRow(userId: string) {
  const sb = requireSupabase();
  await sb
    .from("settings")
    .upsert(settingsToRow(EMPTY_DATA.settings, userId), { onConflict: "user_id" });
}

/* ---------- CRUD helpers (write-through from the reducer) ---------- */

import type {
  Appointment,
  BlockedTime,
  ChecklistGroup,
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
} from "./types";

const sbOrThrow = () => requireSupabase();

export const api = {
  // Customers
  insertCustomer: (c: Customer, userId: string) =>
    sbOrThrow().from("customers").insert(customerToRow(c, userId)),
  updateCustomer: (id: string, p: Partial<Customer>) =>
    sbOrThrow().from("customers").update(customerPatchToRow(p)).eq("id", id),
  deleteCustomer: (id: string) => sbOrThrow().from("customers").delete().eq("id", id),

  // Appointments
  insertAppointment: (a: Appointment, userId: string) =>
    sbOrThrow().from("appointments").insert(appointmentToRow(a, userId)),
  updateAppointment: (id: string, p: Partial<Appointment>) =>
    sbOrThrow().from("appointments").update(appointmentPatchToRow(p)).eq("id", id),
  deleteAppointment: (id: string) => sbOrThrow().from("appointments").delete().eq("id", id),

  // Leads
  insertLead: (l: Lead, userId: string) => sbOrThrow().from("leads").insert(leadToRow(l, userId)),
  updateLead: (id: string, p: Partial<Lead>) =>
    sbOrThrow().from("leads").update(leadPatchToRow(p)).eq("id", id),
  deleteLead: (id: string) => sbOrThrow().from("leads").delete().eq("id", id),

  // Tasks
  insertTask: (t: Task, userId: string) => sbOrThrow().from("tasks").insert(taskToRow(t, userId)),
  updateTask: (id: string, p: Partial<Task>) =>
    sbOrThrow().from("tasks").update(taskPatchToRow(p)).eq("id", id),
  deleteTask: (id: string) => sbOrThrow().from("tasks").delete().eq("id", id),

  // Services
  insertService: (s: Service, userId: string) =>
    sbOrThrow().from("services").insert(serviceToRow(s, userId)),
  updateService: (id: string, p: Partial<Service>) =>
    sbOrThrow().from("services").update(servicePatchToRow(p)).eq("id", id),
  deleteService: (id: string) => sbOrThrow().from("services").delete().eq("id", id),

  // Expenses
  insertExpense: (e: Expense, userId: string) =>
    sbOrThrow().from("expenses").insert(expenseToRow(e, userId)),
  updateExpense: (id: string, p: Partial<Expense>) =>
    sbOrThrow().from("expenses").update(expensePatchToRow(p)).eq("id", id),
  deleteExpense: (id: string) => sbOrThrow().from("expenses").delete().eq("id", id),

  // Startup items
  insertStartup: (i: StartupItem, userId: string) =>
    sbOrThrow().from("startup_items").insert(startupToRow(i, userId)),
  updateStartup: (id: string, p: Partial<StartupItem>) =>
    sbOrThrow().from("startup_items").update(startupPatchToRow(p)).eq("id", id),
  deleteStartup: (id: string) => sbOrThrow().from("startup_items").delete().eq("id", id),

  // Templates
  insertTemplate: (t: Template, userId: string) =>
    sbOrThrow().from("templates").insert(templateToRow(t, userId)),
  updateTemplate: (id: string, p: Partial<Template>) =>
    sbOrThrow().from("templates").update(templatePatchToRow(p)).eq("id", id),
  deleteTemplate: (id: string) => sbOrThrow().from("templates").delete().eq("id", id),

  // Checklist groups
  updateChecklist: (id: string, p: Partial<ChecklistGroup>) =>
    sbOrThrow().from("checklist_groups").update(checklistPatchToRow(p)).eq("id", id),
  insertChecklist: (c: ChecklistGroup, userId: string) =>
    sbOrThrow().from("checklist_groups").insert(checklistToRow(c, userId)),
  deleteChecklist: (id: string) => sbOrThrow().from("checklist_groups").delete().eq("id", id),

  // Blocked times
  insertBlock: (b: BlockedTime, userId: string) =>
    sbOrThrow().from("blocked_times").insert(blockToRow(b, userId)),
  deleteBlock: (id: string) => sbOrThrow().from("blocked_times").delete().eq("id", id),

  // Photos (metadata rows; binary lives in Supabase Storage)
  insertPhoto: (p: Photo, userId: string) =>
    sbOrThrow().from("photos").insert(photoToRow(p, userId)),
  updatePhoto: (id: string, p: Partial<Photo>) =>
    sbOrThrow().from("photos").update(photoPatchToRow(p)).eq("id", id),
  deletePhoto: (id: string) => sbOrThrow().from("photos").delete().eq("id", id),
  uploadPhotoFile: async (file: File, path: string) => {
    const sb = sbOrThrow();
    return sb.storage.from("photos").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });
  },
  removePhotoFile: async (path: string) => {
    const sb = sbOrThrow();
    return sb.storage.from("photos").remove([path]);
  },
  signPhotoUrl: async (path: string, expiresIn = 3600) => {
    const sb = sbOrThrow();
    return sb.storage.from("photos").createSignedUrl(path, expiresIn);
  },

  // Notifications
  insertNotification: (n: Notification, userId: string) =>
    sbOrThrow().from("notifications").insert(notificationToRow(n, userId)),
  updateNotificationRead: (id: string, read: boolean) =>
    sbOrThrow().from("notifications").update({ read }).eq("id", id),
  markAllNotificationsRead: (userId: string) =>
    sbOrThrow()
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false),
  deleteNotification: (id: string) =>
    sbOrThrow().from("notifications").delete().eq("id", id),
  deleteAllNotifications: (userId: string) =>
    sbOrThrow().from("notifications").delete().eq("user_id", userId),

  // Settings
  upsertSettings: (s: Settings, userId: string) =>
    sbOrThrow()
      .from("settings")
      .upsert(settingsToRow(s, userId), { onConflict: "user_id" }),
  patchSettings: (userId: string, p: Partial<Settings>) =>
    sbOrThrow().from("settings").update(settingsPatchToRow(p)).eq("user_id", userId),

  // Bulk import (used by the "Import this device's data" migration)
  bulkImport: async (data: AppData, userId: string) => {
    const sb = sbOrThrow();
    // Run sequentially so a failure on one table doesn't leave the rest
    // half-applied without us noticing — bulkImport is rare and small.
    const run = async (p: PromiseLike<{ error: unknown | null }>) => {
      const r = await p;
      if (r.error) throw r.error;
    };

    if (data.customers.length)
      await run(sb.from("customers").upsert(data.customers.map((c) => customerToRow(c, userId))));
    if (data.appointments.length)
      await run(
        sb.from("appointments").upsert(data.appointments.map((a) => appointmentToRow(a, userId)))
      );
    if (data.leads.length)
      await run(sb.from("leads").upsert(data.leads.map((l) => leadToRow(l, userId))));
    if (data.tasks.length)
      await run(sb.from("tasks").upsert(data.tasks.map((t) => taskToRow(t, userId))));
    if (data.services.length)
      await run(sb.from("services").upsert(data.services.map((s) => serviceToRow(s, userId))));
    if (data.expenses.length)
      await run(sb.from("expenses").upsert(data.expenses.map((e) => expenseToRow(e, userId))));
    if (data.startup.length)
      await run(
        sb.from("startup_items").upsert(data.startup.map((i) => startupToRow(i, userId)))
      );
    if (data.templates.length)
      await run(sb.from("templates").upsert(data.templates.map((t) => templateToRow(t, userId))));
    if (data.checklists.length)
      await run(
        sb.from("checklist_groups").upsert(data.checklists.map((c) => checklistToRow(c, userId)))
      );
    if (data.blocks.length)
      await run(sb.from("blocked_times").upsert(data.blocks.map((b) => blockToRow(b, userId))));
    if (data.settings)
      await run(
        sb.from("settings").upsert(settingsToRow(data.settings, userId), { onConflict: "user_id" })
      );
  },
};
