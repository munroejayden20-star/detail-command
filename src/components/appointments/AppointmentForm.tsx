import { useEffect, useMemo, useState } from "react";
import { addMinutes, formatISO, parseISO } from "date-fns";
import {
  toBusinessDateKey,
  toBusinessTimeKey,
  combineLocalDateTimeInBusinessTimezone,
} from "@/lib/datetime";
import { Trash2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useStore, makeId } from "@/store/store";
import {
  type Appointment,
  type Customer,
  type JobStatus,
  type PaymentStatus,
  JOB_STATUSES,
} from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";
import { computeQuote } from "@/lib/pricing/engine";
import { mergePricingConfig } from "@/lib/pricing/merge";
import type { PublicService } from "@/lib/booking-api";
import {
  VEHICLE_SIZES,
  CONDITION_OPTIONS,
} from "@/components/booking/luxury/form-steps/types";

interface AppointmentFormProps {
  appointment?: Appointment;
  initialDate?: Date;
  onDone: () => void;
  onDelete?: () => void;
  /**
   * Called after a successful save. If provided, the form does NOT call
   * onDone() automatically — parent decides what comes next (e.g. open
   * MarkCompleteDialog when the appointment transitioned to "completed").
   */
  onSaved?: (saved: Appointment, transitionedToCompleted: boolean) => void;
}

/**
 * Render an ISO timestamp as the YYYY-MM-DDTHH:mm string a `datetime-local`
 * input expects, *displayed in business timezone*. So a UTC instant that is
 * 8:00 AM in LA always shows as 8:00 AM in this input — regardless of the
 * dashboard's browser timezone.
 */
function toLocalInput(iso: string): string {
  if (!iso) return "";
  const dateKey = toBusinessDateKey(iso); // "YYYY-MM-DD" in LA
  const timeKey = toBusinessTimeKey(iso); // "HH:mm" in LA
  if (!dateKey || !timeKey) return "";
  return `${dateKey}T${timeKey}`;
}

/**
 * Inverse of toLocalInput: take the YYYY-MM-DDTHH:mm string from the input
 * (which the user is editing in business-local wall-clock) and produce the
 * correct UTC ISO timestamp.
 */
function fromLocalInput(local: string): string {
  if (!local) return "";
  const [datePart, timePart] = local.split("T");
  if (!datePart || !timePart) return "";
  return combineLocalDateTimeInBusinessTimezone(datePart, timePart.slice(0, 5));
}

const DEFAULT_VEHICLE = { year: "", make: "", model: "", color: "", conditionNotes: "" };

