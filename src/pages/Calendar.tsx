import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  CalendarDays,
  Ban,
} from "lucide-react";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  formatISO,
  isSameDay,
  isSameMonth,
  isWeekend,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  DndContext,
  PointerSensor,
  useDroppable,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/store/store";
import { AppointmentDialog } from "@/components/appointments/AppointmentDialog";
import { BlockDialog } from "@/components/calendar/BlockDialog";
import type { Appointment, JobStatus } from "@/lib/types";
import { cn, formatCurrency, vehicleStr } from "@/lib/utils";

type ViewMode = "month" | "week" | "day";

export function CalendarPage() {
  const { data, dispatch } = useStore();
  const [view, setView] = useState<ViewMode>("week");
  const [cursor, setCursor] = useState(new Date());
  const [editAppt, setEditAppt] = useState<Appointment | undefined>();
  const [editOpen, setEditOpen] = useState(false);
  const [createDate, setCreateDate] = useState<Date | undefined>();
  const [createOpen, setCreateOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  function go(direction: -1 | 1) {
    if (view === "month") setCursor((c) => addMonths(c, direction));
    else if (view === "week") setCursor((c) => addWeeks(c, direction));
    else setCursor((c) => addDays(c, direction));
  }

  function handleDragEnd(e: DragEndEvent) {
    const apptId = String(e.active.id);
    const overId = e.over?.id;
    if (!overId) return;
    const targetIso = String(overId);
    const targetDate = parseISO(targetIso);
    const appt = data.appointments.find((a) => a.id === apptId);
    if (!appt) return;
    const original = parseISO(appt.start);
    const newStart = new Date(targetDate);
    newStart.setHours(original.getHours(), original.getMinutes(), 0, 0);
    const duration = parseISO(appt.end).getTime() - original.getTime();
    const newEnd = new Date(newStart.getTime() + duration);
    dispatch({
      type: "updateAppointment",
      id: apptId,
      patch: { start: formatISO(newStart), end: formatISO(newEnd) },
    });
  }

  function openEdit(a: Appointment) {
    setEditAppt(a);
    setEditOpen(true);
  }

  function openCreate(date?: Date) {
    setCreateDate(date);
    setCreateOpen(true);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => go(-1)} aria-label="Previous">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => go(1)} aria-label="Next">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>
            Today
          </Button>
          <h2 className="ml-2 text-xl font-semibold tracking-tight">
            {view === "month"
              ? format(cursor, "MMMM yyyy")
              : view === "week"
              ? `${format(startOfWeek(cursor, { weekStartsOn: 1 }), "MMM d")} – ${format(
                  endOfWeek(cursor, { weekStartsOn: 1 }),
                  "MMM d, yyyy"
                )}`
              : format(cursor, "EEEE, MMMM d")}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="week">Week</TabsTrigger>
              <TabsTrigger value="day">Day</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={() => setBlockOpen(true)}>
            <Ban className="h-4 w-4" />
            Block time
          </Button>
          <Button size="sm" onClick={() => openCreate(cursor)}>
            <Plus className="h-4 w-4" />
            New
          </Button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        {view === "month" && (
          <MonthView
            cursor={cursor}
            onSelectDay={(d) => {
              setCursor(d);
              setView("day");
            }}
            onCreate={openCreate}
            onEdit={openEdit}
          />
        )}
        {view === "week" && (
          <WeekView cursor={cursor} onCreate={openCreate} onEdit={openEdit} />
        )}
        {view === "day" && (
          <DayView cursor={cursor} onCreate={openCreate} onEdit={openEdit} />
        )}
      </DndContext>

      <Legend />

      <AppointmentDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        appointment={editAppt}
      />
      <AppointmentDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialDate={createDate}
      />
      <BlockDialog open={blockOpen} onOpenChange={setBlockOpen} />
    </div>
  );
}

function Legend() {
  const items: { value: JobStatus; label: string }[] = [
    { value: "pending_approval", label: "Pending Approval" },
    { value: "inquiry", label: "Inquiry" },
    { value: "scheduled", label: "Scheduled" },
    { value: "confirmed", label: "Confirmed" },
    { value: "in_progress", label: "In Progress" },
    { value: "completed", label: "Completed" },
    { value: "follow_up", label: "Follow-Up" },
    { value: "canceled", label: "Canceled" },
  ];
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-5">
        {items.map((i) => (
          <div key={i.value} className="flex items-center gap-1.5 text-xs">
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                `status-bar-${i.value.replace("_", "-")}`
              )}
            />
            <span className="text-muted-foreground">{i.label}</span>
          </div>
        ))}
        <div className="ml-auto flex items-center gap-1.5 text-xs">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-400/60" />
          <span className="text-muted-foreground">Blocked / day job</span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- MONTH VIEW ---------- */
