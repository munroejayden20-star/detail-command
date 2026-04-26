import { format, parseISO } from "date-fns";
import { Clock, MapPin, Droplets, Plug, AlertTriangle } from "lucide-react";
import { useState } from "react";
import type { Appointment } from "@/lib/types";
import { useStore } from "@/store/store";
import { StatusPill } from "@/components/ui/status-pill";
import { cn, formatCurrency, vehicleStr } from "@/lib/utils";
import { AppointmentDialog } from "./AppointmentDialog";

interface AppointmentRowProps {
  appointment: Appointment;
  compact?: boolean;
  className?: string;
}

export function AppointmentRow({ appointment, compact, className }: AppointmentRowProps) {
  const { data } = useStore();
  const customer = data.customers.find((c) => c.id === appointment.customerId);
  const [open, setOpen] = useState(false);

  const start = parseISO(appointment.start);
  const end = parseISO(appointment.end);
  const services = appointment.serviceIds
    .map((id) => data.services.find((s) => s.id === id)?.name)
    .filter(Boolean)
    .join(" · ");
  const accessIssue = !appointment.waterAccess || !appointment.powerAccess;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "group relative flex w-full items-stretch gap-3 rounded-xl border bg-card p-3 text-left transition-all hover:shadow-soft hover:border-primary/30 ring-focus",
          className
        )}
      >
        <div
          className={cn(
            "w-1 shrink-0 rounded-full",
            `status-bar-${appointment.status.replace("_", "-")}`
          )}
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {customer?.name ?? "—"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {vehicleStr(appointment.vehicle) || "Vehicle TBD"}
              </p>
            </div>
            <StatusPill status={appointment.status} size="sm" />
          </div>

          {!compact && (
            <p className="truncate text-xs text-muted-foreground">
              {services || "No services"}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {format(start, "EEE p")} – {format(end, "p")}
            </span>
            {!compact && appointment.address ? (
              <span className="inline-flex items-center gap-1 truncate max-w-[160px]">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{appointment.address}</span>
              </span>
            ) : null}
            <span className="ml-auto font-semibold text-foreground">
              {formatCurrency(appointment.finalPrice ?? appointment.estimatedPrice)}
            </span>
          </div>

          {!compact ? (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {appointment.waterAccess ? (
                <Tag tone="positive" icon={<Droplets className="h-3 w-3" />} label="Water" />
              ) : (
                <Tag tone="warn" icon={<Droplets className="h-3 w-3" />} label="No water" />
              )}
              {appointment.powerAccess ? (
                <Tag tone="positive" icon={<Plug className="h-3 w-3" />} label="Power" />
              ) : (
                <Tag tone="warn" icon={<Plug className="h-3 w-3" />} label="No power" />
              )}
              {appointment.petHair && <Tag label="Pet hair" />}
              {appointment.stains && <Tag label="Stains" />}
              {appointment.heavyDirt && <Tag label="Heavy dirt" />}
              {accessIssue && (
                <Tag tone="warn" icon={<AlertTriangle className="h-3 w-3" />} label="Confirm site" />
              )}
            </div>
          ) : null}
        </div>
      </button>
      <AppointmentDialog open={open} onOpenChange={setOpen} appointment={appointment} />
    </>
  );
}

function Tag({
  label,
  icon,
  tone,
}: {
  label: string;
  icon?: React.ReactNode;
  tone?: "positive" | "warn";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        tone === "positive" &&
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200",
        tone === "warn" &&
          "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
        !tone && "bg-muted text-muted-foreground"
      )}
    >
      {icon}
      {label}
    </span>
  );
}
