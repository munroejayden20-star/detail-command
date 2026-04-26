import { useState } from "react";
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
import { useStore, makeId } from "@/store/store";

interface BlockDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BlockDialog({ open, onOpenChange }: BlockDialogProps) {
  const { dispatch } = useStore();
  const [label, setLabel] = useState("Day job");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!start || !end) return;
    dispatch({
      type: "addBlock",
      block: {
        id: makeId(),
        start: formatISO(new Date(start)),
        end: formatISO(new Date(end)),
        label: label || "Blocked",
      },
    });
    onOpenChange(false);
    setStart("");
    setEnd("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Block off time</DialogTitle>
          <DialogDescription>
            Mark hours when you can't take jobs (e.g. day job, family event).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="label">Label</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Day job"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start">Start</Label>
              <Input
                id="start"
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end">End</Label>
              <Input
                id="end"
                type="datetime-local"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Add block</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
