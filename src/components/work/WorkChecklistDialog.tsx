import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ListChecks,
  ChevronDown,
  CheckCircle2,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  X,
  Link as LinkIcon,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/store/store";
import { PresetPickerDialog } from "@/components/checklists/PresetPickerDialog";
import {
  CHECKLIST_CATEGORIES,
  type ChecklistCategory,
  type ChecklistGroup,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  appointmentId: string;
  customerId: string;
}

type Filter = "all" | ChecklistCategory;

/**
 * Mid-job checklist picker. Lists every checklist, filterable by category,
 * with one-tap expand to check off items. A pin/link toggle attaches a
 * checklist to the active appointment so it shows up in the inline card
 * automatically next time.
 */
export function WorkChecklistDialog({
  open,
  onOpenChange,
  appointmentId,
  customerId,
}: Props) {
  const { data, dispatch } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [presetOpen, setPresetOpen] = useState(false);

  const checklists = data.checklists;

  // Counts per category
  const counts = useMemo(() => {
    const m = new Map<Filter, number>();
    m.set("all", checklists.length);
    CHECKLIST_CATEGORIES.forEach((c) => m.set(c.value, 0));
    checklists.forEach((c) => {
      m.set(c.category, (m.get(c.category) ?? 0) + 1);
    });
    return m;
  }, [checklists]);

  // Filtered list with linked-to-this-job pinned to the top
  const visible = useMemo(() => {
    let list = [...checklists];
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
    return list.sort((a, b) => {
      const aLinked =
        a.appointmentId === appointmentId || a.customerId === customerId;
      const bLinked =
        b.appointmentId === appointmentId || b.customerId === customerId;
      if (aLinked !== bLinked) return aLinked ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }, [checklists, filter, query, appointmentId, customerId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl !p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            <DialogTitle className="text-base">Checklists</DialogTitle>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded p-1 text-muted-foreground hover:bg-accent"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <DialogDescription className="sr-only">
          Pick a checklist to run during the job. Tap items to mark them done.
        </DialogDescription>

        {/* Search */}
        <div className="border-b px-4 py-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search checklists or items…"
              className="pl-9"
            />
          </div>
        </div>

        {/* Category chips — horizontal scroll on phone */}
        <div className="border-b px-2 py-2">
          <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-1">
            <Chip
              active={filter === "all"}
              label={`All (${counts.get("all") ?? 0})`}
              onClick={() => setFilter("all")}
            />
            {CHECKLIST_CATEGORIES.map((c) => {
              const n = counts.get(c.value) ?? 0;
              if (n === 0 && filter !== c.value) return null;
              return (
                <Chip
                  key={c.value}
                  active={filter === c.value}
                  label={`${c.label} (${n})`}
                  onClick={() => setFilter(c.value)}
                />
              );
            })}
          </div>
        </div>

        {/* List */}
        <div className="max-h-[55vh] overflow-y-auto scrollbar-thin px-2 py-2">
          {visible.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">
              {checklists.length === 0 ? (
                <>
                  No checklists yet.
                  <div className="mt-3">
                    <Button asChild size="sm" onClick={() => onOpenChange(false)}>
                      <Link to="/checklists">
                        <Plus className="h-4 w-4" /> Create one
                      </Link>
                    </Button>
                  </div>
                </>
              ) : (
                "Nothing matches that filter."
              )}
            </div>
          ) : (
            <ul className="space-y-2">
              {visible.map((g) => (
                <ChecklistRow
                  key={g.id}
                  group={g}
                  expanded={expandedId === g.id}
                  onExpandToggle={() =>
                    setExpandedId((cur) => (cur === g.id ? null : g.id))
                  }
                  isLinked={
                    g.appointmentId === appointmentId ||
                    g.customerId === customerId
                  }
                  onLinkToggle={() => {
                    const linked =
                      g.appointmentId === appointmentId ||
                      g.customerId === customerId;
                    if (linked) {
                      dispatch({
                        type: "updateChecklist",
                        id: g.id,
                        patch: { appointmentId: undefined },
                      });
                      toast.success("Unlinked from this job");
                    } else {
                      dispatch({
                        type: "updateChecklist",
                        id: g.id,
                        patch: { appointmentId, customerId },
                      });
                      toast.success("Linked to this job");
                    }
                  }}
                  onToggleItem={(itemId) =>
                    dispatch({
                      type: "toggleChecklistItem",
                      groupId: g.id,
                      itemId,
                    })
                  }
                  onReset={() => {
                    dispatch({ type: "resetChecklist", id: g.id });
                    toast.message("Checklist reset");
                  }}
                />
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="grid grid-cols-2 gap-2 border-t px-4 py-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPresetOpen(true)}
          >
            <Sparkles className="h-4 w-4" /> Insert preset
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/checklists" onClick={() => onOpenChange(false)}>
              <Plus className="h-4 w-4" /> New checklist
            </Link>
          </Button>
        </div>

        <PresetPickerDialog
          open={presetOpen}
          onOpenChange={setPresetOpen}
          appointmentId={appointmentId}
          customerId={customerId}
        />
      </DialogContent>
    </Dialog>
  );
}

function Chip({
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
        "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:bg-accent"
      )}
    >
      {label}
    </button>
  );
}

function ChecklistRow({
  group,
  expanded,
  onExpandToggle,
  onToggleItem,
  onReset,
  isLinked,
  onLinkToggle,
}: {
  group: ChecklistGroup;
  expanded: boolean;
  onExpandToggle: () => void;
  onToggleItem: (id: string) => void;
  onReset: () => void;
  isLinked: boolean;
  onLinkToggle: () => void;
}) {
  const done = group.items.filter((i) => i.done).length;
  const total = group.items.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const categoryLabel =
    CHECKLIST_CATEGORIES.find((c) => c.value === group.category)?.label ??
    "Custom";

  return (
    <li className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={onExpandToggle}
        className="flex w-full items-center gap-2 p-3 text-left hover:bg-accent rounded-lg transition-colors"
      >
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-semibold">{group.name}</p>
            <Badge variant="outline" className="text-[10px]">
              {categoryLabel}
            </Badge>
            {isLinked ? (
              <Badge variant="soft" className="text-[10px]">
                <LinkIcon className="mr-0.5 h-2.5 w-2.5" /> Linked
              </Badge>
            ) : null}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full",
                  pct === 100 ? "bg-emerald-500" : "bg-primary"
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {done}/{total}
            </span>
          </div>
        </div>
      </button>

      {expanded ? (
        <div className="border-t px-3 py-2">
          <ul className="space-y-1">
            {group.items.map((it) => (
              <li key={it.id}>
                <button
                  type="button"
                  onClick={() => onToggleItem(it.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2 py-2.5 text-sm hover:bg-accent",
                    it.done && "text-muted-foreground line-through"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                      it.done
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-border"
                    )}
                  >
                    {it.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                  </span>
                  <span className="flex-1 text-left">{it.label}</span>
                </button>
              </li>
            ))}
            {group.items.length === 0 ? (
              <li className="px-2 py-3 text-xs text-muted-foreground">
                No items in this checklist yet.
              </li>
            ) : null}
          </ul>
          <div className="mt-2 flex justify-between border-t pt-2">
            <Button variant="ghost" size="sm" onClick={onReset}>
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onLinkToggle}
              className={isLinked ? "text-muted-foreground" : "text-primary"}
            >
              {isLinked ? (
                <>
                  <Unlink className="h-3.5 w-3.5" /> Unlink
                </>
              ) : (
                <>
                  <LinkIcon className="h-3.5 w-3.5" /> Link to this job
                </>
              )}
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
