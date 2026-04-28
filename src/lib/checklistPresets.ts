/**
 * Curated preset checklists — battle-tested order of operations for each
 * common detail type. Insert from the Checklists page or Work Mode picker.
 */
import type { ChecklistCategory } from "./types";

export interface ChecklistPreset {
  key: string;
  name: string;
  category: ChecklistCategory;
  description: string;
  items: string[];
}

export const CHECKLIST_PRESETS: ChecklistPreset[] = [
  {
    key: "pre_job",
    name: "Pre-Job — Pack & Prep",
    category: "pre_job",
    description:
      "Run before leaving the shop or driveway. Skipping any of these is how you end up driving back for a chemical or finding out there's no water on-site.",
    items: [
      "Confirm appointment time + customer phone number",
      "Confirm address — open in Maps to verify",
      "Confirm water access on site",
      "Confirm power access on site (or load generator)",
      "Check weather forecast for the job window",
      "Charge polisher, vacuum, blower, lights",
      "Refill chemical bottles (APC, glass, dressing, sealant)",
      "Pack microfiber towels (separate piles: paint / glass / interior / wheels)",
      "Pack pads, brushes, applicators",
      "Load extension cord + hose + foam cannon",
      "Load trash bags + bins + trunk organizer",
      "Confirm gas in van + payment method ready",
    ],
  },
  {
    key: "exterior",
    name: "Exterior Detail — Standard Workflow",
    category: "exterior",
    description:
      "Top-down, contamination-first, dry-before-windows. The order minimizes swirl risk and water spots.",
    items: [
      "Walk-around with customer — note dings, scratches, problem areas",
      "Pre-rinse the whole vehicle (cool the paint)",
      "Wheels & tires: dedicated wheel cleaner + soft brushes",
      "Wheel wells + tire sidewalls degrease",
      "Rinse wheels thoroughly",
      "Foam pre-soak the whole car (top-down)",
      "Two-bucket contact wash with mitt — roof first, panels, lower last",
      "Rinse top to bottom",
      "Bug & tar removal on front end / lower panels",
      "Pat-dry with plush microfiber or blower (NO air-dry — water spots)",
      "Door jambs + trunk + hood lip wiped",
      "Tire shine (apply, let flash, wipe excess)",
      "Spray sealant on paint — wipe in cross-hatch",
      "Glass: outside + mirrors, ammonia-free",
      "Final walk-around inspection in sunlight",
    ],
  },
  {
    key: "interior",
    name: "Interior Detail — Standard Workflow",
    category: "interior",
    description:
      "Top-down, dry-before-wet, glass last. Vacuum settles after wiping so do hard surfaces in the right order.",
    items: [
      "Trash removal — every cup holder, door pocket, console",
      "Remove floor mats (set aside for dedicated cleaning)",
      "Compressed-air blow-out: vents, seat tracks, cracks, console",
      "Vacuum top-down: headliner (if needed) → seats → carpet → trunk",
      "Vacuum mats separately with stiff brush",
      "Brush + APC on hard surfaces (dash, console, doors, trim)",
      "Wipe surfaces with microfiber",
      "Detail brush in vents, buttons, gauge cluster, badging",
      "Cup holders + console bins deep clean",
      "Spot-treat fabric stains (extractor or upholstery cleaner)",
      "Leather conditioner on leather seats (if applicable)",
      "Door jambs + sills wiped",
      "Glass interior: ammonia-free, two-towel method",
      "Replace mats",
      "Light air-freshener (or odor neutralizer if heavy)",
      "Final smell check before handoff",
    ],
  },
  {
    key: "full_detail",
    name: "Full Detail — Best-Path Order",
    category: "full_detail",
    description:
      "Exterior first while interior is dry — minimizes water tracking. Interior is the longer process so you start it after the exterior is rinsed.",
    items: [
      "Walk-around + before photos",
      "Trash-out the interior (open doors, dump cups)",
      "Pre-rinse exterior",
      "Wheels & tires (acid cleaner if iron-heavy, then APC)",
      "Foam + contact wash",
      "Rinse top to bottom",
      "Dry with microfiber + blower",
      "Tire shine + sealant + glass exterior",
      "Move to interior — blow-out vents",
      "Vacuum thoroughly (mats, seats, carpet)",
      "APC + microfiber on all hard surfaces",
      "Detail brush vents, buttons, console",
      "Spot-treat any fabric stains",
      "Glass interior",
      "Door jambs + sills",
      "Final exterior wipe-down (anything that re-spotted)",
      "After photos",
      "Walk-around with customer for approval",
    ],
  },
  {
    key: "interior_restoration",
    name: "Interior Restoration — Deep Reset",
    category: "interior_restoration",
    description:
      "For trashed interiors. Document everything before you touch it (insurance / customer expectations). Plan dry time.",
    items: [
      "Walk-around with customer — confirm scope",
      "Before photos: every stain, damage, problem area",
      "Trash + remove all loose items (bag and label if not trash)",
      "Remove floor mats + (if safe and applicable) front seats",
      "Compressed-air blow-out everything",
      "Pet hair removal: rubber tool + high-suction vacuum",
      "Initial vacuum — get everything you can dry",
      "Pre-treat heavy stains with enzyme/upholstery cleaner",
      "Hot-water extraction on seats + carpets + mats",
      "Repeat extraction passes on the worst areas",
      "Headliner spot-clean (gentle — never soak)",
      "Crevice deep-clean: vents, seat tracks, console seams",
      "Hard-surface APC pass (more aggressive than standard)",
      "Leather deep-clean + condition (if applicable)",
      "Odor treatment: enzyme + ozone or odor bomb (if needed)",
      "Allow drying time (windows cracked, fans running)",
      "Final dressing on plastics + leather",
      "Glass interior",
      "Reinstall seats / mats",
      "After photos showing improvement",
      "Walk-around — let customer inspect",
    ],
  },
  {
    key: "post_job",
    name: "Post-Job — Wrap & Follow-Up",
    category: "post_job",
    description:
      "Don't skip these — payment + reviews + repeat business all live here. Two minutes of work for the next month of revenue.",
    items: [
      "Walk-around with customer — get verbal approval",
      "After photos (clean lighting, multiple angles)",
      "Collect payment — log it in the app",
      "Send review request (use the saved template)",
      "Offer maintenance plan if not already enrolled",
      "Add follow-up reminder for 4–6 weeks out",
      "Mark job complete in the app",
      "Pack up — count tools, no chemicals left behind",
      "Wipe drive-back checklist (next address, gas, time buffer)",
    ],
  },
  {
    key: "equipment_weekly",
    name: "Equipment — Weekly Maintenance",
    category: "equipment",
    description:
      "Run at the end of the week before resetting for the next. Cheap insurance against a Saturday morning equipment failure.",
    items: [
      "Empty + rinse extractor tank",
      "Flush extractor lines with clean water",
      "Empty vacuum — clean filter",
      "Check vacuum hoses for cracks",
      "Drain pressure washer (winter) or run for 30s",
      "Wipe pressure washer pump + check oil",
      "Wash dirty microfiber separately, no fabric softener",
      "Restock chemical bottles for next week",
      "Check tire shine + dressing applicator pads — replace if dirty",
      "Sharpen / replace wheel brushes if worn",
      "Check generator oil + fuel (if used)",
    ],
  },
];

/** Find a preset by key. */
export function findPreset(key: string): ChecklistPreset | undefined {
  return CHECKLIST_PRESETS.find((p) => p.key === key);
}