export function AppointmentForm({ appointment, initialDate, onDone, onDelete, onSaved }: AppointmentFormProps) {
  const { data, dispatch } = useStore();
  const services = data.services.filter((s) => !s.isAddon);
  const addons = data.services.filter((s) => s.isAddon);

  const [form, setForm] = useState<Appointment>(() => {
    if (appointment) return { ...appointment };
    const start = initialDate ?? new Date();
    return {
      id: makeId(),
      customerId: data.customers[0]?.id ?? "",
      vehicle: { ...DEFAULT_VEHICLE },
      address: "",
      start: formatISO(start),
      end: formatISO(addMinutes(start, 120)),
      serviceIds: services[0] ? [services[0].id] : [],
      addonIds: [],
      estimatedPrice: 0,
      depositPaid: false,
      paymentStatus: "unpaid",
      status: "scheduled",
      petHair: false,
      stains: false,
      heavyDirt: false,
      waterAccess: true,
      powerAccess: true,
      customerNotes: "",
      internalNotes: "",
      createdAt: formatISO(new Date()),
    };
  });

  const [newCustomer, setNewCustomer] = useState({ name: "", phone: "", email: "" });
  const [creatingCustomer, setCreatingCustomer] = useState(!data.customers.length);

  const selectedCustomer = useMemo(
    () => data.customers.find((c) => c.id === form.customerId),
    [data.customers, form.customerId]
  );

  // Auto-fill address/vehicle when picking customer
  useEffect(() => {
    if (!selectedCustomer || appointment) return;
    setForm((f) => ({
      ...f,
      address: f.address || selectedCustomer.address || "",
      vehicle:
        f.vehicle.make || f.vehicle.model
          ? f.vehicle
          : selectedCustomer.vehicles[0] ?? { ...DEFAULT_VEHICLE },
    }));
  }, [selectedCustomer, appointment]);

  // Owner-tuned pricing config from settings — same source the booking page
  // and standalone calculator read, so all three surfaces stay in sync.
  const pricingConfig = useMemo(
    () => mergePricingConfig(data.settings.pricingConfig ?? null),
    [data.settings.pricingConfig],
  );

  // Auto-update estimated price + duration via the pricing engine. This is
  // the same `computeQuote` the customer-facing /book and /calculator screens
  // call, so the number the admin sees matches what the customer would have
  // been quoted for the same configuration (vehicle size, condition tiers,
  // flags, addons, discounts, profit floor, minimum booking, rounding).
  useEffect(() => {
    const selectedPackages = form.serviceIds
      .map((id) => services.find((s) => s.id === id))
      .filter((s): s is typeof services[number] => !!s)
      .map((s) => s as PublicService);

    const selectedAddons = form.addonIds
      .map((id) => addons.find((a) => a.id === id))
      .filter((a): a is typeof addons[number] => !!a)
      .map((service) => ({ service: service as PublicService, quantity: 1 }));

    if (selectedPackages.length === 0 && selectedAddons.length === 0) {
      // Nothing selected → don't disturb start/end; just zero the estimate.
      setForm((f) => ({ ...f, estimatedPrice: 0 }));
      return;
    }

    const quote = computeQuote(
      {
        packages: selectedPackages,
        addons: selectedAddons,
        vehicleSize: form.vehicle.size ?? "",
        interiorCondition: form.interiorCondition ?? "",
        exteriorCondition: form.exteriorCondition ?? "",
        flags: {
          petHair: form.petHair,
          stains: form.stains,
          heavyDirt: form.heavyDirt,
        },
      },
      pricingConfig,
    );

    const durationMinutes = Math.max(60, Math.round(quote.laborHours * 60));
    const newEnd = formatISO(addMinutes(parseISO(form.start), durationMinutes));
    setForm((f) => ({ ...f, estimatedPrice: quote.estimate, end: newEnd }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.serviceIds.join(","),
    form.addonIds.join(","),
    form.vehicle.size,
    form.interiorCondition,
    form.exteriorCondition,
    form.petHair,
    form.stains,
    form.heavyDirt,
    form.start,
    pricingConfig,
  ]);

  function update<K extends keyof Appointment>(key: K, value: Appointment[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleService(id: string) {
    setForm((f) => ({
      ...f,
      serviceIds: f.serviceIds.includes(id)
        ? f.serviceIds.filter((x) => x !== id)
        : [...f.serviceIds, id],
    }));
  }

  function toggleAddon(id: string) {
    setForm((f) => ({
      ...f,
      addonIds: f.addonIds.includes(id)
        ? f.addonIds.filter((x) => x !== id)
        : [...f.addonIds, id],
    }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let customerId = form.customerId;

    if (creatingCustomer && newCustomer.name && newCustomer.phone) {
      const customer: Customer = {
        id: makeId(),
        name: newCustomer.name.trim(),
        phone: newCustomer.phone.trim(),
        email: newCustomer.email.trim() || undefined,
        address: form.address || undefined,
        vehicles: form.vehicle.make ? [form.vehicle] : [],
        createdAt: formatISO(new Date()),
      };
      dispatch({ type: "addCustomer", customer });
      customerId = customer.id;
    }

    const payload: Appointment = { ...form, customerId };
    const wasCompleted = appointment?.status === "completed";
    const transitionedToCompleted = !wasCompleted && payload.status === "completed";

    if (appointment) {
      dispatch({ type: "updateAppointment", id: appointment.id, patch: payload });
      toast.success("Appointment saved");
    } else {
      dispatch({ type: "addAppointment", appt: payload });
      toast.success("Appointment booked");
    }
    if (onSaved) {
      onSaved(payload, transitionedToCompleted);
    } else {
      onDone();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Customer */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Customer</h3>
          <button
            type="button"
            onClick={() => setCreatingCustomer((v) => !v)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {creatingCustomer ? "Pick existing customer" : "+ New customer"}
          </button>
        </div>

        {creatingCustomer ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="newName">Name</Label>
              <Input
                id="newName"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                placeholder="Customer name"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPhone">Phone</Label>
              <Input
                id="newPhone"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                placeholder="(555) 123-4567"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newEmail">Email (optional)</Label>
              <Input
                id="newEmail"
                type="email"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label>Existing customer</Label>
            <Select
              value={form.customerId}
              onValueChange={(value) => update("customerId", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a customer" />
              </SelectTrigger>
              <SelectContent>
                {data.customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} · {c.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </section>

      <Separator />

      {/* Schedule */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Schedule & Status</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="start">Start</Label>
            <Input
              id="start"
              type="datetime-local"
              value={toLocalInput(form.start)}
              onChange={(e) => update("start", fromLocalInput(e.target.value))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end">End</Label>
            <Input
              id="end"
              type="datetime-local"
              value={toLocalInput(form.end)}
              onChange={(e) => update("end", fromLocalInput(e.target.value))}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              value={form.status}
              onValueChange={(v) => update("status", v as JobStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {JOB_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="addr">Service address</Label>
          <Input
            id="addr"
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            placeholder="123 Main St, City"
            required
          />
        </div>
      </section>

      <Separator />

      {/* Vehicle */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Vehicle</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="year">Year</Label>
            <Input
              id="year"
              value={form.vehicle.year}
              onChange={(e) =>
                update("vehicle", { ...form.vehicle, year: e.target.value })
              }
              placeholder="2020"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="make">Make</Label>
            <Input
              id="make"
              value={form.vehicle.make}
              onChange={(e) =>
                update("vehicle", { ...form.vehicle, make: e.target.value })
              }
              placeholder="Toyota"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="model">Model</Label>
            <Input
              id="model"
              value={form.vehicle.model}
              onChange={(e) =>
                update("vehicle", { ...form.vehicle, model: e.target.value })
              }
              placeholder="RAV4"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="color">Color</Label>
            <Input
              id="color"
              value={form.vehicle.color}
              onChange={(e) =>
                update("vehicle", { ...form.vehicle, color: e.target.value })
              }
              placeholder="Silver"
            />
          </div>
        </div>

        {/* Vehicle size — feeds the pricing engine's size multiplier so the
         *  estimated price tracks what the customer would have been quoted. */}
        <div className="space-y-1.5">
          <Label htmlFor="vehicleSize">Size</Label>
          <Select
            value={form.vehicle.size ?? ""}
            onValueChange={(v) =>
              update("vehicle", { ...form.vehicle, size: v })
            }
          >
            <SelectTrigger id="vehicleSize">
              <SelectValue placeholder="Pick a size (baseline = sedan)" />
            </SelectTrigger>
            <SelectContent>
              {VEHICLE_SIZES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                  <span className="ml-2 text-xs text-muted-foreground">{s.hint}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="extCond">Exterior condition</Label>
            <Select
              value={form.exteriorCondition ?? ""}
              onValueChange={(v) => update("exteriorCondition", v)}
            >
              <SelectTrigger id="extCond">
                <SelectValue placeholder="Pick a tier (baseline = average)" />
              </SelectTrigger>
              <SelectContent>
                {CONDITION_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                    <span className="ml-2 text-xs text-muted-foreground">{c.hint}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="intCond">Interior condition</Label>
            <Select
              value={form.interiorCondition ?? ""}
              onValueChange={(v) => update("interiorCondition", v)}
            >
              <SelectTrigger id="intCond">
                <SelectValue placeholder="Pick a tier (baseline = average)" />
              </SelectTrigger>
              <SelectContent>
                {CONDITION_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                    <span className="ml-2 text-xs text-muted-foreground">{c.hint}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <FlagBox
            label="Pet hair"
            checked={form.petHair}
            onChange={(v) => update("petHair", v)}
          />
          <FlagBox
            label="Stains"
            checked={form.stains}
            onChange={(v) => update("stains", v)}
          />
          <FlagBox
            label="Heavy dirt / mud"
            checked={form.heavyDirt}
            onChange={(v) => update("heavyDirt", v)}
          />
        </div>
      </section>

      <Separator />

      {/* Site requirements */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Site access</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FlagBox
            label="Water access confirmed"
            checked={form.waterAccess}
            onChange={(v) => update("waterAccess", v)}
            tone="positive"
          />
          <FlagBox
            label="Power outlet confirmed"
            checked={form.powerAccess}
            onChange={(v) => update("powerAccess", v)}
            tone="positive"
          />
        </div>
      </section>

      <Separator />

      {/* Services */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Service package & add-ons</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {services.map((s) => {
            const active = form.serviceIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleService(s.id)}
                className={cn(
                  "rounded-lg border p-3 text-left transition-all",
                  active
                    ? "border-primary bg-primary/5 shadow-soft"
                    : "border-border bg-card hover:bg-accent"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{s.name}</span>
                  <span className="text-xs text-muted-foreground">
                    ${s.priceLow}–${s.priceHigh}
                  </span>
                </div>
                {s.description ? (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {s.description}
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>

        <div>
          <Label className="mb-2 inline-block">Add-ons</Label>
          <div className="flex flex-wrap gap-2">
            {addons.map((a) => {
              const active = form.addonIds.includes(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAddon(a.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card hover:bg-accent"
                  )}
                >
                  {a.name} · ${a.priceLow}
                  {a.priceHigh !== a.priceLow ? `–$${a.priceHigh}` : ""}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <Separator />

      {/* Pricing */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Pricing & payment</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Estimated price</Label>
            <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm font-semibold">
              {formatCurrency(form.estimatedPrice)}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="finalPrice">Final price</Label>
            <Input
              id="finalPrice"
              type="number"
              min="0"
              value={form.finalPrice ?? ""}
              onChange={(e) =>
                update(
                  "finalPrice",
                  e.target.value === "" ? undefined : Number(e.target.value)
                )
              }
              placeholder="—"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Payment status</Label>
            <Select
              value={form.paymentStatus}
              onValueChange={(v) => update("paymentStatus", v as PaymentStatus)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="deposit">Deposit paid</SelectItem>
                <SelectItem value="paid">Paid in full</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <FlagBox
          label="Deposit collected"
          checked={form.depositPaid}
          onChange={(v) => update("depositPaid", v)}
        />
      </section>

      <Separator />

      {/* Notes */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Notes</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="custNotes">Customer notes</Label>
            <Textarea
              id="custNotes"
              value={form.customerNotes ?? ""}
              onChange={(e) => update("customerNotes", e.target.value)}
              placeholder="Things the customer said…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="intNotes">Internal notes</Label>
            <Textarea
              id="intNotes"
              value={form.internalNotes ?? ""}
              onChange={(e) => update("internalNotes", e.target.value)}
              placeholder="Things only you see…"
            />
          </div>
        </div>
      </section>

      {/* Booking Photos — read-only, submitted by customer via /book */}
      {form.bookingPhotoUrls && form.bookingPhotoUrls.length > 0 && (
        <>
          <Separator />
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Booking Photos</h3>
              <span className="text-xs text-muted-foreground">
                ({form.bookingPhotoUrls.length} submitted by customer)
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {form.bookingPhotoUrls.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block aspect-square rounded-lg overflow-hidden border border-border hover:opacity-80 transition-opacity"
                >
                  <img
                    src={url}
                    alt={`Booking photo ${i + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </a>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Photos uploaded by the customer during their online booking request. Click to open full size.
            </p>
          </section>
        </>
      )}

      <div className="flex items-center justify-between gap-2 pt-2">
        {appointment && onDelete ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit">{appointment ? "Save changes" : "Create appointment"}</Button>
        </div>
      </div>
    </form>
  );
}

function FlagBox({
  label,
  checked,
  onChange,
  tone,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  tone?: "positive";
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-all",
        checked
          ? tone === "positive"
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200"
            : "border-primary bg-primary/10 text-primary"
          : "border-border bg-card hover:bg-accent"
      )}
    >
      <Checkbox checked={checked} onCheckedChange={onChange} />
      <span className="font-medium">{label}</span>
    </button>
  );
}
