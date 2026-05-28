/* ============================================================================
 * TasksPage — admin worklist, cinematic retreat.
 *
 * Same selectors, same dispatch, same TaskQuickAdd dialog. The KPI strip
 * uses LuxStat with "overdue" elevated to signal tone when non-zero so the
 * dashboard reads "act here" at a glance.
 *
 * Filters are condensed into a single horizontal row of glass pills — the
 * dual-rail approach in the shadcn version was visually noisy.
 * ========================================================================== */

import { useState, useMemo } from "react";
import { format, parseISO, isToday, isAfter, startOfDay } from "date-fns";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckSquare,
  Clock,
  Plus,
  Repeat as RepeatIcon,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { TaskQuickAdd } from "@/components/tasks/TaskQuickAdd";
import { useStore } from "@/store/store";
import { useRegisterIrisContext } from "@/components/iris/PageContext";
import { TASK_CATEGORIES, type Task, type TaskCategory } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  LuxAmbient,
  LuxCard,
  LuxEmptyState,
  LuxStat,
} from "@/components/dashboard/lux/primitives";

function hasTime(dueDate: string) {
  return dueDate.length > 10;
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

export function TasksPage() {
  const { data, dispatch } = useStore();
  useRegisterIrisContext({ page: "tasks", label: "Tasks" });
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
          (t.notes ?? "").toLowerCase().includes(q),
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
  }, [data.tasks, filter, category, priority, query]);

  const counts = useMemo(() => {
    const openC = data.tasks.filter((t) => !t.completed).length;
    const overdue = data.tasks.filter(
      (t) => !t.completed && t.dueDate && isTaskOverdue(t.dueDate),
    ).length;
    const today = data.tasks.filter(
      (t) => !t.completed && t.dueDate && isToday(parseISO(t.dueDate)) && !isTaskOverdue(t.dueDate),
    ).length;
    return { open: openC, overdue, today };
  }, [data.tasks]);

  const hasActiveFilter = !!query || category !== "all" || priority !== "all";

  return (
    <div className="relative -mx-4 -mt-4 min-h-[calc(100vh-3rem)] bg-obsidian-950 px-4 pt-6 pb-12 text-platinum-100 sm:-mx-6 sm:px-6 md:-mx-10 md:-mt-6 md:px-10 md:pt-9 md:pb-16">
      <LuxAmbient />

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative space-y-6"
      >
        {/* ═══ Hero ═══ */}
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-[9.5px] uppercase tracking-[0.32em] text-ember-300">
              Worklist · {counts.open} open
            </p>
            <h1 className="mt-1.5 font-sans text-3xl font-extralight leading-tight tracking-tight text-platinum-50 sm:text-4xl">
              Tasks
            </h1>
            <p className="mt-2 text-[13px] leading-relaxed text-platinum-300/80">
              Supplies, follow-ups, maintenance, marketing — everything outside the job itself.
            </p>
          </div>
          <NewTaskButton onClick={() => setOpen(true)} />
        </section>

        {/* ═══ KPI strip ═══ */}
        <section className="grid gap-3 sm:grid-cols-3">
          <LuxStat
            kicker="Open tasks"
            value={counts.open}
            icon={<CheckSquare className="h-3.5 w-3.5" />}
            hint={counts.open === 0 ? "All caught up" : "Still on the list"}
          />
          <LuxStat
            kicker="Due today"
            value={counts.today}
            icon={<Clock className="h-3.5 w-3.5" />}
            hint={counts.today === 0 ? "Nothing today" : "Get these done"}
          />
          <LuxStat
            kicker="Overdue"
            value={counts.overdue}
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            hint={counts.overdue === 0 ? "On time" : "Past their date"}
            emphasis={counts.overdue > 0}
          />
        </section>

        {/* ═══ Controls ═══ */}
        <section className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1.5">
              {(["open", "done", "all"] as const).map((f) => (
                <FilterPill
                  key={f}
                  active={filter === f}
                  onClick={() => setFilter(f)}
                  label={f === "open" ? "Open" : f === "done" ? "Done" : "All"}
                />
              ))}
            </div>
            <div className="relative max-w-xs flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-platinum-300/55" />
              <input
                placeholder="Search tasks…"
                className="block w-full appearance-none rounded-full border border-white/10 bg-white/[0.03] py-2.5 pl-10 pr-4 text-[13px] text-platinum-50 placeholder:text-platinum-300/45 backdrop-blur-sm outline-none transition-all duration-200 focus:border-ember-400/55 focus:bg-white/[0.05] focus:[box-shadow:0_0_0_4px_rgba(221,41,20,0.08)]"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <FilterPill
              tone="subtle"
              active={category === "all"}
              onClick={() => setCategory("all")}
              label="All categories"
            />
            {TASK_CATEGORIES.map((c) => (
              <FilterPill
                key={c.value}
                tone="subtle"
                active={category === c.value}
                onClick={() => setCategory(c.value)}
                label={c.label}
              />
            ))}
            <span aria-hidden className="mx-1.5 hidden h-5 w-px bg-white/10 sm:inline-block" />
            {(["all", "high", "medium", "low"] as const).map((p) => (
              <FilterPill
                key={p}
                tone="subtle"
                active={priority === p}
                onClick={() => setPriority(p)}
                label={p === "all" ? "Any priority" : `${p} priority`}
              />
            ))}
            {hasActiveFilter && (
              <button
                onClick={() => {
                  setQuery("");
                  setCategory("all");
                  setPriority("all");
                }}
                className="ml-1 rounded-full border border-dashed border-white/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-platinum-300/65 transition-colors hover:border-white/25 hover:text-platinum-100"
              >
                Reset filters
              </button>
            )}
          </div>
        </section>

        {/* ═══ List ═══ */}
        <LuxCard className="px-1 py-1">
          {filtered.length === 0 ? (
            <LuxEmptyState
              icon={<CheckSquare className="h-5 w-5" />}
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
              action={<NewTaskButton small onClick={() => setOpen(true)} />}
            />
          ) : (
            <ul>
              {filtered.map((t) => (
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
              ))}
            </ul>
          )}
        </LuxCard>
      </motion.div>

      <TaskQuickAdd open={open} onOpenChange={setOpen} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

function NewTaskButton({ onClick, small = false }: { onClick: () => void; small?: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.96 }}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "group/lux-btn relative inline-flex shrink-0 items-center gap-2 overflow-hidden border border-ember-500/35 bg-gradient-to-b from-ember-500/12 via-ember-500/8 to-ember-500/14 font-medium uppercase tracking-[0.22em] text-platinum-50 backdrop-blur-md transition-all duration-200 hover:border-ember-400/55 hover:from-ember-500/18 hover:to-ember-500/22",
        small ? "px-3 py-2 text-[10px]" : "px-4 py-2.5 text-[11px]",
      )}
      style={{ borderRadius: 999 }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full"
        style={{
          background: "linear-gradient(180deg, rgba(255,220,200,0.18) 0%, transparent 100%)",
        }}
      />
      <Plus className="relative h-3.5 w-3.5 text-ember-300" />
      <span className="relative">New task</span>
    </motion.button>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  tone = "default",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone?: "default" | "subtle";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border font-medium uppercase tracking-[0.18em] transition-all duration-200",
        tone === "subtle" ? "px-2.5 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]",
        active
          ? "border-ember-400/45 bg-ember-500/10 text-platinum-50"
          : "border-white/10 bg-white/[0.02] text-platinum-300/75 hover:border-white/20 hover:bg-white/[0.04] hover:text-platinum-100",
      )}
    >
      {label}
    </button>
  );
}

