export type ID = string;

export type JobStatus =
  | "inquiry"
  | "scheduled"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "follow_up"
  | "canceled";

export const JOB_STATUSES: { value: JobStatus; label: string; tone: string }[] = [
  { value: "inquiry", label: "Inquiry", tone: "status-inquiry" },
  { value: "scheduled", label: "Scheduled", tone: "status-scheduled" },
  { value: "confirmed", label: "Confirmed", tone: "status-confirmed" },
  { value: "in_progress", label: "In Progress", tone: "status-in-progress" },
  { value: "completed", label: "Completed", tone: "status-completed" },
  { value: "follow_up", label: "Needs Follow-Up", tone: "status-follow-up" },
  { value: "canceled", label: "Canceled", tone: "status-canceled" },
];

export type LeadStatus =
  | "new"
  | "contacted"
  | "waiting"
  | "booked"
  | "lost";

export const LEAD_STATUSES: { value: LeadStatus; label: string }[] = [
  { value: "new", label: "New lead" },
  { value: "contacted", label: "Contacted" },
  { value: "waiting", label: "Waiting response" },
  { value: "booked", label: "Booked" },
  { value: "lost", label: "Lost" },
];

export type LeadSource =
  | "facebook"
  | "dealership"
  | "referral"
  | "google"
  | "other";

export type Priority = "low" | "medium" | "high";
export type PaymentStatus = "unpaid" | "deposit" | "paid";

export interface Vehicle {
  year: string;
  make: string;
  model: string;
  color: string;
  conditionNotes?: string;
}

export interface Customer {
  id: ID;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  vehicles: Vehicle[];
  notes?: string;
  isRepeat?: boolean;
  isMonthlyMaintenance?: boolean;
  createdAt: string;
}

export interface Service {
  id: ID;
  name: string;
  description?: string;
  priceLow: number;
  priceHigh: number;
  durationMinutes: number;
  isAddon?: boolean;
}

export interface Appointment {
  id: ID;
  customerId: ID;
  vehicle: Vehicle;
  address: string;
  start: string; // ISO
  end: string; // ISO
  serviceIds: ID[];
  addonIds: ID[];
  estimatedPrice: number;
  finalPrice?: number;
  depositPaid: boolean;
  paymentStatus: PaymentStatus;
  status: JobStatus;
  interiorCondition?: string;
  exteriorCondition?: string;
  petHair: boolean;
  stains: boolean;
  heavyDirt: boolean;
  waterAccess: boolean;
  powerAccess: boolean;
  customerNotes?: string;
  internalNotes?: string;
  beforePhotos?: string[];
  afterPhotos?: string[];
  reminderSent?: boolean;
  travelTimeNotes?: string;
  createdAt: string;
}

export interface Lead {
  id: ID;
  name: string;
  phone?: string;
  source: LeadSource;
  vehicle?: string;
  interest: "low" | "medium" | "high";
  lastContacted?: string;
  followUpDate?: string;
  status: LeadStatus;
  notes?: string;
  createdAt: string;
}

export interface Task {
  id: ID;
  title: string;
  category: TaskCategory;
  priority: Priority;
  dueDate?: string;
  completed: boolean;
  recurring?: "none" | "daily" | "weekly" | "monthly";
  notes?: string;
  appointmentId?: ID;
  createdAt: string;
}

export type TaskCategory =
  | "supplies"
  | "leads"
  | "confirmations"
  | "marketing"
  | "maintenance"
  | "general";

export const TASK_CATEGORIES: { value: TaskCategory; label: string }[] = [
  { value: "supplies", label: "Supplies" },
  { value: "leads", label: "Leads" },
  { value: "confirmations", label: "Confirmations" },
  { value: "marketing", label: "Marketing" },
  { value: "maintenance", label: "Equipment Maintenance" },
  { value: "general", label: "General" },
];

export interface Expense {
  id: ID;
  date: string;
  category: ExpenseCategory;
  amount: number;
  notes?: string;
}

export type ExpenseCategory =
  | "products"
  | "equipment"
  | "gas"
  | "marketing"
  | "misc";

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "products", label: "Products / Chemicals" },
  { value: "equipment", label: "Equipment" },
  { value: "gas", label: "Gas / Travel" },
  { value: "marketing", label: "Marketing" },
  { value: "misc", label: "Miscellaneous" },
];

export type PurchaseCategory =
  | "pressure_washer"
  | "hoses"
  | "chemicals"
  | "towels"
  | "interior_tools"
  | "polisher"
  | "extractor"
  | "generator"
  | "water_tank"
  | "van_setup"
  | "branding"
  | "business"
  | "misc";

