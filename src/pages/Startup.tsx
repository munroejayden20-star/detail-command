import { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Stat } from "@/components/ui/stat";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SectionHeader } from "@/components/ui/section-header";
import { useStore, makeId } from "@/store/store";
import type { StartupItem } from "@/lib/types";
import { appointmentRevenue, totalExpenses } from "@/lib/selectors";
import { cn, formatCurrency } from "@/lib/utils";

export function StartupPage() {
  const { data, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StartupItem | undefined>();

  const totalBudget = data.startup.reduce((s, i) => s + i.budget, 0);
  const totalSpent = data.startup.reduce((s, i) => s + i.spent, 0);
  const remaining = totalBudget - totalSpent;
  const goal = data.settings.startupGoal;

  const completedRev = data.appointments
    .filter((a) => a.status === "completed")
    .reduce((s, a) => s + appointmentRevenue(a), 0);
  const expenses = totalExpenses(data);
  const profit = completedRev - expenses;
  const breakEvenPct = Math.min(100, Math.max(0, (profit / goal) * 100));

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Startup costs"
        description="Track every gear purchase and watch your break-even progress."
        actions={
          <Button onClick={() => { setEditing(undefined); setOpen(true); }}>
            <Plus className="h-4 w-4" /> Add item
          </Button>
        }
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat label="Total budget" value={formatCurrency(totalBudget)} icon={<Wrench className="h-4 w-4" />} />
        <Stat label="Total spent" value={formatCurrency(totalSpent)} hint={`${data.startup.filter((i) => i.purchased).length}/${data.startup.length} purchased`} />
        <Stat label="Budget remaining" value={formatCurrency(remaining)} trend={remaining >= 0 ? "up" : "down"} />
        <Stat
          label="Break-even progress"
          value={`${Math.round(breakEvenPct)}%`}
          hint={`${formatCurrency(profit)} / ${formatCurrency(goal)} goal`}
          trend={breakEvenPct >= 50 ? "up" : "neutral"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Break-even tracker</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Net profit toward {formatCurrency(goal)} goal
              </span>
              <span className="font-semibold">{formatCurrency(profit)}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  breakEvenPct >= 100
                    ? "bg-emerald-500"
                    : breakEvenPct >= 50
                    ? "bg-primary"
                    : "bg-amber-500"
                )}
                style={{ width: `${breakEvenPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {breakEvenPct >= 100
                ? "🎉 Broken even — every job after this is real profit."
                : `Need ${formatCurrency(goal - profit)} more in profit to break even.`}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Equipment & supplies</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.startup.length === 0 ? (
            <p className="text-sm text-muted-foreground">No startup items yet.</p>
          ) : (
            data.startup.map((it) => {
              const pct = Math.min(100, (it.spent / Math.max(1, it.budget)) * 100);
              return (
                <div
                  key={it.id}
                  className="group rounded-lg border bg-card p-3 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{it.name}</p>
                        {it.purchased ? (
                          <Badge variant="soft">Purchased</Badge>
                        ) : (
                          <Badge variant="outline">Not yet</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Budget {formatCurrency(it.budget)} · Spent {formatCurrency(it.spent)}
                        {it.notes ? ` · ${it.notes}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditing(it);
                          setOpen(true);
                        }}
                        className="rounded-md p-1 text-muted-foreground hover:bg-accent"
                        aria-label="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Delete "${it.name}"?`))
                            dispatch({ type: "deleteStartup", id: it.id });
                        }}
                        className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        it.purchased ? "bg-emerald-500" : "bg-primary"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <StartupDialog open={open} onOpenChange={setOpen} item={editing} />
    </div>
  );
}

function StartupDialog({
  open,
  onOpenChange,
  item,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item?: StartupItem;
}) {
  const { dispatch } = useStore();
  const [form, setForm] = useState<StartupItem>(() =>
    item ?? { id: makeId(), name: "", budget: 0, spent: 0, purchased: false }
  );

  useEffect(() => {
    if (open) {
      setForm(item ?? { id: makeId(), name: "", budget: 0, spent: 0, purchased: false });
    }
  }, [open, item]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (item) dispatch({ type: "updateStartup", id: item.id, patch: form });
    else dispatch({ type: "addStartup", item: form });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? "Edit item" : "New startup item"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="iname">Name</Label>
            <Input
              id="iname"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ibudget">Budget</Label>
              <Input
                id="ibudget"
                type="number"
                min="0"
                step="0.01"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ispent">Spent</Label>
              <Input
                id="ispent"
                type="number"
                min="0"
                step="0.01"
                value={form.spent}
                onChange={(e) => setForm({ ...form, spent: Number(e.target.value) })}
              />
            </div>
          </div>
          <label className="flex items-center justify-between rounded-lg border p-3 text-sm">
            <span className="font-medium">Purchased</span>
            <Switch
              checked={form.purchased}
              onCheckedChange={(v) => setForm({ ...form, purchased: v })}
            />
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="inotes">Notes</Label>
            <Textarea
              id="inotes"
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{item ? "Save" : "Add item"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
