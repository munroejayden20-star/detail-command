/* ============================================================================
 * LuxuryScheduler — cinematic date + time picker for the booking configurator.
 *
 * Replaces the native <input type="date"> + plain time-chip grid in Step 4
 * with a fully-custom Apple/Tesla-leaning reservation experience.
 *
 * Architecture:
 *   - MonthHeader        prev / month label / next, with min/max guards
 *   - DayGrid            7-col grid, prev-month + next-month overflow faded
 *   - DayCell            glass tile with hover bloom, density dot, today ring
 *   - HourSegment        weekday-evening / weekend-fullday hint chip
 *   - TimeSlotGrid       2/3-col responsive slot grid
 *   - TimeSlot           card with ember selected state, muted booked state
 *
 * All animations are transform + opacity only. Reduced-motion respected.
 * Uses the existing `timeSlotsForDate`, `availabilityHintForDate`,
 * `isSlotBooked` helpers — no schema changes, no RPC changes.
 * ========================================================================== */

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  Sun,
  Sunset,
} from "lucide-react";
import {
  timeSlotsForDate,
  availabilityHintForDate,
  type TimeSlot,
} from "@/lib/booking-slots";
import { isSlotBooked } from "./form-steps";

const BOOKING_WINDOW_DAYS = 60;
const WEEK_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTH_FMT = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });
const FULL_DAY_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
});

interface BookedSlot {
  start: string;
  end: string;
}

