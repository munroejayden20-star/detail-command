import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, CheckCircle2, ChevronLeft, ChevronRight, Car, Wrench, CalendarDays, User, Zap, ClipboardList, Image, X, Upload, AlertCircle } from "lucide-react";
import { getPublicBookingInfo, submitPublicBooking, uploadBookingPhoto, type PublicBookingInfo, type PublicService } from "@/lib/booking-api";

/* ---------- Types ---------- */
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

const TIME_OPTIONS = [
  { value: "08:00", label: "Morning (8am)" },
  { value: "10:00", label: "Mid-Morning (10am)" },
  { value: "12:00", label: "Noon (12pm)" },
  { value: "14:00", label: "Afternoon (2pm)" },
  { value: "16:00", label: "Late Afternoon (4pm)" },
];

const CONTACT_OPTIONS = [
  { value: "text", label: "Text message" },
  { value: "call", label: "Phone call" },
  { value: "email", label: "Email" },
];

const TOTAL_STEPS = 7;

/* ---------- Helpers ---------- */
function fmtPrice(low: number, high: number) {
  if (low === high) return `$${low}`;
  return `$${low}–$${high}`;
}

function midPrice(s: PublicService) {
  return Math.round((s.priceLow + s.priceHigh) / 2);
}

/* ---------- Sub-components ---------- */

