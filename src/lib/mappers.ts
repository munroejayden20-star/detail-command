import type {
  Customer,
  Appointment,
  Lead,
  Task,
  Service,
  Expense,
  StartupItem,
  Template,
  ChecklistGroup,
  BlockedTime,
  Settings,
  JobStatus,
  PaymentStatus,
  Priority,
  TaskCategory,
  ExpenseCategory,
  LeadSource,
  LeadStatus,
} from "./types";

/* ---------- Customers ---------- */

export function customerToRow(c: Customer, userId: string) {
  return {
    id: c.id,
    user_id: userId,
    name: c.name,
    phone: c.phone,
    email: c.email ?? null,
    address: c.address ?? null,
    vehicles: c.vehicles ?? [],
    notes: c.notes ?? null,
    is_repeat: !!c.isRepeat,
    is_monthly_maintenance: !!c.isMonthlyMaintenance,
    created_at: c.createdAt,
  };
}

export function customerPatchToRow(p: Partial<Customer>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.name !== undefined) out.name = p.name;
  if (p.phone !== undefined) out.phone = p.phone;
  if (p.email !== undefined) out.email = p.email ?? null;
  if (p.address !== undefined) out.address = p.address ?? null;
  if (p.vehicles !== undefined) out.vehicles = p.vehicles;
  if (p.notes !== undefined) out.notes = p.notes ?? null;
  if (p.isRepeat !== undefined) out.is_repeat = !!p.isRepeat;
  if (p.isMonthlyMaintenance !== undefined) out.is_monthly_maintenance = !!p.isMonthlyMaintenance;
  return out;
}

export function customerFromRow(r: any): Customer {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email ?? undefined,
    address: r.address ?? undefined,
    vehicles: r.vehicles ?? [],
    notes: r.notes ?? undefined,
    isRepeat: !!r.is_repeat,
    isMonthlyMaintenance: !!r.is_monthly_maintenance,
    createdAt: r.created_at,
  };
}

/* ---------- Appointments ---------- */

export function appointmentToRow(a: Appointment, userId: string) {
  return {
    id: a.id,
    user_id: userId,
    customer_id: a.customerId || null,
    vehicle: a.vehicle,
    address: a.address,
    start_at: a.start,
    end_at: a.end,
    service_ids: a.serviceIds,
    addon_ids: a.addonIds,
    estimated_price: a.estimatedPrice,
    final_price: a.finalPrice ?? null,
    deposit_paid: a.depositPaid,
    payment_status: a.paymentStatus,
    status: a.status,
    interior_condition: a.interiorCondition ?? null,
    exterior_condition: a.exteriorCondition ?? null,
    pet_hair: a.petHair,
    stains: a.stains,
    heavy_dirt: a.heavyDirt,
    water_access: a.waterAccess,
    power_access: a.powerAccess,
    customer_notes: a.customerNotes ?? null,
    internal_notes: a.internalNotes ?? null,
    before_photos: a.beforePhotos ?? [],
    after_photos: a.afterPhotos ?? [],
    reminder_sent: !!a.reminderSent,
    travel_time_notes: a.travelTimeNotes ?? null,
    created_at: a.createdAt,
  };
}

export function appointmentPatchToRow(p: Partial<Appointment>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.customerId !== undefined) out.customer_id = p.customerId || null;
  if (p.vehicle !== undefined) out.vehicle = p.vehicle;
  if (p.address !== undefined) out.address = p.address;
  if (p.start !== undefined) out.start_at = p.start;
  if (p.end !== undefined) out.end_at = p.end;
  if (p.serviceIds !== undefined) out.service_ids = p.serviceIds;
  if (p.addonIds !== undefined) out.addon_ids = p.addonIds;
  if (p.estimatedPrice !== undefined) out.estimated_price = p.estimatedPrice;
  if (p.finalPrice !== undefined) out.final_price = p.finalPrice ?? null;
  if (p.depositPaid !== undefined) out.deposit_paid = !!p.depositPaid;
  if (p.paymentStatus !== undefined) out.payment_status = p.paymentStatus;
  if (p.status !== undefined) out.status = p.status;
  if (p.interiorCondition !== undefined) out.interior_condition = p.interiorCondition ?? null;
  if (p.exteriorCondition !== undefined) out.exterior_condition = p.exteriorCondition ?? null;
  if (p.petHair !== undefined) out.pet_hair = !!p.petHair;
  if (p.stains !== undefined) out.stains = !!p.stains;
  if (p.heavyDirt !== undefined) out.heavy_dirt = !!p.heavyDirt;
  if (p.waterAccess !== undefined) out.water_access = !!p.waterAccess;
  if (p.powerAccess !== undefined) out.power_access = !!p.powerAccess;
  if (p.customerNotes !== undefined) out.customer_notes = p.customerNotes ?? null;
  if (p.internalNotes !== undefined) out.internal_notes = p.internalNotes ?? null;
  if (p.beforePhotos !== undefined) out.before_photos = p.beforePhotos ?? [];
  if (p.afterPhotos !== undefined) out.after_photos = p.afterPhotos ?? [];
  if (p.reminderSent !== undefined) out.reminder_sent = !!p.reminderSent;
  if (p.travelTimeNotes !== undefined) out.travel_time_notes = p.travelTimeNotes ?? null;
  return out;
}

