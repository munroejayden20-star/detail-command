/**
 * Booking slot computation — shared by the public /book form and the customer
 * portal's reschedule UI. Pure functions, no React.
 *
 * Jayden's hours:
 *   Mon–Fri: evenings only, 5:30 PM – 9:00 PM
 *   Sat–Sun: full day, 7:00 AM – 7:00 PM
 *
 * Slots are 30-minute increments. Dates are local-wall-clock (YYYY-MM-DD).
 */

export interface TimeSlot {
  value: string;
  label: string;
}

export function timeSlotsForDate(dateStr: string): TimeSlot[] {
  if (!dateStr) return [];
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return [];
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const dow = d.getDay(); // 0 Sun, 6 Sat
  const isWeekend = dow === 0 || dow === 6;
  const startHour = isWeekend ? 7 : 17;
  const startMinute = isWeekend ? 0 : 30;
  const endHour = isWeekend ? 19 : 21;

  const slots: TimeSlot[] = [];
  for (let h = startHour; h < endHour; h++) {
    for (const m of [0, 30]) {
      if (h === startHour && m < startMinute) continue;
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const ampm = h < 12 ? "AM" : "PM";
      slots.push({ value, label: `${hour12}:${String(m).padStart(2, "0")} ${ampm}` });
    }
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
    ? "Weekends — full day available, 7 AM to 7 PM."
    : "Weekdays — evenings only, 5:30 PM to 9 PM.";
}
