import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import {
  Plus,
  Trash2,
  Pencil,
  Car,
  Briefcase,
  Wallet,
  Route as RouteIcon,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Stat } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SectionHeader } from "@/components/ui/section-header";
import { EmptyState } from "@/components/ui/empty-state";
import { useStore, makeId } from "@/store/store";
import type { MileageEntry } from "@/lib/types";
import {
  buildPeriod,
  aggregateMileage,
  IRS_MILEAGE_RATE_CENTS_PER_MILE,
  type TaxPeriodKey,
} from "@/lib/tax-center";
import { formatCents } from "@/lib/receipts";

type ScopeFilter = "all" | "business" | "personal";

export function MileagePage() {
  const { data, commit } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MileageEntry | undefined>();
  const [periodKey, setPeriodKey] = useState<TaxPeriodKey>("this_year");
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [searchParams, setSearchParams] = useSearchParams();

  // Open the edit dialog when a trip id is passed in the URL (from search palette)
  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) return;
    const found = (data.mileageEntries ?? []).find((m) => m.id === id);
    if (found) {
      setEditing(found);
      setOpen(true);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("id");
    setSearchParams(next, { replace: true });
  }, [searchParams, data.mileageEntries, setSearchParams]);

  const period = useMemo(() => buildPeriod(periodKey), [periodKey]);
  const entries = data.mileageEntries ?? [];

  const agg = useMemo(() => aggregateMileage(entries, period), [entries, period]);

  const visible = useMemo(() => {
    const inPeriod = entries.filter((m) => {
      if (period.start === null && period.end === null) return true;
      const t = parseISO(m.entryDate).getTime();
      if (period.start && t < period.start.getTime()) return false;
      if (period.end && t > period.end.getTime()) return false;
      return true;
    });
    const filtered =
      scope === "all"
        ? inPeriod
        : scope === "business"
        ? inPeriod.filter((m) => m.isBusiness)
        : inPeriod.filter((m) => !m.isBusiness);
    return filtered.sort((a, b) => b.entryDate.localeCompare(a.entryDate));
  }, [entries, period, scope]);

  const periodRangeLabel =
    period.start && period.end
      ? `${format(period.start, "MMM d, yyyy")} – ${format(period.end, "MMM d, yyyy")}`
      : "All time";

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Mileage"
        description="Log business and personal trips. Business miles are auto-totaled and deducted in the Tax Center."
        actions={
          <Button
            onClick={() => {
              setEditing(undefined);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Log trip
          </Button>
        }
      />

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
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">{periodRangeLabel}</span>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
        <Stat
          label="Business miles"
          value={agg.businessMiles.toFixed(1)}
          icon={<Briefcase className="h-4 w-4" />}
          hint={`${agg.tripsCount} trip${agg.tripsCount === 1 ? "" : "s"} this period`}
        />
        <Stat
          label="Personal miles"
          value={agg.personalMiles.toFixed(1)}
          icon={<Car className="h-4 w-4" />}
        />
        <Stat
          label="Tax deduction"
          value={formatCents(agg.deductionCents)}
          icon={<Wallet className="h-4 w-4" />}
          hint={`@ ${IRS_MILEAGE_RATE_CENTS_PER_MILE}¢ / mile (IRS standard)`}
          trend="up"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Filter
        </span>
        {(["all", "business", "personal"] as ScopeFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setScope(s)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              scope === s
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-accent"
            }`}
          >
            {s === "all" ? "All" : s === "business" ? "Business" : "Personal"}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trip log</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {visible.length === 0 ? (
            <EmptyState
              title="No trips logged yet"
              description="Log every business trip to maximize your standard-mileage deduction at tax time."
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(undefined);
                    setOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" /> Log your first trip
                </Button>
              }
            />
          ) : (
            visible.map((m) => (
              <div
                key={m.id}
                className="group flex items-center gap-3 rounded-lg border bg-card p-3 hover:border-primary/40 transition-colors"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    m.isBusiness
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {m.isBusiness ? (
                    <Briefcase className="h-4 w-4" />
                  ) : (
                    <Car className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{m.miles.toFixed(1)} mi</p>
                    <Badge variant={m.isBusiness ? "default" : "outline"}>
                      {m.isBusiness ? "Business" : "Personal"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground truncate">
                    {format(parseISO(m.entryDate), "MMM d, yyyy")}
                    {m.startLocation || m.destination
                      ? ` · ${[m.startLocation, m.destination].filter(Boolean).join(" → ")}`
                      : ""}
                    {m.purpose ? ` · ${m.purpose}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => {
                      setEditing(m);
                      setOpen(true);
                    }}
                    className="rounded-md p-1 text-muted-foreground hover:bg-accent"
                    aria-label="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={async () => {
                      if (window.confirm("Delete this trip?"))
                        await commit({ type: "deleteMileage", id: m.id });
                    }}
                    className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground">
        <RouteIcon className="mr-1 inline h-3 w-3" />
        Tax deduction uses the IRS standard mileage rate. Update the constant in{" "}
        <code>src/lib/tax-center.ts</code> when the IRS publishes the new annual rate.
      </p>

      <MileageDialog open={open} onOpenChange={setOpen} entry={editing} />
    </div>
  );
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function blankEntry(): MileageEntry {
  const now = new Date().toISOString();
  return {
    id: makeId(),
    entryDate: todayISO(),
    miles: 0,
    isBusiness: true,
    createdAt: now,
    updatedAt: now,
  };
}

