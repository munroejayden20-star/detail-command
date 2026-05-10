import { useMemo, useState } from "react";
import { Calculator as CalcIcon, Copy, MessageSquare, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/ui/section-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ReachOutDialog, type ReachOutContact } from "@/components/contact/ReachOutDialog";
import { useStore } from "@/store/store";
import { cn, formatCurrency, vehicleStr } from "@/lib/utils";
import type { Service } from "@/lib/types";

type VehicleSize =
  | "small"
  | "sedan"
  | "coupe"
  | "truck"
  | "suv"
  | "large_suv"
  | "van"
  | "oversized";

type Condition = "light" | "normal" | "dirty" | "very_dirty" | "severe";

const VEHICLE_SIZES: { value: VehicleSize; label: string; mult: number }[] = [
  { value: "small", label: "Small car", mult: 0.9 },
  { value: "sedan", label: "Sedan", mult: 1.0 },
  { value: "coupe", label: "Coupe", mult: 1.0 },
  { value: "truck", label: "Truck", mult: 1.15 },
  { value: "suv", label: "SUV", mult: 1.15 },
  { value: "large_suv", label: "Large SUV / 3-row", mult: 1.3 },
  { value: "van", label: "Van / minivan", mult: 1.35 },
  { value: "oversized", label: "Oversized / custom", mult: 1.5 },
];

const CONDITIONS: { value: Condition; label: string; mult: number; timeMult: number }[] = [
  { value: "light", label: "Light", mult: 0.95, timeMult: 0.9 },
  { value: "normal", label: "Normal", mult: 1.0, timeMult: 1.0 },
  { value: "dirty", label: "Dirty", mult: 1.15, timeMult: 1.2 },
  { value: "very_dirty", label: "Very dirty", mult: 1.3, timeMult: 1.45 },
  { value: "severe", label: "Severe / restoration", mult: 1.6, timeMult: 1.8 },
];

function midPrice(s: Service): number {
  return (s.priceLow + s.priceHigh) / 2;
}

