import { useState } from "react";
import { Sparkles, ChevronDown, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore, makeId } from "@/store/store";
import { CHECKLIST_PRESETS } from "@/lib/checklistPresets";
import { CHECKLIST_CATEGORIES } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** If provided, the inserted checklist links to this appointment + customer */
  appointmentId?: string;
  customerId?: string;
}

export function PresetPickerDialog({
  open,
  onOpenChange,
  appointmentId,
  customerId,
}: Props) {
  const { dispatch } = useStore();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [inserted, setInserted] = useState<Set<string>>(new Set());

  function insertPreset(key: string) {
    const preset = CHECKLIST_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    const now = new Date().toISOString();
    dispatch({
      type: "addChecklist",
      checklist: {
        id: makeId(),
        name: preset.name,
        category: preset.category,
        description: preset.description,
        items: preset.items.map((label) => ({
          id: makeId(),
          label,
          done: false,
        })),
        appointmentId,
        customerId,
        createdAt: now,
        updatedAt: now,
      },
    });
    setInserted((s) => new Set(s).add(key));
    toast.success(`${preset.name} added`);
  }

  function insertAll() {
    if (
      !window.confirm(
        `Add all ${CHECKLIST_PRESETS.length} presets to your checklists?`
      )
    )
      return;
    CHECKLIST_PRESETS.forEach((p) => {
      if (!inserted.has(p.key)) insertPreset(p.key);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl !p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <DialogTitle className="text-base">Preset checklists</DialogTitle>
          </div>
          <Button size="sm" variant="outline" onClick={insertAll}>
            Add all
          </Button>
        </div>
        <DialogDescription className="px-4 pt-2 text-xs text-muted-foreground">
          Curated workflows in industry-standard order. Tap a preset to preview,
          tap <strong>Add</strong> to copy it into your checklists. You can edit
          or delete any of them after.
        </DialogDescription>

        <div className="max-h-[60vh] overflow-y-auto scrollbar-thin px-2 py-2">
          <ul className="space-y-2">
            {CHECKLIST_PRESETS.map((p) => {
              const isOpen = expanded === p.key;
              const wasInserted = inserted.has(p.key);
              const categoryLabel =
                CHECKLIST_CATEGORIES.find((c) => c.value === p.category)
                  ?.label ?? "Custom";
              return (
                <li key={p.key} className="rounded-lg border bg-card">
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((cur) => (cur === p.key ? null : p.key))
                    }
                    className="flex w-full items-start gap-2 p-3 text-left hover:bg-accent rounded-lg transition-colors"
                  >
                    <ChevronDown
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                        isOpen && "rotate-180"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-semibold">{p.name}</p>
                        <Badge variant="outline" className="text-[10px]">
                          {categoryLabel}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {p.items.length} items
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {p.description}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {wasInserted ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                          <Check className="h-3 w-3" /> Added
                        </span>
                      ) : (
                        <span
                          role="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            insertPreset(p.key);
                          }}
                          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:opacity-90"
                        >
                          <Plus className="h-3 w-3" /> Add
                        </span>
                      )}
                    </div>
                  </button>

                  {isOpen ? (
                    <div className="border-t px-3 py-2">
                      <ol className="space-y-0.5 text-xs">
                        {p.items.map((label, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 px-2 py-1.5"
                          >
                            <span className="shrink-0 text-muted-foreground tabular-nums">
                              {String(i + 1).padStart(2, "0")}.
                            </span>
                            <span>{label}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="border-t px-4 py-2.5">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
