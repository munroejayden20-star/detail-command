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

export interface StartupItem {
  id: ID;
  name: string;
  budget: number;
  spent: number;
  purchased: boolean;
  notes?: string;
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

export interface ChecklistGroup {
  id: ID;
  name: string;
  kind: "pre" | "exterior" | "interior" | "post";
  items: ChecklistItem[];
  appointmentId?: ID;
}

export interface BlockedTime {
  id: ID;
  start: string;
  end: string;
  label: string;
  recurring?: "none" | "weekly";
}

export interface Settings {
  theme: "light" | "dark" | "system";
  bufferMinutes: number;
  maxJobsPerDay: number;
  weekdayEvenings: boolean;
  weekdayUnavailableStart: string; // HH:mm
  weekdayUnavailableEnd: string;
  startupGoal: number;
  businessName: string;
  ownerName: string;
  contactPhone: string;
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
  settings: Settings;
}
