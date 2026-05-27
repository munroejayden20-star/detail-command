/* ============================================================================
 * Booking configurator — shared types + form constants.
 *
 * FormState mirrors the original BookingPage shape exactly so the orchestrator
 * can keep building the same submission payload without translation.
 * ========================================================================== */

export const TOTAL_STEPS = 7;

export interface FormState {
  /** Selected package services. Multi-select — customers can stack packages
   *  the same way they stack add-ons. The submit RPC already accepts a list. */
  serviceIds: string[];
  addonIds: string[];
  /** Per-addon quantity. Used for countable add-ons like spot-stain extraction.
   *  Defaults to 1 when an addon is checked; keys are removed when unchecked.
   *  On submit, the addon id is repeated N times in the payload so the
   *  backend treats N units as N occurrences (no RPC signature change). */
  addonQuantities: Record<string, number>;
  vehicleSize: string;
  vehicleYear: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleColor: string;
  interiorCondition: string;
  exteriorCondition: string;
  petHair: boolean;
  stains: boolean;
  heavyDirt: boolean;
  vehicleNotes: string;
  preferredDate: string;
  preferredTime: string;
  serviceAddress: string;
  name: string;
  phone: string;
  email: string;
  preferredContact: string;
  waterAccess: boolean;
  powerAccess: boolean;
  photoFiles: File[];
  website: string; // honeypot
}

export const EMPTY_FORM: FormState = {
  serviceIds: [],
  addonIds: [],
  addonQuantities: {},
  vehicleSize: "",
  vehicleYear: "",
  vehicleMake: "",
  vehicleModel: "",
  vehicleColor: "",
  interiorCondition: "",
  exteriorCondition: "",
  petHair: false,
  stains: false,
  heavyDirt: false,
  vehicleNotes: "",
  preferredDate: "",
  preferredTime: "",
  serviceAddress: "",
  name: "",
  phone: "",
  email: "",
  preferredContact: "text",
  waterAccess: true,
  powerAccess: true,
  photoFiles: [],
  website: "",
};

/* Order matters — first item is the implied baseline ("listed price applies
 * here"). Compact comes second so the discount cue reads as a perk against
 * the default sedan price, not as a cheaper starting point. */
export const VEHICLE_SIZES = [
  { value: "sedan",     label: "Sedan",       hint: "4-door, midsize car" },
  { value: "compact",   label: "Compact",     hint: "Coupes, hatchbacks · small-car discount" },
  { value: "suv_truck", label: "SUV / Truck", hint: "Mid-size SUV, pickup" },
  { value: "van_xl",    label: "Van / XL",    hint: "Full-size van, large SUV" },
];

export const CONDITION_OPTIONS = [
  { value: "light",   label: "Light",   hint: "Minimal use"        },
  { value: "average", label: "Average", hint: "Normal everyday"    },
  { value: "heavy",   label: "Heavy",   hint: "Heavily neglected"  },
];

export const CONTACT_OPTIONS = [
  { value: "text",  label: "Text"  },
  { value: "call",  label: "Call"  },
  { value: "email", label: "Email" },
];