/** Comma-join with an Oxford "and" — "A", "A and B", or "A, B, and C". */
function listJoin(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function CalculatorPage() {
  const { data } = useStore();
  const packages = data.services.filter((s) => !s.isAddon);
  const addons = data.services.filter((s) => s.isAddon);

  const settings = data.settings;
  const depositConfigured =
    !!settings.bookingDepositsEnabled &&
    !!settings.bookingDepositAmountCents &&
    settings.bookingDepositAmountCents > 0;
  const depositAmount = (settings.bookingDepositAmountCents ?? 0) / 100;
  const depositAppliesToTotal = settings.bookingDepositAppliesToTotal !== false;

  const [packageId, setPackageId] = useState<string>(packages[0]?.id ?? "");
  const [vehicleSize, setVehicleSize] = useState<VehicleSize>("sedan");
  const [condition, setCondition] = useState<Condition>("normal");
  const [addonIds, setAddonIds] = useState<Set<string>>(new Set());
  const [travelFee, setTravelFee] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [customCharge, setCustomCharge] = useState<number>(0);
  const [customLabel, setCustomLabel] = useState<string>("");
  const [taxRate, setTaxRate] = useState<number>(0);
  const [customerId, setCustomerId] = useState<string>("");
  const [reachOpen, setReachOpen] = useState(false);
  const [applyDeposit, setApplyDeposit] = useState<boolean>(depositConfigured);

  const pkg = packages.find((p) => p.id === packageId);
  const vehMeta = VEHICLE_SIZES.find((v) => v.value === vehicleSize)!;
  const condMeta = CONDITIONS.find((c) => c.value === condition)!;

  const calc = useMemo(() => {
    const base = pkg ? midPrice(pkg) : 0;
    const vehicleAdj = base * (vehMeta.mult - 1);
    const conditionAdj = base * (condMeta.mult - 1);
    const addonsTotal = [...addonIds]
      .map((id) => addons.find((a) => a.id === id))
      .filter((a): a is Service => !!a)
      .reduce((s, a) => s + midPrice(a), 0);
    const subtotal =
      base + vehicleAdj + conditionAdj + addonsTotal + travelFee - discount + customCharge;
    const tax = (subtotal * taxRate) / 100;
    const total = subtotal + tax;

    const baseMinutes = pkg?.durationMinutes ?? 0;
    const addonMinutes = [...addonIds]
      .map((id) => addons.find((a) => a.id === id)?.durationMinutes ?? 0)
      .reduce((s, n) => s + n, 0);
    const estMinutes = Math.round(baseMinutes * condMeta.timeMult) + addonMinutes;

    const depositActive = applyDeposit && depositConfigured;
    const deposit = depositActive ? depositAmount : 0;
    const balanceDue = depositActive && depositAppliesToTotal
      ? Math.max(0, total - deposit)
      : total;

    return {
      base,
      vehicleAdj,
      conditionAdj,
      addonsTotal,
      subtotal,
      tax,
      total,
      estMinutes,
      depositActive,
      deposit,
      balanceDue,
    };
  }, [pkg, vehMeta, condMeta, addonIds, addons, travelFee, discount, customCharge, taxRate, applyDeposit, depositConfigured, depositAmount, depositAppliesToTotal]);

  function toggleAddon(id: string) {
    const next = new Set(addonIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setAddonIds(next);
  }

  function reset() {
    setPackageId(packages[0]?.id ?? "");
    setVehicleSize("sedan");
    setCondition("normal");
    setAddonIds(new Set());
    setTravelFee(0);
    setDiscount(0);
    setCustomCharge(0);
    setCustomLabel("");
    setTaxRate(0);
    setCustomerId("");
    setApplyDeposit(depositConfigured);
  }

  const summary = useMemo(() => {
    if (!pkg) return "Pick a service package above and your quote will show up here.";

    // Customer first name keeps the greeting natural ("Hey Sarah" vs "Hey Sarah Johnson")
    const summaryCustomer = customerId
      ? data.customers.find((c) => c.id === customerId)
      : null;
    const firstName = summaryCustomer?.name?.split(/\s+/)[0] ?? "";
    const greeting = firstName ? `Hey ${firstName}!` : "Hey!";

    // Owner name for sign-off, falling back to business name
    const owner =
      data.settings.ownerName ||
      data.settings.businessName ||
      "";

    const sizeLabel = vehMeta.label.toLowerCase();
    const condLabel = condMeta.label.toLowerCase();
    const addonNames = [...addonIds]
      .map((id) => addons.find((a) => a.id === id)?.name)
      .filter(Boolean) as string[];
    const hours = calc.estMinutes / 60;
    const hoursLabel =
      hours >= 1
        ? `about ${hours.toFixed(hours % 1 === 0 ? 0 : 1)} hr`
        : `around ${calc.estMinutes} min`;

    const lines: string[] = [];

    // Opening — friendly, with context about why this package
    lines.push(
      `${greeting} Thanks for reaching out — here's a quick quote for your ${sizeLabel}.`
    );
    lines.push("");
    lines.push(
      `Based on the ${condLabel} condition, I'd go with the ${pkg.name} — runs about ${formatCurrency(calc.total)} all in${
        addonNames.length
          ? ` (with the ${listJoin(addonNames)} add${addonNames.length === 1 ? "" : "s"} included)`
          : ""
      }. Plan on ${hoursLabel} on-site.`
    );

    // Deposit — softened from the original blunt "non-refundable" line
    if (calc.depositActive && calc.deposit > 0) {
      lines.push("");
      if (depositAppliesToTotal) {
        lines.push(
          `To lock in your spot it's a ${formatCurrency(calc.deposit)} deposit online — that comes off the total, so you'd owe ${formatCurrency(calc.balanceDue)} when I'm done.`
        );
      } else {
        lines.push(
          `To lock in your spot it's a ${formatCurrency(calc.deposit)} booking deposit online (separate from the detail price above).`
        );
      }
    }

    // Honest expectation-set
    lines.push("");
    lines.push(
      `Heads up — if the inside or outside is rougher than what we talked about, the price might bump a little once I see it in person. I'll always let you know before I start.`
    );

    // Sign-off
    lines.push("");
    lines.push(
      owner
        ? `Let me know what works and I'll get you on the books. — ${owner}`
        : `Let me know what works and I'll get you on the books.`
    );

    return lines.join("\n");
  }, [
    pkg,
    vehMeta,
    condMeta,
    addonIds,
    addons,
    calc,
    depositAppliesToTotal,
    customerId,
    data.customers,
    data.settings.ownerName,
    data.settings.businessName,
  ]);

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summary);
      toast.success("Quote summary copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  const customer = customerId ? data.customers.find((c) => c.id === customerId) : null;
  const reachContact: ReachOutContact = customer
    ? {
        name: customer.name,
        phone: customer.phone,
        email: customer.email ?? null,
        address: customer.address ?? null,
        vehicle: customer.vehicles[0] ? vehicleStr(customer.vehicles[0]) : null,
        followUpNotes: summary,
      }
    : { name: "Customer", followUpNotes: summary };

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Service Cost Calculator"
        description="Quick, accurate quotes — pick package + condition + add-ons and copy a clean summary."
        actions={
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="h-4 w-4" /> Reset
          </Button>
        }
      />

      {packages.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Add at least one service package on the{" "}
            <a href="/services" className="text-primary underline">
              Services page
            </a>{" "}
            before using the calculator.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          {/* Inputs */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalcIcon className="h-4 w-4" /> Job inputs
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Service package</Label>
                    <Select value={packageId} onValueChange={setPackageId}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {packages.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} · ${p.priceLow}
                            {p.priceHigh !== p.priceLow ? `–$${p.priceHigh}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Vehicle size</Label>
                    <Select
                      value={vehicleSize}
                      onValueChange={(v) => setVehicleSize(v as VehicleSize)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VEHICLE_SIZES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label} ({s.mult.toFixed(2)}×)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Condition</Label>
                    <Select
                      value={condition}
                      onValueChange={(v) => setCondition(v as Condition)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CONDITIONS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label} ({c.mult.toFixed(2)}×)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Save to customer (optional)</Label>
                    <Select value={customerId || "none"} onValueChange={(v) => setCustomerId(v === "none" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {data.customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {addons.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Add-ons</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-2 sm:grid-cols-2">
                  {addons.map((a) => {
                    const checked = addonIds.has(a.id);
                    return (
                      <label
                        key={a.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-md border p-3",
                          "transition-[border-color,background-color] duration-fast",
                          checked
                            ? "border-primary/30 bg-primary/5"
                            : "border-border/80 bg-card hover:bg-hover hover:border-border"
                        )}
                      >
                        <Checkbox checked={checked} onCheckedChange={() => toggleAddon(a.id)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight">{a.name}</p>
                          {a.description ? (
                            <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                              {a.description}
                            </p>
                          ) : null}
                        </div>
                        <span className="text-xs font-semibold tabular-nums">
                          +{formatCurrency(midPrice(a))}
                        </span>
                      </label>
                    );
                  })}
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Adjustments</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <NumField label="Travel fee" value={travelFee} onChange={setTravelFee} prefix="$" />
                <NumField label="Discount" value={discount} onChange={setDiscount} prefix="−$" />
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Custom charge</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Label (e.g. Engine bay degrease)"
                      value={customLabel}
                      onChange={(e) => setCustomLabel(e.target.value)}
                    />
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={customCharge || ""}
                      onChange={(e) => setCustomCharge(Number(e.target.value) || 0)}
                      className="w-32"
                    />
                  </div>
                </div>
                <NumField
                  label="Tax rate (%)"
                  value={taxRate}
                  onChange={setTaxRate}
                  step={0.1}
                />
                {depositConfigured ? (
                  <label className="sm:col-span-2 flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 hover:border-primary/40">
                    <Checkbox
                      checked={applyDeposit}
                      onCheckedChange={(v) => setApplyDeposit(!!v)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        Online deposit applies ({formatCurrency(depositAmount)})
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {depositAppliesToTotal
                          ? "Subtracts the deposit from the balance due at the job."
                          : "Shows the deposit as a separate non-refundable booking fee."}
                      </p>
                    </div>
                  </label>
                ) : null}
              </CardContent>
            </Card>
          </div>

          {/* Quote panel */}
          <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <Card>
              <CardHeader>
                <CardTitle>Quote breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <Row label="Base price" value={calc.base} />
                <Row label={`Vehicle (${vehMeta.mult.toFixed(2)}×)`} value={calc.vehicleAdj} muted />
                <Row label={`Condition (${condMeta.mult.toFixed(2)}×)`} value={calc.conditionAdj} muted />
                {calc.addonsTotal > 0 ? <Row label="Add-ons" value={calc.addonsTotal} /> : null}
                {travelFee > 0 ? <Row label="Travel fee" value={travelFee} /> : null}
                {discount > 0 ? <Row label="Discount" value={-discount} /> : null}
                {customCharge > 0 ? (
                  <Row label={customLabel || "Custom charge"} value={customCharge} />
                ) : null}
                <div className="border-t pt-1.5">
                  <Row label="Subtotal" value={calc.subtotal} bold />
                </div>
                {taxRate > 0 ? <Row label={`Tax (${taxRate}%)`} value={calc.tax} muted /> : null}
                <div className="rounded-md border border-primary/20 bg-primary/10 px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Estimated total
                    </span>
                    <span className="text-3xl font-semibold tracking-tight text-primary tabular-nums">
                      {formatCurrency(calc.total)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground tabular-nums">
                    ~{(calc.estMinutes / 60).toFixed(1)} hr ({calc.estMinutes} min) on the job
                  </p>
                </div>
                {calc.depositActive && calc.deposit > 0 ? (
                  <div className="space-y-1 pt-1">
                    <Row
                      label="Online deposit (paid)"
                      value={depositAppliesToTotal ? -calc.deposit : calc.deposit}
                      muted
                    />
                    {depositAppliesToTotal ? (
                      <div className="rounded-lg bg-emerald-500/10 px-3 py-2 border border-emerald-500/30">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                            Balance due at job
                          </span>
                          <span className="text-xl font-bold text-emerald-700 dark:text-emerald-400">
                            {formatCurrency(calc.balanceDue)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        Deposit is a separate non-refundable booking fee — not deducted from the total.
                      </p>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quote summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea readOnly rows={11} value={summary} className="text-xs leading-relaxed" />
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={copySummary}>
                    <Copy className="h-4 w-4" /> Copy
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setReachOpen(true)}
                    disabled={!pkg}
                  >
                    <MessageSquare className="h-4 w-4" /> Send via Reach Out
                  </Button>
                </div>
                {customer ? (
                  <Badge variant="outline" className="text-[11px]">
                    For {customer.name}
                  </Badge>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Pick a customer above to pre-fill their contact info.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <ReachOutDialog
        open={reachOpen}
        onOpenChange={setReachOpen}
        contact={reachContact}
      />
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  prefix,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  step?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {prefix}
          </span>
        ) : null}
        <Input
          type="number"
          min="0"
          step={step}
          value={value || ""}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className={prefix ? "pl-9" : ""}
        />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  bold,
}: {
  label: string;
  value: number;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between py-1",
        muted && "text-muted-foreground",
        bold && "font-semibold"
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums">
        {value < 0 ? "−" : ""}
        {formatCurrency(Math.abs(value))}
      </span>
    </div>
  );
}