function MonthView({
  cursor,
  onSelectDay,
  onCreate,
  onEdit,
}: {
  cursor: Date;
  onSelectDay: (d: Date) => void;
  onCreate: (d: Date) => void;
  onEdit: (a: Appointment) => void;
}) {
  const { data } = useStore();
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const start = startOfWeek(monthStart, { weekStartsOn: 1 });
  const end = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = useMemo(() => {
    const out: Date[] = [];
    let cur = start;
    while (cur <= end) {
      out.push(cur);
      cur = addDays(cur, 1);
    }
    return out;
  }, [start.getTime(), end.getTime()]);

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="px-3 py-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const isCurMonth = isSameMonth(d, cursor);
          const today = isSameDay(d, new Date());
          const dayAppts = data.appointments.filter((a) =>
            isSameDay(parseISO(a.start), d)
          );
          const blocked = data.blocks.find((b) =>
            isSameDay(parseISO(b.start), d)
          );
          return (
            <DayCell
              key={d.toISOString()}
              date={d}
              dim={!isCurMonth}
              today={today}
              weekend={isWeekend(d)}
              blocked={!!blocked}
              appts={dayAppts}
              onClick={() => onSelectDay(d)}
              onCreate={() => onCreate(d)}
              onEditAppt={onEdit}
            />
          );
        })}
      </div>
    </Card>
  );
}

function DayCell({
  date,
  dim,
  today,
  weekend,
  blocked,
  appts,
  onClick,
  onCreate,
  onEditAppt,
}: {
  date: Date;
  dim: boolean;
  today: boolean;
  weekend: boolean;
  blocked: boolean;
  appts: Appointment[];
  onClick: () => void;
  onCreate: () => void;
  onEditAppt: (a: Appointment) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: formatISO(date) });
  const totalEst = appts.reduce(
    (s, a) => s + (a.finalPrice ?? a.estimatedPrice),
    0
  );
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group relative min-h-[110px] cursor-pointer border-b border-r border-border p-2 text-left transition-colors",
        dim && "bg-muted/30 text-muted-foreground",
        weekend && !dim && "bg-emerald-50/40 dark:bg-emerald-900/10",
        isOver && "bg-primary/10 ring-1 ring-primary/40"
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
            today && "bg-primary text-primary-foreground"
          )}
        >
          {format(date, "d")}
        </span>
        <div className="flex items-center gap-1">
          {blocked ? (
            <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
              Day job
            </span>
          ) : null}
          {totalEst > 0 ? (
            <span className="text-[10px] font-medium text-muted-foreground">
              {formatCurrency(totalEst)}
            </span>
          ) : null}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCreate();
            }}
            className="opacity-0 group-hover:opacity-100 rounded-full p-0.5 hover:bg-accent"
            aria-label="Add appointment"
          >
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="mt-1 space-y-1">
        {appts.slice(0, 3).map((a) => (
          <DraggableChip
            key={a.id}
            appointment={a}
            onClick={(e) => {
              e.stopPropagation();
              onEditAppt(a);
            }}
          />
        ))}
        {appts.length > 3 ? (
          <p className="text-[10px] text-muted-foreground">+{appts.length - 3} more</p>
        ) : null}
      </div>
    </div>
  );
}

function DraggableChip({
  appointment,
  onClick,
}: {
  appointment: Appointment;
  onClick: (e: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: appointment.id,
  });
  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : {};
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={cn(
        "relative cursor-grab active:cursor-grabbing rounded-md bg-card pl-2 pr-1 py-0.5 text-[10px] font-medium shadow-sm border border-border/60 hover:border-primary/40 transition-colors truncate"
      )}
    >
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-1 rounded-l-md",
          `status-bar-${appointment.status.replace("_", "-")}`
        )}
      />
      <span className="ml-1.5 truncate">
        {format(parseISO(appointment.start), "p")} ·{" "}
        {appointment.vehicle.make || "Job"}
      </span>
    </div>
  );
}

