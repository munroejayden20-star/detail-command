import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Camera,
  Phone as PhoneIcon,
  MessageSquare,
  Map as MapIcon,
  CheckCircle2,
  Clock,
  ChevronRight,
  Wallet,
  Car as CarIcon,
  PlayCircle,
  StickyNote,
  X,
  Plus,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useStore, makeId } from "@/store/store";
import { PhotoUploader } from "@/components/photos/PhotoUploader";
import {
  appointmentsOnDay,
  upcomingAppointments,
} from "@/lib/selectors";
import { cn, formatCurrency, phoneFmt, vehicleStr } from "@/lib/utils";
import type { Appointment, JobStatus, PaymentStatus } from "@/lib/types";

/**
 * Work Mode / Field View — designed for a phone mounted vertically while
 * actively detailing. Big tap targets, one-handed friendly, minimal scrolling.
 */
export function WorkPage() {
  const { data, dispatch } = useStore();
  const today = useMemo(() => new Date(), []);
  const todays = useMemo(() => appointmentsOnDay(data, today), [data, today]);
  const upcoming = useMemo(() => upcomingAppointments(data, 5), [data]);

  // Pick "current" job: in_progress > earliest unfinished today > first upcoming
  const current = useMemo<Appointment | null>(() => {
    const inProg = todays.find((a) => a.status === "in_progress");
    if (inProg) return inProg;
    const next = todays
      .filter((a) => a.status !== "completed" && a.status !== "canceled")
      .sort((a, b) => a.start.localeCompare(b.start))[0];
    if (next) return next;
    return upcoming[0] ?? null;
  }, [todays, upcoming]);

  const [noteOpen, setNoteOpen] = useState(false);

  if (!current) {
    return (
      <div className="space-y-5 px-1">
        <h1 className="text-2xl font-bold tracking-tight">Work Mode</h1>
        <Card>
          <CardContent className="space-y-3 py-12 text-center">
            <p className="text-base font-semibold">No job in progress</p>
            <p className="text-sm text-muted-foreground">
              Book an appointment to use Work Mode.
            </p>
            <Button asChild>
              <Link to="/calendar">
                <Plus className="h-4 w-4" /> Open calendar
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const customer = data.customers.find((c) => c.id === current.customerId);
  const customerName = customer?.name ?? "Customer";
  const phone = (customer?.phone ?? "").replace(/\D/g, "");

  const services = (current.serviceIds ?? [])
    .map((id) => data.services.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => !!s);

  // Photo counts for this customer/appointment
  const photos = (data.photos ?? []).filter(
    (p) => p.appointmentId === current.id || p.customerId === current.customerId
  );
  const beforeCount = photos.filter((p) => p.type === "before").length;
  const afterCount = photos.filter((p) => p.type === "after").length;

  function setStatus(status: JobStatus) {
    if (!current) return;
    dispatch({
      type: "updateAppointment",
      id: current.id,
      patch: { status },
    });
    toast.success(
      status === "in_progress"
        ? "Job started"
        : status === "completed"
        ? "Job completed"
        : `Status: ${status}`
    );
  }

  function setPayment(p: PaymentStatus) {
    if (!current) return;
    dispatch({
      type: "updateAppointment",
      id: current.id,
      patch: { paymentStatus: p },
    });
    toast.success(
      p === "paid" ? "Marked paid" : p === "deposit" ? "Deposit marked" : "Marked unpaid"
    );
  }

  function openMaps() {
    if (!current?.address) {
      toast.error("No address on file");
      return;
    }
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        current.address
      )}`,
      "_blank",
      "noopener,noreferrer"
    );
  }

  return (
    <div className="space-y-4 px-1">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
            Work Mode
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            {customerName}
          </h1>
        </div>
        <StatusPill status={current.status} />
      </div>

      {/* Hero card */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">
              {format(parseISO(current.start), "EEE, MMM d · p")}
            </span>
          </div>
          {current.address ? (
            <button
              type="button"
              onClick={openMaps}
              className="flex w-full items-center gap-2 rounded-lg border bg-muted/30 p-3 text-left text-sm hover:border-primary/40"
            >
              <MapIcon className="h-4 w-4 shrink-0 text-primary" />
              <span className="flex-1 truncate">{current.address}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ) : null}
          {current.vehicle?.make ? (
            <div className="flex items-center gap-2 rounded-lg bg-muted/30 p-3 text-sm">
              <CarIcon className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{vehicleStr(current.vehicle)}</span>
            </div>
          ) : null}
          {services.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {services.map((s) => (
                <Badge key={s.id} variant="soft" className="text-[11px]">
                  {s.name}
                </Badge>
              ))}
              <Badge variant="outline" className="text-[11px]">
                Est. {formatCurrency(current.estimatedPrice)}
              </Badge>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Big primary action: start / complete */}
      {current.status !== "completed" ? (
        <div className="grid gap-2">
          {current.status !== "in_progress" ? (
            <BigButton
              onClick={() => setStatus("in_progress")}
              icon={<PlayCircle className="h-6 w-6" />}
              label="Start job"
              tone="primary"
            />
          ) : (
            <BigButton
              onClick={() => setStatus("completed")}
              icon={<CheckCircle2 className="h-6 w-6" />}
              label="Mark complete"
              tone="emerald"
            />
          )}
        </div>
      ) : (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm font-medium text-emerald-700 dark:text-emerald-200">
          ✓ This job is complete.
        </div>
      )}

      {/* Photo capture row */}
      <div className="grid grid-cols-2 gap-2">
        <PhotoUploader
          variant="dropzone"
          defaultType="before"
          customerId={current.customerId}
          appointmentId={current.id}
          vehicle={current.vehicle?.make ? vehicleStr(current.vehicle) : undefined}
          label={`Before · ${beforeCount}`}
          className="!p-4"
        />
        <PhotoUploader
          variant="dropzone"
          defaultType="after"
          customerId={current.customerId}
          appointmentId={current.id}
          vehicle={current.vehicle?.make ? vehicleStr(current.vehicle) : undefined}
          label={`After · ${afterCount}`}
          className="!p-4"
        />
      </div>

      {/* Contact + note row */}
      <div className="grid grid-cols-2 gap-2">
        <BigButton
          icon={<MessageSquare className="h-5 w-5" />}
          label="Text"
          tone="default"
          onClick={() => {
            if (!phone) {
              toast.error("No phone on file");
              return;
            }
            window.location.href = `sms:${phone}`;
          }}
          subtle={phone ? phoneFmt(phone) : undefined}
        />
        <BigButton
          icon={<PhoneIcon className="h-5 w-5" />}
          label="Call"
          tone="default"
          onClick={() => {
            if (!phone) {
              toast.error("No phone on file");
              return;
            }
            window.location.href = `tel:${phone}`;
          }}
        />
      </div>

      {/* Note + Payment + map quick row */}
      <div className="grid grid-cols-2 gap-2">
        <BigButton
          icon={<StickyNote className="h-5 w-5" />}
          label="Add note"
          tone="default"
          onClick={() => setNoteOpen(true)}
        />
        <BigButton
          icon={<Wallet className="h-5 w-5" />}
          label={
            current.paymentStatus === "paid"
              ? "Paid ✓"
              : current.paymentStatus === "deposit"
              ? "Deposit"
              : "Mark paid"
          }
          tone={current.paymentStatus === "paid" ? "emerald" : "default"}
          onClick={() => {
            const next: PaymentStatus =
              current.paymentStatus === "paid"
                ? "unpaid"
                : current.paymentStatus === "deposit"
                ? "paid"
                : "paid";
            setPayment(next);
          }}
        />
      </div>

      {/* Quick checklist mirror */}
      <ChecklistsForJob appointmentId={current.id} customerId={current.customerId} />

      {/* Up-next */}
      {upcoming.length > 1 ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Up next
            </p>
            {upcoming
              .filter((u) => u.id !== current.id)
              .slice(0, 2)
              .map((u) => {
                const c = data.customers.find((c) => c.id === u.customerId);
                return (
                  <Link
                    key={u.id}
                    to="/calendar"
                    className="flex items-center justify-between rounded-lg border bg-muted/30 p-2.5 hover:border-primary/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {c?.name ?? "Customer"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {format(parseISO(u.start), "EEE p")}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                );
              })}
          </CardContent>
        </Card>
      ) : null}

      <NoteDialog
        open={noteOpen}
        onOpenChange={setNoteOpen}
        appointment={current}
      />
    </div>
  );
}

function StatusPill({ status }: { status: JobStatus }) {
  const tone =
    status === "completed"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
      : status === "in_progress"
      ? "bg-primary/10 text-primary"
      : status === "confirmed"
      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200"
      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200";
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-semibold capitalize",
        tone
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function BigButton({
  icon,
  label,
  subtle,
  tone = "default",
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  subtle?: string;
  tone?: "primary" | "emerald" | "default";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[64px] w-full items-center justify-center gap-3 rounded-xl border-2 px-4 py-3 text-base font-semibold shadow-soft transition-all active:scale-[0.98]",
        tone === "primary" &&
          "border-primary bg-primary text-primary-foreground hover:opacity-90",
        tone === "emerald" &&
          "border-emerald-500 bg-emerald-500 text-white hover:opacity-90",
        tone === "default" &&
          "border-border bg-card hover:border-primary/40 hover:bg-accent"
      )}
    >
      {icon}
      <span className="text-left">
        <span className="block leading-tight">{label}</span>
        {subtle ? (
          <span className="block text-[11px] font-normal opacity-70">
            {subtle}
          </span>
        ) : null}
      </span>
    </button>
  );
}

function ChecklistsForJob({
  appointmentId,
  customerId,
}: {
  appointmentId: string;
  customerId: string;
}) {
  const { data, dispatch } = useStore();
  const lists = data.checklists.filter(
    (c) => c.appointmentId === appointmentId || c.customerId === customerId
  );
  if (lists.length === 0) return null;
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Checklists
        </p>
        {lists.map((list) => {
          const done = list.items.filter((i) => i.done).length;
          const total = list.items.length;
          const pct = total ? Math.round((done / total) * 100) : 0;
          return (
            <div key={list.id} className="rounded-lg border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">{list.name}</p>
                <span className="text-[11px] text-muted-foreground">
                  {done}/{total}
                </span>
              </div>
              <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full",
                    pct === 100 ? "bg-emerald-500" : "bg-primary"
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <ul className="space-y-1">
                {list.items.slice(0, 6).map((it) => (
                  <li key={it.id}>
                    <button
                      type="button"
                      onClick={() =>
                        dispatch({
                          type: "toggleChecklistItem",
                          groupId: list.id,
                          itemId: it.id,
                        })
                      }
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-accent",
                        it.done && "text-muted-foreground line-through"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                          it.done
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-border"
                        )}
                      >
                        {it.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                      </span>
                      <span className="flex-1 text-left">{it.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {list.items.length > 6 ? (
                <Link
                  to="/checklists"
                  className="mt-2 inline-block text-[11px] text-primary hover:underline"
                >
                  +{list.items.length - 6} more →
                </Link>
              ) : null}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function NoteDialog({
  open,
  onOpenChange,
  appointment,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  appointment: Appointment;
}) {
  const { dispatch } = useStore();
  const [text, setText] = useState("");

  function append() {
    if (!text.trim()) {
      onOpenChange(false);
      return;
    }
    const stamp = format(new Date(), "MMM d · p");
    const next =
      (appointment.internalNotes ?? "") +
      (appointment.internalNotes ? "\n\n" : "") +
      `[${stamp}] ${text.trim()}`;
    dispatch({
      type: "updateAppointment",
      id: appointment.id,
      patch: { internalNotes: next },
    });
    toast.success("Note saved");
    setText("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Quick note</span>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded p-1 text-muted-foreground hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </DialogTitle>
        </DialogHeader>
        <Textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Stains, condition, weird smells, requests…"
          autoFocus
        />
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={append}>
            Save note
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Small helper kept in scope so makeId is referenced (suppresses unused warn)
void makeId;
