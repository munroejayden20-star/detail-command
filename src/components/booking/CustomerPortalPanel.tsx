/**
 * CustomerPortalPanel — token-gated returning-customer banner on /book.
 *
 * Collapsed by default: "Welcome back, Sam · Next: Tue at 2 PM ▾"
 * Expanded: full upcoming/past appointments + receipts + actions.
 *
 * Renders only when a stored token resolves to a real customer. Hidden
 * otherwise — first-time visitors see zero change vs. before.
 */
import { useState } from "react";
import {
  AlertCircle,
  CalendarClock,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  LogOut,
  Sparkles,
  XCircle,
} from "lucide-react";
import {
  cancelAppointmentByToken,
  rescheduleAppointmentByToken,
  type CustomerPortalData,
  type PortalAppointment,
  type PortalReceipt,
  type PortalServiceItem,
  type PortalVehicle,
} from "@/lib/booking-api";
import { availabilityHintForDate, timeSlotsForDate } from "@/lib/booking-slots";
import { getCustomerToken } from "@/lib/customer-portal-storage";

interface CustomerPortalPanelProps {
  data: CustomerPortalData;
  /** If true, panel opens expanded (used right after submitting a new booking). */
  defaultExpanded?: boolean;
  /** Clear token + drop the panel. */
  onSignOut: () => void;
  /** Refetch portal data after a successful cancel / reschedule. */
  onRefresh: () => void | Promise<void>;
}

