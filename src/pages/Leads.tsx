import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
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
import { useRegisterIrisContext } from "@/components/iris/PageContext";
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
  { value: "new", label: "New", tone: "bg-sky-500" },
  { value: "contacted", label: "Contacted", tone: "bg-amber-500" },
  { value: "waiting", label: "Waiting response", tone: "bg-violet-500" },
  { value: "booked", label: "Booked", tone: "bg-emerald-500" },
  { value: "lost", label: "Lost", tone: "bg-rose-500" },
];

export function LeadsPage() {
  const { data, dispatch } = useStore();
  useRegisterIrisContext({ page: "leads", label: "Leads" });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | undefined>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Open the edit dialog when a lead id is passed in the URL (from search palette)
  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) return;
    const found = data.leads.find((l) => l.id === id);
    if (found) {
      setEditing(found);
      setOpen(true);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("id");
    setSearchParams(next, { replace: true });
  }, [searchParams, data.leads, setSearchParams]);

  const grouped = useMemo(() => {
    const map = new Map<LeadStatus, Lead[]>();
    STATUS_COLUMNS.forEach((s) => map.set(s.value, []));
    data.leads.forEach((l) => {
      map.get(l.status)?.push(l);
    });
    return map;
  }, [data.leads]);

  return (
    <div className="space-y-6">
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
            <Card key={col.value} className="overflow-hidden">
              {/* Top accent bar — replaces border-t-2 for cleaner color expression */}
              <div className={cn("h-1 w-full", col.tone)} aria-hidden />
              <CardHeader className="pb-3 pt-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{col.label}</CardTitle>
                  <Badge variant="outline">{leads.length}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {leads.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Empty</p>
                ) : (
                  leads.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => {
                        setEditing(l);
                        setOpen(true);
                      }}
                      className={cn(
                        "w-full rounded-md border border-border/80 bg-card p-3 text-left",
                        "transition-[border-color,background-color,box-shadow] duration-fast",
                        "hover:border-border hover:bg-hover hover:shadow-soft",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold leading-tight">
                          {l.name}
                        </p>
                        <Badge variant="outline" className="capitalize">
                          {l.source}
                        </Badge>
                      </div>
                      {l.vehicle ? (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {l.vehicle}
                        </p>
                      ) : null}
                      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 capitalize",
                            l.interest === "high"
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                              : l.interest === "medium"
                              ? "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                              : "border-slate-500/20 bg-slate-500/10 text-slate-700 dark:text-slate-300"
                          )}
                        >
                          {l.interest}
                        </span>
                        {l.followUpDate ? (
                          <span className="tabular-nums">
                            {format(parseISO(l.followUpDate), "MMM d")}
                          </span>
                        ) : null}
                      </div>
                      {l.notes ? (
                        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
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