export function appointmentFromRow(r: any): Appointment {
  return {
    id: r.id,
    customerId: r.customer_id ?? "",
    vehicle: r.vehicle ?? { year: "", make: "", model: "", color: "" },
    address: r.address ?? "",
    start: r.start_at,
    end: r.end_at,
    serviceIds: r.service_ids ?? [],
    addonIds: r.addon_ids ?? [],
    estimatedPrice: Number(r.estimated_price ?? 0),
    finalPrice: r.final_price != null ? Number(r.final_price) : undefined,
    depositPaid: !!r.deposit_paid,
    paymentStatus: (r.payment_status ?? "unpaid") as PaymentStatus,
    status: (r.status ?? "scheduled") as JobStatus,
    interiorCondition: r.interior_condition ?? undefined,
    exteriorCondition: r.exterior_condition ?? undefined,
    petHair: !!r.pet_hair,
    stains: !!r.stains,
    heavyDirt: !!r.heavy_dirt,
    waterAccess: r.water_access ?? true,
    powerAccess: r.power_access ?? true,
    customerNotes: r.customer_notes ?? undefined,
    internalNotes: r.internal_notes ?? undefined,
    beforePhotos: r.before_photos ?? [],
    afterPhotos: r.after_photos ?? [],
    reminderSent: !!r.reminder_sent,
    travelTimeNotes: r.travel_time_notes ?? undefined,
    createdAt: r.created_at,
  };
}

/* ---------- Leads ---------- */

export function leadToRow(l: Lead, userId: string) {
  return {
    id: l.id,
    user_id: userId,
    name: l.name,
    phone: l.phone ?? null,
    source: l.source,
    vehicle: l.vehicle ?? null,
    interest: l.interest,
    last_contacted: l.lastContacted ?? null,
    follow_up_date: l.followUpDate ?? null,
    status: l.status,
    notes: l.notes ?? null,
    created_at: l.createdAt,
  };
}

export function leadPatchToRow(p: Partial<Lead>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.name !== undefined) out.name = p.name;
  if (p.phone !== undefined) out.phone = p.phone ?? null;
  if (p.source !== undefined) out.source = p.source;
  if (p.vehicle !== undefined) out.vehicle = p.vehicle ?? null;
  if (p.interest !== undefined) out.interest = p.interest;
  if (p.lastContacted !== undefined) out.last_contacted = p.lastContacted ?? null;
  if (p.followUpDate !== undefined) out.follow_up_date = p.followUpDate ?? null;
  if (p.status !== undefined) out.status = p.status;
  if (p.notes !== undefined) out.notes = p.notes ?? null;
  return out;
}

export function leadFromRow(r: any): Lead {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone ?? undefined,
    source: (r.source ?? "other") as LeadSource,
    vehicle: r.vehicle ?? undefined,
    interest: (r.interest ?? "medium") as Lead["interest"],
    lastContacted: r.last_contacted ?? undefined,
    followUpDate: r.follow_up_date ?? undefined,
    status: (r.status ?? "new") as LeadStatus,
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
  };
}

/* ---------- Tasks ---------- */