function TaskRow({
  task,
  onToggle,
  onDelete,
}: {
  task: Task;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const overdue = !task.completed && !!task.dueDate && isTaskOverdue(task.dueDate);
  const dueToday = !task.completed && !!task.dueDate && isToday(parseISO(task.dueDate)) && !overdue;
  const cat = TASK_CATEGORIES.find((c) => c.value === task.category);

  return (
    <li
      className={cn(
        "group/task relative flex items-center gap-3 border-b border-white/[0.06] px-3 py-2.5 transition-colors duration-150 last:border-b-0 hover:bg-white/[0.025]",
        task.completed && "opacity-55",
      )}
    >
      {/* Hover ember rail */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-px scale-y-0 bg-ember-400/70 transition-transform duration-200 group-hover/task:scale-y-100"
        style={{ transformOrigin: "center" }}
      />

      <Checkbox
        checked={task.completed}
        onCheckedChange={onToggle}
        className="mt-0.5 border-white/30 data-[state=checked]:border-ember-400/70 data-[state=checked]:bg-ember-500/30"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              "text-[13px] font-light leading-tight text-platinum-50",
              task.completed && "text-platinum-300/60 line-through",
            )}
          >
            {task.title}
          </p>
          <PriorityDot priority={task.priority} />
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
          {cat ? (
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.22em] text-platinum-300/75">
              {cat.label}
            </span>
          ) : null}
          {task.dueDate ? (
            <span
              className={cn(
                "font-mono tabular-nums",
                overdue ? "text-rose-300" : dueToday ? "text-ember-300" : "text-platinum-300/65",
              )}
            >
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
            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.22em] text-platinum-300/65">
              <RepeatIcon className="h-3 w-3" /> {task.recurring}
            </span>
          ) : null}
        </div>
      </div>
      <button
        onClick={onDelete}
        className="rounded-md p-1 text-platinum-300/55 opacity-0 transition-all duration-150 hover:bg-rose-500/10 hover:text-rose-300 group-hover/task:opacity-100"
        aria-label="Delete task"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  );
}

function PriorityDot({ priority }: { priority: "low" | "medium" | "high" }) {
  const tone =
    priority === "high"
      ? "bg-rose-400 ring-rose-500/30"
      : priority === "medium"
      ? "bg-amber-400 ring-amber-500/25"
      : "bg-platinum-300/35 ring-white/10";
  return (
    <span
      className={cn("h-2 w-2 shrink-0 rounded-full ring-2", tone)}
      title={`Priority: ${priority}`}
      aria-label={`Priority: ${priority}`}
    />
  );
}
