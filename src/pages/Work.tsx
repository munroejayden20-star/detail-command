import { useEffect, useMemo, useState } from "react";
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
  ListChecks,
  X,
  Plus,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { formatBusinessDate, formatBusinessDateTime, formatBusinessTime } from "@/lib/datetime";
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
import { WorkChecklistDialog } from "@/components/work/WorkChecklistDialog";
import {
  appointmentsOnDay,
  upcomingAppointments,
  jobDurationMinutes,
  formatDurationMinutes,
} from "@/lib/selectors";
import { Timer, RotateCcw } from "lucide-react";
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
  const [checklistOpen, setChecklistOpen] = useState(false);

  if (!current) {
    return (
      <div className="space-y-5 px-1">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Work Mode
          </p>
          <h1 className="mt-1 text-2xl font-semibold leading-tight tracking-tight">
            Field tool
          </h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-md border border-border/70 bg-muted/40 text-muted-foreground">
              <ListChecks className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold">No job in progress</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                Book an appointment to use Work Mode — big buttons, photo capture, and one-tap status updates.
              </p>
            </div>
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
    const patch: Partial<Appointment> = { status };
    const now = new Date().toISOString();
    // Stamp the timer on the matching transitions. Don't overwrite an
    // existing actualStartAt — preserves the original start time if the
    // detailer toggles statuses around mid-job.
    if (status === "in_progress" && !current.actualStartAt) {
      patch.actualStartAt = now;
    }
    if (status === "completed" && current.actualStartAt && !current.actualEndAt) {
      patch.actualEndAt = now;
    }
    dispatch({
      type: "updateAppointment",
      id: current.id,
      patch,
    });
    toast.success(
      status === "in_progress"
        ? "Job started — timer running"
        : status === "completed"
        ? "Job completed"
        : `Status: ${status}`
    );
  }

  function resetTimer() {
    if (!current) return;
    if (!window.confirm("Reset the timer for this job? The start/end times will be cleared.")) return;
    dispatch({
      type: "updateAppointment",
      id: current.id,
      patch: { actualStartAt: undefined, actualEndAt: undefined },
    });
    toast.success("Timer reset");
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
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Work Mode
          </p>
          <h1 className="mt-1 truncate text-2xl font-semibold leading-tight tracking-tight">
            {customerName}
          </h1>
        </div>
        <StatusPill status={current.status} />
      </div>

      {/* Hero card */}
      <Card>
        <CardContent className="space-y-2.5 p-4">
          <div className="flex items-center gap-2 text-sm tabular-nums">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">
              {formatBusinessDateTime(current.start)}
            </span>
          </div>
          {current.address ? (
            <button
              type="button"
              onClick={openMaps}
              className={cn(
                "flex w-full items-center gap-2 rounded-md border border-border/80 bg-muted/30 p-3 text-left text-sm",
                "transition-colors duration-fast hover:border-primary/30 hover:bg-hover"
              )}
            >
              <MapIcon className="h-4 w-4 shrink-0 text-primary" />
              <span className="flex-1 truncate">{current.address}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          ) : null}
          {current.vehicle?.make ? (
            <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 p-3 text-sm">
              <CarIcon className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{vehicleStr(current.vehicle)}</span>
            </div>
          ) : null}
          {services.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {services.map((s) => (
                <Badge key={s.id} variant="soft">
                  {s.name}
                </Badge>
              ))}
              <Badge variant="outline">
                Est. {formatCurrency(current.estimatedPrice)}
              </Badge>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Job timer — visible whenever a start time has been recorded */}
      {current.actualStartAt ? (
        <JobTimer
          startAt={current.actualStartAt}
          endAt={current.actualEndAt}
          onReset={resetTimer}
        />
      ) : null}

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
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          This job is complete.
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

      {/* Note + Checklists row */}
      <div className="grid grid-cols-2 gap-2">
        <BigButton
          icon={<StickyNote className="h-5 w-5" />}
          label="Add note"
          tone="default"
          onClick={() => setNoteOpen(true)}
        />
        <BigButton
          icon={<ListChecks className="h-5 w-5" />}
          label="Checklists"
          subtle={(() => {
            const linked = data.checklists.filter(
              (c) =>
                c.appointmentId === current.id ||
                c.customerId === current.customerId
            );
            if (linked.length === 0)
              return `${data.checklists.length} available`;
            const total = linked.reduce((s, l) => s + l.items.length, 0);
            const done = linked.reduce(
              (s, l) => s + l.items.filter((i) => i.done).length,
              0
            );
            return `${done}/${total} on this job`;
          })()}
          tone="default"
          onClick={() => setChecklistOpen(true)}
        />
      </div>

      {/* Payment quick row */}
      <div>
        <BigButton
          icon={<Wallet className="h-5 w-5" />}
          label={
            current.paymentStatus === "paid"
              ? "Paid ✓"
              : current.paymentStatus === "deposit"
              ? "Deposit · tap to mark paid"
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
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
                    className={cn(
                      "flex items-center justify-between rounded-md border border-border/80 bg-muted/30 p-2.5",
                      "transition-colors duration-fast hover:border-border hover:bg-hover"
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold leading-tight">
                        {c?.name ?? "Customer"}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
                        {formatBusinessDate(u.start)} · {formatBusinessTime(u.start)}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
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
      <WorkChecklistDialog
        open={checklistOpen}
        onOpenChange={setChecklistOpen}
        appointmentId={current.id}
        customerId={current.customerId}
      />
    </div>
  );
}

function JobTimer({
  startAt,
  endAt,
  onReset,
}: {
  startAt: string;
  endAt?: string;
  onReset: () => void;
}) {
  const startMs = parseISO(startAt).getTime();
  const endMs = endAt ? parseISO(endAt).getTime() : null;
  const running = !endMs;

  // Tick once a second while running so the elapsed display advances live.
  // When the job is finished, render the final duration without a ticker.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  const elapsedMs = (endMs ?? now) - startMs;
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const display = h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border p-4",
        running
          ? "border-primary/30 bg-primary/5"
          : "border-border/80 bg-card"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
              running ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
            )}
          >
            <Timer className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              {running ? "Job timer" : "Total time"}
            </p>
            <p className="text-2xl font-semibold leading-tight tracking-tight tabular-nums">
              {display}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {running ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              Running
            </span>
          ) : null}
          <button
            type="button"
            onClick={onReset}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-hover hover:text-foreground"
            aria-label="Reset timer"
            title="Reset timer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground tabular-nums">
        Started {format(parseISO(startAt), "MMM d · h:mm a")}
        {endAt ? ` · Ended ${format(parseISO(endAt), "h:mm a")}` : ""}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: JobStatus }) {
  const tone =
    status === "completed"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : status === "in_progress"
      ? "border-primary/20 bg-primary/10 text-primary"
      : status === "confirmed"
      ? "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-300"
      : "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize tracking-tight",
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
        "flex min-h-[64px] w-full items-center justify-center gap-3 rounded-md border px-4 py-3",
        "text-base font-semibold shadow-soft",
        "transition-[transform,box-shadow,background-color,border-color] duration-fast ease-snappy",
        "active:scale-[0.97]",
        tone === "primary" &&
          "border-primary bg-primary text-primary-foreground hover:bg-primary/92 hover:shadow-md",
        tone === "emerald" &&
          "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-600/92 hover:shadow-md",
        tone === "default" &&
          "border-border/80 bg-card hover:border-border hover:bg-hover"
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
