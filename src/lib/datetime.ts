/**
 * Business-timezone date/time helpers.
 *
 * All customer-facing appointment, booking, calendar, and receipt times are
 * displayed in the business's local timezone (America/Los_Angeles), regardless
 * of the device or browser timezone. This module is the single source of truth
 * for those formats.
 *
 * Why this exists: date-fns `format()` always uses the browser's local timezone,
 * so an appointment booked at 8:00 AM PT looks like 11:00 AM if the dashboard
 * is opened in NY. We use Intl.DateTimeFormat with an explicit timeZone option
 * to render in business time everywhere.
 *
 * For NEW code: never call `format(parseISO(appt.start), "...")` for an
 * appointment time. Use the helpers in this file.
 */

export const BUSINESS_TIMEZONE = "America/Los_Angeles";

/* ─────────────────────────────────────────────
   Internal formatters (cached for perf)
───────────────────────────────────────────── */

const dateFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIMEZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
});

const dateLongFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIMEZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
});

const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const dateOnlyFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIMEZONE,
  month: "short",
  day: "numeric",
  year: "numeric",
});

const monthDayFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIMEZONE,
  month: "short",
  day: "numeric",
});

const weekdayLongFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIMEZONE,
  weekday: "long",
  month: "long",
  day: "numeric",
});

/* ─────────────────────────────────────────────
   Coerce input → Date
───────────────────────────────────────────── */

function toDate(input: string | Date | number): Date | null {
  if (input == null) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  if (typeof input === "number") return new Date(input);
  // ISO string — let the Date constructor handle it
  const d = new Date(input);
  return isNaN(d.getTime()) ? null : d;
}

/* ─────────────────────────────────────────────
   Public formatters — appointments / receipts
───────────────────────────────────────────── */

/** "Sun, May 9" in business time. */
export function formatBusinessDate(input: string | Date | number): string {
  const d = toDate(input);
  if (!d) return "";
  return dateFmt.format(d);
}

/** "Sun, May 9, 2026" in business time. */
export function formatBusinessDateLong(input: string | Date | number): string {
  const d = toDate(input);
  if (!d) return "";
  return dateLongFmt.format(d);
}

/** "May 9, 2026" — no weekday, with year. */
export function formatBusinessDateOnly(input: string | Date | number): string {
  const d = toDate(input);
  if (!d) return "";
  return dateOnlyFmt.format(d);
}

/** "May 9" — short month + day, no year. */
export function formatBusinessMonthDay(input: string | Date | number): string {
  const d = toDate(input);
  if (!d) return "";
  return monthDayFmt.format(d);
}

/** "Sunday, May 9". */
export function formatBusinessWeekdayLong(input: string | Date | number): string {
  const d = toDate(input);
  if (!d) return "";
  return weekdayLongFmt.format(d);
}

/** "8:00 AM" in business time. */
export function formatBusinessTime(input: string | Date | number): string {
  const d = toDate(input);
  if (!d) return "";
  return timeFmt.format(d).replace(/ /g, " "); // normalize narrow-NBSP
}

/** "Sun, May 9 · 8:00 AM" — combined. */
export function formatBusinessDateTime(input: string | Date | number): string {
  const d = toDate(input);
  if (!d) return "";
  return `${dateFmt.format(d)} · ${timeFmt.format(d).replace(/ /g, " ")}`;
}

/** "8:00 AM – 10:30 AM" — for an appointment with start + end. */
export function getAppointmentDisplayRange(
  start: string | Date | number,
  end: string | Date | number,
): string {
  const startStr = formatBusinessTime(start);
  const endStr = formatBusinessTime(end);
  if (!startStr) return "";
  if (!endStr) return startStr;
  return `${startStr} – ${endStr}`;
}

/* ─────────────────────────────────────────────
   YYYY-MM-DD <-> Date in business time
───────────────────────────────────────────── */

/** Returns the business-local date as "YYYY-MM-DD" — e.g. an appointment
 * starting at 11pm UTC on May 9 might be May 9 in LA, but May 10 in UTC.
 * Always use this for grouping appointments by "day". */
export function toBusinessDateKey(input: string | Date | number): string {
  const d = toDate(input);
  if (!d) return "";
  // en-CA gives ISO-style "YYYY-MM-DD"
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Returns "HH:mm" (24h) in business time. */
export function toBusinessTimeKey(input: string | Date | number): string {
  const d = toDate(input);
  if (!d) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/* ─────────────────────────────────────────────
   Combine "YYYY-MM-DD" + "HH:mm" → ISO string in UTC representing
   that wall-clock moment in America/Los_Angeles.
───────────────────────────────────────────── */

/**
 * Given a date "YYYY-MM-DD" and time "HH:mm" intended as LA wall-clock,
 * produce an ISO timestamp (UTC-encoded) that represents that exact moment.
 *
 * This is the inverse of how the DB stores things via:
 *   timezone('America/Los_Angeles', p_date::date + p_time::time)
 *
 * Important: do NOT use `new Date("2024-05-09T08:00")` for this — that
 * parses as browser-local time, which gives different results in different
 * timezones. This helper is timezone-stable.
 */
export function combineLocalDateTimeInBusinessTimezone(
  dateStr: string,
  timeStr: string,
): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  if ([y, m, d, hh, mm].some((n) => Number.isNaN(n))) {
    throw new Error(`Invalid date/time: ${dateStr} ${timeStr}`);
  }

  // Strategy: pretend the input is UTC, measure the LA offset at that
  // instant, subtract it. Then re-check using the offset at the *candidate*
  // instant — DST spring-forward / fall-back days have a different offset
  // at the wall-clock moment than at the original guess, so a single pass
  // is wrong on those days.
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm, 0, 0);
  let candidate = utcGuess - getBusinessTzOffsetMsAt(utcGuess);
  // Correct using the offset at the candidate (handles DST transitions)
  candidate = utcGuess - getBusinessTzOffsetMsAt(candidate);
  return new Date(candidate).toISOString();
}

/**
 * Returns the offset (in ms) of America/Los_Angeles relative to UTC at a
 * given UTC instant. Positive when LA is ahead of UTC (never — LA is always
 * behind), so this is normally negative. Used to combine local wall-clock
 * date+time into a real Date.
 */
function getBusinessTzOffsetMsAt(utcMs: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    // Intl returns "24" for midnight in some browsers — normalize
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - utcMs;
}

/* ─────────────────────────────────────────────
   Current "today" in business time
───────────────────────────────────────────── */

/** True if the given timestamp falls on the current business-local date. */
export function isTodayInBusinessTimezone(input: string | Date | number): boolean {
  const d = toDate(input);
  if (!d) return false;
  return toBusinessDateKey(d) === toBusinessDateKey(new Date());
}
