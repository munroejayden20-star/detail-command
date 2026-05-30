/* ============================================================================
 * BookingRequests — pending online booking requests panel.
 *
 * Retreats the prior shadcn/yellow-light card into the dashboard's dark
 * cinematic language (LuxCard with signal tone, ember accents, mono
 * kickers, platinum text). Sort is newest-first so a fresh booking always
 * lands at the top of the list — and the whole panel is mounted at the
 * top of the dashboard so the owner sees it before anything else.
 *
 * Functional contract is identical to the prior version: same props, same
 * approve/decline RPCs, same Reach Out hand-off — only the chrome changed.
 * ========================================================================== */

import { useState } from "react";
import { formatBusinessDateTime } from "@/lib/datetime";
import {
  CheckCircle2,
  XCircle,
  CalendarDays,
  MessageSquare,
  Clock,
  Droplets,
  Zap,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/store/store";
import { cn, vehicleStr, formatCurrency } from "@/lib/utils";
import {
  LuxCard,
  LuxCardBody,
  LuxCardHeader,
} from "@/components/dashboard/lux/primitives";
import type { Appointment, Customer } from "@/lib/types";

/* ─── Inner request card ─────────────────────────────────────────────────── */

interface BookingRequestCardProps {
  appt: Appointment;
  customer: Customer | undefined;
  onApprove: () => void;
  onDecline: () => void;
  onReachOut: () => void;
}

function BookingRequestCard({
  appt,
  customer,
  onApprove,
  onDecline,
  onReachOut,
}: BookingRequestCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { data } = useStore();

  const services = data.services.filter((s) => appt.serviceIds.includes(s.id));
  const addons = data.services.filter((s) => appt.addonIds.includes(s.id));
  const vehicleLabel = vehicleStr(appt.vehicle);
  const photoUrls: string[] = appt.bookingPhotoUrls ?? [];

  const depositAmount =
    appt.depositAmountCents != null ? appt.depositAmountCents / 100 : 0;
  const depositPaid =
    appt.depositPaid ||
    !!appt.depositPaidAt ||
    appt.paymentStatus === "deposit_paid" ||
    appt.paymentStatus === "deposit" ||
    appt.paymentStatus === "paid";
  const showDepositPaid = depositPaid && depositAmount > 0;
  const balanceDue = Math.max(0, (appt.estimatedPrice ?? 0) - depositAmount);

  return (
    <div
      className="relative overflow-hidden border border-ember-500/22 bg-obsidian-900/60"
      style={{ borderRadius: 4 }}
    >
      {/* Top hairline picking up "light from above" */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,200,170,0.4) 50%, transparent 100%)",
        }}
      />

      {/* Header row */}
      <div className="space-y-3 px-5 py-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-sans text-[14px] font-light text-platinum-50">
                {customer?.name ?? "Unknown"}
              </p>
              <Pill tone="ember">Pending</Pill>
              {appt.source === "Public Booking Page" && (
                <Pill tone="neutral">Online</Pill>
              )}
              {showDepositPaid && (
                <Pill tone="emerald">
                  <DollarSign className="h-2.5 w-2.5" />
                  Deposit {formatCurrency(depositAmount)}
                </Pill>
              )}
            </div>
            {customer?.phone && (
              <p className="mt-1 font-mono text-[11px] text-platinum-300/65">
                {customer.phone}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 rounded-full border border-white/10 bg-white/[0.02] p-1.5 transition-colors hover:border-white/25 hover:bg-white/[0.05]"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? (
              <ChevronUp className="h-3 w-3 text-platinum-200" />
            ) : (
              <ChevronDown className="h-3 w-3 text-platinum-200" />
            )}
          </button>
        </div>

        {/* Key info row — when / what / size */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-platinum-300/75">
          {appt.start && (
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-3 w-3 shrink-0 text-ember-300" />
              {formatBusinessDateTime(appt.start)}
            </span>
          )}
          {vehicleLabel && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-3 w-3 shrink-0 text-ember-300" />
              {vehicleLabel}
            </span>
          )}
          {appt.vehicle.size && (
            <span className="capitalize">
              {appt.vehicle.size.replace("_", " ")}
            </span>
          )}
        </div>

        {/* Service + price */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-light text-platinum-100">
              {services.map((s) => s.name).join(", ") || "No service selected"}
            </p>
            {addons.length > 0 && (
              <p className="truncate text-[11.5px] text-platinum-300/65">
                + {addons.map((a) => a.name).join(", ")}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="font-sans text-[16px] font-light text-platinum-50">
              {formatCurrency(appt.estimatedPrice)}
            </p>
            {showDepositPaid && (
              <div className="mt-0.5 font-mono text-[10px] leading-tight">
                <p className="text-emerald-300/85">
                  −{formatCurrency(depositAmount)}
                </p>
                <p className="text-platinum-100">Bal {formatCurrency(balanceDue)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Utility access */}
        <div className="flex flex-wrap gap-4 font-mono text-[10.5px] uppercase tracking-[0.18em]">
          <span
            className={cn(
              "flex items-center gap-1.5",
              appt.waterAccess ? "text-emerald-300/85" : "text-rose-300/85",
            )}
          >
            <Droplets className="h-3 w-3" />
            {appt.waterAccess ? "Water ✓" : "No water"}
          </span>
          <span
            className={cn(
              "flex items-center gap-1.5",
              appt.powerAccess ? "text-emerald-300/85" : "text-rose-300/85",
            )}
          >
            <Zap className="h-3 w-3" />
            {appt.powerAccess ? "Power ✓" : "No power"}
          </span>
          {photoUrls.length > 0 && (
            <span className="flex items-center gap-1.5 text-platinum-300/75">
              <ImageIcon className="h-3 w-3 text-ember-300" />
              {photoUrls.length} photo{photoUrls.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="space-y-3 border-t border-white/8 bg-obsidian-950/40 px-5 py-4">
          {appt.customerNotes && (
            <div>
              <p className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.28em] text-ember-300">
                Notes
              </p>
              <p className="text-[13px] text-platinum-100">{appt.customerNotes}</p>
            </div>
          )}
          {(appt.interiorCondition || appt.exteriorCondition) && (
            <div className="flex flex-wrap gap-6 font-mono text-[11px] text-platinum-300/70">
              {appt.interiorCondition && (
                <span>
                  Interior ·{" "}
                  <span className="capitalize text-platinum-100">
                    {appt.interiorCondition}
                  </span>
                </span>
              )}
              {appt.exteriorCondition && (
                <span>
                  Exterior ·{" "}
                  <span className="capitalize text-platinum-100">
                    {appt.exteriorCondition}
                  </span>
                </span>
              )}
            </div>
          )}
          {(appt.petHair || appt.stains || appt.heavyDirt) && (
            <div className="flex flex-wrap gap-2">
              {appt.petHair && <Pill tone="neutral">Pet hair</Pill>}
              {appt.stains && <Pill tone="neutral">Stains</Pill>}
              {appt.heavyDirt && <Pill tone="neutral">Heavy dirt</Pill>}
            </div>
          )}
          {appt.address && (
            <p className="font-mono text-[11px] text-platinum-300/70">
              <span className="text-ember-300">Location · </span>
              <span className="text-platinum-100">{appt.address}</span>
            </p>
          )}
          {photoUrls.length > 0 && (
            <div>
              <p className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.28em] text-ember-300">
                Customer photos
              </p>
              <div className="grid grid-cols-2 gap-2">
                {photoUrls.map((url, i) => (
                  <a
                    key={i}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block aspect-video overflow-hidden border border-white/8 transition-colors hover:border-white/25"
                    style={{ borderRadius: 2 }}
                  >
                    <img
                      src={url}
                      alt={`Vehicle photo ${i + 1}`}
                      className="h-full w-full object-cover"
                    />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 border-t border-white/8 px-5 py-3">
        <button
          type="button"
          onClick={onApprove}
          className="group/btn relative inline-flex items-center gap-1.5 overflow-hidden rounded-full border border-ember-500/35 bg-gradient-to-b from-ember-500/14 via-ember-500/10 to-ember-500/16 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-platinum-50 transition-all duration-200 hover:border-ember-400/55 hover:from-ember-500/22"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.10) 0%, transparent 100%)",
            }}
          />
          <CheckCircle2 className="h-3 w-3 text-ember-200" />
          Approve
        </button>
        <button
          type="button"
          onClick={onDecline}
          className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/35 bg-rose-500/5 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-rose-200 transition-colors hover:border-rose-400/55 hover:bg-rose-500/10"
        >
          <XCircle className="h-3 w-3" />
          Decline
        </button>
        <button
          type="button"
          onClick={onReachOut}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-platinum-100 transition-colors hover:border-white/25 hover:bg-white/[0.06]"
        >
          <MessageSquare className="h-3 w-3" />
          Reach out
        </button>
      </div>
    </div>
  );
}

/* ─── Tiny pill helper — three tonal variants matching the lux palette ──── */

function Pill({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "ember" | "neutral" | "emerald";
}) {
  const toneCls =
    tone === "ember"
      ? "border-ember-500/35 bg-ember-500/8 text-ember-200"
      : tone === "emerald"
      ? "border-emerald-500/35 bg-emerald-500/8 text-emerald-200"
      : "border-white/12 bg-white/[0.03] text-platinum-200";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.22em]",
        toneCls,
      )}
      style={{ borderRadius: 2 }}
    >
      {children}
    </span>
  );
}

/* ─── Container ──────────────────────────────────────────────────────────── */

interface BookingRequestsProps {
  onReachOut: (
    contact: { name: string; phone: string; email?: string },
    appointment: Appointment,
  ) => void;
}

export function BookingRequests({ onReachOut }: BookingRequestsProps) {
  const { data, commit } = useStore();

  // Newest first — a fresh booking always lands at the top of the list.
  const pending = data.appointments
    .filter((a) => a.status === "pending_approval")
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  if (pending.length === 0) return null;

  async function approve(appt: Appointment) {
    const r = await commit({
      type: "updateAppointment",
      id: appt.id,
      patch: { status: "confirmed" },
    });
    if (r.ok) toast.success("Booking approved — added to the schedule.");
  }

  async function decline(appt: Appointment) {
    const r = await commit({
      type: "updateAppointment",
      id: appt.id,
      patch: { status: "canceled" },
    });
    if (r.ok) toast.success("Booking declined.");
  }

  return (
    <LuxCard tone="signal">
      <LuxCardHeader
        kicker="New requests"
        title="Pending booking requests"
        description="Online requests waiting for your approval. Approve to add them to the calendar."
        action={
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ember-300">
            {pending.length} pending
          </span>
        }
      />
      <LuxCardBody className="space-y-3">
        {pending.map((appt) => {
          const customer = data.customers.find((c) => c.id === appt.customerId);
          return (
            <BookingRequestCard
              key={appt.id}
              appt={appt}
              customer={customer}
              onApprove={() => approve(appt)}
              onDecline={() => decline(appt)}
              onReachOut={() => {
                if (!customer) return;
                onReachOut(
                  {
                    name: customer.name,
                    phone: customer.phone,
                    email: customer.email,
                  },
                  appt,
                );
              }}
            />
          );
        })}
      </LuxCardBody>
    </LuxCard>
  );
}
