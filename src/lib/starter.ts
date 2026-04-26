import { addDays, formatISO, setHours, setMinutes, startOfWeek } from "date-fns";
import type {
  AppData,
  BlockedTime,
  ChecklistGroup,
  Service,
  Settings,
  StartupItem,
  Template,
} from "./types";
import { uid } from "./utils";

/**
 * Starter content for a brand-new account.
 *
 * This is NOT demo/fake activity — it's the menu, scripts, checklists, and
 * equipment categories the user said they want pre-loaded. They can edit or
 * delete anything. No customers, appointments, leads, tasks, or expenses are
 * created — those start empty.
 */
export function makeStarterContent(): {
  services: Service[];
  templates: Template[];
  checklists: ChecklistGroup[];
  startup: StartupItem[];
  blocks: BlockedTime[];
  settings: Settings;
} {
  const services: Service[] = [
    {
      id: uid(),
      name: "Exterior Detail",
      description:
        "Foam wash · Hand wash · Wheels & tires · Dry · Tire shine · Spray protection",
      priceLow: 80,
      priceHigh: 120,
      durationMinutes: 90,
    },
    {
      id: uid(),
      name: "Interior Detail",
      description:
        "Vacuum · Wipe down surfaces · Deep clean plastics · Windows · Light stain removal",
      priceLow: 120,
      priceHigh: 180,
      durationMinutes: 120,
    },
    {
      id: uid(),
      name: "Full Detail",
      description: "Interior + Exterior · Most popular",
      priceLow: 180,
      priceHigh: 250,
      durationMinutes: 180,
    },
  ];

  const addons: Service[] = [
    { id: uid(), name: "Pet hair removal", priceLow: 20, priceHigh: 50, durationMinutes: 20, isAddon: true },
    { id: uid(), name: "Stain extraction", priceLow: 30, priceHigh: 80, durationMinutes: 25, isAddon: true },
    { id: uid(), name: "Spray sealant upgrade", priceLow: 20, priceHigh: 20, durationMinutes: 15, isAddon: true },
    { id: uid(), name: "Quick polish", priceLow: 50, priceHigh: 100, durationMinutes: 45, isAddon: true },
    { id: uid(), name: "Engine bay wipe-down", priceLow: 25, priceHigh: 45, durationMinutes: 20, isAddon: true },
    { id: uid(), name: "Odor treatment", priceLow: 25, priceHigh: 60, durationMinutes: 20, isAddon: true },
  ];

  const templates: Template[] = [
    {
      id: uid(),
      title: "Move off Facebook",
      tag: "intro",
      body: "Hey! It's a bit easier for me to get everything scheduled over text 👍 Shoot me a message at [phone number] and I'll get you taken care of.",
    },
    {
      id: uid(),
      title: "First response",
      tag: "intro",
      body: "Hey! I appreciate you reaching out 👍 What kind of car do you have and how dirty is the interior?",
    },
    {
      id: uid(),
      title: "Booking close",
      tag: "booking",
      body: "I have openings this weekend — Saturday at 10am or 1pm. What works better for you?",
    },
    {
      id: uid(),
      title: "Water/power requirement",
      tag: "booking",
      body: "Perfect, I've got you scheduled for Saturday at 10am 👍 I'll just need access to an outdoor water spigot and a standard outlet and I'll take care of everything else.",
    },
    {
      id: uid(),
      title: "Day-before confirmation",
      tag: "confirm",
      body: "Hey just confirming we're still good for tomorrow at 10am 👍",
    },
    {
      id: uid(),
      title: "On my way",
      tag: "confirm",
      body: "Hey I'm on my way, see you soon 👍",
    },
    {
      id: uid(),
      title: "After-job review request",
      tag: "follow_up",
      body: "I appreciate you letting me take care of your car today 🙌 If you were happy with everything, I'd really appreciate a quick review.",
    },
  ];

  const checklists: ChecklistGroup[] = [
    {
      id: uid(),
      name: "Pre-Job Checklist",
      kind: "pre",
      items: [
        "Confirm customer",
        "Confirm address",
        "Confirm water access",
        "Confirm power access",
        "Check weather forecast",
        "Charge tools if needed",
        "Pack microfiber towels",
        "Pack chemicals",
        "Bring extension cord/hose",
        "Bring trunk organizer",
      ].map((label) => ({ id: uid(), label, done: false })),
    },
    {
      id: uid(),
      name: "Exterior Workflow",
      kind: "exterior",
      items: [
        "Pre-rinse",
        "Foam",
        "Wheels & tires",
        "Contact wash",
        "Rinse",
        "Dry",
        "Tire shine",
        "Spray protection",
        "Final inspection",
      ].map((label) => ({ id: uid(), label, done: false })),
    },
    {
      id: uid(),
      name: "Interior Workflow",
      kind: "interior",
      items: [
        "Trash removal",
        "Blowout",
        "Vacuum",
        "Brush cracks/vents",
        "Clean plastics",
        "Clean cupholders",
        "Clean seats",
        "Clean carpets/mats",
        "Glass",
        "Final smell check",
      ].map((label) => ({ id: uid(), label, done: false })),
    },
    {
      id: uid(),
      name: "Post-Job Checklist",
      kind: "post",
      items: [
        "Take after photos",
        "Collect payment",
        "Ask for review",
        "Offer maintenance plan",
        "Log revenue",
        "Mark job complete",
        "Add follow-up reminder",
      ].map((label) => ({ id: uid(), label, done: false })),
    },
  ];

  // Empty equipment categories — user fills in budget/spent as they purchase.
  const startup: StartupItem[] = [
    "Pressure washer",
    "Wet/dry vacuum",
    "Microfiber towels (bulk)",
    "Chemicals starter pack",
    "Foam cannon",
    "Buckets + grit guards",
    "Brush set",
    "Trunk organizer",
    "Extension cord",
    "Hose + reel",
    "Storage bins",
    "Marketing materials (cards, magnets)",
  ].map((name) => ({
    id: uid(),
    name,
    budget: 0,
    spent: 0,
    purchased: false,
  }));

  // Default M-F day-job blocks for the current week.
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const blocks: BlockedTime[] = Array.from({ length: 5 }, (_, i) => ({
    id: uid(),
    start: formatISO(setMinutes(setHours(addDays(weekStart, i), 8), 0)),
    end: formatISO(setMinutes(setHours(addDays(weekStart, i), 17), 0)),
    label: "Day job",
    recurring: "weekly" as const,
  }));

  const settings: Settings = {
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
  };

  return {
    services: [...services, ...addons],
    templates,
    checklists,
    startup,
    blocks,
    settings,
  };
}

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
