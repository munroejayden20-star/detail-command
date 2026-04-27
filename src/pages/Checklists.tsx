import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  RotateCcw,
  Trash2,
  ListChecks,
  Pencil,
  Copy,
  Search,
  ChevronDown,
  ChevronUp,
  GripVertical,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore, makeId } from "@/store/store";
import {
  CHECKLIST_CATEGORIES,
  type ChecklistGroup,
  type ChecklistCategory,
  type ChecklistItem,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type CategoryFilter = "all" | ChecklistCategory;

export function ChecklistsPage() {
  const { data, dispatch } = useStore();
  const [filter, setFilter] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    let list = [...data.checklists];
    if (filter !== "all") list = list.filter((c) => c.category === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.description ?? "").toLowerCase().includes(q) ||
          c.items.some((it) => it.label.toLowerCase().includes(q))
      );
    }
    return list;
  }, [data.checklists, filter, query]);

  // Counts per category
  const counts = useMemo(() => {
    const m = new Map<ChecklistCategory | "all", number>();
    m.set("all", data.checklists.length);
    CHECKLIST_CATEGORIES.forEach((c) => m.set(c.value, 0));
    data.checklists.forEach((c) => {
      m.set(c.category, (m.get(c.category) ?? 0) + 1);
    });
    return m;
  }, [data.checklists]);

  const editing = data.checklists.find((c) => c.id === editingId) ?? null;

  function handleDuplicate(c: ChecklistGroup) {
    const dupe: ChecklistGroup = {
      ...c,
      id: makeId(),
      name: `${c.name} (copy)`,
      items: c.items.map((it) => ({ ...it, id: makeId(), done: false })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    dispatch({ type: "addChecklist", checklist: dupe });
    toast.success("Checklist duplicated");
  }

  function handleDelete(c: ChecklistGroup) {
    if (!window.confirm(`Delete "${c.name}"? This can't be undone.`)) return;
    dispatch({ type: "deleteChecklist", id: c.id });
    toast.success("Checklist deleted");
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Checklists"
        description="Custom checklists for any workflow — pre-job, exterior, restoration, marketing, anything."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New checklist
          </Button>
        }
      />

      {/* Search + category filter row */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, description, or item…"
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
          {CHECKLIST_CATEGORIES.map((c) => {
            const n = counts.get(c.value) ?? 0;
            if (n === 0 && filter !== c.value) return null;
            return (
              <FilterChip
                key={c.value}
                active={filter === c.value}
                label={`${c.label} (${n})`}
                onClick={() => setFilter(c.value)}
              />
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ListChecks className="h-5 w-5" />}
          title={
            data.checklists.length === 0
              ? "No checklists yet"
              : "Nothing matches"
          }
          description={
            data.checklists.length === 0
              ? "Create your first custom checklist to start organizing your workflow."
              : "Try a different search or category filter."
          }
          action={
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> New checklist
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((g) => (
            <ChecklistCard
              key={g.id}
              group={g}
              customerName={
                data.customers.find((c) => c.id === g.customerId)?.name ?? null
              }
              onToggleItem={(itemId) =>
                dispatch({ type: "toggleChecklistItem", groupId: g.id, itemId })
              }
              onReset={() => {
                dispatch({ type: "resetChecklist", id: g.id });
                toast.message("Checklist reset");
              }}
              onAddItem={(label) =>
                dispatch({
                  type: "updateChecklist",
                  id: g.id,
                  patch: {
                    items: [...g.items, { id: makeId(), label, done: false }],
                  },
                })
              }
              onDeleteItem={(itemId) =>
                dispatch({
                  type: "updateChecklist",
                  id: g.id,
                  patch: { items: g.items.filter((i) => i.id !== itemId) },
                })
              }
              onEdit={() => setEditingId(g.id)}
              onDuplicate={() => handleDuplicate(g)}
              onDelete={() => handleDelete(g)}
            />
          ))}
        </div>
      )}

      <ChecklistEditorDialog
        open={creating}
        onOpenChange={(v) => setCreating(v)}
        mode="create"
      />
      <ChecklistEditorDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditingId(null)}
        mode="edit"
        group={editing ?? undefined}
      />
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

function ChecklistCard({
  group,
  customerName,
  onToggleItem,
  onReset,
  onAddItem,
  onDeleteItem,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  group: ChecklistGroup;
  customerName: string | null;
  onToggleItem: (id: string) => void;
  onReset: () => void;
  onAddItem: (label: string) => void;
  onDeleteItem: (id: string) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [newItem, setNewItem] = useState("");
  const done = group.items.filter((i) => i.done).length;
  const pct = group.items.length
    ? Math.round((done / group.items.length) * 100)
    : 0;
  const categoryLabel =
    CHECKLIST_CATEGORIES.find((c) => c.value === group.category)?.label ??
    "Custom";

  return (
    <Card className="group/card flex flex-col">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="min-w-0">
          <CardTitle className="flex items-center gap-2 text-base">
            <ListChecks className="h-4 w-4 shrink-0" />
            <span className="truncate">{group.name}</span>
          </CardTitle>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px]">
              {categoryLabel}
            </Badge>
            {customerName ? (
              <Badge variant="outline" className="text-[10px]">
                {customerName}
              </Badge>
            ) : null}
            {group.vehicle ? (
              <Badge variant="outline" className="text-[10px]">
                {group.vehicle}
              </Badge>
            ) : null}
          </div>
          {group.description ? (
            <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
              {group.description}
            </p>
          ) : null}
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {done} of {group.items.length} complete · {pct}%
          </p>
        </div>
        <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover/card:opacity-100">
          <button
            onClick={onEdit}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
            aria-label="Edit"
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDuplicate}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
            aria-label="Duplicate"
            title="Duplicate"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onReset}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent"
            aria-label="Reset progress"
            title="Reset progress"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
            aria-label="Delete"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              pct === 100 ? "bg-emerald-500" : "bg-primary"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <ul className="space-y-1">
          {group.items.map((it) => (
            <li
              key={it.id}
              className="group/item flex items-center gap-3 rounded-md p-2 hover:bg-accent transition-colors"
            >
              <Checkbox
                checked={it.done}
                onCheckedChange={() => onToggleItem(it.id)}
              />
              <span
                className={cn(
                  "flex-1 text-sm",
                  it.done && "line-through text-muted-foreground"
                )}
              >
                {it.label}
              </span>
              <button
                onClick={() => onDeleteItem(it.id)}
                className="opacity-0 transition-opacity group-hover/item:opacity-100 text-muted-foreground hover:text-destructive p-1"
                aria-label="Delete item"
                title="Delete item"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newItem.trim()) return;
            onAddItem(newItem.trim());
            setNewItem("");
          }}
        >
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Add an item…"
            className="h-9"
          />
          <Button type="submit" size="sm" variant="outline">
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

interface EditorDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "create" | "edit";
  group?: ChecklistGroup;
}

function ChecklistEditorDialog({
  open,
  onOpenChange,
  mode,
  group,
}: EditorDialogProps) {
  const { data, dispatch } = useStore();

  const blank = (): ChecklistGroup => ({
    id: makeId(),
    name: "",
    category: "custom",
    description: "",
    items: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const [form, setForm] = useState<ChecklistGroup>(group ?? blank());
  const [newItem, setNewItem] = useState("");

  useEffect(() => {
    if (open) {
      setForm(group ?? blank());
      setNewItem("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, group?.id]);

  function moveItem(idx: number, direction: -1 | 1) {
    const next = [...form.items];
    const target = idx + direction;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setForm({ ...form, items: next });
  }

  function setItemLabel(id: string, label: string) {
    setForm({
      ...form,
      items: form.items.map((it) => (it.id === id ? { ...it, label } : it)),
    });
  }

  function removeItem(id: string) {
    setForm({ ...form, items: form.items.filter((it) => it.id !== id) });
  }

  function addItem() {
    const label = newItem.trim();
    if (!label) return;
    const next: ChecklistItem = { id: makeId(), label, done: false };
    setForm({ ...form, items: [...form.items, next] });
    setNewItem("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Give it a name first");
      return;
    }
    if (mode === "create") {
      dispatch({ type: "addChecklist", checklist: form });
      toast.success("Checklist created");
    } else {
      dispatch({ type: "updateChecklist", id: form.id, patch: form });
      toast.success("Checklist saved");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "New checklist" : "Edit checklist"}
          </DialogTitle>
          <DialogDescription>
            Pick a category, list the items, and optionally link to a customer
            or appointment.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_220px]">
            <div className="space-y-1.5">
              <Label htmlFor="cl-name">Title</Label>
              <Input
                id="cl-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Restoration prep checklist"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm({ ...form, category: v as ChecklistCategory })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHECKLIST_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cl-desc">Description (optional)</Label>
            <Textarea
              id="cl-desc"
              rows={2}
              value={form.description ?? ""}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              placeholder="When to use this, what it covers, anything to remember…"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Linked customer (optional)</Label>
              <Select
                value={form.customerId ?? "none"}
                onValueChange={(v) =>
                  setForm({ ...form, customerId: v === "none" ? undefined : v })
                }
              >
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
            <div className="space-y-1.5">
              <Label htmlFor="cl-vehicle">Linked vehicle (optional)</Label>
              <Input
                id="cl-vehicle"
                value={form.vehicle ?? ""}
                onChange={(e) => setForm({ ...form, vehicle: e.target.value })}
                placeholder="2020 Toyota RAV4"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Linked appointment (optional)</Label>
              <Select
                value={form.appointmentId ?? "none"}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    appointmentId: v === "none" ? undefined : v,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {data.appointments.slice(0, 50).map((a) => {
                    const cust = data.customers.find(
                      (c) => c.id === a.customerId
                    );
                    return (
                      <SelectItem key={a.id} value={a.id}>
                        {cust?.name ?? "—"} · {a.start.slice(0, 10)}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Items</Label>
            <ul className="mt-1.5 space-y-1.5">
              {form.items.map((it, idx) => (
                <li
                  key={it.id}
                  className="flex items-center gap-2 rounded-lg border bg-card px-2 py-1.5"
                >
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={it.label}
                    onChange={(e) => setItemLabel(it.id, e.target.value)}
                    className="h-8 flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => moveItem(idx, -1)}
                    disabled={idx === 0}
                    className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
                    aria-label="Move up"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(idx, 1)}
                    disabled={idx === form.items.length - 1}
                    className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
                    aria-label="Move down"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(it.id)}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-destructive"
                    aria-label="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <Input
                value={newItem}
                onChange={(e) => setNewItem(e.target.value)}
                placeholder="Add an item, then press Enter…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addItem();
                  }
                }}
                className="h-9"
              />
              <Button type="button" size="sm" variant="outline" onClick={addItem}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {mode === "create" ? "Create checklist" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
