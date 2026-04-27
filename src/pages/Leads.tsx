import { useEffect, useState, useMemo } from "react";
import { format, formatISO, parseISO } from "date-fns";
import { Plus, Trash2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import { useStore, makeId } from "@/store/store";
import { ReachOutDialog } from "@/components/contact/ReachOutDialog";
import {
  LEAD_STATUSES,
  type Lead,
  type LeadSource,
  type LeadStatus,
} from "@/lib/types";
import { cn, truncate } from "@/lib/utils";

const SOURCES: { value: LeadSource; label: string }[] = [
  { value: "facebook", label: "Facebook" },
  { value: "dealership", label: "Dealership" },
  { value: "referral", label: "Referral" },
  { value: "google", label: "Google" },
  { value: "other", label: "Other" },
];

const STATUS_COLUMNS: { value: LeadStatus; label: string; tone: string }[] = [
  { value: "new", label: "New", tone: "border-blue-500/50" },
  { value: "contacted", label: "Contacted", tone: "border-amber-500/50" },
  { value: "waiting", label: "Waiting response", tone: "border-violet-500/50" },
  { value: "booked", label: "Booked", tone: "border-emerald-500/50" },
  { value: "lost", label: "Lost", tone: "border-rose-500/50" },
];

export function LeadsPage() {
  const { data, dispatch } = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | undefined>();

  const grouped = useMemo(() => {
    const map = new Map<LeadStatus, Lead[]>();
    STATUS_COLUMNS.forEach((s) => map.set(s.value, []));
    data.leads.forEach((l) => {
      map.get(l.status)?.push(l);
    });
    return map;
  }, [data.leads]);

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Leads"
        description="Track inquiries that haven't booked yet."
        actions={
          <Button onClick={() => { setEditing(undefined); setOpen(true); }}>
            <Plus className="h-4 w-4" />
            New lead
          </Button>
        }
      />

      <div className="grid gap-3 lg:grid-cols-5 md:grid-cols-2">
        {STATUS_COLUMNS.map((col) => {
          const leads = grouped.get(col.value) ?? [];
          return (
            <Card key={col.value} className={cn("border-t-2", col.tone)}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{col.label}</CardTitle>
                  <Badge variant="outline">{leads.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {leads.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Empty</p>
                ) : (
                  leads.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => {
                        setEditing(l);
                        setOpen(true);
                      }}
                      className="w-full rounded-lg border bg-card p-3 text-left transition-all hover:border-primary/40 hover:shadow-soft"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{l.name}</p>
                        <Badge variant="outline" className="capitalize text-[10px]">
                          {l.source}
                        </Badge>
                      </div>
                      {l.vehicle ? (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {l.vehicle}
                        </p>
                      ) : null}
                      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 capitalize",
                            l.interest === "high"
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200"
                              : l.interest === "medium"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          )}
                        >
                          {l.interest} interest
                        </span>
                        {l.followUpDate ? (
                          <span>
                            Follow up {format(parseISO(l.followUpDate), "MMM d")}
                          </span>
                        ) : null}
                      </div>
                      {l.notes ? (
                        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                          {truncate(l.notes, 90)}
                        </p>
                      ) : null}
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {data.leads.length === 0 ? (
        <EmptyState
          title="No leads yet"
          description="Track your first lead — anyone who messages you about a detail."
          action={
            <Button size="sm" onClick={() => { setEditing(undefined); setOpen(true); }}>
              <Plus className="h-4 w-4" /> Track your first lead
            </Button>
          }
        />
      ) : null}

      <LeadDialog open={open} onOpenChange={setOpen} lead={editing} />
    </div>
  );
}

function LeadDialog({
  open,
  onOpenChange,
  lead,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead;
}) {
  const { dispatch } = useStore();
  const [reachOpen, setReachOpen] = useState(false);
  const [form, setForm] = useState<Lead>(() =>
    lead ?? {
      id: makeId(),
      name: "",
      phone: "",
      source: "facebook",
      vehicle: "",
      interest: "medium",
      status: "new",
      notes: "",
      createdAt: formatISO(new Date()),
    }
  );

  useEffect(() => {
    if (open) {
      setForm(
        lead ?? {
          id: makeId(),
          name: "",
          phone: "",
          source: "facebook",
          vehicle: "",
          interest: "medium",
          status: "new",
          notes: "",
          createdAt: formatISO(new Date()),
        }
      );
    }
  }, [open, lead]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (lead) {
      dispatch({ type: "updateLead", id: lead.id, patch: form });
    } else {
      dispatch({ type: "addLead", lead: form });
    }
    onOpenChange(false);
  }

  function handleDelete() {
    if (!lead) return;
    if (window.confirm("Delete this lead?")) {
      dispatch({ type: "deleteLead", id: lead.id });
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{lead ? "Edit lead" : "New lead"}</DialogTitle>
          <DialogDescription>Track potential customers from first contact.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="lname">Name</Label>
              <Input
                id="lname"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lphone">Phone</Label>
              <Input
                id="lphone"
                value={form.phone ?? ""}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select
                value={form.source}
                onValueChange={(v) => setForm({ ...form, source: v as LeadSource })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lveh">Vehicle</Label>
              <Input
                id="lveh"
                value={form.vehicle ?? ""}
                onChange={(e) => setForm({ ...form, vehicle: e.target.value })}
                placeholder="2020 Toyota RAV4"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Interest</Label>
              <Select
                value={form.interest}
                onValueChange={(v) => setForm({ ...form, interest: v as Lead["interest"] })}
              >
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
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as LeadStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lcontacted">Last contacted</Label>
              <Input
                id="lcontacted"
                type="date"
                value={form.lastContacted ? form.lastContacted.slice(0, 10) : ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    lastContacted: e.target.value ? formatISO(new Date(e.target.value)) : undefined,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lfollow">Follow-up date</Label>
              <Input
                id="lfollow"
                type="date"
                value={form.followUpDate ? form.followUpDate.slice(0, 10) : ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    followUpDate: e.target.value ? formatISO(new Date(e.target.value)) : undefined,
                  })
                }
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lnotes">Notes</Label>
            <Textarea
              id="lnotes"
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="What they said, what they're interested in…"
            />
          </div>

          {form.phone ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setReachOpen(true)}
            >
              <MessageSquare className="h-4 w-4" /> Reach out (text · call · email)
            </Button>
          ) : null}

          <DialogFooter className="!justify-between">
            {lead ? (
              <Button type="button" variant="ghost" className="text-destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit">{lead ? "Save changes" : "Add lead"}</Button>
            </div>
          </DialogFooter>
        </form>
        <ReachOutDialog
          open={reachOpen}
          onOpenChange={setReachOpen}
          contact={{
            name: form.name || "Lead",
            phone: form.phone ?? null,
            vehicle: form.vehicle ?? null,
            followUpNotes: form.notes ?? null,
            lastContacted: form.lastContacted
              ? form.lastContacted.slice(0, 10)
              : null,
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