export function taskToRow(t: Task, userId: string) {
  return {
    id: t.id,
    user_id: userId,
    title: t.title,
    category: t.category,
    priority: t.priority,
    due_date: t.dueDate ?? null,
    completed: !!t.completed,
    recurring: t.recurring ?? "none",
    notes: t.notes ?? null,
    appointment_id: t.appointmentId ?? null,
    created_at: t.createdAt,
  };
}

export function taskPatchToRow(p: Partial<Task>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.title !== undefined) out.title = p.title;
  if (p.category !== undefined) out.category = p.category;
  if (p.priority !== undefined) out.priority = p.priority;
  if (p.dueDate !== undefined) out.due_date = p.dueDate ?? null;
  if (p.completed !== undefined) out.completed = !!p.completed;
  if (p.recurring !== undefined) out.recurring = p.recurring ?? "none";
  if (p.notes !== undefined) out.notes = p.notes ?? null;
  if (p.appointmentId !== undefined) out.appointment_id = p.appointmentId ?? null;
  return out;
}

export function taskFromRow(r: any): Task {
  return {
    id: r.id,
    title: r.title,
    category: (r.category ?? "general") as TaskCategory,
    priority: (r.priority ?? "medium") as Priority,
    dueDate: r.due_date ?? undefined,
    completed: !!r.completed,
    recurring: (r.recurring ?? "none") as Task["recurring"],
    notes: r.notes ?? undefined,
    appointmentId: r.appointment_id ?? undefined,
    createdAt: r.created_at,
  };
}

/* ---------- Services ---------- */

export function serviceToRow(s: Service, userId: string) {
  return {
    id: s.id,
    user_id: userId,
    name: s.name,
    description: s.description ?? null,
    price_low: s.priceLow,
    price_high: s.priceHigh,
    duration_minutes: s.durationMinutes,
    is_addon: !!s.isAddon,
  };
}

export function servicePatchToRow(p: Partial<Service>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.name !== undefined) out.name = p.name;
  if (p.description !== undefined) out.description = p.description ?? null;
  if (p.priceLow !== undefined) out.price_low = p.priceLow;
  if (p.priceHigh !== undefined) out.price_high = p.priceHigh;
  if (p.durationMinutes !== undefined) out.duration_minutes = p.durationMinutes;
  if (p.isAddon !== undefined) out.is_addon = !!p.isAddon;
  return out;
}

export function serviceFromRow(r: any): Service {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? undefined,
    priceLow: Number(r.price_low ?? 0),
    priceHigh: Number(r.price_high ?? 0),
    durationMinutes: Number(r.duration_minutes ?? 60),
    isAddon: !!r.is_addon,
  };
}

/* ---------- Expenses ---------- */

export function expenseToRow(e: Expense, userId: string) {
  return {
    id: e.id,
    user_id: userId,
    date: e.date,
    category: e.category,
    amount: e.amount,
    notes: e.notes ?? null,
  };
}

export function expensePatchToRow(p: Partial<Expense>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.date !== undefined) out.date = p.date;
  if (p.category !== undefined) out.category = p.category;
  if (p.amount !== undefined) out.amount = p.amount;
  if (p.notes !== undefined) out.notes = p.notes ?? null;
  return out;
}

export function expenseFromRow(r: any): Expense {
  return {
    id: r.id,
    date: r.date,
    category: (r.category ?? "misc") as ExpenseCategory,
    amount: Number(r.amount ?? 0),
    notes: r.notes ?? undefined,
  };
}

/* ---------- Startup items ---------- */

export function startupToRow(i: StartupItem, userId: string) {
  return {
    id: i.id,
    user_id: userId,
    name: i.name,
    budget: i.budget,
    spent: i.spent,
    purchased: !!i.purchased,
    notes: i.notes ?? null,
  };
}

export function startupPatchToRow(p: Partial<StartupItem>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.name !== undefined) out.name = p.name;
  if (p.budget !== undefined) out.budget = p.budget;
  if (p.spent !== undefined) out.spent = p.spent;
  if (p.purchased !== undefined) out.purchased = !!p.purchased;
  if (p.notes !== undefined) out.notes = p.notes ?? null;
  return out;
}

export function startupFromRow(r: any): StartupItem {
  return {
    id: r.id,
    name: r.name,
    budget: Number(r.budget ?? 0),
    spent: Number(r.spent ?? 0),
    purchased: !!r.purchased,
    notes: r.notes ?? undefined,
  };
}

/* ---------- Templates ---------- */

