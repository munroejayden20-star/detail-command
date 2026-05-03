import { useState, useEffect } from "react";
import { formatISO } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore, makeId } from "@/store/store";
import { TASK_CATEGORIES, type Priority, type TaskCategory } from "@/lib/types";

interface TaskQuickAddProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskQuickAdd({ open, onOpenChange }: TaskQuickAddProps) {
  const { dispatch } = useStore();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<TaskCategory>("general");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState(""); // optional HH:mm
  const [recurring, setRecurring] = useState<"none" | "daily" | "weekly" | "monthly">("none");

  useEffect(() => {
    if (open) {
      setTitle("");
      setCategory("general");
      setPriority("medium");
      setDueDate("");
      setDueTime("");
      setRecurring("none");
    }
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    // Store the date input value directly. parseISO("YYYY-MM-DD") returns local
    // midnight, which avoids the UTC shift that made "May 2" look overdue on
    // May 1 evening in Pacific time. If a time is set, store as local
    // YYYY-MM-DDTHH:mm so parseISO interprets it in the user's timezone.
    let storedDue: string | undefined;
    if (dueDate) {
      storedDue = dueTime ? `${dueDate}T${dueTime}` : dueDate;
    }
    dispatch({
      type: "addTask",
      task: {
        id: makeId(),
        title: title.trim(),
        category,
        priority,
        dueDate: storedDue,
        completed: false,
        recurring,
        createdAt: formatISO(new Date()),
      },
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            Add a quick to-do for supplies, follow-ups, or maintenance.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Task</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Restock interior cleaner"
              autoFocus
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as TaskCategory)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as Priority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dd">Due date</Label>
              <Input
                id="dd"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dt">Due time <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                id="dt"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                disabled={!dueDate}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Recurring</Label>
              <Select value={recurring} onValueChange={(v) => setRecurring(v as typeof recurring)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add task</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