/* ---------- WEEK VIEW ---------- */
function WeekView({
  cursor,
  onCreate,
  onEdit,
}: {
  cursor: Date;
  onCreate: (d: Date) => void;
  onEdit: (a: Appointment) => void;
}) {
  const { data } = useStore();
  const start = startOfWeek(cursor, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const HOURS = Array.from({ length: 14 }, (_, i) => 7 + i); // 7am – 8pm

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border bg-muted/40">
        <div />
        {days.map((d) => {
          const today = isSameDay(d, new Date());
          const weekend = isWeekend(d);
          return (
            <div
              key={d.toISOString()}
              className={cn(
                "px-3 py-2 text-center",
                weekend && "bg-emerald-50/60 dark:bg-emerald-900/10"
              )}
            >
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {format(d, "EEE")}
              </p>
              <p
                className={cn(
                  "mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold",
                  today && "bg-primary text-primary-foreground"
                )}
              >
                {format(d, "d")}
              </p>
            </div>
          );
        })}
      </div>
      <div className="relative grid grid-cols-[60px_repeat(7,1fr)] max-h-[70vh] overflow-y-auto scrollbar-thin">
        {/* Time gutter */}
        <div>
          {HOURS.map((h) => (
            <div
              key={h}
              className="h-14 border-b border-border/60 px-2 text-right text-[10px] text-muted-foreground"
            >
              {format(new Date(0, 0, 0, h), "h a")}
            </div>
          ))}
        </div>

        {days.map((d) => (
          <WeekDayCol
            key={d.toISOString()}
            day={d}
            hours={HOURS}
            blocks={data.blocks.filter((b) => isSameDay(parseISO(b.start), d))}
            appts={data.appointments.filter((a) =>
              isSameDay(parseISO(a.start), d)
            )}
            onCreate={onCreate}
            onEdit={onEdit}
          />
        ))}
      </div>
    </Card>
  );
}

function WeekDayCol({
  day,
  hours,
  blocks,
  appts,
  onCreate,
  onEdit,
}: {
  day: Date;
  hours: number[];
  blocks: { start: string; end: string; label: string }[];
  appts: Appointment[];
  onCreate: (d: Date) => void;
  onEdit: (a: Appointment) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: formatISO(day) });
  const startHour = hours[0];
  const minutesPerSlot = 60;
  const slotHeight = 56; // h-14
  const totalHeight = hours.length * slotHeight;
  const weekend = isWeekend(day);

  function eventTop(iso: string): number {
    const d = parseISO(iso);
    const hour = d.getHours() + d.getMinutes() / 60;
    return Math.max(0, (hour - startHour) * (slotHeight / 1)) ;
  }

  function eventHeight(s: string, e: string): number {
    const ms = parseISO(e).getTime() - parseISO(s).getTime();
    const h = ms / 1000 / 60 / 60;
    return Math.max(28, h * slotHeight);
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "relative border-l border-border/60",
        weekend && "bg-emerald-50/40 dark:bg-emerald-900/10",
        isOver && "bg-primary/5"
      )}
      style={{ height: totalHeight }}
    >
      {hours.map((h) => (
        <button
          key={h}
          type="button"
          onClick={() => {
            const d = new Date(day);
            d.setHours(h, 0, 0, 0);
            onCreate(d);
          }}
          className="block h-14 w-full border-b border-border/40 hover:bg-accent/40 transition-colors"
        />
      ))}

      {blocks.map((b, i) => {
        const top = eventTop(b.start);
        const height = eventHeight(b.start, b.end);
        return (
          <div
            key={i}
            className="absolute left-0 right-0 mx-1 rounded-md bg-slate-200/80 px-2 py-1 text-[10px] font-medium text-slate-700 dark:bg-slate-700/50 dark:text-slate-300 backdrop-blur"
            style={{ top, height }}
          >
            <div className="flex items-center gap-1">
              <Ban className="h-3 w-3" />
              {b.label}
            </div>
          </div>
        );
      })}

      {appts.map((a) => {
        const top = eventTop(a.start);
        const height = eventHeight(a.start, a.end);
        return (
          <WeekEvent
            key={a.id}
            appointment={a}
            top={top}
            height={height}
            onEdit={onEdit}
          />
        );
      })}
    </div>
  );
}