function MileageDialog({
  open,
  onOpenChange,
  entry,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entry?: MileageEntry;
}) {
  const { data, commit } = useStore();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<MileageEntry>(() => entry ?? blankEntry());

  useEffect(() => {
    if (open) {
      setForm(entry ?? blankEntry());
    }
  }, [open, entry]);

  const odoStart = form.odometerStart;
  const odoEnd = form.odometerEnd;
  const computedMiles =
    odoStart != null && odoEnd != null && odoEnd >= odoStart ? odoEnd - odoStart : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    const miles =
      computedMiles != null && (form.miles === 0 || form.miles == null)
        ? computedMiles
        : form.miles;
    const payload: MileageEntry = {
      ...form,
      miles: Number(miles) || 0,
      updatedAt: new Date().toISOString(),
    };
    setSaving(true);
    const r = entry
      ? await commit({ type: "updateMileage", id: entry.id, patch: payload })
      : await commit({ type: "addMileage", entry: payload });
    setSaving(false);
    if (r.ok) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{entry ? "Edit trip" : "Log trip"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-date">Date</Label>
              <Input
                id="m-date"
                type="date"
                value={form.entryDate}
                onChange={(e) => setForm({ ...form, entryDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-miles">Miles</Label>
              <Input
                id="m-miles"
                type="number"
                step="0.1"
                min="0"
                value={form.miles || ""}
                onChange={(e) => setForm({ ...form, miles: Number(e.target.value) })}
                placeholder={computedMiles != null ? `${computedMiles.toFixed(1)} (auto)` : "0"}
                required={computedMiles == null}
              />
            </div>
          </div>

          <label className="flex items-center justify-between rounded-lg border bg-card p-3">
            <div>
              <p className="text-sm font-medium">Business trip</p>
              <p className="text-xs text-muted-foreground">
                Counts toward your tax deduction
              </p>
            </div>
            <input
              type="checkbox"
              checked={form.isBusiness}
              onChange={(e) => setForm({ ...form, isBusiness: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-from">From</Label>
              <Input
                id="m-from"
                value={form.startLocation ?? ""}
                onChange={(e) => setForm({ ...form, startLocation: e.target.value })}
                placeholder="Home"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-to">To</Label>
              <Input
                id="m-to"
                value={form.destination ?? ""}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
                placeholder="Customer"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Customer (optional)</Label>
            <Select
              value={form.customerId ?? "none"}
              onValueChange={(v) =>
                setForm({ ...form, customerId: v === "none" ? undefined : v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="No customer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No customer</SelectItem>
                {data.customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-odo-start">Odometer start</Label>
              <Input
                id="m-odo-start"
                type="number"
                step="0.1"
                min="0"
                value={form.odometerStart ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    odometerStart: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-odo-end">Odometer end</Label>
              <Input
                id="m-odo-end"
                type="number"
                step="0.1"
                min="0"
                value={form.odometerEnd ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    odometerEnd: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="m-purpose">Purpose</Label>
            <Input
              id="m-purpose"
              value={form.purpose ?? ""}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              placeholder="Job, supply run…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="m-notes">Notes</Label>
            <Textarea
              id="m-notes"
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional…"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : entry ? "Save" : "Log trip"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
