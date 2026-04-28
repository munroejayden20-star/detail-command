import type {
  AppData,
  BlockedTime,
  ChecklistGroup,
  Service,
  Settings,
  StartupItem,
  Template,
} from "./types";

/**
 * Starter content for a brand-new account.
 *
 * Everything is empty. The app starts as a true blank slate — no services,
 * templates, checklists, purchases, or calendar blocks. Users build their
 * business config from scratch on each page.
 */
export function makeStarterContent(): {
  services: Service[];
  templates: Template[];
  checklists: ChecklistGroup[];
  startup: StartupItem[];
  blocks: BlockedTime[];
  settings: Settings;
} {
  const settings: Settings = {
    theme: "system",
    bufferMinutes: 30,
    maxJobsPerDay: 3,
    weekdayEvenings: true,
    weekdayUnavailableStart: "08:00",
    weekdayUnavailableEnd: "17:00",
    startupGoal: 2000,
    businessName: "",
    ownerName: "",
    contactPhone: "",
  };
  return {
    services: [],
    templates: [],
    checklists: [],
    startup: [],
    blocks: [],
    settings,
  };
}

/**
 * Default notification preferences for a new account or any user whose
 * settings row predates Phase 5. Used as a fallback wherever we read
 * notify_* fields off the settings.
 */
export const DEFAULT_NOTIFICATION_PREFS = {
  notificationsEnabled: true,
  notifyAppointments: true,
  notifyPayments: true,
  notifyFollowUps: true,
  notifyReviews: true,
  notifyWeather: true,
  notifyUpdates: true,
  reminderMinutes: 60,
} as const;


/** Empty top-level shape (no records of any kind) — used pre-auth and as
 *  the initial value for the reducer. */
export const EMPTY_DATA: AppData = {
  version: 2,
  customers: [],
  appointments: [],
  leads: [],
  tasks: [],
  services: [],
  expenses: [],
  startup: [],
  templates: [],
  checklists: [],
  blocks: [],
  photos: [],
  notifications: [],
  settings: {
    theme: "system",
    bufferMinutes: 30,
    maxJobsPerDay: 3,
    weekdayEvenings: true,
    weekdayUnavailableStart: "08:00",
    weekdayUnavailableEnd: "17:00",
    startupGoal: 2000,
    businessName: "Detail Command",
    ownerName: "",
    contactPhone: "",
  },
};
