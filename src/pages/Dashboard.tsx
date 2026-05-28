/* ============================================================================
 * DashboardPage — the admin command center.
 *
 * Visual treatment: dark cinematic glass, matching the booking page palette
 * (obsidian / platinum / ember). Layout treatment: scannable and FAST —
 * admin needs to read instantly, so reveals are 200ms not 850ms, hover
 * responses are subtle, and the most operationally urgent stuff lives at
 * the top of the page.
 *
 * Data layer is untouched from the prior version: same selectors, same
 * dispatch, same dialog components. Only the visual chrome changed —
 * shadcn Card/Stat/Button replaced with dashboard-local lux primitives
 * (see ./components/dashboard/lux/primitives.tsx).
 *
 * Embedded widgets (BookingRequests, ReviewsDueWidget, WeatherWatchCard)
 * still render in their original light-themed Card chrome — they're
 * shared elsewhere and a separate scope to retreat.
 * ========================================================================== */

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  CalendarDays,
  CheckSquare,
  DollarSign,
  MessageSquare,
  Plus,
  Sparkles,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { formatBusinessDateTime } from "@/lib/datetime";
import { Checkbox } from "@/components/ui/checkbox";
import { AppointmentRow } from "@/components/appointments/AppointmentRow";
import { AppointmentDialog } from "@/components/appointments/AppointmentDialog";
import { CustomerDialog } from "@/components/customers/CustomerDialog";
import { TaskQuickAdd } from "@/components/tasks/TaskQuickAdd";
import { ReachOutDialog, type ReachOutContact } from "@/components/contact/ReachOutDialog";
import { BookingRequests } from "@/components/dashboard/BookingRequests";
import { ReviewsDueWidget } from "@/components/reviews/ReviewsDueWidget";
import { WeatherWatchCard } from "@/components/intelligence/WeatherWatchCard";
import { useRegisterIrisContext } from "@/components/iris/PageContext";
import { useStore } from "@/store/store";
import { cn, formatCurrency, vehicleStr } from "@/lib/utils";
import {
  appointmentsOnDay,
  appointmentsThisWeek,
  pendingFollowUps,
  unconfirmedJobs,
  upcomingAppointments,
  weekRevenueEstimate,
} from "@/lib/selectors";
import {
  formatTaskDate,
  LuxAmbient,
  LuxCard,
  LuxCardBody,
  LuxCardHeader,
  LuxEmptyState,
  LuxQuickAction,
  LuxRow,
  LuxSectionLink,
  LuxSevenDay,
  LuxStat,
  PriorityDot,
} from "@/components/dashboard/lux/primitives";

