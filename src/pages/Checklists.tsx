import { Plus, RotateCcw, Trash2, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SectionHeader } from "@/components/ui/section-header";
import { useStore, makeId } from "@/store/store";
import type { ChecklistGroup } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function ChecklistsPage() {
  const { data, dispatch } = useStore();

  const groups = data.checklists;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Checklists"
        description="Pre-job, exterior, interior, and post-job — the workflow that keeps you sharp."
      />

      <Tabs defaultValue="pre">
        <TabsList>
          <TabsTrigger value="pre">Pre-Job</TabsTrigger>
          <TabsTrigger value="exterior">Exterior</TabsTrigger>
          <TabsTrigger value="interior">Interior</TabsTrigger>
          <TabsTrigger value="post">Post-Job</TabsTrigger>
        </TabsList>
        {(["pre", "exterior", "interior", "post"] as const).map((kind) => (
          <TabsContent key={kind} value={kind}>
            <div className="grid gap-4 lg:grid-cols-2">
              {groups
                .filter((g) => g.kind === kind)
                .map((g) => (
                  <ChecklistCard
                    key={g.id}
                    group={g}
                    onToggleItem={(itemId) =>
                      dispatch({ type: "toggleChecklistItem", groupId: g.id, itemId })
                    }
                    onReset={() => dispatch({ type: "resetChecklist", id: g.id })}
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
                        patch: {
                          items: g.items.filter((i) => i.id !== itemId),
                        },
                      })
                    }
                  />
                ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function ChecklistCard({
  group,
  onToggleItem,
  onReset,
  onAddItem,
  onDeleteItem,
}: {
  group: ChecklistGroup;
  onToggleItem: (id: string) => void;
  onReset: () => void;
  onAddItem: (label: string) => void;
  onDeleteItem: (id: string) => void;
}) {
  const [newItem, setNewItem] = useState("");
  const done = group.items.filter((i) => i.done).length;
  const pct = group.items.length ? Math.round((done / group.items.length) * 100) : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            {group.name}
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {done} of {group.items.length} complete · {pct}%
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="h-4 w-4" /> Reset
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full",
              pct === 100 ? "bg-emerald-500" : "bg-primary"
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <ul className="space-y-1">
          {group.items.map((it) => (
            <li
              key={it.id}
              className="group flex items-center gap-3 rounded-md p-2 hover:bg-accent transition-colors"
            >
              <Checkbox checked={it.done} onCheckedChange={() => onToggleItem(it.id)} />
              <span className={cn("flex-1 text-sm", it.done && "line-through text-muted-foreground")}>
                {it.label}
              </span>
              <button
                onClick={() => onDeleteItem(it.id)}
                className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1"
                aria-label="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
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
