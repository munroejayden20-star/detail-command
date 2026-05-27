/* ============================================================================
 * Slot helpers — day-job-aware schedule + slot conflict detection.
 *
 * NOTE: this logic is duplicated in `src/lib/booking-slots.ts` (canonical).
 * Keep them in sync when editing slot hours; dedupe is queued for a follow-up.
 * ========================================================================== */

export function timeSlotsForDate(dateStr: string): { value: string; label: string }[] {
  if (!dateStr) return [];
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3) return [];
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const dow = d.getDay();
  const isWeekend = dow === 0 || dow === 6;
  // Keep in sync with src/lib/booking-slots.ts. Inclusive start/end in
  // minutes-since-midnight — last entry IS the latest bookable start.
  const startMin = isWeekend ? 7 * 60     : 17 * 60 + 30;
  const endMin   = isWeekend ? 18 * 60 + 30 : 18 * 60;
  const slots: { value: string; label: string }[] = [];
  for (let t = startMin; t <= endMin; t += 30) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h < 12 ? "AM" : "PM";
    const label = `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
    slots.push({ value, label });
  }
  return slots;
}

export function availabilityHintForDate(dateStr: string): string {
  if (!dateStr) return "Pick a date to see open windows.";
  const parts = dateStr.split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const dow = d.getDay();
  return dow === 0 || dow === 6
    ? "Weekend windows · 7:00 AM – 7:00 PM"
    : "Weekday evenings · 5:30 PM – 9:00 PM";
}

export function isSlotBooked(
  dateStr: string,
  slotValue: string,
  bookedSlots: { start: string; end: string }[],
): boolean {
  if (!dateStr || !slotValue || bookedSlots.length === 0) return false;
  const slotStart = `${dateStr}T${slotValue}`;
  const [h, m] = slotValue.split(":").map(Number);
  const totalEndMin = h * 60 + m + 30;
  const eh = Math.floor(totalEndMin / 60);
  const em = totalEndMin % 60;
  const slotEnd = `${dateStr}T${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
  return bookedSlots.some((b) => b.start < slotEnd && b.end > slotStart);
}
