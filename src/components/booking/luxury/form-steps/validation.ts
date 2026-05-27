/* ============================================================================
 * Per-step validation. Same rules as the monolithic configurator — exported
 * so the orchestrator (BookingPage) can decide whether Continue is enabled
 * without duplicating the logic.
 * ========================================================================== */

import type { FormState } from "./types";
import { isSlotBooked } from "./slot-helpers";

export function makeCanProceed(
  step: number,
  form: FormState,
  bookedSlots: { start: string; end: string }[],
): boolean {
  switch (step) {
    case 1: return form.serviceIds.length > 0;
    case 2: return true;
    case 3: return !!form.vehicleSize;
    case 4: {
      if (!form.preferredDate || !form.serviceAddress.trim()) return false;
      if (form.preferredTime && isSlotBooked(form.preferredDate, form.preferredTime, bookedSlots)) return false;
      return true;
    }
    case 5: return !!form.name.trim() && !!form.phone.trim();
    case 6: return true;
    case 7: return true;
    default: return true;
  }
}