function WeekEvent({
  appointment,
  top,
  height,
  onEdit,
}: {
  appointment: Appointment;
  top: number;
  height: number;
  onEdit: (a: Appointment) => void;
}) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: appointment.id,
  });
  const style: React.CSSProperties = {
    top,
    height,
    ...(transform
      ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
      : {}),
  };
  const cls = `status-bar-${appointment.status.replace("_", "-")}`;
  const { data } = useStore();
  const customer = data.customers.find((c) => c.id === appointment.customerId);
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => onEdit(appointment)}
      className="absolute left-1 right-1 cursor-grab active:cursor-grabbing overflow-hidden rounded-md bg-card border border-border shadow-soft hover:shadow-lift transition-shadow"
    >
      <div className={cn("absolute inset-y-0 left-0 w-1", cls)} />
      <div className="pl-2 pr-1.5 py-1.5">
        <p className="truncate text-[11px] font-semibold">{customer?.name ?? "—"}</p>
        <p className="truncate text-[10px] text-muted-foreground">
          {format(parseISO(appointment.start), "p")} ·{" "}
          {vehicleStr(appointment.vehicle) || "Vehicle"}
        </p>
        {height > 60 ? (
          <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
            {formatCurrency(appointment.finalPrice ?? appointment.estimatedPrice)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ---------- DAY VIEW ---------- */
function DayView({
  cursor,
  onCreate,
  onEdit,
}: {
  cursor: Date;
  onCreate: (d: Date) => void;
  onEdit: (a: Appointment) => void;
}) {
  const { data } = useStore();
  const HOURS = Array.from({ length: 16 }, (_, i) => 6 + i); // 6am – 9pm
  const slotHeight = 64;
  const totalHeight = HOURS.length * slotHeight;
  const startHour = HOURS[0];
  const dayAppts = data.appointments.filter((a) =>
    isSameDay(parseISO(a.start), cursor)
  );
  const dayBlocks = data.blocks.filter((b) =>
    isSameDay(parseISO(b.start), cursor)
  );

  function eventTop(iso: string): number {
    const d = parseISO(iso);
    const hour = d.getHours() + d.getMinutes() / 60;
    return Math.max(0, (hour - startHour) * slotHeight);
  }
  function eventHeight(s: string, e: string): number {
    const ms = parseISO(e).getTime() - parseISO(s).getTime();
    const h = ms / 1000 / 60 / 60;
    return Math.max(34, h * slotHeight);
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="text-base">{format(cursor, "EEEE, MMMM d")}</CardTitle>
        </CardHeader>
        <div className="relative grid grid-cols-[60px_1fr] max-h-[70vh] overflow-y-auto scrollbar-thin">
          <div>
            {HOURS.map((h) => (
              <div
                key={h}
                className="h-16 border-b border-border/60 px-2 text-right text-[10px] text-muted-foreground"
              >
                {format(new Date(0, 0, 0, h), "h a")}
              </div>
            ))}
          </div>
          <div className="relative" style={{ height: totalHeight }}>
            {HOURS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => {
                  const d = new Date(cursor);
                  d.setHours(h, 0, 0, 0);
                  onCreate(d);
                }}
                className="block h-16 w-full border-b border-border/40 hover:bg-accent/40 transition-colors"
              />
            ))}
            {dayBlocks.map((b, i) => (
              <div
                key={i}
                className="absolute left-1 right-1 rounded-md bg-slate-200/80 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-700/50 dark:text-slate-300"
                style={{ top: eventTop(b.start), height: eventHeight(b.start, b.end) }}
              >
                <div className="flex items-center gap-1">
                  <Ban className="h-3 w-3" />
                  {b.label}
                </div>
              </div>
            ))}
            {dayAppts.map((a) => (
              <DayEvent
                key={a.id}
                appointment={a}
                top={eventTop(a.start)}
                height={eventHeight(a.start, a.end)}
                onEdit={onEdit}
              />
            ))}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Day plan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {dayAppts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs scheduled.</p>
          ) : (
            dayAppts.map((a) => {
              const customer = data.customers.find((c) => c.id === a.customerId);
              return (
                <button
                  key={a.id}
                  className="w-full rounded-lg border bg-card p-3 text-left transition-all hover:border-primary/40 hover:shadow-soft"
                  onClick={() => onEdit(a)}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{customer?.name}</p>
                    <Badge variant="soft">
                      {format(parseISO(a.start), "p")}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {vehicleStr(a.vehicle)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{a.address}</p>
                </button>
              );
            })
          )}
          <Button onClick={() => onCreate(cursor)} variant="outline" className="w-full">
            <Plus className="h-4 w-4" />
            Add job to this day
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function DayEvent({
  appointment,
  top,
  height,
  onEdit,
}: {
  appointment: Appointment;
  top: number;
  height: number;
  onEdit: (a: Appointment) => void;
}) {
  const { data } = useStore();
  const customer = data.customers.find((c) => c.id === appointment.customerId);
  return (
    <button
      onClick={() => onEdit(appointment)}
      className="absolute left-2 right-2 overflow-hidden rounded-md bg-card border border-border shadow-soft hover:shadow-lift transition-all text-left"
      style={{ top, height }}
    >
      <div
        className={cn(
          "absolute inset-y-0 left-0 w-1.5",
          `status-bar-${appointment.status.replace("_", "-")}`
        )}
      />
      <div className="pl-3 pr-2 py-2">
        <p className="text-sm font-semibold">{customer?.name}</p>
        <p className="text-xs text-muted-foreground">
          {format(parseISO(appointment.start), "p")} – {format(parseISO(appointment.end), "p")} ·{" "}
          {vehicleStr(appointment.vehicle)}
        </p>
        {height > 70 ? (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{appointment.address}</p>
        ) : null}
      </div>
    </button>
  );
}
