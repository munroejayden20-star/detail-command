import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  CheckSquare,
  DollarSign,
  Plus,
  TrendingUp,
  AlertCircle,
  Sparkles,
  Bell,
  ArrowRight,
  MessageSquare,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AppointmentRow } from "@/components/appointments/AppointmentRow";
import { AppointmentDialog } from "@/components/appointments/AppointmentDialog";
import { CustomerDialog } from "@/components/customers/CustomerDialog";
import { TaskQuickAdd } from "@/components/tasks/TaskQuickAdd";
import { ReachOutDialog, type ReachOutContact } from "@/components/contact/ReachOutDialog";
import { useStore } from "@/store/store";
import { vehicleStr } from "@/lib/utils";
import {
  appointmentsOnDay,
  appointmentsThisWeek,
  pendingFollowUps,
  unconfirmedJobs,
  upcomingAppointments,
  weekRevenueEstimate,
} from "@/lib/selectors";
import { cn, formatCurrency } from "@/lib/utils";

export function DashboardPage() {
  const { data, dispatch } = useStore();
  const [appOpen, setAppOpen] = useState(false);
  const [custOpen, setCustOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [reachContact, setReachContact] = useState<ReachOutContact | null>(null);

  const today = useMemo(() => new Date(), []);
  const todays = appointmentsOnDay(data, today);
  const upcoming = upcomingAppointments(data, 6);
  const week = appointmentsThisWeek(data, today);
  const weekRevenue = weekRevenueEstimate(data, today);
  const followUps = pendingFollowUps(data);
  const unconfirmed = unconfirmedJobs(data);
  const openTasks = data.tasks.filter((t) => !t.completed);
  const todayTasks = openTasks.filter((t) => {
    if (!t.dueDate) return false;
    const d = parseISO(t.dueDate);
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate()
    );
  });

  const owner = data.settings.ownerName;
  const isFirstRun =
    data.appointments.length === 0 &&
    data.customers.length === 0 &&
    data.leads.length === 0 &&
    data.tasks.length === 0;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {format(today, "EEEE")} · {format(today, "MMMM d")}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {greeting()}{owner ? `, ${owner}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isFirstRun
              ? "Your command center is ready. Add your first appointment, customer, or task to get rolling."
              : todays.length === 0
              ? "No appointments today — perfect time to chase leads or restock."
              : todays.length === 1
              ? "One job on the books today."
              : `${todays.length} jobs on the schedule today.`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setAppOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Appointment
          </Button>
          <Button variant="outline" onClick={() => setCustOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Customer
          </Button>
          <Button variant="outline" onClick={() => setTaskOpen(true)}>
            <Plus className="h-4 w-4" />
            Add To-Do
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat
          label="This week revenue est."
          value={formatCurrency(weekRevenue)}
          hint={`${week.length} job${week.length === 1 ? "" : "s"} booked`}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <Stat
          label="Booked this week"
          value={week.length}
          hint={
            week.filter((a) => a.status === "confirmed").length +
              " confirmed · " +
              week.filter((a) => a.status === "scheduled").length +
              " scheduled"
          }
          icon={<CalendarDays className="h-4 w-4" />}
        />
        <Stat
          label="Pending follow-ups"
          value={followUps}
          hint={
            followUps === 0
              ? "All caught up"
              : "Reach out before they cool off"
          }
          trend={followUps === 0 ? "up" : "down"}
          icon={<Bell className="h-4 w-4" />}
        />
        <Stat
          label="Open tasks"
          value={openTasks.length}
          hint={`${todayTasks.length} due today`}
          icon={<CheckSquare className="h-4 w-4" />}
        />
      </div>

      {/* Two-column grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's appointments */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Today's appointments</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {format(today, "EEEE, MMMM d")}
              </p>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link to="/calendar" className="gap-1">
                Open calendar <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {todays.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="h-5 w-5" />}
                title="No appointments yet today"
                description="Add your first appointment to get started."
                action={
                  <Button size="sm" onClick={() => setAppOpen(true)}>
                    <Plus className="h-4 w-4" /> Add appointment
                  </Button>
                }
              />
            ) : (
              todays.map((a) => <AppointmentRow key={a.id} appointment={a} />)
            )}
          </CardContent>
        </Card>

        {/* Upcoming */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {upcoming.length === 0 ? (
              <EmptyState
                icon={<Sparkles className="h-5 w-5" />}
                title="No upcoming appointments"
                description="Once you book a job, it'll show up here."
                action={
                  <Button size="sm" variant="outline" onClick={() => setAppOpen(true)}>
                    <Plus className="h-4 w-4" /> Add appointment
                  </Button>
                }
              />
            ) : (
              upcoming.map((a) => <AppointmentRow key={a.id} appointment={a} compact />)
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirm + Tasks row */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Needs confirmation</CardTitle>
            <Badge variant={unconfirmed.length ? "soft" : "secondary"}>
              {unconfirmed.length} job{unconfirmed.length === 1 ? "" : "s"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-2">
            {unconfirmed.length === 0 ? (
              <EmptyState
                icon={<AlertCircle className="h-5 w-5" />}
                title="All upcoming jobs are confirmed"
                description="When a job is within ~48 hours and still scheduled or inquiry, it'll show up here."
              />
            ) : (
              unconfirmed.map((a) => {
                const cust = data.customers.find((c) => c.id === a.customerId);
                return (
                  <ConfirmRow
                    key={a.id}
                    apptId={a.id}
                    customerName={cust?.name ?? "—"}
                    start={a.start}
                    onConfirm={() =>
                      dispatch({
                        type: "updateAppointment",
                        id: a.id,
                        patch: { status: "confirmed", reminderSent: true },
                      })
                    }
                    onReachOut={() =>
                      cust
                        ? setReachContact({
                            name: cust.name,
                            phone: cust.phone,
                            email: cust.email ?? null,
                            address: cust.address ?? null,
                            vehicle: vehicleStr(a.vehicle),
                          })
                        : null
                    }
                  />
                );
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Today's tasks</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link to="/tasks" className="gap-1">
                All tasks <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {openTasks.length === 0 ? (
              <EmptyState
                icon={<CheckSquare className="h-5 w-5" />}
                title="Inbox zero"
                description="No open tasks right now."
              />
            ) : (
              <ul className="space-y-1">
                {openTasks.slice(0, 6).map((t) => (
                  <li key={t.id} className="flex items-start gap-2 rounded-md p-2 hover:bg-accent">
                    <Checkbox
                      checked={t.completed}
                      onCheckedChange={() =>
                        dispatch({
                          type: "updateTask",
                          id: t.id,
                          patch: { completed: !t.completed },
                        })
                      }
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm", t.completed && "line-through text-muted-foreground")}>
                        {t.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {t.priority === "high" ? "🔴 " : t.priority === "medium" ? "🟡 " : "⚪️ "}
                        {t.dueDate ? format(parseISO(t.dueDate), "MMM d") : "no due date"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 7-day outlook */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Next 7 days</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              How the week is filling up
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/calendar" className="gap-1">
              Open calendar <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <SevenDayOutlook />
        </CardContent>
      </Card>

      <AppointmentDialog open={appOpen} onOpenChange={setAppOpen} />
      <CustomerDialog open={custOpen} onOpenChange={setCustOpen} />
      <TaskQuickAdd open={taskOpen} onOpenChange={setTaskOpen} />
      <ReachOutDialog
        open={!!reachContact}
        onOpenChange={(v) => !v && setReachContact(null)}
        contact={reachContact ?? { name: "" }}
      />
    </div>
  );
}

function ConfirmRow({
  customerName,
  start,
  onConfirm,
  onReachOut,
}: {
  customerName: string;
  start: string;
  onConfirm: () => void;
  onReachOut: () => void;
  apptId: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{customerName}</p>
        <p className="text-xs text-muted-foreground">
          {format(parseISO(start), "EEE, MMM d · p")}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={onReachOut}>
          <MessageSquare className="h-3.5 w-3.5" />
          Reach out
        </Button>
        <Button size="sm" onClick={onConfirm}>
          Mark confirmed
        </Button>
      </div>
    </div>
  );
}

function SevenDayOutlook() {
  const { data } = useStore();
  const today = new Date();
  const max = data.settings.maxJobsPerDay || 3;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const appts = appointmentsOnDay(data, d);
    const revenue = appts.reduce(
      (s, a) => s + (a.finalPrice ?? a.estimatedPrice),
      0
    );
    return { date: d, appts, revenue };
  });

  return (
    <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
      {days.map(({ date, appts, revenue }, i) => {
        const filled = appts.length;
        const pct = Math.min(100, (filled / max) * 100);
        const isToday = i === 0;
        return (
          <div
            key={date.toISOString()}
            className={cn(
              "rounded-lg border p-3",
              isToday && "border-primary/40 bg-primary/5"
            )}
          >
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {isToday ? "Today" : format(date, "EEE")}
            </p>
            <p className="text-sm font-semibold">{format(date, "MMM d")}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  filled >= max
                    ? "bg-emerald-500"
                    : filled > 0
                    ? "bg-primary"
                    : "bg-muted-foreground/20"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              {filled}/{max} jobs
            </p>
            {revenue > 0 ? (
              <p className="mt-0.5 inline-flex items-center text-[11px] font-medium">
                <TrendingUp className="mr-0.5 h-3 w-3" />
                {formatCurrency(revenue)}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
