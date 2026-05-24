/* ============================================================================
 * Booking configurator — form steps + shell.
 *
 * Preserves the 7-step flow + validation contract of the original BookingPage,
 * but each step is restyled and animated for the luxury treatment. The shell
 * orchestrates step transitions with framer-motion AnimatePresence (mode=wait)
 * so steps slide + blur out before the next slides in.
 *
 * All shared form types are defined locally (FormState), kept identical to
 * the original so the orchestrator can keep using the same submission payload.
 * ========================================================================== */

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import type { PublicService, PublicDepositInfo } from "@/lib/booking-api";
import { EmberCTA, LiquidProgress, Reveal } from "./primitives";

/* ─────────────────────────────────────────────────────────────────────────────
 * Form state — identical shape to the original BookingPage so the orchestrator
 * can build the same submission payload without translation.
 * ──────────────────────────────────────────────────────────────────────── */

export interface FormState {
  /** Selected package services. Multi-select — customers can stack packages
   *  the same way they stack add-ons. The submit RPC already accepts a list. */
  serviceIds: string[];
  addonIds: string[];
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

export const TOTAL_STEPS = 7;

export const VEHICLE_SIZES = [
  { value: "compact",   label: "Compact",   hint: "Coupes, hatchbacks"      },
  { value: "sedan",     label: "Sedan",     hint: "Full-size sedans, sports"},
  { value: "suv_truck", label: "SUV / Truck", hint: "Mid-size SUV, pickup"  },
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

/* ─────────────────────────────────────────────────────────────────────────────
 * Slot helpers — copied verbatim from the original BookingPage to preserve
 * the day-job-aware schedule + slot conflict detection. (Logic unchanged.)
 * ──────────────────────────────────────────────────────────────────────── */

export function timeSlotsForDate(dateStr: string): { value: string; label: string }[] {
  if (!dateStr) return [];
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3) return [];
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const dow = d.getDay();
  const isWeekend = dow === 0 || dow === 6;
  const startHour = isWeekend ? 7 : 17;
  const startMinute = isWeekend ? 0 : 30;
  const endHour = isWeekend ? 19 : 21;
  const slots: { value: string; label: string }[] = [];
  for (let h = startHour; h < endHour; h++) {
    for (const m of [0, 30]) {
      if (h === startHour && m < startMinute) continue;
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const ampm = h < 12 ? "AM" : "PM";
      const label = `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
      slots.push({ value, label });
    }
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

/* ─────────────────────────────────────────────────────────────────────────────
 * Shared atomic pieces — input chrome, toggles, condition selectors.
 *
 * Premium input style: hairline border, lowercased mono label above, ember
 * focus ring on caret. No "outlined" boxes everywhere.
 * ──────────────────────────────────────────────────────────────────────── */

function activeDiscount(s: PublicService) {
  const d = s.discount;
  if (!d?.active || !d.value) return null;
  if (d.expiry && new Date(d.expiry) < new Date()) return null;
  return d;
}

function applyDiscount(price: number, d: NonNullable<PublicService["discount"]>) {
  if (d.type === "percent") return Math.round(price * (1 - d.value / 100));
  return Math.max(0, price - d.value);
}

function midPrice(s: PublicService) {
  const base = s.priceLow;
  const d = activeDiscount(s);
  return d ? applyDiscount(base, d) : base;
}

function fmtPrice(low: number, high: number) {
  if (low === high) return `$${low}`;
  return `$${low}–$${high}`;
}

function fmtDuration(minutes: number) {
  if (minutes >= 60) {
    const hours = Math.round((minutes / 60) * 10) / 10;
    return `${hours}h`;
  }
  return `${minutes}min`;
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/80">
        {label} {required ? <span className="text-ember-300">*</span> : null}
      </span>
      <div className="mt-2">{children}</div>
      {hint ? <span className="mt-1.5 block font-mono text-[10.5px] tracking-[0.16em] text-platinum-300/55">{hint}</span> : null}
    </label>
  );
}

const inputCls =
  "block w-full appearance-none rounded-none border-b border-white/20 bg-transparent py-2.5 text-[15px] text-platinum-50 placeholder:text-platinum-300/40 outline-none transition-all focus:border-ember-400 focus:[box-shadow:inset_0_-1px_0_rgba(248,114,72,0.7)]";

function SelectChips<T extends string>({
  options,
  value,
  onChange,
  cols = 3,
}: {
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
  cols?: 2 | 3 | 4;
}) {
  const colCls = cols === 4 ? "grid-cols-2 md:grid-cols-4" : cols === 3 ? "grid-cols-3" : "grid-cols-2";
  return (
    <div className={`grid gap-2 ${colCls}`}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`group relative overflow-hidden border px-4 py-3 text-left transition-all ${
              active
                ? "border-ember-400/70 bg-ember-500/[0.08]"
                : "border-white/12 bg-white/[0.02] hover:border-white/25"
            }`}
            style={{ borderRadius: 2 }}
          >
            {active && (
              <span
                aria-hidden
                className="absolute inset-0 bg-gradient-to-br from-ember-500/10 via-transparent to-transparent"
              />
            )}
            <span className={`relative font-sans text-[14px] font-normal ${active ? "text-platinum-50" : "text-platinum-100"}`}>
              {o.label}
            </span>
            {o.hint ? (
              <span className="relative mt-0.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-platinum-300/65">
                {o.hint}
              </span>
            ) : null}
            <span
              aria-hidden
              className={`absolute bottom-0 left-0 h-px bg-ember-400 transition-all duration-500 ${active ? "w-full" : "w-0 group-hover:w-1/3"}`}
            />
          </button>
        );
      })}
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="group flex w-full items-center justify-between gap-4 border-b border-white/10 py-4 text-left transition-colors hover:bg-white/[0.02]"
    >
      <span>
        <span className="block font-sans text-[14.5px] text-platinum-50">{label}</span>
        {hint ? <span className="mt-0.5 block font-mono text-[10.5px] uppercase tracking-[0.22em] text-platinum-300/70">{hint}</span> : null}
      </span>
      <span
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors ${
          checked ? "border-ember-400/70 bg-ember-500/30" : "border-white/15 bg-white/[0.03]"
        }`}
      >
        <motion.span
          className={`absolute top-0.5 h-6 w-6 rounded-full ${checked ? "bg-ember-300 shadow-[0_0_18px_rgba(248,114,72,0.6)]" : "bg-platinum-200"}`}
          animate={{ x: checked ? 20 : 2 }}
          transition={{ type: "spring", stiffness: 380, damping: 26 }}
        />
      </span>
    </button>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ExpandableDescription — clamped paragraph + "Read more" toggle.
 *
 * The toggle only renders when the clamped paragraph actually overflows. We
 * measure scrollHeight vs clientHeight on every resize via ResizeObserver so
 * the affordance stays correct across viewport changes. The toggle stops
 * propagation so it never triggers the parent tile's select/toggle.
 *
 * Designed to live inside a clickable card wrapper rendered as
 * <div role="button">, since a real <button> inside another <button> is
 * invalid HTML — the package/add-on tiles use role-button wrappers for that
 * reason.
 *
 * `clampClass` lets the caller pick line-clamp-2 (compact addons) or
 * line-clamp-3 (more breathing room on packages).
 */
function ExpandableDescription({
  text,
  clampClass = "line-clamp-2",
}: {
  text: string;
  clampClass?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const descRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (!text) return;
    function measure() {
      const el = descRef.current;
      if (!el) return;
      if (el.dataset.clamped === "true") {
        setOverflows(el.scrollHeight - 1 > el.clientHeight);
      }
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (descRef.current) ro.observe(descRef.current);
    return () => ro.disconnect();
  }, [text]);

  return (
    <>
      <p
        ref={descRef}
        data-clamped={!expanded}
        className={`whitespace-pre-line text-[13px] leading-relaxed text-platinum-300/85 ${
          expanded ? "" : clampClass
        }`}
      >
        {text}
      </p>
      {overflows ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.26em] text-ember-300 transition-colors hover:text-ember-200"
        >
          {expanded ? "Show less" : "Read more"}
          <ChevronDown
            className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>
      ) : null}
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * STEP 1 — Service
 * ──────────────────────────────────────────────────────────────────────── */

function Step1Service({
  services,
  form,
  set,
}: {
  services: PublicService[];
  form: FormState;
  set: (patch: Partial<FormState>) => void;
}) {
  const packages = services.filter((s) => !s.isAddon);
  return (
    <div className="space-y-7">
      <StepHeader
        kicker="Step one"
        title="Choose your packages."
        body="Pick anything that applies — tap to add, tap again to remove."
      />
      {packages.length === 0 ? (
        <p className="text-platinum-300/70">No packages available right now. Check back soon.</p>
      ) : (
        <ul className="space-y-3">
          {packages.map((s) => {
            const selected = form.serviceIds.includes(s.id);
            const disc = activeDiscount(s);
            const lo = disc ? applyDiscount(s.priceLow, disc) : s.priceLow;
            const hi = disc ? applyDiscount(s.priceHigh, disc) : s.priceHigh;
            const toggle = () => {
              // Toggle in/out of the selection. Same pattern as add-ons —
              // the submit RPC already accepts an array of service ids.
              const next = selected
                ? form.serviceIds.filter((id) => id !== s.id)
                : [...form.serviceIds, s.id];
              set({ serviceIds: next });
            };
            return (
              <li key={s.id}>
                {/*
                 * role="button" instead of a real <button> so the description's
                 * "Read more" toggle (a real <button>) can nest legally. Outer
                 * div is keyboard-accessible via tabIndex + onKeyDown.
                 */}
                <div
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected}
                  onClick={toggle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggle();
                    }
                  }}
                  className={`group relative w-full overflow-hidden border p-5 text-left transition-all md:p-6 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/70 ${
                    selected
                      ? "border-ember-400/70 bg-ember-500/[0.06]"
                      : "border-white/10 bg-white/[0.015] hover:border-white/25"
                  }`}
                  style={{ borderRadius: 2 }}
                >
                  <div className="grid grid-cols-[auto_1fr_auto] items-start gap-4">
                    {/* check indicator — left rail, mirrors the addon UI so the
                     *  "multi-select" affordance reads immediately. */}
                    <span
                      className={`mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border transition-colors ${
                        selected ? "border-ember-400 bg-ember-500/40" : "border-white/30"
                      }`}
                      aria-hidden
                    >
                      {selected ? <CheckCircle2 className="h-3.5 w-3.5 text-platinum-50" /> : null}
                    </span>

                    <div>
                      <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-ember-300">
                        Package
                      </p>
                      <h4 className="mt-1.5 font-sans text-xl font-light text-platinum-50 md:text-[22px]">
                        {s.name.split(" ").slice(0, -1).join(" ")}{" "}
                        <span className="font-display italic font-light text-ember-200/95">
                          {s.name.split(" ").slice(-1).join(" ") || s.name}
                        </span>
                      </h4>
                      {s.description ? (
                        <div className="mt-2 max-w-[56ch]">
                          <ExpandableDescription text={s.description} clampClass="line-clamp-3" />
                        </div>
                      ) : null}
                      <p className="mt-3 font-mono text-[10.5px] uppercase tracking-[0.22em] text-platinum-300/70">
                        Est. {fmtDuration(s.durationMinutes)} · Mobile
                      </p>
                    </div>
                    <div className="text-right">
                      {disc ? (
                        <>
                          <p className="font-mono text-[11px] text-platinum-300/50 line-through">{fmtPrice(s.priceLow, s.priceHigh)}</p>
                          <p className="font-sans text-2xl font-light text-copper-200">{fmtPrice(lo, hi)}</p>
                        </>
                      ) : (
                        <p className="font-sans text-2xl font-light text-platinum-50">{fmtPrice(s.priceLow, s.priceHigh)}</p>
                      )}
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.32em] text-platinum-300/70">starting</p>
                    </div>
                  </div>

                  <span
                    aria-hidden
                    className={`absolute bottom-0 left-0 h-px bg-ember-400 transition-all duration-700 ${selected ? "w-full" : "w-0 group-hover:w-1/4"}`}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {form.serviceIds.length > 1 ? (
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-platinum-300/65">
          {form.serviceIds.length} packages selected
        </p>
      ) : null}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * STEP 2 — Add-ons
 * ──────────────────────────────────────────────────────────────────────── */

function Step2Addons({
  services,
  form,
  set,
  estimatedPrice,
}: {
  services: PublicService[];
  form: FormState;
  set: (patch: Partial<FormState>) => void;
  estimatedPrice: number;
}) {
  const addons = services.filter((s) => s.isAddon);
  return (
    <div className="space-y-7">
      <StepHeader
        kicker="Step two"
        title="Add to your scope."
        body="Optional. Stack what's relevant — skip what isn't."
      />
      {addons.length === 0 ? (
        <p className="text-platinum-300/70">No add-ons listed. Continue to vehicle details.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {addons.map((s) => {
            const checked = form.addonIds.includes(s.id);
            const toggle = () => {
              const ids = checked
                ? form.addonIds.filter((id) => id !== s.id)
                : [...form.addonIds, s.id];
              set({ addonIds: ids });
            };
            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                aria-pressed={checked}
                onClick={toggle}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle();
                  }
                }}
                className={`group relative flex items-start justify-between gap-4 overflow-hidden border p-4 text-left transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/70 ${
                  checked
                    ? "border-ember-400/70 bg-ember-500/[0.06]"
                    : "border-white/10 bg-white/[0.015] hover:border-white/25"
                }`}
                style={{ borderRadius: 2 }}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-3">
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-sm border transition-colors ${
                        checked ? "border-ember-400 bg-ember-500/40" : "border-white/30"
                      }`}
                    >
                      {checked ? <CheckCircle2 className="h-3.5 w-3.5 text-platinum-50" /> : null}
                    </span>
                    <span className="font-sans text-[14.5px] text-platinum-50">{s.name}</span>
                  </span>
                  {s.description ? (
                    <div className="ml-8 mt-1">
                      <ExpandableDescription text={s.description} clampClass="line-clamp-2" />
                    </div>
                  ) : null}
                </span>
                <span className="shrink-0 font-mono text-[12px] uppercase tracking-[0.22em] text-platinum-100">
                  +{fmtPrice(s.priceLow, s.priceHigh)}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="border-t border-white/10 pt-5">
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-platinum-300/85">Running estimate</span>
          <span className="font-sans text-2xl font-light text-platinum-50">
            <motion.span
              key={estimatedPrice}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              ~${estimatedPrice}
            </motion.span>
          </span>
        </div>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-platinum-300/55">
          Final price after on-site inspection
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * STEP 3 — Vehicle (signature step)
 *
 * Renders a photographic plate of the selected size class. Image assets live
 * in `/public/cars/{value}.{jpg,webp}` (where `value` is the form's
 * `vehicleSize`). The owner controls which exact vehicle photo represents
 * each class — the configurator just references it by slot.
 *
 * The plate frames the image with the same editorial chrome the rest of the
 * page uses: hairline-bordered card, mono registration callouts, gradient
 * scrim top + bottom so the image fades into the page rather than sitting in
 * a hard-edged box. Crossfade with blur when the selection changes.
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Image catalogue per size slot. Each entry is a label + a list of candidate
 * image paths the plate will try in order; first one that loads wins. This
 * lets the owner drop in any of `compact.jpg`, `compact.webp`, or
 * `compact.png` without touching code.
 *
 * Suggested reference vehicles (the look the plate is composed around):
 *   compact   → Toyota Prius (current gen)
 *   sedan     → Tesla Model 3 Performance
 *   suv_truck → Lamborghini Urus
 *   van_xl    → cargo / box van
 *
 * The actual photo file is the owner's choice — drop one image per slot into
 * `public/cars/` and it appears here. Missing files fall back to an
 * "image not yet placed" state so the form remains usable.
 */
const VEHICLE_IMAGE_SOURCES: Record<
  string,
  { label: string; sources: string[] }
> = {
  compact: {
    label: "COMPACT",
    sources: ["/cars/compact.webp", "/cars/compact.jpg", "/cars/compact.png"],
  },
  sedan: {
    label: "SEDAN",
    sources: ["/cars/sedan.webp", "/cars/sedan.jpg", "/cars/sedan.png"],
  },
  suv_truck: {
    label: "SUV / TRUCK",
    sources: ["/cars/suv_truck.webp", "/cars/suv_truck.jpg", "/cars/suv_truck.png"],
  },
  van_xl: {
    label: "VAN / XL",
    sources: ["/cars/van_xl.webp", "/cars/van_xl.jpg", "/cars/van_xl.png"],
  },
};

function VehicleImagePlate({ selected }: { selected: string }) {
  const slot = VEHICLE_IMAGE_SOURCES[selected];
  const hasSelection = !!slot;
  return (
    <div
      className="relative overflow-hidden border border-white/10 bg-gradient-to-b from-obsidian-850/85 via-obsidian-900/80 to-obsidian-950/90"
      style={{ borderRadius: 2 }}
    >
      {/* top callouts — brand-name reference removed; only neutral chrome */}
      <div className="relative z-10 flex items-baseline justify-between px-5 pt-5 font-mono text-[10px] uppercase tracking-[0.32em] text-platinum-300/75">
        <span>plate · {hasSelection ? selected.toUpperCase() : "—"}</span>
        <span className="text-platinum-300/55">
          {hasSelection ? "ref" : "select a size"}
        </span>
      </div>

      {/* image stage */}
      <div className="relative mt-4 aspect-[16/9] w-full overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {hasSelection ? (
            <motion.div
              key={selected}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 1.04, filter: "blur(14px)" }}
              animate={{ opacity: 1, scale: 1,    filter: "blur(0)"  }}
              exit   ={{ opacity: 0, scale: 1.02, filter: "blur(10px)" }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <VehicleImage sources={slot.sources} label={slot.label} />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              className="absolute inset-0 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-50"
                style={{
                  backgroundImage:
                    "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
                  backgroundSize: "14px 14px",
                  maskImage:
                    "radial-gradient(ellipse 70% 55% at 50% 50%, black 30%, transparent 80%)",
                }}
              />
              <p className="relative font-mono text-[10.5px] uppercase tracking-[0.34em] text-platinum-300/55">
                Select a size to render the plate
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* top + bottom gradient scrims — fade image into page */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-obsidian-900/95 via-obsidian-900/40 to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-obsidian-950/95 via-obsidian-950/40 to-transparent" />

        {/* corner ember brackets */}
        <span aria-hidden className="pointer-events-none absolute left-3 top-3 h-4 w-4 border-l border-t border-ember-400/55" />
        <span aria-hidden className="pointer-events-none absolute right-3 top-3 h-4 w-4 border-r border-t border-ember-400/55" />
        <span aria-hidden className="pointer-events-none absolute left-3 bottom-3 h-4 w-4 border-l border-b border-ember-400/55" />
        <span aria-hidden className="pointer-events-none absolute right-3 bottom-3 h-4 w-4 border-r border-b border-ember-400/55" />

        {/* subtle film grain overlay so the photo feels developed, not stock */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-[0.07]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.7 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")",
            backgroundSize: "240px 240px",
          }}
        />
      </div>

      {/* bottom callouts */}
      <div className="relative z-10 flex items-baseline justify-between px-5 pb-5 pt-2 font-mono text-[10px] uppercase tracking-[0.32em] text-platinum-300/85">
        <span>{hasSelection ? slot.label : "—"}</span>
        <span className="text-platinum-300/55">
          {hasSelection ? `class · 0${Object.keys(VEHICLE_IMAGE_SOURCES).indexOf(selected) + 1}` : "class · —"}
        </span>
      </div>
    </div>
  );
}

/**
 * VehicleImage — tries each candidate source in order. If they all fail
 * (file not in `/public/cars/`), renders a clean "missing asset" panel that
 * tells the owner exactly where to drop the file. Avoids showing a busted
 * broken-image icon to customers.
 */
function VehicleImage({ sources, label }: { sources: string[]; label: string }) {
  const [idx, setIdx] = useState(0);
  const [failed, setFailed] = useState(false);

  // Reset state when the set of sources changes (i.e. selection switch).
  // Stable join() key — re-renders only fire when the array contents change.
  const key = sources.join("|");
  useEffect(() => {
    setIdx(0);
    setFailed(false);
  }, [key]);

  if (failed) return <MissingAssetPanel label={label} />;

  return (
    <img
      key={`${key}-${idx}`}
      src={sources[idx]}
      alt={`${label} reference photo`}
      loading="lazy"
      decoding="async"
      onError={() => {
        if (idx < sources.length - 1) {
          setIdx((i) => i + 1);
        } else {
          setFailed(true);
        }
      }}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}

function MissingAssetPanel({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)",
          backgroundSize: "14px 14px",
          maskImage:
            "radial-gradient(ellipse 70% 55% at 50% 50%, black 30%, transparent 80%)",
        }}
      />
      <p className="relative font-mono text-[10px] uppercase tracking-[0.34em] text-ember-300/85">
        Plate awaits
      </p>
      <p className="relative mt-2 font-sans text-base font-extralight text-platinum-100">
        Drop a <span className="font-display italic">{label}</span> photo
      </p>
      <p className="relative mt-2 max-w-[40ch] font-mono text-[10px] uppercase tracking-[0.22em] text-platinum-300/60">
        public / cars / {label.toLowerCase().replace(/\s+\/\s+/g, "_").replace(/\s+/g, "_")}.jpg
      </p>
    </div>
  );
}







function Step3Vehicle({
  form,
  set,
}: {
  form: FormState;
  set: (patch: Partial<FormState>) => void;
}) {
  return (
    <div className="space-y-7">
      <StepHeader
        kicker="Step three"
        title="Tell me about the vehicle."
        body="Helps me load the right products and set realistic time."
      />

      <VehicleImagePlate selected={form.vehicleSize} />


      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/80">
          Size <span className="text-ember-300">*</span>
        </p>
        <div className="mt-3">
          <SelectChips
            options={VEHICLE_SIZES}
            value={form.vehicleSize}
            onChange={(v) => set({ vehicleSize: v })}
            cols={4}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Year">
          <input className={inputCls} value={form.vehicleYear}  placeholder="2019"   inputMode="numeric" onChange={(e) => set({ vehicleYear: e.target.value })} />
        </Field>
        <Field label="Make">
          <input className={inputCls} value={form.vehicleMake}  placeholder="Toyota"               onChange={(e) => set({ vehicleMake:  e.target.value })} />
        </Field>
        <Field label="Model">
          <input className={inputCls} value={form.vehicleModel} placeholder="Camry"                onChange={(e) => set({ vehicleModel: e.target.value })} />
        </Field>
        <Field label="Color">
          <input className={inputCls} value={form.vehicleColor} placeholder="Black"                onChange={(e) => set({ vehicleColor: e.target.value })} />
        </Field>
      </div>

      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/80">Interior</p>
        <div className="mt-3">
          <SelectChips
            options={CONDITION_OPTIONS}
            value={form.interiorCondition}
            onChange={(v) => set({ interiorCondition: v })}
          />
        </div>
      </div>
      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/80">Exterior</p>
        <div className="mt-3">
          <SelectChips
            options={CONDITION_OPTIONS}
            value={form.exteriorCondition}
            onChange={(v) => set({ exteriorCondition: v })}
          />
        </div>
      </div>

      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/80">Additional notes</p>
        <div className="mt-1 border-t border-white/10">
          <ToggleRow label="Pet hair"        hint="Dog, cat, or other"           checked={form.petHair}   onChange={(v) => set({ petHair: v })} />
          <ToggleRow label="Stains"          hint="Visible seat/carpet stains"   checked={form.stains}    onChange={(v) => set({ stains: v })} />
          <ToggleRow label="Heavy dirt / mud" hint="Caked mud, heavy road grime" checked={form.heavyDirt} onChange={(v) => set({ heavyDirt: v })} />
        </div>
      </div>

      <Field label="Notes" hint="Anything specific I should know.">
        <textarea
          rows={3}
          className={`${inputCls} resize-none`}
          placeholder="Cracked trim on driver side, dog rides shotgun, etc."
          value={form.vehicleNotes}
          onChange={(e) => set({ vehicleNotes: e.target.value })}
        />
      </Field>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * STEP 4 — Date / Time / Location
 * ──────────────────────────────────────────────────────────────────────── */

function Step4DateTime({
  form,
  set,
  bookedSlots,
}: {
  form: FormState;
  set: (patch: Partial<FormState>) => void;
  bookedSlots: { start: string; end: string }[];
}) {
  const today = new Date().toISOString().split("T")[0];
  const slots = timeSlotsForDate(form.preferredDate);
  const hint  = availabilityHintForDate(form.preferredDate);

  return (
    <div className="space-y-7">
      <StepHeader
        kicker="Step four"
        title="When and where."
        body="Pick a window — I'll confirm exact time when I reach out."
      />

      <Field label="Date" required>
        <input
          type="date"
          min={today}
          className={inputCls}
          value={form.preferredDate}
          onChange={(e) => {
            const newSlots = timeSlotsForDate(e.target.value);
            const newDate  = e.target.value;
            const stillValid =
              newSlots.some((s) => s.value === form.preferredTime) &&
              !isSlotBooked(newDate, form.preferredTime, bookedSlots);
            set({
              preferredDate: newDate,
              preferredTime: stillValid ? form.preferredTime : "",
            });
          }}
        />
      </Field>

      <div>
        <div className="flex items-baseline justify-between">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/80">Window</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember-300/85">{hint}</p>
        </div>
        <div className="mt-3">
          {slots.length === 0 ? (
            <div className="border border-dashed border-white/15 px-4 py-6 text-center font-mono text-[11px] uppercase tracking-[0.28em] text-platinum-300/65">
              Pick a date to render times
            </div>
          ) : (
            <div className="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
              {slots.map((opt) => {
                const booked   = isSlotBooked(form.preferredDate, opt.value, bookedSlots);
                const selected = form.preferredTime === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={booked}
                    onClick={() => set({ preferredTime: opt.value })}
                    className={`relative border px-2 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] transition-all ${
                      booked
                        ? "cursor-not-allowed border-white/5 text-platinum-300/30 line-through"
                        : selected
                        ? "border-ember-400/70 bg-ember-500/[0.08] text-platinum-50"
                        : "border-white/12 bg-white/[0.02] text-platinum-200 hover:border-white/25"
                    }`}
                    style={{ borderRadius: 2 }}
                  >
                    {opt.label}
                    {booked ? (
                      <span className="absolute -top-1.5 -right-1.5 rounded-full bg-obsidian-700 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.18em] text-platinum-300/85">
                        booked
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Field label="Service address" required hint="Where I should pull up.">
        <textarea
          rows={2}
          className={`${inputCls} resize-none`}
          placeholder="123 Main St, Vancouver, WA 98660"
          value={form.serviceAddress}
          onChange={(e) => set({ serviceAddress: e.target.value })}
        />
      </Field>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * STEP 5 — Contact
 * ──────────────────────────────────────────────────────────────────────── */

function Step5Contact({
  form,
  set,
}: {
  form: FormState;
  set: (patch: Partial<FormState>) => void;
}) {
  return (
    <div className="space-y-7">
      <StepHeader
        kicker="Step five"
        title="How do I reach you?"
        body="Used to confirm and follow up. Nothing else."
      />
      <Field label="Full name" required>
        <input className={inputCls} value={form.name}  autoComplete="name" placeholder="Alex Johnson"     onChange={(e) => set({ name:  e.target.value })} />
      </Field>
      <Field label="Phone" required>
        <input type="tel"   className={inputCls} value={form.phone} autoComplete="tel"  placeholder="(360) 555-1234" onChange={(e) => set({ phone: e.target.value })} />
      </Field>
      <Field label="Email" hint="Optional. For confirmation emails.">
        <input type="email" className={inputCls} value={form.email} autoComplete="email" placeholder="alex@example.com" onChange={(e) => set({ email: e.target.value })} />
      </Field>

      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/80">Reach me by</p>
        <div className="mt-3">
          <SelectChips
            options={CONTACT_OPTIONS}
            value={form.preferredContact}
            onChange={(v) => set({ preferredContact: v })}
          />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * STEP 6 — Access + Photos
 * ──────────────────────────────────────────────────────────────────────── */

function Step6Access({
  form,
  set,
}: {
  form: FormState;
  set: (patch: Partial<FormState>) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previews     = useMemo(() => form.photoFiles.map((f) => URL.createObjectURL(f)), [form.photoFiles]);

  // revoke previews on unmount to avoid memory leak
  useEffect(() => {
    return () => previews.forEach((u) => URL.revokeObjectURL(u));
  }, [previews]);

  return (
    <div className="space-y-7">
      <StepHeader
        kicker="Step six"
        title="Site access & photos."
        body="A spigot, an outlet, and a 30-second walkaround — that's all."
      />

      <div className="border-t border-white/10">
        <ToggleRow
          label="Outdoor water spigot"
          hint="Standard garden hose hookup"
          checked={form.waterAccess}
          onChange={(v) => set({ waterAccess: v })}
        />
        <ToggleRow
          label="Standard 120V outlet"
          hint="Within 50 ft of where the car will sit"
          checked={form.powerAccess}
          onChange={(v) => set({ powerAccess: v })}
        />
      </div>

      {(!form.waterAccess || !form.powerAccess) && (
        <div className="border-l-2 border-copper-300 bg-copper-500/[0.06] px-4 py-3">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-copper-200">Note</p>
          <p className="mt-1 text-[13px] text-platinum-100">
            No worries — I'll bring extra gear and we'll plan the spot together before I arrive.
          </p>
        </div>
      )}

      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/80">
          Vehicle photos · optional · up to 4
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []).slice(0, 4 - form.photoFiles.length);
            set({ photoFiles: [...form.photoFiles, ...files].slice(0, 4) });
            e.target.value = "";
          }}
        />

        {form.photoFiles.length < 4 && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="mt-3 flex w-full items-center justify-between border border-dashed border-white/15 bg-white/[0.015] px-5 py-5 text-left transition-colors hover:border-white/30"
            style={{ borderRadius: 2 }}
          >
            <span>
              <span className="font-mono text-[11px] uppercase tracking-[0.28em] text-ember-300">Add photos</span>
              <span className="mt-1 block text-[13px] text-platinum-200/85">Tap or drag — JPG, PNG, WebP</span>
            </span>
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-obsidian-900">
              <Upload className="h-4 w-4 text-platinum-100" />
            </span>
          </button>
        )}

        {form.photoFiles.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {form.photoFiles.map((f, i) => (
              <div key={i} className="relative aspect-square overflow-hidden border border-white/10" style={{ borderRadius: 2 }}>
                <img src={previews[i]} alt="" className="absolute inset-0 h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => set({ photoFiles: form.photoFiles.filter((_, j) => j !== i) })}
                  className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-obsidian-950/85 backdrop-blur-md transition-colors hover:bg-ember-500/80"
                  aria-label={`Remove photo ${i + 1}`}
                >
                  <X className="h-3.5 w-3.5 text-platinum-50" />
                </button>
                <span className="absolute bottom-1.5 left-1.5 font-mono text-[9px] uppercase tracking-[0.28em] text-platinum-50/80">
                  /{String(i + 1).padStart(2, "0")}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * STEP 7 — Review (Configuration card)
 *
 * This is the "configurator summary" moment. Mimics a Tesla / Porsche
 * configurator: spec rows organized by category, an "ESTIMATE" line at the
 * bottom, a deposit pane when required.
 * ──────────────────────────────────────────────────────────────────────── */

function Step7Review({
  form,
  services,
  estimatedPrice,
  disclaimer,
  deposit,
}: {
  form: FormState;
  services: PublicService[];
  estimatedPrice: number;
  disclaimer?: string;
  deposit?: PublicDepositInfo;
}) {
  const selectedServices = services.filter((s) => form.serviceIds.includes(s.id));
  const selectedAddons   = services.filter((s) => form.addonIds.includes(s.id));
  const selectedSize     = VEHICLE_SIZES.find((s) => s.value === form.vehicleSize);
  const selectedTime     = timeSlotsForDate(form.preferredDate).find((t) => t.value === form.preferredTime);

  return (
    <div className="space-y-8">
      <StepHeader
        kicker="Step seven"
        title="Confirm your configuration."
        body="One last read-through. You can step back to edit anything."
      />

      <div className="relative overflow-hidden border border-white/10 bg-obsidian-850/85" style={{ borderRadius: 2 }}>
        <div className="border-b border-white/10 px-5 py-4 md:px-8 md:py-5">
          <div className="flex items-baseline justify-between gap-4">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-ember-300">
              Configuration Sheet
            </p>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-platinum-300/70">
              #{Math.abs(hashConfig(form)).toString(16).slice(0, 6).toUpperCase()}
            </p>
          </div>
        </div>

        <ReviewBlock kicker="Service">
          <ReviewRow
            k={selectedServices.length > 1 ? "Packages" : "Package"}
            v={selectedServices.map((s) => s.name).join(", ") || undefined}
          />
          {selectedAddons.length > 0 ? (
            <ReviewRow k="Add-ons"      v={selectedAddons.map((a) => a.name).join(", ")} />
          ) : null}
          <ReviewRow k="Estimate" v={<span className="font-sans text-lg text-platinum-50">~${estimatedPrice}</span>} />
        </ReviewBlock>

        <ReviewBlock kicker="Vehicle">
          <ReviewRow k="Size"          v={selectedSize?.label} />
          {(form.vehicleYear || form.vehicleMake || form.vehicleModel) ? (
            <ReviewRow k="Vehicle"     v={[form.vehicleYear, form.vehicleMake, form.vehicleModel, form.vehicleColor].filter(Boolean).join(" ")} />
          ) : null}
          {form.interiorCondition ? <ReviewRow k="Interior" v={CONDITION_OPTIONS.find((c) => c.value === form.interiorCondition)?.label} /> : null}
          {form.exteriorCondition ? <ReviewRow k="Exterior" v={CONDITION_OPTIONS.find((c) => c.value === form.exteriorCondition)?.label} /> : null}
          {(form.petHair || form.stains || form.heavyDirt) ? (
            <ReviewRow k="Flags" v={[form.petHair && "Pet hair", form.stains && "Stains", form.heavyDirt && "Heavy dirt"].filter(Boolean).join(", ")} />
          ) : null}
          {form.photoFiles.length > 0 ? <ReviewRow k="Photos" v={`${form.photoFiles.length} attached`} /> : null}
        </ReviewBlock>

        <ReviewBlock kicker="Appointment">
          {form.preferredDate ? <ReviewRow k="Date"     v={new Date(form.preferredDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} /> : null}
          {form.preferredTime ? <ReviewRow k="Window"   v={selectedTime?.label} /> : null}
          {form.serviceAddress ? <ReviewRow k="Address" v={form.serviceAddress} /> : null}
        </ReviewBlock>

        <ReviewBlock kicker="Contact" last>
          <ReviewRow k="Name"      v={form.name} />
          <ReviewRow k="Phone"     v={form.phone} />
          {form.email ? <ReviewRow k="Email" v={form.email} /> : null}
          <ReviewRow k="Reach via" v={CONTACT_OPTIONS.find((c) => c.value === form.preferredContact)?.label} />
          <ReviewRow k="Water"     v={form.waterAccess ? "available" : "not available"} />
          <ReviewRow k="Power"     v={form.powerAccess ? "available" : "not available"} />
        </ReviewBlock>
      </div>

      {deposit?.enabled && deposit.required ? (
        <div className="relative overflow-hidden border border-ember-500/30 bg-ember-500/[0.05] p-5 md:p-6" style={{ borderRadius: 2 }}>
          <div className="flex items-baseline justify-between gap-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-ember-300">Deposit required</p>
            <p className="font-sans text-2xl font-light text-platinum-50">
              ${(deposit.amountCents / 100).toFixed(2)}
            </p>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-platinum-200/90">
            {deposit.disclaimer?.trim() || (
              deposit.autoConfirmAfterDeposit
                ? `A $${(deposit.amountCents / 100).toFixed(0)} deposit reserves your appointment. Goes toward your final price.`
                : `A $${(deposit.amountCents / 100).toFixed(0)} deposit reserves your appointment request. Goes toward your final price. Reviewed before confirmation.`
            )}
          </p>
          {deposit.appliesToTotal ? (
            <p className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/85">
              <span>Estimated remaining on completion</span>
              <span className="text-platinum-50">~${Math.max(0, estimatedPrice - deposit.amountCents / 100).toFixed(0)}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-platinum-300/60">
        {disclaimer ?? "Final price may vary based on vehicle condition at inspection. I confirm everything before I start."}
      </p>
    </div>
  );
}

function ReviewBlock({ kicker, children, last }: { kicker: string; children: ReactNode; last?: boolean }) {
  return (
    <div className={`px-5 py-5 md:px-8 md:py-6 ${last ? "" : "border-b border-white/10"}`}>
      <p className="font-mono text-[10px] uppercase tracking-[0.32em] text-ember-300/85">{kicker}</p>
      <dl className="mt-3 grid grid-cols-1 gap-y-2">{children}</dl>
    </div>
  );
}

function ReviewRow({ k, v }: { k: string; v?: ReactNode }) {
  if (!v) return null;
  return (
    <div className="grid grid-cols-[110px_1fr] items-baseline gap-3 py-1.5">
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-platinum-300/70">{k}</dt>
      <dd className="text-[13.5px] text-platinum-100">{v}</dd>
    </div>
  );
}

function hashConfig(f: FormState): number {
  // Tiny stable hash for the "build number" label. Cosmetic only.
  const s = `${f.serviceIds.join(",")}|${f.addonIds.join(",")}|${f.vehicleSize}|${f.preferredDate}|${f.preferredTime}|${f.name}|${f.phone}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h | 0;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Step header — common kicker + title + body for every step.
 * ──────────────────────────────────────────────────────────────────────── */

function StepHeader({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  // Italicize last word of the title.
  const words = title.split(" ");
  return (
    <div>
      <p className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-ember-300">{kicker}</p>
      <h3 className="mt-2 font-sans text-[clamp(1.7rem,3.6vw,2.4rem)] font-extralight leading-[1.05] tracking-[-0.02em] text-platinum-50">
        {words.slice(0, -1).join(" ")}{" "}
        <span className="font-display italic font-light text-ember-200/95">{words.slice(-1).join(" ")}</span>
      </h3>
      <p className="mt-3 max-w-[52ch] text-[14px] leading-relaxed text-platinum-300/85">{body}</p>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ConfiguratorShell
 *
 * The visible booking form. Holds the progress strip, step labels, step body
 * (AnimatePresence), and prev/next/submit controls. State and submission live
 * in the orchestrator (BookingPage) — this is a presentational component.
 * ──────────────────────────────────────────────────────────────────────── */

const STEP_LABELS = ["Service", "Add-ons", "Vehicle", "Schedule", "Contact", "Access", "Confirm"];

export function ConfiguratorShell({
  step,
  setStep,
  form,
  set,
  services,
  estimatedPrice,
  disclaimer,
  canProceed,
  submitting,
  submitError,
  onSubmit,
  bookedSlots,
  deposit,
}: {
  step: number;
  setStep: React.Dispatch<React.SetStateAction<number>>;
  form: FormState;
  set: (patch: Partial<FormState>) => void;
  services: PublicService[];
  estimatedPrice: number;
  disclaimer?: string;
  canProceed: () => boolean;
  submitting: boolean;
  submitError: string;
  onSubmit: () => void;
  bookedSlots: { start: string; end: string }[];
  deposit?: PublicDepositInfo;
}) {
  const depositActive = !!deposit?.enabled && !!deposit.required;
  const progress = (step - 1) / (TOTAL_STEPS - 1);

  function submitHandler(e: FormEvent) {
    e.preventDefault();
    if (step < TOTAL_STEPS) {
      if (canProceed()) setStep((s) => Math.min(TOTAL_STEPS, s + 1));
    } else {
      onSubmit();
    }
  }

  return (
    <form
      id="booking-card"
      onSubmit={submitHandler}
      className="relative overflow-hidden border border-white/10 bg-obsidian-850/85 backdrop-blur-xl"
      style={{ borderRadius: 2 }}
    >
      {/* Top status bar */}
      <div className="border-b border-white/10 px-6 py-5 md:px-9">
        <div className="flex items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[11px] tracking-[0.18em] text-ember-300">
              {String(step).padStart(2, "0")}<span className="text-platinum-300/40">/{String(TOTAL_STEPS).padStart(2, "0")}</span>
            </span>
            <span className="h-3 w-px bg-white/15" />
            <span className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-platinum-200/85">
              {STEP_LABELS[step - 1]}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.32em] text-platinum-300/65">Est.</span>
            <motion.span
              key={estimatedPrice}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="font-sans text-lg font-light text-platinum-50"
            >
              {estimatedPrice > 0 ? `$${estimatedPrice}` : "—"}
            </motion.span>
          </div>
        </div>
        <div className="mt-4">
          <LiquidProgress value={progress} />
        </div>
      </div>

      {/* Step body */}
      <div className="relative min-h-[420px] px-6 py-9 md:px-9 md:py-11">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 28, filter: "blur(10px)" }}
            animate={{ opacity: 1, y: 0,  filter: "blur(0)"   }}
            exit   ={{ opacity: 0, y: -22, filter: "blur(10px)" }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            {step === 1 && <Step1Service services={services} form={form} set={set} />}
            {step === 2 && <Step2Addons  services={services} form={form} set={set} estimatedPrice={estimatedPrice} />}
            {step === 3 && <Step3Vehicle form={form} set={set} />}
            {step === 4 && <Step4DateTime form={form} set={set} bookedSlots={bookedSlots} />}
            {step === 5 && <Step5Contact  form={form} set={set} />}
            {step === 6 && <Step6Access   form={form} set={set} />}
            {step === 7 && (
              <Step7Review
                form={form}
                services={services}
                estimatedPrice={estimatedPrice}
                disclaimer={disclaimer}
                deposit={deposit}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Honeypot — left in place, off-screen + ARIA-hidden. */}
        <div aria-hidden style={{ position: "absolute", left: -9999, opacity: 0 }}>
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={form.website}
            onChange={(e) => set({ website: e.target.value })}
          />
        </div>

        {submitError ? (
          <div className="mt-6 border-l-2 border-ember-500 bg-ember-500/[0.07] px-4 py-3">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-ember-300">Submission failed</p>
            <p className="mt-1 text-[13.5px] text-platinum-100">{submitError}</p>
          </div>
        ) : null}
      </div>

      {/* Footer controls */}
      <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-obsidian-900/60 px-6 py-5 md:px-9">
        {step > 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="group inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.28em] text-platinum-200 transition-colors hover:text-ember-300"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back
          </button>
        ) : (
          <span className="font-mono text-[10.5px] uppercase tracking-[0.28em] text-platinum-300/65">
            Start of configurator
          </span>
        )}

        {step < TOTAL_STEPS ? (
          <EmberCTA
            type="submit"
            disabled={!canProceed()}
            size="md"
          >
            Continue
            <ArrowRight className="h-3.5 w-3.5" />
          </EmberCTA>
        ) : (
          <EmberCTA
            type="submit"
            disabled={submitting}
            size="md"
          >
            {submitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {depositActive ? "Routing payment" : "Submitting"}
              </>
            ) : depositActive ? (
              <>
                Pay deposit & submit
                <CheckCircle2 className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Submit request
                <CheckCircle2 className="h-3.5 w-3.5" />
              </>
            )}
          </EmberCTA>
        )}
      </div>
    </form>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * canProceed — same validation logic as the original BookingPage. Exported so
 * the orchestrator can use it without duplicating the rules.
 * ──────────────────────────────────────────────────────────────────────── */

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

/* ─────────────────────────────────────────────────────────────────────────────
 * estimatedPriceOf — same pricing logic used previously (midPrice w/ discount).
 * ──────────────────────────────────────────────────────────────────────── */

export function estimatedPriceOf(form: FormState, services: PublicService[]): number {
  let total = 0;
  // Packages — sum across every selected service id (multi-select).
  for (const id of form.serviceIds) {
    const pkg = services.find((s) => s.id === id);
    if (pkg) total += midPrice(pkg);
  }
  // Add-ons.
  for (const id of form.addonIds) {
    const a = services.find((s) => s.id === id);
    if (a) total += midPrice(a);
  }
  return total;
}