function ProgressBar({ step }: { step: number }) {
  const pct = Math.round(((step - 1) / (TOTAL_STEPS - 1)) * 100);
  return (
    <div className="w-full bg-zinc-800 h-1">
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
    <div className="flex items-center gap-2 text-xs text-zinc-400 mb-1">
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
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-xl border p-4 transition-all pressable ${
        selected
          ? "border-red-500 bg-red-500/10 shadow-[0_0_0_2px_rgba(239,68,68,0.3)]"
          : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm">{service.name}</p>
          {service.description ? (
            <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{service.description}</p>
          ) : null}
          <p className="text-xs text-zinc-500 mt-1">
            Est. {service.durationMinutes >= 60 ? `${Math.round(service.durationMinutes / 60 * 10) / 10}h` : `${service.durationMinutes}min`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-bold text-white text-sm">{fmtPrice(service.priceLow, service.priceHigh)}</p>
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
      className={`w-full text-left rounded-xl border p-3 transition-all pressable ${
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
      className={`w-full text-left rounded-xl border p-3 transition-all pressable ${
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

const selectCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red-500";

/* ---------- Steps ---------- */

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
        <h2 className="text-xl font-bold text-white">Choose a service package</h2>
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
        <h2 className="text-xl font-bold text-white">Add-ons</h2>
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
          Final price confirmed after reviewing your vehicle. Larger or heavily soiled vehicles may vary.
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
        <h2 className="text-xl font-bold text-white">Tell me about your vehicle</h2>
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
              className={`rounded-xl border p-3 text-left transition-all pressable ${
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
              className={`rounded-xl border p-2.5 text-center transition-all pressable ${
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
              className={`rounded-xl border p-2.5 text-center transition-all pressable ${
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
}: {
  form: FormState;
  set: (patch: Partial<FormState>) => void;
}) {
  const today = new Date().toISOString().split("T")[0];
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">When and where?</h2>
        <p className="text-sm text-zinc-400 mt-1">Request a preferred time. I'll confirm availability when I reach out.</p>
      </div>

      <InputField label="Preferred date" required>
        <input
          type="date"
          className={inputCls}
          min={today}
          value={form.preferredDate}
          onChange={(e) => set({ preferredDate: e.target.value })}
        />
      </InputField>

      <div>
        <SectionLabel>Preferred time</SectionLabel>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TIME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set({ preferredTime: opt.value })}
              className={`rounded-xl border py-2.5 px-3 text-sm font-medium transition-all pressable ${
                form.preferredTime === opt.value
                  ? "border-red-500 bg-red-500/10 text-white"
                  : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-zinc-500"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <InputField label="Service address" required hint="Where should I come? Your home, office, or another location.">
        <textarea
          className={`${inputCls} resize-none`}
          rows={2}
          placeholder="123 Main St, Charlotte, NC 28201"
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
        <h2 className="text-xl font-bold text-white">Your contact info</h2>
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
          placeholder="(704) 555-1234"
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
              className={`rounded-xl border py-2.5 px-3 text-sm font-medium transition-all pressable ${
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
        <h2 className="text-xl font-bold text-white">Water & power access</h2>
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
            className="w-full rounded-xl border border-dashed border-zinc-600 bg-zinc-900 p-5 text-center hover:border-zinc-400 transition-colors pressable"
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
}: {
  form: FormState;
  services: PublicService[];
  estimatedPrice: number;
  disclaimer?: string;
}) {
  const selectedService = services.find((s) => s.id === form.serviceId);
  const selectedAddons = services.filter((s) => form.addonIds.includes(s.id));
  const selectedSize = VEHICLE_SIZES.find((s) => s.value === form.vehicleSize);
  const selectedTime = TIME_OPTIONS.find((t) => t.value === form.preferredTime);

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
        <h2 className="text-xl font-bold text-white">Review your request</h2>
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

      {disclaimer ? (
        <p className="text-xs text-zinc-500 leading-relaxed">{disclaimer}</p>
      ) : (
        <p className="text-xs text-zinc-500 leading-relaxed">
          Estimated price may vary based on the actual condition of the vehicle. Final price confirmed on-site.
        </p>
      )}
    </div>
  );
}

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

/* ---------- Main component ---------- */

export function BookingPage() {
  const [step, setStep] = useState(1);
  const [info, setInfo] = useState<PublicBookingInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(true);
  const [infoError, setInfoError] = useState("");
  const [form, setFormRaw] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function set(patch: Partial<FormState>) {
    setFormRaw((prev) => ({ ...prev, ...patch }));
  }

  useEffect(() => {
    getPublicBookingInfo()
      .then((d) => setInfo(d))
      .catch((e) => setInfoError(e?.message ?? "Failed to load booking info"))
      .finally(() => setInfoLoading(false));
  }, []);

  const services = info?.services ?? [];

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

  // Step validation
  function canProceed(): boolean {
    switch (step) {
      case 1: return !!form.serviceId;
      case 2: return true; // addons optional
      case 3: return !!form.vehicleSize;
      case 4: return !!form.preferredDate && !!form.serviceAddress.trim();
      case 5: return !!form.name.trim() && !!form.phone.trim();
      case 6: return true; // utilities optional
      case 7: return true;
      default: return true;
    }
  }

  async function handleSubmit() {
    // Honeypot check
    if (form.website) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      // Upload photos — failures are non-fatal but logged so they can be debugged
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

      await submitPublicBooking({
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
      });
      setSubmitted(true);
    } catch (e: any) {
      console.error("[booking] Submission failed:", e);
      setSubmitError(e?.message ?? "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Loading
  if (infoLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 text-red-500 animate-spin" />
      </div>
    );
  }

  // Error loading info
  if (infoError) {
    return <BookingUnavailable />;
  }

  // Booking page disabled
  if (!info?.settings?.bookingPageEnabled) {
    return <BookingUnavailable />;
  }

  if (submitted) {
    return <BookingSuccess businessName={info.settings.businessName} />;
  }

  const stepIcons = [Car, Wrench, Car, CalendarDays, User, Zap, ClipboardList];
  const StepIcon = stepIcons[step - 1];

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-red-600 flex items-center justify-center shrink-0">
            <Car className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">{info.settings.businessName}</p>
            {info.settings.serviceArea ? (
              <p className="text-[11px] text-zinc-500 mt-0.5">{info.settings.serviceArea}</p>
            ) : null}
          </div>
        </div>
      </div>

      <ProgressBar step={step} />

      {/* Body */}
      <div className="flex-1 max-w-lg mx-auto w-full px-4 py-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-6 w-6 rounded-md bg-red-600/20 flex items-center justify-center">
            <StepIcon className="h-3.5 w-3.5 text-red-400" />
          </div>
          <StepLabel step={step} />
        </div>

        {step === 1 && <Step1Service services={services} form={form} set={set} />}
        {step === 2 && <Step2Addons services={services} form={form} set={set} estimatedPrice={estimatedPrice} />}
        {step === 3 && <Step3Vehicle form={form} set={set} />}
        {step === 4 && <Step4DateTime form={form} set={set} />}
        {step === 5 && <Step5Contact form={form} set={set} />}
        {step === 6 && <Step6Access form={form} set={set} />}
        {step === 7 && (
          <Step7Review
            form={form}
            services={services}
            estimatedPrice={estimatedPrice}
            disclaimer={info.settings.defaultQuoteDisclaimer}
          />
        )}

        {/* Honeypot — hidden from real users */}
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
          <div className="mt-4 rounded-xl border border-red-600/40 bg-red-900/20 p-3 text-sm text-red-300">
            {submitError}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div className="sticky bottom-0 bg-zinc-950 border-t border-zinc-800 px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-1 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-medium text-zinc-300 hover:bg-zinc-800 pressable"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              disabled={!canProceed()}
              onClick={() => setStep((s) => s + 1)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed pressable"
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-600 py-3 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed pressable"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
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
    </div>
  );
}
