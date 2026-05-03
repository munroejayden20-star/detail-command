import { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Car,
  Wrench,
  CalendarDays,
  User,
  Zap,
  ClipboardList,
  X,
  Upload,
  AlertCircle,
  MapPin,
  Sparkles,
  ShieldCheck,
  Clock,
  Droplets,
  Phone,
  Mail,
  Star,
  Image as ImageIcon,
  ArrowRight,
  Menu,
  Home,
  HelpCircle,
} from "lucide-react";
import {
  getPublicBookingInfo,
  submitPublicBooking,
  uploadBookingPhoto,
  createDepositCheckout,
  type PublicBookingInfo,
  type PublicService,
  type PublicBookingFaq,
  type PublicFeaturedPhoto,
  type PublicDepositInfo,
} from "@/lib/booking-api";

/* ==========================================================================
   Form Types & Constants
   ========================================================================== */

interface FormState {
  serviceId: string;
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

const EMPTY_FORM: FormState = {
  serviceId: "",
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

const VEHICLE_SIZES = [
  { value: "compact", label: "Compact / Small Car", hint: "Coupe, hatchback, small sedan" },
  { value: "sedan", label: "Sedan / Standard", hint: "Full-size sedan, sports car" },
  { value: "suv_truck", label: "SUV / Truck", hint: "Mid-size SUV, pickup truck" },
  { value: "van_xl", label: "Van / XL / Oversized", hint: "Full-size van, large SUV, box truck" },
];

const CONDITION_OPTIONS = [
  { value: "light", label: "Light", hint: "Lightly used, minimal mess" },
  { value: "average", label: "Average", hint: "Normal everyday use" },
  { value: "heavy", label: "Heavy", hint: "Heavily soiled or neglected" },
];

/**
 * Available booking windows — based on Jayden's day-job hours.
 *   Mon–Fri (1–5): evenings only, 5:00 PM – 9:00 PM
 *   Sat–Sun (0,6): full day, 7:00 AM – 7:00 PM
 *
 * Slots are 30-minute increments. The picker computes options from the
 * selected date so customers never see a slot that's actually unavailable.
 * If no date is picked yet, we show a friendly nudge instead of a default
 * list (which would mislead them about which times work).
 */
function timeSlotsForDate(dateStr: string): { value: string; label: string }[] {
  if (!dateStr) return [];
  // parseISO of "YYYY-MM-DD" returns local midnight, so getDay() is the
  // customer's local day-of-week — matches what they expect to see.
  const parts = dateStr.split("-").map(Number);
  if (parts.length !== 3) return [];
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const dow = d.getDay(); // 0 Sun, 6 Sat
  const isWeekend = dow === 0 || dow === 6;
  // Weekdays: earliest slot is 5:30 PM (Jayden's day-job ends just before 5).
  // Weekends: full day, 7:00 AM – 7:00 PM.
  const startHour = isWeekend ? 7 : 17;
  const startMinute = isWeekend ? 0 : 30;
  const endHour = isWeekend ? 19 : 21; // exclusive upper bound

  const slots: { value: string; label: string }[] = [];
  for (let h = startHour; h < endHour; h++) {
    for (const m of [0, 30]) {
      // Skip the first half-slot when start minute is 30 (so weekdays don't include 5:00).
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

function availabilityHintForDate(dateStr: string): string {
  if (!dateStr) return "Pick a date to see open times.";
  const parts = dateStr.split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const dow = d.getDay();
  return dow === 0 || dow === 6
    ? "Available 7:00 AM – 7:00 PM (weekend hours)"
    : "Available 5:30 PM – 9:00 PM (weekday evenings)";
}

/**
 * Slot is "booked" if any existing appointment's [start, end] window overlaps
 * with this 30-minute slot. All times compared as LA-local wall-clock strings
 * (`YYYY-MM-DDTHH:mm`) so timezone math stays out of JS — the RPC formats
 * appointment intervals in America/Los_Angeles.
 */
function isSlotBooked(
  dateStr: string,
  slotValue: string,
  bookedSlots: { start: string; end: string }[]
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

const CONTACT_OPTIONS = [
  { value: "text", label: "Text message" },
  { value: "call", label: "Phone call" },
  { value: "email", label: "Email" },
];

const TOTAL_STEPS = 7;

/* ==========================================================================
   Landing-page static content (Phase A — to be moved to Settings in Phase B)
   ========================================================================== */

const HERO_HEADLINE = "Premium Mobile Detailing — We Come To You";
const HERO_SUBHEADLINE_FALLBACK =
  "Professional interior and exterior detailing brought to your driveway. Serving the Vancouver / Portland area.";

const TRUST_POINTS: { icon: typeof MapPin; label: string; sub: string }[] = [
  { icon: MapPin, label: "Mobile Service", sub: "We come to your driveway" },
  { icon: Sparkles, label: "Interior & Exterior", sub: "Full vehicle detailing" },
  { icon: CalendarDays, label: "Easy Online Booking", sub: "Request a time in minutes" },
  { icon: ShieldCheck, label: "Professional Results", sub: "Care taken on every detail" },
];

const HOW_IT_WORKS: { title: string; body: string }[] = [
  { title: "Choose your service", body: "Pick the package that fits — Exterior, Interior, Full, or Restoration." },
  { title: "Tell me about your vehicle", body: "A few details and any photos help me prepare and quote accurately." },
  { title: "Request a time", body: "Pick a date and a window. I confirm availability when I reach out." },
  { title: "I come to you", body: "I arrive with all the tools, products, and supplies needed." },
  { title: "Drive away clean", body: "Your vehicle is fully cleaned, protected, and ready to go." },
];

const WHY_US: { icon: typeof Car; title: string; body: string }[] = [
  { icon: MapPin, title: "Convenient mobile service", body: "No shop visit. No waiting room. I work on your schedule, at your location." },
  { icon: Sparkles, title: "Attention to detail", body: "I take time on the small things — door jambs, vents, trim, wheel wells." },
  { icon: User, title: "Personal customer experience", body: "You'll deal with me directly from booking through finish. No call centers." },
  { icon: Clock, title: "Great for busy people", body: "Drop the car at home or at the office. I'll handle the rest while you keep your day moving." },
  { icon: ShieldCheck, title: "Care for your vehicle", body: "Safe products, careful technique, and zero shortcuts on protection." },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "Do you come to me?",
    a: "Yes — that's the whole point. I bring the detailing setup to your home, office, or any location where I can park and work safely.",
  },
  {
    q: "Do I need to provide water and power?",
    a: "I just need access to an outdoor water spigot and a standard 120V outlet. If you don't have one or both, let me know in the booking notes and we'll work it out before I arrive.",
  },
  {
    q: "How long does a detail take?",
    a: "It depends on the package and the vehicle's condition. Exterior-only details can be 1–2 hours, while a full detail or restoration can run 4–8 hours. I'll give you an accurate window once I see your booking.",
  },
  {
    q: "Do you remove stains and pet hair?",
    a: "Yes — both are common and absolutely doable. Heavy stains or excessive hair may push the price into the higher range, but I'll never surprise you with a number on the day of.",
  },
  {
    q: "Can I upload photos for a better quote?",
    a: "Absolutely — and I encourage it. The booking form includes a step where you can upload up to 4 vehicle photos. Photos help me prepare the right products and give you a more accurate price.",
  },
  {
    q: "What areas do you service?",
    a: "I serve the Vancouver, WA and Portland, OR metro area. If you're a little further out, ask me — I may be able to make it work depending on the day.",
  },
  {
    q: "Is the price final?",
    a: "The estimate you see is based on package and add-ons. Final price is confirmed when I see the vehicle in person — heavily soiled or oversized vehicles may vary. I always discuss any change with you before starting.",
  },
];

const NAV_LINKS = [
  { id: "home", label: "Home", icon: Home },
  { id: "services", label: "Services", icon: Wrench },
  { id: "how", label: "How It Works", icon: ClipboardList },
  { id: "gallery", label: "Photos", icon: ImageIcon },
  { id: "faq", label: "FAQ", icon: HelpCircle },
];

/* ==========================================================================
   Utility helpers
   ========================================================================== */

function fmtPrice(low: number, high: number) {
  if (low === high) return `$${low}`;
  return `$${low}–$${high}`;
}

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

function discBadgeText(d: NonNullable<PublicService["discount"]>) {
  if (d.label) return d.label;
  return d.type === "percent" ? `${d.value}% OFF` : `$${d.value} OFF`;
}

function midPrice(s: PublicService) {
  const mid = Math.round((s.priceLow + s.priceHigh) / 2);
  const d = activeDiscount(s);
  if (!d) return mid;
  return applyDiscount(mid, d);
}

function fmtDuration(minutes: number) {
  if (minutes >= 60) {
    const hours = Math.round((minutes / 60) * 10) / 10;
    return `${hours}h`;
  }
  return `${minutes}min`;
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ==========================================================================
   Form sub-components (unchanged from previous version)
   ========================================================================== */

function ProgressBar({ step }: { step: number }) {
  const pct = Math.round(((step - 1) / (TOTAL_STEPS - 1)) * 100);
  return (
    <div className="w-full bg-zinc-800 h-1 rounded-full overflow-hidden">
      <div
        className="h-1 bg-red-600 transition-all duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function StepLabel({ step }: { step: number }) {
  const labels = ["Service", "Add-ons", "Vehicle", "Date & Location", "Contact", "Access", "Review"];
  return (
    <div className="flex items-center gap-2 text-xs text-zinc-400">
      <span className="text-red-500 font-bold">Step {step}/{TOTAL_STEPS}</span>
      <span>·</span>
      <span>{labels[step - 1]}</span>
    </div>
  );
}

function ServiceCard({
  service,
  selected,
  onClick,
}: {
  service: PublicService;
  selected: boolean;
  onClick: () => void;
}) {
  const disc = activeDiscount(service);
  const discLow = disc ? applyDiscount(service.priceLow, disc) : null;
  const discHigh = disc ? applyDiscount(service.priceHigh, disc) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-4 transition-all ${
        selected
          ? "border-red-500 bg-red-500/10 shadow-[0_0_0_2px_rgba(239,68,68,0.3)]"
          : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
      }`}
    >
      {disc && (
        <div className="mb-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
            🔥 {discBadgeText(disc)}
            {disc.expiry && (
              <span className="font-normal opacity-80">
                {" "}· ends {new Date(disc.expiry).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </span>
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm">{service.name}</p>
          {service.description ? (
            <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{service.description}</p>
          ) : null}
          <p className="text-xs text-zinc-500 mt-1">Est. {fmtDuration(service.durationMinutes)}</p>
        </div>
        <div className="shrink-0 text-right">
          {disc ? (
            <>
              <p className="text-xs text-zinc-500 line-through leading-none">
                {fmtPrice(service.priceLow, service.priceHigh)}
              </p>
              <p className="font-bold text-amber-400 text-sm mt-0.5">
                {fmtPrice(discLow!, discHigh!)}
              </p>
            </>
          ) : (
            <p className="font-bold text-white text-sm">{fmtPrice(service.priceLow, service.priceHigh)}</p>
          )}
          {selected ? (
            <span className="text-[10px] text-red-400 font-medium">Selected ✓</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function AddonCard({
  service,
  checked,
  onToggle,
}: {
  service: PublicService;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`w-full text-left rounded-xl border p-3 transition-all ${
        checked
          ? "border-red-500 bg-red-500/10"
          : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
            checked ? "bg-red-600 border-red-600" : "border-zinc-500"
          }`}
        >
          {checked ? <span className="text-white text-[10px] font-bold">✓</span> : null}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{service.name}</p>
          {service.description ? (
            <p className="text-xs text-zinc-400 truncate">{service.description}</p>
          ) : null}
        </div>
        <span className="text-sm font-semibold text-zinc-300 shrink-0">
          +{fmtPrice(service.priceLow, service.priceHigh)}
        </span>
      </div>
    </button>
  );
}

function ToggleCard({
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
      className={`w-full text-left rounded-xl border p-3 transition-all ${
        checked ? "border-red-500 bg-red-500/10" : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-white">{label}</p>
          {hint ? <p className="text-xs text-zinc-400 mt-0.5">{hint}</p> : null}
        </div>
        <div
          className={`w-11 h-6 rounded-full transition-all relative shrink-0 ${
            checked ? "bg-red-600" : "bg-zinc-700"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
              checked ? "translate-x-5.5" : "translate-x-0.5"
            }`}
          />
        </div>
      </div>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">{children}</p>
  );
}

function InputField({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-zinc-300">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {hint ? <p className="text-[11px] text-zinc-500">{hint}</p> : null}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30";

/* ==========================================================================
   Form Steps (unchanged behaviour)
   ========================================================================== */

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
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-bold text-white">Choose a service package</h3>
        <p className="text-sm text-zinc-400 mt-1">Select the service that best fits your vehicle's needs.</p>
      </div>
      {packages.length === 0 ? (
        <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-8 text-center">
          <p className="text-zinc-400 text-sm">No services available right now. Please check back soon.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {packages.map((s) => (
            <ServiceCard
              key={s.id}
              service={s}
              selected={form.serviceId === s.id}
              onClick={() => set({ serviceId: s.id })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

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
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-bold text-white">Add-ons</h3>
        <p className="text-sm text-zinc-400 mt-1">Optional upgrades — select any that apply. You can skip this step.</p>
      </div>
      {addons.length === 0 ? (
        <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-6 text-center">
          <p className="text-zinc-500 text-sm">No add-ons available for this package.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {addons.map((s) => (
            <AddonCard
              key={s.id}
              service={s}
              checked={form.addonIds.includes(s.id)}
              onToggle={() => {
                const ids = form.addonIds.includes(s.id)
                  ? form.addonIds.filter((id) => id !== s.id)
                  : [...form.addonIds, s.id];
                set({ addonIds: ids });
              }}
            />
          ))}
        </div>
      )}
      <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-zinc-300">Estimated total</span>
          <span className="text-lg font-bold text-white">~${estimatedPrice}</span>
        </div>
        <p className="text-[11px] text-zinc-500 mt-1">
          Final price may vary based on vehicle condition at inspection.
        </p>
      </div>
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
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-bold text-white">Tell me about your vehicle</h3>
        <p className="text-sm text-zinc-400 mt-1">This helps me prepare and give you an accurate estimate.</p>
      </div>

      <div>
        <SectionLabel>Vehicle size *</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {VEHICLE_SIZES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set({ vehicleSize: opt.value })}
              className={`rounded-xl border p-3 text-left transition-all ${
                form.vehicleSize === opt.value
                  ? "border-red-500 bg-red-500/10"
                  : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
              }`}
            >
              <p className="text-sm font-medium text-white">{opt.label}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">{opt.hint}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <InputField label="Year">
          <input className={inputCls} placeholder="2019" value={form.vehicleYear} onChange={(e) => set({ vehicleYear: e.target.value })} />
        </InputField>
        <InputField label="Make">
          <input className={inputCls} placeholder="Toyota" value={form.vehicleMake} onChange={(e) => set({ vehicleMake: e.target.value })} />
        </InputField>
        <InputField label="Model">
          <input className={inputCls} placeholder="Camry" value={form.vehicleModel} onChange={(e) => set({ vehicleModel: e.target.value })} />
        </InputField>
        <InputField label="Color">
          <input className={inputCls} placeholder="Black" value={form.vehicleColor} onChange={(e) => set({ vehicleColor: e.target.value })} />
        </InputField>
      </div>

      <div>
        <SectionLabel>Interior condition</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          {CONDITION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set({ interiorCondition: opt.value })}
              className={`rounded-xl border p-2.5 text-center transition-all ${
                form.interiorCondition === opt.value
                  ? "border-red-500 bg-red-500/10"
                  : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
              }`}
            >
              <p className="text-sm font-medium text-white">{opt.label}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{opt.hint}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Exterior condition</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          {CONDITION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set({ exteriorCondition: opt.value })}
              className={`rounded-xl border p-2.5 text-center transition-all ${
                form.exteriorCondition === opt.value
                  ? "border-red-500 bg-red-500/10"
                  : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
              }`}
            >
              <p className="text-sm font-medium text-white">{opt.label}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{opt.hint}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Additional details</SectionLabel>
        <div className="space-y-2">
          <ToggleCard label="Pet hair" hint="Dog, cat, or other pet hair inside" checked={form.petHair} onChange={(v) => set({ petHair: v })} />
          <ToggleCard label="Stains" hint="Visible stains on seats or carpet" checked={form.stains} onChange={(v) => set({ stains: v })} />
          <ToggleCard label="Heavy dirt / mud" hint="Caked mud, heavy road grime" checked={form.heavyDirt} onChange={(v) => set({ heavyDirt: v })} />
        </div>
      </div>

      <InputField label="Notes about the vehicle" hint="Anything else I should know before I arrive.">
        <textarea
          className={`${inputCls} resize-none`}
          rows={3}
          placeholder="Cracked trim on driver side, dog always riding shotgun, etc."
          value={form.vehicleNotes}
          onChange={(e) => set({ vehicleNotes: e.target.value })}
        />
      </InputField>
    </div>
  );
}

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
  const hint = availabilityHintForDate(form.preferredDate);
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-bold text-white">When and where?</h3>
        <p className="text-sm text-zinc-400 mt-1">Pick a date and any open time slot. I'll confirm when I reach out.</p>
      </div>

      <InputField label="Preferred date" required>
        <input
          type="date"
          className={inputCls}
          min={today}
          value={form.preferredDate}
          onChange={(e) => {
            const newSlots = timeSlotsForDate(e.target.value);
            const newDate = e.target.value;
            const stillValid =
              newSlots.some((s) => s.value === form.preferredTime) &&
              !isSlotBooked(newDate, form.preferredTime, bookedSlots);
            set({
              preferredDate: newDate,
              preferredTime: stillValid ? form.preferredTime : "",
            });
          }}
        />
      </InputField>

      <div>
        <div className="flex items-baseline justify-between mb-2">
          <SectionLabel>Preferred time</SectionLabel>
          <span className="text-[10px] text-zinc-500">{hint}</span>
        </div>
        {slots.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900 p-4 text-center text-xs text-zinc-500">
            Pick a date first to see available times.
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1">
            {slots.map((opt) => {
              const booked = isSlotBooked(form.preferredDate, opt.value, bookedSlots);
              const selected = form.preferredTime === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={booked}
                  onClick={() => set({ preferredTime: opt.value })}
                  className={`relative rounded-lg border py-2 px-2 text-xs font-medium transition-all ${
                    booked
                      ? "border-zinc-800 bg-zinc-900/40 text-zinc-600 cursor-not-allowed line-through decoration-zinc-700"
                      : selected
                      ? "border-red-500 bg-red-500/10 text-white"
                      : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
                  }`}
                  aria-disabled={booked}
                  title={booked ? "This time is already booked" : undefined}
                >
                  {opt.label}
                  {booked ? (
                    <span className="absolute -top-1.5 -right-1.5 rounded-full bg-zinc-700 text-[8px] font-bold uppercase tracking-wider text-zinc-200 px-1.5 py-0.5">
                      Booked
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <InputField label="Service address" required hint="Where should I come? Your home, office, or another location.">
        <textarea
          className={`${inputCls} resize-none`}
          rows={2}
          placeholder="123 Main St, Vancouver, WA 98660"
          value={form.serviceAddress}
          onChange={(e) => set({ serviceAddress: e.target.value })}
        />
      </InputField>
    </div>
  );
}

function Step5Contact({
  form,
  set,
}: {
  form: FormState;
  set: (patch: Partial<FormState>) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-bold text-white">Your contact info</h3>
        <p className="text-sm text-zinc-400 mt-1">I'll use this to confirm your appointment and follow up.</p>
      </div>

      <InputField label="Full name" required>
        <input
          className={inputCls}
          placeholder="Alex Johnson"
          value={form.name}
          autoComplete="name"
          onChange={(e) => set({ name: e.target.value })}
        />
      </InputField>

      <InputField label="Phone number" required>
        <input
          type="tel"
          className={inputCls}
          placeholder="(360) 555-1234"
          value={form.phone}
          autoComplete="tel"
          onChange={(e) => set({ phone: e.target.value })}
        />
      </InputField>

      <InputField label="Email" hint="Optional — for a booking confirmation email.">
        <input
          type="email"
          className={inputCls}
          placeholder="alex@example.com"
          value={form.email}
          autoComplete="email"
          onChange={(e) => set({ email: e.target.value })}
        />
      </InputField>

      <div>
        <SectionLabel>Preferred contact method</SectionLabel>
        <div className="grid grid-cols-3 gap-2">
          {CONTACT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set({ preferredContact: opt.value })}
              className={`rounded-xl border py-2.5 px-3 text-sm font-medium transition-all ${
                form.preferredContact === opt.value
                  ? "border-red-500 bg-red-500/10 text-white"
                  : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Step6Access({
  form,
  set,
}: {
  form: FormState;
  set: (patch: Partial<FormState>) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previews = form.photoFiles.map((f) => URL.createObjectURL(f));

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-bold text-white">Water & power access</h3>
        <p className="text-sm text-zinc-400 mt-1">I need a couple utilities to do my best work.</p>
      </div>

      <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 text-sm text-zinc-300 leading-relaxed">
        I bring all my detailing tools and products. I just need access to an outdoor water spigot and a standard outlet — unless we work something else out beforehand.
      </div>

      <div className="space-y-2">
        <ToggleCard
          label="Outdoor water spigot available"
          hint="Standard garden hose hookup at the service location"
          checked={form.waterAccess}
          onChange={(v) => set({ waterAccess: v })}
        />
        <ToggleCard
          label="Standard power outlet available"
          hint="Regular 120V outlet within reach"
          checked={form.powerAccess}
          onChange={(v) => set({ powerAccess: v })}
        />
      </div>

      {(!form.waterAccess || !form.powerAccess) && (
        <div className="rounded-xl border border-yellow-600/40 bg-yellow-900/20 p-4 text-sm text-yellow-200">
          No problem — just note it in the vehicle notes and we'll work something out before I arrive.
        </div>
      )}

      <div>
        <SectionLabel>Vehicle photos (optional)</SectionLabel>
        <p className="text-xs text-zinc-500 mb-3">
          Upload photos of your vehicle so I can see what I'm working with. Up to 4 images. JPG, PNG, or WebP.
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
            className="w-full rounded-xl border border-dashed border-zinc-600 bg-zinc-900 p-5 text-center hover:border-zinc-400 transition-colors"
          >
            <Upload className="h-5 w-5 mx-auto text-zinc-500 mb-2" />
            <p className="text-sm text-zinc-400">Tap to add photos</p>
            <p className="text-xs text-zinc-600 mt-0.5">{form.photoFiles.length}/4 added</p>
          </button>
        )}

        {form.photoFiles.length > 0 && (
          <div className="grid grid-cols-2 gap-2 mt-3">
            {form.photoFiles.map((f, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-zinc-700">
                <img src={previews[i]} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => set({ photoFiles: form.photoFiles.filter((_, j) => j !== i) })}
                  className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/70 flex items-center justify-center hover:bg-black"
                >
                  <X className="h-3.5 w-3.5 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
  const selectedService = services.find((s) => s.id === form.serviceId);
  const selectedAddons = services.filter((s) => form.addonIds.includes(s.id));
  const selectedSize = VEHICLE_SIZES.find((s) => s.value === form.vehicleSize);
  const selectedTime = timeSlotsForDate(form.preferredDate).find((t) => t.value === form.preferredTime);

  function Row({ label, value }: { label: string; value?: string | React.ReactNode }) {
    if (!value) return null;
    return (
      <div className="flex items-start justify-between gap-3 py-2 border-b border-zinc-800 last:border-0">
        <span className="text-xs text-zinc-500 shrink-0">{label}</span>
        <span className="text-xs text-zinc-200 text-right">{value}</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xl font-bold text-white">Review your request</h3>
        <p className="text-sm text-zinc-400 mt-1">Double-check everything before submitting.</p>
      </div>

      <div className="rounded-xl border border-zinc-700 bg-zinc-900 divide-y divide-zinc-800 overflow-hidden">
        <div className="px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Service</p>
          <Row label="Package" value={selectedService?.name} />
          {selectedAddons.length > 0 && <Row label="Add-ons" value={selectedAddons.map((a) => a.name).join(", ")} />}
          <Row label="Estimated price" value={`~$${estimatedPrice}`} />
        </div>

        <div className="px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Vehicle</p>
          <Row label="Size" value={selectedSize?.label} />
          {(form.vehicleYear || form.vehicleMake || form.vehicleModel) && (
            <Row label="Vehicle" value={[form.vehicleYear, form.vehicleMake, form.vehicleModel, form.vehicleColor].filter(Boolean).join(" ")} />
          )}
          {form.interiorCondition && <Row label="Interior" value={CONDITION_OPTIONS.find((c) => c.value === form.interiorCondition)?.label} />}
          {form.exteriorCondition && <Row label="Exterior" value={CONDITION_OPTIONS.find((c) => c.value === form.exteriorCondition)?.label} />}
          {(form.petHair || form.stains || form.heavyDirt) && (
            <Row label="Flags" value={[form.petHair && "Pet hair", form.stains && "Stains", form.heavyDirt && "Heavy dirt"].filter(Boolean).join(", ")} />
          )}
          {form.photoFiles.length > 0 && <Row label="Photos" value={`${form.photoFiles.length} uploaded`} />}
        </div>

        <div className="px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Appointment</p>
          {form.preferredDate && <Row label="Date" value={new Date(form.preferredDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} />}
          {form.preferredTime && <Row label="Time" value={selectedTime?.label} />}
          {form.serviceAddress && <Row label="Location" value={form.serviceAddress} />}
        </div>

        <div className="px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-1">Contact</p>
          <Row label="Name" value={form.name} />
          <Row label="Phone" value={form.phone} />
          {form.email && <Row label="Email" value={form.email} />}
          <Row label="Contact via" value={CONTACT_OPTIONS.find((c) => c.value === form.preferredContact)?.label} />
          <Row label="Water" value={form.waterAccess ? "Available ✓" : "Not available"} />
          <Row label="Power" value={form.powerAccess ? "Available ✓" : "Not available"} />
        </div>
      </div>

      {deposit?.enabled && deposit.required ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-white">Deposit required</p>
            <p className="text-base font-extrabold text-red-300">
              ${(deposit.amountCents / 100).toFixed(2)}
            </p>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">
            {deposit.disclaimer?.trim() || (
              deposit.autoConfirmAfterDeposit
                ? `A $${(deposit.amountCents / 100).toFixed(0)} deposit is required to reserve your appointment. This deposit goes toward your final detail price.`
                : `A $${(deposit.amountCents / 100).toFixed(0)} deposit is required to reserve your appointment request. This deposit goes toward your final detail price. Your appointment will be reviewed and confirmed after submission. Final pricing may vary based on vehicle condition at inspection.`
            )}
          </p>
          {deposit.appliesToTotal ? (
            <div className="pt-2 mt-2 border-t border-red-500/20 text-[11px] text-zinc-400 flex items-center justify-between">
              <span>Estimated remaining at job</span>
              <span className="text-zinc-200 font-medium">
                ~${Math.max(0, estimatedPrice - deposit.amountCents / 100).toFixed(0)}
              </span>
            </div>
          ) : null}
          {deposit.refundPolicy?.trim() ? (
            <p className="text-[11px] text-zinc-500 leading-relaxed pt-1">
              <span className="font-semibold text-zinc-400">Refund policy: </span>
              {deposit.refundPolicy}
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs text-zinc-500 leading-relaxed">
        {disclaimer ?? "Final price may vary based on vehicle condition at inspection. I'll confirm everything before I start."}
      </p>
    </div>
  );
}

/* ==========================================================================
   Landing-page sections
   ========================================================================== */

function TopNav({
  businessName,
  logoUrl,
  onBookClick,
}: {
  businessName: string;
  logoUrl?: string;
  onBookClick: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-colors duration-200 ${
        scrolled ? "bg-zinc-950/95 backdrop-blur border-b border-zinc-800" : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <button
          type="button"
          onClick={() => scrollToId("home")}
          className="flex items-center gap-2.5 min-w-0"
        >
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
          ) : (
            <div className="h-9 w-9 rounded-lg bg-red-600 flex items-center justify-center shrink-0">
              <Car className="h-5 w-5 text-white" />
            </div>
          )}
          <span className="text-sm font-bold text-white truncate">{businessName}</span>
        </button>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => scrollToId(link.id)}
              className="px-3 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors rounded-lg"
            >
              {link.label}
            </button>
          ))}
          <button
            type="button"
            onClick={onBookClick}
            className="ml-2 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
          >
            Book Now
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </nav>

        {/* Mobile menu trigger */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="md:hidden h-9 w-9 rounded-lg border border-zinc-700 bg-zinc-900 flex items-center justify-center text-zinc-300 hover:bg-zinc-800"
          aria-label="Open menu"
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileOpen && (
        <div className="md:hidden border-t border-zinc-800 bg-zinc-950">
          <nav className="max-w-6xl mx-auto px-4 py-3 flex flex-col">
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    scrollToId(link.id);
                  }}
                  className="flex items-center gap-3 px-3 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-900 rounded-lg"
                >
                  <Icon className="h-4 w-4 text-zinc-500" />
                  {link.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onBookClick();
              }}
              className="mt-2 inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700"
            >
              Book Now
              <ArrowRight className="h-4 w-4" />
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}

function Hero({
  businessName,
  serviceArea,
  heroHeadline,
  heroSubheadline,
  heroImageUrl,
  logoUrl,
  onBookClick,
  onServicesClick,
}: {
  businessName: string;
  serviceArea?: string;
  heroHeadline?: string;
  heroSubheadline?: string;
  heroImageUrl?: string;
  logoUrl?: string;
  onBookClick: () => void;
  onServicesClick: () => void;
}) {
  const headline = heroHeadline?.trim() || HERO_HEADLINE;
  const sub =
    heroSubheadline?.trim() ||
    (serviceArea
      ? `Professional interior and exterior detailing brought to your driveway. Serving ${serviceArea}.`
      : HERO_SUBHEADLINE_FALLBACK);

  return (
    <section
      id="home"
      className="relative overflow-hidden border-b border-zinc-800"
    >
      {/* Background gradient + glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-950 to-zinc-900" aria-hidden="true" />
      <div
        className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-red-600/20 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-red-900/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative max-w-6xl mx-auto px-4 py-16 md:py-24 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          {/* Text */}
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-red-600/40 bg-red-600/10 px-3 py-1 text-xs font-semibold text-red-300 uppercase tracking-wider">
              <Sparkles className="h-3 w-3" />
              {businessName}
            </span>
            <h1 className="mt-5 text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-[1.05] tracking-tight">
              {headline.includes("—") ? (
                headline.split("—").map((part, i, arr) => (
                  <span key={i}>
                    {i === arr.length - 1 ? (
                      <span className="text-red-500">{part.trim()}</span>
                    ) : (
                      <>{part}— </>
                    )}
                  </span>
                ))
              ) : (
                headline
              )}
            </h1>
            <p className="mt-5 text-base md:text-lg text-zinc-400 max-w-xl lg:max-w-none leading-relaxed">
              {sub}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <button
                type="button"
                onClick={onBookClick}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
              >
                Book a Detail
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={onServicesClick}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-6 py-3.5 text-sm font-semibold text-white hover:border-zinc-500 hover:bg-zinc-800 transition-all"
              >
                View Services
              </button>
            </div>
          </div>

          {/* Hero image area */}
          <div className="relative">
            <div className="aspect-[4/3] rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 overflow-hidden relative shadow-2xl shadow-black/40">
              {heroImageUrl ? (
                <>
                  <img
                    src={heroImageUrl}
                    alt={`${businessName} mobile detailing`}
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="eager"
                  />
                  {/* Subtle gradient so any text overlay would still read */}
                  <div
                    className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent"
                    aria-hidden="true"
                  />
                </>
              ) : (
                <>
                  {/* Subtle scan lines / pattern overlay */}
                  <div
                    className="absolute inset-0 opacity-30"
                    aria-hidden="true"
                    style={{
                      backgroundImage:
                        "linear-gradient(135deg, transparent 49%, rgba(239,68,68,0.08) 50%, transparent 51%), linear-gradient(45deg, transparent 49%, rgba(255,255,255,0.04) 50%, transparent 51%)",
                      backgroundSize: "40px 40px, 40px 40px",
                    }}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 p-8 text-center">
                    <Car className="h-16 w-16 mb-3 text-zinc-700" />
                    <p className="text-sm font-medium text-zinc-500">Hero image placeholder</p>
                    <p className="text-xs text-zinc-600 mt-1">
                      Upload one in Settings → Booking Page → Hero image
                    </p>
                  </div>
                </>
              )}
              {/* Decorative corner accents */}
              <div className="absolute top-3 left-3 h-2 w-2 rounded-full bg-red-500/60" aria-hidden="true" />
              <div className="absolute top-3 right-3 h-2 w-2 rounded-full bg-red-500/60" aria-hidden="true" />
            </div>

            {/* Floating stat card */}
            <div className="absolute -bottom-5 -left-5 hidden md:flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/95 backdrop-blur px-4 py-3 shadow-xl">
              <div className="h-9 w-9 rounded-lg bg-red-600/15 border border-red-600/40 flex items-center justify-center">
                <Star className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Real care, every time</p>
                <p className="text-sm font-semibold text-white">Detail-obsessed</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustBar() {
  return (
    <section className="border-b border-zinc-800 bg-zinc-950">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {TRUST_POINTS.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.label}
                className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 md:p-4"
              >
                <div className="h-9 w-9 rounded-lg bg-red-600/10 border border-red-600/30 flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-red-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white">{p.label}</p>
                  <p className="text-xs text-zinc-500 mt-0.5 leading-snug">{p.sub}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SectionTitle({
  eyebrow,
  title,
  body,
  centered,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  centered?: boolean;
}) {
  return (
    <div className={centered ? "text-center max-w-2xl mx-auto" : "max-w-2xl"}>
      {eyebrow ? (
        <p className="text-xs font-bold uppercase tracking-widest text-red-500">{eyebrow}</p>
      ) : null}
      <h2 className="mt-2 text-3xl md:text-4xl font-extrabold text-white tracking-tight">{title}</h2>
      {body ? <p className="mt-3 text-base text-zinc-400 leading-relaxed">{body}</p> : null}
    </div>
  );
}

function ServicesShowcase({
  services,
  onSelect,
}: {
  services: PublicService[];
  onSelect: (serviceId: string) => void;
}) {
  const packages = services.filter((s) => !s.isAddon);
  const deals = packages.filter((s) => activeDiscount(s) !== null);

  return (
    <section id="services" className="border-b border-zinc-800 bg-zinc-950 scroll-mt-20">
      {/* Active deals banner */}
      {deals.length > 0 && (
        <div className="border-b border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
            <span className="text-amber-400 text-sm font-bold flex items-center gap-1.5">
              🔥 Limited-Time Deals
            </span>
            {deals.map((s) => {
              const d = activeDiscount(s)!;
              return (
                <span key={s.id} className="text-xs text-zinc-300">
                  <span className="font-semibold text-white">{s.name}</span>
                  {" — "}
                  <span className="text-amber-400 font-bold">{discBadgeText(d)}</span>
                  {d.expiry && (
                    <span className="text-zinc-500 ml-1">
                      · ends {new Date(d.expiry).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-16 md:py-20">
        <SectionTitle
          eyebrow="Services"
          title="Pick the package that fits your vehicle"
          body="Every detail starts with a clear scope and an honest price. Add-ons are available on the booking form."
          centered
        />

        {packages.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center max-w-xl mx-auto">
            <p className="text-zinc-400">Services are being updated. Check back shortly.</p>
          </div>
        ) : (
          <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-2 gap-4 md:gap-5">
            {packages.map((s) => (
              <ServiceShowcaseCard key={s.id} service={s} onSelect={onSelect} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * One service card with an expandable description. Only shows the
 * "Read more" toggle when the description actually overflows the
 * 3-line clamp — measured after layout. Re-checks on resize so the
 * toggle stays accurate when the viewport changes.
 */
function ServiceShowcaseCard({
  service: s,
  onSelect,
}: {
  service: PublicService;
  onSelect: (serviceId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const descRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (!s.description) return;
    function measure() {
      const el = descRef.current;
      if (!el) return;
      // Only meaningful while clamped — temporarily un-clamp to measure
      // would cause a flash, so just compare scrollHeight vs clientHeight
      // in the clamped state. If they differ, content is truncated.
      const clipped = el.dataset.clamped === "true";
      if (clipped) {
        setOverflows(el.scrollHeight - 1 > el.clientHeight);
      }
    }
    measure();
    const ro = new ResizeObserver(measure);
    if (descRef.current) ro.observe(descRef.current);
    return () => ro.disconnect();
  }, [s.description]);

  return (
    <article className={`group relative rounded-2xl border bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 md:p-7 transition-all flex flex-col ${activeDiscount(s) ? "border-amber-500/40 hover:border-amber-500/70" : "border-zinc-800 hover:border-red-600/50"}`}>
      {/* Discount ribbon */}
      {activeDiscount(s) && (
        <div className="absolute -top-px left-6 rounded-b-lg bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-white">
            🔥 {discBadgeText(activeDiscount(s)!)}
          </span>
        </div>
      )}

      {/* Service icon area */}
      <div className={`flex items-start justify-between gap-4 ${activeDiscount(s) ? "mt-5" : ""}`}>
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${activeDiscount(s) ? "bg-amber-500/15 border border-amber-500/40" : "bg-red-600/15 border border-red-600/40"}`}>
          <Sparkles className={`h-5 w-5 ${activeDiscount(s) ? "text-amber-400" : "text-red-400"}`} />
        </div>
        <div className="text-right">
          {activeDiscount(s) ? (
            <>
              <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold line-through">
                ${s.priceLow}
              </p>
              <p className="text-2xl font-extrabold text-amber-400 leading-none mt-0.5">
                ${applyDiscount(s.priceLow, activeDiscount(s)!)}
              </p>
              {activeDiscount(s)!.expiry && (
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  ends {new Date(activeDiscount(s)!.expiry!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Starting at</p>
              <p className="text-2xl font-extrabold text-white leading-none mt-1">${s.priceLow}</p>
            </>
          )}
        </div>
      </div>

      <h3 className="mt-5 text-xl font-bold text-white">{s.name}</h3>
      {s.description ? (
        <>
          <p
            ref={descRef}
            data-clamped={!expanded}
            className={`mt-2 text-sm text-zinc-400 leading-relaxed whitespace-pre-line transition-all ${
              expanded ? "" : "line-clamp-3"
            }`}
          >
            {s.description}
          </p>
          {overflows ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-red-400 hover:text-red-300 transition-colors self-start"
              aria-expanded={expanded}
            >
              {expanded ? "Show less" : "Read more"}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          ) : null}
        </>
      ) : null}

      <div className="mt-4 flex items-center gap-4 text-xs text-zinc-500">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {fmtDuration(s.durationMinutes)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />
          Mobile service
        </span>
      </div>

      <button
        type="button"
        onClick={() => onSelect(s.id)}
        className={`mt-6 inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold text-white transition-all ${
          activeDiscount(s)
            ? "border-amber-500/50 bg-amber-500/10 hover:bg-amber-500 hover:border-amber-500"
            : "border-zinc-700 bg-zinc-900 hover:border-red-500 hover:bg-red-600"
        }`}
      >
        {activeDiscount(s) ? "Book This Deal" : "Select This Service"}
        <ArrowRight className="h-3.5 w-3.5" />
      </button>
    </article>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="border-b border-zinc-800 bg-zinc-900/30 scroll-mt-20">
      <div className="max-w-6xl mx-auto px-4 py-16 md:py-20">
        <SectionTitle
          eyebrow="How it works"
          title="Five simple steps"
          body="From request to clean car — here's exactly how it goes."
          centered
        />

        <ol className="mt-12 grid md:grid-cols-3 lg:grid-cols-5 gap-4">
          {HOW_IT_WORKS.map((s, i) => (
            <li
              key={s.title}
              className="relative rounded-xl border border-zinc-800 bg-zinc-950 p-5"
            >
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-red-600 text-white font-bold text-sm flex items-center justify-center">
                  {i + 1}
                </div>
                <h3 className="text-sm font-semibold text-white">{s.title}</h3>
              </div>
              <p className="mt-3 text-xs text-zinc-400 leading-relaxed">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function BeforeAfterGallery({ featuredPhotos }: { featuredPhotos?: PublicFeaturedPhoto[] }) {
  const placeholderSlots = [
    { label: "Exterior shine" },
    { label: "Interior transformation" },
    { label: "Wheel & tire detail" },
    { label: "Paint correction" },
  ];

  const photos = featuredPhotos ?? [];
  const hasPhotos = photos.length > 0;

  return (
    <section id="gallery" className="border-b border-zinc-800 bg-zinc-950 scroll-mt-20">
      <div className="max-w-6xl mx-auto px-4 py-16 md:py-20">
        <SectionTitle
          eyebrow="Real work"
          title="Before & after"
          body="Honest photos of real vehicles — driveways, parking lots, mid-job and post-job."
          centered
        />

        <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {hasPhotos
            ? photos.map((p) => (
                <figure
                  key={p.id}
                  className="group relative aspect-[4/5] rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden"
                >
                  <img
                    src={p.url}
                    alt={p.caption ?? "Detail work"}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  {p.caption ? (
                    <figcaption className="absolute bottom-2 left-2 right-2 text-[10px] rounded-full bg-black/60 backdrop-blur px-2 py-0.5 text-zinc-200 truncate">
                      {p.caption}
                    </figcaption>
                  ) : null}
                </figure>
              ))
            : placeholderSlots.map((s, i) => (
                <div
                  key={i}
                  className="group relative aspect-[4/5] rounded-xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 overflow-hidden"
                >
                  <div
                    className="absolute inset-0 opacity-20"
                    aria-hidden="true"
                    style={{
                      backgroundImage:
                        "linear-gradient(45deg, rgba(255,255,255,0.04) 25%, transparent 25%), linear-gradient(-45deg, rgba(255,255,255,0.04) 25%, transparent 25%)",
                      backgroundSize: "20px 20px",
                    }}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-700 p-3 text-center">
                    <ImageIcon className="h-8 w-8 mb-2" />
                    <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{s.label}</p>
                    <p className="text-[10px] text-zinc-600 mt-1">Photo placeholder</p>
                  </div>
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[10px] text-zinc-500">
                    <span className="rounded-full bg-black/60 backdrop-blur px-2 py-0.5">Before / After</span>
                  </div>
                </div>
              ))}
        </div>

        {!hasPhotos ? (
          <p className="mt-8 text-center text-xs text-zinc-600">
            Pick featured photos in Settings → Booking Page to replace these slots.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function WhyChooseUs() {
  return (
    <section className="border-b border-zinc-800 bg-zinc-900/30">
      <div className="max-w-6xl mx-auto px-4 py-16 md:py-20">
        <SectionTitle
          eyebrow="Why us"
          title="Why customers book me"
          body="Mobile detailing isn't just convenient — done right, it's better. Here's what you get."
          centered
        />

        <div className="mt-12 grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
          {WHY_US.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-xl border border-zinc-800 bg-zinc-950 p-5 md:p-6"
              >
                <div className="h-10 w-10 rounded-lg bg-red-600/10 border border-red-600/30 flex items-center justify-center">
                  <Icon className="h-4.5 w-4.5 text-red-400" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{item.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function WaterPowerInfo({ customText }: { customText?: string }) {
  const trimmed = customText?.trim();
  return (
    <section className="border-b border-zinc-800 bg-zinc-950">
      <div className="max-w-4xl mx-auto px-4 py-16 md:py-20">
        <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 md:p-10">
          <div className="grid md:grid-cols-[auto_1fr] gap-6 md:gap-8 items-start">
            <div className="flex md:flex-col gap-3">
              <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                <Droplets className="h-5 w-5 text-blue-300" />
              </div>
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <Zap className="h-5 w-5 text-amber-300" />
              </div>
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-red-500">Setup at your location</p>
              <h2 className="mt-2 text-2xl md:text-3xl font-bold text-white tracking-tight">
                What I need from you
              </h2>
              {trimmed ? (
                <div className="mt-4 text-base text-zinc-300 leading-relaxed whitespace-pre-line">
                  {trimmed}
                </div>
              ) : (
                <>
                  <p className="mt-4 text-base text-zinc-300 leading-relaxed">
                    I bring all the detailing tools and products. I just need access to an{" "}
                    <span className="text-white font-semibold">outdoor water spigot</span> and a{" "}
                    <span className="text-white font-semibold">standard power outlet</span> — unless we work something
                    out beforehand.
                  </p>
                  <p className="mt-3 text-sm text-zinc-500 leading-relaxed">
                    Don't have one of those? No problem — note it on the booking form and I'll bring extra gear or we'll
                    adjust the plan before I arrive.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ==========================================================================
   FAQ
   ========================================================================== */

function FAQItem({ q, a, defaultOpen }: { q: string; a: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border-b border-zinc-800 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 py-5 text-left hover:text-white transition-colors"
        aria-expanded={open}
      >
        <span className="text-base font-semibold text-white">{q}</span>
        <ChevronDown
          className={`h-5 w-5 text-zinc-500 shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <div
        className={`grid overflow-hidden transition-all duration-200 ${
          open ? "grid-rows-[1fr] pb-5" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0">
          <p className="text-sm text-zinc-400 leading-relaxed">{a}</p>
        </div>
      </div>
    </div>
  );
}

function FAQSection({ faqs }: { faqs?: PublicBookingFaq[] }) {
  const items = (faqs && faqs.length > 0 ? faqs : FAQS).filter(
    (f) => f.q?.trim() && f.a?.trim()
  );
  if (items.length === 0) return null;
  return (
    <section id="faq" className="border-b border-zinc-800 bg-zinc-900/30 scroll-mt-20">
      <div className="max-w-3xl mx-auto px-4 py-16 md:py-20">
        <SectionTitle
          eyebrow="Common questions"
          title="Frequently asked"
          body="Don't see your question? Reach out and ask — I'll get back to you fast."
          centered
        />

        <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-950 px-5 md:px-7">
          {items.map((f, i) => (
            <FAQItem key={`${f.q}-${i}`} q={f.q} a={f.a} defaultOpen={i === 0} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA({ onBookClick }: { onBookClick: () => void }) {
  return (
    <section className="bg-zinc-950">
      <div className="max-w-4xl mx-auto px-4 py-16 md:py-24">
        <div className="relative rounded-3xl border border-red-600/30 bg-gradient-to-br from-red-950/40 via-zinc-950 to-zinc-950 p-8 md:p-14 overflow-hidden">
          <div
            className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-red-600/20 blur-3xl"
            aria-hidden="true"
          />
          <div className="relative text-center">
            <Sparkles className="h-8 w-8 text-red-500 mx-auto" />
            <h2 className="mt-4 text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              Ready to get your vehicle looking right?
            </h2>
            <p className="mt-3 text-base text-zinc-400 max-w-xl mx-auto">
              Book online in a couple minutes. I'll reach out to confirm and answer any questions.
            </p>
            <button
              type="button"
              onClick={onBookClick}
              className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-7 py-4 text-sm font-bold text-white hover:bg-red-700 transition-all shadow-lg shadow-red-600/30"
            >
              Book Your Detail
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer({
  businessName,
  serviceArea,
  phone,
  email,
  logoUrl,
}: {
  businessName: string;
  serviceArea?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
}) {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-950">
      <div className="max-w-6xl mx-auto px-4 py-10 md:py-12">
        <div className="grid md:grid-cols-3 gap-6 items-start">
          <div>
            <div className="flex items-center gap-2.5">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
              ) : (
                <div className="h-9 w-9 rounded-lg bg-red-600 flex items-center justify-center">
                  <Car className="h-5 w-5 text-white" />
                </div>
              )}
              <span className="text-base font-bold text-white">{businessName}</span>
            </div>
            {serviceArea ? (
              <p className="mt-3 text-xs text-zinc-500 inline-flex items-center gap-1.5">
                <MapPin className="h-3 w-3" />
                {serviceArea}
              </p>
            ) : null}
          </div>

          <div className="text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">Contact</p>
            <div className="space-y-2 text-zinc-400">
              {phone ? (
                <p className="inline-flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-zinc-500" />
                  <a href={`tel:${phone}`} className="hover:text-white transition-colors">{phone}</a>
                </p>
              ) : null}
              {email ? (
                <p className="inline-flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-zinc-500" />
                  <a href={`mailto:${email}`} className="hover:text-white transition-colors">{email}</a>
                </p>
              ) : null}
              {!phone && !email ? (
                <p className="text-zinc-600 text-xs">Use the booking form to reach me.</p>
              ) : null}
            </div>
          </div>

          <div className="text-sm">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 mb-3">Browse</p>
            <ul className="space-y-2 text-zinc-400">
              {NAV_LINKS.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => scrollToId(l.id)}
                    className="hover:text-white transition-colors"
                  >
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-zinc-900 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-zinc-600">
          <p>© {new Date().getFullYear()} {businessName}. All rights reserved.</p>
          <p className="text-zinc-700">Mobile detailing, done right.</p>
        </div>
      </div>
    </footer>
  );
}

/* ==========================================================================
   Booking form section (the existing 7-step flow, embedded inline)
   ========================================================================== */

interface BookingFormSectionProps {
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
}

function BookingFormSection({
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
}: BookingFormSectionProps) {
  const depositActive = !!deposit?.enabled && !!deposit.required;
  const stepIcons = [Car, Wrench, Car, CalendarDays, User, Zap, ClipboardList];
  const StepIcon = stepIcons[step - 1];

  return (
    <section id="book" className="border-b border-zinc-800 bg-zinc-950 scroll-mt-20">
      <div className="max-w-3xl mx-auto px-4 py-16 md:py-20">
        <SectionTitle
          eyebrow="Booking"
          title="Request a detail"
          body="Step-by-step — under two minutes. I'll reach out to confirm."
          centered
        />

        <div className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
          {/* Progress strip */}
          <div className="px-5 md:px-7 py-4 border-b border-zinc-800 bg-zinc-950/60">
            <div className="flex items-center gap-3 mb-2.5">
              <div className="h-7 w-7 rounded-md bg-red-600/20 border border-red-600/30 flex items-center justify-center">
                <StepIcon className="h-3.5 w-3.5 text-red-400" />
              </div>
              <StepLabel step={step} />
              {estimatedPrice > 0 && (
                <span className="ml-auto text-xs font-semibold text-zinc-300 rounded-full bg-zinc-800 px-2.5 py-1 border border-zinc-700">
                  Est. ~${estimatedPrice}
                </span>
              )}
            </div>
            <ProgressBar step={step} />
          </div>

          {/* Body */}
          <div className="px-5 md:px-7 py-6 md:py-7">
            {step === 1 && <Step1Service services={services} form={form} set={set} />}
            {step === 2 && <Step2Addons services={services} form={form} set={set} estimatedPrice={estimatedPrice} />}
            {step === 3 && <Step3Vehicle form={form} set={set} />}
            {step === 4 && <Step4DateTime form={form} set={set} bookedSlots={bookedSlots} />}
            {step === 5 && <Step5Contact form={form} set={set} />}
            {step === 6 && <Step6Access form={form} set={set} />}
            {step === 7 && (
              <Step7Review
                form={form}
                services={services}
                estimatedPrice={estimatedPrice}
                disclaimer={disclaimer}
                deposit={deposit}
              />
            )}

            {/* Honeypot */}
            <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", opacity: 0 }}>
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={(e) => set({ website: e.target.value })}
              />
            </div>

            {submitError && (
              <div className="mt-5 rounded-xl border border-red-600/40 bg-red-900/20 p-3 text-sm text-red-300">
                {submitError}
              </div>
            )}
          </div>

          {/* Step nav */}
          <div className="px-5 md:px-7 py-4 border-t border-zinc-800 bg-zinc-950/60 flex items-center gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-800"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>
            ) : (
              <div className="text-xs text-zinc-500">Step 1 of {TOTAL_STEPS}</div>
            )}

            {step < TOTAL_STEPS ? (
              <button
                type="button"
                disabled={!canProceed()}
                onClick={() => setStep((s) => s + 1)}
                className="ml-auto flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={onSubmit}
                className="ml-auto flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {depositActive ? "Starting payment…" : "Submitting…"}
                  </>
                ) : depositActive ? (
                  <>
                    Pay Deposit & Request Booking
                    <CheckCircle2 className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    Submit Booking Request
                    <CheckCircle2 className="h-4 w-4" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-zinc-600">
          Final price may vary based on vehicle condition at inspection.
        </p>
      </div>
    </section>
  );
}

/* ==========================================================================
   Mobile floating CTA
   ========================================================================== */

function MobileBookCTA({ onClick, hidden }: { onClick: () => void; hidden: boolean }) {
  if (hidden) return null;
  return (
    <div className="md:hidden fixed bottom-4 inset-x-4 z-30">
      <button
        type="button"
        onClick={onClick}
        className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-4 text-sm font-bold text-white shadow-2xl shadow-red-600/40 hover:bg-red-700 transition-all"
      >
        Book a Detail
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

/* ==========================================================================
   Status screens
   ========================================================================== */

function BookingSuccess({ businessName }: { businessName: string }) {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-6">
        <CheckCircle2 className="h-8 w-8 text-emerald-400" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Request Submitted!</h1>
      <p className="text-zinc-300 max-w-sm text-sm leading-relaxed">
        Your booking request has been submitted. I'll reach out shortly to confirm your appointment.
      </p>
      <p className="text-zinc-500 text-xs mt-6">— {businessName}</p>
    </div>
  );
}

function BookingUnavailable() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-6">
        <AlertCircle className="h-8 w-8 text-zinc-400" />
      </div>
      <h1 className="text-2xl font-bold text-white mb-2">Booking Unavailable</h1>
      <p className="text-zinc-400 text-sm max-w-xs">
        Online booking isn't available right now. Please reach out directly to schedule an appointment.
      </p>
    </div>
  );
}

/* ==========================================================================
   Main component
   ========================================================================== */

export function BookingPage() {
  const [step, setStep] = useState(1);
  const [info, setInfo] = useState<PublicBookingInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [infoError, setInfoError] = useState("");
  const [form, setFormRaw] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Hide the floating mobile CTA when the user has scrolled into the form
  const [inFormSection, setInFormSection] = useState(false);

  function set(patch: Partial<FormState>) {
    setFormRaw((prev) => ({ ...prev, ...patch }));
  }

  useEffect(() => {
    getPublicBookingInfo()
      .then((d) => setInfo(d))
      .catch((e) => setInfoError(e?.message ?? "Failed to load booking info"))
      .finally(() => setInfoLoading(false));
  }, []);

  // Scroll to the top of the booking form on every step change
  useEffect(() => {
    const el = document.getElementById("book");
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - 16;
    window.scrollTo({ top: y, behavior: "smooth" });
  }, [step]);

  // Once we know the business name + logo, swap the page title and favicon
  // so the browser tab shows the right brand. Cleans up when the user
  // navigates away from /book.
  useEffect(() => {
    if (!info?.settings) return;
    const prevTitle = document.title;
    document.title = `${info.settings.businessName} — Book a Detail`;

    const head = document.head;
    const logoUrl = info.settings.logoUrl;
    let oldHrefs: { node: HTMLLinkElement; href: string }[] = [];
    let added: HTMLLinkElement[] = [];

    if (logoUrl) {
      // Update any existing icon links and add a fresh one for safety.
      const existing = head.querySelectorAll<HTMLLinkElement>('link[rel*="icon"]');
      existing.forEach((node) => {
        oldHrefs.push({ node, href: node.href });
        node.href = logoUrl;
      });
      if (existing.length === 0) {
        const link = document.createElement("link");
        link.rel = "icon";
        link.href = logoUrl;
        head.appendChild(link);
        added.push(link);
      }
    }
    return () => {
      document.title = prevTitle;
      oldHrefs.forEach(({ node, href }) => {
        node.href = href;
      });
      added.forEach((node) => node.remove());
    };
  }, [info?.settings.businessName, info?.settings.logoUrl]);

  // Track whether the booking form is visible to suppress the mobile CTA
  useEffect(() => {
    const el = document.getElementById("book");
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setInFormSection(entry.isIntersecting);
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [info]);

  const services = info?.services ?? [];
  const bookedSlots = info?.bookedSlots ?? [];
  const deposit = info?.deposit;

  const estimatedPrice = useMemo(() => {
    let total = 0;
    const pkg = services.find((s) => s.id === form.serviceId);
    if (pkg) total += midPrice(pkg);
    for (const id of form.addonIds) {
      const a = services.find((s) => s.id === id);
      if (a) total += midPrice(a);
    }
    return total;
  }, [form.serviceId, form.addonIds, services]);

  function canProceed(): boolean {
    switch (step) {
      case 1: return !!form.serviceId;
      case 2: return true;
      case 3: return !!form.vehicleSize;
      case 4: {
        if (!form.preferredDate || !form.serviceAddress.trim()) return false;
        // If a time was picked, it must not have become booked.
        if (form.preferredTime && isSlotBooked(form.preferredDate, form.preferredTime, bookedSlots)) return false;
        return true;
      }
      case 5: return !!form.name.trim() && !!form.phone.trim();
      case 6: return true;
      case 7: return true;
      default: return true;
    }
  }

  async function handleSubmit() {
    if (form.website) return; // honeypot
    setSubmitting(true);
    setSubmitError("");
    try {
      // Upload photos first (same flow regardless of deposit path).
      const photoUrls: string[] = [];
      let photoFailCount = 0;
      for (const file of form.photoFiles) {
        try {
          const url = await uploadBookingPhoto(file);
          photoUrls.push(url);
        } catch (uploadErr) {
          photoFailCount++;
          console.error("[booking] Photo upload failed:", file.name, uploadErr);
        }
      }
      if (photoFailCount > 0) {
        console.warn(
          `[booking] ${photoFailCount} of ${form.photoFiles.length} photo(s) failed to upload. ` +
          "Continuing with booking submission. Check booking-uploads bucket policies."
        );
      }

      const payload = {
        customerName: form.name.trim(),
        customerPhone: form.phone.trim(),
        customerEmail: form.email.trim() || undefined,
        customerAddress: form.serviceAddress.trim() || undefined,
        preferredContact: form.preferredContact,
        vehicleYear: form.vehicleYear,
        vehicleMake: form.vehicleMake,
        vehicleModel: form.vehicleModel,
        vehicleColor: form.vehicleColor,
        vehicleSize: form.vehicleSize,
        interiorCondition: form.interiorCondition,
        exteriorCondition: form.exteriorCondition,
        petHair: form.petHair,
        stains: form.stains,
        heavyDirt: form.heavyDirt,
        vehicleNotes: form.vehicleNotes || undefined,
        serviceIds: form.serviceId ? [form.serviceId] : [],
        addonIds: form.addonIds,
        estimatedPrice,
        preferredDate: form.preferredDate || undefined,
        preferredTime: form.preferredTime || undefined,
        waterAccess: form.waterAccess,
        powerAccess: form.powerAccess,
        bookingPhotoUrls: photoUrls,
        honeypot: form.website,
      };

      // Branch: deposit required (and enabled) → Stripe Checkout flow.
      // Otherwise: existing free submission flow.
      const deposit = info?.deposit;
      const useDeposit =
        !!deposit &&
        deposit.enabled &&
        deposit.required &&
        !deposit.allowWithoutDeposit; // when both are set, server still requires deposit

      if (useDeposit) {
        const result = await createDepositCheckout(payload);
        // Hard redirect — Stripe owns the URL. We do NOT mark anything paid here.
        window.location.href = result.checkoutUrl;
        return; // unreachable, but keeps TS happy
      }

      await submitPublicBooking(payload);
      setSubmitted(true);
    } catch (e: any) {
      console.error("[booking] Submission failed:", e);
      setSubmitError(e?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function jumpToBook() {
    scrollToId("book");
  }

  function selectServiceAndJump(serviceId: string) {
    set({ serviceId });
    setStep(2); // skip past service selection since they just picked one
    // Wait a tick so the form re-renders with the new step before scrolling
    setTimeout(() => scrollToId("book"), 50);
  }

  // ── Loading / error / disabled states ────────────────────────────────────
  if (infoLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-red-500 animate-spin" />
      </div>
    );
  }
  if (infoError) return <BookingUnavailable />;
  if (!info?.settings?.bookingPageEnabled) return <BookingUnavailable />;
  if (submitted) return <BookingSuccess businessName={info.settings.businessName} />;

  const settings = info.settings;

  return (
    <div className="min-h-screen bg-zinc-950 text-white antialiased scroll-smooth">
      <TopNav
        businessName={settings.businessName}
        logoUrl={settings.logoUrl}
        onBookClick={jumpToBook}
      />

      <main>
        <Hero
          businessName={settings.businessName}
          serviceArea={settings.serviceArea}
          heroHeadline={settings.heroHeadline}
          heroSubheadline={settings.heroSubheadline}
          heroImageUrl={settings.heroImageUrl}
          logoUrl={settings.logoUrl}
          onBookClick={jumpToBook}
          onServicesClick={() => scrollToId("services")}
        />

        <TrustBar />

        <ServicesShowcase services={services} onSelect={selectServiceAndJump} />

        <HowItWorks />

        <BeforeAfterGallery featuredPhotos={settings.featuredPhotos} />

        <WhyChooseUs />

        <WaterPowerInfo customText={settings.waterPowerText} />

        <BookingFormSection
          step={step}
          setStep={setStep}
          form={form}
          set={set}
          services={services}
          estimatedPrice={estimatedPrice}
          disclaimer={settings.defaultQuoteDisclaimer}
          canProceed={canProceed}
          submitting={submitting}
          submitError={submitError}
          onSubmit={handleSubmit}
          bookedSlots={bookedSlots}
          deposit={deposit}
        />

        <FAQSection faqs={settings.faqs} />

        <FinalCTA onBookClick={jumpToBook} />
      </main>

      <Footer
        businessName={settings.businessName}
        serviceArea={settings.serviceArea}
        phone={settings.bookingPhone}
        email={settings.bookingEmail}
        logoUrl={settings.logoUrl}
      />

      <MobileBookCTA onClick={jumpToBook} hidden={inFormSection} />
    </div>
  );
}
