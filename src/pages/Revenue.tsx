import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import {
  parseISO,
  startOfWeek,
  startOfMonth,
  format,
  subWeeks,
  subMonths,
  endOfWeek,
  endOfMonth,
  isWithinInterval,
  getDay,
} from "date-fns";
import {
  TrendingUp,
  DollarSign,
  Users,
  BarChart2,
  Target,
  Wallet,
  Repeat2,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import { useStore } from "@/store/store";
import { appointmentRevenue } from "@/lib/selectors";
import { formatCurrency, cn } from "@/lib/utils";

const CHART_COLORS = ["#1a5eef", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 12,
  fontSize: 12,
};

export function RevenuePage() {
  const { data } = useStore();
  const [revTab, setRevTab] = useState<"weekly" | "monthly">("monthly");

  const nonCanceled = useMemo(
    () => data.appointments.filter((a) => a.status !== "canceled"),
    [data.appointments]
  );

  const completed = useMemo(
    () => data.appointments.filter((a) => a.status === "completed"),
    [data.appointments]
  );

  const kpis = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const prevMonthStart = startOfMonth(subMonths(now, 1));
    const prevMonthEnd = endOfMonth(subMonths(now, 1));

    const totalRevenue = completed.reduce((s, a) => s + appointmentRevenue(a), 0);

    const thisMonthRevenue = nonCanceled
      .filter((a) => isWithinInterval(parseISO(a.start), { start: monthStart, end: monthEnd }))
      .reduce((s, a) => s + appointmentRevenue(a), 0);

    const lastMonthRevenue = nonCanceled
      .filter((a) => isWithinInterval(parseISO(a.start), { start: prevMonthStart, end: prevMonthEnd }))
      .reduce((s, a) => s + appointmentRevenue(a), 0);

    const momPct =
      lastMonthRevenue > 0
        ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
        : null;

    const avgJob = completed.length ? totalRevenue / completed.length : 0;
    const totalExpenses = data.expenses.reduce((s, e) => s + e.amount, 0);
    const netProfit = totalRevenue - totalExpenses;

    const activeCustomerIds = new Set(nonCanceled.map((a) => a.customerId));

    const completedByCustomer = new Map<string, number>();
    for (const a of completed) {
      completedByCustomer.set(a.customerId, (completedByCustomer.get(a.customerId) ?? 0) + 1);
    }
    const repeatCount = [...completedByCustomer.values()].filter((v) => v >= 2).length;
    const repeatRate =
      completedByCustomer.size > 0
        ? Math.round((repeatCount / completedByCustomer.size) * 100)
        : 0;

    const pipelineStatuses = new Set(["pending_approval", "inquiry", "scheduled", "confirmed", "in_progress"]);
    const pipeline = data.appointments
      .filter((a) => pipelineStatuses.has(a.status) && parseISO(a.start).getTime() > Date.now())
      .reduce((s, a) => s + appointmentRevenue(a), 0);

    return {
      totalRevenue,
      thisMonthRevenue,
      lastMonthRevenue,
      momPct,
      avgJob,
      totalExpenses,
      netProfit,
      completedCount: completed.length,
      activeCustomers: activeCustomerIds.size,
      repeatCount,
      repeatRate,
      pipeline,
    };
  }, [data.appointments, data.expenses, completed, nonCanceled]);

  const weeklyChartData = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => {
      const base = subWeeks(new Date(), 7 - i);
      const start = startOfWeek(base, { weekStartsOn: 1 });
      const end = endOfWeek(base, { weekStartsOn: 1 });
      return {
        label: format(start, "MMM d"),
        revenue: nonCanceled
          .filter((a) => isWithinInterval(parseISO(a.start), { start, end }))
          .reduce((s, a) => s + appointmentRevenue(a), 0),
      };
    });
  }, [nonCanceled]);

  const monthlyChartData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const base = subMonths(new Date(), 5 - i);
      const start = startOfMonth(base);
      const end = endOfMonth(base);
      const revenue = nonCanceled
        .filter((a) => isWithinInterval(parseISO(a.start), { start, end }))
        .reduce((s, a) => s + appointmentRevenue(a), 0);
      const expenses = data.expenses
        .filter((e) => isWithinInterval(parseISO(e.date), { start, end }))
        .reduce((s, e) => s + e.amount, 0);
      return {
        label: format(start, "MMM"),
        revenue,
        expenses,
        profit: revenue - expenses,
      };
    });
  }, [nonCanceled, data.expenses]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of data.appointments) {
      const label = a.status
        .replace(/_/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      counts[label] = (counts[label] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [data.appointments]);

  const dowData = useMemo(() => {
    const counts = Array.from({ length: 7 }, (_, i) => ({
      label: DOW_LABELS[i],
      jobs: 0,
    }));
    for (const a of nonCanceled) {
      const d = getDay(parseISO(a.start));
      counts[d].jobs++;
    }
    return counts;
  }, [nonCanceled]);

  const sourceData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const l of data.leads) {
      if (l.status === "booked") {
        const key = l.source.charAt(0).toUpperCase() + l.source.slice(1);
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
    for (const a of nonCanceled) {
      if (a.source) {
        const key = a.source.charAt(0).toUpperCase() + a.source.slice(1);
        counts[key] = (counts[key] ?? 0) + 1;
      }
    }
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [data.leads, nonCanceled]);

  const topCustomers = useMemo(() => {
    return data.customers
      .map((c) => {
        const cAppts = completed.filter((a) => a.customerId === c.id);
        const totalSpent = cAppts.reduce((s, a) => s + appointmentRevenue(a), 0);
        const lastJob = cAppts.reduce<string | null>((latest, a) => {
          if (!latest || a.start > latest) return a.start;
          return latest;
        }, null);
        return { id: c.id, name: c.name, jobs: cAppts.length, totalSpent, lastJob };
      })
      .filter((c) => c.jobs > 0)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);
  }, [data.customers, completed]);

  const mainServices = useMemo(() => data.services.filter((s) => !s.isAddon), [data.services]);
  const addonServices = useMemo(() => data.services.filter((s) => s.isAddon), [data.services]);

  const serviceStats = useMemo(() => {
    return mainServices
      .map((svc) => {
        const bookedAppts = nonCanceled.filter((a) => a.serviceIds.includes(svc.id));
        const revenue = bookedAppts.reduce((s, a) => s + appointmentRevenue(a), 0);
        const avgPrice = bookedAppts.length ? revenue / bookedAppts.length : 0;
        const revPct =
          kpis.totalRevenue > 0
            ? Math.round((revenue / kpis.totalRevenue) * 100)
            : 0;
        return { id: svc.id, name: svc.name, timesBooked: bookedAppts.length, revenue, avgPrice, revPct };
      })
      .filter((s) => s.timesBooked > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [mainServices, nonCanceled, kpis.totalRevenue]);

  const addonStats = useMemo(() => {
    const totalJobs = nonCanceled.length;
    return addonServices
      .map((svc) => {
        const bookedAppts = nonCanceled.filter((a) => a.addonIds.includes(svc.id));
        const revenue = bookedAppts.length * ((svc.priceLow + svc.priceHigh) / 2);
        const attachRate =
          totalJobs > 0 ? Math.round((bookedAppts.length / totalJobs) * 100) : 0;
        return { id: svc.id, name: svc.name, timesAdded: bookedAppts.length, revenue, attachRate };
      })
      .filter((s) => s.timesAdded > 0)
      .sort((a, b) => b.timesAdded - a.timesAdded);
  }, [addonServices, nonCanceled]);

  const hasData = data.appointments.length > 0;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Business Stats"
        description="Live look at how your business is performing."
      />

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Total Revenue"
          value={formatCurrency(kpis.totalRevenue)}
          hint={`${kpis.completedCount} completed jobs`}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <Stat
          label="This Month"
          value={formatCurrency(kpis.thisMonthRevenue)}
          hint={
            kpis.momPct !== null
              ? `${kpis.momPct >= 0 ? "+" : ""}${kpis.momPct}% vs last month`
              : "No data last month"
          }
          trend={kpis.momPct !== null ? (kpis.momPct >= 0 ? "up" : "down") : "neutral"}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <Stat
          label="Avg Job Value"
          value={formatCurrency(kpis.avgJob)}
          hint="Across all completed jobs"
          icon={<BarChart2 className="h-4 w-4" />}
        />
        <Stat
          label="Net Profit"
          value={formatCurrency(kpis.netProfit)}
          hint={`After ${formatCurrency(kpis.totalExpenses)} in expenses`}
          trend={kpis.netProfit >= 0 ? "up" : "down"}
          icon={<Wallet className="h-4 w-4" />}
        />
        <Stat
          label="Jobs Completed"
          value={kpis.completedCount}
          hint={`${data.appointments.length} total appointments`}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <Stat
          label="Active Customers"
          value={kpis.activeCustomers}
          hint={`${data.customers.length} in database`}
          icon={<Users className="h-4 w-4" />}
        />
        <Stat
          label="Repeat Rate"
          value={`${kpis.repeatRate}%`}
          hint={`${kpis.repeatCount} repeat customers`}
          trend={kpis.repeatRate >= 50 ? "up" : kpis.repeatRate >= 25 ? "neutral" : "down"}
          icon={<Repeat2 className="h-4 w-4" />}
        />
        <Stat
          label="Pipeline Value"
          value={formatCurrency(kpis.pipeline)}
          hint="Upcoming booked jobs"
          icon={<Target className="h-4 w-4" />}
        />
      </div>

      {/* Revenue Trend */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Revenue Trend</CardTitle>
            <div className="flex gap-0.5 rounded-lg border p-1">
              {(["weekly", "monthly"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setRevTab(t)}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                    revTab === t
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!hasData ? (
            <EmptyState
              title="No data yet"
              description="Book and complete jobs to see your revenue trend."
            />
          ) : revTab === "weekly" ? (
            <GradientAreaChart
              data={weeklyChartData}
              dataKey="revenue"
              color="#1a5eef"
            />
          ) : (
            <RevenueExpensesChart data={monthlyChartData} />
          )}
        </CardContent>
      </Card>

      {/* Jobs by Status + Day of Week */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Jobs by Status</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length === 0 ? (
              <EmptyState title="No jobs yet" />
            ) : (
              <DonutChart data={statusData} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bookings by Day of Week</CardTitle>
          </CardHeader>
          <CardContent>
            {nonCanceled.length === 0 ? (
              <EmptyState title="No jobs yet" />
            ) : (
              <div className="h-56">
                <ResponsiveContainer>
                  <BarChart data={dowData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      dataKey="label"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--accent))" }}
                      contentStyle={tooltipStyle}
                      formatter={(v: number) => [v, "Jobs"]}
                    />
                    <Bar dataKey="jobs" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Booking Sources */}
      {sourceData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Booking Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-2 items-center">
              <div className="h-56">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={sourceData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={90}
                    >
                      {sourceData.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-2">
                {sourceData.map((s, idx) => {
                  const total = sourceData.reduce((sum, x) => sum + x.value, 0);
                  const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
                  return (
                    <li key={s.name} className="flex items-center gap-2 text-sm">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }}
                      />
                      <span className="flex-1 truncate font-medium">{s.name}</span>
                      <span className="text-muted-foreground">{s.value} ({pct}%)</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Customers */}
      <Card>
        <CardHeader>
          <CardTitle>Top Customers</CardTitle>
        </CardHeader>
        <CardContent>
          {topCustomers.length === 0 ? (
            <EmptyState title="No completed jobs yet" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2.5 pr-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Customer
                    </th>
                    <th className="pb-2.5 pr-4 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Jobs
                    </th>
                    <th className="pb-2.5 pr-4 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Total Spent
                    </th>
                    <th className="pb-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Last Job
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {topCustomers.map((c, i) => (
                    <tr key={c.id} className="hover:bg-accent/40 transition-colors">
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                            {i + 1}
                          </span>
                          <span className="font-medium">{c.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-right text-muted-foreground">{c.jobs}</td>
                      <td className="py-2.5 pr-4 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(c.totalSpent)}
                      </td>
                      <td className="py-2.5 text-right text-muted-foreground">
                        {c.lastJob ? format(parseISO(c.lastJob), "MMM d, yyyy") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Service Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Service Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {serviceStats.length === 0 ? (
            <EmptyState title="No service data yet" description="Complete jobs to see which services drive revenue." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2.5 pr-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Service
                    </th>
                    <th className="pb-2.5 pr-4 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Booked
                    </th>
                    <th className="pb-2.5 pr-4 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Revenue
                    </th>
                    <th className="pb-2.5 pr-4 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Avg Job
                    </th>
                    <th className="pb-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      % of Rev
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {serviceStats.map((s) => (
                    <tr key={s.id} className="hover:bg-accent/40 transition-colors">
                      <td className="py-2.5 pr-4 font-medium">{s.name}</td>
                      <td className="py-2.5 pr-4 text-right text-muted-foreground">{s.timesBooked}</td>
                      <td className="py-2.5 pr-4 text-right font-semibold">{formatCurrency(s.revenue)}</td>
                      <td className="py-2.5 pr-4 text-right text-muted-foreground">
                        {formatCurrency(s.avgPrice)}
                      </td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${s.revPct}%` }}
                            />
                          </div>
                          <span className="w-7 text-right text-muted-foreground">{s.revPct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add-ons Performance */}
      {addonStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Add-on Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2.5 pr-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Add-on
                    </th>
                    <th className="pb-2.5 pr-4 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Times Added
                    </th>
                    <th className="pb-2.5 pr-4 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Est. Revenue
                    </th>
                    <th className="pb-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Attach Rate
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {addonStats.map((s) => (
                    <tr key={s.id} className="hover:bg-accent/40 transition-colors">
                      <td className="py-2.5 pr-4 font-medium">{s.name}</td>
                      <td className="py-2.5 pr-4 text-right text-muted-foreground">{s.timesAdded}</td>
                      <td className="py-2.5 pr-4 text-right font-semibold">{formatCurrency(s.revenue)}</td>
                      <td className="py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${s.attachRate}%` }}
                            />
                          </div>
                          <span className="w-7 text-right text-muted-foreground">{s.attachRate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function GradientAreaChart({
  data,
  dataKey,
  color,
}: {
  data: { label: string; [key: string]: number | string }[];
  dataKey: string;
  color: string;
}) {
  const gradId = `grad-${dataKey}`;
  return (
    <div className="h-72">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis
            fontSize={11}
            tickLine={false}
            axisLine={false}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: "4 4" }}
            contentStyle={tooltipStyle}
            formatter={(v: number) => [formatCurrency(v), "Revenue"]}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradId})`}
            dot={false}
            activeDot={{ r: 4, fill: color }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function RevenueExpensesChart({
  data,
}: {
  data: { label: string; revenue: number; expenses: number; profit: number }[];
}) {
  return (
    <div className="h-72">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            stroke="hsl(var(--muted-foreground))"
          />
          <YAxis
            fontSize={11}
            tickLine={false}
            axisLine={false}
            stroke="hsl(var(--muted-foreground))"
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--accent))" }}
            contentStyle={tooltipStyle}
            formatter={(v: number, name: string) => [
              formatCurrency(v),
              name.charAt(0).toUpperCase() + name.slice(1),
            ]}
          />
          <Bar dataKey="revenue" fill="#1a5eef" radius={[6, 6, 0, 0]} name="revenue" />
          <Bar dataKey="expenses" fill="#ef4444" radius={[6, 6, 0, 0]} name="expenses" />
          <Bar dataKey="profit" fill="#10b981" radius={[6, 6, 0, 0]} name="profit" />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-2 flex items-center justify-center gap-4 text-xs text-muted-foreground">
        {[
          { color: "#1a5eef", label: "Revenue" },
          { color: "#ef4444", label: "Expenses" },
          { color: "#10b981", label: "Profit" },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm" style={{ background: l.color }} />
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutChart({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="grid gap-4 sm:grid-cols-2 items-center">
      <div className="h-52">
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
            >
              {data.map((_, idx) => (
                <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-1.5">
        {data.map((d, idx) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <li key={d.name} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 shrink-0 rounded-sm"
                style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }}
              />
              <span className="flex-1 truncate text-muted-foreground">{d.name}</span>
              <span className="font-medium">{d.value}</span>
              <span className="text-muted-foreground">({pct}%)</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