export function LuxuryScheduler({
  date,
  time,
  onDate,
  onTime,
  bookedSlots,
}: {
  /** Selected date as YYYY-MM-DD (or "") */
  date: string;
  /** Selected time as HH:MM (or "") */
  time: string;
  onDate: (date: string) => void;
  onTime: (time: string) => void;
  bookedSlots: BookedSlot[];
}) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  // Same-day bookings are blocked — the earliest selectable date is tomorrow.
  // This is the floor used for disabling tiles, gating prev-month nav, and
  // seeding the initial month view (so user lands on a month with at least
  // one bookable day, even if today is end-of-month).
  const minBookable = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  }, [today]);
  const maxDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + BOOKING_WINDOW_DAYS);
    return d;
  }, [today]);

  // Current month being viewed — defaults to the first bookable date's month,
  // or to the selected date's month if one is already chosen.
  const [viewYM, setViewYM] = useState<{ y: number; m: number }>(() => {
    const seed = date ? parseDateStr(date) : minBookable;
    return { y: seed.getFullYear(), m: seed.getMonth() };
  });
  const [slideDir, setSlideDir] = useState<1 | -1>(1);

  const monthDate = new Date(viewYM.y, viewYM.m, 1);
  const monthLabel = MONTH_FMT.format(monthDate);

  // Prev / next guards
  const prevDisabled =
    viewYM.y < minBookable.getFullYear() ||
    (viewYM.y === minBookable.getFullYear() && viewYM.m <= minBookable.getMonth());
  const nextDisabled =
    viewYM.y > maxDate.getFullYear() ||
    (viewYM.y === maxDate.getFullYear() && viewYM.m >= maxDate.getMonth());

  function shift(delta: 1 | -1) {
    setSlideDir(delta);
    setViewYM((prev) => {
      const d = new Date(prev.y, prev.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  // Booking density by date — how many slots are taken on a given day.
  // Used as a tiny visual indicator on each tile.
  const densityByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const slot of bookedSlots) {
      const day = slot.start.slice(0, 10);
      map.set(day, (map.get(day) ?? 0) + 1);
    }
    return map;
  }, [bookedSlots]);

  // Time slots for the selected date
  const slots = useMemo(() => timeSlotsForDate(date), [date]);
  const hint = availabilityHintForDate(date);
  const isWeekend = useMemo(() => {
    if (!date) return false;
    const d = parseDateStr(date);
    const dow = d.getDay();
    return dow === 0 || dow === 6;
  }, [date]);

  return (
    <div className="space-y-6">
      {/* ── Cinematic frame: glass surface + ember glow underlay ─────── */}
      <div className="relative isolate overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.015]">
        {/* Ambient ember underlay — VERY faint, sits behind everything */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(120%_60%_at_50%_0%,rgba(221,41,20,0.10),transparent_65%),radial-gradient(80%_60%_at_100%_100%,rgba(168,114,70,0.06),transparent_65%)]"
        />

        {/* ── Calendar panel ──────────────────────────────────────────── */}
        <div className="border-b border-white/[0.06] px-4 py-5 sm:px-6 sm:py-6 md:px-8">
          <MonthHeader
            label={monthLabel}
            prevDisabled={prevDisabled}
            nextDisabled={nextDisabled}
            onPrev={() => shift(-1)}
            onNext={() => shift(1)}
          />
          <WeekdayRow />
          <DayGrid
            viewYM={viewYM}
            today={today}
            minBookable={minBookable}
            maxDate={maxDate}
            selectedDate={date}
            slideDir={slideDir}
            densityByDate={densityByDate}
            onSelect={(iso) => {
              if (iso !== date) {
                // Drop time if the previously chosen slot is no longer valid
                // on the new date.
                const nextSlots = timeSlotsForDate(iso);
                const stillValid =
                  nextSlots.some((s) => s.value === time) &&
                  !isSlotBooked(iso, time, bookedSlots);
                onDate(iso);
                if (!stillValid) onTime("");
              }
            }}
          />
        </div>

        {/* ── Time-slot panel ─────────────────────────────────────────── */}
        <div className="px-4 py-5 sm:px-6 sm:py-6 md:px-8">
          <SelectionSummary date={date} time={time} />

          {!date ? (
            <Empty
              icon={<CalendarDays className="h-5 w-5" />}
              title="Pick a date above"
              body="Available windows appear here as soon as a day is selected."
            />
          ) : (
            <>
              <div className="mt-5 flex flex-wrap items-center gap-2.5">
                <HourSegment isWeekend={isWeekend} />
                <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-platinum-300/70">
                  {hint}
                </p>
              </div>

              <div className="mt-5">
                <TimeSlotGrid
                  slots={slots}
                  date={date}
                  selected={time}
                  bookedSlots={bookedSlots}
                  onSelect={onTime}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Month header — prev / month label / next
 * ────────────────────────────────────────────────────────────────────────── */

function MonthHeader({
  label,
  prevDisabled,
  nextDisabled,
  onPrev,
  onNext,
}: {
  label: string;
  prevDisabled: boolean;
  nextDisabled: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-ember-300/85">
          Select a date
        </p>
        <p className="mt-1 font-sans text-xl font-extralight tracking-tight text-platinum-50 sm:text-2xl">
          {label}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <NavButton onClick={onPrev} disabled={prevDisabled} aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </NavButton>
        <NavButton onClick={onNext} disabled={nextDisabled} aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </NavButton>
      </div>
    </div>
  );
}

function NavButton({
  children,
  onClick,
  disabled,
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/[0.03] text-platinum-200 transition-all duration-300 hover:border-ember-400/40 hover:bg-ember-500/10 hover:text-platinum-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-white/12 disabled:hover:bg-white/[0.03] disabled:hover:text-platinum-200"
    >
      {children}
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Weekday header row — S M T W T F S
 * ────────────────────────────────────────────────────────────────────────── */

function WeekdayRow() {
  return (
    <div className="mt-5 grid grid-cols-7 gap-1 sm:gap-1.5">
      {WEEK_LABELS.map((d, i) => (
        <div
          key={i}
          className="text-center font-mono text-[10px] uppercase tracking-[0.24em] text-platinum-300/55"
        >
          {d}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Day grid — 6-row max grid with prev/next-month overflow faded out
 * ────────────────────────────────────────────────────────────────────────── */

interface DayCell {
  date: Date;
  inMonth: boolean;
  iso: string;
}

function DayGrid({
  viewYM,
  today,
  minBookable,
  maxDate,
  selectedDate,
  slideDir,
  densityByDate,
  onSelect,
}: {
  viewYM: { y: number; m: number };
  today: Date;
  minBookable: Date;
  maxDate: Date;
  selectedDate: string;
  slideDir: 1 | -1;
  densityByDate: Map<string, number>;
  onSelect: (iso: string) => void;
}) {
  const reduced = useReducedMotion();
  const cells = useMemo(() => buildMonthGrid(viewYM.y, viewYM.m), [viewYM]);
  const transitionKey = `${viewYM.y}-${viewYM.m}`;

  return (
    <div className="mt-2 overflow-hidden">
      <AnimatePresence mode="wait" custom={slideDir}>
        <motion.div
          key={transitionKey}
          custom={slideDir}
          initial={reduced ? false : { opacity: 0, x: slideDir * 24, filter: "blur(4px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, x: -slideDir * 24, filter: "blur(4px)" }}
          transition={{ duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-7 gap-1 sm:gap-1.5"
        >
          {cells.map((cell, i) => (
            <DayTile
              key={cell.iso}
              cell={cell}
              today={today}
              minBookable={minBookable}
              maxDate={maxDate}
              selected={cell.iso === selectedDate}
              density={densityByDate.get(cell.iso) ?? 0}
              index={i}
              onClick={() => onSelect(cell.iso)}
            />
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Single day tile
 * ────────────────────────────────────────────────────────────────────────── */

function DayTile({
  cell,
  today,
  minBookable,
  maxDate,
  selected,
  density,
  index,
  onClick,
}: {
  cell: DayCell;
  today: Date;
  minBookable: Date;
  maxDate: Date;
  selected: boolean;
  density: number;
  index: number;
  onClick: () => void;
}) {
  const reduced = useReducedMotion();
  const dayMs = cell.date.getTime();
  // `minBookable` is tomorrow (no same-day bookings). Anything earlier is
  // disabled. The today-marker is purely visual: it lets the user orient
  // themselves on the calendar even though today itself isn't bookable.
  const isPast = dayMs < minBookable.getTime();
  const isFuture = dayMs > maxDate.getTime();
  const disabled = isPast || isFuture;
  const isToday = sameDay(cell.date, today);

  // Staggered stagger reveal — each cell appears ~16ms after the previous.
  // Keeps perceived smoothness when the month animates in.
  const stagger = reduced ? 0 : Math.min(index * 0.012, 0.18);

  return (
    <motion.button
      type="button"
      onClick={disabled || !cell.inMonth ? undefined : onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={cell.date.toDateString()}
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1], delay: stagger }}
      className={`group/day relative isolate flex aspect-square min-h-[44px] flex-col items-center justify-center overflow-hidden rounded-xl border text-[13px] font-medium transition-all duration-300 will-change-transform sm:rounded-[14px] ${
        !cell.inMonth
          ? "border-transparent text-platinum-300/20"
          : disabled
            ? "cursor-not-allowed border-white/[0.04] text-platinum-300/25"
            : selected
              ? "border-ember-400/55 text-platinum-50"
              : "border-white/[0.06] bg-white/[0.015] text-platinum-100 hover:border-ember-400/30 hover:bg-white/[0.04] hover:-translate-y-0.5 active:translate-y-0"
      }`}
    >
      {/* L1 — selected-state glow underlay */}
      {selected && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(circle at 50% 60%, rgba(221,41,20,0.32) 0%, rgba(248,114,72,0.10) 50%, transparent 80%)",
            boxShadow:
              "inset 0 0 0 1px rgba(248,114,72,0.45), 0 10px 28px -10px rgba(221,41,20,0.6)",
          }}
        />
      )}

      {/* L2 — hover sheen */}
      {cell.inMonth && !disabled && !selected && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover/day:opacity-100"
          style={{
            background:
              "radial-gradient(80% 80% at 50% 0%, rgba(255,210,180,0.10), transparent 70%)",
          }}
        />
      )}

      {/* Today ring — neutral (today is never bookable; this is a pure
       *  orientation marker so the user can locate "now" on the grid). */}
      {isToday && !selected && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-[3px] rounded-[10px] ring-1 ring-inset ring-white/20"
        />
      )}

      <span
        className={`relative font-sans text-[16px] font-extralight tabular-nums tracking-tight ${
          selected ? "text-platinum-50" : ""
        }`}
        style={
          selected
            ? { textShadow: "0 0 14px rgba(255,180,140,0.65)" }
            : undefined
        }
      >
        {cell.date.getDate()}
      </span>

      {/* Density indicator: tiny dot row showing how full the day is */}
      {cell.inMonth && !disabled && density > 0 && (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-[2px]"
        >
          {Array.from({ length: Math.min(density, 3) }).map((_, i) => (
            <span
              key={i}
              className={`h-[3px] w-[3px] rounded-full ${
                selected ? "bg-ember-200/80" : "bg-platinum-300/45"
              }`}
            />
          ))}
        </span>
      )}
    </motion.button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Hour segment chip — visual indicator for weekend vs weekday hours
 * ────────────────────────────────────────────────────────────────────────── */

function HourSegment({ isWeekend }: { isWeekend: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-platinum-100">
      {isWeekend ? (
        <Sun className="h-3 w-3 text-ember-300" />
      ) : (
        <Sunset className="h-3 w-3 text-ember-300" />
      )}
      {isWeekend ? "Full day" : "Evenings"}
    </span>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Selection summary — small "your slot" banner above time grid
 * ────────────────────────────────────────────────────────────────────────── */

function SelectionSummary({ date, time }: { date: string; time: string }) {
  const dateLabel = date ? FULL_DAY_FMT.format(parseDateStr(date)) : null;
  if (!dateLabel) {
    return (
      <div className="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.24em] text-platinum-300/60">
        <Clock className="h-3.5 w-3.5" />
        Choose a window
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-ember-300/85">
        Selected
      </p>
      <p className="font-sans text-[15px] font-light text-platinum-50">
        {dateLabel}
        {time ? (
          <>
            {" · "}
            <span className="text-ember-200">
              {formatTimeHHMM(time)}
            </span>
          </>
        ) : (
          <span className="ml-1.5 font-mono text-[10.5px] uppercase tracking-[0.22em] text-platinum-300/60">
            — pick a window
          </span>
        )}
      </p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Time-slot grid
 * ────────────────────────────────────────────────────────────────────────── */

function TimeSlotGrid({
  slots,
  date,
  selected,
  bookedSlots,
  onSelect,
}: {
  slots: TimeSlot[];
  date: string;
  selected: string;
  bookedSlots: BookedSlot[];
  onSelect: (v: string) => void;
}) {
  if (slots.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 md:grid-cols-4">
      {slots.map((slot, i) => {
        const booked = isSlotBooked(date, slot.value, bookedSlots);
        const isSelected = selected === slot.value;
        return (
          <TimeSlotCard
            key={slot.value}
            slot={slot}
            booked={booked}
            selected={isSelected}
            index={i}
            onClick={() => onSelect(slot.value)}
          />
        );
      })}
    </div>
  );
}

function TimeSlotCard({
  slot,
  booked,
  selected,
  index,
  onClick,
}: {
  slot: TimeSlot;
  booked: boolean;
  selected: boolean;
  index: number;
  onClick: () => void;
}) {
  const reduced = useReducedMotion();
  return (
    <motion.button
      type="button"
      disabled={booked}
      onClick={booked ? undefined : onClick}
      aria-pressed={selected}
      initial={reduced ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: Math.min(index * 0.025, 0.3) }}
      className={`group/slot relative isolate overflow-hidden rounded-xl border px-3 py-3 text-left transition-all duration-300 will-change-transform ${
        booked
          ? "cursor-not-allowed border-white/[0.04] bg-white/[0.01]"
          : selected
            ? "border-ember-400/55 bg-ember-500/[0.06]"
            : "border-white/[0.08] bg-white/[0.02] hover:border-ember-400/35 hover:bg-white/[0.05] hover:-translate-y-0.5 active:translate-y-0"
      }`}
    >
      {/* Selected glow */}
      {selected && !booked && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(120% 80% at 50% 0%, rgba(221,41,20,0.22), transparent 70%)",
            boxShadow:
              "inset 0 0 0 1px rgba(248,114,72,0.40), 0 14px 32px -14px rgba(221,41,20,0.55)",
          }}
        />
      )}

      {/* Hover sheen */}
      {!booked && !selected && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-300 group-hover/slot:opacity-100"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,210,180,0.06), transparent 60%)",
          }}
        />
      )}

      <div className="flex items-center justify-between gap-2">
        <span
          className={`font-sans tabular-nums tracking-tight ${
            booked
              ? "text-[13.5px] text-platinum-300/35"
              : selected
                ? "text-[14px] font-medium text-platinum-50"
                : "text-[14px] text-platinum-100"
          }`}
          style={
            selected
              ? { textShadow: "0 0 12px rgba(255,180,140,0.5)" }
              : undefined
          }
        >
          {slot.label}
        </span>
        {selected && !booked && (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-ember-300" />
        )}
      </div>
      <p
        className={`mt-0.5 font-mono text-[9.5px] uppercase tracking-[0.22em] ${
          booked
            ? "text-platinum-300/35"
            : selected
              ? "text-ember-200/85"
              : "text-platinum-300/55"
        }`}
      >
        {booked ? "Reserved" : selected ? "Selected" : "Available"}
      </p>
    </motion.button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Empty state — date not yet picked
 * ────────────────────────────────────────────────────────────────────────── */

function Empty({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="mt-6 flex items-center gap-4 rounded-xl border border-dashed border-white/[0.10] bg-white/[0.01] px-4 py-5">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ember-400/30 bg-ember-500/10 text-ember-300">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[13.5px] font-medium text-platinum-50">{title}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-platinum-300/70">
          {body}
        </p>
      </div>
      <Sparkles className="ml-auto hidden h-4 w-4 shrink-0 text-ember-300/40 sm:block" />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────────────────── */

function buildMonthGrid(year: number, month: number): DayCell[] {
  const firstOfMonth = new Date(year, month, 1);
  const dayOfWeek = firstOfMonth.getDay(); // 0 Sun
  const start = new Date(year, month, 1 - dayOfWeek);

  const cells: DayCell[] = [];
  // 6 rows × 7 days = 42 cells — fits every possible month layout
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({
      date: d,
      inMonth: d.getMonth() === month,
      iso: toIsoDateStr(d),
    });
  }
  return cells;
}

function parseDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function toIsoDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatTimeHHMM(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return hhmm;
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h < 12 ? "AM" : "PM";
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}
