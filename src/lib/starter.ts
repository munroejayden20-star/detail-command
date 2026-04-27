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
        "Two-bucket hand wash with foam pre-soak. Wheels, tires, and wells degreased. Bug & tar removal as needed. Hand-dried with microfiber, tire shine, and a spray sealant for 1–2 months of beading. Best for cars that get washed regularly.",
      priceLow: 80,
      priceHigh: 120,
      durationMinutes: 90,
    },
    {
      id: uid(),
      name: "Interior Detail",
      description:
        "Full trash-out, blow-out, and vacuum (seats, carpets, mats, trunk, cracks, vents). All hard surfaces cleaned and dressed — dash, console, doors, trim. Light stain spot-treatment on seats and carpet. Glass inside. Final smell check before I hand it back.",
      priceLow: 120,
      priceHigh: 180,
      durationMinutes: 120,
    },
    {
      id: uid(),
      name: "Full Detail",
      description:
        "Most popular package — combines the Interior + Exterior Detail end-to-end. Full hand wash, wheels, tires, dry, sealant, plus a complete interior reset (vacuum, surfaces, glass, light stain work). Best for vehicles that haven't been detailed in a while.",
      priceLow: 180,
      priceHigh: 250,
      durationMinutes: 180,
    },
    {
      id: uid(),
      name: "Interior Restoration Detail",
      description:
        "Deep interior reset for heavily soiled vehicles. Hot-water extraction on seats and carpets. Heavy stain and pet-hair removal. Crevice and trim deep-clean. Optional seat removal when safely applicable to reach under-seat areas. Optional odor treatment to neutralize smoke, pet, food, or mildew. Starting at $350; pricing scales to $600+ depending on size, condition, and add-ons.",
      priceLow: 350,
      priceHigh: 600,
      durationMinutes: 300,
    },
  ];

  const addons: Service[] = [
    { id: uid(), name: "Pet hair removal", description: "Heavy pet hair pulled with rubber tools and high-suction extraction. For cars with fur embedded in carpet/seats.", priceLow: 20, priceHigh: 50, durationMinutes: 20, isAddon: true },
    { id: uid(), name: "Stain extraction", description: "Hot-water extraction on seats, carpet, and mats. Best for coffee, soda, food, and water stains.", priceLow: 30, priceHigh: 80, durationMinutes: 25, isAddon: true },
    { id: uid(), name: "Odor treatment", description: "Neutralizer-and-enzyme treatment for smoke, pet, food, or mildew odors. Pairs well with stain extraction.", priceLow: 25, priceHigh: 60, durationMinutes: 20, isAddon: true },
    { id: uid(), name: "Spray sealant upgrade", description: "Steps up the exterior protection from base spray to a longer-lasting ceramic spray sealant. 3–6 months of beading.", priceLow: 20, priceHigh: 20, durationMinutes: 15, isAddon: true },
    { id: uid(), name: "Interior protectant upgrade", description: "Premium UV/protectant on dash, console, and trim. Reduces fading and gives a clean satin finish (no greasy shine).", priceLow: 15, priceHigh: 30, durationMinutes: 10, isAddon: true },
    { id: uid(), name: "Quick polish", description: "Hand polish on hood, roof, and trunk to remove light swirls and improve gloss. Not a full paint correction.", priceLow: 50, priceHigh: 100, durationMinutes: 45, isAddon: true },
    { id: uid(), name: "Engine bay wipe-down", description: "Plastics and covers cleaned and dressed. Visual refresh — does not include pressure washing of electrical.", priceLow: 25, priceHigh: 45, durationMinutes: 20, isAddon: true },
    { id: uid(), name: "Heavy mud / dirt prep", description: "Extra pre-rinse and degrease pass for mud, off-road dirt, or construction grime before the main wash.", priceLow: 20, priceHigh: 40, durationMinutes: 15, isAddon: true },
    { id: uid(), name: "Excessive trash removal", description: "For interiors with significant trash buildup. Bagged and removed before the detail begins.", priceLow: 15, priceHigh: 35, durationMinutes: 15, isAddon: true },
    { id: uid(), name: "Water spot treatment", description: "Acid-safe water-spot remover on glass and paint. For cars left under sprinklers or hard-water dripping.", priceLow: 20, priceHigh: 50, durationMinutes: 20, isAddon: true },
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

  const now = new Date().toISOString();
  const checklists: ChecklistGroup[] = [
    {
      id: uid(),
      name: "Pre-Job Checklist",
      category: "pre_job",
      kind: "pre",
      createdAt: now,
      updatedAt: now,
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
      category: "exterior",
      kind: "exterior",
      createdAt: now,
      updatedAt: now,
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
      category: "interior",
      kind: "interior",
      createdAt: now,
      updatedAt: now,
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
      category: "post_job",
      kind: "post",
      createdAt: now,
      updatedAt: now,
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

  // Empty planned-purchase rows — user fills in budget/cost as they go.
  const startup: StartupItem[] = (
    [
      ["Pressure washer", "pressure_washer"],
      ["Wet/dry vacuum", "interior_tools"],
      ["Microfiber towels (bulk)", "towels"],
      ["Chemicals starter pack", "chemicals"],
      ["Foam cannon", "pressure_washer"],
      ["Buckets + grit guards", "interior_tools"],
      ["Brush set", "interior_tools"],
      ["Trunk organizer", "van_setup"],
      ["Extension cord", "van_setup"],
      ["Hose + reel", "hoses"],
      ["Storage bins", "van_setup"],
      ["Marketing materials (cards, magnets)", "branding"],
    ] as const
  ).map(([name, category]) => ({
    id: uid(),
    name,
    budget: 0,
    spent: 0,
    purchased: false,
    category,
    priority: "medium" as const,
    status: "want" as const,
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
