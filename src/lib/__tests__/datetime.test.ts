import { describe, it, expect } from "vitest";
import {
  BUSINESS_TIMEZONE,
  formatBusinessDate,
  formatBusinessTime,
  formatBusinessDateTime,
  formatBusinessDateOnly,
  toBusinessDateKey,
  toBusinessTimeKey,
  combineLocalDateTimeInBusinessTimezone,
  getAppointmentDisplayRange,
  isTodayInBusinessTimezone,
} from "../datetime";

describe("datetime — business timezone is America/Los_Angeles", () => {
  it("exports the expected timezone", () => {
    expect(BUSINESS_TIMEZONE).toBe("America/Los_Angeles");
  });
});

describe("combineLocalDateTimeInBusinessTimezone", () => {
  it("8am LA on a PDT day produces a UTC instant 7h later", () => {
    // June 15 — definitely PDT (UTC-7). 08:00 LA = 15:00 UTC.
    const iso = combineLocalDateTimeInBusinessTimezone("2025-06-15", "08:00");
    const d = new Date(iso);
    expect(d.toISOString()).toBe("2025-06-15T15:00:00.000Z");
  });

  it("8am LA on a PST day produces a UTC instant 8h later", () => {
    // January 15 — PST (UTC-8). 08:00 LA = 16:00 UTC.
    const iso = combineLocalDateTimeInBusinessTimezone("2025-01-15", "08:00");
    const d = new Date(iso);
    expect(d.toISOString()).toBe("2025-01-15T16:00:00.000Z");
  });

  it("round-trips: combine then format back to LA wall-clock matches input", () => {
    const cases = [
      ["2025-03-09", "08:00"], // DST starts in US — tricky
      ["2025-06-15", "14:30"],
      ["2025-11-02", "01:30"], // DST ends — also tricky
      ["2025-12-25", "23:45"],
    ];
    for (const [date, time] of cases) {
      const iso = combineLocalDateTimeInBusinessTimezone(date, time);
      expect(toBusinessDateKey(iso)).toBe(date);
      expect(toBusinessTimeKey(iso)).toBe(time);
    }
  });

  it("throws on invalid input", () => {
    expect(() => combineLocalDateTimeInBusinessTimezone("not-a-date", "08:00")).toThrow();
  });
});

describe("display formatters always render in business timezone", () => {
  // 2025-06-15T15:00:00Z is 8:00 AM PDT in LA
  const iso = "2025-06-15T15:00:00Z";

  it("formatBusinessTime", () => {
    expect(formatBusinessTime(iso)).toMatch(/^8:00\s*AM$/);
  });

  it("formatBusinessDate (weekday + month + day, no year)", () => {
    expect(formatBusinessDate(iso)).toMatch(/^Sun, Jun 15$/);
  });

  it("formatBusinessDateTime combines both with bullet separator", () => {
    expect(formatBusinessDateTime(iso)).toMatch(/^Sun, Jun 15 · 8:00\s*AM$/);
  });

  it("formatBusinessDateOnly includes year", () => {
    expect(formatBusinessDateOnly(iso)).toMatch(/^Jun 15, 2025$/);
  });

  it("returns empty string for null / invalid input", () => {
    expect(formatBusinessTime("")).toBe("");
    expect(formatBusinessDate("garbage")).toBe("");
  });
});

describe("getAppointmentDisplayRange", () => {
  it("renders the start and end times in LA", () => {
    const start = "2025-06-15T15:00:00Z"; // 8am PDT
    const end = "2025-06-15T17:30:00Z"; // 10:30am PDT
    expect(getAppointmentDisplayRange(start, end)).toMatch(/^8:00\s*AM\s*–\s*10:30\s*AM$/);
  });
});

describe("toBusinessDateKey crosses dates correctly", () => {
  it("a UTC instant late in the day maps to LA's earlier date", () => {
    // 2025-06-16T05:00:00Z is 2025-06-15 22:00 PDT
    expect(toBusinessDateKey("2025-06-16T05:00:00Z")).toBe("2025-06-15");
  });

  it("an LA-midnight instant maps to that date", () => {
    expect(toBusinessDateKey("2025-06-15T07:00:00Z")).toBe("2025-06-15"); // exactly midnight LA
  });
});

describe("isTodayInBusinessTimezone", () => {
  it("returns true for now()", () => {
    expect(isTodayInBusinessTimezone(new Date())).toBe(true);
  });
  it("returns false for an instant 30 days ago", () => {
    const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    expect(isTodayInBusinessTimezone(past)).toBe(false);
  });
});
