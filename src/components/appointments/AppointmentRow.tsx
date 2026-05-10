import { Clock, MapPin, Droplets, Plug, AlertTriangle, Timer } from "lucide-react";
import { formatBusinessDate, getAppointmentDisplayRange } from "@/lib/datetime";
import { useState } from "react";
import type { Appointment } from "@/lib/types";
import { useStore } from "@/store/store";
import { StatusPill } from "@/components/ui/status-pill";
import { cn, formatCurrency, vehicleStr } from "@/lib/utils";
import { jobDurationMinutes, formatDurationMinutes } from "@/lib/selectors";
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

  const services = appointment.serviceIds
    .map((id) => data.services.find((s) => s.id === id)?.name)
    .filter(Boolean)
    .join(" · ");
  const accessIssue = !appointment.waterAccess || !appointment.powerAccess;
  const actualDurationMin = jobDurationMinutes(appointment);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "group relative flex w-full items-stretch gap-3 overflow-hidden rounded-md border border-border/80 bg-card p-3 text-left",
          "transition-[border-color,background-color,box-shadow] duration-fast",
          "hover:border-primary/30 hover:bg-hover hover:shadow-soft",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          className
        )}
      >
        <div
          className={cn(
            "w-[3px] shrink-0 rounded-full",
            `status-bar-${appointment.status.replace("_", "-")}`
          )}
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold leading-tight">
                {customer?.name ?? "—"}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
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
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock className="h-3 w-3" />
              {formatBusinessDate(appointment.start)} ·{" "}
              {getAppointmentDisplayRange(appointment.start, appointment.end)}
            </span>
            {!compact && appointment.address ? (
              <span className="inline-flex items-center gap-1 truncate max-w-[160px]">
                <MapPin className="h-3 w-3" />
                <span className="truncate">{appointment.address}</span>
              </span>
            ) : null}
            <span className="ml-auto font-semibold text-foreground tabular-nums">
              {formatCurrency(appointment.finalPrice ?? appointment.estimatedPrice)}
            </span>
          </div>

          {!compact ? (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {actualDurationMin != null ? (
                <Tag
                  tone="positive"
                  icon={<Timer className="h-3 w-3" />}
                  label={`${formatDurationMinutes(actualDurationMin)} on job`}
                />
              ) : null}
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
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        tone === "positive" &&
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        tone === "warn" &&
          "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
        !tone && "border-border/80 bg-muted/60 text-muted-foreground"
      )}
    >
      {icon}
      {label}
    </span>
  );
}
