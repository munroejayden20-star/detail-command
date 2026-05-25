/**
 * Booking slot computation — shared by the public /book form and the customer
 * portal's reschedule UI. Pure functions, no React.
 *
 * Jayden's hours:
 *   Mon–Fri: 5:30 PM – 6:00 PM (slot starts; last appointment starts at 6:00 PM)
 *   Sat–Sun: 7:00 AM – 6:30 PM (slot starts; last appointment starts at 6:30 PM)
 *
 * Slots are 30-minute increments. Dates are local-wall-clock (YYYY-MM-DD).
 */

export interface TimeSlot {
  value: string;
  label: string;
}

// Slot start range in minutes-since-midnight, inclusive on both ends.
// Tweak these to widen / narrow availability without touching the loop.
const WEEKDAY_START_MIN = 17 * 60 + 30; // 5:30 PM
const WEEKDAY_END_MIN   = 18 * 60;      // 6:00 PM  (last bookable start)
const WEEKEND_START_MIN = 7 * 60;       // 7:00 AM
const WEEKEND_END_MIN   = 18 * 60 + 30; // 6:30 PM  (last bookable start)

export function timeSlotsForDate(dateStr: string): TimeSlot[] {
  if (!dateStr) return [];
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return [];
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const dow = d.getDay(); // 0 Sun, 6 Sat
  const isWeekend = dow === 0 || dow === 6;
  const startMin = isWeekend ? WEEKEND_START_MIN : WEEKDAY_START_MIN;
  const endMin   = isWeekend ? WEEKEND_END_MIN   : WEEKDAY_END_MIN;

  const slots: TimeSlot[] = [];
  for (let t = startMin; t <= endMin; t += 30) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h < 12 ? "AM" : "PM";
    slots.push({ value, label: `${hour12}:${String(m).padStart(2, "0")} ${ampm}` });
  }
  return slots;
}

export function availabilityHintForDate(dateStr: string): string {
  if (!dateStr) return "Pick a date to see open times.";
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3) return "Pick a date to see open times.";
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const dow = d.getDay();
  return dow === 0 || dow === 6
    ? "Weekends — 7 AM to 6:30 PM start."
    : "Weekdays — 5:30 PM or 6:00 PM start.";
}
