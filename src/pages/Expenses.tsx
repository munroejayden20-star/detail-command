import { useState, useEffect, useMemo } from "react";
import { format, formatISO, parseISO } from "date-fns";
import { Plus, Trash2, Pencil } from "lucide-react";
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
import {
  EXPENSE_CATEGORIES,
  type Expense,
  type ExpenseCategory,
} from "@/lib/types";
import { appointmentRevenue, totalExpenses, signedExpenseAmount } from "@/lib/selectors";
import { formatCurrency, formatCurrencyExact } from "@/lib/utils";

export function ExpensesPage() {
  const { data, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | undefined>();

  const total = totalExpenses(data);
  const completed = data.appointments.filter((a) => a.status === "completed");
  const revenue = completed.reduce((s, a) => s + appointmentRevenue(a), 0);
  const profit = revenue - total;
  const totalCredits = data.expenses
    .filter((e) => e.kind === "credit")
    .reduce((s, e) => s + e.amount, 0);

  const byCat = useMemo(() => {
    const map = new Map<ExpenseCategory, number>();
    EXPENSE_CATEGORIES.forEach((c) => map.set(c.value, 0));
    data.expenses.forEach((e) =>
      map.set(e.category, (map.get(e.category) ?? 0) + signedExpenseAmount(e))
    );
    return map;
  }, [data.expenses]);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Expenses"
        description="Track every dollar going out — products, gas, equipment, marketing."
        actions={
          <Button onClick={() => { setEditing(undefined); setOpen(true); }}>
            <Plus className="h-4 w-4" /> Add expense
          </Button>
        }
      />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Net expenses"
          value={formatCurrency(total)}
          hint={
            totalCredits > 0
              ? `After ${formatCurrency(totalCredits)} in credits`
              : `${data.expenses.length} entries`
          }
        />
        <Stat label="Revenue earned" value={formatCurrency(revenue)} hint={`${completed.length} completed jobs`} />
        <Stat label="Net profit" value={formatCurrency(profit)} trend={profit >= 0 ? "up" : "down"} hint={profit >= 0 ? "In the green" : "Behind right now"} />
        <Stat
          label="Toward $2k goal"
          value={`${Math.min(100, Math.max(0, Math.round((profit / data.settings.startupGoal) * 100)))}%`}
          hint={`Goal: ${formatCurrency(data.settings.startupGoal)}`}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By category</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {EXPENSE_CATEGORIES.map((c) => (
            <div key={c.value} className="rounded-lg border p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {c.label}
              </p>
              <p className="mt-1 text-lg font-semibold">
                {formatCurrency(byCat.get(c.value) ?? 0)}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All expenses</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.expenses.length === 0 ? (
            <EmptyState
              title="No expenses logged yet"
              description="Track every dollar going out — products, gas, equipment, marketing."
              action={
                <Button size="sm" onClick={() => { setEditing(undefined); setOpen(true); }}>
                  <Plus className="h-4 w-4" /> Add your first expense
                </Button>
              }
            />
          ) : (
            [...data.expenses]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((e) => {
                const cat = EXPENSE_CATEGORIES.find((c) => c.value === e.category);
                const isCredit = e.kind === "credit";
                return (
                  <div
                    key={e.id}
                    className={`group flex items-center gap-3 rounded-lg border bg-card p-3 hover:border-primary/40 transition-colors ${
                      isCredit ? "border-emerald-500/30" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={`text-sm font-semibold ${
                            isCredit ? "text-emerald-600 dark:text-emerald-400" : ""
                          }`}
                        >
                          {isCredit ? "− " : ""}
                          {formatCurrencyExact(e.amount)}
                        </p>
                        <Badge variant="outline">{cat?.label}</Badge>
                        {isCredit ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30">
                            Credit
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {format(parseISO(e.date), "MMM d, yyyy")}
                        {e.notes ? ` · ${e.notes}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => {
                          setEditing(e);
                          setOpen(true);
                        }}
                        className="rounded-md p-1 text-muted-foreground hover:bg-accent"
                        aria-label="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm("Delete this expense?"))
                            dispatch({ type: "deleteExpense", id: e.id });
                        }}
                        className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
          )}
        </CardContent>
      </Card>

      <ExpenseDialog open={open} onOpenChange={setOpen} expense={editing} />
    </div>
  );
}

function ExpenseDialog({
  open,
  onOpenChange,
  expense,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  expense?: Expense;
}) {
  const { dispatch } = useStore();
  const [form, setForm] = useState<Expense>(() =>
    expense ?? {
      id: makeId(),
      date: formatISO(new Date()),
      category: "products",
      amount: 0,
      notes: "",
      kind: "expense",
    }
  );

  useEffect(() => {
    if (open) {
      setForm(
        expense ?? {
          id: makeId(),
          date: formatISO(new Date()),
          category: "products",
          amount: 0,
          notes: "",
          kind: "expense",
        }
      );
    }
  }, [open, expense]);

  const isCredit = form.kind === "credit";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (expense) dispatch({ type: "updateExpense", id: expense.id, patch: form });
    else dispatch({ type: "addExpense", expense: form });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {expense ? (isCredit ? "Edit credit" : "Edit expense") : "New entry"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, kind: "expense" })}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  !isCredit
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, kind: "credit" })}
                className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  isCredit
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-border text-muted-foreground hover:bg-accent"
                }`}
              >
                Credit
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isCredit
                ? "Money coming back in — gift cards, refunds, rebates. Subtracts from total expenses."
                : "A regular expense — products, gas, equipment, marketing."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amt">Amount</Label>
              <Input
                id="amt"
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dt">Date</Label>
              <Input
                id="dt"
                type="date"
                value={form.date.slice(0, 10)}
                onChange={(e) => setForm({ ...form, date: formatISO(new Date(e.target.value)) })}
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm({ ...form, category: v as ExpenseCategory })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="enotes">Notes</Label>
            <Textarea
              id="enotes"
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional…"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">
              {expense ? "Save" : isCredit ? "Add credit" : "Add expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
