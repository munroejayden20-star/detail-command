import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  Wallet,
  ExternalLink,
  Search,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Stat } from "@/components/ui/stat";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionHeader } from "@/components/ui/section-header";
import { useStore, makeId } from "@/store/store";
import {
  PURCHASE_CATEGORIES,
  PURCHASE_STATUSES,
  type PurchaseCategory,
  type PurchaseStatus,
  type StartupItem,
  type Priority,
} from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

type StatusFilter = "all" | PurchaseStatus;

function planned(i: StartupItem): number {
  return i.budget || 0;
}
function paid(i: StartupItem): number {
  if (i.actualCost != null) return i.actualCost;
  return i.spent || 0;
}

export function StartupPage() {
  const { data, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StartupItem | undefined>();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");

  const items = data.startup;

  const totals = useMemo(() => {
    const totalPlanned = items.reduce((s, i) => s + planned(i), 0);
    const totalPaid = items.reduce(
      (s, i) => s + (i.purchased || i.status === "purchased" ? paid(i) : 0),
      0
    );
    const remaining = totalPlanned - totalPaid;
    const purchasedCount = items.filter(
      (i) => i.purchased || i.status === "purchased"
    ).length;
    return { totalPlanned, totalPaid, remaining, purchasedCount };
  }, [items]);

  const goal = data.settings.startupGoal;
  const budgetPct = goal > 0 ? Math.min(100, (totals.totalPaid / goal) * 100) : 0;

  const filtered = useMemo(() => {
    let list = [...items];
    if (filter !== "all") {
      list = list.filter(
        (i) =>
          (i.status ?? (i.purchased ? "purchased" : "want")) === filter
      );
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.notes ?? "").toLowerCase().includes(q)
      );
    }
    // Sort: purchased last, then by priority (high → low), then planned cost desc
    const priorityRank = { high: 0, medium: 1, low: 2 } as const;
    return list.sort((a, b) => {
      const aDone = a.purchased || a.status === "purchased";
      const bDone = b.purchased || b.status === "purchased";
      if (aDone !== bDone) return aDone ? 1 : -1;
      const ap = priorityRank[(a.priority ?? "medium") as Priority];
      const bp = priorityRank[(b.priority ?? "medium") as Priority];
      if (ap !== bp) return ap - bp;
      return planned(b) - planned(a);
    });
  }, [items, filter, query]);

  const nextRecommended = useMemo(() => {
    return filtered.find(
      (i) =>
        !(i.purchased || i.status === "purchased") &&
        (i.priority ?? "medium") !== "low"
    );
  }, [filtered]);

  const counts = useMemo(() => {
    const m = new Map<StatusFilter, number>();
    m.set("all", items.length);
    PURCHASE_STATUSES.forEach((s) => m.set(s.value, 0));
    items.forEach((i) => {
      const st = (i.status ?? (i.purchased ? "purchased" : "want")) as PurchaseStatus;
      m.set(st, (m.get(st) ?? 0) + 1);
    });
    return m;
  }, [items]);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Budget & Purchases"
        description="Plan equipment, products, and upgrades — track what's bought, what you're saving for, and what's next."
        actions={
          <Button
            onClick={() => {
              setEditing(undefined);
              setOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add purchase
          </Button>
        }
      />

      {/* Stat row */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Total planned"
          value={formatCurrency(totals.totalPlanned)}
          icon={<Wallet className="h-4 w-4" />}
          hint={`${items.length} item${items.length === 1 ? "" : "s"}`}
        />
        <Stat
          label="Already purchased"
          value={formatCurrency(totals.totalPaid)}
          hint={`${totals.purchasedCount}/${items.length} items`}
          trend={totals.purchasedCount > 0 ? "up" : "neutral"}
        />
        <Stat
          label="Remaining to buy"
          value={formatCurrency(Math.max(0, totals.remaining))}
          trend={totals.remaining > 0 ? "down" : "up"}
        />
        <Stat
          label="Toward $2k goal"
          value={`${Math.round(budgetPct)}%`}
          hint={`${formatCurrency(totals.totalPaid)} / ${formatCurrency(goal)}`}
          trend={budgetPct >= 50 ? "up" : "neutral"}
        />
      </div>

      {/* Goal progress + next recommended */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Starter budget progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Spent toward {formatCurrency(goal)} starter budget
              </span>
              <span className="font-semibold">
                {formatCurrency(totals.totalPaid)}
              </span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  budgetPct >= 100
                    ? "bg-emerald-500"
                    : budgetPct >= 50
                    ? "bg-primary"
                    : "bg-amber-500"
                )}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {budgetPct >= 100
                ? "🎉 Starter budget hit. Future purchases are upgrades."
                : `${formatCurrency(Math.max(0, goal - totals.totalPaid))} of starter budget left.`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="h-4 w-4" /> Next recommended
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nextRecommended ? (
              <div>
                <p className="font-semibold">{nextRecommended.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {priorityLabel(nextRecommended.priority)} priority ·{" "}
                  {formatCurrency(planned(nextRecommended))} planned
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3"
                  onClick={() => {
                    setEditing(nextRecommended);
                    setOpen(true);
                  }}
                >
                  Open
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nothing flagged as high or medium priority.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search + status filter */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or notes…"
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            active={filter === "all"}
            label={`All (${counts.get("all") ?? 0})`}
            onClick={() => setFilter("all")}
          />
          {PURCHASE_STATUSES.map((s) => {
            const n = counts.get(s.value) ?? 0;
            if (n === 0 && filter !== s.value) return null;
            return (
              <FilterChip
                key={s.value}
                active={filter === s.value}
                label={`${s.label} (${n})`}
                onClick={() => setFilter(s.value)}
              />
            );
          })}
          {(query || filter !== "all") && (
            <button
              onClick={() => {
                setQuery("");
                setFilter("all");
              }}
              className="rounded-full border border-dashed border-border px-3 py-1 text-xs text-muted-foreground hover:bg-accent"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Planned purchases</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 ? (
            <EmptyState
              title="No purchases yet"
              description="Add the first thing you want to buy — pressure washer, towels, chemicals, anything."
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(undefined);
                    setOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" /> Add purchase
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing matches the current filter.
            </p>
          ) : (
            filtered.map((it) => (
              <PurchaseRow
                key={it.id}
                item={it}
                onEdit={() => {
                  setEditing(it);
                  setOpen(true);
                }}
                onDelete={() => {
                  if (window.confirm(`Delete "${it.name}"?`)) {
                    dispatch({ type: "deleteStartup", id: it.id });
                    toast.success("Purchase removed");
                  }
                }}
              />
            ))
          )}
        </CardContent>
      </Card>

      <PurchaseDialog open={open} onOpenChange={setOpen} item={editing} />
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:bg-accent"
      )}
    >
      {label}
    </button>
  );
}

function PurchaseRow({
  item,
  onEdit,
  onDelete,
}: {
  item: StartupItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isPurchased = item.purchased || item.status === "purchased";
  const status =
    PURCHASE_STATUSES.find(
      (s) => s.value === (item.status ?? (item.purchased ? "purchased" : "want"))
    ) ?? PURCHASE_STATUSES[0];
  const cat = PURCHASE_CATEGORIES.find((c) => c.value === item.category);

  const plannedAmt = planned(item);
  const paidAmt = paid(item);
  const pct = plannedAmt > 0 ? Math.min(100, (paidAmt / plannedAmt) * 100) : 0;

  return (
    <div className="group rounded-lg border bg-card p-3 transition-colors hover:border-primary/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p
              className={cn(
                "font-medium",
                isPurchased && "text-muted-foreground"
              )}
            >
              {item.name}
            </p>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-medium",
                status.tone
              )}
            >
              {status.label}
            </span>
            {item.priority === "high" && !isPurchased ? (
              <Badge variant="soft" className="text-[10px]">
                High priority
              </Badge>
            ) : null}
            {cat ? (
              <Badge variant="outline" className="text-[10px]">
                {cat.label}
              </Badge>
            ) : null}
            {item.link ? (
              <a
                href={item.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 text-[10px] text-primary underline"
              >
                <ExternalLink className="h-3 w-3" /> link
              </a>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Planned {formatCurrency(plannedAmt)}
            {paidAmt > 0 ? ` · Paid ${formatCurrency(paidAmt)}` : ""}
            {item.targetDate ? ` · target ${item.targetDate.slice(0, 10)}` : ""}
            {item.notes ? ` · ${item.notes}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={onEdit}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
            aria-label="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
            aria-label="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {plannedAmt > 0 ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full",
              isPurchased ? "bg-emerald-500" : "bg-primary"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function priorityLabel(p?: Priority): string {
  if (p === "high") return "High";
  if (p === "low") return "Low";
  return "Medium";
}

function PurchaseDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item?: StartupItem;
}) {
  const { dispatch } = useStore();
  const blank = (): StartupItem => ({
    id: makeId(),
    name: "",
    budget: 0,
    spent: 0,
    purchased: false,
    category: "misc",
    priority: "medium",
    status: "want",
  });
  const [form, setForm] = useState<StartupItem>(item ?? blank());

  useEffect(() => {
    if (open) setForm(item ?? blank());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Give it a name first");
      return;
    }
    // Sync purchased flag with status to keep both consistent
    const purchased = form.status === "purchased";
    const next = { ...form, purchased };
    if (item) {
      dispatch({ type: "updateStartup", id: item.id, patch: next });
      toast.success("Saved");
    } else {
      dispatch({ type: "addStartup", item: next });
      toast.success("Purchase added");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {item ? "Edit purchase" : "New planned purchase"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Name</Label>
            <Input
              id="p-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.category ?? "misc"}
                onValueChange={(v) =>
                  setForm({ ...form, category: v as PurchaseCategory })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PURCHASE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status ?? "want"}
                onValueChange={(v) =>
                  setForm({ ...form, status: v as PurchaseStatus })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PURCHASE_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={form.priority ?? "medium"}
                onValueChange={(v) =>
                  setForm({ ...form, priority: v as Priority })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-target">Target purchase date</Label>
              <Input
                id="p-target"
                type="date"
                value={form.targetDate ? form.targetDate.slice(0, 10) : ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    targetDate: e.target.value
                      ? new Date(e.target.value).toISOString()
                      : undefined,
                  })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-budget">Estimated cost</Label>
              <Input
                id="p-budget"
                type="number"
                min="0"
                step="1"
                value={form.budget || ""}
                onChange={(e) =>
                  setForm({ ...form, budget: Number(e.target.value) || 0 })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-actual">Actual cost (when purchased)</Label>
              <Input
                id="p-actual"
                type="number"
                min="0"
                step="1"
                value={form.actualCost ?? ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    actualCost: e.target.value
                      ? Number(e.target.value)
                      : undefined,
                    // Mirror into spent so the legacy column is also populated
                    spent: e.target.value ? Number(e.target.value) : form.spent,
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-link">Product link (optional)</Label>
            <Input
              id="p-link"
              type="url"
              value={form.link ?? ""}
              onChange={(e) => setForm({ ...form, link: e.target.value })}
              placeholder="https://…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-notes">Notes</Label>
            <Textarea
              id="p-notes"
              rows={2}
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <label className="flex items-center justify-between rounded-lg border p-3 text-sm">
            <span className="font-medium">Mark as purchased</span>
            <Switch
              checked={form.status === "purchased"}
              onCheckedChange={(v) =>
                setForm({ ...form, status: v ? "purchased" : "want" })
              }
            />
          </label>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">{item ? "Save" : "Add purchase"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