export function CustomerPortalPanel({
  data,
  defaultExpanded = false,
  onSignOut,
  onRefresh,
}: CustomerPortalPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const firstName = (data.customer.name || "").trim().split(/\s+/)[0] || "there";
  const next = data.upcoming[0];

  return (
    <div className="sticky top-0 z-40 border-b border-red-500/20 bg-zinc-950/90 backdrop-blur-md">
      <div className="mx-auto max-w-5xl px-4 py-2.5">
        {/* Collapsed bar — always rendered, acts as the toggle */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between gap-3 text-left transition-colors hover:text-white"
          aria-expanded={expanded}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-red-500/40 bg-red-500/10 text-red-400">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">
                Welcome back, {firstName}
              </p>
              <p className="truncate text-[11px] text-zinc-400">
                {next ? `Next: ${formatApptShort(next.startAt)}` : "No upcoming appointments"}
              </p>
            </div>
          </div>
          <span className="shrink-0 text-zinc-500">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </button>

        {/* Expanded body */}
        {expanded ? (
          <div className="mt-3 space-y-3 pb-1">
            {/* Iris note — deterministic status message keyed to the next appt */}
            <IrisNote data={data} />

            {/* Upcoming */}
            <Section title="Upcoming">
              {data.upcoming.length === 0 ? (
                <Empty>No upcoming appointments — scroll down to book one.</Empty>
              ) : (
                <ul className="space-y-1.5">
                  {data.upcoming.map((a) => (
                    <AppointmentRow key={a.id} appt={a} onRefresh={onRefresh} />
                  ))}
                </ul>
              )}
            </Section>

            {/* Receipts */}
            {data.receipts.length > 0 ? (
              <Section title="Receipts">
                <ul className="space-y-1.5">
                  {data.receipts.slice(0, 5).map((r) => (
                    <ReceiptRow key={r.receiptNumber} receipt={r} />
                  ))}
                </ul>
              </Section>
            ) : null}

            {/* Past */}
            {data.past.length > 0 ? (
              <Section title={`Past (${data.past.length})`}>
                <ul className="space-y-1.5">
                  {data.past.slice(0, 5).map((a) => (
                    <AppointmentRow key={a.id} appt={a} muted onRefresh={onRefresh} />
                  ))}
                </ul>
              </Section>
            ) : null}

            {/* Footer actions */}
            <div className="flex items-center justify-end gap-2 border-t border-zinc-800 pt-3">
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-1 text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
                title="Forget this device — useful on shared computers."
              >
                <LogOut className="h-3 w-3" />
                Not you?
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Bits
───────────────────────────────────────────── */

/* ─────────────────────────────────────────────
   Iris note — one deterministic line per panel render,
   chosen from appointment state. No LLM call.
───────────────────────────────────────────── */

function IrisNote({ data }: { data: CustomerPortalData }) {
  const message = buildIrisMessage(data);
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 rounded-md border border-red-500/25 bg-red-500/5 px-3 py-2">
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/15">
        <span
          className="block h-2.5 w-2.5 rounded-full"
          style={{
            background:
              "radial-gradient(circle at 35% 35%, #fecaca 0%, #f87171 35%, #dc2626 70%, #450a0a 100%)",
          }}
        />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-red-300/80">
          Iris
        </p>
        <p className="text-[12px] leading-snug text-zinc-100">{message}</p>
      </div>
    </div>
  );
}

function buildIrisMessage(data: CustomerPortalData): string | null {
  const first = (data.customer.name || "").trim().split(/\s+/)[0];
  const business = data.business.name || "us";
  const next = data.upcoming[0];

  // Active upcoming flow takes priority
  if (next) {
    const start = new Date(next.startAt);
    const now = new Date();
    const diffMs = start.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const sameDay =
      start.toDateString() === now.toDateString();
    const tomorrow = (() => {
      const t = new Date(now);
      t.setDate(t.getDate() + 1);
      return t.toDateString() === start.toDateString();
    })();

    const timeStr = formatApptTimeOnly(next.startAt);

    switch (next.status) {
      case "pending_approval":
        return `Your request for ${formatApptLong(next.startAt)} is in${first ? `, ${first}` : ""}. ${business} usually confirms within a few hours — you'll see the status flip here automatically.`;
      case "confirmed":
        if (sameDay) {
          return `On for today at ${timeStr}. Make sure the vehicle is accessible — water and power at the address help a lot.`;
        }
        if (tomorrow) {
          return `Confirmed for tomorrow at ${timeStr}. See you then!`;
        }
        if (diffHours <= 72) {
          return `Confirmed for ${formatApptLong(next.startAt)}. See you soon.`;
        }
        return `Confirmed for ${formatApptLong(next.startAt)}. You can reschedule or cancel from this panel any time.`;
      case "in_progress":
        return `Working on your vehicle right now — ${business} will be in touch when it's wrapped.`;
      case "scheduled":
        return `On the books for ${formatApptLong(next.startAt)}. ${business} will confirm shortly.`;
      default:
        return `Next up: ${formatApptLong(next.startAt)} (${next.status.replace(/_/g, " ")}).`;
    }
  }

  // No upcoming — look at the most recent past appointment
  const last = data.past[0];
  if (last) {
    if (last.status === "completed") {
      const hasReceipt = data.receipts.length > 0;
      if (hasReceipt) {
        return `Hope it looked great${first ? `, ${first}` : ""}. Your receipt is below — when you're ready, booking another is one tap away.`;
      }
      return `Hope it looked great${first ? `, ${first}` : ""}. Your receipt will land here once ${business} finalizes it.`;
    }
    if (last.status === "canceled") {
      return `Your last appointment was canceled. Ready to rebook? Scroll down and pick a time that works.`;
    }
  }

  // No history at all
  return first
    ? `Welcome, ${first}. Nothing on the calendar yet — scroll down to grab a slot.`
    : null;
}

function formatApptTimeOnly(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: LA_TZ,
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </p>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-500">
      {children}
    </p>
  );
}

const TERMINAL_STATUSES = new Set([
  "completed",
  "canceled",
  "no_show",
  "in_progress",
]);

function AppointmentRow({
  appt,
  muted,
  onRefresh,
}: {
  appt: PortalAppointment;
  muted?: boolean;
  onRefresh: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"view" | "reschedule" | "confirmCancel">("view");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const services = appt.serviceNames.slice(0, 2).join(" + ");
  const more = appt.serviceNames.length > 2 ? ` +${appt.serviceNames.length - 2}` : "";

  const price = appt.finalPrice ?? appt.estimatedPrice;
  const priceLabel = appt.finalPrice != null ? "Total" : "Estimate";

  const canModify = !muted && !TERMINAL_STATUSES.has(appt.status);

  async function handleCancel() {
    const token = getCustomerToken();
    if (!token) return;
    setBusy(true);
    setActionError("");
    try {
      await cancelAppointmentByToken(token, appt.id);
      await onRefresh();
    } catch (e: any) {
      setActionError(e?.message ?? "Could not cancel — try again.");
    } finally {
      setBusy(false);
      setMode("view");
    }
  }

  async function handleReschedule() {
    const token = getCustomerToken();
    if (!token) return;
    if (!newDate || !newTime) {
      setActionError("Pick a date and time first.");
      return;
    }
    setBusy(true);
    setActionError("");
    try {
      await rescheduleAppointmentByToken(token, appt.id, newDate, newTime);
      await onRefresh();
      setMode("view");
      setNewDate("");
      setNewTime("");
    } catch (e: any) {
      setActionError(e?.message ?? "Could not reschedule — try again.");
    } finally {
      setBusy(false);
    }
  }

  const slots = timeSlotsForDate(newDate);
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <li
      className={`overflow-hidden rounded-md border bg-zinc-900/60 ${
        muted ? "border-zinc-800/70" : "border-zinc-700"
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:bg-zinc-900"
        aria-expanded={open}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Calendar
            className={`h-3.5 w-3.5 shrink-0 ${muted ? "text-zinc-500" : "text-red-400"}`}
          />
          <div className="min-w-0">
            <p
              className={`truncate text-xs font-medium ${
                muted ? "text-zinc-300" : "text-white"
              }`}
            >
              {formatApptLong(appt.startAt)}
            </p>
            <p className="truncate text-[11px] text-zinc-400">
              {vehicleStr(appt.vehicle)}
              {services ? <> · {services}{more}</> : null}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusPill status={appt.status} />
          {open ? (
            <ChevronUp className="h-3.5 w-3.5 text-zinc-500" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
          )}
        </div>
      </button>

      {open ? (
        <div className="space-y-2 border-t border-zinc-800 bg-zinc-950/50 px-3 py-2.5 text-[11px]">
          <DetailLine label="When">{formatApptLong(appt.startAt)}</DetailLine>
          <DetailLine label="Vehicle">
            {vehicleStr(appt.vehicle)}
            {appt.vehicle?.color ? (
              <span className="text-zinc-500"> · {appt.vehicle.color}</span>
            ) : null}
            {appt.vehicle?.size ? (
              <span className="text-zinc-500 capitalize"> · {appt.vehicle.size}</span>
            ) : null}
          </DetailLine>
          {appt.serviceItems && appt.serviceItems.length > 0 ? (
            <DetailLine label="Services">
              <ul className="mt-0.5 space-y-1">
                {appt.serviceItems.map((item, i) => (
                  <ServiceItemLine key={`${item.name}-${i}`} item={item} />
                ))}
              </ul>
            </DetailLine>
          ) : appt.serviceNames.length > 0 ? (
            <DetailLine label="Services">
              <ul className="mt-0.5 space-y-0.5">
                {appt.serviceNames.map((name) => (
                  <li key={name} className="flex items-baseline gap-1.5 text-zinc-200">
                    <span className="text-zinc-600">·</span> {name}
                  </li>
                ))}
              </ul>
            </DetailLine>
          ) : null}
          {appt.address ? <DetailLine label="Address">{appt.address}</DetailLine> : null}
          {price != null && price > 0 ? (
            <DetailLine label={priceLabel}>
              <span className="font-mono tabular-nums text-white">
                ${price.toFixed(2)}
              </span>
            </DetailLine>
          ) : null}
          {appt.paymentStatus ? (
            <DetailLine label="Payment">
              <span className="capitalize">{appt.paymentStatus.replace(/_/g, " ")}</span>
              {appt.depositPaid ? (
                <span className="ml-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">
                  Deposit paid
                </span>
              ) : null}
            </DetailLine>
          ) : null}

          {/* Actions */}
          {canModify ? (
            <div className="border-t border-zinc-800/80 pt-2.5">
              {mode === "view" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActionError("");
                      setMode("reschedule");
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-[11px] font-medium text-zinc-200 transition-colors hover:border-red-500/40 hover:bg-zinc-800"
                  >
                    <CalendarClock className="h-3 w-3" />
                    Reschedule
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActionError("");
                      setMode("confirmCancel");
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/5 px-2.5 py-1.5 text-[11px] font-medium text-rose-300 transition-colors hover:border-rose-500/60 hover:bg-rose-500/10"
                  >
                    <XCircle className="h-3 w-3" />
                    Cancel
                  </button>
                  {appt.depositPaid ? (
                    <span className="text-[10px] text-zinc-500">
                      Deposit refunds handled separately — we'll be in touch.
                    </span>
                  ) : null}
                </div>
              ) : mode === "confirmCancel" ? (
                <div className="space-y-2">
                  <p className="flex items-start gap-1.5 text-[11px] text-rose-300">
                    <AlertCircle className="mt-px h-3 w-3 shrink-0" />
                    Cancel this appointment? This can't be undone — you'll need to rebook.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleCancel}
                      className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-rose-700 disabled:opacity-60"
                    >
                      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                      Yes, cancel
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setMode("view")}
                      className="text-[11px] text-zinc-400 hover:text-zinc-200"
                    >
                      Never mind
                    </button>
                  </div>
                </div>
              ) : mode === "reschedule" ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">
                        New date
                      </label>
                      <input
                        type="date"
                        min={todayStr}
                        value={newDate}
                        onChange={(e) => {
                          setNewDate(e.target.value);
                          setNewTime("");
                        }}
                        className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[11px] text-white outline-none focus:border-red-500/50"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] uppercase tracking-wider text-zinc-500">
                        New time
                      </label>
                      <select
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                        disabled={!newDate || slots.length === 0}
                        className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-[11px] text-white outline-none focus:border-red-500/50 disabled:opacity-60"
                      >
                        <option value="">
                          {!newDate ? "Pick date first" : slots.length === 0 ? "No slots" : "Select time"}
                        </option>
                        {slots.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {newDate ? (
                    <p className="text-[10px] text-zinc-500">
                      {availabilityHintForDate(newDate)}
                    </p>
                  ) : null}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busy || !newDate || !newTime}
                      onClick={handleReschedule}
                      className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                    >
                      {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CalendarClock className="h-3 w-3" />}
                      Submit change
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setMode("view");
                        setActionError("");
                      }}
                      className="text-[11px] text-zinc-400 hover:text-zinc-200"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-500">
                    Your appointment will go back to "Pending" until we confirm the new time.
                  </p>
                </div>
              ) : null}

              {actionError ? (
                <p className="mt-2 flex items-start gap-1 text-[11px] text-rose-400">
                  <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                  {actionError}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function ServiceItemLine({ item }: { item: PortalServiceItem }) {
  const mid = Math.round((item.priceLow + item.priceHigh) / 2);
  const d = item.discount;
  const isActive =
    d?.active &&
    typeof d.value === "number" &&
    d.value > 0 &&
    (!d.expiry || new Date(d.expiry) > new Date());

  const discountedMid = !isActive
    ? mid
    : d!.type === "percent"
      ? Math.round(mid * (1 - (d!.value ?? 0) / 100))
      : Math.max(0, mid - (d!.value ?? 0));

  const badge = isActive
    ? d!.label ??
      (d!.type === "percent" ? `${d!.value}% OFF` : `$${d!.value} OFF`)
    : null;

  return (
    <li className="flex items-baseline justify-between gap-2 text-zinc-200">
      <div className="flex min-w-0 items-baseline gap-1.5">
        <span className="text-zinc-600">·</span>
        <span className="truncate">{item.name}</span>
        {item.isAddon ? (
          <span className="text-[10px] text-zinc-500">(add-on)</span>
        ) : null}
        {badge ? (
          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0 text-[10px] font-medium text-amber-300">
            {badge}
          </span>
        ) : null}
      </div>
      <span className="shrink-0 font-mono tabular-nums text-zinc-300">
        {isActive ? (
          <>
            <span className="mr-1 text-zinc-500 line-through">${mid}</span>
            <span className="text-white">${discountedMid}</span>
          </>
        ) : (
          <span className="text-white">${mid}</span>
        )}
      </span>
    </li>
  );
}

function DetailLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-16 shrink-0 text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div className="min-w-0 flex-1 text-zinc-200">{children}</div>
    </div>
  );
}

function ReceiptRow({ receipt }: { receipt: PortalReceipt }) {
  const href = `/receipt/${receipt.publicReceiptToken}`;
  const total = formatMoney(receipt.totalCents, receipt.currency);
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between gap-2 rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-2 transition-colors hover:border-red-500/40 hover:bg-zinc-900"
      >
        <div className="flex min-w-0 items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-white">
              {receipt.receiptNumber} · {total}
            </p>
            <p className="truncate text-[11px] text-zinc-400">
              {formatDateOnly(receipt.createdAt)} ·{" "}
              <span className="capitalize">{receipt.paymentStatus}</span>
            </p>
          </div>
        </div>
        <ExternalLink className="h-3 w-3 shrink-0 text-zinc-500" />
      </a>
    </li>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending_approval: { label: "Pending", cls: "border-amber-500/40 text-amber-300 bg-amber-500/10" },
    confirmed: { label: "Confirmed", cls: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10" },
    in_progress: { label: "In progress", cls: "border-sky-500/40 text-sky-300 bg-sky-500/10" },
    completed: { label: "Completed", cls: "border-emerald-500/30 text-emerald-300 bg-emerald-500/5" },
    canceled: { label: "Canceled", cls: "border-zinc-700 text-zinc-500 bg-zinc-900" },
    no_show: { label: "No-show", cls: "border-rose-500/40 text-rose-300 bg-rose-500/10" },
  };
  const v = map[status] ?? { label: status, cls: "border-zinc-700 text-zinc-400 bg-zinc-900" };
  return (
    <span
      className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium tabular-nums ${v.cls}`}
    >
      {v.label}
    </span>
  );
}

/* ─────────────────────────────────────────────
   Formatters
───────────────────────────────────────────── */

function vehicleStr(v?: PortalVehicle): string {
  if (!v) return "—";
  return [v.year, v.make, v.model].filter(Boolean).join(" ") || "—";
}

function formatMoney(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

const LA_TZ = "America/Los_Angeles";

function formatApptShort(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: LA_TZ,
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

function formatApptLong(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: LA_TZ,
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(d);
  } catch {
    return iso;
  }
}

function formatDateOnly(iso: string): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en-US", {
      timeZone: LA_TZ,
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(d);
  } catch {
    return iso;
  }
}

