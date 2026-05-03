import { useState, useMemo } from "react";
import { format, parseISO, isToday, isAfter, startOfDay } from "date-fns";
import { Plus, Trash2, Repeat as RepeatIcon, Search } from "lucide-react";

/** Has the due moment passed? For date-only values ("2026-05-02") a task is
 *  only "overdue" once today's calendar day is AFTER the due day in local time
 *  — picking May 2 should NOT show overdue at 6 PM on May 1. For datetime
 *  values ("2026-05-02T15:30") it's overdue once the wall-clock minute passes. */
function hasTime(dueDate: string) {
  return dueDate.length > 10; // "YYYY-MM-DD" is 10 chars
}
function isTaskOverdue(dueDate: string): boolean {
  const due = parseISO(dueDate);
  if (hasTime(dueDate)) return isAfter(new Date(), due);
  return isAfter(startOfDay(new Date()), startOfDay(due));
}
function formatTaskDue(dueDate: string): string {
  const due = parseISO(dueDate);
  return hasTime(dueDate) ? format(due, "MMM d · h:mm a") : format(due, "MMM d");
}
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { TaskQuickAdd } from "@/components/tasks/TaskQuickAdd";
import { useStore } from "@/store/store";
import { TASK_CATEGORIES, type Task, type TaskCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TasksPage() {
  const { data, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "done">("open");
  const [category, setCategory] = useState<TaskCategory | "all">("all");
  const [priority, setPriority] = useState<"all" | "high" | "medium" | "low">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    let list = [...data.tasks];
    if (filter === "open") list = list.filter((t) => !t.completed);
    if (filter === "done") list = list.filter((t) => t.completed);
    if (category !== "all") list = list.filter((t) => t.category === category);
    if (priority !== "all") list = list.filter((t) => t.priority === priority);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.notes ?? "").toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const ad = a.dueDate ? parseISO(a.dueDate).getTime() : Infinity;
      const bd = b.dueDate ? parseISO(b.dueDate).getTime() : Infinity;
      if (ad !== bd) return ad - bd;
      const order = { high: 0, medium: 1, low: 2 } as const;
      return order[a.priority] - order[b.priority];
    });
  }, [data.tasks, filter, category]);

  const counts = useMemo(() => {
    const open = data.tasks.filter((t) => !t.completed).length;
    const overdue = data.tasks.filter(
      (t) => !t.completed && t.dueDate && isTaskOverdue(t.dueDate)
    ).length;
    const today = data.tasks.filter(
      (t) => !t.completed && t.dueDate && isToday(parseISO(t.dueDate)) && !isTaskOverdue(t.dueDate)
    ).length;
    return { open, overdue, today };
  }, [data.tasks]);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Tasks"
        description="Supplies, follow-ups, maintenance, marketing — everything outside the job itself."
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> New task
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <SmallStat label="Open tasks" value={counts.open} />
        <SmallStat label="Due today" value={counts.today} tone="primary" />
        <SmallStat label="Overdue" value={counts.overdue} tone={counts.overdue ? "danger" : "muted"} />
      </div>

      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="done">Done</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search tasks…"
              className="pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant={category === "all" ? "default" : "outline"}
            onClick={() => setCategory("all")}
          >
            All
          </Button>
          {TASK_CATEGORIES.map((c) => (
            <Button
              key={c.value}
              size="sm"
              variant={category === c.value ? "default" : "outline"}
              onClick={() => setCategory(c.value)}
            >
              {c.label}
            </Button>
          ))}
          <span className="mx-2 hidden h-5 w-px bg-border sm:inline-block" />
          {(["all", "high", "medium", "low"] as const).map((p) => (
            <Button
              key={p}
              size="sm"
              variant={priority === p ? "default" : "outline"}
              onClick={() => setPriority(p)}
              className="capitalize"
            >
              {p === "all" ? "Any priority" : `${p} priority`}
            </Button>
          ))}
          {(query || category !== "all" || priority !== "all") && (
            <button
              onClick={() => {
                setQuery("");
                setCategory("all");
                setPriority("all");
              }}
              className="ml-1 rounded-md border border-dashed px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="space-y-1 p-3">
          {filtered.length === 0 ? (
            <EmptyState
              title={
                data.tasks.length === 0
                  ? "No tasks yet"
                  : filter === "done"
                  ? "No completed tasks yet"
                  : "Nothing here"
              }
              description={
                data.tasks.length === 0
                  ? "Add your first task — supplies, follow-ups, or maintenance."
                  : filter === "open"
                  ? "All caught up. Add a task when something comes up."
                  : "Try a different filter."
              }
              action={
                <Button size="sm" onClick={() => setOpen(true)}>
                  <Plus className="h-4 w-4" /> Add your first task
                </Button>
              }
            />
          ) : (
            filtered.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onToggle={() =>
                  dispatch({
                    type: "updateTask",
                    id: t.id,
                    patch: { completed: !t.completed },
                  })
                }
                onDelete={() => {
                  dispatch({ type: "deleteTask", id: t.id });
                  toast.success("Task deleted");
                }}
              />
            ))
          )}
        </CardContent>
      </Card>

      <TaskQuickAdd open={open} onOpenChange={setOpen} />
    </div>
  );
}

