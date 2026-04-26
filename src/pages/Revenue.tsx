import { useMemo } from "react";
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
} from "date-fns";
import { TrendingUp, DollarSign, CheckCircle2, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import { useStore } from "@/store/store";
import { appointmentRevenue } from "@/lib/selectors";
import { formatCurrency } from "@/lib/utils";

export function RevenuePage() {
  const { data } = useStore();

  const completedJobs = data.appointments.filter((a) => a.status === "completed");
  const canceledJobs = data.appointments.filter((a) => a.status === "canceled");
  const upcomingJobs = data.appointments.filter(
    (a) => parseISO(a.start).getTime() > Date.now() && a.status !== "canceled"
  );

  const totalCompletedRev = completedJobs.reduce((s, a) => s + appointmentRevenue(a), 0);
  const upcomingEst = upcomingJobs.reduce((s, a) => s + appointmentRevenue(a), 0);
  const avgJob = completedJobs.length
    ? totalCompletedRev / completedJobs.length
    : 0;

  // Add-on revenue
  const addonRev = data.appointments.reduce((sum, a) => {
    if (a.status === "canceled") return sum;
    const addonTotal = a.addonIds
      .map((id) => data.services.find((s) => s.id === id))
      .filter((s): s is NonNullable<typeof s> => !!s)
      .reduce((ss, s) => ss + (s.priceLow + s.priceHigh) / 2, 0);
    return sum + addonTotal;
  }, 0);

  const weeklyData = useMemo(() => {
    const weeks: { label: string; start: Date; end: Date }[] = [];
    for (let i = 7; i >= 0; i--) {
      const base = subWeeks(new Date(), i);
      weeks.push({
        label: format(startOfWeek(base, { weekStartsOn: 1 }), "MMM d"),
        start: startOfWeek(base, { weekStartsOn: 1 }),
        end: endOfWeek(base, { weekStartsOn: 1 }),
      });
    }
    return weeks.map((w) => ({
      label: w.label,
      revenue: data.appointments
        .filter((a) =>
          isWithinInterval(parseISO(a.start), { start: w.start, end: w.end })
        )
        .reduce((s, a) => s + appointmentRevenue(a), 0),
    }));
  }, [data.appointments]);

  const monthlyData = useMemo(() => {
    const months: { label: string; start: Date; end: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const base = subMonths(new Date(), i);
      months.push({
        label: format(startOfMonth(base), "MMM"),
        start: startOfMonth(base),
        end: endOfMonth(base),
      });
    }
    return months.map((m) => ({
      label: m.label,
      revenue: data.appointments
        .filter((a) =>
          isWithinInterval(parseISO(a.start), { start: m.start, end: m.end })
        )
        .reduce((s, a) => s + appointmentRevenue(a), 0),
    }));
  }, [data.appointments]);

  // Customer source breakdown (using leads data + repeat customers)
  const sourceData = useMemo(() => {
    const counts: Record<string, number> = {
      Facebook: 0,
      Referral: 0,
      Google: 0,
      Dealership: 0,
      Other: 0,
    };
    data.leads.filter((l) => l.status === "booked").forEach((l) => {
      const key = l.source.charAt(0).toUpperCase() + l.source.slice(1);
      counts[key] = (counts[key] ?? 0) + 1;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => ({ name: k, value: v }));
  }, [data.leads]);

  const COLORS = ["#1a5eef", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Revenue"
        description="How the business is performing."
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Total earned"
          value={formatCurrency(totalCompletedRev)}
          hint={`${completedJobs.length} completed jobs`}
          icon={<DollarSign className="h-4 w-4" />}
        />
        <Stat
          label="Upcoming est."
          value={formatCurrency(upcomingEst)}
          hint={`${upcomingJobs.length} on the books`}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <Stat
          label="Average job"
          value={formatCurrency(avgJob)}
          hint="From completed jobs"
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <Stat
          label="Add-on revenue"
          value={formatCurrency(addonRev)}
          hint="From upsells"
          icon={<Plus className="h-4 w-4" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue trend</CardTitle>
        </CardHeader>
        <CardContent>
          {data.appointments.length === 0 ? (
            <EmptyState
              title="No revenue recorded yet"
              description="Once you book and complete jobs, revenue trends will appear here."
            />
          ) : (
            <Tabs defaultValue="weekly">
              <TabsList>
                <TabsTrigger value="weekly">Weekly (last 8)</TabsTrigger>
                <TabsTrigger value="monthly">Monthly (last 6)</TabsTrigger>
              </TabsList>
              <TabsContent value="weekly">
                <ChartBox data={weeklyData} />
              </TabsContent>
              <TabsContent value="monthly">
                <ChartBox data={monthlyData} />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Best customer sources</CardTitle>
          </CardHeader>
          <CardContent>
            {sourceData.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No booked leads yet — once leads convert, you'll see source breakdown here.
              </p>
            ) : (
              <div className="h-64">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={sourceData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={(entry) => `${entry.name} (${entry.value})`}
                    >
                      {sourceData.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Job outcomes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row
              label="Completed"
              count={completedJobs.length}
              total={data.appointments.length}
              tone="positive"
            />
            <Row
              label="In progress / Confirmed"
              count={data.appointments.filter((a) =>
                ["confirmed", "in_progress", "scheduled"].includes(a.status)
              ).length}
              total={data.appointments.length}
              tone="neutral"
            />
            <Row
              label="Canceled"
              count={canceledJobs.length}
              total={data.appointments.length}
              tone="negative"
            />
            <Row
              label="Needs follow-up"
              count={data.appointments.filter((a) => a.status === "follow_up").length}
              total={data.appointments.length}
              tone="warn"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ChartBox({ data }: { data: { label: string; revenue: number }[] }) {
  return (
    <div className="h-72">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--accent))" }}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 12,
              fontSize: 12,
            }}
            formatter={(value: number) => [formatCurrency(value), "Revenue"]}
          />
          <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function Row({
  label,
  count,
  total,
  tone,
}: {
  label: string;
  count: number;
  total: number;
  tone: "positive" | "negative" | "warn" | "neutral";
}) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  const barClass =
    tone === "positive"
      ? "bg-emerald-500"
      : tone === "negative"
      ? "bg-rose-500"
      : tone === "warn"
      ? "bg-amber-500"
      : "bg-primary";
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {count} ({pct}%)
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
