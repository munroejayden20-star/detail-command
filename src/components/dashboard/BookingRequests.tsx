import { useState } from "react";
import { format, parseISO } from "date-fns";
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
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/store/store";
import { cn, vehicleStr, formatCurrency } from "@/lib/utils";
import type { Appointment, Customer } from "@/lib/types";

interface BookingRequestCardProps {
  appt: Appointment;
  customer: Customer | undefined;
  onApprove: () => void;
  onDecline: () => void;
  onReachOut: () => void;
}

function BookingRequestCard({ appt, customer, onApprove, onDecline, onReachOut }: BookingRequestCardProps) {
  const [expanded, setExpanded] = useState(false);
  const { data } = useStore();

  const services = data.services.filter((s) => appt.serviceIds.includes(s.id));
  const addons = data.services.filter((s) => appt.addonIds.includes(s.id));
  const vehicleLabel = vehicleStr(appt.vehicle);

  const photoUrls: string[] = appt.bookingPhotoUrls ?? [];

  return (
    <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 overflow-hidden">
      {/* Header row */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm truncate">{customer?.name ?? "Unknown"}</p>
              <Badge className="status-pending-approval text-[10px] h-4 px-1.5 shrink-0">Pending</Badge>
              {appt.source === "Public Booking Page" && (
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0 border-blue-500/40 text-blue-400">
                  Online
                </Badge>
              )}
            </div>
            {customer?.phone && (
              <p className="text-xs text-muted-foreground mt-0.5">{customer.phone}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 rounded-md p-1 hover:bg-accent transition-colors"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
        </div>

        {/* Key info row */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {appt.start && (
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3 shrink-0" />
              {format(parseISO(appt.start), "EEE, MMM d 'at' h:mm a")}
            </span>
          )}
          {vehicleLabel && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3 shrink-0" />
              {vehicleLabel}
            </span>
          )}
          {appt.vehicle.size && (
            <span className="capitalize text-muted-foreground">{appt.vehicle.size.replace("_", " ")}</span>
          )}
        </div>

        {/* Service + price */}
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {services.map((s) => s.name).join(", ") || "No service selected"}
            </p>
            {addons.length > 0 && (
              <p className="text-xs text-muted-foreground truncate">+ {addons.map((a) => a.name).join(", ")}</p>
            )}
          </div>
          <p className="text-sm font-bold shrink-0 ml-2">{formatCurrency(appt.estimatedPrice)}</p>
        </div>

        {/* Utility access */}
        <div className="flex gap-3 text-xs">
          <span className={cn("flex items-center gap-1", appt.waterAccess ? "text-emerald-600" : "text-rose-500")}>
            <Droplets className="h-3 w-3" />
            {appt.waterAccess ? "Water ✓" : "No water"}
          </span>
          <span className={cn("flex items-center gap-1", appt.powerAccess ? "text-emerald-600" : "text-rose-500")}>
            <Zap className="h-3 w-3" />
            {appt.powerAccess ? "Power ✓" : "No power"}
          </span>
          {photoUrls.length > 0 && (
            <span className="flex items-center gap-1 text-blue-500">
              <ImageIcon className="h-3 w-3" />
              {photoUrls.length} photo{photoUrls.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-yellow-500/20 px-4 py-3 space-y-3 bg-background/50">
          {appt.customerNotes && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
              <p className="text-sm text-foreground">{appt.customerNotes}</p>
            </div>
          )}
          {(appt.interiorCondition || appt.exteriorCondition) && (
            <div className="flex gap-6 text-xs text-muted-foreground">
              {appt.interiorCondition && <span>Interior: <span className="capitalize text-foreground">{appt.interiorCondition}</span></span>}
              {appt.exteriorCondition && <span>Exterior: <span className="capitalize text-foreground">{appt.exteriorCondition}</span></span>}
            </div>
          )}
          {(appt.petHair || appt.stains || appt.heavyDirt) && (
            <div className="flex gap-2 flex-wrap">
              {appt.petHair && <Badge variant="outline" className="text-[10px]">Pet hair</Badge>}
              {appt.stains && <Badge variant="outline" className="text-[10px]">Stains</Badge>}
              {appt.heavyDirt && <Badge variant="outline" className="text-[10px]">Heavy dirt</Badge>}
            </div>
          )}
          {appt.address && (
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Location:</span> {appt.address}
            </p>
          )}
          {photoUrls.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Customer photos</p>
              <div className="grid grid-cols-2 gap-2">
                {photoUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-video rounded-lg overflow-hidden border border-border hover:opacity-80 transition-opacity">
                    <img src={url} alt={`Vehicle photo ${i + 1}`} className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="border-t border-yellow-500/20 px-4 py-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
          onClick={onApprove}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-rose-500/40 text-rose-500 hover:bg-rose-500/10 gap-1.5"
          onClick={onDecline}
        >
          <XCircle className="h-3.5 w-3.5" />
          Decline
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={onReachOut}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Reach Out
        </Button>
      </div>
    </div>
  );
}

interface BookingRequestsProps {
  onReachOut: (contact: { name: string; phone: string; email?: string }) => void;
}

export function BookingRequests({ onReachOut }: BookingRequestsProps) {
  const { data, dispatch } = useStore();

  const pending = data.appointments
    .filter((a) => a.status === "pending_approval")
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  if (pending.length === 0) return null;

  function approve(appt: Appointment) {
    dispatch({ type: "updateAppointment", id: appt.id, patch: { status: "confirmed" } });
    toast.success("Booking approved — status set to Confirmed.");
  }

  function decline(appt: Appointment) {
    dispatch({ type: "updateAppointment", id: appt.id, patch: { status: "canceled" } });
    toast.success("Booking declined — status set to Canceled.");
  }

  return (
    <Card className="border-yellow-500/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-yellow-500" />
            Booking Requests
          </CardTitle>
          <Badge className="status-pending-approval">
            {pending.length} pending
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Online requests waiting for your approval. Approve to add them to the calendar.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
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
                onReachOut({ name: customer.name, phone: customer.phone, email: customer.email });
              }}
            />
          );
        })}
      </CardContent>
    </Card>
  );
}