export const PURCHASE_CATEGORIES: { value: PurchaseCategory; label: string }[] = [
  { value: "pressure_washer", label: "Pressure washer setup" },
  { value: "hoses", label: "Hoses & fittings" },
  { value: "chemicals", label: "Chemicals" },
  { value: "towels", label: "Towels" },
  { value: "interior_tools", label: "Interior tools" },
  { value: "polisher", label: "Polisher / pads" },
  { value: "extractor", label: "Extractor" },
  { value: "generator", label: "Generator" },
  { value: "water_tank", label: "Water tank" },
  { value: "van_setup", label: "Van setup" },
  { value: "branding", label: "Branding / marketing" },
  { value: "business", label: "Business / legal" },
  { value: "misc", label: "Miscellaneous" },
];

export type PurchaseStatus = "want" | "need_soon" | "saving" | "purchased" | "delayed";

export const PURCHASE_STATUSES: { value: PurchaseStatus; label: string; tone: string }[] = [
  { value: "want", label: "Want", tone: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
  { value: "need_soon", label: "Need Soon", tone: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" },
  { value: "saving", label: "Saving For", tone: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200" },
  { value: "purchased", label: "Purchased", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200" },
  { value: "delayed", label: "Delayed", tone: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200" },
];

export interface StartupItem {
  id: ID;
  name: string;
  /** Planned/target budget */
  budget: number;
  /** Amount spent toward this item (legacy — also tracks partial payments) */
  spent: number;
  purchased: boolean;
  notes?: string;
  /** Purchase category */
  category?: PurchaseCategory;
  /** Priority (high/medium/low) */
  priority?: Priority;
  /** Lifecycle status */
  status?: PurchaseStatus;
  /** Optional product link */
  link?: string;
  /** Target date to purchase */
  targetDate?: string;
  /** Actual paid cost once purchased */
  actualCost?: number;
}

export interface Template {
  id: ID;
  title: string;
  body: string;
  tag: string;
}

export interface ChecklistItem {
  id: ID;
  label: string;
  done: boolean;
}

export type ChecklistCategory =
  | "pre_job"
  | "exterior"
  | "interior"
  | "full_detail"
  | "interior_restoration"
  | "post_job"
  | "equipment"
  | "supplies"
  | "marketing"
  | "admin"
  | "custom";

export const CHECKLIST_CATEGORIES: { value: ChecklistCategory; label: string }[] = [
  { value: "pre_job", label: "Pre-Job" },
  { value: "exterior", label: "Exterior Detail" },
  { value: "interior", label: "Interior Detail" },
  { value: "full_detail", label: "Full Detail" },
  { value: "interior_restoration", label: "Interior Restoration" },
  { value: "post_job", label: "Post-Job" },
  { value: "equipment", label: "Equipment" },
  { value: "supplies", label: "Supplies" },
  { value: "marketing", label: "Marketing" },
  { value: "admin", label: "Admin" },
  { value: "custom", label: "Custom" },
];

export interface ChecklistGroup {
  id: ID;
  name: string;
  /** Legacy field — kept for backwards compatibility with old rows. */
  kind?: "pre" | "exterior" | "interior" | "post" | string;
  category: ChecklistCategory;
  description?: string;
  items: ChecklistItem[];
  appointmentId?: ID;
  customerId?: ID;
  vehicle?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BlockedTime {
  id: ID;
  start: string;
  end: string;
  label: string;
  recurring?: "none" | "weekly";
}

export type PhotoType =
  | "before"
  | "after"
  | "general"
  | "vehicle"
  | "damage"
  | "proof"
  | "marketing";

export const PHOTO_TYPES: { value: PhotoType; label: string; tone: string }[] = [
  { value: "before", label: "Before", tone: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" },
  { value: "after", label: "After", tone: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200" },
  { value: "general", label: "General", tone: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
  { value: "vehicle", label: "Vehicle", tone: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200" },
  { value: "damage", label: "Damage", tone: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200" },
  { value: "proof", label: "Proof", tone: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200" },
  { value: "marketing", label: "Marketing", tone: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-200" },
];

export interface Photo {
  id: ID;
  storagePath: string;
  type: PhotoType;
  customerId?: ID;
  appointmentId?: ID;
  vehicle?: string;
  notes?: string;
  tags?: string[];
  width?: number;
  height?: number;
  sizeBytes?: number;
  createdAt: string;
}

export interface Settings {
  // ── Appearance ──────────────────────────────────────────────────────────
  theme: "light" | "dark" | "system";
  accentColor?: string;

  // ── Profile & Business ───────────────────────────────────────────────────
  businessName: string;
  ownerName: string;
  contactPhone: string;
  email?: string;
  serviceArea?: string;
  serviceAreaRadius?: number;       // miles
  businessDescription?: string;
  googleReviewLink?: string;
  avatarUrl?: string;
  logoUrl?: string;

  // ── Scheduling ───────────────────────────────────────────────────────────
  bufferMinutes: number;
  maxJobsPerDay: number;
  weekdayEvenings: boolean;
  weekdayUnavailableStart: string;  // HH:mm  (unavailable block start on weekdays)
  weekdayUnavailableEnd: string;    // HH:mm  (unavailable block end on weekdays)
  weekendAvailability: boolean;
  workdayStart: string;             // HH:mm  (when work day starts)
  workdayEnd: string;               // HH:mm  (when work day ends)
  defaultAppointmentDuration: number; // minutes

  // ── Defaults & Messaging ─────────────────────────────────────────────────
  defaultTaxRate?: number;          // percentage, e.g. 8.5
  defaultTravelFee?: number;        // dollars
  defaultQuoteDisclaimer?: string;
  defaultConfirmationMessage?: string;
  defaultFollowUpDays?: number;     // days after completion to follow up
  defaultReviewRequestMessage?: string;

  // ── Booking Page (future feature) ────────────────────────────────────────
  bookingPageEnabled?: boolean;
  bookingPageSlug?: string;
  autoConfirmBookings?: boolean;
  depositRequired?: boolean;
  depositAmount?: number;

  // ── Notifications ────────────────────────────────────────────────────────
  notificationsEnabled?: boolean;
  notifyAppointments?: boolean;
  notifyPayments?: boolean;
  notifyFollowUps?: boolean;
  notifyReviews?: boolean;
  notifyWeather?: boolean;
  notifyUpdates?: boolean;
  reminderMinutes?: number;

  // ── Legacy (kept for backward-compat, no longer shown in UI) ─────────────
  startupGoal: number;
}

export type NotificationType =
  | "appointment_soon"
  | "appointment_today"
  | "appointment_tomorrow"
  | "appointment_needs_confirm"
  | "appointment_completed"
  | "appointment_missing_payment"
  | "follow_up_due"
  | "review_due"
  | "maintenance_due"
  | "task_due"
  | "low_supply"
  | "weather_warning"
  | "deposit_received"
  | "invoice_paid"
  | "invoice_overdue"
  | "missing_before_photos"
  | "missing_after_photos"
  | "checklist_incomplete"
  | "app_update_available"
  | "app_update_completed"
  | "info";

export const NOTIFICATION_TYPE_META: Record<
  NotificationType,
  { label: string; icon: string; tone: string; group: NotificationGroup }
> = {
  appointment_soon: { label: "Appointment soon", icon: "Clock", tone: "primary", group: "appointments" },
  appointment_today: { label: "Today's appointment", icon: "CalendarDays", tone: "primary", group: "appointments" },
  appointment_tomorrow: { label: "Tomorrow's appointment", icon: "CalendarDays", tone: "primary", group: "appointments" },
  appointment_needs_confirm: { label: "Needs confirmation", icon: "AlertCircle", tone: "amber", group: "appointments" },
  appointment_completed: { label: "Appointment completed", icon: "CheckCircle2", tone: "emerald", group: "appointments" },
  appointment_missing_payment: { label: "Missing payment", icon: "DollarSign", tone: "amber", group: "payments" },
  follow_up_due: { label: "Follow-up due", icon: "Bell", tone: "violet", group: "followups" },
  review_due: { label: "Review request", icon: "Star", tone: "amber", group: "reviews" },
  maintenance_due: { label: "Maintenance due", icon: "Repeat", tone: "primary", group: "followups" },
  task_due: { label: "Task due", icon: "CheckSquare", tone: "primary", group: "tasks" },
  low_supply: { label: "Low supply", icon: "Wrench", tone: "amber", group: "tasks" },
  weather_warning: { label: "Weather warning", icon: "CloudRain", tone: "amber", group: "weather" },
  deposit_received: { label: "Deposit received", icon: "DollarSign", tone: "emerald", group: "payments" },
  invoice_paid: { label: "Invoice paid", icon: "DollarSign", tone: "emerald", group: "payments" },
  invoice_overdue: { label: "Invoice overdue", icon: "AlertCircle", tone: "rose", group: "payments" },
  missing_before_photos: { label: "Missing before photos", icon: "ImageOff", tone: "amber", group: "appointments" },
  missing_after_photos: { label: "Missing after photos", icon: "ImageOff", tone: "amber", group: "appointments" },
  checklist_incomplete: { label: "Checklist incomplete", icon: "ListChecks", tone: "amber", group: "appointments" },
  app_update_available: { label: "Update available", icon: "Download", tone: "primary", group: "updates" },
  app_update_completed: { label: "App updated", icon: "CheckCircle2", tone: "emerald", group: "updates" },
  info: { label: "Notification", icon: "Bell", tone: "slate", group: "info" },
};

export type NotificationGroup =
  | "appointments"
  | "payments"
  | "followups"
  | "reviews"
  | "tasks"
  | "weather"
  | "updates"
  | "info";

export interface Notification {
  id: ID;
  type: NotificationType;
  title: string;
  message?: string;
  linkUrl?: string;
  metadata?: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export interface AppData {
  version: number;
  customers: Customer[];
  appointments: Appointment[];
  leads: Lead[];
  tasks: Task[];
  services: Service[];
  expenses: Expense[];
  startup: StartupItem[];
  templates: Template[];
  checklists: ChecklistGroup[];
  blocks: BlockedTime[];
  photos: Photo[];
  notifications: Notification[];
  settings: Settings;
}
