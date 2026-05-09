import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  PiggyBank,
  Receipt as ReceiptIcon,
  Calculator,
  FileBarChart2,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useStore } from "@/store/store";
import { buildPeriod, aggregate, type TaxPeriodKey } from "@/lib/tax-center";
import { formatCents, RECEIPT_DISCLAIMER } from "@/lib/receipts";
import { cn } from "@/lib/utils";

export function TaxCenterPage() {
  const { data } = useStore();
  const [periodKey, setPeriodKey] = useState<TaxPeriodKey>("this_year");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  const period = useMemo(() => {
    if (periodKey === "custom" && customStart && customEnd) {
      return buildPeriod("custom", {
        start: new Date(customStart),
        end: new Date(customEnd + "T23:59:59"),
      });
    }
    return buildPeriod(periodKey);
  }, [periodKey, customStart, customEnd]);

  const setAsidePercent = data.settings.taxSetAsidePercent ?? 25;

  const agg = useMemo(
    () => aggregate(data.receipts ?? [], data.expenses ?? [], period, setAsidePercent),
    [data.receipts, data.expenses, period, setAsidePercent]
  );

  const periodRangeLabel =
    period.start && period.end
      ? `${format(period.start, "MMM d, yyyy")} – ${format(period.end, "MMM d, yyyy")}`
      : "All time";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <FileBarChart2 className="h-6 w-6 text-primary" /> Tax Center
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {periodRangeLabel}
            {data.settings.taxBusinessState ? ` · ${data.settings.taxBusinessState}` : ""}
          </p>
        </div>
      </div>

      {/* Period filter */}
      <div className="flex flex-wrap items-center gap-2">
        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
        <Select value={periodKey} onValueChange={(v) => setPeriodKey(v as TaxPeriodKey)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this_week">This week</SelectItem>
            <SelectItem value="this_month">This month</SelectItem>
            <SelectItem value="this_quarter">This quarter</SelectItem>
            <SelectItem value="this_year">This year</SelectItem>
            <SelectItem value="all">All time</SelectItem>
            <SelectItem value="custom">Custom range</SelectItem>
          </SelectContent>
        </Select>
        {periodKey === "custom" ? (
          <>
            <Input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="w-auto"
            />
            <Input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="w-auto"
            />
          </>
        ) : null}
      </div>

      {/* Hero stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={TrendingUp}
          label="Gross revenue"
          value={formatCents(agg.grossRevenueCents)}
          tone="emerald"
          hint="Money collected from active receipts"
        />
        <StatCard
          icon={TrendingDown}
          label="Total expenses"
          value={formatCents(agg.totalExpensesCents)}
          tone="rose"
        />
        <StatCard
          icon={Calculator}
          label="Estimated net profit"
          value={formatCents(agg.netProfitCents)}
          tone="primary"
          hint="Revenue − sales tax − expenses"
        />
        <StatCard
          icon={PiggyBank}
          label={`Set-aside (${agg.setAsidePercent}%)`}
          value={formatCents(agg.setAsideCents)}
          hint="Suggested to set aside for taxes"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={ReceiptIcon}
          label="Receipts"
          value={String(agg.receiptsCount)}
          hint={agg.averageReceiptCents > 0 ? `Avg ${formatCents(agg.averageReceiptCents)}` : undefined}
        />
        <StatCard
          icon={Wallet}
          label="Sales tax collected"
          value={formatCents(agg.salesTaxCollectedCents)}
          hint={data.settings.salesTaxEnabled ? `Rate ${data.settings.defaultTaxRate ?? 0}%` : "Not enabled"}
        />
        <StatCard
          icon={AlertTriangle}
          label="Outstanding"
          value={formatCents(agg.outstandingCents)}
          tone={agg.outstandingCents > 0 ? "amber" : undefined}
          hint="Unpaid balances on receipts"
        />
        <StatCard
          icon={Calculator}
          label="Avg receipt"
          value={formatCents(agg.averageReceiptCents)}
        />
      </div>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">How these numbers are calculated</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong>Gross revenue</strong> sums the <em>amount paid</em> on active
            (non-voided) receipts created within the selected period. Outstanding
            balances are tracked separately.
          </p>
          <p>
            <strong>Sales tax collected</strong> is what you charged customers on top
            of the subtotal — this is held on behalf of the taxing authority, not
            income.
          </p>
          <p>
            <strong>Estimated net profit</strong> ≈ gross revenue − sales tax
            collected − business expenses. This is a rough indicator only.
          </p>
          <p>
            <strong>Set-aside</strong> applies your set-aside percentage (configured
            in Settings → Receipts &amp; Tax) to the estimated net profit.
          </p>
          <p className="pt-2 text-[11px]">{RECEIPT_DISCLAIMER}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  tone?: "emerald" | "rose" | "amber" | "primary";
}) {
  const toneClass =
    tone === "emerald"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "rose"
      ? "text-rose-600 dark:text-rose-400"
      : tone === "amber"
      ? "text-amber-600 dark:text-amber-400"
      : tone === "primary"
      ? "text-primary"
      : "";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          <p className="text-[11px] uppercase tracking-wider">{label}</p>
        </div>
        <p className={cn("mt-1 text-2xl font-semibold tracking-tight", toneClass)}>{value}</p>
        {hint ? <p className="mt-0.5 text-[11px] text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