export function DashboardPage() {
  const { data, dispatch } = useStore();
  useRegisterIrisContext({ page: "dashboard", label: "Dashboard" });
  const [appOpen, setAppOpen] = useState(false);
  const [custOpen, setCustOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [reachContact, setReachContact] = useState<ReachOutContact | null>(null);
  const [reachAppointmentId, setReachAppointmentId] = useState<string | null>(null);
  const reachAppointment = useMemo(
    () => data.appointments.find((a) => a.id === reachAppointmentId) ?? null,
    [data.appointments, reachAppointmentId],
  );

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

  /* Hero state line — adapts to current operational reality */
  const heroStatus = isFirstRun
    ? "Your command center is ready. Add your first appointment, customer, or task to get rolling."
    : todays.length === 0
    ? "No appointments today — perfect window to chase leads or restock the kit."
    : todays.length === 1
    ? "One job on the books today."
    : `${todays.length} jobs on the schedule today.`;

  return (
    <div className="relative -mx-4 -mt-4 min-h-[calc(100vh-3rem)] bg-obsidian-950 px-4 pt-6 pb-12 text-platinum-100 sm:-mx-6 sm:px-6 md:-mx-10 md:-mt-6 md:px-10 md:pt-9 md:pb-16">
      <LuxAmbient />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative space-y-6"
      >
        {/* ═══ Hero band ═══ */}
        <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.32em] text-ember-300">
              {format(today, "EEEE").toUpperCase()} · {format(today, "MMMM d")}
            </p>
            <h1 className="mt-2 font-sans text-[clamp(1.9rem,3.5vw,2.6rem)] font-extralight leading-[1.05] tracking-[-0.02em] text-platinum-50">
              {greeting()}
              {owner ? (
                <span className="font-display italic font-light text-ember-200/95">, {owner}</span>
              ) : null}
            </h1>
            <p className="mt-3 max-w-[56ch] text-[13.5px] leading-relaxed text-platinum-300/80">
              {heroStatus}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <LuxQuickAction
              variant="ember"
              icon={<Plus className="h-3.5 w-3.5" />}
              label="Appointment"
              onClick={() => setAppOpen(true)}
            />
            <LuxQuickAction
              variant="neutral"
              icon={<Plus className="h-3.5 w-3.5" />}
              label="Customer"
              onClick={() => setCustOpen(true)}
            />
            <LuxQuickAction
              variant="neutral"
              icon={<Plus className="h-3.5 w-3.5" />}
              label="Task"
              onClick={() => setTaskOpen(true)}
            />
          </div>
        </section>

        {/* ═══ Pulse strip — 4 KPI tiles ═══
         *
         * Week revenue gets emphasis treatment (signal tone, larger number,
         * ember accent) because it's the one number the owner glances at
         * first thing every morning. */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <LuxStat
            kicker="Week revenue"
            value={formatCurrency(weekRevenue)}
            hint={`${week.length} job${week.length === 1 ? "" : "s"} booked`}
            icon={<DollarSign className="h-3.5 w-3.5" />}
            href="/revenue"
            emphasis
          />
          <LuxStat
            kicker="Booked this week"
            value={week.length}
            hint={
              week.length === 0
                ? "Open calendar"
                : `${week.filter((a) => a.status === "confirmed").length} confirmed · ${week.filter((a) => a.status === "scheduled").length} scheduled`
            }
            icon={<CalendarDays className="h-3.5 w-3.5" />}
            href="/calendar"
          />
          <LuxStat
            kicker="Follow-ups"
            value={followUps}
            hint={followUps === 0 ? "All caught up" : "Reach out before they cool"}
            icon={<Bell className="h-3.5 w-3.5" />}
            href="/leads"
          />
          <LuxStat
            kicker="Open tasks"
            value={openTasks.length}
            hint={`${todayTasks.length} due today`}
            icon={<CheckSquare className="h-3.5 w-3.5" />}
            href="/tasks"
          />
        </section>

        {/* ═══ Operational board — today's schedule + tasks ═══ */}
        <section className="grid gap-4 lg:grid-cols-3">
          <LuxCard tone="signal" className="lg:col-span-2">
            <LuxCardHeader
              kicker="Today"
              title="Today's appointments"
              description={`${format(today, "EEEE, MMMM d")} · ${todays.length} scheduled`}
              action={<LuxSectionLink to="/calendar" label="Calendar" />}
            />
            <LuxCardBody className="space-y-1.5">
              {todays.length === 0 ? (
                <LuxEmptyState
                  icon={<CalendarDays className="h-5 w-5" />}
                  title="No appointments yet today"
                  description="Add one to the schedule or use the day to chase leads."
                  action={
                    <LuxQuickAction
                      variant="ember"
                      icon={<Plus className="h-3.5 w-3.5" />}
                      label="Add appointment"
                      onClick={() => setAppOpen(true)}
                    />
                  }
                />
              ) : (
                /* AppointmentRow comes from shadcn-styled components — wrap
                 * in a subtle dark container so it sits cleanly in the
                 * cinematic frame. */
                <div className="space-y-1.5 rounded-sm">
                  {todays.map((a) => (
                    <div key={a.id} className="[&>*]:!bg-obsidian-900/70 [&>*]:!border-white/8">
                      <AppointmentRow appointment={a} />
                    </div>
                  ))}
                </div>
              )}
            </LuxCardBody>
          </LuxCard>

          <LuxCard>
            <LuxCardHeader
              kicker="Inbox"
              title="Today's tasks"
              description={`${openTasks.length} open · ${todayTasks.length} due today`}
              action={<LuxSectionLink to="/tasks" label="All" />}
            />
            <LuxCardBody className="space-y-0 p-0">
              {openTasks.length === 0 ? (
                <LuxEmptyState
                  icon={<CheckSquare className="h-5 w-5" />}
                  title="Inbox zero"
                  description="No open tasks right now."
                />
              ) : (
                <ul className="divide-y divide-white/8">
                  {openTasks.slice(0, 6).map((t) => (
                    <li key={t.id}>
                      <LuxRow className="flex items-start gap-3">
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
                        <div className="min-w-0 flex-1">
                          <p
                            className={cn(
                              "text-[13.5px] leading-tight text-platinum-100",
                              t.completed && "line-through text-platinum-300/50",
                            )}
                          >
                            {t.title}
                          </p>
                          <p className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-platinum-300/65">
                            <PriorityDot priority={t.priority} />
                            {formatTaskDate(t.dueDate)}
                          </p>
                        </div>
                      </LuxRow>
                    </li>
                  ))}
                </ul>
              )}
            </LuxCardBody>
          </LuxCard>
        </section>

        {/* ═══ Confirmation + Upcoming row ═══ */}
        <section className="grid gap-4 lg:grid-cols-3">
          <LuxCard className="lg:col-span-2" tone={unconfirmed.length ? "signal" : "neutral"}>
            <LuxCardHeader
              kicker="Action needed"
              title="Needs confirmation"
              description="Jobs within ~48 hours that still need a yes"
              action={
                <span
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-[0.22em]",
                    unconfirmed.length ? "text-ember-300" : "text-platinum-300/70",
                  )}
                >
                  {unconfirmed.length} job{unconfirmed.length === 1 ? "" : "s"}
                </span>
              }
            />
            <LuxCardBody className="space-y-0 p-0">
              {unconfirmed.length === 0 ? (
                <LuxEmptyState
                  icon={<AlertCircle className="h-5 w-5" />}
                  title="All upcoming jobs are confirmed"
                  description="When a job is within ~48 hours and still scheduled, it'll show up here."
                />
              ) : (
                <ul className="divide-y divide-white/8">
                  {unconfirmed.map((a) => {
                    const cust = data.customers.find((c) => c.id === a.customerId);
                    return (
                      <li key={a.id}>
                        <ConfirmRow
                          customerName={cust?.name ?? "—"}
                          start={a.start}
                          onConfirm={() =>
                            dispatch({
                              type: "updateAppointment",
                              id: a.id,
                              patch: { status: "confirmed", reminderSent: true },
                            })
                          }
                          onReachOut={() => {
                            if (!cust) return;
                            setReachContact({
                              name: cust.name,
                              phone: cust.phone,
                              email: cust.email ?? null,
                              address: cust.address ?? null,
                              vehicle: vehicleStr(a.vehicle),
                            });
                            setReachAppointmentId(a.id);
                          }}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </LuxCardBody>
          </LuxCard>

          <LuxCard>
            <LuxCardHeader
              kicker="Pipeline"
              title="Upcoming"
              description={`Next ${upcoming.length} on the books`}
            />
            <LuxCardBody className="space-y-1.5">
              {upcoming.length === 0 ? (
                <LuxEmptyState
                  icon={<Sparkles className="h-5 w-5" />}
                  title="Nothing upcoming"
                  description="Once you book a job, it'll show up here."
                />
              ) : (
                <div className="space-y-1.5">
                  {upcoming.map((a) => (
                    <div key={a.id} className="[&>*]:!bg-obsidian-900/70 [&>*]:!border-white/8">
                      <AppointmentRow appointment={a} compact />
                    </div>
                  ))}
                </div>
              )}
            </LuxCardBody>
          </LuxCard>
        </section>

        {/* ═══ Week outlook ═══ */}
        <section>
          <LuxCard>
            <LuxCardHeader
              kicker="Outlook"
              title="Next 7 days"
              description="How the week is filling up"
              action={<LuxSectionLink to="/calendar" label="Calendar" />}
            />
            <LuxCardBody>
              <LuxSevenDay />
            </LuxCardBody>
          </LuxCard>
        </section>

        {/* ═══ Embedded widgets ═══
         *
         * Live below the operational board because they're not always
         * present (booking requests come and go, weather only shows when
         * there's risk, reviews surface when due). Each renders its own
         * Card chrome — they don't match the dark cinematic frame yet
         * but the dashboard reads coherently because they sit visually
         * at the bottom of the page. Retreat is a follow-up scope. */}
        <div className="space-y-4 pt-2">
          <BookingRequests
            onReachOut={(contact, appt) => {
              setReachContact(contact);
              setReachAppointmentId(appt.id);
            }}
          />
          <ReviewsDueWidget />
          <WeatherWatchCard />
        </div>
      </motion.div>

      <AppointmentDialog open={appOpen} onOpenChange={setAppOpen} />
      <CustomerDialog open={custOpen} onOpenChange={setCustOpen} />
      <TaskQuickAdd open={taskOpen} onOpenChange={setTaskOpen} />
      <ReachOutDialog
        open={!!reachContact}
        onOpenChange={(v) => {
          if (!v) {
            setReachContact(null);
            setReachAppointmentId(null);
          }
        }}
        contact={reachContact ?? { name: "" }}
        appointment={reachAppointment}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * ConfirmRow — dark version of the prior confirm row.
 *
 * Two-button action layout (Reach out / Confirm). The Confirm button is
 * ember to reinforce that confirming is the goal of this surface.
 * ──────────────────────────────────────────────────────────────────────── */

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
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="truncate text-[13.5px] font-light text-platinum-50">
          {customerName}
        </p>
        <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-platinum-300/65">
          {formatBusinessDateTime(start)}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onReachOut}
          className="group/btn inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-platinum-100 transition-colors hover:border-white/25 hover:bg-white/[0.06]"
        >
          <MessageSquare className="h-3 w-3" />
          <span className="hidden sm:inline">Reach out</span>
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="group/btn relative inline-flex items-center gap-1.5 overflow-hidden rounded-full border border-ember-500/35 bg-gradient-to-b from-ember-500/14 via-ember-500/10 to-ember-500/16 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-platinum-50 transition-all duration-200 hover:border-ember-400/55 hover:from-ember-500/20"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,220,200,0.2) 0%, transparent 100%)",
            }}
          />
          <span className="relative">Confirm</span>
          <ArrowRight className="relative h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}