function TaskRow({ task, onToggle, onDelete }: { task: Task; onToggle: () => void; onDelete: () => void }) {
  const overdue = !task.completed && !!task.dueDate && isTaskOverdue(task.dueDate);
  const dueToday = !task.completed && !!task.dueDate && isToday(parseISO(task.dueDate)) && !overdue;
  const cat = TASK_CATEGORIES.find((c) => c.value === task.category);

  return (
    <div className={cn(
      "group flex items-center gap-3 rounded-lg p-3 transition-colors hover:bg-accent",
      task.completed && "opacity-60"
    )}>
      <Checkbox checked={task.completed} onCheckedChange={onToggle} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm font-medium", task.completed && "line-through text-muted-foreground")}>
            {task.title}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            <PriorityDot priority={task.priority} />
          </div>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          {cat ? (
            <Badge variant="outline" className="text-[10px]">{cat.label}</Badge>
          ) : null}
          {task.dueDate ? (
            <span className={cn(
              overdue && "text-rose-600 font-medium dark:text-rose-300",
              dueToday && "text-amber-600 font-medium dark:text-amber-300"
            )}>
              {overdue
                ? `Overdue · ${formatTaskDue(task.dueDate)}`
                : dueToday
                ? hasTime(task.dueDate)
                  ? `Today · ${format(parseISO(task.dueDate), "h:mm a")}`
                  : "Today"
                : formatTaskDue(task.dueDate)}
            </span>
          ) : null}
          {task.recurring && task.recurring !== "none" ? (
            <span className="inline-flex items-center gap-1 capitalize">
              <RepeatIcon className="h-3 w-3" /> {task.recurring}
            </span>
          ) : null}
        </div>
      </div>
      <button
        onClick={onDelete}
        className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1"
        aria-label="Delete task"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function PriorityDot({ priority }: { priority: "low" | "medium" | "high" }) {
  const tone =
    priority === "high"
      ? "bg-rose-500"
      : priority === "medium"
      ? "bg-amber-500"
      : "bg-slate-400";
  return <span className={cn("h-2 w-2 rounded-full", tone)} title={`Priority: ${priority}`} />;
}

function SmallStat({ label, value, tone }: { label: string; value: number; tone?: "primary" | "danger" | "muted" }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn(
        "mt-1 text-2xl font-semibold tracking-tight",
        tone === "primary" && "text-primary",
        tone === "danger" && "text-rose-600 dark:text-rose-400"
      )}>
        {value}
      </p>
    </div>
  );
}