export function templateToRow(t: Template, userId: string) {
  return {
    id: t.id,
    user_id: userId,
    title: t.title,
    body: t.body,
    tag: t.tag,
  };
}

export function templatePatchToRow(p: Partial<Template>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.title !== undefined) out.title = p.title;
  if (p.body !== undefined) out.body = p.body;
  if (p.tag !== undefined) out.tag = p.tag;
  return out;
}

export function templateFromRow(r: any): Template {
  return {
    id: r.id,
    title: r.title,
    body: r.body,
    tag: r.tag ?? "other",
  };
}

/* ---------- Checklist groups ---------- */

export function checklistToRow(c: ChecklistGroup, userId: string) {
  return {
    id: c.id,
    user_id: userId,
    name: c.name,
    kind: c.kind,
    items: c.items,
    appointment_id: c.appointmentId ?? null,
  };
}

export function checklistPatchToRow(p: Partial<ChecklistGroup>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.name !== undefined) out.name = p.name;
  if (p.kind !== undefined) out.kind = p.kind;
  if (p.items !== undefined) out.items = p.items;
  if (p.appointmentId !== undefined) out.appointment_id = p.appointmentId ?? null;
  return out;
}

export function checklistFromRow(r: any): ChecklistGroup {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind as ChecklistGroup["kind"],
    items: r.items ?? [],
    appointmentId: r.appointment_id ?? undefined,
  };
}

/* ---------- Blocked times ---------- */

export function blockToRow(b: BlockedTime, userId: string) {
  return {
    id: b.id,
    user_id: userId,
    start_at: b.start,
    end_at: b.end,
    label: b.label,
    recurring: b.recurring ?? "none",
  };
}

export function blockFromRow(r: any): BlockedTime {
  return {
    id: r.id,
    start: r.start_at,
    end: r.end_at,
    label: r.label,
    recurring: (r.recurring ?? "none") as BlockedTime["recurring"],
  };
}

/* ---------- Settings ---------- */

export function settingsToRow(s: Settings, userId: string) {
  return {
    user_id: userId,
    theme: s.theme,
    buffer_minutes: s.bufferMinutes,
    max_jobs_per_day: s.maxJobsPerDay,
    weekday_evenings: s.weekdayEvenings,
    weekday_unavailable_start: s.weekdayUnavailableStart,
    weekday_unavailable_end: s.weekdayUnavailableEnd,
    startup_goal: s.startupGoal,
    business_name: s.businessName,
    owner_name: s.ownerName,
    contact_phone: s.contactPhone,
  };
}

export function settingsPatchToRow(p: Partial<Settings>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (p.theme !== undefined) out.theme = p.theme;
  if (p.bufferMinutes !== undefined) out.buffer_minutes = p.bufferMinutes;
  if (p.maxJobsPerDay !== undefined) out.max_jobs_per_day = p.maxJobsPerDay;
  if (p.weekdayEvenings !== undefined) out.weekday_evenings = p.weekdayEvenings;
  if (p.weekdayUnavailableStart !== undefined) out.weekday_unavailable_start = p.weekdayUnavailableStart;
  if (p.weekdayUnavailableEnd !== undefined) out.weekday_unavailable_end = p.weekdayUnavailableEnd;
  if (p.startupGoal !== undefined) out.startup_goal = p.startupGoal;
  if (p.businessName !== undefined) out.business_name = p.businessName;
  if (p.ownerName !== undefined) out.owner_name = p.ownerName;
  if (p.contactPhone !== undefined) out.contact_phone = p.contactPhone;
  return out;
}

export function settingsFromRow(r: any): Settings {
  return {
    theme: (r.theme ?? "system") as Settings["theme"],
    bufferMinutes: Number(r.buffer_minutes ?? 30),
    maxJobsPerDay: Number(r.max_jobs_per_day ?? 3),
    weekdayEvenings: !!r.weekday_evenings,
    weekdayUnavailableStart: r.weekday_unavailable_start ?? "08:00",
    weekdayUnavailableEnd: r.weekday_unavailable_end ?? "17:00",
    startupGoal: Number(r.startup_goal ?? 2000),
    businessName: r.business_name ?? "Detail Command",
    ownerName: r.owner_name ?? "",
    contactPhone: r.contact_phone ?? "",
  };
}
